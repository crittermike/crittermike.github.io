// Critter Run: a 3D runner where each test is a level and each question is a gate on the trail.
import * as THREE from 'three';
import { makeHero, makeChaser } from './models.js';
import { World, LANE } from './world.js';
import { FX } from './fx.js';
import { Sound } from './audio.js';
import { CHASER_EMOJI } from './catalog.js';

const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const damp = (a, b, rate, dt) => a + (b - a) * (1 - Math.exp(-rate * dt));
const shuffle = a => { a = [...a]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

const BASE_SPEED = 9.5, SPEED_GAIN = 0.005, MAX_GAIN = 4;
const GRAVITY = 26, JUMP_V = 9.4;
const MAX_HEARTS = 5;
const GATE_FIRST = 70, GATE_GAP = 105;
const SEGMENT = 160; // length of each region in the final run
const CHASE_D = 10; // how far behind the chaser normally runs (just behind the camera, so it never blocks the path)

// ---------- save ----------
const SAVE_KEY = 'critter-run-v1';
const S = (() => {
  let s = {};
  try { s = JSON.parse(localStorage.getItem(SAVE_KEY)) || {}; } catch { s = {}; }
  return { coins: 0, stars: {}, missed: {}, hinted: false, ...s, settings: { music: true, sfx: true, autoRead: false, ...(s.settings || {}) } };
})();
const save = () => { try { localStorage.setItem(SAVE_KEY, JSON.stringify(S)); } catch { /* private mode */ } };

// ---------- levels ----------
const ALL = (window.CritterRun && window.CritterRun.levels) || [];
const only = new URLSearchParams(location.search).get('level');
const LEVELS = only && ALL.some(l => l.id === only) ? ALL.filter(l => l.id === only) : ALL;
const stageKey = (level, i) => `${level.id}:${i}`;
const qKey = (level, q) => `${level.id}|${q.show || ''}|${q.q}`;
const isOpen = (level, i) => i === 0 || (S.stars[stageKey(level, i - 1)] || 0) > 0;

// ---------- renderer ----------
const canvas = $('#game');
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
} catch (e) {
  $('#loading').innerHTML = '<div class="nogl">😢<br>This game needs WebGL.<br>Try Chrome or Safari.</div>';
  throw e;
}
let pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
renderer.setPixelRatio(pixelRatio);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 1500);
const fx = new FX(scene);
const world = new World(scene, fx);
const sound = new Sound(S.settings);

function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h);
  camera.aspect = w / h;
  camera.fov = w / h < 0.8 ? 70 : 58;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
resize();

// ---------- actors ----------
const hero = makeHero();
scene.add(hero.root);
const chasers = {};
function chaserModel(type) {
  if (!chasers[type]) chasers[type] = makeChaser(type);
  return chasers[type];
}

// ---------- game state ----------
const G = {
  mode: 'title', t: 0, clock: 0,
  level: null, stageIdx: 0, stage: null, tour: false, segments: [],
  h: { dist: 0, lane: 0, x: 0, y: 0, vy: 0, ground: true, slow: 1, inv: 0, dustT: 0 },
  c: { d: 4, x: 0, spin: -1, model: null, type: null, roarT: 0 },
  hearts: MAX_HEARTS, coins: 0, wrong: 0, correct: 0, needed: 0,
  queue: [], extra: [], extraPlaced: 0, baseLeft: 0, nextGate: GATE_FIRST, planned: 0,
  current: null, fb: null, finished: false,
  cam: { pos: new THREE.Vector3(0, 4, 8), look: new THREE.Vector3(0, 1, -6), shake: 0, snap: true },
  pausedFrom: null,
};

function setChaser(type) {
  if (G.c.model) scene.remove(G.c.model.root);
  G.c.model = chaserModel(type);
  G.c.type = type;
  G.c.model.root.rotation.set(0, 0, 0);
  G.c.model.root.position.y = 0;
  scene.add(G.c.model.root);
}

// ---------- screens ----------
function show(id) {
  $$('.screen').forEach(s => { s.hidden = s.id !== id; });
}
function setMode(m) { G.mode = m; G.t = 0; document.body.dataset.mode = m; }

function sceneryOnly(biome) {
  world.start({ biomeAt: () => biome, onChunk: () => [], wantsHeart: () => false, color: '#ff4081' });
  world.noObstaclesFrom = -Infinity;
  fx.clear();
  G.h = { ...G.h, dist: 0, lane: 0, x: 0, y: 0, vy: 0, ground: true };
  G.c.d = 4.2; G.c.x = 0; G.c.spin = -1;
}

function showTitle() {
  setMode('title');
  show('s-title');
  $('#hud').hidden = true;
  sceneryOnly('mountains');
  setChaser('bear');
  sound.play('title');
}

