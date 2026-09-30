import assert from 'node:assert/strict';
import test from 'node:test';
import { createDebouncedSearch, DEBOUNCE_MS } from '../core.js';
import { deferred, flush } from './fixtures.mjs';

test('waits a full 700 ms after the most recent keystroke', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const calls = [];
  const results = [];
  const searcher = createDebouncedSearch({
    search: async text => { calls.push(text); return text; },
    onResult: result => results.push(result),
    onError: error => { throw error; }
  });
  searcher.schedule('first');
  t.mock.timers.tick(350);
  searcher.schedule('second');
  t.mock.timers.tick(DEBOUNCE_MS - 1);
  await flush();
  assert.deepEqual(calls, []);
  t.mock.timers.tick(1);
  await flush();
  assert.deepEqual(calls, ['second']);
  assert.deepEqual(results, ['second']);
});

test('aborts old requests and ignores stale results even when a transport ignores abort', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const old = deferred();
  const latest = deferred();
  const results = [];
  const signals = [];
  const searcher = createDebouncedSearch({
    search: (text, signal) => { signals.push(signal); return text === 'old' ? old.promise : latest.promise; },
    onResult: result => results.push(result),
    onError: error => { throw error; }
  });
  searcher.schedule('old');
  t.mock.timers.tick(DEBOUNCE_MS);
  searcher.schedule('latest');
  assert.equal(signals[0].aborted, true);
  t.mock.timers.tick(DEBOUNCE_MS);
  latest.resolve('latest');
  await flush();
  old.resolve('old');
  await flush();
  assert.deepEqual(results, ['latest']);
});

test('clearing the field cancels pending work and suppresses stale failures', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const pending = deferred();
  const errors = [];
  let calls = 0;
  const searcher = createDebouncedSearch({
    search: () => { calls += 1; return pending.promise; },
    onResult: () => assert.fail('Cancelled results must not render'),
    onError: error => errors.push(error.message)
  });
  searcher.schedule('never sent');
  searcher.cancel();
  t.mock.timers.tick(DEBOUNCE_MS);
  assert.equal(calls, 0);
  searcher.schedule('sent');
  t.mock.timers.tick(DEBOUNCE_MS);
  searcher.cancel();
  pending.reject(new Error('old failure'));
  await flush();
  assert.deepEqual(errors, []);
});

test('current errors are surfaced instead of success-shaped fallback results', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const errors = [];
  const searcher = createDebouncedSearch({
    search: async () => { throw new Error('No credits'); },
    onResult: () => assert.fail('Failed request must not render AI results'),
    onError: error => errors.push(error.message)
  });
  searcher.schedule('message');
  t.mock.timers.tick(DEBOUNCE_MS);
  await flush();
  assert.deepEqual(errors, ['No credits']);
});
