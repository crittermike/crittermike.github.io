import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequestAccess, deploymentConfig } from '../deployment.mjs';
import { TEST_KEY } from './fixtures.mjs';

const env = {
  BUFO_MODE: 'shared', BUFO_PUBLIC_ORIGIN: 'https://bufo.example.test',
  TYPESAFE_API_KEY: TEST_KEY, BUFO_GITHUB_TOKEN: 'github-test-token',
  BUFO_PROXY_SECRET: 'long-test-secret-not-for-production'
};

test('local previews stay on loopback and shared hosting cannot silently fall back to public access', () => {
  assert.equal(deploymentConfig({}).listenHost, '127.0.0.1');
  assert.equal(deploymentConfig(env).listenHost, '0.0.0.0');
  for (const key of ['BUFO_PUBLIC_ORIGIN', 'TYPESAFE_API_KEY', 'BUFO_GITHUB_TOKEN', 'BUFO_PROXY_SECRET']) {
    const missing = { ...env };
    delete missing[key];
    assert.throws(() => deploymentConfig(missing));
  }
  for (const origin of ['http://bufo.test', 'https://user:password@bufo.test', 'https://bufo.test/path', 'https://bufo.test?token=secret']) {
    assert.throws(() => deploymentConfig({ ...env, BUFO_PUBLIC_ORIGIN: origin }));
  }
  assert.throws(() => deploymentConfig({ BUFO_MODE: 'public' }));
});

test('shared CSRF tokens survive restarts and replicas but stay scoped to the authenticated viewer', () => {
  const config = deploymentConfig(env);
  const request = {
    method: 'GET', url: '/api/status',
    headers: { host: 'bufo.example.test', 'x-bufo-proxy-secret': env.BUFO_PROXY_SECRET, 'x-bufo-user': 'member-one' }
  };
  const first = createRequestAccess(config)(request, 4318);
  const second = createRequestAccess(config)(request, 4318);
  assert.equal(first.csrfToken, second.csrfToken);
  request.headers['x-bufo-user'] = 'member-two';
  assert.notEqual(first.csrfToken, createRequestAccess(config)(request, 4318).csrfToken);
  assert.equal(first.identity.includes('member-one'), false);
});

const publicEnv = {
  BUFO_MODE: 'public', BUFO_PUBLIC_ORIGIN: 'https://bufo.example.test',
  BUFO_DATA_DIR: '/data', BUFO_DAILY_TOKEN_LIMIT: '25000000', TYPESAFE_API_KEY: TEST_KEY
};

test('public hosting is explicit, bounded, and does not require company or GitHub credentials', () => {
  const config = deploymentConfig(publicEnv);
  assert.equal(config.publicMode, true);
  assert.equal(config.shared, false);
  assert.equal(config.listenHost, '0.0.0.0');
  assert.equal(config.dailyTokenLimit, 25_000_000);
  for (const key of ['BUFO_PUBLIC_ORIGIN', 'BUFO_DATA_DIR', 'BUFO_DAILY_TOKEN_LIMIT', 'TYPESAFE_API_KEY']) {
    const missing = { ...publicEnv };
    delete missing[key];
    assert.throws(() => deploymentConfig(missing));
  }
  for (const limit of ['0', '-1', 'Infinity', '1.5', '9007199254740992']) {
    assert.throws(() => deploymentConfig({ ...publicEnv, BUFO_DAILY_TOKEN_LIMIT: limit }));
  }
});

test('public CSRF tokens are network-scoped and untrusted forwarding headers are ignored off Fly', () => {
  const access = createRequestAccess(deploymentConfig(publicEnv));
  const request = {
    method: 'GET', url: '/api/status', socket: { remoteAddress: '192.0.2.1' },
    headers: { host: 'bufo.example.test', 'fly-client-ip': '198.51.100.1', 'x-forwarded-for': '198.51.100.2' }
  };
  const first = access(request, 4318);
  request.headers['fly-client-ip'] = '198.51.100.3';
  assert.deepEqual(access(request, 4318), first);
  request.socket.remoteAddress = '192.0.2.2';
  assert.notEqual(access(request, 4318).csrfToken, first.csrfToken);
  request.method = 'POST';
  request.headers.origin = publicEnv.BUFO_PUBLIC_ORIGIN;
  request.headers['x-bufo-token'] = first.csrfToken;
  assert.throws(() => access(request, 4318), { code: 'FORBIDDEN' });
});

test('Fly public mode uses the Fly proxy client address rather than a shared backend connection', () => {
  const access = createRequestAccess(deploymentConfig({ ...publicEnv, FLY_APP_NAME: 'test-app' }));
  const request = {
    method: 'GET', url: '/api/status', socket: { remoteAddress: '192.0.2.1' },
    headers: { host: 'bufo.example.test', 'fly-client-ip': '198.51.100.1' }
  };
  const first = access(request, 4318);
  request.headers['fly-client-ip'] = '198.51.100.2';
  const second = access(request, 4318);
  assert.notEqual(second.identity, first.identity);
  assert.notEqual(second.csrfToken, first.csrfToken);
  request.headers['fly-client-ip'] = 'not an address';
  assert.throws(() => access(request, 4318), { code: 'FORBIDDEN' });
});