function showMap() {
  sound.stopSpeech();
  sound.duck(false);
  if (G.mode !== 'title') { sceneryOnly(G.stage ? (G.tour ? 'beach' : G.stage.biome) : 'mountains'); }
  setMode('map');
  show('s-map');
  $('#hud').hidden = true;
  $('#s-q').hidden = true;
  renderMap();
  sound.play('map');
  const next = $('.stop.next') || $('.stop:not(.locked):last-of-type');
  if (next) next.scrollIntoView({ block: 'center' });
}

function renderMap() {
  $('#m-coins').textContent = S.coins;
  const list = $('#map-list');
  list.innerHTML = '';
  if (!LEVELS.length) { list.textContent = '🙈'; return; }
  for (const level of [...LEVELS].reverse()) {
    const sec = document.createElement('div');
    sec.className = 'm-level';
    const h = document.createElement('h2');
    h.textContent = level.name;
    sec.append(h);
    const path = document.createElement('div');
    path.className = 'm-path';
    level.stages.forEach((st, i) => {
      const stars = S.stars[stageKey(level, i)] || 0;
      const open = isOpen(level, i);
      const b = document.createElement('button');
      b.className = 'stop' + (open ? '' : ' locked') + (open && !stars ? ' next' : '') + (st.biome === 'tour' ? ' final' : '');
      b.style.setProperty('--c', st.color);
      b.style.setProperty('--off', [0, 1, 0, -1][i % 4]);
      const em = document.createElement('span'); em.className = 's-emoji'; em.textContent = open ? CHASER_EMOJI[st.chaser] : '🔒';
      const nm = document.createElement('span'); nm.className = 's-name'; nm.textContent = st.name;
      const sr = document.createElement('span'); sr.className = 's-stars';
      for (let k = 0; k < 3; k++) { const x = document.createElement('i'); x.textContent = '★'; if (k < stars) x.className = 'on'; sr.append(x); }
      b.append(em, nm, sr);
      b.setAttribute('aria-label', st.name + (open ? '' : ' (locked)'));
      if (open) b.addEventListener('click', () => { sound.sfx('click'); openStage(level, i); });
      else b.addEventListener('click', () => { sound.sfx('wrong'); b.classList.remove('nope'); void b.offsetWidth; b.classList.add('nope'); });
      path.append(b);
    });
    sec.append(path);
    list.append(sec);
  }
  syncToggles();
}

// ---------- stage setup ----------
function openStage(level, i) {
  const stage = level.stages[i];
  G.level = level; G.stageIdx = i; G.stage = stage;
  G.tour = stage.biome === 'tour';
  G.segments = G.tour ? level.stages.filter(s => s.biome !== 'tour') : [];
  G.hearts = MAX_HEARTS; G.coins = 0; G.wrong = 0; G.correct = 0;
  G.current = null; G.fb = null; G.finished = false;
  G.queue = []; G.extra = []; G.extraPlaced = 0; G.planned = 0; G.nextMore = 0; G.nextGate = GATE_FIRST;
  if (G.tour) {
    const own = stage.questions;
    G.extra = own.slice(G.segments.length);
    G.baseLeft = G.segments.length + Math.min(G.segments.length, own.length);
    G.needed = G.baseLeft + G.extra.length;
  } else {
    G.queue = shuffle(stage.questions);
    G.needed = G.queue.length;
  }
  world.start({ biomeAt, onChunk, wantsHeart: () => G.hearts < MAX_HEARTS, color: stage.color });
  fx.clear();
  G.h = { dist: 0, lane: 0, x: 0, y: 0, vy: 0, ground: true, slow: 1, inv: 0, dustT: 0 };
  setChaser(stage.chaser);
  G.c.d = 4.2; G.c.x = 0; G.c.spin = -1;
  sound.play(G.tour ? G.segments[0]?.biome || 'mountains' : stage.biome);

  setMode('intro');
  show('s-intro');
  sound.stopSpeech();
  sound.duck(false);
  $('#s-q').hidden = true;
  $('#hud').hidden = true;
  $('#i-emoji').textContent = CHASER_EMOJI[stage.chaser];
  $('#i-name').textContent = stage.name;
  $('#i-icons').textContent = (stage.icons || []).join(' ');
  $('#s-intro .card').style.setProperty('--c', stage.color);
  setTimeout(() => { if (G.mode === 'intro') roar(); }, 500);
}

function biomeAt(d) {
  if (!G.tour) return G.stage.biome;
  const k = clamp(Math.floor(d / SEGMENT), 0, G.segments.length - 1);
  return G.segments[k].biome;
}

