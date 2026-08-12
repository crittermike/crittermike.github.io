const test = require('node:test');
const assert = require('node:assert/strict');

const {
  normalizeTodoState,
  dismissTodo,
  bindLongPress,
} = require('../src/assets/assignment-long-press.js');

function fakeTarget() {
  const listeners = new Map();
  return {
    addEventListener(type, fn) {
      if (!listeners.has(type)) listeners.set(type, []);
      listeners.get(type).push(fn);
    },
    removeEventListener(type, fn) {
      listeners.set(type, (listeners.get(type) || []).filter(x => x !== fn));
    },
    dispatch(type, extra = {}) {
      const event = {
        button: 0,
        pointerId: 1,
        clientX: 10,
        clientY: 10,
        preventDefault() {},
        stopImmediatePropagation() {},
        ...extra,
      };
      for (const fn of listeners.get(type) || []) fn(event);
      return event;
    },
  };
}

test('normalizeTodoState preserves checks and dismissed tasks for the same ET date', () => {
  const state = normalizeTodoState({
    date: '2026-08-12',
    checks: { 'thomas|math': true },
    dismissed: { 'henry|reading': true },
  }, '2026-08-12');

  assert.deepEqual(state, {
    date: '2026-08-12',
    checks: { 'thomas|math': true },
    dismissed: { 'henry|reading': true },
  });
});

test('normalizeTodoState resets checks and dismissed tasks on a new ET date', () => {
  const state = normalizeTodoState({
    date: '2026-08-11',
    checks: { 'thomas|math': true },
    dismissed: { 'henry|reading': true },
  }, '2026-08-12');

  assert.deepEqual(state, { date: '2026-08-12', checks: {}, dismissed: {} });
});

test('dismissTodo records only the selected kid and task', () => {
  const state = { date: '2026-08-12', checks: {}, dismissed: {} };
  dismissTodo(state, 'william|laundry-friday');

  assert.deepEqual(state.dismissed, { 'william|laundry-friday': true });
});

test('bindLongPress fires after the hold delay and suppresses the following click', () => {
  const target = fakeTarget();
  const timers = [];
  let calls = 0;
  let clickPrevented = false;
  let clickStopped = false;

  bindLongPress(target, () => { calls += 1; }, {
    setTimer(fn) { timers.push(fn); return timers.length; },
    clearTimer() {},
  });

  target.dispatch('pointerdown');
  timers[0]();
  target.dispatch('click', {
    preventDefault() { clickPrevented = true; },
    stopImmediatePropagation() { clickStopped = true; },
  });

  assert.equal(calls, 1);
  assert.equal(clickPrevented, true);
  assert.equal(clickStopped, true);
});

test('bindLongPress cancels when the pointer moves', () => {
  const target = fakeTarget();
  let pending = null;
  let calls = 0;

  bindLongPress(target, () => { calls += 1; }, {
    setTimer(fn) { pending = fn; return 1; },
    clearTimer() { pending = null; },
  });

  target.dispatch('pointerdown');
  target.dispatch('pointermove', { clientX: 30, clientY: 10 });
  if (pending) pending();

  assert.equal(calls, 0);
});
