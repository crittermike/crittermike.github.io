// The answer area for each question type. A type draws its buttons into the box, takes taps and keys, marks its own
// buttons right or wrong, and calls ctx.done(right, why) exactly once.
//   choice: 4 buttons (the right answer and 3 random wrong ones)
//   tap:    an equation in tiles; tap the right number (any of q.answer)
//   multi:  tap every right option; one wrong tap ends it
//   build:  fill the blanks of an equation from a tray of tiles, then check
//   sort:   items come one at a time; tap the right one of two bins
import { icon } from './ui.js';

const shuffle = a => { a = [...a]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
function make(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}
function button(cls, text, onTap) {
  const b = make('button', cls, text);
  b.addEventListener('click', onTap);
  return b;
}
// Marks the picked button and, after a wrong pick, shows the right ones a moment later.
function markPick(btns, picked, rightSet, right) {
  btns[picked].classList.add(right ? 'right' : 'wrong');
  btns.forEach((b, k) => {
    if (k === picked) return;
    if (!right && rightSet.has(k)) setTimeout(() => b.classList.add('right'), 350);
    else b.classList.add('dim');
  });
}
const numberKey = (k, n) => (/^[1-9]$/.test(k) && Number(k) <= n ? Number(k) - 1 : -1);

function choice(q, box, ctx) {
  const answers = shuffle([q.a, ...shuffle(q.wrong).slice(0, 3)]);
  const btns = answers.map((a, i) => button('btn ans', a, () => pick(i)));
  box.append(...btns);
  function pick(i) {
    if (!ctx.ready()) return;
    const right = answers[i] === q.a;
    markPick(btns, i, new Set([answers.indexOf(q.a)]), right);
    ctx.done(right);
  }
  return { read: () => answers, readEls: btns, key: k => { const i = numberKey(k, btns.length); if (i >= 0) pick(i); return i >= 0; } };
}

const isNumber = s => /\d/.test(s);

function tap(q, box, ctx) {
  const row = make('div', 'eq');
  const nums = [];
  const tiles = q.parts.map((p, i) => {
    if (!isNumber(p)) return make('span', 'tile sign', p);
    nums.push(i);
    return button('tile num', p, () => pick(i));
  });
  row.append(...tiles);
  box.append(row);
  function pick(i) {
    if (!ctx.ready()) return;
    const right = q.answer.includes(i);
    const numTiles = nums.map(k => tiles[k]);
    markPick(numTiles, nums.indexOf(i), new Set(q.answer.map(k => nums.indexOf(k))), right);
    ctx.done(right);
  }
  return { read: () => [], key: k => { const i = numberKey(k, nums.length); if (i >= 0) pick(nums[i]); return i >= 0; } };
}

function pips(n) {
  const p = make('div', 'pips');
  for (let i = 0; i < n; i++) p.append(make('i'));
  return p;
}

function multi(q, box, ctx) {
  const found = new Set(), want = new Set(q.correct);
  const dots = pips(want.size);
  const grid = make('div', 'grid n' + q.options.length);
  const btns = q.options.map((o, i) => button('btn ans', o, () => pick(i)));
  grid.append(...btns);
  box.append(dots, grid);
  function pick(i) {
    if (!ctx.ready() || found.has(i)) return;
    if (want.has(i)) {
      found.add(i);
      btns[i].classList.add('right');
      dots.children[found.size - 1].classList.add('on');
      if (found.size < want.size) { ctx.sfx('coin'); return; }
      btns.forEach((b, k) => { if (!found.has(k)) b.classList.add('dim'); });
      ctx.done(true);
      return;
    }
    btns[i].classList.add('wrong');
    btns.forEach((b, k) => {
      if (k === i || found.has(k)) return;
      if (want.has(k)) setTimeout(() => b.classList.add('right'), 350);
      else b.classList.add('dim');
    });
    ctx.done(false);
  }
  return { read: () => q.options, readEls: btns, key: k => { const i = numberKey(k, btns.length); if (i >= 0) pick(i); return i >= 0; } };
}

function build(q, box, ctx) {
  const blanks = q.slots.map((s, i) => (s === null ? i : -1)).filter(i => i >= 0);
  const fill = new Map();
  const row = make('div', 'eq');
  const cells = q.slots.map((s, i) => {
    if (s !== null) return make('span', isNumber(s) ? 'tile given' : 'tile sign', s);
    return button('tile blank', '', () => clear(i));
  });
  const check = button('btn check', '', submit);
  check.append(icon('check'));
  check.setAttribute('aria-label', 'Check');
  row.append(...cells);
  const tray = make('div', 'tray');
  const tiles = q.tiles.map(t => button('btn ans tile-btn', t, () => put(t)));
  tray.append(...tiles);
  const foot = make('div', 'b-foot');
  foot.append(tray, check);
  box.append(row, foot);
  const nextBlank = () => blanks.find(i => !fill.has(i));
  function update() {
    const next = nextBlank();
    cells.forEach((c, i) => c.classList.toggle('next', i === next));
    check.classList.toggle('ready', next === undefined);
  }
  function put(t) {
    if (!ctx.ready()) return;
    const at = nextBlank();
    if (at === undefined) return;
    fill.set(at, t);
    cells[at].textContent = t;
    cells[at].classList.add('filled');
    ctx.sfx('click');
    update();
  }
  function clear(i) {
    if (!ctx.ready() || !fill.has(i)) return;
    fill.delete(i);
    cells[i].textContent = '';
    cells[i].classList.remove('filled');
    ctx.sfx('swoosh');
    update();
  }
  function submit() {
    if (!ctx.ready() || nextBlank() !== undefined) return;
    const got = blanks.map(i => fill.get(i));
    const right = q.solutions.some(s => s.every((v, k) => v === got[k]));
    check.classList.remove('ready');
    tiles.forEach(b => b.classList.add('dim'));
    if (right) blanks.forEach(i => cells[i].classList.add('right'));
    else {
      blanks.forEach(i => cells[i].classList.add('wrong'));
      setTimeout(() => blanks.forEach((i, k) => {
        cells[i].textContent = q.solutions[0][k];
        cells[i].classList.remove('wrong');
        cells[i].classList.add('right');
      }), 700);
    }
    ctx.done(right);
  }
  update();
  return {
    read: () => [q.slots.map((s, i) => s ?? fill.get(i) ?? '__').join(' ')],
    key: k => {
      if (k === 'Enter') { submit(); return true; }
      if (k === 'Backspace') { const last = [...fill.keys()].pop(); if (last !== undefined) clear(last); return true; }
      const i = numberKey(k, tiles.length);
      if (i >= 0) put(q.tiles[i]);
      return i >= 0;
    },
  };
}

function sort(q, box, ctx) {
  let at = 0, busy = false;
  const dots = pips(q.items.length);
  const card = make('div', 'sort-card');
  const bins = q.bins.map((name, b) => button('btn ans bin', name, () => pick(b)));
  const row = make('div', 'sort-row');
  row.append(bins[0], card, bins[1]);
  box.append(dots, row);
  function showItem() {
    const label = q.items[at].label;
    card.textContent = label;
    card.classList.toggle('long', label.length > 7);
    card.classList.remove('in', 'to-0', 'to-1');
    void card.offsetWidth;
    card.classList.add('in');
  }
  function pick(b) {
    if (!ctx.ready() || busy || at >= q.items.length) return;
    const it = q.items[at];
    if (it.bin !== b) {
      card.classList.add('wrong');
      bins[b].classList.add('wrong');
      setTimeout(() => bins[it.bin].classList.add('right'), 350);
      ctx.done(false, it.why);
      return;
    }
    dots.children[at].classList.add('on');
    card.classList.add('to-' + b);
    at++;
    if (at === q.items.length) { bins[b].classList.add('right'); ctx.done(true); return; }
    ctx.sfx('coin');
    busy = true;
    setTimeout(() => { busy = false; showItem(); ctx.onItem(q.items[at].label); }, 280);
  }
  showItem();
  return {
    read: () => [q.items[Math.min(at, q.items.length - 1)].label],
    readEls: [],
    key: k => {
      if (k === 'ArrowLeft' || k === '1') { pick(0); return true; }
      if (k === 'ArrowRight' || k === '2') { pick(1); return true; }
      return false;
    },
  };
}

const KINDS = { choice, tap, multi, build, sort };

// ctx: { ready() -> bool, done(right, why), sfx(name), onItem(label) }
export function mountAnswers(q, box, ctx) {
  const type = q.type || 'choice';
  box.replaceChildren();
  box.className = 'k-' + type;
  return KINDS[type](q, box, ctx);
}
