import assert from 'node:assert/strict';
import { once } from 'node:events';
import { request as httpRequest } from 'node:http';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { readSuggestionStream } from '../core.js';
import { AppError, MAX_INPUT_TOKENS_PER_REQUEST } from '../jev.mjs';
import { createBufoServer } from '../server.mjs';
import { answerRequest, catalog, deferred, fakeFetch, flush, imageBytes, TEST_KEY } from './fixtures.mjs';

const SHARED_ENV = {
  TYPESAFE_API_KEY: TEST_KEY, BUFO_MODE: 'shared',
  BUFO_PUBLIC_ORIGIN: 'https://bufo.example.test',
  BUFO_PROXY_SECRET: 'test-only-proxy-secret-not-for-production',
  BUFO_GITHUB_TOKEN: 'test-only-github-token'
};
const proxyHeaders = user => ({
  Host: 'bufo.example.test',
  'X-Bufo-Proxy-Secret': SHARED_ENV.BUFO_PROXY_SECRET,
  'X-Bufo-User': user,
  Origin: SHARED_ENV.BUFO_PUBLIC_ORIGIN
});
const PUBLIC_ENV = {
  TYPESAFE_API_KEY: TEST_KEY, BUFO_MODE: 'public',
  BUFO_PUBLIC_ORIGIN: 'https://bufo.example.test', BUFO_DAILY_TOKEN_LIMIT: '1000000',
  FLY_APP_NAME: 'test-bufo'
};
const publicHeaders = ip => ({
  Host: 'bufo.example.test', Origin: PUBLIC_ENV.BUFO_PUBLIC_ORIGIN, 'Fly-Client-IP': ip
});

function raw(origin, path, { method = 'GET', headers = {}, body, signal } = {}) {
  return new Promise((resolve, reject) => {
    const request = httpRequest(origin + path, { method, headers, signal }, response => {
      const chunks = [];
      response.on('data', chunk => chunks.push(chunk));
      response.on('end', () => {
        const text = Buffer.concat(chunks).toString();
        resolve({ status: response.statusCode, headers: response.headers, text, json: () => JSON.parse(text) });
      });
    });
    request.on('error', reject);
    request.end(body === undefined ? undefined : JSON.stringify(body));
  });
}