// Called by the world as track is built ahead. Returns gates and region signs for [d0, d1).
function onChunk(d0, d1) {
  if (G.finished) return [];
  const ev = [];
  if (!G.tour) {
    while (G.nextGate < d1) {
      if (G.nextGate >= d0) ev.push({ type: 'gate', at: G.nextGate });
      G.nextGate += GATE_GAP;
    }
    return ev;
  }
  // Final run: plan one region segment at a time.
  const n = G.segments.length, own = G.stage.questions;
  while (G.planned < n && G.planned * SEGMENT < d1) {
    const k = G.planned++, s = k * SEGMENT;
    ev.push({ type: 'sign', at: s + 10, label: G.segments[k].name, color: G.segments[k].color });
    ev.push({ type: 'gate', at: s + 55, kind: 'review', seg: k });
    // A slot for a missed question, only if one is waiting.
    if (G.extra.length - G.extraPlaced > 0) { G.extraPlaced++; ev.push({ type: 'gate', at: s + 95, kind: 'extra' }); }
    if (k < own.length) ev.push({ type: 'gate', at: s + 135, kind: 'order', idx: k });
  }
  // Past the last region, keep offering gates for missed questions until they are all right.
  if (G.planned >= n) {
    if (!G.nextMore) G.nextMore = n * SEGMENT + 40;
    while (G.nextMore < d1) { ev.push({ type: 'gate', at: G.nextMore, kind: 'more' }); G.nextMore += 70; }
  }
  return ev.filter(e => e.at >= 0);
}

function pickReview(seg) {
  const st = G.segments[seg];
  const w = st.questions.map(q => 1 + 3 * (S.missed[qKey(G.level, q)] || 0));
  let r = Math.random() * w.reduce((a, b) => a + b, 0);
  for (let i = 0; i < w.length; i++) { r -= w[i]; if (r <= 0) return st.questions[i]; }
  return st.questions[0];
}

function go() {
  sound.unlock();
  sound.sfx('go');
  show(null);
  setMode('start');
  roar();
  $('#hud').hidden = false;
  updateHud();
}

function roar() {
  G.c.roarT = 1.1;
  sound.sfx('roar');
  G.cam.shake = Math.max(G.cam.shake, 0.25);
}

// ---------- HUD ----------
function updateHud() {
  const hearts = $('#hearts');
  hearts.innerHTML = '';
  for (let i = 0; i < MAX_HEARTS; i++) { const s = document.createElement('span'); s.textContent = i < G.hearts ? '❤️' : '🖤'; if (i >= G.hearts) s.className = 'gone'; hearts.append(s); }
  $('#coin-n').textContent = G.coins;
  const dots = $('#dots');
  if (dots.childElementCount !== G.needed) { dots.innerHTML = ''; for (let i = 0; i < G.needed; i++) dots.append(document.createElement('i')); }
  [...dots.children].forEach((d, i) => d.classList.toggle('on', i < G.correct));
  $('#c-mon').textContent = CHASER_EMOJI[G.c.type] || '👹';
}
function bumpCoins() {
  $('#coin-n').textContent = G.coins;
  const c = $('#coins');
  c.classList.remove('bump'); void c.offsetWidth; c.classList.add('bump');
}
function flash(color = 'red') {
  const f = $('#flash');
  f.className = ''; void f.offsetWidth; f.className = color;
}
let toastTimer = 0;
function toast(text, color = '#fff') {
  const t = $('#toast');
  t.textContent = text;
  t.style.setProperty('--c', color);
  t.classList.remove('show'); void t.offsetWidth; t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2200);
}

// ---------- controls ----------
function move(dir) {
  if (G.mode !== 'run') return;
  const to = clamp(G.h.lane + dir, -1, 1);
  if (to !== G.h.lane) { G.h.lane = to; sound.sfx('swoosh'); }
}
function jump() {
  if (G.mode !== 'run' || !G.h.ground) return;
  G.h.vy = JUMP_V; G.h.ground = false;
  sound.sfx('jump');
}
function drop() {
  if (G.mode !== 'run' || G.h.ground) return;
  G.h.vy = Math.min(G.h.vy, -16);
}

window.addEventListener('keydown', e => {
  if (e.repeat) return;
  const k = e.key;
  if (G.mode === 'run') {
    if (k === 'ArrowLeft' || k === 'a' || k === 'A') move(-1);
    else if (k === 'ArrowRight' || k === 'd' || k === 'D') move(1);
    else if (k === 'ArrowUp' || k === 'w' || k === 'W' || k === ' ') jump();
    else if (k === 'ArrowDown' || k === 's' || k === 'S') drop();
    else if (k === 'Escape' || k === 'p' || k === 'P') pause();
    else return;
    e.preventDefault();
  } else if (G.mode === 'question' && /^[1-4]$/.test(k)) {
    answer(Number(k) - 1);
  } else if (G.mode === 'feedback' && G.fb === 'wrong' && (k === 'Enter' || k === ' ' || k === 'ArrowRight')) {
    e.preventDefault();
    $('#b-next').click();
  } else if (G.mode === 'intro' && (k === 'Enter' || k === ' ')) {
    e.preventDefault();
    go();
  } else if (G.mode === 'paused' && (k === 'Escape' || k === 'p' || k === 'P')) {
    resume();
  }
});

