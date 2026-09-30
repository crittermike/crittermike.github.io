import { createDebouncedSearch } from './core.js';

const $ = id => document.getElementById(id);
const message = $('message');
const cache = new Map();
let catalog = new Map();
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
}

async function api(path, { body, signal } = {}) {
  let response;
  try {
    response = await fetch(`./api/${path}`, {
      method: body === undefined ? 'GET' : 'POST',
      headers: body === undefined ? {} : { 'Content-Type': 'application/json', 'X-Bufo-Token': csrfToken },
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: 'no-store',
      signal
    });
  } catch {
    if (signal?.aborted) throw signal.reason;
    throw new Error('Cannot reach Bufo. Check your connection and retry.');
  }
  if (!response.headers.get('content-type')?.includes('application/json')) {
    throw new Error('Cannot reach the app service. Reload to check your access.');
  }
  let data;
  try {
    data = await response.json();
  } catch {
    if (signal?.aborted) throw signal.reason;
    throw new Error('The service returned an unreadable response. Try again.');
  }
  if (!response.ok) {
    const error = new Error(data.error || 'The service could not complete this request.');
    error.code = data.code;
    error.retryAfter = data.retryAfter || 0;
    throw error;
  }
  return data;
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

function render({ ranking }) {
  const invalid = () => Object.assign(new Error('The emoji collection changed. Retry to reload it.'), { code: 'CATALOG_CHANGED' });
  if (!Array.isArray(ranking.suggestions) || ranking.evaluatedCount !== catalog.size) {
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
    const code = `:${emoji.name}:`;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'emoji';
    button.setAttribute('aria-label', `Copy ${code}`);
    const image = document.createElement('img');
    image.src = `./api/emoji/${emoji.id}`;
    image.alt = '';
    image.width = 80;
    image.height = 80;
    image.loading = 'lazy';
    image.decoding = 'async';
    image.addEventListener('error', () => {
      if (!button.isConnected) return;
      const fallback = document.createElement('span');
      fallback.className = 'image-fallback';
      fallback.textContent = 'No preview';
      image.replaceWith(fallback);
      status('Some previews failed. You can still click a name to copy it.');
    }, { once: true });
    const name = document.createElement('span');
    name.className = 'emoji-name';
    name.textContent = code;
    button.append(image, name);
    button.addEventListener('click', () => copy(code));
    $('results').append(button);
  }
  status(ranking.weakMatch ? 'No strong match. These are the closest fits.' : 'Click a bufo to copy.');
}

const searcher = createDebouncedSearch({
  async search(text, signal) {
    if (cache.has(text)) return { ranking: cache.get(text) };
    status(`Scoring all ${catalog.size.toLocaleString()} emojis...`, { busy: true });
    const ranking = await api('suggest', { body: { text }, signal });
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
    if (!Array.isArray(data.emojis) || !data.emojis.length ||
        data.emojis.some(emoji => !/^[a-f0-9]{20}$/.test(emoji.id) || typeof emoji.name !== 'string')) {
      throw new Error('The emoji collection could not load. Try again.');
    }
    catalog = new Map(data.emojis.map(emoji => [emoji.id, emoji]));
    cache.clear();
    ready = true;
    message.disabled = false;
    updateMessage();
  } catch (error) {
    fail(error);
  }
}

async function copy(code) {
  clearTimeout(copyTimer);
  $('manual-copy').hidden = true;
  try {
    await navigator.clipboard.writeText(code);
    $('copy-status').textContent = `Copied ${code}`;
    copyTimer = setTimeout(() => { $('copy-status').textContent = ''; }, 2400);
  } catch {
    $('copy-status').textContent = 'Clipboard unavailable. Copy the code below.';
    $('copy-code').value = code;
    $('manual-copy').hidden = false;
    $('copy-code').focus();
    $('copy-code').select();
  }
}

message.addEventListener('input', updateMessage);
message.addEventListener('compositionstart', () => { composing = true; searcher.cancel(); });
message.addEventListener('compositionend', () => { composing = false; updateMessage(); });
$('retry').addEventListener('click', () => retry());
window.addEventListener('pagehide', () => searcher.cancel());
load();
