import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildScoringQuestions, evaluateQuestions, limitEvaluations,
  MAX_NAME_BONUS, MAX_PARALLEL_REQUESTS, MAX_QUESTIONS_PER_REQUEST, MAX_REQUEST_BYTES, nameLengthBonus, packQuestions, parseEvaluation, rankWithJev,
  validateConnection, validateText, verifyConnection
} from '../jev.mjs';
import { answerRequest, catalog, deferred, emoji, fakeFetch, flush, TEST_KEY } from './fixtures.mjs';

const small = catalog(12).emojis;
const question = { fit: { type: 'noul', instructions: { question: 'Does this fit?', filename: 'bufo-happy.png' } } };
const options = { text: 'A nice day', provider: 'typesafe', apiKey: TEST_KEY, questions: question };

test('reports exact completed filename counts when parallel batches finish out of order', async () => {
  const pending = [];
  const progress = [];
  const emojis = catalog(1200).emojis;
  const batches = packQuestions('Hello', buildScoringQuestions(emojis, 'typesafe'), 'typesafe');
  let hold = true;
  const ranking = rankWithJev({
    text: 'Hello', emojis, provider: 'typesafe', apiKey: TEST_KEY,
    onProgress: event => progress.push(event),
    fetchImpl: async (_url, { body }) => {
      const request = JSON.parse(body);
      const gate = deferred();
      pending.push({ request, gate });
      if (hold) await gate.promise;
      return Response.json(answerRequest(request));
    }
  });
  await flush();
  assert.equal(pending.length, Math.min(MAX_PARALLEL_REQUESTS, batches.length));
  assert.deepEqual(progress.map(event => event.scoredCount), [0]);
  assert.deepEqual(progress[0].ranking.suggestions, []);
  pending[1].gate.resolve();
  await flush();
  assert.equal(progress[1].scoredCount, Object.keys(pending[1].request.questions).length);
  assert.equal(progress[1].completedBatches, 1);
  assert.equal(progress[1].ranking.evaluatedCount, progress[1].scoredCount);
  const scoredIds = new Set(Object.keys(pending[1].request.questions).map(key => emojis[Number(key.slice(1))].id));
  assert.ok(progress[1].ranking.suggestions.length > 0);
  assert.ok(progress[1].ranking.suggestions.every(match => scoredIds.has(match.id)));
  hold = false;
  for (const item of pending) item.gate.resolve();
  const result = await ranking;
  assert.equal(progress.at(-1).scoredCount, emojis.length);
  assert.equal(progress.at(-1).completedBatches, result.requestCount);
  assert.ok(progress.every(event => event.totalCount === emojis.length && event.totalBatches === batches.length));
  assert.deepEqual(progress.at(-1).ranking.suggestions, result.suggestions);
});

test('later scores replace the early favorite and mosaics wait for every tile before averaging', async () => {
  const emojis = catalog(1200).emojis;
  emojis[0] = emoji(0, 'bufo-assembled_0_0');
  emojis[1] = emoji(1, 'bufo-early-favorite');
  emojis[1198] = emoji(1198, 'bufo-late-favorite');
  emojis[1199] = emoji(1199, 'bufo-assembled_1_0');
  const partial = deferred();
  const release = deferred();
  const updates = [];
  const ranking = rankWithJev({
    text: 'Hello', emojis, provider: 'typesafe', apiKey: TEST_KEY,
    onProgress: progress => {
      updates.push(progress);
      if (progress.scoredCount > 0) partial.resolve();
    },
    fetchImpl: async (_url, { body }) => {
      const request = JSON.parse(body);
      if (!Object.hasOwn(request.questions, 'e0')) await release.promise;
      return Response.json(answerRequest(request, filename => {
        if (filename === emojis[0].filename || filename === emojis[1198].filename) return 0.99;
        if (filename === emojis[1199].filename) return 0.21;
        return filename === emojis[1].filename ? 0.8 : 0.1;
      }));
    }
  });
  try {
    await partial.promise;
    assert.equal(updates.at(-1).ranking.suggestions[0].id, emojis[1].id);
    assert.ok(updates.at(-1).ranking.suggestions.every(match => match.id !== emojis[0].id));
  } finally { release.resolve(); }
  const result = await ranking;
  assert.equal(result.suggestions[0].id, emojis[1198].id);
  const mosaic = result.suggestions.find(match => match.id === emojis[0].id);
  assert.ok(Math.abs(mosaic.score - 0.6) < 1e-10);
  assert.equal(mosaic.nameBonus, nameLengthBonus('bufo-assembled', mosaic.score));
  assert.deepEqual(updates.at(-1).ranking.suggestions, result.suggestions);
});

