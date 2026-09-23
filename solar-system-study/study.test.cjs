'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const file = path.join(__dirname, 'index.html');
// Independent lesson oracle: never derive expected answers from the game bank.
const expected = {
  rotation: ['Earth’s rotation'],
  sunlight: ['Light', 'Heat'],
  seasons: ['The tilt of Earth’s axis', 'Earth’s orbit around the Sun'],
  'moon-observation': ['Rocks and a thick layer of dust'],
  spacesuits: ['Air to breathe', 'Protection from too much heat or cold'],
  astronomers: ['Astronomers'],
  telescope: ['Telescope'],
  sun: ['The Sun'],
  plasma: ['Plasma'],
  sunspots: ['Sunspots'],
  axis: ['Axis'],
  'orbit-time': ['365 1/4 days'],
  hemispheres: ['Winter'],
  'near-side': ['Near side'],
  craters: ['Craters']
};
function load() {
  assert.ok(fs.existsSync(file), 'the standalone game exists');
  const html = fs.readFileSync(file, 'utf8');
  const engine = html.match(/<script id="engine">([\s\S]*?)<\/script>/);
  assert.ok(engine, 'testable game engine exists');
  const context = vm.createContext({});
  vm.runInContext(engine[1], context);
  return context.SpaceStudy;
}
const plain = x => JSON.parse(JSON.stringify(x));
function answers(q) { return q.options.filter(o => expected[q.id].includes(o.text)).map(o => o.id); }

test('all 15 lesson concepts have independently correct, unique answers', () => {
  const { bank } = load();
  assert.equal(bank.length, 15);
  assert.deepEqual(plain(bank.map(q => q.id)).sort(), Object.keys(expected).sort());
  for (const q of bank) {
    assert.equal(new Set(q.options.map(o => o.id)).size, q.options.length, q.id);
    assert.equal(new Set(q.options.map(o => o.text)).size, q.options.length, q.id);
    assert.deepEqual(plain(q.options.filter(o => q.answers.includes(o.id)).map(o => o.text)).sort(), [...expected[q.id]].sort(), q.id);
    assert.equal(q.pick, expected[q.id].length, q.id);
    assert.ok(q.explanation.length > 15 && q.explanation.length < 240);
  }
  const byId = Object.fromEntries(bank.map(q => [q.id, q]));
  assert.match(byId.seasons.explanation, /not.*distance/i);
  assert.match(byId['moon-observation'].prompt, /astronauts/i);
  assert.doesNotMatch(byId['moon-observation'].explanation, /astronomers|centimeter|inch|meter/i);
  assert.match(byId.sunspots.explanation, /cooler.*surrounding/i);
  assert.match(byId['orbit-time'].explanation, /365\.25/);
});
test('a first-pass round scores once, counts mastery separately and awards streak bonuses', () => {
  const api = load();
  assert.equal(typeof api.createGame, 'function', 'playable game state exists');
  const game = api.createGame(() => 0.5);
  assert.equal(game.state.score, 0);
  assert.equal(game.next(), false, 'cannot skip unanswered question');
  assert.equal(game.check().status, 'incomplete');
  let awarded = 0;
  for (let i = 0; i < 15; i++) {
    const q = game.current();
    const ids = answers(q);
    ids.forEach(id => game.select(id));
    const result = game.check();
    assert.equal(result.correct, true, q.id);
    const bonus = i + 1 === 3 ? 5 : i + 1 === 5 ? 10 : i + 1 === 7 ? 15 : 0;
    assert.equal(result.bonus, bonus);
    assert.equal(result.points, 10 + bonus);
    awarded += 10 + bonus;
    assert.equal(game.check().status, 'locked');
    game.select(q.options[0].id);
    assert.equal(game.state.score, awarded, 'repeated taps do not score again');
    game.next();
  }
  assert.equal(game.state.score, 180);
  assert.equal(game.state.firstPassCorrect, 15);
  assert.equal(game.state.mastered.size, 15);
  assert.equal(game.state.phase, 'done');
  assert.equal(game.next(), false);
});

