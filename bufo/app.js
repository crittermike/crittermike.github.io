import { createDebouncedSearch, indexCatalog, MAX_TEXT_LENGTH, starterEmojis } from './core.js';

const $ = id => document.getElementById(id);
const message = $('message');
const aiEnabled = $('ai-enabled');
const dialog = $('connection-dialog');
const cache = new Map();
let catalog = [];
let starters = [];
let csrfToken = '';
let connected = false;
let provider = 'typesafe';
let providerLabel = 'TypeSafe';
let composing = false;
let cooldownUntil = 0;
let copyTimer;

function setStatus(text, busy = false) {
  $('status-text').textContent = text;
  $('status-line').classList.toggle('busy', busy);
  document.querySelector('.matches').setAttribute('aria-busy', String(busy));
}

async function api(path, { body, signal } = {}) {
  let response;
  try {
    response = await fetch(`./api/${path}`, {
      method: body === undefined ? 'GET' : 'POST',
      headers: body === undefined ? {} : { 'Content-Type': 'application/json', 'X-Bufo-Token': csrfToken },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal,
      cache: 'no-store'
    });
  } catch (error) {
    if (signal?.aborted) throw signal.reason;
    throw new Error('The local server is unreachable. Start it with npm start, then reload.');
  }
  if (!response.headers.get('content-type')?.includes('application/json')) {
    throw new Error('Open this app through its local Node server, not GitHub Pages or file://.');
  }
  let data;
  try {
    data = await response.json();
  } catch {
    throw new Error('The local server returned an unreadable response. Reload and try again.');
  }
  if (!response.ok) {
    const error = new Error(data.error || `Request failed (HTTP ${response.status}).`);
    error.code = data.code;
    error.retryAfter = data.retryAfter || 0;
    throw error;
  }
  return data;
}

function renderResults(results) {
  $('results').replaceChildren();
  $('image-notice').hidden = true;
  for (const [position, emoji] of results.entries()) {
    const card = $('emoji-template').content.firstElementChild.cloneNode(true);
    const code = `:${emoji.name}:`;
    card.setAttribute('aria-label', `Copy ${code}`);
    card.querySelector('.card-rank').textContent = String(position + 1).padStart(2, '0');
    card.querySelector('.emoji-name').textContent = code;
    card.querySelector('.match-reason').textContent = emoji.reason;
    const image = document.createElement('img');
    image.width = 64;
    image.height = 64;
    image.alt = '';
    image.loading = 'lazy';
    image.decoding = 'async';
    image.src = `./api/emoji/${emoji.id}`;
    card.querySelector('.emoji-preview').prepend(image);
    image.addEventListener('error', () => {
      if (!card.isConnected) return;
      image.hidden = true;
      card.querySelector('.image-fallback').hidden = false;
      $('image-notice').hidden = false;
    });
    card.addEventListener('click', () => copyCode(code));
    $('results').append(card);
  }
  $('empty-state').hidden = results.length > 0;
}

function renderEmpty(mode, title, description) {
  $('mode-label').textContent = mode;
  $('results-title').textContent = 'Your suggestions';
  $('results-description').textContent = 'Jev scores every filename against the meaning of your whole message.';
  $('ranking-note').hidden = true;
  renderResults([]);
  $('empty-title').textContent = title;
  $('empty-description').textContent = description;
}

function renderIdle() {
  if (message.value.trim()) {
    if (!connected) {
      renderEmpty('Not connected', 'Connect Jev to get suggestions.', 'Click Connect Jev and add a provider API key. Your message has not been analyzed.');
    } else if (!aiEnabled.checked) {
      renderEmpty('Jev is paused', 'Enable Jev to get suggestions.', 'Turn on "Suggest with Jev after I pause" to send this message for scoring.');
    } else {
      renderEmpty('Waiting for Jev', 'Reading the whole message.', 'Every emoji filename is scored independently. No keyword filtering or shortlist.');
    }
    return;
  }
  $('mode-label').textContent = 'Your frog collection';
  $('results-title').textContent = 'Meet the bufos';
  $('results-description').textContent = 'Preview gallery only, not message suggestions. Click a frog to copy its Slack code.';
  $('ranking-note').hidden = true;
  renderResults(starters);
}