test('name bonuses grow gradually, exclude the common prefix, and stop at six points', () => {
  assert.equal(nameLengthBonus('bufo-facepalm', 0.9), 0);
  assert.equal(nameLengthBonus(`bufo-${'a'.repeat(24)}`, 0.9), MAX_NAME_BONUS / 2);
  assert.equal(nameLengthBonus(`frog-${'a'.repeat(40)}`, 0.9), MAX_NAME_BONUS);
  assert.equal(nameLengthBonus(`bufo-${'a'.repeat(200)}`, 0.9), MAX_NAME_BONUS);
  assert.equal(nameLengthBonus(`bufo-${'a'.repeat(200)}`, 0.49), 0);
  assert.equal(nameLengthBonus(`bufo-${'a'.repeat(200)}`, 0.5), MAX_NAME_BONUS);
});

test('long names win close relevant matches but cannot override stronger relevance or rescue weak matches', async () => {
  const entries = [
    emoji(0, 'bufo-happy'), emoji(1, `bufo-${'interesting-'.repeat(6)}`),
    emoji(2, `bufo-${'unrelated-'.repeat(8)}`), emoji(3, 'bufo-wave')
  ];
  for (const scores of [[0.83, 0.8, 0.1, 0.5], [0.9, 0.8, 0.1, 0.5], [0.5, 0.49, 0.1, 0.3]]) {
    const result = await rankWithJev({
      text: 'Good news', emojis: entries, provider: 'typesafe', apiKey: TEST_KEY,
      fetchImpl: fakeFetch([], filename => scores[entries.findIndex(entry => entry.filename === filename)])
    });
    const expected = scores[0] === 0.83 ? entries[1] : entries[0];
    assert.equal(result.suggestions[0].id, expected.id);
    assert.equal(result.suggestions.at(-1).id, entries[2].id);
    const long = result.suggestions.find(match => match.id === entries[1].id);
    assert.equal(long.score, scores[1]);
    assert.equal(long.nameBonus, scores[1] >= 0.5 ? MAX_NAME_BONUS : 0);
  }
});

test('groups all tiles before the result limit and uses mean relevance with a bonus for the base name only', async () => {
  const tiles = Array.from({ length: 12 }, (_, index) => emoji(index, `bufo-composite_${Math.floor(index / 4)}_${index % 4}`));
  const singles = Array.from({ length: 15 }, (_, index) => emoji(index + 20, `bufo-other-${index}`));
  const entries = [...tiles.toReversed(), ...singles];
  const requests = [];
  const result = await rankWithJev({
    text: 'That is my reaction', emojis: entries, provider: 'typesafe', apiKey: TEST_KEY,
    fetchImpl: fakeFetch(requests, filename => filename.startsWith('bufo-composite_') ? 0.9 : 0.7)
  });
  assert.equal(result.suggestions.length, 12);
  assert.equal(result.evaluatedCount, entries.length);
  assert.equal(result.suggestions[0].id, tiles[0].id);
  assert.equal(result.suggestions.filter(match => tiles.some(tile => tile.id === match.id)).length, 1);
  assert.ok(Math.abs(result.suggestions[0].score - 0.9) < 1e-10);
  assert.equal(result.suggestions[0].nameBonus, nameLengthBonus('bufo-composite', 0.9));
  const questions = requests.flatMap(request => Object.values(request.body.questions));
  assert.equal(questions.length, entries.length);
  assert.ok(questions.filter(question => question.instructions.composite).every(question =>
    question.instructions.composite.name === 'bufo-composite'));
  const outlier = await rankWithJev({
    text: 'A different reaction', emojis: tiles, provider: 'typesafe', apiKey: TEST_KEY,
    fetchImpl: fakeFetch([], filename => filename === tiles[0].filename ? 0.99 : 0.1)
  });
  assert.ok(outlier.suggestions[0].score < 0.2);
  assert.equal(outlier.suggestions[0].nameBonus, 0);
  assert.equal(outlier.weakMatch, true);
});

