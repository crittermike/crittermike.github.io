import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { createUsageBudget } from '../usage.mjs';

async function fixture(t, tokenLimit = 100) {
  const directory = await mkdtemp(join(tmpdir(), 'bufo-budget-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const path = join(directory, 'usage.json');
  const clock = { time: Date.parse('2026-09-30T12:00:00Z') };
  const options = { path, tokenLimit, now: () => clock.time };
  const budget = createUsageBudget(options);
  await budget.ready();
  return { path, clock, options, budget, state: async () => JSON.parse(await readFile(path, 'utf8')) };
}

test('reserves worst-case usage durably before inference and settles only reported usage', async t => {
  const { path, budget, state } = await fixture(t);
  const settle = await budget.reserve(80);
  assert.equal((await state()).usedTokens, 80);
  await assert.rejects(budget.reserve(21), { code: 'DAILY_BUDGET' });
  await settle(30);
  assert.equal((await state()).usedTokens, 30);
  await budget.reserve(70);
  assert.equal((await state()).usedTokens, 100);
  assert.equal((await stat(path)).mode & 0o077, 0);
  assert.deepEqual(Object.keys(await state()).sort(), ['day', 'usedTokens', 'version']);
});

test('simultaneous reservations cannot overdraw the daily budget', async t => {
  const { budget, state } = await fixture(t);
  const results = await Promise.allSettled(Array.from({ length: 8 }, () => budget.reserve(60)));
  assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
  assert.equal(results.filter(result => result.status === 'rejected' && result.reason.code === 'DAILY_BUDGET').length, 7);
  assert.equal((await state()).usedTokens, 60);
});

test('restart preserves reservations from failed, cancelled, or unfinished work', async t => {
  const { budget, options, state } = await fixture(t);
  const unknown = await budget.reserve(70);
  await unknown(null);
  const restarted = createUsageBudget(options);
  await restarted.ready();
  assert.equal((await state()).usedTokens, 70);
  await assert.rejects(restarted.reserve(31), { code: 'DAILY_BUDGET' });
});

test('invalid or duplicate settlements never create extra budget', async t => {
  const { budget, state } = await fixture(t);
  const settle = await budget.reserve(80);
  for (const value of [-1, 81, undefined, NaN, '1']) {
    await assert.rejects(settle(value), { code: 'INVALID_RESPONSE' });
  }
  assert.equal((await state()).usedTokens, 80);
  const results = await Promise.allSettled([settle(30), settle(30)]);
  assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
  assert.equal((await state()).usedTokens, 30);
});

test('midnight resets the UTC budget and late settlements cannot refund the new day', async t => {
  const { budget, clock, state } = await fixture(t);
  const old = await budget.reserve(80);
  await assert.rejects(budget.reserve(30), error => error.code === 'DAILY_BUDGET' && error.retryAfter === 12 * 3600);
  clock.time = Date.parse('2026-10-01T00:00:01Z');
  await budget.reserve(60);
  await old(1);
  assert.deepEqual(await state(), { version: 1, day: '2026-10-01', usedTokens: 60 });
});

test('malformed, future, or unreadable budget storage fails closed', async t => {
  const { path, options } = await fixture(t);
  for (const text of [
    '', 'not json', '{}', 'null',
    JSON.stringify({ version: 1, day: '2026-10-01', usedTokens: 0 }),
    JSON.stringify({ version: 1, day: '2026-02-31', usedTokens: 0 }),
    JSON.stringify({ version: 1, day: '2026-09-30', usedTokens: -1 })
  ]) {
    await writeFile(path, text);
    await assert.rejects(createUsageBudget(options).ready(), { code: 'BUDGET_STORAGE' });
  }
  await assert.rejects(createUsageBudget({ ...options, path: tmpdir() }).ready(), { code: 'BUDGET_STORAGE' });
});

test('invalid budgets and reservations are rejected rather than becoming unlimited', async t => {
  const { budget, options } = await fixture(t);
  for (const value of [0, -1, NaN, 1.5, Number.MAX_SAFE_INTEGER + 1]) {
    assert.throws(() => createUsageBudget({ ...options, tokenLimit: value }));
    await assert.rejects(budget.reserve(value));
  }
});