function renderAI({ ranking, cached }) {
  if (!Array.isArray(ranking.suggestions) || ranking.evaluatedCount !== catalog.length) {
    throw new Error('Jev did not score the complete catalog. Try again.');
  }
  const results = ranking.suggestions.map(match => {
    const emoji = catalog.find(entry => entry.id === match.id);
    if (!emoji || !Number.isFinite(match.score) || match.score < 0 || match.score > 1) {
      throw new Error('Jev returned an unknown emoji or invalid score. Try again.');
    }
    return { ...emoji, reason: `${Math.round(match.score * 100)}% filename fit` };
  });
  $('mode-label').textContent = 'Ranked by Jev';
  $('results-title').textContent = 'Matched to your message';
  $('results-description').textContent = 'Estimated relevance from filenames, not image contents. Click to copy.';
  $('ranking-note').textContent = ranking.weakMatch
    ? 'No strong match. These are the closest filenames Jev found.'
    : `All ${ranking.evaluatedCount.toLocaleString()} filenames scored independently by Jev.`;
  $('ranking-note').hidden = false;
  renderResults(results);
  setStatus(cached ? 'Jev ranking, from this session' : `Jev replied in ${(ranking.elapsedMs / 1000).toFixed(1)}s`);
}

function showRequestError(error) {
  renderEmpty('Jev unavailable', 'No ranking was completed.', 'Fix the connection or try again. There is no local keyword-matching fallback.');
  $('request-error').textContent = error.message;
  $('request-error').hidden = false;
  $('retry').hidden = false;
  if (error.retryAfter) cooldownUntil = Date.now() + error.retryAfter * 1000;
  if (['PROVIDER_AUTH', 'PROVIDER_BILLING', 'NOT_CONNECTED'].includes(error.code)) {
    aiEnabled.checked = false;
    connected = false;
    updateConnection();
    $('open-settings').textContent = 'Fix connection';
    $('retry').hidden = true;
  }
  setStatus('Jev unavailable. No results shown.');
}

const searcher = createDebouncedSearch({
  async search(text, signal) {
    if (cache.has(text)) return { ranking: cache.get(text), cached: true };
    setStatus(`Jev is scoring all ${catalog.length.toLocaleString()} filenames...`, true);
    const ranking = await api('suggest', { body: { text }, signal });
    if (!signal.aborted) {
      if (cache.size >= 20) cache.delete(cache.keys().next().value);
      cache.set(text, ranking);
    }
    return { ranking, cached: false };
  },
  onResult: renderAI,
  onError: showRequestError
});

function updateMessage() {
  searcher.cancel();
  $('character-count').textContent = `${message.value.length.toLocaleString()} / ${MAX_TEXT_LENGTH.toLocaleString()}`;
  $('clear-message').disabled = !message.value;
  $('request-error').hidden = true;
  $('retry').hidden = true;
  renderIdle();
  const text = message.value.trim();
  if (!text) {
    setStatus(connected ? 'Ready when you are.' : 'Jev is not connected. Preview only.');
    return;
  }
  if (!aiEnabled.checked || !connected) {
    setStatus(connected ? 'Jev is paused. No analysis has run.' : 'Jev is not connected. No analysis has run.');
    return;
  }
  if (composing) {
    setStatus('Waiting for you to finish typing...');
    return;
  }
  if (Date.now() < cooldownUntil) {
    showRequestError(new Error(`Wait ${Math.ceil((cooldownUntil - Date.now()) / 1000)} seconds before another Jev request.`));
    return;
  }
  setStatus('Waiting for a pause...');
  searcher.schedule(text);
}

function updateConnection() {
  aiEnabled.disabled = !connected || !catalog.length;
  $('open-settings').textContent = connected ? 'Jev settings' : 'Connect Jev';
  $('disconnect').hidden = !connected;
  $('provider').value = provider;
  $('connection-notice').hidden = connected || !catalog.length;
  $('provider-status').textContent = connected
    ? `Jev via ${providerLabel}. Filenames to AI; images stay local.`
    : 'Jev is not connected. No messages are being analyzed.';
  updateProviderLink();
}

function updateProviderLink() {
  const isVercel = $('provider').value === 'vercel';
  $('provider-key-link').href = isVercel ? 'https://vercel.com/d?to=%2F%5Bteam%5D%2F~%2Fai-gateway%2Fapi-keys' : 'https://console.typesafe.ai/keys';
  $('provider-key-link').textContent = isVercel ? 'Get a Vercel AI Gateway key' : 'Get a TypeSafe key';
}