test('deduplication compares entire mosaic layouts rather than individual tile hashes', async () => {
  const entries = [
    emoji(0, 'bufo-horizontal_0_0'), emoji(1, 'bufo-horizontal_1_0'),
    emoji(2, 'bufo-vertical_0_0'), emoji(3, 'bufo-vertical_0_1'),
    emoji(4, 'bufo-duplicate_1_1'), emoji(5, 'bufo-duplicate_2_1'),
    emoji(6, 'bufo-solo')
  ];
  entries[2].sha = entries[4].sha = entries[6].sha = entries[0].sha;
  entries[3].sha = entries[5].sha = entries[1].sha;
  const result = await rankWithJev({
    text: 'Hello', emojis: entries, provider: 'typesafe', apiKey: TEST_KEY, fetchImpl: fakeFetch()
  });
  assert.equal(result.suggestions.length, 3);
  assert.ok(result.suggestions.some(match => match.id === entries[2].id));
  assert.ok(result.suggestions.some(match => match.id === entries[6].id));
});

test('validates message length, provider allowlist, and key shape before requests', () => {
  for (const input of ['', '  ', null, {}, 'a'.repeat(2001)]) assert.throws(() => validateText(input));
  assert.equal(validateText(' a '), 'a');
  assert.equal(validateText('a'.repeat(2000)).length, 2000);
  for (const provider of ['https://attacker.invalid', '__proto__', 'constructor']) {
    assert.throws(() => validateConnection(provider, TEST_KEY));
  }
  assert.throws(() => validateConnection('typesafe', 'key\r\ninjected'));
  assert.throws(() => validateConnection('typesafe', 'key with spaces'));
});

test('every filename gets its own independent question, including catalogs larger than 255', () => {
  const emojis = catalog(1867).emojis;
  const questions = buildScoringQuestions(emojis, 'typesafe');
  const filenames = Object.values(questions).map(question => question.instructions.filename);
  assert.equal(filenames.length, emojis.length);
  assert.equal(new Set(filenames).size, emojis.length);
  assert.ok(Object.values(questions).every(question => question.type === 'noul'));
  assert.deepEqual(filenames, emojis.map(entry => entry.filename));
});

test('packs one hundred questions per request without dropping or duplicating the remainder', () => {
  const questions = buildScoringQuestions(catalog(MAX_QUESTIONS_PER_REQUEST + 1).emojis, 'typesafe');
  const batches = packQuestions('Hello', questions, 'typesafe');
  assert.deepEqual(batches.map(batch => Object.keys(batch).length), [100, 1]);
  assert.deepEqual(Object.assign({}, ...batches), questions);
  assert.throws(() => packQuestions('Hello', { oversized: { type: 'noul', instructions: 'x'.repeat(MAX_REQUEST_BYTES) } }, 'typesafe'), { code: 'INPUT_TOO_LARGE' });
});

