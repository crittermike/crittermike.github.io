import { execFile } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { mkdir, open, readFile, rename, unlink, writeFile } from 'node:fs/promises';
import { dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { promisify } from 'node:util';
import { setTimeout as delay } from 'node:timers/promises';
import { AppError } from './jev.mjs';

export const SOURCE_REPO = 'github/slack-emoji';
export const DATA_DIR = process.env.BUFO_DATA_DIR ? resolve(process.env.BUFO_DATA_DIR) : fileURLToPath(new URL('.local/', import.meta.url));
const MAX_IMAGE_BYTES = 8_000_000;
const TYPES = { png: 'image/png', gif: 'image/gif', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp' };
const execFileAsync = promisify(execFile);

export async function githubApi(endpoint, raw = false) {
  if (process.env.BUFO_GITHUB_TOKEN) return githubHttpApi(process.env.BUFO_GITHUB_TOKEN)(endpoint, raw);
  try {
    const { stdout } = await execFileAsync('gh', [
      'api', endpoint,
      '-H', `Accept: ${raw ? 'application/vnd.github.raw+json' : 'application/vnd.github+json'}`
    ], { encoding: raw ? 'buffer' : 'utf8', maxBuffer: 16_000_000, timeout: 25_000 });
    return raw ? stdout : JSON.parse(stdout);
  } catch (error) {
    const limited = /rate limit|HTTP 429/.test(String(error.stderr));
    throw new AppError(limited ? 429 : 503,
      limited
        ? 'GitHub is rate limiting image requests. Wait a little, then reload.'
        : 'GitHub access failed. Run gh auth status and check access to the emoji source repo.',
      'GITHUB_ACCESS', limited ? 60 : 0);
  }
}

export function githubHttpApi(token, fetchImpl = fetch) {
  return async (endpoint, raw = false) => {
    if (!new RegExp(`^repos/${SOURCE_REPO}/git/(?:trees|blobs)/[a-zA-Z0-9]+(?:\\?recursive=1)?$`).test(endpoint)) {
      throw new AppError(400, 'Unsupported GitHub source request.', 'INVALID_SOURCE');
    }
    let response;
    try {
      response = await fetchImpl(`https://api.github.com/${endpoint}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: raw ? 'application/vnd.github.raw+json' : 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28'
        },
        signal: AbortSignal.timeout(25_000),
        redirect: 'error'
      });
    } catch {
      throw new AppError(503, 'The emoji source is unreachable. Try again shortly.', 'GITHUB_ACCESS');
    }
    if (!response.ok) {
      await response.body?.cancel();
      throw new AppError(503, 'The emoji source is unavailable. The app owner needs to check GitHub access.', 'GITHUB_ACCESS');
    }
    const chunks = [];
    let size = 0;
    try {
      for await (const chunk of response.body) {
        size += chunk.length;
        if (size > 16_000_000) throw new AppError(502, 'The emoji source response is too large.', 'INVALID_SOURCE');
        chunks.push(chunk);
      }
      const bytes = Buffer.concat(chunks);
      return raw ? bytes : JSON.parse(bytes.toString('utf8'));
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError(502, 'The emoji source returned an invalid response.', 'INVALID_SOURCE');
    }
  };
}

function assertTree(tree) {
  if (!tree || tree.truncated !== false || !Array.isArray(tree.tree)) {
    throw new AppError(503, 'GitHub returned an incomplete emoji tree. Try syncing again.', 'INVALID_CATALOG');
  }
}

export function catalogFromTree(tree, canonicalPaths = {}, sourcePrefix = '_bufo/') {
  assertTree(tree);
  const blobs = tree.tree.filter(entry => entry.type === 'blob' && entry.mode !== '120000' && Object.hasOwn(TYPES, extname(entry.path).slice(1).toLowerCase()));
  const pathNames = new Map(blobs.map(entry => [entry.path, entry.path.split('/').at(-1).slice(0, -extname(entry.path).length)]));
  const occurrences = new Map();
  for (const name of pathNames.values()) occurrences.set(name, (occurrences.get(name) || 0) + 1);
  const names = new Set();
  const emojis = blobs.flatMap(entry => {
    const extension = extname(entry.path).slice(1).toLowerCase();
    const filename = entry.path.split('/').at(-1);
    const name = pathNames.get(entry.path);
    if (occurrences.get(name) > 1 && canonicalPaths[name] !== `${sourcePrefix}${entry.path}`) return [];
    if (!name || name.length > 200 || /[\x00-\x1f\x7f/:\\]/.test(name) || names.has(name) ||
        !/^[a-f0-9]{40}$/.test(entry.sha) || !Number.isSafeInteger(entry.size) ||
        entry.size < 1 || entry.size > MAX_IMAGE_BYTES) {
      throw new AppError(503, 'The emoji tree contains an invalid or duplicate image entry.', 'INVALID_CATALOG');
    }
    names.add(name);
    // Preserve existing IDs while namespacing imports from other source directories.
    const idPath = sourcePrefix === '_bufo/' ? entry.path : `canonical\0${sourcePrefix}${entry.path}`;
    return [{
      id: createHash('sha256').update(idPath).digest('hex').slice(0, 20),
      name,
      filename,
      sha: entry.sha,
      extension,
      size: entry.size
    }];
  }).sort((a, b) => a.name.localeCompare(b.name));
  if ([...occurrences].some(([name, count]) => count > 1 && !names.has(name))) {
    throw new AppError(503, 'A duplicate emoji name is missing from the canonical source mapping.', 'INVALID_CATALOG');
  }
  if (!emojis.length) throw new AppError(503, 'No supported emoji images were found.', 'INVALID_CATALOG');
  return { version: 1, source: SOURCE_REPO, syncedAt: new Date().toISOString(), emojis };
}

export function validateCatalog(catalog) {
  if (catalog?.version !== 1 || catalog.source !== SOURCE_REPO || !Array.isArray(catalog.emojis) || !catalog.emojis.length) {
    throw new AppError(503, 'The local catalog is invalid. Run npm run sync again.', 'INVALID_CATALOG');
  }
  const ids = new Set();
  const names = new Set();
  for (const entry of catalog.emojis) {
    if (!entry || typeof entry.name !== 'string' || !entry.name || entry.name.length > 200 ||
        /[\x00-\x1f\x7f/:\\]/.test(entry.name) || !/^[a-f0-9]{20}$/.test(entry.id) ||
        !/^[a-f0-9]{40}$/.test(entry.sha) || !Object.hasOwn(TYPES, entry.extension) ||
        typeof entry.filename !== 'string' || entry.filename !== `${entry.name}.${extname(entry.filename).slice(1)}` ||
        extname(entry.filename).slice(1).toLowerCase() !== entry.extension ||
        !Number.isSafeInteger(entry.size) || entry.size < 1 || entry.size > MAX_IMAGE_BYTES ||
        ids.has(entry.id) || names.has(entry.name)) {
      throw new AppError(503, 'The local catalog has an invalid image entry. Run npm run sync again.', 'INVALID_CATALOG');
    }
    ids.add(entry.id);
    names.add(entry.name);
  }
  return catalog;
}

export async function atomicWrite(path, data, { durable = false } = {}) {
  await mkdir(dirname(path), { recursive: true, mode: 0o700 });
  const temporary = `${path}.${randomUUID()}.tmp`;
  try {
    await writeFile(temporary, data, { mode: 0o600, flag: 'wx' });
    if (durable) {
      const file = await open(temporary, 'r+');
      try { await file.sync(); } finally { await file.close(); }
    }
    await rename(temporary, path);
    if (durable) {
      const directory = await open(dirname(path), 'r');
      try { await directory.sync(); } finally { await directory.close(); }
    }
  } finally {
    await unlink(temporary).catch(error => {
      if (error.code !== 'ENOENT') throw error;
    });
  }
}

export async function syncCatalog({ dataDir = DATA_DIR, api = githubApi } = {}) {
  let ref = 'main';
  let mappingSha;
  let emojiRoot;
  for (const directory of ['emojis', '_bufo']) {
    const tree = await api(`repos/${SOURCE_REPO}/git/trees/${ref}`);
    assertTree(tree);
    const child = tree.tree.find(entry => entry.path === directory && entry.type === 'tree');
    if (directory === '_bufo') {
      emojiRoot = tree;
      mappingSha = tree.tree.find(entry => entry.path === 'emojis.json' && entry.type === 'blob')?.sha;
    }
    if (!child || !/^[a-f0-9]{40}$/.test(child.sha)) {
      throw new AppError(503, 'The bufo source directory could not be found.', 'INVALID_CATALOG');
    }
    ref = child.sha;
  }
  if (!mappingSha || !/^[a-f0-9]{40}$/.test(mappingSha)) {
    throw new AppError(503, 'The canonical emoji mapping is missing from the source.', 'INVALID_CATALOG');
  }
  let canonicalPaths;
  try {
    canonicalPaths = JSON.parse((await api(`repos/${SOURCE_REPO}/git/blobs/${mappingSha}`, true)).toString('utf8'));
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(503, 'The canonical emoji mapping is unreadable.', 'INVALID_CATALOG');
  }
  if (!canonicalPaths || typeof canonicalPaths !== 'object' || Array.isArray(canonicalPaths)) {
    throw new AppError(503, 'The canonical emoji mapping is invalid.', 'INVALID_CATALOG');
  }
  const catalog = catalogFromTree(await api(`repos/${SOURCE_REPO}/git/trees/${ref}?recursive=1`), canonicalPaths);
  const extraPaths = new Set();
  for (const [name, path] of Object.entries(canonicalPaths)) {
    if (!/bufo.*_\d+_\d+$/i.test(name)) continue;
    if (typeof path !== 'string' || /[\\\x00-\x1f\x7f]/.test(path) ||
        path.split('/').some(part => !part || part === '.' || part === '..') ||
        path.split('/').at(-1) !== `${name}${extname(path)}`) {
      throw new AppError(503, 'A multipart emoji has an invalid canonical path.', 'INVALID_CATALOG');
    }
    if (!path.startsWith('_bufo/')) extraPaths.add(path);
  }
  if (extraPaths.size) {
    const directories = new Set([...extraPaths].map(path => path.includes('/') ? path.split('/')[0] : ''));
    const blobs = [];
    for (const directory of directories) {
      let tree = emojiRoot;
      if (directory) {
        const child = emojiRoot.tree.find(entry => entry.path === directory && entry.type === 'tree');
        if (!child || !/^[a-f0-9]{40}$/.test(child.sha)) {
          throw new AppError(503, 'A multipart emoji source directory is missing.', 'INVALID_CATALOG');
        }
        tree = await api(`repos/${SOURCE_REPO}/git/trees/${child.sha}?recursive=1`);
        assertTree(tree);
      }
      for (const entry of tree.tree) {
        const path = directory ? `${directory}/${entry.path}` : entry.path;
        if (extraPaths.has(path)) blobs.push({ ...entry, path });
      }
    }
    const extra = catalogFromTree({ truncated: false, tree: blobs }, canonicalPaths, '');
    if (extra.emojis.length !== extraPaths.size) {
      throw new AppError(503, 'A multipart emoji is missing from its canonical source directory.', 'INVALID_CATALOG');
    }
    catalog.emojis = [...new Map([...catalog.emojis, ...extra.emojis].map(emoji => [emoji.name, emoji])).values()]
      .sort((a, b) => a.name.localeCompare(b.name));
  }
  validateCatalog(catalog);
  await atomicWrite(join(dataDir, 'catalog.json'), `${JSON.stringify(catalog)}\n`);
  return catalog;
}

export function imageType(bytes) {
  if (bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return 'image/png';
  if (['GIF87a', 'GIF89a'].includes(bytes.subarray(0, 6).toString())) return 'image/gif';
  if (bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) return 'image/jpeg';
  if (bytes.subarray(0, 4).toString() === 'RIFF' && bytes.subarray(8, 12).toString() === 'WEBP') return 'image/webp';
  return null;
}

function validImage(bytes, entry) {
  const sha = createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
  // Some canonical .png filenames contain WebP images.
  return bytes.length === entry.size && sha === entry.sha && imageType(bytes) !== null;
}

export function createCatalogStore({ dataDir = DATA_DIR, api = githubApi, readOnly = false } = {}) {
  let catalog;
  const inFlight = new Map();
  let active = 0;
  const queue = [];
  async function download(entry) {
    if (active >= 4) await new Promise(resolve => queue.push(resolve));
    else active += 1;
    try {
      const bytes = await api(`repos/${SOURCE_REPO}/git/blobs/${entry.sha}`, true);
      if (!Buffer.isBuffer(bytes) || !validImage(bytes, entry)) {
        throw new AppError(502, 'GitHub returned an invalid emoji image.', 'INVALID_IMAGE');
      }
      await atomicWrite(join(dataDir, 'images', `${entry.sha}.${entry.extension}`), bytes);
      return bytes;
    } finally {
      if (queue.length) queue.shift()();
      else active -= 1;
    }
  }
  return {
    async get(reload = false) {
      if (catalog && !reload) return catalog;
      let raw;
      try {
        raw = await readFile(join(dataDir, 'catalog.json'), 'utf8');
      } catch (error) {
        if (error.code === 'ENOENT') {
          throw new AppError(503, 'The emoji catalog is missing. The app owner needs to sync or deploy it.', 'CATALOG_MISSING');
        }
        throw error;
      }
      let parsed;
      try {
        parsed = JSON.parse(raw);
      } catch {
        throw new AppError(503, 'The local catalog is unreadable. Run npm run sync again.', 'INVALID_CATALOG');
      }
      catalog = validateCatalog(parsed);
      return catalog;
    },
    async image(id) {
      const current = await this.get();
      const entry = current.emojis.find(emoji => emoji.id === id);
      if (!entry) throw new AppError(404, 'Emoji not found in the local catalog.', 'NOT_FOUND');
      const path = join(dataDir, 'images', `${entry.sha}.${entry.extension}`);
      try {
        const bytes = await readFile(path);
        if (!validImage(bytes, entry)) {
          if (readOnly) throw new AppError(503, 'An emoji image is damaged. The app owner needs to redeploy the collection.', 'INVALID_IMAGE');
          console.warn('Repairing an invalid locally cached emoji image.');
          await unlink(path);
        } else {
          return { bytes, type: imageType(bytes) };
        }
      } catch (error) {
        if (error.code !== 'ENOENT') throw error;
      }
      if (readOnly) throw new AppError(503, 'An emoji image is missing. The app owner needs to redeploy the collection.', 'IMAGE_MISSING');
      if (!inFlight.has(entry.sha)) {
        inFlight.set(entry.sha, download(entry).finally(() => inFlight.delete(entry.sha)));
      }
      const bytes = await inFlight.get(entry.sha);
      return { bytes, type: imageType(bytes) };
    }
  };
}

export async function exportCatalog({
  store = createCatalogStore(),
  outputDir = fileURLToPath(new URL('public-assets/', import.meta.url)),
  intervalMs = 200,
  onProgress
} = {}) {
  const catalog = validateCatalog(await store.get());
  let next = 0;
  let completed = 0;
  let nextStart = 0;
  let failed = false;
  await Promise.all(Array.from({ length: 4 }, async () => {
    try {
      while (next < catalog.emojis.length && !failed) {
        const entry = catalog.emojis[next++];
        const start = Math.max(Date.now(), nextStart);
        nextStart = start + intervalMs;
        await delay(Math.max(0, start - Date.now()));
        if (failed) return;
        const { bytes } = await store.image(entry.id);
        if (!validImage(bytes, entry)) throw new AppError(503, 'Cannot export an invalid emoji image.', 'INVALID_IMAGE');
        await atomicWrite(join(outputDir, 'images', `${entry.sha}.${entry.extension}`), bytes);
        completed += 1;
        onProgress?.(completed, catalog.emojis.length);
      }
    } catch (error) {
      failed = true;
      throw error;
    }
  }));
  await atomicWrite(join(outputDir, 'catalog.json'), `${JSON.stringify(catalog)}\n`);
  return catalog;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    if (process.argv.includes('--export')) {
      const catalog = await exportCatalog({
        onProgress: (count, total) => { if (count % 100 === 0) console.log(`Prepared ${count} of ${total} images.`); }
      });
      console.log(`Exported ${catalog.emojis.length} verified emojis to public-assets/. Only publish assets you are authorized to share.`);
    } else {
      const catalog = await syncCatalog();
      console.log(`Synced ${catalog.emojis.length} emoji names to the local cache. Images download on demand.`);
      console.log('Catalogs and images stay out of Git. Use npm run export to prepare an authorized public deployment.');
    }
  } catch (error) {
    console.error(error instanceof AppError ? error.message : 'Could not write the local catalog. Check local file permissions.');
    process.exitCode = 1;
  }
}