// Swipes are recognized as soon as the finger moves far enough, so lane changes feel instant. A tap jumps.
let touch = null;
window.addEventListener('pointerdown', e => {
  if (G.mode !== 'run' || e.target.closest('button')) return;
  touch = { x: e.clientX, y: e.clientY, used: false, id: e.pointerId };
}, { passive: true });
window.addEventListener('pointermove', e => {
  if (!touch || touch.used || e.pointerId !== touch.id) return;
  const dx = e.clientX - touch.x, dy = e.clientY - touch.y;
  const min = Math.min(40, window.innerWidth * 0.06);
  if (Math.abs(dx) < min && Math.abs(dy) < min) return;
  touch.used = true;
  if (Math.abs(dx) > Math.abs(dy)) move(dx > 0 ? 1 : -1);
  else if (dy < 0) jump();
  else drop();
}, { passive: true });
window.addEventListener('pointerup', e => {
  if (touch && !touch.used && e.pointerId === touch.id) jump();
  touch = null;
}, { passive: true });
window.addEventListener('pointercancel', () => { touch = null; });

// ---------- run ----------
function runStep(dt) {
  const h = G.h;
  h.slow = Math.min(1, h.slow + dt * 0.5);
  h.inv = Math.max(0, h.inv - dt);
  const speed = (BASE_SPEED + Math.min(MAX_GAIN, h.dist * SPEED_GAIN)) * h.slow;
  h.dist += speed * dt;
  h.x = damp(h.x, h.lane * LANE, 14, dt);
  if (!h.ground) {
    h.vy -= GRAVITY * dt;
    h.y += h.vy * dt;
    if (h.y <= 0) {
      h.y = 0; h.vy = 0; h.ground = true;
      sound.sfx('land');
      dust(6);
    }
  }
  h.dustT -= dt;
  if (h.ground && h.dustT <= 0) { h.dustT = 0.09; dust(1); }

  // Chaser drifts back to its usual spot after lunging or being knocked away.
  G.c.d = damp(G.c.d, CHASE_D, G.c.d < CHASE_D ? 0.8 : 0.6, dt);
  G.c.x = damp(G.c.x, h.x, 3, dt);

  hero.animate(h.ground ? 'run' : 'jump', dt, { speed, jumpY: h.y });
  G.c.model.animate(G.c.roarT > 0 ? 'roar' : 'run', dt, G.clock);
  hero.root.visible = h.inv <= 0 || Math.floor(h.inv * 12) % 2 === 0;

  collide();
  if (G.mode !== 'run') return;

  for (const g of world.gates) {
    if (!g.done && h.dist >= g.dist - 8.5) { g.done = true; ask(g); return; }
    if (g.done && !g.passed && h.dist >= g.dist) { g.passed = true; fx.ring(0, 0.2, -g.dist, G.stage.color, 5); }
  }
  for (const s of world.signs) {
    if (!s.done && h.dist >= s.dist - 2) {
      s.done = true;
      toast(s.label, s.color);
      sound.sfx('gate');
      sound.play(biomeAt(s.dist + 5));
      if (S.settings.autoRead) sound.sayParts([s.label]);
    }
  }
  if (world.finish && h.dist >= world.finish.dist) clear();
  if (!S.hinted && G.t > 0.2 && G.t < 0.4) $('#hint').hidden = false;
  if (!S.hinted && G.t > 5) { S.hinted = true; save(); $('#hint').hidden = true; }
}

function dust(n) {
  const b = world.biome && ({ mountains: '#b8946a', foothills: '#c97a55', sandhills: '#f0dca0', farmland: '#b38a5f', swamp: '#9fc6b0', beach: '#ffffff' })[world.biome];
  for (let i = 0; i < n; i++) fx.spawn({ x: G.h.x + (Math.random() - 0.5) * 0.5, y: 0.1, z: -G.h.dist + 0.3, vx: (Math.random() - 0.5) * 1.5, vy: 0.8 + Math.random(), vz: -6 - Math.random() * 2, life: 0.4, size: 0.1 + Math.random() * 0.08, color: b || '#ccc', g: -2 });
}

