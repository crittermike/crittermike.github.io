import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { catalogFromTree, createCatalogStore, imageType, SOURCE_REPO, syncCatalog, validateCatalog } from '../catalog.mjs';
import { catalog, emoji, imageBytes } from './fixtures.mjs';

async function temporary(t) {
  const directory = await mkdtemp(join(tmpdir(), 'bufo-test-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  return directory;
}

function treeEntry(index, name = `bufo-example-${index}`) {
  const entry = emoji(index, name);
  return { type: 'blob', mode: '100644', path: entry.filename, sha: entry.sha, size: entry.size };
}

test('sync follows pinned subtrees and uses the canonical map for duplicate file extensions', async t => {
  const dataDir = await temporary(t);
  const calls = [];
  const emojisTree = 'a'.repeat(40);
  const bufoTree = 'b'.repeat(40);
  const mappingBlob = 'c'.repeat(40);
  const result = await syncCatalog({
    dataDir,
    api: async (path, raw) => {
      calls.push({ path, raw });
      if (path.endsWith('/main')) return { truncated: false, tree: [{ type: 'tree', path: 'emojis', sha: emojisTree }] };
      if (path.endsWith(`/${emojisTree}`)) return {
        truncated: false,
        tree: [{ type: 'tree', path: '_bufo', sha: bufoTree }, { type: 'blob', path: 'emojis.json', sha: mappingBlob }]
      };
      if (path.endsWith(`/${mappingBlob}`)) return Buffer.from(JSON.stringify({ 'bufo-party': '_bufo/bufo-party.gif' }));
      if (path.endsWith(`/${bufoTree}?recursive=1`)) return {
        truncated: false,
        tree: [treeEntry(1, 'bufo-party'), { ...treeEntry(2, 'bufo-party'), path: 'bufo-party.gif' }, treeEntry(3, 'bufo-coffee')]
      };
      assert.fail(`Unexpected path ${path}`);
    }
  });
  assert.equal(result.emojis.length, 2);
  assert.equal(result.emojis.find(entry => entry.name === 'bufo-party').filename, 'bufo-party.gif');
  assert.equal(calls.length, 4);
  assert.equal(calls.filter(call => call.raw).length, 1);
  assert.deepEqual(JSON.parse(await readFile(join(dataDir, 'catalog.json'), 'utf8')), result);
  assert.equal((await stat(join(dataDir, 'catalog.json'))).mode & 0o077, 0);
});

test('rejects truncated trees, ambiguous duplicate names, and empty catalogs', () => {
  assert.throws(() => catalogFromTree({ truncated: true, tree: [treeEntry(0)] }), { code: 'INVALID_CATALOG' });
  assert.throws(() => catalogFromTree({ truncated: false, tree: [] }), { code: 'INVALID_CATALOG' });
  assert.throws(() => catalogFromTree({ truncated: false, tree: [treeEntry(0), { ...treeEntry(0), path: 'bufo-example-0.gif' }] }), { code: 'INVALID_CATALOG' });
});

test('accepts punctuation in actual filenames but rejects control characters and unsupported assets', () => {
  const result = catalogFromTree({
    truncated: false,
    tree: [treeEntry(0, "bufo's-coffee+1"), { ...treeEntry(1), path: 'untrusted.svg' }, { ...treeEntry(2), mode: '120000' }]
  });
  assert.equal(result.emojis.length, 1);
  assert.equal(result.emojis[0].name, "bufo's-coffee+1");
  assert.throws(() => catalogFromTree({ truncated: false, tree: [treeEntry(0, 'bad\nname')] }));
});

test('validates local catalog IDs, names, digests, extensions, and sizes', () => {
  assert.equal(validateCatalog(catalog(1)).source, SOURCE_REPO);
  for (const patch of [
    { id: '../../etc' }, { sha: 'not-a-digest' }, { name: 'x\nbad' },
    { filename: '../outside.png' }, { extension: 'svg' }, { size: 8_000_001 }, { size: 0 }
  ]) {
    const value = catalog(1);
    Object.assign(value.emojis[0], patch);
    assert.throws(() => validateCatalog(value), { code: 'INVALID_CATALOG' });
  }
  const duplicate = catalog(1);
  duplicate.emojis.push(duplicate.emojis[0]);
  assert.throws(() => validateCatalog(duplicate), { code: 'INVALID_CATALOG' });
});

test('missing and malformed catalogs give actionable errors', async t => {
  const dataDir = await temporary(t);
  const store = createCatalogStore({ dataDir });
  await assert.rejects(store.get(), { code: 'CATALOG_MISSING' });
  await writeFile(join(dataDir, 'catalog.json'), 'not JSON');
  await assert.rejects(store.get(), { code: 'INVALID_CATALOG' });
});

test('downloads images once on demand, verifies Git blob hashes, and caches privately', async t => {
  const dataDir = await temporary(t);
  await writeFile(join(dataDir, 'catalog.json'), JSON.stringify(catalog(1)));
  let downloads = 0;
  const store = createCatalogStore({
    dataDir,
    api: async (path, raw) => {
      assert.equal(path, `repos/${SOURCE_REPO}/git/blobs/${emoji(0).sha}`);
      assert.equal(raw, true);
      downloads += 1;
      return imageBytes(0);
    }
  });
  const [first, second] = await Promise.all([store.image(emoji(0).id), store.image(emoji(0).id)]);
  assert.equal(downloads, 1);
  assert.equal(first.type, 'image/png');
  assert.deepEqual(first.bytes, second.bytes);
  await store.image(emoji(0).id);
  assert.equal(downloads, 1);
  assert.equal((await stat(join(dataDir, 'images', `${emoji(0).sha}.png`))).mode & 0o077, 0);
  await assert.rejects(store.image('f'.repeat(20)), { code: 'NOT_FOUND' });
});

test('does not accept non-image bytes or a mismatched image hash', async t => {
  const dataDir = await temporary(t);
  await writeFile(join(dataDir, 'catalog.json'), JSON.stringify(catalog(1)));
  for (const bytes of [Buffer.from('<svg onload="alert(1)"></svg>'), imageBytes(9)]) {
    const store = createCatalogStore({ dataDir, api: async () => bytes });
    await assert.rejects(store.image(emoji(0).id), { code: 'INVALID_IMAGE' });
  }
  assert.equal(imageType(Buffer.from('GIF89a')), 'image/gif');
  assert.equal(imageType(Buffer.from([255, 216, 255])), 'image/jpeg');
  assert.equal(imageType(Buffer.from('RIFF1234WEBP')), 'image/webp');
  assert.equal(imageType(Buffer.from('<svg>')), null);
});

test('bounds simultaneous GitHub image downloads to four', async t => {
  const dataDir = await temporary(t);
  const value = catalog(12);
  await writeFile(join(dataDir, 'catalog.json'), JSON.stringify(value));
  let active = 0;
  let maximum = 0;
  const store = createCatalogStore({
    dataDir,
    api: async path => {
      active += 1;
      maximum = Math.max(maximum, active);
      await new Promise(resolve => setTimeout(resolve, 5));
      active -= 1;
      const index = value.emojis.findIndex(entry => path.endsWith(entry.sha));
      return imageBytes(index);
    }
  });
  await Promise.all(value.emojis.map(entry => store.image(entry.id)));
  assert.equal(maximum, 4);
});
