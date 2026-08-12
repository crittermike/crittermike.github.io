(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.AssignmentLongPress = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  function normalizeTodoState(value, date) {
    const source = value && typeof value === 'object' ? value : {};
    if (source.date !== date) return { date: date, checks: {}, dismissed: {} };
    return {
      date: date,
      checks: source.checks && typeof source.checks === 'object' ? source.checks : {},
      dismissed: source.dismissed && typeof source.dismissed === 'object' ? source.dismissed : {},
    };
  }

  function dismissTodo(state, key) {
    if (!state.dismissed || typeof state.dismissed !== 'object') state.dismissed = {};
    state.dismissed[key] = true;
    if (state.checks) delete state.checks[key];
    return state;
  }

  function updateStoredTodoState(storage, storageKey, date, update) {
    let value = {};
    try { value = JSON.parse(storage.getItem(storageKey) || '{}'); } catch (error) {}
    const state = normalizeTodoState(value, date);
    update(state);
    storage.setItem(storageKey, JSON.stringify(state));
    return state;
  }

  function syncTodoCopies(root, key, checked) {
    root.querySelectorAll('.assn-list .todo input[type="checkbox"]').forEach(function (box) {
      const boxKey = box.dataset.kid + '|' + box.dataset.id;
      if (boxKey === key) box.checked = checked;
    });
  }

  function bindLongPress(target, onLongPress, options) {
    const opts = options || {};
    const delay = opts.delay == null ? 700 : opts.delay;
    const moveTolerance = opts.moveTolerance == null ? 12 : opts.moveTolerance;
    const setTimer = opts.setTimer || setTimeout;
    const clearTimer = opts.clearTimer || clearTimeout;
    let timer = null;
    let startX = 0;
    let startY = 0;
    let fired = false;

    function cancel() {
      if (timer != null) clearTimer(timer);
      timer = null;
    }

    function pointerDown(event) {
      if (event.button != null && event.button !== 0) return;
      cancel();
      fired = false;
      startX = event.clientX || 0;
      startY = event.clientY || 0;
      timer = setTimer(function () {
        timer = null;
        fired = true;
        onLongPress(event);
      }, delay);
    }

    function pointerMove(event) {
      if (timer == null) return;
      const dx = (event.clientX || 0) - startX;
      const dy = (event.clientY || 0) - startY;
      if (Math.hypot(dx, dy) > moveTolerance) cancel();
    }

    function click(event) {
      if (!fired) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      fired = false;
    }

    function contextMenu(event) {
      if (timer != null || fired) event.preventDefault();
    }

    target.addEventListener('pointerdown', pointerDown);
    target.addEventListener('pointermove', pointerMove);
    target.addEventListener('pointerup', cancel);
    target.addEventListener('pointercancel', cancel);
    target.addEventListener('pointerleave', cancel);
    target.addEventListener('click', click, true);
    target.addEventListener('contextmenu', contextMenu);

    return function unbind() {
      cancel();
      target.removeEventListener('pointerdown', pointerDown);
      target.removeEventListener('pointermove', pointerMove);
      target.removeEventListener('pointerup', cancel);
      target.removeEventListener('pointercancel', cancel);
      target.removeEventListener('pointerleave', cancel);
      target.removeEventListener('click', click, true);
      target.removeEventListener('contextmenu', contextMenu);
    };
  }

  return {
    normalizeTodoState: normalizeTodoState,
    dismissTodo: dismissTodo,
    updateStoredTodoState: updateStoredTodoState,
    syncTodoCopies: syncTodoCopies,
    bindLongPress: bindLongPress,
  };
});