test('bounds the actual serialized requests even with maximum-length names and Unicode messages', async () => {
  const emojis = Array.from({ length: 300 }, (_, index) => emoji(index, `bufo-${index}-${'x'.repeat(180)}`));
  const text = '\u4f60'.repeat(2000);
  for (const provider of ['typesafe', 'vercel']) {
    const scoring = buildScoringQuestions(emojis, provider);
    const batches = packQuestions(text, scoring, provider);
    assert.ok(batches.length > 1);
    const requests = [];
    for (const questions of batches) {
      assert.ok(Object.keys(questions).length <= MAX_QUESTIONS_PER_REQUEST);
      await evaluateQuestions({ text, questions, provider, apiKey: TEST_KEY, fetchImpl: fakeFetch(requests) });
    }
    assert.ok(requests.every(request => Buffer.byteLength(request.options.body) <= MAX_REQUEST_BYTES));
    assert.equal(batches.flatMap(batch => Object.keys(batch)).length, emojis.length);
  }
});

test('scores every actual filename against the entire message, without a shortlist or lexical prefilter', async () => {
  const emojis = catalog(1867).emojis;
  emojis[1800] = emoji(1800, 'bufo-facepalm');
  const requests = [];
  const result = await rankWithJev({
    text: 'payments are broken', emojis, provider: 'typesafe', apiKey: TEST_KEY,
    fetchImpl: fakeFetch(requests, filename => filename === 'bufo-facepalm.png' ? 0.99 : 0.6)
  });
  assert.equal(result.suggestions[0].id, emojis[1800].id);
  assert.equal(result.suggestions[0].score, 0.99);
  assert.equal(result.evaluatedCount, 1867);
  assert.equal(result.requestCount, requests.length);
  assert.ok(result.suggestions.length <= 12);
  const scoredNames = requests.flatMap(request => Object.values(request.body.questions).map(q => q.instructions.filename));
  assert.deepEqual(scoredNames.toSorted(), emojis.map(entry => entry.filename).toSorted());
  assert.ok(requests.every(request => request.body.state.message === 'payments are broken'));
  assert.ok(requests.every(request => Object.values(request.body.questions).every(q => q.type === 'noul')));
  assert.ok(requests.every(request => request.options.headers.Authorization === `Bearer ${TEST_KEY}`));
  assert.ok(requests.every(request => !request.options.body.includes(emojis[200].sha)));
  assert.ok(requests.every(request => !request.options.body.includes('data:image') && !request.options.body.includes('/api/emoji')));
});

test('Vercel uses its evaluation endpoint, exact model ID, and boolean probability shape', async () => {
  const requests = [];
  const result = await rankWithJev({ text: 'Hello', emojis: small, provider: 'vercel', apiKey: TEST_KEY, fetchImpl: fakeFetch(requests) });
  assert.ok(result.suggestions.length);
  assert.ok(requests.every(request => request.url === 'https://ai-gateway.vercel.sh/v1/evaluate'));
  assert.ok(requests.every(request => request.body.model === 'typesafe-ai/jev'));
  assert.ok(requests.some(request => Object.values(request.body.questions)[0].type === 'boolean'));
  assert.equal(result.inputTokens, requests.length * 500);
});

test('only the synthetic filename is sent when checking a new key', async () => {
  const requests = [];
  await verifyConnection({ provider: 'typesafe', apiKey: TEST_KEY, fetchImpl: fakeFetch(requests) });
  assert.equal(requests.length, 1);
  assert.equal(requests[0].body.questions.fit.instructions.filename, 'bufo-thankful.png');
  assert.equal(Object.keys(requests[0].body.questions).length, 1);
});

test('deduplicates identical image assets and marks weak matches honestly', async () => {
  const emojis = [emoji(1, 'bufo-happy'), emoji(1, 'bufo-smile')];
  emojis[1].id = 'different-id';
  const result = await rankWithJev({
    text: 'An obscure topic', emojis, provider: 'typesafe', apiKey: TEST_KEY, fetchImpl: fakeFetch([], () => 0.2)
  });
  assert.equal(result.suggestions.length, 1);
  assert.equal(result.weakMatch, true);
  const zero = await rankWithJev({
    text: 'Unrelated', emojis, provider: 'typesafe', apiKey: TEST_KEY, fetchImpl: fakeFetch([], () => 0)
  });
  assert.equal(zero.suggestions.length, 1);
  assert.equal(zero.suggestions[0].score, 0);
  assert.equal(zero.weakMatch, true);
});

