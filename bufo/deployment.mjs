import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { AppError, PROVIDERS, validateConnection } from './jev.mjs';

export function sameSecret(actual, expected) {
  if (typeof actual !== 'string' || typeof expected !== 'string') return false;
  return timingSafeEqual(createHash('sha256').update(actual).digest(), createHash('sha256').update(expected).digest());
}

export function deploymentConfig(env) {
  if (env.BUFO_MODE && !['local', 'shared'].includes(env.BUFO_MODE)) throw new Error('BUFO_MODE must be local or shared.');
  const shared = env.BUFO_MODE === 'shared';
  const provider = env.JEV_PROVIDER || (env.TYPESAFE_API_KEY ? 'typesafe' : env.AI_GATEWAY_API_KEY ? 'vercel' : 'typesafe');
  if (!Object.hasOwn(PROVIDERS, provider)) throw new Error('JEV_PROVIDER must be typesafe or vercel.');
  const apiKey = env[PROVIDERS[provider].keyVariable]?.trim() || '';
  if (apiKey) validateConnection(provider, apiKey);
  let origin;
  if (shared) {
    let url;
    try { url = new URL(env.BUFO_PUBLIC_ORIGIN); } catch { throw new Error('Shared mode requires BUFO_PUBLIC_ORIGIN.'); }
    if (url.protocol !== 'https:' || url.username || url.password || url.pathname !== '/' || url.search || url.hash) {
      throw new Error('BUFO_PUBLIC_ORIGIN must be an HTTPS origin without a path or credentials.');
    }
    origin = url.origin;
    if (!/^[\x21-\x7e]{32,512}$/.test(env.BUFO_PROXY_SECRET || '')) {
      throw new Error('Shared mode requires a BUFO_PROXY_SECRET of at least 32 characters.');
    }
    if (!apiKey) throw new Error(`Shared mode requires ${PROVIDERS[provider].keyVariable} in the server secret store.`);
    if (!/^[\x21-\x7e]{8,512}$/.test(env.BUFO_GITHUB_TOKEN || '')) {
      throw new Error('Shared mode requires BUFO_GITHUB_TOKEN with read access to the emoji source.');
    }
  }
  return { shared, origin, provider, apiKey, proxySecret: env.BUFO_PROXY_SECRET, listenHost: shared ? '0.0.0.0' : '127.0.0.1' };
}

export function createRequestAccess(config) {
  const localToken = randomBytes(32).toString('hex');
  return (request, port) => {
    const host = request.headers.host;
    const origin = config.shared ? config.origin : `http://${host}`;
    const allowedHost = config.shared
      ? host === new URL(config.origin).host
      : [`127.0.0.1:${port}`, `localhost:${port}`].includes(host);
    let user = 'local';
    if (config.shared) {
      if (!sameSecret(request.headers['x-bufo-proxy-secret'], config.proxySecret) ||
          !/^[a-zA-Z0-9@._+-]{1,200}$/.test(request.headers['x-bufo-user'] || '')) {
        throw new AppError(403, 'Company sign-in is required to access Bufo.', 'FORBIDDEN');
      }
      user = request.headers['x-bufo-user'];
    }
    const pageNavigation = request.method === 'GET' && /^\/(?:index\.html)?(?:\?|$)/.test(request.url) &&
      request.headers['sec-fetch-mode'] === 'navigate' && request.headers['sec-fetch-dest'] === 'document';
    if (!allowedHost || (request.headers.origin && request.headers.origin !== origin) ||
        (request.headers['sec-fetch-site'] === 'cross-site' && !pageNavigation)) {
      throw new AppError(403, 'Reload Bufo before trying again.', 'FORBIDDEN');
    }
    const identity = createHash('sha256').update(user).digest('hex');
    // Stable across replicas, scoped to the identity asserted by the SSO proxy.
    const csrfToken = config.shared
      ? createHmac('sha256', config.proxySecret).update(`bufo-csrf:${identity}`).digest('hex')
      : localToken;
    if (request.method === 'POST' &&
        (request.headers.origin !== origin || !sameSecret(request.headers['x-bufo-token'], csrfToken))) {
      throw new AppError(403, 'Reload Bufo before trying again.', 'FORBIDDEN');
    }
    return { identity, csrfToken, origin };
  };
}
