import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createCatalogStore, syncCatalog } from './catalog.mjs';
import { createRequestAccess, deploymentConfig } from './deployment.mjs';
import { AppError, evaluateQuestions, limitEvaluations, PROVIDERS, rankWithJev, validateText, verifyConnection } from './jev.mjs';

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

function sendError(response, status, body) {
  if (response.headersSent) {
    response.end(`${JSON.stringify({ type: 'error', ...body })}\n`);
  } else {
    if (body.retryAfter) response.setHeader('Retry-After', body.retryAfter);
    json(response, status, body);
  }
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
  const config = deploymentConfig(env);
  const authorize = createRequestAccess(config);
  const evaluate = limitEvaluations(evaluateQuestions, 3);
  const active = new Map();
  const recent = new Map();
  const html = await readFile(new URL('./index.html', import.meta.url), 'utf8');
  const server = createServer(async (request, response) => {
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('Referrer-Policy', 'no-referrer');
    response.setHeader('X-Frame-Options', 'DENY');
    response.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self'; connect-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'; object-src 'none'");
    try {
      const { identity, csrfToken, origin } = authorize(request, server.address().port);
      const url = new URL(request.url, origin);
      if (request.method === 'POST') {
        if (url.pathname !== '/api/suggest') throw new AppError(404, 'Not found.', 'NOT_FOUND');
        const data = await readJson(request);
        const text = validateText(data.text);
        if (!config.apiKey) throw new AppError(503, 'The app owner needs to finish the Jev connection.', 'NOT_CONFIGURED');
        const catalog = await catalogStore.get();
        if (data.syncedAt !== undefined && data.syncedAt !== catalog.syncedAt) {
          throw new AppError(409, 'The emoji collection changed. Retry to reload it.', 'CATALOG_CHANGED');
        }
        const emojis = catalog.emojis;
        const now = Date.now();
        for (const [user, timestamp] of recent) if (now - timestamp > 60_000) recent.delete(user);
        if (active.has(identity) || now - (recent.get(identity) || 0) < minInterval) {
          throw new AppError(429, 'Your previous request is still finishing. Try again in a second.', 'USER_RATE_LIMIT', 1);
        }
        if (active.size >= 4) throw new AppError(429, 'Bufo is busy. Try again shortly.', 'SERVICE_BUSY', 5);
        const controller = new AbortController();
        const streaming = request.headers.accept === 'application/x-ndjson';
        const onProgress = streaming ? progress => {
          if (controller.signal.aborted || response.destroyed) return;
          if (!response.headersSent) {
            response.writeHead(200, {
              'Content-Type': 'application/x-ndjson; charset=utf-8',
              'Cache-Control': 'no-store, no-transform',
              'X-Accel-Buffering': 'no'
            });
          }
          response.write(`${JSON.stringify({ type: 'progress', ...progress })}\n`);
        } : undefined;
        response.on('close', () => { if (!response.writableEnded) controller.abort(); });
        active.set(identity, controller);
        recent.set(identity, now);
        try {
          const ranking = await rankWithJev({
            text, emojis, provider: config.provider, apiKey: config.apiKey,
            signal: controller.signal, fetchImpl, evaluate, onProgress
          });
          if (!controller.signal.aborted) {
            const result = { ...ranking, syncedAt: catalog.syncedAt };
            if (streaming) response.end(`${JSON.stringify({ type: 'result', ranking: result })}\n`);
            else json(response, 200, result);
          }
        } finally {
          active.delete(identity);
        }
      } else if (request.method !== 'GET') {
        throw new AppError(405, 'Method not allowed.', 'METHOD_NOT_ALLOWED');
      } else if (url.pathname === '/api/status') {
        let catalogCount = 0;
        let error = null;
        try {
          catalogCount = (await catalogStore.get(true)).emojis.length;
        } catch (failure) {
          if (!(failure instanceof AppError)) throw failure;
          console.error('Catalog unavailable:', failure.code);
          error = 'The emoji collection is unavailable. The app owner needs to check the service.';
        }
        if (!config.apiKey) error = 'The app owner needs to finish the Jev connection.';
        json(response, 200, {
          ready: Boolean(config.apiKey) && catalogCount > 0, csrfToken, catalogCount, error,
          provider: config.provider, providerLabel: PROVIDERS[config.provider].label
        });
      } else if (url.pathname === '/api/catalog') {
        const catalog = await catalogStore.get();
        json(response, 200, {
          syncedAt: catalog.syncedAt,
          emojis: catalog.emojis.map(({ id, name }) => ({ id, name }))
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
        sendError(response, 499, { error: 'Request cancelled.', code: 'CANCELLED' });
      } else if (error instanceof AppError) {
        sendError(response, error.status, { error: error.message, code: error.code, retryAfter: error.retryAfter });
      } else {
        console.error('Server failure:', error.code || error.name);
        sendError(response, 500, { error: 'Bufo is unavailable. Try again shortly.', code: 'SERVER_ERROR' });
      }
    }
  });
  server.requestTimeout = 15_000;
  server.headersTimeout = 10_000;
  server.on('close', () => { for (const controller of active.values()) controller.abort(); });
  return server;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const config = deploymentConfig(process.env);
    const port = Number(process.env.PORT || 4318);
    if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('PORT must be between 1024 and 65535.');
    if (config.shared) {
      await verifyConnection({ provider: config.provider, apiKey: config.apiKey });
      await syncCatalog();
    }
    const server = await createBufoServer();
    server.on('error', error => {
      console.error(error.code === 'EADDRINUSE' ? `Port ${port} is in use. Choose another PORT.` : 'Could not start the service.');
      process.exitCode = 1;
    });
    server.listen(port, config.listenHost, () => {
      console.log(`Bufo: ${config.origin || `http://127.0.0.1:${port}`}`);
      console.log(config.shared ? 'Shared service. All routes require the authenticated company proxy.' : 'Local preview. The model key is configured on the server, not by viewers.');
    });
    const shutdown = () => {
      for (const signal of ['SIGINT', 'SIGTERM']) process.removeListener(signal, shutdown);
      server.close();
      const timeout = setTimeout(() => server.closeAllConnections(), 5000);
      timeout.unref();
    };
    process.once('SIGINT', shutdown);
    process.once('SIGTERM', shutdown);
  } catch (error) {
    console.error(`Could not start Bufo: ${error.message}`);
    process.exitCode = 1;
  }
}