function collide() {
  const h = G.h;
  for (const o of world.obstacles) {
    if (o.hit) continue;
    if (Math.abs(o.dist - h.dist) > o.d / 2 + 0.25) continue;
    if (Math.abs(o.x - h.x) > o.w / 2 + 0.3) continue;
    if (h.y >= o.h - 0.1) continue;
    o.hit = true;
    smash(o);
    if (h.inv > 0) continue;
    hurt();
    h.slow = 0.45;
    h.inv = 1.6;
    hero.stumble();
    sound.sfx('hit');
    if (G.hearts <= 0) { caught(); return; }
  }
  for (const c of world.coinList) {
    if (!c.alive || Math.abs(c.dist - h.dist) > 0.9 || Math.abs(c.x - h.x) > 0.9 || Math.abs(c.y - (h.y + 0.9)) > 1.2) continue;
    c.alive = false;
    G.coins++;
    bumpCoins();
    sound.sfx('coin');
    fx.burst(c.x, c.y, -c.dist, { n: 5, colors: ['#ffe066', '#ffffff'], speed: 2, up: 2, life: 0.4, size: 0.12, g: -4, floor: false });
  }
  for (const ht of world.hearts) {
    if (ht.taken || Math.abs(ht.dist - h.dist) > 1 || Math.abs(ht.x - h.x) > 1) continue;
    ht.taken = true;
    ht.mesh.visible = false;
    G.hearts = Math.min(MAX_HEARTS, G.hearts + 1);
    sound.sfx('heart');
    fx.burst(ht.x, 1.3, -ht.dist, { n: 16, colors: ['#ff2d55', '#ff9ab0', '#ffffff'], speed: 3, up: 3, life: 0.7, size: 0.15, g: -6 });
    updateHud();
    toast('❤️ +1', '#ff2d55');
  }
}

function smash(o) {
  o.mesh.visible = false;
  sound.sfx('smash');
  fx.burst(o.x, 0.6, -o.dist, { n: 22, colors: ['#8a6c48', '#a3a8b0', '#c8975a', '#5a4a3a'], speed: 5, up: 6, life: 1.1, size: 0.25 });
}

function hurt() {
  G.hearts = Math.max(0, G.hearts - 1);
  sound.sfx('heartLost');
  flash('red');
  G.cam.shake = 0.6;
  G.c.d = Math.min(G.c.d, 2.4);
  roar();
  updateHud();
  const hs = $('#hearts');
  hs.classList.remove('hurt'); void hs.offsetWidth; hs.classList.add('hurt');
}

// ---------- questions ----------
function ask(gate) {
  let q = null;
  if (!G.tour) q = G.queue.shift();
  else if (gate.kind === 'review') q = pickReview(gate.seg);
  else if (gate.kind === 'order') q = G.stage.questions[gate.idx];
  else if (gate.kind === 'extra') { q = G.extra.shift(); G.extraPlaced = Math.max(0, G.extraPlaced - 1); }
  else q = G.extra.shift();
  if (!q) return;
  G.current = { q, gate, base: G.tour && (gate.kind === 'review' || gate.kind === 'order') };
  G.fb = null;
  setMode('question');
  $('#hint').hidden = true;
  sound.duck(true);
  sound.sfx('gate');
  roar();

  const answers = shuffle([q.a, ...shuffle(q.wrong).slice(0, 3)]);
  G.current.answers = answers;
  $('#q-pic').textContent = q.pic || '';
  $('#q-pic').hidden = !q.pic;
  $('#q-show').textContent = q.show || '';
  $('#q-show').hidden = !q.show;
  $('#q-text').textContent = q.q;
  $('#q-card').style.setProperty('--c', G.stage.color);
  const box = $('#answers');
  box.innerHTML = '';
  answers.forEach((a, i) => {
    const b = document.createElement('button');
    b.className = 'ans';
    b.dataset.i = i;
    b.textContent = a;
    b.addEventListener('click', () => answer(i));
    box.append(b);
  });
  $('#tip').hidden = true;
  $('#s-q').hidden = false;
  $('#s-q').classList.remove('in'); void $('#s-q').offsetWidth; $('#s-q').classList.add('in');
  G.readyAt = performance.now() + 350;
  if (S.settings.autoRead) setTimeout(() => { if (G.mode === 'question') readQuestion(); }, 450);
}

function readQuestion() {
  const q = G.current?.q;
  if (!q) return;
  const btns = $$('#answers .ans');
  const intro = q.say || [q.show, q.q].filter(Boolean).join('. ');
  $('#b-speak').classList.add('talking');
  sound.sayParts([intro, ...G.current.answers], i => {
    btns.forEach((b, k) => b.classList.toggle('reading', k === i - 1));
    if (i < 0) $('#b-speak').classList.remove('talking');
  });
}

function answer(i) {
  if (G.mode !== 'question' || performance.now() < G.readyAt) return;
  const { q, answers } = G.current;
  sound.stopSpeech();
  $('#b-speak').classList.remove('talking');
  const btns = $$('#answers .ans');
  btns.forEach(b => b.classList.remove('reading'));
  const right = answers[i] === q.a;
  const key = qKey(G.level, q);
  setMode('feedback');
  G.fb = right ? 'right' : 'wrong';
  if (G.current.base) G.baseLeft--;
  if (right) {
    btns[i].classList.add('right');
    btns.forEach((b, k) => { if (k !== i) b.classList.add('dim'); });
    G.correct++;
    if (S.missed[key]) S.missed[key] = Math.max(0, S.missed[key] - 1);
    sound.sfx('correct');
    G.coins += 5;
    bumpCoins();
    updateHud();
    setTimeout(zap, 250);
  } else {
    btns[i].classList.add('wrong');
    btns.forEach((b, k) => { if (answers[k] === q.a) setTimeout(() => b.classList.add('right'), 350); else if (k !== i) b.classList.add('dim'); });
    G.wrong++;
    S.missed[key] = (S.missed[key] || 0) + 1;
    if (G.tour) G.extra.push(q); else G.queue.push(q);
    sound.sfx('wrong');
    hurt();
    G.c.d = 1.9;
    hero.stumble();
    $('#tip-text').textContent = q.why;
    setTimeout(() => {
      if (G.fb !== 'wrong' || G.mode !== 'feedback') return;
      $('#tip').hidden = false;
      if (S.settings.autoRead) sound.sayParts([q.why]);
    }, 600);
  }
  save();
}

