'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { expected } = require('./study.test.cjs');

// Minimal DOM/Web Audio boundary doubles. Actual layout and native input are
// verified separately in the owner's visible Mac Chrome, never headless Chrome.
function boot({ storageFails = false, reduced = false, audioFails = false } = {}) {
  class Element {
    constructor() { this.children = []; this.attrs = {}; this.style = { setProperty(k,v) { this[k] = v; } }; this.dataset = {}; this.textContent = ''; this.hidden = false; this.disabled = false; this.listeners = {}; this.className = ''; }
    setAttribute(k, v) { this.attrs[k] = String(v); }
    getAttribute(k) { return this.attrs[k]; }
    append(...nodes) { this.children.push(...nodes); }
    replaceChildren(...nodes) { this.children = nodes; }
    addEventListener(k, f) { this.listeners[k] = f; }
    click() { if (!this.disabled && !this.hidden) this.listeners.click?.({ currentTarget: this }); }
    focus() { doc.activeElement = this; }
    remove() { this.removed = true; }
  }
  const elements = {};
  const doc = { activeElement: null, getElementById: id => elements[id] ||= new Element(), createElement: () => new Element() };
  const audio = { created: 0, resumed: 0, started: 0, stopped: 0 };
  class AudioContext {
    constructor() { if (audioFails) throw Error('unavailable'); audio.created++; this.currentTime = 0; this.state = 'suspended'; this.destination = {}; }
    resume() { audio.resumed++; this.state = 'running'; return Promise.resolve(); }
    createOscillator() { return { frequency: { setValueAtTime() {} }, connect() {}, disconnect() {}, start() { audio.started++; }, stop() { audio.stopped++; } }; }
    createGain() { return { gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect() {}, disconnect() {} }; }
  }
  const storage = {};
  const context = vm.createContext({ document: doc, console, setTimeout: () => 1, clearTimeout() {}, AudioContext, matchMedia: () => ({ matches: reduced }), localStorage: {
    getItem(k) { if (storageFails) throw Error('blocked'); return storage[k] ?? null; },
    setItem(k,v) { if (storageFails) throw Error('blocked'); storage[k] = String(v); }
  } });
  context.window = context;
  const html = fs.readFileSync(`${__dirname}/index.html`, 'utf8');
  assert.match(html, /<script id="ui">/, 'interactive UI exists');
  for (const script of html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)) vm.runInContext(script[1], context);
  return { elements, audio, storage, doc };
}
function chooseCorrect(elements) {
  const id = elements.question.dataset.concept;
  for (const button of elements.options.children) if (expected[id].includes(button.dataset.answer)) button.click();
}

test('UI starts immediately, requires two selections, locks scoring and moves keyboard focus', () => {
  const { elements: e, audio, doc } = boot();
  assert.ok(e.question.textContent.length > 10);
  assert.equal(audio.created, 0, 'no audio before a user gesture');
  assert.equal(e.check.disabled, true);
  const seen = [];
  for (let i = 0; i < 15; i++) {
    seen.push(e.question.dataset.concept);
    const correct = e.options.children.filter(b => expected[e.question.dataset.concept].includes(b.dataset.answer));
    correct[0].click();
    if (correct.length === 2) {
      assert.equal(e.check.disabled, true);
      correct[0].click();
      assert.equal(correct[0].getAttribute('aria-pressed'), 'false');
      correct[0].click(); correct[1].click();
    }
    assert.equal(e.check.disabled, false);
    e.check.click();
    const score = e.score.textContent;
    e.check.click(); e.options.children[0].click();
    assert.equal(e.score.textContent, score);
    assert.equal(doc.activeElement, e.next);
    assert.match(e.feedback.textContent, /\+/);
    e.next.click();
  }
  assert.equal(new Set(seen).size, 15);
  assert.equal(e.summary.hidden, false);
  assert.equal(e.score.textContent, '180');
  assert.match(e['final-first'].textContent, /15.*15/);
  assert.ok(e.confetti.children.length > 0);
  e.replay.click();
  assert.equal(e.score.textContent, '0');
  assert.equal(e.streak.textContent, '0');
  assert.equal(e.summary.hidden, true);
  assert.equal(e.check.disabled, true);
  assert.equal(e.confetti.children.length, 0);
});

test('muting cancels voices, unmuting requires a gesture, and audio failures do not block play', () => {
  const { elements: e, audio } = boot();
  e.sound.click();
  assert.equal(e.sound.getAttribute('aria-pressed'), 'false');
  chooseCorrect(e); e.check.click();
  assert.equal(audio.created, 0);
  e.next.click(); e.sound.click();
  assert.equal(e.sound.getAttribute('aria-pressed'), 'true');
  chooseCorrect(e); e.check.click();
  assert.ok(audio.resumed > 0);
  assert.ok(audio.started > 0);
  const before = audio.started;
  e.sound.click();
  assert.ok(audio.stopped >= before);
  e.next.click(); chooseCorrect(e); e.check.click();
  assert.equal(audio.started, before);
  const failed = boot({ audioFails: true });
  chooseCorrect(failed.elements); failed.elements.check.click();
  assert.equal(failed.elements.score.textContent, '10');
});

test('blocked storage and reduced motion preserve full gameplay and replay', () => {
  const { elements: e } = boot({ storageFails: true, reduced: true });
  for (let i = 0; i < 15; i++) { chooseCorrect(e); e.check.click(); e.next.click(); }
  assert.equal(e.score.textContent, '180');
  assert.equal(e.summary.hidden, false);
  assert.equal(e.confetti.children.length, 0);
  e.replay.click();
  assert.equal(e.score.textContent, '0');
});