test('misses reset streak and return in review without inflating first-pass mastery', () => {
  const game = load().createGame(() => 0.999);
  const missed = [];
  for (let i = 0; i < 15; i++) {
    const q = game.current();
    if (i === 3 || i === 7) {
      missed.push(q.id);
      q.options.filter(o => !expected[q.id].includes(o.text)).slice(0, q.pick).forEach(o => game.select(o.id));
      assert.equal(game.check().correct, false);
      assert.equal(game.state.streak, 0);
      assert.equal(game.state.mastered.has(q.id), false);
    } else { answers(q).forEach(id => game.select(id)); game.check(); }
    game.next();
  }
  assert.equal(game.state.phase, 'review');
  assert.equal(game.state.firstPassCorrect, 13);
  assert.deepEqual(plain(game.state.queue.map(q => q.id)).sort(), missed.sort());
  const before = game.state.score;
  for (let i = 0; i < 2; i++) {
    const q = game.current();
    answers(q).forEach(id => game.select(id));
    const r = game.check();
    assert.equal(r.points, 5);
    assert.equal(r.bonus, 0);
    assert.equal(game.check().status, 'locked');
    game.next();
  }
  assert.equal(game.state.score, before + 10);
  assert.equal(game.state.firstPassCorrect, 13);
  assert.equal(game.state.mastered.size, 15);
  assert.equal(game.state.phase, 'done');
});

test('all two-answer questions reject incomplete or mixed sets and accept both facts', () => {
  for (const target of ['sunlight', 'seasons', 'spacesuits']) {
    const game = load().createGame(() => 0.999);
    while (game.current().id !== target) {
      answers(game.current()).forEach(id => game.select(id)); game.check(); game.next();
    }
    const q = game.current(), correct = answers(q);
    game.select(correct[0]);
    const before = game.state.score;
    assert.equal(game.check().status, 'incomplete');
    assert.equal(game.state.score, before);
    game.select('not-an-option');
    assert.equal(game.state.selected.size, 1);
    const wrong = q.options.find(o => !expected[target].includes(o.text)).id;
    game.select(wrong);
    assert.equal(game.check().correct, false);
    assert.equal(game.state.score, before);
    assert.equal(game.state.streak, 0);
  }
});

test('repeated review misses cost no points and replay resets the entire session', () => {
  const game = load().createGame(() => 0.999);
  const missedId = game.current().id;
  for (let i = 0; i < 15; i++) {
    const q = game.current();
    (i === 0 ? [q.options.find(o => !expected[q.id].includes(o.text)).id] : answers(q)).forEach(id => game.select(id));
    game.check(); game.next();
  }
  for (let i = 0; i < 3; i++) {
    const score = game.state.score, q = game.current();
    assert.equal(q.id, missedId);
    game.select(q.options.find(o => !expected[q.id].includes(o.text)).id);
    game.check(); game.next();
    assert.equal(game.state.score, score);
    assert.equal(game.state.firstPassCorrect, 14);
    assert.equal(game.state.phase, 'review');
  }
  answers(game.current()).forEach(id => game.select(id)); game.check(); game.next();
  assert.equal(game.state.phase, 'done');
  game.reset();
  assert.equal(game.state.score, 0);
  assert.equal(game.state.streak, 0);
  assert.equal(game.state.firstPassCorrect, 0);
  assert.equal(game.state.mastered.size, 0);
  assert.equal(game.state.selected.size, 0);
  assert.equal(game.state.phase, 'first');
  assert.equal(game.state.index, 0);
});

test('seeded sessions shuffle questions and choices without losing concept coverage', () => {
  const api = load(), orders = new Set(), options = new Set();
  for (let seed = 1; seed <= 100; seed++) {
    let n = seed;
    const random = () => ((n = (Math.imul(n, 1664525) + 1013904223) >>> 0) / 4294967296);
    const game = api.createGame(random);
    orders.add(game.state.queue.map(q => q.id).join(','));
    assert.equal(new Set(game.state.queue.map(q => q.id)).size, 15);
    for (let i = 0; i < 15; i++) {
      const q = game.current();
      options.add(q.options.map(o => o.id).join(','));
      answers(q).forEach(id => game.select(id));
      assert.equal(game.check().correct, true);
      game.next();
    }
    assert.equal(game.state.score, 180);
  }
  assert.ok(orders.size > 90);
  assert.ok(options.size > 6);
});

test('streak milestones pay once per mission, so intentional misses cannot beat a perfect run', () => {
  const game = load().createGame(() => .999);
  for (let i = 0; i < 15; i++) {
    const q = game.current();
    (i === 7 ? [q.options.find(o => !expected[q.id].includes(o.text)).id] : answers(q)).forEach(id => game.select(id));
    game.check(); game.next();
  }
  answers(game.current()).forEach(id => game.select(id)); game.check(); game.next();
  assert.equal(game.state.score, 14 * 10 + 30 + 5);
  assert.ok(game.state.score < 180);
  game.reset();
  for (let i = 0; i < 15; i++) { answers(game.current()).forEach(id => game.select(id)); game.check(); game.next(); }
  assert.equal(game.state.score, 180, 'replay restores milestone eligibility');
});

module.exports = { expected, answers, load };