async function load() {
  searcher.cancel();
  $('reload-setup').disabled = true;
  message.disabled = true;
  setStatus('Loading your local catalog...');
  try {
    const status = await api('status');
    csrfToken = status.csrfToken;
    connected = status.connected;
    provider = status.provider;
    providerLabel = status.label;
    $('open-settings').disabled = false;
    updateConnection();
    if (status.catalogError) throw new Error(status.catalogError);
    const data = await api('catalog');
    if (!Array.isArray(data.emojis) || !data.emojis.length ||
        data.emojis.some(emoji => !/^[a-f0-9]{20}$/.test(emoji.id) || typeof emoji.name !== 'string')) {
      throw new Error('The local catalog is invalid. Run npm run sync, then check again.');
    }
    catalog = indexCatalog(data.emojis);
    starters = starterEmojis(catalog);
    $('catalog-count').textContent = `${catalog.length.toLocaleString()} bufos`;
    $('setup').hidden = true;
    message.disabled = false;
    document.querySelectorAll('.example-chip').forEach(button => { button.disabled = false; });
    aiEnabled.checked = aiEnabled.checked && connected;
    updateConnection();
    updateMessage();
  } catch (error) {
    catalog = [];
    starters = [];
    connected = false;
    aiEnabled.checked = false;
    $('open-settings').disabled = true;
    document.querySelectorAll('.example-chip').forEach(button => { button.disabled = true; });
    updateConnection();
    renderResults([]);
    $('empty-state').hidden = true;
    $('setup-message').textContent = error.message;
    $('setup').hidden = false;
    setStatus('Local setup needed.');
  } finally {
    $('reload-setup').disabled = false;
  }
}

async function copyCode(code) {
  clearTimeout(copyTimer);
  $('copy-status').hidden = true;
  $('manual-copy').hidden = true;
  try {
    await navigator.clipboard.writeText(code);
    $('copy-status').textContent = `Copied ${code}`;
    $('copy-status').hidden = false;
    copyTimer = setTimeout(() => { $('copy-status').hidden = true; }, 2400);
  } catch {
    $('copy-code').value = code;
    $('manual-copy').hidden = false;
    $('copy-code').focus();
    $('copy-code').select();
  }
}

message.addEventListener('input', updateMessage);
message.addEventListener('compositionstart', () => { composing = true; searcher.cancel(); });
message.addEventListener('compositionend', () => { composing = false; updateMessage(); });
aiEnabled.addEventListener('change', updateMessage);
$('clear-message').addEventListener('click', () => { message.value = ''; updateMessage(); message.focus(); });
document.querySelectorAll('.example-chip').forEach(button => {
  button.addEventListener('click', () => { message.value = button.dataset.example; updateMessage(); message.focus(); });
});
$('retry').addEventListener('click', updateMessage);
$('reload-setup').addEventListener('click', load);
$('close-copy').addEventListener('click', () => { $('manual-copy').hidden = true; message.focus(); });
$('provider').addEventListener('change', updateProviderLink);
function openSettings() {
  $('connection-error').hidden = true;
  $('provider-consent').checked = false;
  dialog.showModal();
}
$('open-settings').addEventListener('click', openSettings);
$('connect-from-notice').addEventListener('click', openSettings);
$('close-settings').addEventListener('click', () => dialog.close());
dialog.addEventListener('close', () => { $('api-key').value = ''; });

$('connect-form').addEventListener('submit', async event => {
  event.preventDefault();
  searcher.cancel();
  $('connect-submit').disabled = true;
  $('disconnect').disabled = true;
  $('connection-error').hidden = true;
  $('connect-submit').textContent = 'Checking Jev...';
  try {
    const status = await api('connect', {
      body: { provider: $('provider').value, apiKey: $('api-key').value }
    });
    connected = status.connected;
    provider = status.provider;
    providerLabel = status.label;
    cache.clear();
    cooldownUntil = 0;
    aiEnabled.checked = true;
    updateConnection();
    dialog.close();
    if (catalog.length) updateMessage();
  } catch (error) {
    $('connection-error').textContent = error.message;
    $('connection-error').hidden = false;
    setStatus('Connection not changed.');
  } finally {
    $('api-key').value = '';
    $('connect-submit').disabled = false;
    $('disconnect').disabled = false;
    $('connect-submit').textContent = 'Connect Jev';
  }
});

$('disconnect').addEventListener('click', async () => {
  searcher.cancel();
  $('disconnect').disabled = true;
  try {
    await api('disconnect', { body: {} });
    connected = false;
    aiEnabled.checked = false;
    cache.clear();
    updateConnection();
    dialog.close();
    if (catalog.length) updateMessage();
  } catch (error) {
    $('connection-error').textContent = error.message;
    $('connection-error').hidden = false;
  } finally {
    $('disconnect').disabled = false;
  }
});

window.addEventListener('pagehide', () => searcher.cancel());
load();