function zap() {
  if (G.mode !== 'feedback') return;
  const from = new THREE.Vector3(G.h.x, 1.3, -G.h.dist + 0.3);
  const to = new THREE.Vector3(G.c.x, (G.c.model.height || 1.5) * 0.55, -(G.h.dist - G.c.d));
  fx.beam(from, to, '#7ff3ff');
  sound.sfx('zap');
  setTimeout(() => {
    fx.burst(to.x, to.y, to.z, { n: 40, colors: ['#7ff3ff', '#ffffff', '#ffd23f'], speed: 7, up: 5, life: 0.9, size: 0.2 });
    G.c.spin = 0;
    G.cam.shake = 0.35;
    sound.sfx('hit');
  }, 120);
}

function afterAnswer() {
  $('#s-q').hidden = true;
  sound.stopSpeech();
  sound.duck(false);
  const done = G.tour ? G.baseLeft <= 0 && G.extra.length === 0 : G.queue.length === 0;
  if (done && !G.finished) {
    G.finished = true;
    world.placeFinish(G.h.dist + 45);
    toast('🏁', '#ffd23f');
  }
  setMode('run');
}

$('#b-next').addEventListener('click', () => {
  if (G.mode !== 'feedback') return;
  sound.sfx('click');
  if (G.hearts <= 0) { $('#s-q').hidden = true; sound.duck(false); caught(); return; }
  afterAnswer();
});
$('#b-speak').addEventListener('click', () => {
  sound.unlock();
  if (G.mode === 'feedback' && G.fb === 'wrong') sound.sayParts([G.current.q.why]);
  else readQuestion();
});
$('#b-tip-speak').addEventListener('click', () => { if (G.current) sound.sayParts([G.current.q.why]); });

// ---------- endings ----------
function caught() {
  setMode('caught');
  G.c.spin = -1;
  $('#hint').hidden = true;
  sound.sfx('roar');
  setTimeout(() => sound.sfx('caught'), 500);
  flash('red');
  G.cam.shake = 0.8;
  S.coins += G.coins;
  save();
  setTimeout(() => {
    if (G.mode !== 'caught') return;
    show('s-caught');
    $('#hud').hidden = true;
    $('#k-emoji').textContent = CHASER_EMOJI[G.stage.chaser];
    $('#k-coins').textContent = '+' + G.coins;
  }, 1700);
}

function clear() {
  setMode('clear');
  $('#hint').hidden = true;
  G.c.spin = -1;
  const stars = G.wrong === 0 ? 3 : G.wrong <= 2 ? 2 : 1;
  const key = stageKey(G.level, G.stageIdx);
  const first = !S.stars[key];
  S.stars[key] = Math.max(S.stars[key] || 0, stars);
  S.coins += G.coins;
  save();
  sound.sfx('fanfare');
  sound.play('map');
  fx.confetti(G.h.x, 2, -G.h.dist - 8, 160);
  setTimeout(() => {
    if (G.mode !== 'clear') return;
    show('s-clear');
    $('#hud').hidden = true;
    $('#w-coins').textContent = '+' + G.coins;
    const sr = $('#w-stars');
    sr.innerHTML = '';
    for (let k = 0; k < 3; k++) {
      const x = document.createElement('i');
      x.textContent = '★';
      sr.append(x);
      if (k < stars) setTimeout(() => { x.className = 'on'; sound.sfx('star'); }, 350 + k * 350);
    }
    const hasNext = G.stageIdx + 1 < G.level.stages.length;
    $('#b-w-next').hidden = !hasNext;
    $('#w-unlock').hidden = !(first && hasNext);
    if (first && hasNext) $('#w-unlock').textContent = '🔓 ' + CHASER_EMOJI[G.level.stages[G.stageIdx + 1].chaser];
    $('#w-trophy').hidden = hasNext;
  }, 1600);
}

function pause() {
  if (G.mode !== 'run') return;
  G.pausedFrom = G.mode;
  setMode('paused');
  show('s-pause');
  syncToggles();
}
function resume() {
  show(null);
  setMode(G.pausedFrom || 'run');
  G.t = 1;
}
document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });

