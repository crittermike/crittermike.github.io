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
