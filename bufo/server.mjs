import { createHash, randomBytes } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createCatalogStore } from './catalog.mjs';
import { AppError, PROVIDERS, rankWithJev, validateConnection, validateText, verifyConnection } from './jev.mjs';

const STATIC_FILES = {
  '/': ['index.html', 'text/html; charset=utf-8'],
  '/index.html': ['index.html', 'text/html; charset=utf-8'],
  '/app.js': ['app.js', 'text/javascript; charset=utf-8'],
  '/core.js': ['core.js', 'text/javascript; charset=utf-8'],
  '/styles.css': ['styles.css', 'text/css; charset=utf-8']
};

function json(response, status, body) {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  response.end(JSON.stringify(body));
}

function readJson(request) {
  if (request.headers['content-type']?.split(';')[0].trim() !== 'application/json') {
    throw new AppError(415, 'Send application/json.', 'INVALID_CONTENT_TYPE');
  }
  return new Promise((resolve, reject) => {
    let size = 0;
    let chunks = [];
    request.on('data', chunk => {
      size += chunk.length;
      if (size > 16_384) {
        chunks = [];
        reject(new AppError(413, 'Request too large.', 'REQUEST_TOO_LARGE'));
      } else {
        chunks.push(chunk);
      }
    });
    request.on('end', () => {
      if (size > 16_384) return;
      let data;
      try {
        data = JSON.parse(Buffer.concat(chunks).toString('utf8'));
      } catch {
        reject(new AppError(400, 'Send a valid JSON object.', 'INVALID_JSON'));
        return;
      }
      if (!data || typeof data !== 'object' || Array.isArray(data)) {
        reject(new AppError(400, 'Send a JSON object.', 'INVALID_JSON'));
      } else {
        resolve(data);
      }
    });
    request.on('error', reject);
    request.on('aborted', () => reject(new AppError(400, 'Request cancelled.', 'CANCELLED')));
  });
}