async function start(t, options = {}) {
  const value = catalog(14);
  const requests = [];
  let env = options.env || { TYPESAFE_API_KEY: TEST_KEY };
  if (env.BUFO_MODE === 'public' && !env.BUFO_DATA_DIR) {
    const directory = await mkdtemp(join(tmpdir(), 'bufo-public-test-'));
    t.after(() => rm(directory, { recursive: true, force: true }));
    env = { ...env, BUFO_DATA_DIR: directory };
  }
  const server = await createBufoServer({
    catalogStore: {
      get: async () => value,
      image: async () => ({ bytes: imageBytes(0), type: 'image/png' })
    },
    fetchImpl: fakeFetch(requests), minInterval: 0,
    ...options, env
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(async () => {
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
  });
  const origin = `http://127.0.0.1:${server.address().port}`;
  const shared = env.BUFO_MODE === 'shared';
  const publicMode = env.BUFO_MODE === 'public';
  const userHeaders = shared ? proxyHeaders('first-user') : publicMode ? publicHeaders('192.0.2.1') : {};
  const info = (await raw(origin, '/api/status', { headers: userHeaders })).json();
  const headers = { ...userHeaders, Origin: shared || publicMode ? env.BUFO_PUBLIC_ORIGIN : origin, 'Content-Type': 'application/json', 'X-Bufo-Token': info.csrfToken };
  const post = (path, body, extra = {}) => raw(origin, `/api/${path}`, { method: 'POST', headers, body, ...extra });
  return { origin, post, info, requests, value, server, headers, env };
}

test('public visitors can load the app, catalog, images, and streamed suggestions without accounts', async t => {
  const app = await start(t, { env: PUBLIC_ENV });
  assert.equal(app.info.ready, true);
  for (const path of ['/', '/api/catalog', `/api/emoji/${app.value.emojis[0].id}`, '/healthz']) {
    assert.equal((await raw(app.origin, path, { headers: publicHeaders('192.0.2.1') })).status, 200);
  }
  for (const path of ['/usage.json', '/usage.mjs', '/public-assets/catalog.json', '/.env']) {
    assert.equal((await raw(app.origin, path, { headers: publicHeaders('192.0.2.1') })).status, 404);
  }
  const response = await app.post('suggest', { text: 'Public reaction' }, {
    headers: { ...app.headers, Accept: 'application/x-ndjson' }
  });
  const updates = [];
  const result = await readSuggestionStream(new Response(response.text).body, { onProgress: event => updates.push(event) });
  assert.equal(result.evaluatedCount, 14);
  assert.equal(updates.at(-1).ranking.suggestions.length, 12);
  assert.equal(JSON.stringify(app.info).includes(TEST_KEY), false);
  assert.equal(app.env.BUFO_GITHUB_TOKEN, undefined);
});

test('public writes still require the exact origin and that network client CSRF token', async t => {
  const app = await start(t, { env: PUBLIC_ENV });
  for (const overrides of [
    { 'X-Bufo-Token': '' }, { Origin: 'https://attacker.invalid' },
    { 'Fly-Client-IP': '192.0.2.2' }, { Host: 'attacker.invalid' }
  ]) {
    assert.equal((await app.post('suggest', { text: 'Hello' }, { headers: { ...app.headers, ...overrides } })).status, 403);
  }
  assert.equal(app.requests.length, 0);
});

test('public searches stop at ten per minute per client without blocking other clients', async t => {
  const app = await start(t, { env: PUBLIC_ENV });
  for (let index = 0; index < 10; index += 1) {
    assert.equal((await app.post('suggest', { text: `Reaction ${index}` })).status, 200);
  }
  const limited = await app.post('suggest', { text: 'One too many' });
  assert.equal(limited.status, 429);
  assert.equal(limited.json().code, 'USER_RATE_LIMIT');
  assert.ok(limited.json().retryAfter >= 1 && limited.json().retryAfter <= 60);
  const headers = publicHeaders('192.0.2.2');
  const info = (await raw(app.origin, '/api/status', { headers })).json();
  assert.equal((await app.post('suggest', { text: 'Another visitor' }, {
    headers: { ...headers, 'Content-Type': 'application/json', 'X-Bufo-Token': info.csrfToken }
  })).status, 200);
  assert.equal(app.requests.length, 11);
});

test('public token budgets are reserved before inference and survive server replacement', async t => {
  let app;
  app = await start(t, {
    env: { ...PUBLIC_ENV, BUFO_DAILY_TOKEN_LIMIT: String(MAX_INPUT_TOKENS_PER_REQUEST + 500) },
    fetchImpl: async (_url, { body }) => {
      const state = JSON.parse(await readFile(join(app.env.BUFO_DATA_DIR, 'usage.json'), 'utf8'));
      assert.ok(state.usedTokens >= MAX_INPUT_TOKENS_PER_REQUEST);
      return Response.json(answerRequest(JSON.parse(body)));
    }
  });
  assert.equal((await app.post('suggest', { text: 'First' })).status, 200);
  const replacement = await start(t, { env: app.env });
  assert.equal((await replacement.post('suggest', { text: 'Second' })).status, 200);
  const blocked = await replacement.post('suggest', { text: 'Third' });
  assert.equal(blocked.status, 429);
  assert.equal(blocked.json().code, 'DAILY_BUDGET');
  assert.equal(replacement.requests.length, 1);
  assert.equal(JSON.parse(await readFile(join(app.env.BUFO_DATA_DIR, 'usage.json'), 'utf8')).usedTokens, 1000);
});

test('failed public inference keeps its reservation rather than allowing repeated unbudgeted calls', async t => {
  let calls = 0;
  const app = await start(t, {
    env: { ...PUBLIC_ENV, BUFO_DAILY_TOKEN_LIMIT: String(MAX_INPUT_TOKENS_PER_REQUEST) },
    fetchImpl: async () => { calls += 1; return new Response('', { status: 500 }); }
  });
  assert.equal((await app.post('suggest', { text: 'Failure' })).status, 502);
  const blocked = await app.post('suggest', { text: 'Try again' });
  assert.equal(blocked.status, 429);
  assert.equal(blocked.json().code, 'DAILY_BUDGET');
  assert.equal(calls, 1);
});

test('simultaneous public clients cannot oversubscribe the remaining token budget', async t => {
  const started = deferred();
  const release = deferred();
  let calls = 0;
  const app = await start(t, {
    env: { ...PUBLIC_ENV, BUFO_DAILY_TOKEN_LIMIT: String(MAX_INPUT_TOKENS_PER_REQUEST) },
    fetchImpl: async (_url, { body }) => {
      calls += 1;
      started.resolve();
      await release.promise;
      return Response.json(answerRequest(JSON.parse(body)));
    }
  });
  const first = app.post('suggest', { text: 'Hold the budget' });
  await started.promise;
  try {
    const headers = publicHeaders('192.0.2.2');
    const info = (await raw(app.origin, '/api/status', { headers })).json();
    const second = await app.post('suggest', { text: 'Another visitor' }, {
      headers: { ...headers, 'Content-Type': 'application/json', 'X-Bufo-Token': info.csrfToken }
    });
    assert.equal(second.status, 429);
    assert.equal(second.json().code, 'DAILY_BUDGET');
    assert.equal(calls, 1);
  } finally { release.resolve(); }
  assert.equal((await first).status, 200);
});

test('is ready without a viewer connection step and never exposes server credentials', async t => {
  const app = await start(t);
  assert.equal(app.info.ready, true);
  assert.equal(JSON.stringify(app.info).includes(TEST_KEY), false);
  const page = await fetch(app.origin);
  assert.equal(page.status, 200);
  assert.equal(page.headers.get('cache-control'), 'no-store');
  assert.match(page.headers.get('content-security-policy'), /script-src 'self';/);
  const html = await page.text();
  assert.match(html, /<h1>bufo\.<\/h1>/);
  assert.doesNotMatch(html, /api-key|connect-form|dialog/);
  const list = await (await fetch(`${app.origin}/api/catalog`)).json();
  assert.equal(list.emojis.length, 14);
  assert.ok(list.emojis.every(entry => Object.keys(entry).sort().join() === 'id,name'));
  assert.equal(app.requests.length, 0);
  assert.equal((await app.post('suggest', { text: 'payments are broken' })).status, 200);
});

test('internal source files and all browser credential-mutation endpoints are inaccessible', async t => {
  const app = await start(t);
  for (const path of ['/.env', '/.local/catalog.json', '/server.mjs', '/deployment.mjs', '/jev.mjs', '/catalog.mjs', '/package.json']) {
    assert.equal((await fetch(app.origin + path)).status, 404);
  }
  assert.equal((await app.post('connect', { provider: 'vercel', apiKey: 'another-key' })).status, 404);
  assert.equal((await app.post('disconnect', {})).status, 404);
  assert.equal((await (await fetch(`${app.origin}/api/status`)).json()).ready, true);
  assert.equal(app.requests.length, 0);
});

test('rejects cross-site requests, DNS rebinding, and missing Origin or CSRF token', async t => {
  const app = await start(t);
  for (const headers of [{ Origin: 'https://untrusted.invalid' }, { 'Sec-Fetch-Site': 'cross-site' }, { Host: 'untrusted.invalid' }]) {
    assert.equal((await raw(app.origin, '/api/status', { headers })).status, 403);
  }
  assert.equal((await app.post('suggest', { text: 'Hello' }, { headers: { 'Content-Type': 'application/json' } })).status, 403);
  assert.equal((await app.post('suggest', { text: 'Hello' }, { headers: { Origin: app.origin, 'Content-Type': 'application/json' } })).status, 403);
  assert.equal(app.requests.length, 0);
});

test('requires server credentials and validates input before calling the provider', async t => {
  const app = await start(t, { env: {} });
  assert.equal(app.info.ready, false);
  assert.match(app.info.error, /app owner/);
  assert.equal((await app.post('suggest', { text: 'Hello' })).status, 503);
  assert.equal((await app.post('suggest', { text: 'x'.repeat(2001) })).status, 400);
  assert.equal((await app.post('suggest', { text: '' })).status, 400);
  assert.equal((await app.post('suggest', { text: 'x'.repeat(20_000) })).status, 413);
  assert.equal((await app.post('suggest', {}, { headers: { ...app.headers, 'Content-Type': 'text/plain' } })).status, 415);
  assert.equal(app.requests.length, 0);
});

test('allows top-level links without exposing APIs to the referring origin', async t => {
  const app = await start(t);
  const headers = { 'Sec-Fetch-Site': 'cross-site', 'Sec-Fetch-Mode': 'navigate', 'Sec-Fetch-Dest': 'document' };
  assert.equal((await raw(app.origin, '/', { headers })).status, 200);
  assert.equal((await raw(app.origin, '/index.html', { headers })).status, 200);
  assert.equal((await raw(app.origin, '/api/catalog', { headers })).status, 403);
});

test('missing catalog is an explicit service failure', async t => {
  const app = await start(t, {
    catalogStore: { get: async () => { throw new AppError(503, 'Missing source', 'CATALOG_MISSING'); } }
  });
  assert.equal(app.info.ready, false);
  assert.match(app.info.error, /collection is unavailable/);
  assert.equal((await fetch(`${app.origin}/api/catalog`)).status, 503);
});

test('only one ranking per viewer runs at once, including with asynchronous catalog loading', async t => {
  const waiting = deferred();
  const started = deferred();
  const app = await start(t, {
    fetchImpl: async (_url, { body }) => {
      started.resolve();
      await waiting.promise;
      return Response.json(answerRequest(JSON.parse(body)));
    },
    catalogStore: { get: async () => { await flush(); return catalog(12); } }
  });
  const first = app.post('suggest', { text: 'First' });
  await started.promise;
  assert.equal((await app.post('suggest', { text: 'Second' })).status, 429);
  waiting.resolve();
  assert.equal((await first).status, 200);
});

test('browser cancellation reaches the upstream request', async t => {
  const started = deferred();
  const cancelled = deferred();
  let calls = 0;
  const app = await start(t, {
    fetchImpl: async (_url, { signal }) => {
      calls += 1;
      started.resolve();
      await new Promise((_, reject) => signal.addEventListener('abort', () => { cancelled.resolve(); reject(signal.reason); }, { once: true }));
    }
  });
  const controller = new AbortController();
  const request = fetch(`${app.origin}/api/suggest`, { method: 'POST', headers: app.headers, body: JSON.stringify({ text: 'Soon obsolete' }), signal: controller.signal });
  const rejected = assert.rejects(request, { name: 'AbortError' });
  await started.promise;
  controller.abort();
  await rejected;
  await cancelled.promise;
  assert.equal(calls, 1);
});

test('throttles repeated requests even after completion', async t => {
  const app = await start(t, { minInterval: 60_000 });
  assert.equal((await app.post('suggest', { text: 'Hello' })).status, 200);
  assert.equal((await app.post('suggest', { text: 'Again' })).status, 429);
});

test('shared hosting protects every route with a trusted SSO assertion', async t => {
  const app = await start(t, { env: SHARED_ENV });
  for (const path of ['/', '/app.js', '/api/status', '/api/catalog', `/api/emoji/${app.value.emojis[0].id}`]) {
    assert.equal((await raw(app.origin, path, { headers: { Host: 'bufo.example.test' } })).status, 403);
    assert.equal((await raw(app.origin, path, { headers: { ...proxyHeaders('first-user'), 'X-Bufo-Proxy-Secret': 'forged' } })).status, 403);
  }
  assert.equal((await app.post('suggest', { text: 'Hello' })).status, 200);
});

test('different authenticated viewers share the server key without cancelling or blocking each other', async t => {
  const release = deferred();
  const started = deferred();
  let calls = 0;
  const seenMessages = [];
  const app = await start(t, {
    env: SHARED_ENV,
    fetchImpl: async (_url, { body, headers }) => {
      assert.equal(headers.Authorization, `Bearer ${TEST_KEY}`);
      const data = JSON.parse(body);
      seenMessages.push(data.state.message);
      if (++calls === 2) started.resolve();
      await release.promise;
      return Response.json(answerRequest(data));
    }
  });
  const secondHeaders = proxyHeaders('second-user');
  const info = (await raw(app.origin, '/api/status', { headers: secondHeaders })).json();
  assert.notEqual(info.csrfToken, app.info.csrfToken);
  const first = app.post('suggest', { text: 'First message' });
  const second = app.post('suggest', { text: 'Second message' }, {
    headers: { ...secondHeaders, 'Content-Type': 'application/json', 'X-Bufo-Token': info.csrfToken }
  });
  await started.promise;
  release.resolve();
  assert.equal((await first).status, 200);
  assert.equal((await second).status, 200);
  assert.deepEqual(seenMessages.sort(), ['First message', 'Second message']);
});

test('one viewer cannot reuse another viewer CSRF token', async t => {
  const app = await start(t, { env: SHARED_ENV });
  const response = await app.post('suggest', { text: 'Hello' }, {
    headers: { ...proxyHeaders('second-user'), 'Content-Type': 'application/json', 'X-Bufo-Token': app.info.csrfToken }
  });
  assert.equal(response.status, 403);
  assert.equal(app.requests.length, 0);
});

test('cancelling a shared HTTP request leaves another viewer running', async t => {
  const firstStarted = deferred();
  const secondStarted = deferred();
  const cancelled = deferred();
  const releaseSecond = deferred();
  const app = await start(t, {
    env: SHARED_ENV,
    fetchImpl: async (_url, { body, signal }) => {
      const data = JSON.parse(body);
      if (data.state.message === 'Cancel me') {
        firstStarted.resolve();
        await new Promise((_, reject) => signal.addEventListener('abort', () => { cancelled.resolve(); reject(signal.reason); }, { once: true }));
      } else {
        secondStarted.resolve();
        await releaseSecond.promise;
        assert.equal(signal.aborted, false);
        return Response.json(answerRequest(data));
      }
    }
  });
  const controller = new AbortController();
  const first = app.post('suggest', { text: 'Cancel me' }, { signal: controller.signal });
  const rejected = assert.rejects(first, { code: 'ABORT_ERR' });
  await firstStarted.promise;
  const headers = proxyHeaders('second-user');
  const info = (await raw(app.origin, '/api/status', { headers })).json();
  const second = app.post('suggest', { text: 'Keep going' }, {
    headers: { ...headers, 'Content-Type': 'application/json', 'X-Bufo-Token': info.csrfToken }
  });
  await secondStarted.promise;
  controller.abort();
  await rejected;
  await cancelled.promise;
  releaseSecond.resolve();
  assert.equal((await second).status, 200);
});

test('bounds simultaneous shared rankings and recovers capacity when they finish', async t => {
  const gate = deferred();
  const fourthReceived = deferred();
  const app = await start(t, {
    env: SHARED_ENV,
    fetchImpl: async (_url, { body }) => { await gate.promise; return Response.json(answerRequest(JSON.parse(body))); }
  });
  const clients = await Promise.all(Array.from({ length: 5 }, async (_, index) => {
    const headers = proxyHeaders(`user-${index}`);
    const info = (await raw(app.origin, '/api/status', { headers })).json();
    return { ...headers, 'Content-Type': 'application/json', 'X-Bufo-Token': info.csrfToken };
  }));
  let received = 0;
  app.server.on('request', request => { if (request.method === 'POST' && ++received === 4) fourthReceived.resolve(); });
  const pending = clients.slice(0, 4).map(headers => app.post('suggest', { text: 'Hold this' }, { headers }));
  try {
    await fourthReceived.promise;
    await flush();
    const busy = await app.post('suggest', { text: 'Fifth' }, { headers: clients[4] });
    assert.equal(busy.status, 429);
    assert.equal(busy.json().code, 'SERVICE_BUSY');
  } finally {
    gate.resolve();
    assert.ok((await Promise.all(pending)).every(response => response.status === 200));
  }
  assert.equal((await app.post('suggest', { text: 'Recovered' }, { headers: clients[4] })).status, 200);
});

test('streams progress before the ranking is ready while preserving ordinary JSON clients', async t => {
  const release = deferred();
  const partial = deferred();
  const value = catalog(1200);
  const app = await start(t, {
    catalogStore: { get: async () => value },
    fetchImpl: async (_url, { body }) => {
      const request = JSON.parse(body);
      if (!Object.hasOwn(request.questions, 'e0')) await release.promise;
      return Response.json(answerRequest(request));
    }
  });
  const response = await fetch(`${app.origin}/api/suggest`, {
    method: 'POST', headers: { ...app.headers, Accept: 'application/x-ndjson' }, body: JSON.stringify({ text: 'Stream this' })
  });
  assert.match(response.headers.get('content-type'), /application\/x-ndjson/);
  assert.equal(response.headers.get('x-accel-buffering'), 'no');
  const events = [];
  let finished = false;
  const reading = readSuggestionStream(response.body, {
    onProgress: event => { events.push(event); if (event.scoredCount > 0) partial.resolve(); }
  }).then(result => { finished = true; return result; });
  try {
    await partial.promise;
    assert.equal(events[0].scoredCount, 0);
    assert.deepEqual(events[0].ranking.suggestions, []);
    assert.ok(events.at(-1).scoredCount < value.emojis.length);
    assert.equal(events.at(-1).ranking.suggestions.length, 12);
    assert.equal(events.at(-1).ranking.evaluatedCount, events.at(-1).scoredCount);
    assert.equal(events.at(-1).ranking.syncedAt, value.syncedAt);
    assert.equal(finished, false);
  } finally { release.resolve(); }
  const result = await reading;
  assert.equal(result.evaluatedCount, value.emojis.length);
  assert.equal(result.syncedAt, value.syncedAt);
  assert.equal(events.at(-1).scoredCount, value.emojis.length);
  assert.deepEqual(events.at(-1).ranking.suggestions, result.suggestions);
  const ordinary = await app.post('suggest', { text: 'Ordinary JSON' });
  assert.equal(ordinary.json().evaluatedCount, value.emojis.length);
});

test('a provider failure after streaming begins is an explicit error event, not a partial success', async t => {
  const app = await start(t, { fetchImpl: async () => new Response('', { status: 402 }) });
  const response = await fetch(`${app.origin}/api/suggest`, {
    method: 'POST', headers: { ...app.headers, Accept: 'application/x-ndjson' }, body: JSON.stringify({ text: 'Hello' })
  });
  const progress = [];
  await assert.rejects(readSuggestionStream(response.body, { onProgress: event => progress.push(event) }), { code: 'PROVIDER_BILLING' });
  assert.deepEqual(progress.map(event => event.scoredCount), [0]);
  const invalid = await app.post('suggest', { text: '' }, { headers: { ...app.headers, Accept: 'application/x-ndjson' } });
  assert.equal(invalid.status, 400);
  assert.equal(invalid.json().code, 'INVALID_TEXT');
});

test('the progress and final ranking retain the snapshot captured before inference', async t => {
  const value = catalog(1200);
  const syncedAt = value.syncedAt;
  const partial = deferred();
  const release = deferred();
  const app = await start(t, {
    catalogStore: { get: async () => value },
    fetchImpl: async (_url, { body }) => {
      const request = JSON.parse(body);
      if (!Object.hasOwn(request.questions, 'e0')) await release.promise;
      return Response.json(answerRequest(request));
    }
  });
  const response = await fetch(`${app.origin}/api/suggest`, {
    method: 'POST', headers: { ...app.headers, Accept: 'application/x-ndjson' },
    body: JSON.stringify({ text: 'Keep this snapshot', syncedAt })
  });
  const events = [];
  const reading = readSuggestionStream(response.body, {
    onProgress: event => { events.push(event); if (event.scoredCount > 0) partial.resolve(); }
  });
  try {
    await partial.promise;
    value.syncedAt = '2026-09-30T14:00:00.000Z';
  } finally { release.resolve(); }
  assert.equal((await reading).syncedAt, syncedAt);
  assert.ok(events.every(event => event.ranking.syncedAt === syncedAt));
});

test('aborting a streaming response cancels the active provider evaluation', async t => {
  const cancelled = deferred();
  const app = await start(t, {
    fetchImpl: async (_url, { signal }) => new Promise((_, reject) => {
      signal.addEventListener('abort', () => { cancelled.resolve(); reject(signal.reason); }, { once: true });
    })
  });
  const controller = new AbortController();
  const response = await fetch(`${app.origin}/api/suggest`, {
    method: 'POST', headers: { ...app.headers, Accept: 'application/x-ndjson' },
    body: JSON.stringify({ text: 'Cancel this stream' }), signal: controller.signal
  });
  const reading = assert.rejects(readSuggestionStream(response.body, { signal: controller.signal }), { name: 'AbortError' });
  controller.abort();
  await reading;
  await cancelled.promise;
});
