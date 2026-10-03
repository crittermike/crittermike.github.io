import { createHash } from 'node:crypto';
import { SOURCE_REPO } from '../catalog.mjs';

export const TEST_KEY = 'test-key-not-a-real-credential';

export function imageBytes(index = 0) {
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), Buffer.from(String(index))]);
}

export function emoji(index, name = `bufo-example-${index}`) {
  const bytes = imageBytes(index);
  return {
    id: index.toString(16).padStart(20, '0'),
    name,
    filename: `${name}.png`,
    sha: createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex'),
    extension: 'png',
    size: bytes.length
  };
}

export function catalog(count = 20) {
  return {
    version: 1,
    source: SOURCE_REPO,
    syncedAt: '2026-09-30T12:00:00.000Z',
    emojis: Array.from({ length: count }, (_, index) => emoji(index))
  };
}

export function answerRequest(body, score = () => 0.8) {
  const answers = {};
  for (const [key, question] of Object.entries(body.questions)) {
    if (question.type === 'choice') {
      const entries = Object.entries(question.criteria);
      const total = entries.reduce((sum, [, filename]) => sum + score(filename), 0);
      const probabilities = Object.fromEntries(entries.map(([option, filename]) => [option, total ? score(filename) / total : 1 / entries.length]));
      answers[key] = {
        type: 'choice',
        choice: Object.keys(probabilities).sort((a, b) => probabilities[b] - probabilities[a])[0],
        probabilities,
        confidence: 0.7
      };
    } else {
      const value = score(question.instructions.filename);
      answers[key] = question.type === 'noul' ? { type: 'noul', noul: value } : { type: 'boolean', probability: value };
    }
  }
  return {
    model: body.model === 'jev-latest' ? 'jev-1.13.0' : body.model,
    answers,
    usage: body.model === 'jev-latest' ? { input_tokens: 500, output_tokens: 0 } : { inputTokens: 500, outputTokens: 0 }
  };
}

export function fakeFetch(requests = [], score) {
  return async (url, options) => {
    const body = JSON.parse(options.body);
    requests.push({ url, options, body });
    return Response.json(answerRequest(body, score));
  };
}

export function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

export const flush = () => new Promise(resolve => setImmediate(resolve));