export async function createBufoServer({
  catalogStore = createCatalogStore(),
  fetchImpl = fetch,
  env = process.env,
  minInterval = 600
} = {}) {
  let provider = env.JEV_PROVIDER || (env.TYPESAFE_API_KEY ? 'typesafe' : env.AI_GATEWAY_API_KEY ? 'vercel' : 'typesafe');
  if (!Object.hasOwn(PROVIDERS, provider)) throw new AppError(400, 'JEV_PROVIDER must be typesafe or vercel.');
  let apiKey = env[PROVIDERS[provider].keyVariable]?.trim() || '';
  if (apiKey) ({ provider, apiKey } = validateConnection(provider, apiKey));
  const csrfToken = randomBytes(32).toString('hex');
  let busy = false;
  let lastEvaluation = 0;
  let activeController;
  const html = await readFile(new URL('./index.html', import.meta.url), 'utf8');
  const themeScript = html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
  if (!themeScript) throw new Error('The theme script is missing.');
  const scriptHash = createHash('sha256').update(themeScript).digest('base64');

  const server = createServer(async (request, response) => {
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('Referrer-Policy', 'no-referrer');
    response.setHeader('X-Frame-Options', 'DENY');
    response.setHeader('Content-Security-Policy', `default-src 'self'; script-src 'self' 'sha256-${scriptHash}'; style-src 'self' 'unsafe-inline'; img-src 'self'; connect-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'; object-src 'none'`);
    try {
      const port = server.address().port;
      const host = request.headers.host;
      const allowedHosts = [`127.0.0.1:${port}`, `localhost:${port}`];
      const pageNavigation = request.method === 'GET' && /^\/(?:index\.html)?(?:\?|$)/.test(request.url) &&
        request.headers['sec-fetch-mode'] === 'navigate' && request.headers['sec-fetch-dest'] === 'document';
      if (!allowedHosts.includes(host) || (request.headers['sec-fetch-site'] === 'cross-site' && !pageNavigation) ||
          (request.headers.origin && request.headers.origin !== `http://${host}`)) {
        throw new AppError(403, 'This app only accepts requests from its local page.', 'FORBIDDEN');
      }
      if (!['GET', 'POST'].includes(request.method)) {
        throw new AppError(405, 'Method not allowed.', 'METHOD_NOT_ALLOWED');
      }
      const url = new URL(request.url, `http://${host}`);
      if (request.method === 'POST') {
        if (request.headers.origin !== `http://${host}` || request.headers['x-bufo-token'] !== csrfToken) {
          throw new AppError(403, 'Reload the local app before trying again.', 'FORBIDDEN');
        }
        if (!['/api/connect', '/api/disconnect', '/api/suggest'].includes(url.pathname)) {
          throw new AppError(404, 'Not found.', 'NOT_FOUND');
        }
        const data = await readJson(request);
        if (url.pathname === '/api/disconnect') {
          activeController?.abort();
          apiKey = '';
          json(response, 200, { connected: false });
          return;
        }
        let connection = { provider, apiKey };
        let text;
        let emojis;
        if (url.pathname === '/api/connect') {
          connection = validateConnection(data.provider, data.apiKey);
        } else {
          text = validateText(data.text);
          if (!apiKey) throw new AppError(503, 'Connect a Jev provider first.', 'NOT_CONNECTED');
          emojis = (await catalogStore.get()).emojis;
        }
        if (busy || (url.pathname === '/api/suggest' && Date.now() - lastEvaluation < minInterval)) {
          throw new AppError(429, 'One Jev request at a time. Try again in a second.', 'LOCAL_RATE_LIMIT', 1);
        }
        const controller = new AbortController();
        response.on('close', () => {
          if (!response.writableEnded) controller.abort();
        });
        activeController = controller;
        busy = true;
        if (url.pathname === '/api/suggest') lastEvaluation = Date.now();
        try {
          const options = { ...connection, signal: controller.signal, fetchImpl };
          const result = url.pathname === '/api/connect'
            ? await verifyConnection(options)
            : await rankWithJev({ ...options, text, emojis });
          if (controller.signal.aborted) return;
          if (url.pathname === '/api/connect') {
            ({ provider, apiKey } = connection);
            lastEvaluation = 0;
            json(response, 200, { connected: true, provider, label: PROVIDERS[provider].label });
          } else {
            json(response, 200, result);
          }
        } finally {
          busy = false;
          activeController = undefined;
        }
        return;
      }
      if (url.pathname === '/api/status') {
        let catalogCount = 0;
        let catalogError = null;
        try {
          catalogCount = (await catalogStore.get(true)).emojis.length;
        } catch (error) {
          if (!(error instanceof AppError)) throw error;
          catalogError = error.message;
        }
        json(response, 200, {
          csrfToken, catalogCount, catalogError,
          provider, label: PROVIDERS[provider].label, connected: Boolean(apiKey)
        });
      } else if (url.pathname === '/api/catalog') {
        const catalog = await catalogStore.get();
        json(response, 200, {
          syncedAt: catalog.syncedAt,
          emojis: catalog.emojis.map(({ id, name, sha }) => ({ id, name, fingerprint: sha }))
        });
      } else if (/^\/api\/emoji\/[a-f0-9]{20}$/.test(url.pathname)) {
        const { bytes, type } = await catalogStore.image(url.pathname.split('/').at(-1));
        response.writeHead(200, { 'Content-Type': type, 'Content-Length': bytes.length });
        response.end(bytes);
      } else if (Object.hasOwn(STATIC_FILES, url.pathname)) {
        const [file, type] = STATIC_FILES[url.pathname];
        const content = file === 'index.html' ? html : await readFile(new URL(file, import.meta.url));
        response.writeHead(200, { 'Content-Type': type });
        response.end(content);
      } else {
        throw new AppError(404, 'Not found.', 'NOT_FOUND');
      }
    } catch (error) {
      if (response.destroyed || response.writableEnded) return;
      if (error.name === 'AbortError') {
        json(response, 499, { error: 'Request cancelled.', code: 'CANCELLED' });
      } else if (error instanceof AppError) {
        if (error.retryAfter) response.setHeader('Retry-After', error.retryAfter);
        json(response, error.status, { error: error.message, code: error.code, retryAfter: error.retryAfter });
      } else {
        console.error('Unexpected local server failure:', error.code || error.name);
        json(response, 500, { error: 'The local server failed. Check the terminal and try again.', code: 'SERVER_ERROR' });
      }
    }
  });
  server.requestTimeout = 15_000;
  server.headersTimeout = 10_000;
  server.on('close', () => activeController?.abort());
  return server;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const port = Number(process.env.PORT || 4318);
    if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('PORT must be between 1024 and 65535.');
    const server = await createBufoServer();
    server.on('error', error => {
      console.error(error.code === 'EADDRINUSE' ? `Port ${port} is in use. Choose another PORT in .env.` : 'Could not start the local server.');
      process.exitCode = 1;
    });
    server.listen(port, '127.0.0.1', () => {
      console.log(`Bufo Finder: http://127.0.0.1:${port}`);
      console.log('Local-only. Connect a provider in the app; keys and messages are not written to disk.');
    });
  } catch (error) {
    console.error(error instanceof AppError ? error.message : `Could not start Bufo Finder: ${error.message}`);
    process.exitCode = 1;
  }
}
