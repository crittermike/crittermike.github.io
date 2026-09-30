import assert from 'node:assert/strict';
import test from 'node:test';
import { createDebouncedSearch, DEBOUNCE_MS, groupEmojis, readSuggestionStream } from '../core.js';
import { deferred, emoji, flush } from './fixtures.mjs';

test('reads split progress frames and returns a result only after the stream completes', async () => {
  const encoder = new TextEncoder();
  const text = [
    JSON.stringify({ type: 'progress', scoredCount: 0, totalCount: 10 }),
    JSON.stringify({ type: 'progress', scoredCount: 7, totalCount: 10 }),
    JSON.stringify({ type: 'progress', scoredCount: 10, totalCount: 10 }),
    JSON.stringify({ type: 'result', ranking: { evaluatedCount: 10 } })
  ].join('\r\n');
  const bytes = encoder.encode(text);
  const body = new ReadableStream({
    start(controller) {
      for (let index = 0; index < bytes.length; index += 3) controller.enqueue(bytes.slice(index, index + 3));
      controller.close();
    }
  });
  const progress = [];
  const result = await readSuggestionStream(body, { onProgress: event => progress.push(event.scoredCount) });
  assert.deepEqual(progress, [0, 7, 10]);
  assert.equal(result.evaluatedCount, 10);
});

test('interrupted, malformed, or regressing progress never becomes a successful partial ranking', async () => {
  const first = JSON.stringify({ type: 'progress', scoredCount: 5, totalCount: 10 });
  for (const text of [
    first, 'not JSON', first + '\n{"type":"progress","scoredCount":4,"totalCount":10}',
    '{"type":"progress","scoredCount":11,"totalCount":10}',
    '{"type":"progress","scoredCount":-1,"totalCount":10}',
    first + '\n{"type":"progress","scoredCount":6,"totalCount":11}',
    'x'.repeat(65_537),
    '{"type":"result","ranking":{}}\n{"type":"result","ranking":{}}'
  ]) {
    await assert.rejects(readSuggestionStream(new Response(text).body), /progress stream|before scoring finished/);
  }
  await assert.rejects(readSuggestionStream(new ReadableStream({
    start(controller) { controller.error(new Error('Disconnected')); }
  })), /interrupted before scoring finished/);
});

test('streamed errors preserve their actionable code and retry delay', async () => {
  const body = new Response(JSON.stringify({ type: 'error', error: 'Jev is busy.', code: 'PROVIDER_BUSY', retryAfter: 7 })).body;
  await assert.rejects(readSuggestionStream(body), { message: 'Jev is busy.', code: 'PROVIDER_BUSY', retryAfter: 7 });
});

test('groups numeric suffixes into one complete row-major message without losing standalone variants', () => {
  const tiles = [
    emoji(3, 'bufo-test_1_1'), emoji(2, 'bufo-test_1_0'),
    emoji(1, 'bufo-test_0_1'), emoji(0, 'bufo-test_0_0')
  ];
  const original = structuredClone(tiles);
  const entries = groupEmojis([...tiles, emoji(4, 'bufo-test'), emoji(5, 'bufo-unrelated_1')]);
  assert.equal(entries.length, 3);
  const group = entries.find(entry => entry.composite);
  assert.equal(group.id, tiles[3].id);
  assert.equal(group.name, 'bufo-test');
  assert.equal(group.complete, true);
  assert.equal(group.rows.length, 2);
  assert.ok(group.rows.every(row => row.length === 2));
  assert.equal(group.copyText, ':bufo-test_0_0::bufo-test_1_0:\n:bufo-test_0_1::bufo-test_1_1:');
  assert.deepEqual(tiles, original);
  assert.equal(entries.find(entry => !entry.composite && entry.name === 'bufo-test').copyText, ':bufo-test:');
  assert.equal(entries.flatMap(entry => entry.tiles).length, 6);
  assert.equal(groupEmojis(tiles.toReversed())[0].id, group.id);
});

test('orders multi-digit row and column indices numerically and supports one-based coordinates', () => {
  const tiles = Array.from({ length: 24 }, (_, index) =>
    emoji(index, `bufo-wide_${index % 12 + 1}_${Math.floor(index / 12) + 1}`)
  );
  const group = groupEmojis(tiles.toReversed())[0];
  assert.equal(group.rows.length, 2);
  assert.equal(group.rows[0].length, 12);
  assert.equal(group.rows[0][1].name, 'bufo-wide_2_1');
  assert.equal(group.rows[0][9].name, 'bufo-wide_10_1');
  assert.ok(group.copyText.endsWith(':bufo-wide_12_2:'));
});

test('large coordinate offsets do not create large grids or lose numeric precision', () => {
  const offset = 10n ** 50n;
  const tiles = [emoji(0, `bufo-offset_${offset}_${offset}`), emoji(1, `bufo-offset_${offset}_${offset + 1n}`)];
  const group = groupEmojis(tiles.toReversed())[0];
  assert.equal(group.complete, true);
  assert.equal(group.rows.length, 2);
  assert.equal(group.rows[0].length, 1);
  const sparse = groupEmojis([emoji(0, 'bufo-sparse_0_0'), emoji(1, `bufo-sparse_${offset}_${offset}`)])[0];
  assert.equal(sparse.complete, false);
  assert.deepEqual(sparse.rows, []);
  assert.equal(sparse.copyText, null);
});

test('incomplete or duplicate coordinates remain one unavailable group instead of a broken copy string', () => {
  for (const names of [
    ['bufo-missing_0_0', 'bufo-missing_0_1', 'bufo-missing_1_0'],
    ['bufo-duplicate_01_01', 'bufo-duplicate_1_1']
  ]) {
    const entries = groupEmojis(names.map((name, index) => emoji(index, name)));
    assert.equal(entries.length, 1);
    assert.equal(entries[0].complete, false);
    assert.equal(entries[0].copyText, null);
    assert.equal(entries[0].tiles.length, names.length);
  }
});

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
