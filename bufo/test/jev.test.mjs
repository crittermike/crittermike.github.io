import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildScoringQuestions, evaluateQuestions, limitEvaluations,
  MAX_REQUEST_BYTES, packQuestions, parseEvaluation, PROVIDERS, rankWithJev,
  validateConnection, validateText, verifyConnection
} from '../jev.mjs';
import { answerRequest, catalog, deferred, emoji, fakeFetch, flush, TEST_KEY } from './fixtures.mjs';

const small = catalog(12).emojis;
const question = { fit: { type: 'noul', instructions: { question: 'Does this fit?', filename: 'bufo-happy.png' } } };
const options = { text: 'A nice day', provider: 'typesafe', apiKey: TEST_KEY, questions: question };

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

test('bounds context size even with maximum-length names and Unicode messages', () => {
  const emojis = Array.from({ length: 300 }, (_, index) => emoji(index, `bufo-${index}-${'x'.repeat(180)}`));
  const text = '\u4f60'.repeat(2000);
  for (const provider of ['typesafe', 'vercel']) {
    const scoring = buildScoringQuestions(emojis, provider);
    const batches = packQuestions(text, scoring, provider);
    assert.ok(batches.length > 1);
    for (const questions of batches) {
      const body = { model: PROVIDERS[provider].model, state: { message: text }, questions };
      assert.ok(Buffer.byteLength(JSON.stringify(body)) < MAX_REQUEST_BYTES);
    }
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

test('never runs more than three provider requests concurrently', async () => {
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
  assert.ok(maximum <= 3);
  assert.ok(maximum > 1);
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
  assert.equal(calls, 3);
  assert.equal(aborted, 2);
});

test('a missing score never produces a partial success', async () => {
  let calls = 0;
  await assert.rejects(rankWithJev({
    text: 'payments are broken', emojis: catalog(100).emojis, provider: 'typesafe', apiKey: TEST_KEY,
    fetchImpl: async (_url, { body }) => {
      const request = JSON.parse(body);
      const result = answerRequest(request);
      if (++calls === 2) delete result.answers[Object.keys(request.questions)[0]];
      return Response.json(result);
    }
  }), { code: 'INVALID_RESPONSE' });
});

test('concurrent viewers share a three-evaluation pool through response-body completion', async () => {
  let active = 0;
  let maximum = 0;
  const evaluate = limitEvaluations(evaluateQuestions, 3);
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
    rankWithJev({ text, emojis: catalog(200).emojis, provider: 'typesafe', apiKey: TEST_KEY, evaluate, fetchImpl })
  ));
  assert.equal(maximum, 3);
  assert.ok(results.every(result => result.evaluatedCount === 200));
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