test('rejects malformed and hallucinated model answers', () => {
  const scoring = buildScoringQuestions(small, 'typesafe');
  const valid = answerRequest({ model: 'jev-latest', questions: scoring });
  const corruptions = [
    data => { delete data.answers.e0; },
    data => { data.answers.e0.noul = NaN; },
    data => { data.answers.e0.noul = -0.2; },
    data => { data.answers.e0.noul = 100; },
    data => { data.answers.e0.noul = null; },
    data => { data.answers.e0.type = 'score'; },
    data => { data.model = 'some-other-model'; },
    data => { data.answers = {}; }
  ];
  for (const corrupt of corruptions) {
    const data = structuredClone(valid);
    corrupt(data);
    assert.throws(() => parseEvaluation(data, scoring), { code: 'INVALID_RESPONSE' });
  }
  assert.throws(() => parseEvaluation({ model: 'jev-1.13.0', answers: { fit: { type: 'noul', noul: '0.9' } } }, question));
});

for (const [status, code] of [[401, 'PROVIDER_AUTH'], [403, 'PROVIDER_AUTH'], [402, 'PROVIDER_BILLING'], [429, 'PROVIDER_BUSY'], [529, 'PROVIDER_BUSY'], [500, 'PROVIDER_ERROR']]) {
  test(`surfaces HTTP ${status} without leaking provider response bodies`, async () => {
    await assert.rejects(evaluateQuestions({
      ...options,
      fetchImpl: async () => new Response('sensitive provider detail', { status, headers: { 'retry-after': '7' } })
    }), error => error.code === code && !error.message.includes('sensitive') && (code !== 'PROVIDER_BUSY' || error.retryAfter === 7));
  });
}

test('honors provider cooldown headers on gateway failures without retrying paid work', async () => {
  let calls = 0;
  await assert.rejects(evaluateQuestions({
    ...options,
    fetchImpl: async () => {
      calls += 1;
      return new Response('private upstream error', { status: 520, headers: { 'retry-after': '60' } });
    }
  }), error => error.code === 'PROVIDER_ERROR' && error.retryAfter === 60 && error.message.includes('60 seconds') && !error.message.includes('private'));
  assert.equal(calls, 1);
});

test('network errors, invalid JSON, and timeouts are explicit failures', async () => {
  for (const [fetchImpl, code] of [
    [async () => { throw new TypeError('connection failed'); }, 'PROVIDER_UNREACHABLE'],
    [async () => new Response('not json'), 'INVALID_RESPONSE'],
    [async () => { throw new DOMException('timeout', 'TimeoutError'); }, 'PROVIDER_TIMEOUT']
  ]) {
    await assert.rejects(evaluateQuestions({ ...options, fetchImpl }), { code });
  }
});

test('cancels an active provider request without starting the next stage', async () => {
  const controller = new AbortController();
  const started = deferred();
  let calls = 0;
  const ranking = rankWithJev({
    text: 'Message', emojis: small, provider: 'typesafe', apiKey: TEST_KEY, signal: controller.signal,
    fetchImpl: async (_url, { signal }) => {
      calls += 1;
      started.resolve();
      await new Promise((_, reject) => signal.addEventListener('abort', () => reject(signal.reason), { once: true }));
    }
  });
  await started.promise;
  controller.abort();
  await assert.rejects(ranking, { name: 'AbortError' });
  assert.equal(calls, 1);
});

