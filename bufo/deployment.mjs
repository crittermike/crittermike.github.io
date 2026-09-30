import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { isIP } from 'node:net';
import { isAbsolute } from 'node:path';
import { AppError, PROVIDERS, validateConnection } from './jev.mjs';

export function sameSecret(actual, expected) {
  if (typeof actual !== 'string' || typeof expected !== 'string') return false;
  return timingSafeEqual(createHash('sha256').update(actual).digest(), createHash('sha256').update(expected).digest());
}

export function deploymentConfig(env) {
  if (env.BUFO_MODE && !['local', 'shared', 'public'].includes(env.BUFO_MODE)) throw new Error('BUFO_MODE must be local, shared, or public.');
  const shared = env.BUFO_MODE === 'shared';
  const publicMode = env.BUFO_MODE === 'public';
  const hosted = shared || publicMode;
  const provider = env.JEV_PROVIDER || (env.TYPESAFE_API_KEY ? 'typesafe' : env.AI_GATEWAY_API_KEY ? 'vercel' : 'typesafe');
  if (!Object.hasOwn(PROVIDERS, provider)) throw new Error('JEV_PROVIDER must be typesafe or vercel.');
  const apiKey = env[PROVIDERS[provider].keyVariable]?.trim() || '';
  if (apiKey) validateConnection(provider, apiKey);
  let origin;
  if (hosted) {
    let url;
    try { url = new URL(env.BUFO_PUBLIC_ORIGIN); } catch { throw new Error('Hosted mode requires BUFO_PUBLIC_ORIGIN.'); }
    if (url.protocol !== 'https:' || url.username || url.password || url.pathname !== '/' || url.search || url.hash) {
      throw new Error('BUFO_PUBLIC_ORIGIN must be an HTTPS origin without a path or credentials.');
    }
    origin = url.origin;
    if (!apiKey) throw new Error(`Hosted mode requires ${PROVIDERS[provider].keyVariable} in the server secret store.`);
  }
  if (shared) {
    if (!/^[\x21-\x7e]{32,512}$/.test(env.BUFO_PROXY_SECRET || '')) {
      throw new Error('Shared mode requires a BUFO_PROXY_SECRET of at least 32 characters.');
    }
    if (!/^[\x21-\x7e]{8,512}$/.test(env.BUFO_GITHUB_TOKEN || '')) {
      throw new Error('Shared mode requires BUFO_GITHUB_TOKEN with read access to the emoji source.');
    }
  }
  const dailyTokenLimit = Number(env.BUFO_DAILY_TOKEN_LIMIT);
  if (publicMode && (!/^\d+$/.test(env.BUFO_DAILY_TOKEN_LIMIT || '') || !Number.isSafeInteger(dailyTokenLimit) || dailyTokenLimit < 1)) {
    throw new Error('Public mode requires a positive BUFO_DAILY_TOKEN_LIMIT.');
  }
  if (publicMode && !isAbsolute(env.BUFO_DATA_DIR || '')) {
    throw new Error('Public mode requires an absolute BUFO_DATA_DIR on persistent storage.');
  }
  return {
    shared, publicMode, hosted, origin, provider, apiKey, dailyTokenLimit,
    trustFlyProxy: publicMode && Boolean(env.FLY_APP_NAME),
    proxySecret: env.BUFO_PROXY_SECRET, listenHost: hosted ? '0.0.0.0' : '127.0.0.1'
  };
}

export function createRequestAccess(config) {
  const localToken = randomBytes(32).toString('hex');
  return (request, port) => {
    const host = request.headers.host;
    const origin = config.hosted ? config.origin : `http://${host}`;
    const allowedHost = config.hosted
      ? host === new URL(config.origin).host
      : [`127.0.0.1:${port}`, `localhost:${port}`].includes(host);
    let user = 'local';
    if (config.shared) {
      if (!sameSecret(request.headers['x-bufo-proxy-secret'], config.proxySecret) ||
          !/^[a-zA-Z0-9@._+-]{1,200}$/.test(request.headers['x-bufo-user'] || '')) {
        throw new AppError(403, 'Company sign-in is required to access Bufo.', 'FORBIDDEN');
      }
      user = request.headers['x-bufo-user'];
    } else if (config.publicMode) {
      const ip = (config.trustFlyProxy ? request.headers['fly-client-ip'] : undefined) || request.socket?.remoteAddress;
      if (typeof ip !== 'string' || !isIP(ip)) throw new AppError(403, 'The client address could not be verified.', 'FORBIDDEN');
      user = createHmac('sha256', localToken).update(ip).digest('hex');
    }
    const pageNavigation = request.method === 'GET' && /^\/(?:index\.html)?(?:\?|$)/.test(request.url) &&
      request.headers['sec-fetch-mode'] === 'navigate' && request.headers['sec-fetch-dest'] === 'document';
    if (!allowedHost || (request.headers.origin && request.headers.origin !== origin) ||
        (request.headers['sec-fetch-site'] === 'cross-site' && !pageNavigation)) {
      throw new AppError(403, 'Reload Bufo before trying again.', 'FORBIDDEN');
    }
    const identity = createHash('sha256').update(user).digest('hex');
    // Shared-mode tokens survive restarts; public tokens are process-scoped.
    const csrfToken = config.hosted
      ? createHmac('sha256', config.shared ? config.proxySecret : localToken).update(`bufo-csrf:${identity}`).digest('hex')
      : localToken;
    if (request.method === 'POST' &&
        (request.headers.origin !== origin || !sameSecret(request.headers['x-bufo-token'], csrfToken))) {
      throw new AppError(403, 'Reload Bufo before trying again.', 'FORBIDDEN');
    }
    return { identity, csrfToken, origin };
  };
}