// ---------- buttons ----------
$('#b-play').addEventListener('click', () => { sound.unlock(); sound.sfx('click'); showMap(); });
$('#b-go').addEventListener('click', go);
$('#b-i-back').addEventListener('click', () => { sound.sfx('click'); showMap(); });
$('#b-pause').addEventListener('click', () => { sound.sfx('click'); pause(); });
$('#b-resume').addEventListener('click', () => { sound.sfx('click'); resume(); });
$('#b-p-map').addEventListener('click', () => { S.coins += G.coins; save(); showMap(); });
$('#b-k-retry').addEventListener('click', () => { sound.sfx('click'); openStage(G.level, G.stageIdx); });
$('#b-k-map').addEventListener('click', () => { sound.sfx('click'); showMap(); });
$('#b-w-next').addEventListener('click', () => { sound.sfx('click'); openStage(G.level, G.stageIdx + 1); });
$('#b-w-retry').addEventListener('click', () => { sound.sfx('click'); openStage(G.level, G.stageIdx); });
$('#b-w-map').addEventListener('click', () => { sound.sfx('click'); showMap(); });
$('#b-m-home').addEventListener('click', () => { sound.sfx('click'); showTitle(); });

function syncToggles() {
  $$('[data-toggle]').forEach(b => b.classList.toggle('off', !S.settings[b.dataset.toggle]));
}
$$('[data-toggle]').forEach(b => b.addEventListener('click', () => {
  const k = b.dataset.toggle;
  S.settings[k] = !S.settings[k];
  save();
  sound.unlock();
  sound.applySettings();
  if (k === 'autoRead' && !S.settings.autoRead) sound.stopSpeech();
  syncToggles();
  sound.sfx('click');
}));

// ---------- per-frame update ----------
function update(dt) {
  const h = G.h, c = G.c;
  c.roarT = Math.max(0, c.roarT - dt);
  switch (G.mode) {
    case 'title':
    case 'map':
    case 'intro': {
      hero.animate('idle', dt, { t: G.clock });
      c.model.animate(c.roarT > 0 ? 'roar' : 'idle', dt, G.clock);
      if (G.mode !== 'intro' && Math.random() < dt * 0.12) { c.roarT = 1.1; if (G.mode === 'title') G.cam.shake = 0.1; }
      break;
    }
    case 'start': {
      hero.animate(G.t > 1.0 ? 'run' : 'idle', dt, { t: G.clock });
      c.model.animate('roar', dt, G.clock);
      if (G.t > 1.25) setMode('run');
      break;
    }
    case 'run': runStep(dt); break;
    case 'question': {
      hero.animate(h.ground ? 'run' : 'jump', dt * 0.06, { jumpY: h.y });
      c.model.animate(c.roarT > 0 ? 'roar' : 'run', dt * 0.3, G.clock);
      c.d = damp(c.d, 3.2, 3, dt);
      break;
    }
    case 'feedback': {
      if (G.fb === 'right') {
        hero.animate('zap', dt, { t: G.clock });
        c.model.animate('roar', dt, G.clock);
        if (c.spin >= 0) c.d = damp(c.d, 15, 3, dt);
        if (G.t > 1.35) afterAnswer();
      } else {
        hero.animate('run', dt * 0.06, { jumpY: h.y });
        c.model.animate('attack', dt * 0.5, G.clock);
        c.d = damp(c.d, 1.9, 8, dt);
      }
      break;
    }
    case 'caught': {
      hero.animate('fall', dt, { t: G.clock });
      c.model.animate('attack', dt, G.clock);
      c.d = damp(c.d, 1.2, 5, dt);
      c.x = damp(c.x, h.x, 5, dt);
      break;
    }
    case 'clear': {
      const k = Math.max(0, 1 - G.t / 1.4);
      h.dist += BASE_SPEED * k * dt;
      hero.animate(k > 0.1 ? 'run' : 'cheer', dt, { t: G.clock, speed: BASE_SPEED * k });
      c.model.animate('idle', dt, G.clock);
      c.d += BASE_SPEED * k * dt * 1.3;
      if (G.t > 0.5 && Math.random() < dt * 3) fx.confetti(h.x, 3, -h.dist - 4, 25);
      break;
    }
    default: break;
  }
  // Knocked-back chaser does a backflip.
  if (c.spin >= 0) {
    c.spin += dt * 1.6;
    const k = Math.min(1, c.spin);
    c.model.root.rotation.x = -k * Math.PI * 2;
    c.model.root.position.y = Math.sin(k * Math.PI) * 2.6;
    if (k >= 1) { c.spin = -1; c.model.root.rotation.x = 0; c.model.root.position.y = 0; }
  }
  hero.root.position.set(h.x, 0, -h.dist);
  hero.root.rotation.z = (h.x - h.lane * LANE) * 0.08;
  if (G.mode !== 'run') hero.root.visible = true;
  c.model.root.position.x = c.x;
  c.model.root.position.z = -(h.dist - c.d);
  // Chase meter: the monster emoji slides toward the runner as it closes in.
  const k = Math.round(clamp((12 - c.d) / 10, 0, 1) * 50) / 50;
  if (k !== G.meterK) {
    G.meterK = k;
    chaseEl.style.setProperty('--k', k);
    chaseEl.classList.toggle('danger', k > 0.8);
  }
}
const chaseEl = document.getElementById('chase');

