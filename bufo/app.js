import { createDebouncedSearch, groupEmojis, readSuggestionStream } from './core.js';

const $ = id => document.getElementById(id);
const message = $('message');
const cache = new Map();
let catalog = new Map();
let fileCount = 0;
let catalogSyncedAt = '';
let csrfToken = '';
let ready = false;
let composing = false;
let cooldownUntil = 0;
let retry = load;
let copyTimer;

function status(text, { busy = false, error = false } = {}) {
  $('status').textContent = text;
  $('status').classList.toggle('error', error);
  $('results').setAttribute('aria-busy', String(busy));
  $('scoring-progress').hidden = !busy;
}

async function api(path, { body, signal, onProgress } = {}) {
  const controller = new AbortController();
  const requestSignal = signal ? AbortSignal.any([signal, controller.signal]) : controller.signal;
  try {
    let response;
    try {
      response = await fetch(`./api/${path}`, {
        method: body === undefined ? 'GET' : 'POST',
        headers: body === undefined ? {} : {
          'Content-Type': 'application/json', 'X-Bufo-Token': csrfToken,
          ...(onProgress ? { Accept: 'application/x-ndjson' } : {})
        },
        body: body === undefined ? undefined : JSON.stringify(body),
        cache: 'no-store',
        signal: requestSignal
      });
    } catch {
      if (signal?.aborted) throw signal.reason;
      throw new Error('Cannot reach Bufo. Check your connection and retry.');
    }
    if (response.ok && response.headers.get('content-type')?.includes('application/x-ndjson')) {
      return await readSuggestionStream(response.body, { onProgress, signal: requestSignal });
    }
    if (!response.headers.get('content-type')?.includes('application/json')) {
      throw new Error('Cannot reach the app service. Reload to check your access.');
    }
    let data;
    try { data = await response.json(); } catch {
      if (signal?.aborted) throw signal.reason;
      throw new Error('The service returned an unreadable response. Try again.');
    }
    if (!response.ok) {
      throw Object.assign(new Error(data.error || 'The service could not complete this request.'), {
        code: data.code, retryAfter: data.retryAfter || 0
      });
    }
    return data;
  } catch (error) {
    controller.abort();
    throw error;
  }
}

function fail(error) {
  $('results').replaceChildren();
  status(error.message, { error: true });
  if (error.retryAfter) cooldownUntil = Date.now() + error.retryAfter * 1000;
  if (['PROVIDER_AUTH', 'PROVIDER_BILLING', 'NOT_CONFIGURED', 'FORBIDDEN', 'CATALOG_CHANGED'].includes(error.code)) {
    ready = false;
    message.disabled = true;
  }
  retry = ready ? updateMessage : load;
  $('retry').hidden = false;
}

function previewImage(tile, button, composite) {
  const image = document.createElement('img');
  image.src = `./api/emoji/${tile.id}`;
  image.alt = '';
  image.width = 80;
  image.height = 80;
  image.loading = 'lazy';
  image.decoding = 'async';
  image.addEventListener('error', () => {
    if (!button.isConnected) return;
    const fallback = document.createElement('span');
    fallback.className = 'image-fallback';
    fallback.textContent = composite ? '?' : 'No preview';
    image.replaceWith(fallback);
    status('Some previews failed. You can still click a name to copy it.');
  }, { once: true });
  return image;
}

function render({ ranking, cached }) {
  const invalid = () => Object.assign(new Error('The emoji collection changed. Retry to reload it.'), { code: 'CATALOG_CHANGED' });
  if (!Array.isArray(ranking.suggestions) || ranking.evaluatedCount !== fileCount || ranking.syncedAt !== catalogSyncedAt ||
      !Number.isFinite(ranking.elapsedMs) || ranking.elapsedMs < 0) {
    throw invalid();
  }
  const results = ranking.suggestions.map(match => {
    const emoji = catalog.get(match.id);
    if (!emoji || !Number.isFinite(match.score) || match.score < 0 || match.score > 1) {
      throw invalid();
    }
    return emoji;
  });
  $('results').replaceChildren();
  for (const emoji of results) {
    const label = emoji.composite ? emoji.name : emoji.copyText;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'emoji';
    const preview = document.createElement('span');
    preview.className = 'emoji-preview';
    if (!emoji.complete) {
      button.disabled = true;
      button.classList.add('emoji-incomplete');
      button.setAttribute('aria-label', `${label}: incomplete tile set`);
      const fallback = document.createElement('span');
      fallback.className = 'image-fallback';
      fallback.textContent = 'Missing tiles';
      preview.append(fallback);
    } else {
      const dimensions = emoji.composite ? ` (${emoji.rows.length} by ${emoji.rows[0].length} tiles)` : '';
      button.setAttribute('aria-label', `Copy ${label}${dimensions}`);
      if (emoji.composite) {
        const mosaic = document.createElement('span');
        mosaic.className = 'emoji-mosaic';
        mosaic.style.setProperty('--rows', emoji.rows.length);
        mosaic.style.setProperty('--columns', emoji.rows[0].length);
        mosaic.append(...emoji.tiles.map(tile => previewImage(tile, button, true)));
        preview.append(mosaic);
      } else {
        preview.append(previewImage(emoji.tiles[0], button, false));
      }
      button.addEventListener('click', () => copy(emoji.copyText, label));
    }
    const name = document.createElement('span');
    name.className = 'emoji-name';
    name.textContent = label;
    button.append(preview, name);
    if (emoji.composite && emoji.tiles.length > 1) {
      const badge = document.createElement('span');
      badge.className = 'emoji-size';
      badge.textContent = `BIG: ${emoji.tiles.length} emojis`;
      button.append(badge);
    }
    $('results').append(button);
  }
  const notice = ranking.weakMatch ? 'No strong match. These are the closest fits.' : 'Click a bufo to copy.';
  const timing = cached ? 'Cached results.' : `${fileCount.toLocaleString()} scored in ${(ranking.elapsedMs / 1000).toFixed(1)}s.`;
  status(`${timing} ${notice}` + (results.some(emoji => !emoji.complete) ? ' Incomplete tile sets cannot be copied.' : ''));
}