test('uses the configured concurrency ceiling without exceeding it', async () => {
  let active = 0;
  let maximum = 0;
  await rankWithJev({
    text: 'Message', emojis: catalog(1867).emojis, provider: 'typesafe', apiKey: TEST_KEY,
    fetchImpl: async (_url, { body }) => {
      active += 1;
      maximum = Math.max(maximum, active);
      await new Promise(resolve => setTimeout(resolve, 5));
      active -= 1;
      return Response.json(answerRequest(JSON.parse(body)));
    }
  });
  const batches = packQuestions('Message', buildScoringQuestions(catalog(1867).emojis, 'typesafe'), 'typesafe');
  assert.equal(maximum, Math.min(MAX_PARALLEL_REQUESTS, batches.length));
});

test('a failed batch cancels its peers and fails the whole ranking with the original error', async () => {
  let calls = 0;
  let aborted = 0;
  await assert.rejects(rankWithJev({
    text: 'oops', emojis: catalog(1867).emojis, provider: 'typesafe', apiKey: TEST_KEY,
    fetchImpl: async (_url, { signal }) => {
      calls += 1;
      if (calls === 1) {
        await new Promise(resolve => setImmediate(resolve));
        return new Response('', { status: 402 });
      }
      await new Promise((_, reject) => signal.addEventListener('abort', () => {
        aborted += 1;
        reject(signal.reason);
      }, { once: true }));
    }
  }), { code: 'PROVIDER_BILLING' });
  const batches = packQuestions('oops', buildScoringQuestions(catalog(1867).emojis, 'typesafe'), 'typesafe');
  assert.equal(calls, Math.min(MAX_PARALLEL_REQUESTS, batches.length));
  assert.equal(aborted, calls - 1);
});

test('a missing score never produces a partial success', async () => {
  let calls = 0;
  await assert.rejects(rankWithJev({
    text: 'payments are broken', emojis: catalog(1200).emojis, provider: 'typesafe', apiKey: TEST_KEY,
    fetchImpl: async (_url, { body }) => {
      const request = JSON.parse(body);
      const result = answerRequest(request);
      if (++calls === 2) delete result.answers[Object.keys(request.questions)[0]];
      return Response.json(result);
    }
  }), { code: 'INVALID_RESPONSE' });
});

test('concurrent viewers share the configured evaluation pool through response-body completion', async () => {
  let active = 0;
  let maximum = 0;
  const evaluate = limitEvaluations(evaluateQuestions, MAX_PARALLEL_REQUESTS);
  const fetchImpl = async (_url, { body }) => {
    active += 1;
    maximum = Math.max(maximum, active);
    return {
      ok: true,
      async json() {
        await new Promise(resolve => setTimeout(resolve, 5));
        active -= 1;
        return answerRequest(JSON.parse(body));
      }
    };
  };
  const results = await Promise.all(['First viewer', 'Second viewer', 'Third viewer'].map(text =>
    rankWithJev({ text, emojis: catalog(1200).emojis, provider: 'typesafe', apiKey: TEST_KEY, evaluate, fetchImpl })
  ));
  assert.equal(maximum, MAX_PARALLEL_REQUESTS);
  assert.ok(results.every(result => result.evaluatedCount === 1200));
});

test('cancelling one viewer removes its queued evaluations without affecting another', async () => {
  const controller = new AbortController();
  const gate = deferred();
  const calls = [];
  const evaluate = limitEvaluations(async ({ name }) => {
    calls.push(name);
    await gate.promise;
    return name;
  }, 1);
  const first = evaluate({ name: 'first' });
  const cancelled = evaluate({ name: 'cancelled', signal: controller.signal });
  const rejected = assert.rejects(cancelled, { name: 'AbortError' });
  const last = evaluate({ name: 'last' });
  controller.abort();
  await rejected;
  gate.resolve();
  assert.deepEqual(await Promise.all([first, last]), ['first', 'last']);
  assert.deepEqual(calls, ['first', 'last']);
  await flush();
  assert.equal(await evaluate({ name: 'next' }), 'next');
});