// ---------- camera ----------
const _look = new THREE.Vector3(), _pos = new THREE.Vector3();
function updateCamera(dt) {
  const h = G.h, z = -h.dist, portrait = camera.aspect < 0.8;
  let rate = 5;
  const tall = (G.c.model?.height || 1.5) > 3;
  switch (G.mode) {
    case 'title':
    case 'map': {
      const a = Math.sin(G.clock * 0.18) * 0.5 + 0.35;
      _pos.set(h.x + Math.sin(a) * 7.5, 2.6, z - Math.cos(a) * 7.5);
      _look.set(h.x, 1.3, z + 1.8);
      rate = 2;
      break;
    }
    case 'intro':
    case 'start':
    case 'question':
    case 'feedback':
    case 'caught': {
      const side = portrait ? 1.1 : 2.6;
      _pos.set(h.x + side, tall ? 3.0 : 2.4, z - (portrait ? 7.4 : 6.6));
      _look.set(h.x, tall ? 2.1 : 1.3, z + 1.8);
      if (G.mode === 'start' && G.t > 0.9) { _pos.set(h.x * 0.5, 4.2, z + 7.5); _look.set(h.x * 0.3, 1.2, z - 6); }
      rate = G.mode === 'start' ? 3.5 : 6;
      break;
    }
    case 'clear': {
      _pos.set(h.x + 1.5, 2.2, z - 6);
      _look.set(h.x, 1.4, z);
      rate = 2.5;
      break;
    }
    default: {
      _pos.set(h.x * 0.5, 4.2 + h.y * 0.25, z + 7.5);
      _look.set(h.x * 0.3, 1.2, z - 6);
      rate = 7;
    }
  }
  if (G.mode === 'paused') return;
  // When swinging between the back and front views, arc out to the side and up instead of flying through the hero.
  if (G.mode !== 'title' && G.mode !== 'map') {
    const swing = clamp((Math.abs(G.cam.pos.z - _pos.z) - 1.5) / 9, 0, 1);
    _pos.x += swing * 5;
    _pos.y += swing * 2.5;
  }
  if (G.cam.snap) { G.cam.pos.copy(_pos); G.cam.look.copy(_look); G.cam.snap = false; }
  G.cam.pos.x = damp(G.cam.pos.x, _pos.x, rate, dt);
  G.cam.pos.y = damp(G.cam.pos.y, _pos.y, rate, dt);
  // Forward motion is followed tightly so the camera never lags behind a fast runner.
  G.cam.pos.z = damp(G.cam.pos.z, _pos.z, G.mode === 'run' ? 30 : rate, dt);
  G.cam.look.x = damp(G.cam.look.x, _look.x, rate, dt);
  G.cam.look.y = damp(G.cam.look.y, _look.y, rate, dt);
  G.cam.look.z = damp(G.cam.look.z, _look.z, G.mode === 'run' ? 30 : rate, dt);
  G.cam.shake = Math.max(0, G.cam.shake - dt * 1.5);
  const s = G.cam.shake * G.cam.shake;
  camera.position.set(G.cam.pos.x + (Math.random() - 0.5) * s, G.cam.pos.y + (Math.random() - 0.5) * s, G.cam.pos.z);
  camera.lookAt(G.cam.look);
}

// ---------- quality ----------
// Drop resolution on slow devices so the game stays smooth.
let perfT = 0, perfN = 0;
function perf(dt) {
  perfT += dt; perfN++;
  if (perfT < 2) return;
  const avg = perfT / perfN;
  perfT = 0; perfN = 0;
  if (avg > 1 / 40 && pixelRatio > 0.75) {
    pixelRatio = Math.max(0.75, pixelRatio - 0.25);
    renderer.setPixelRatio(pixelRatio);
    resize();
  }
}

// ---------- loop ----------
let last = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (G.mode !== 'paused') {
    G.t += dt;
    G.clock += dt;
    update(dt);
    world.update(dt, G.h.dist, camera);
    fx.update(dt);
  }
  updateCamera(dt);
  renderer.render(scene, camera);
  if (G.mode === 'run') perf(dt);
}

showTitle();
G.cam.pos.set(5, 2.6, -5);
$('#loading').hidden = true;
requestAnimationFrame(frame);

// Handy for testing in the console.
window.__critterRun = { G, S, world, openStage: (i, lv = 0) => openStage(LEVELS[lv], i), save };