const searcher = createDebouncedSearch({
  async search(text, signal) {
    if (cache.has(text)) return { ranking: cache.get(text), cached: true };
    $('scoring-progress').max = fileCount;
    $('scoring-progress').value = 0;
    status(`0 of ${fileCount.toLocaleString()} scored`, { busy: true });
    const ranking = await api('suggest', {
      body: { text, syncedAt: catalogSyncedAt }, signal,
      onProgress({ scoredCount, totalCount }) {
        if (signal.aborted) return;
        if (totalCount !== fileCount) {
          throw Object.assign(new Error('The emoji collection changed. Retry to reload it.'), { code: 'CATALOG_CHANGED' });
        }
        $('scoring-progress').value = scoredCount;
        status(`${scoredCount.toLocaleString()} of ${totalCount.toLocaleString()} scored`, { busy: true });
      }
    });
    if (!signal.aborted) {
      if (cache.size >= 20) cache.delete(cache.keys().next().value);
      cache.set(text, ranking);
    }
    return { ranking };
  },
  onResult: render,
  onError: fail
});

function updateMessage() {
  searcher.cancel();
  $('results').replaceChildren();
  $('retry').hidden = true;
  $('manual-copy').hidden = true;
  $('copy-status').textContent = '';
  if (!ready) return;
  const text = message.value.trim();
  if (!text) { status(''); return; }
  if (composing) { status(''); return; }
  if (Date.now() < cooldownUntil) {
    fail(new Error(`Try again in ${Math.ceil((cooldownUntil - Date.now()) / 1000)} seconds.`));
    return;
  }
  status('Waiting for a pause...');
  searcher.schedule(text);
}

async function load() {
  searcher.cancel();
  ready = false;
  message.disabled = true;
  $('retry').hidden = true;
  status('Loading...');
  try {
    const info = await api('status');
    csrfToken = info.csrfToken;
    if (!info.ready) throw new Error(info.error || 'The app owner needs to finish setting up this service.');
    const data = await api('catalog');
    if (!Array.isArray(data.emojis) || !data.emojis.length || typeof data.syncedAt !== 'string' ||
        data.emojis.some(emoji => !/^[a-f0-9]{20}$/.test(emoji.id) || typeof emoji.name !== 'string')) {
      throw new Error('The emoji collection could not load. Try again.');
    }
    fileCount = data.emojis.length;
    catalogSyncedAt = data.syncedAt;
    catalog = new Map(groupEmojis(data.emojis).map(emoji => [emoji.id, emoji]));
    cache.clear();
    ready = true;
    message.disabled = false;
    updateMessage();
  } catch (error) {
    fail(error);
  }
}

async function copy(code, label) {
  clearTimeout(copyTimer);
  $('manual-copy').hidden = true;
  try {
    await navigator.clipboard.writeText(code);
    $('copy-status').textContent = `Copied ${label}`;
    copyTimer = setTimeout(() => { $('copy-status').textContent = ''; }, 2400);
  } catch {
    $('copy-status').textContent = 'Clipboard unavailable. Copy the code below.';
    $('copy-code').value = code;
    $('copy-code').rows = Math.min(12, Math.max(2, code.split('\n').length));
    $('manual-copy').hidden = false;
    $('copy-code').focus();
    $('copy-code').select();
  }
}

message.addEventListener('input', updateMessage);
message.addEventListener('compositionstart', () => { composing = true; updateMessage(); });
message.addEventListener('compositionend', () => { composing = false; updateMessage(); });
$('retry').addEventListener('click', () => retry());
window.addEventListener('pagehide', () => searcher.cancel());
load();
