import assert from 'node:assert/strict';
import { once } from 'node:events';
import { get as httpGet } from 'node:http';
import test from 'node:test';
import { AppError } from '../jev.mjs';
import { createBufoServer } from '../server.mjs';
import { answerRequest, catalog, deferred, fakeFetch, flush, imageBytes, TEST_KEY } from './fixtures.mjs';

async function start(t, options = {}) {
  const value = catalog(14);
  const requests = [];
  const server = await createBufoServer({
    catalogStore: {
      get: async () => value,
      image: async () => ({ bytes: imageBytes(0), type: 'image/png' })
    },
    fetchImpl: fakeFetch(requests),
    env: {},
    minInterval: 0,
    ...options
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(async () => {
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
  });
  const origin = `http://127.0.0.1:${server.address().port}`;
  const status = await (await fetch(`${origin}/api/status`)).json();
  const headers = { Origin: origin, 'Content-Type': 'application/json', 'X-Bufo-Token': status.csrfToken };
  const post = (path, body, extra = {}) => fetch(`${origin}/api/${path}`, { method: 'POST', headers, body: JSON.stringify(body), ...extra });
  return { origin, post, status, requests, value, server, headers };
}

test('serves the app and private local catalog, but never keys or internal files', async t => {
  const app = await start(t, { env: { TYPESAFE_API_KEY: TEST_KEY } });
  assert.equal(app.status.connected, true);
  assert.equal(JSON.stringify(app.status).includes(TEST_KEY), false);
  const page = await fetch(app.origin);
  assert.equal(page.status, 200);
  assert.match(page.headers.get('content-security-policy'), /script-src 'self' 'sha256-/);
  assert.equal(page.headers.get('cache-control'), 'no-store');
  assert.match(await page.text(), /There's a bufo for that/);
  const list = await (await fetch(`${app.origin}/api/catalog`)).json();
  assert.equal(list.emojis.length, 14);
  assert.ok(list.emojis.every(entry => !('filename' in entry) && !('extension' in entry)));
  for (const path of ['/.env', '/.local/catalog.json', '/server.mjs', '/jev.mjs', '/catalog.mjs', '/package.json']) {
    assert.equal((await fetch(app.origin + path)).status, 404);
  }
  assert.equal(app.requests.length, 0);
});

test('rejects cross-site requests, DNS rebinding hostnames, missing Origin, and missing tokens', async t => {
  const app = await start(t);
  assert.equal((await fetch(`${app.origin}/api/status`, { headers: { Origin: 'https://untrusted.invalid' } })).status, 403);
  assert.equal((await fetch(`${app.origin}/api/status`, { headers: { 'Sec-Fetch-Site': 'cross-site' } })).status, 403);
  const rebindingStatus = await new Promise((resolve, reject) => {
    httpGet(`${app.origin}/api/status`, { headers: { Host: 'untrusted.invalid' } }, response => {
      response.resume();
      resolve(response.statusCode);
    }).on('error', reject);
  });
  assert.equal(rebindingStatus, 403);
  assert.equal((await app.post('connect', { provider: 'typesafe', apiKey: TEST_KEY }, { headers: { 'Content-Type': 'application/json' } })).status, 403);
  assert.equal((await app.post('connect', { provider: 'typesafe', apiKey: TEST_KEY }, { headers: { Origin: app.origin, 'Content-Type': 'application/json' } })).status, 403);
  assert.equal(app.requests.length, 0);
});

test('requires an account connection and validates input before calling the provider', async t => {
  const app = await start(t);
  assert.equal((await app.post('suggest', { text: 'Hello' })).status, 503);
  assert.equal((await app.post('suggest', { text: 'x'.repeat(2001) })).status, 400);
  assert.equal((await app.post('suggest', { text: '' })).status, 400);
  assert.equal((await app.post('connect', { provider: 'external', apiKey: TEST_KEY })).status, 400);
  assert.equal((await app.post('suggest', { text: 'x'.repeat(20_000) })).status, 413);
  assert.equal((await app.post('suggest', {}, { headers: { ...app.headers, 'Content-Type': 'text/plain' } })).status, 415);
  assert.equal((await app.post('suggest', {}, { body: '{invalid' })).status, 400);
  assert.equal(app.requests.length, 0);
});

test('allows a top-level link from the setup page without exposing APIs to that other origin', async t => {
  const app = await start(t);
  const headers = { 'Sec-Fetch-Site': 'cross-site', 'Sec-Fetch-Mode': 'navigate', 'Sec-Fetch-Dest': 'document' };
  const status = path => new Promise((resolve, reject) => {
    httpGet(app.origin + path, { headers }, response => {
      response.resume();
      resolve(response.statusCode);
    }).on('error', reject);
  });
  assert.equal(await status('/'), 200);
  assert.equal(await status('/index.html'), 200);
  assert.equal(await status('/api/catalog'), 403);
  assert.equal(await status('/api/status'), 403);
});

test('connects with a synthetic probe, ranks only real filenames, and disconnects without persisting the key', async t => {
  const app = await start(t);
  const connection = await app.post('connect', { provider: 'typesafe', apiKey: TEST_KEY });
  assert.equal(connection.status, 200);
  assert.equal(app.requests.length, 1);
  assert.equal(Object.values(app.requests[0].body.questions)[0].instructions.filename, 'bufo-thankful.png');
  const response = await app.post('suggest', { text: 'A good day' });
  assert.equal(response.status, 200);
  const ranking = await response.json();
  assert.ok(ranking.suggestions.every(suggestion => app.value.emojis.some(entry => entry.id === suggestion.id)));
  assert.equal(ranking.evaluatedCount, app.value.emojis.length);
  assert.equal((await app.post('disconnect', {})).status, 200);
  assert.equal((await app.post('suggest', { text: 'Hello again' })).status, 503);
  assert.equal((await (await fetch(`${app.origin}/api/status`)).json()).connected, false);
});

test('a failed new key does not replace an existing working connection', async t => {
  const app = await start(t, {
    env: { TYPESAFE_API_KEY: TEST_KEY },
    fetchImpl: async (_url, options) => options.headers.Authorization.endsWith('invalid-key')
      ? new Response('', { status: 401 })
      : Response.json(answerRequest(JSON.parse(options.body)))
  });
  assert.equal((await app.post('connect', { provider: 'vercel', apiKey: 'invalid-key' })).status, 401);
  const status = await (await fetch(`${app.origin}/api/status`)).json();
  assert.equal(status.provider, 'typesafe');
  assert.equal(status.connected, true);
  assert.equal((await app.post('suggest', { text: 'Hello' })).status, 200);
});

test('missing catalog is a setup state, not a fabricated empty successful catalog', async t => {
  const app = await start(t, {
    catalogStore: { get: async () => { throw new AppError(503, 'Run npm run sync first.', 'CATALOG_MISSING'); } }
  });
  assert.match(app.status.catalogError, /npm run sync/);
  assert.equal(app.status.catalogCount, 0);
  assert.equal((await fetch(`${app.origin}/api/catalog`)).status, 503);
});

test('only one full ranking can run at a time, even when catalog loading is asynchronous', async t => {
  const waiting = deferred();
  const started = deferred();
  const app = await start(t, {
    env: { TYPESAFE_API_KEY: TEST_KEY },
    fetchImpl: async (_url, { body }) => {
      started.resolve();
      await waiting.promise;
      return Response.json(answerRequest(JSON.parse(body)));
    },
    catalogStore: { get: async () => { await flush(); return catalog(12); } }
  });
  const first = app.post('suggest', { text: 'First' });
  await started.promise;
  const second = await app.post('suggest', { text: 'Second' });
  assert.equal(second.status, 429);
  assert.equal(second.headers.get('retry-after'), '1');
  waiting.resolve();
  assert.equal((await first).status, 200);
});

test('browser cancellation reaches the upstream request and suppresses further ranking calls', async t => {
  const started = deferred();
  const cancelled = deferred();
  let calls = 0;
  const app = await start(t, {
    env: { TYPESAFE_API_KEY: TEST_KEY },
    fetchImpl: async (_url, { signal }) => {
      calls += 1;
      started.resolve();
      await new Promise((_, reject) => signal.addEventListener('abort', () => { cancelled.resolve(); reject(signal.reason); }, { once: true }));
    }
  });
  const controller = new AbortController();
  const request = app.post('suggest', { text: 'Soon obsolete' }, { signal: controller.signal });
  const rejected = assert.rejects(request, { name: 'AbortError' });
  await started.promise;
  controller.abort();
  await rejected;
  await cancelled.promise;
  assert.equal(calls, 1);
});

test('configured throttle bounds repeated requests even after a successful response', async t => {
  const app = await start(t, { env: { TYPESAFE_API_KEY: TEST_KEY }, minInterval: 60_000 });
  assert.equal((await app.post('suggest', { text: 'Hello' })).status, 200);
  assert.equal((await app.post('suggest', { text: 'Again' })).status, 429);
});
