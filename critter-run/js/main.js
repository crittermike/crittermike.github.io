// Critter Run: a 3D runner where each test is a level and each question is a gate on the trail.
import * as THREE from 'three';
import { loadChaser } from './models.js';
import { World, LANE, BIOME, hoopMesh, gemMesh, eggMesh, signBoard, disposeLabeled } from './world.js';
import { loadProps, propGeometry } from './props.js';
import { FX, additiveMat } from './fx.js';
import { Sound } from './audio.js';
import { CHASERS, CHASER_NAME } from './catalog.js';
import { installIcons, icon, iconTexture } from './ui.js';
import { renderCredits } from './credits.js';
import { Post, TIERS } from './post.js';
import { M } from './gfx.js';
import { loadRunner, loadBlasters } from './actors.js';
import { POWERS, TIMED_POWERS, RUNNERS, WEAPONS, TRAILS, byId, initShopSave, powerTime } from './items.js';
import { fireWeapon, warmMaterials } from './weapons.js';
import { Shop } from './shop.js';
import { mountAnswers } from './quiz.js';
import { figure } from './figures.js';
import { makeQuestion, grabRule } from './mathgen.js';

const $ = s => document.querySelector(s);
installIcons();
const $$ = s => [...document.querySelectorAll(s)];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const damp = (a, b, rate, dt) => a + (b - a) * (1 - Math.exp(-rate * dt));
const shuffle = a => { a = [...a]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

// Fast, with long floaty jumps: about 0.85 s in the air, so a jump started a little early still clears a log.
const BASE_SPEED = 13.5, SPEED_GAIN = 0.006, MAX_GAIN = 5;
const GRAVITY = 23, JUMP_V = 9.8, SUPER_JUMP = 1.4;
const SLIDE_TIME = 0.72, JUMP_BUFFER = 0.18;
const STAND_H = 1.7, SLIDE_H = 0.85;
const JET_Y = 5.2, MAGNET_R = 5.5;
const MAX_HEARTS = 5;
const GATE_FIRST = 100, GATE_GAP = 150;
const SEGMENT = 230; // length of each region in the final run
const CHASE_D = 10.5; // how far behind the chaser normally runs (just behind the camera, so it never blocks the path)

// ---------- save ----------
const SAVE_KEY = 'critter-run-v1';
const S = (() => {
  let s = {};
  try { s = JSON.parse(localStorage.getItem(SAVE_KEY)) || {}; } catch { s = {}; }
  return { coins: 0, stars: {}, missed: {}, hinted: false, ...s, settings: { music: true, sfx: true, autoRead: false, ...(s.settings || {}) } };
})();
initShopSave(S);
const save = () => { try { localStorage.setItem(SAVE_KEY, JSON.stringify(S)); } catch { /* private mode */ } };

// ---------- levels ----------
const ALL = (window.CritterRun && window.CritterRun.levels) || [];
const only = new URLSearchParams(location.search).get('level');
const LEVELS = only && ALL.some(l => l.id === only) ? ALL.filter(l => l.id === only) : ALL;
const stageKey = (level, i) => `${level.id}:${i}`;
// A level's questions are written out, or are { gen: 'skill' } entries that make a new question each time
// (js/mathgen.js). Misses are counted per written question, or per skill for made ones.
const qKey = (level, e) => (e.gen ? `${level.id}|gen:${e.gen}` : `${level.id}|${e.show || ''}|${e.q}`);
const entryOf = q => (q.entry ? { ...q.entry, variant: q.variant } : q);
const isOpen = (level, i) => i === 0 || (S.stars[stageKey(level, i - 1)] || 0) > 0;

// ---------- renderer ----------
const canvas = $('#game');
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
} catch (e) {
  $('#loading').classList.add('failed');
  $('#loading .fail').textContent = 'This game needs WebGL. Try Chrome or Safari.';
  throw e;
}
renderer.toneMapping = THREE.NeutralToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 1500);
const fx = new FX(scene);
// The sun is behind the runner, so views from the front get a soft light from the camera to show faces.
const fill = new THREE.DirectionalLight('#fff0dd', 0);
fill.position.set(1.5, 2, 0);
fill.target.position.set(0, 0, -6);
camera.add(fill, fill.target);
scene.add(camera);
let world = null; // made once the models have loaded
const sound = new Sound(S.settings);
const post = new Post(renderer, scene, camera);
const QUALITY = ['low', 'mid', 'high'];
const forcedQ = new URLSearchParams(location.search).get('q');
const phone = matchMedia('(pointer: coarse)').matches || Math.min(screen.width, screen.height) < 700;
let quality = QUALITY.includes(forcedQ) ? forcedQ : QUALITY.includes(S.quality) ? S.quality : phone ? 'mid' : 'high';
function setQuality(q) {
  quality = q;
  post.setTier(q);
  if (world) { world.setShadowSize(TIERS[q].shadow); world.density = TIERS[q].grass; }
}

let baseFov = 60;
function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  post.setSize(w, h);
  camera.aspect = w / h;
  baseFov = w / h < 0.8 ? 70 : 58;
  camera.fov = baseFov;
  shopView();
  camera.updateProjectionMatrix();
  fx.setViewport(h * renderer.getPixelRatio(), camera.fov);
}
// In the shop the panel covers part of the screen, so shift the picture to keep the runner in view.
function shopView() {
  const w = window.innerWidth, h = window.innerHeight;
  if (G.mode !== 'shop') { camera.clearViewOffset(); return; }
  if (w / h < 0.8) camera.setViewOffset(w, h, 0, h * 0.22, w, h);
  else camera.setViewOffset(w, h, w * 0.22, 0, w, h);
}
window.addEventListener('resize', resize);

// ---------- actors ----------
let hero = null;
const runnerCache = new Map();
let runnerWant = null;
async function useRunner(id) {
  runnerWant = id;
  let r = runnerCache.get(id);
  if (!r) {
    try { r = await loadRunner(byId(RUNNERS, id)); } catch (e) { console.warn('Runner failed to load', id, e); return false; }
    runnerCache.set(id, r);
  }
  if (runnerWant !== id) return false;
  if (r !== hero) {
    if (hero) { r.root.position.copy(hero.root.position); scene.remove(hero.root); }
    hero = r;
    scene.add(hero.root);
    hero.setWeapon(G.previewWeapon || S.equip.weapons);
  }
  return true;
}
const chasers = {};
async function chaserModel(type) {
  if (!chasers[type]) chasers[type] = loadChaser(type).catch(e => { delete chasers[type]; throw e; });
  return chasers[type];
}

// ---------- game state ----------
const G = {
  mode: 'title', t: 0, clock: 0,
  level: null, stageIdx: 0, stage: null, tour: false, segments: [],
  h: newHero(),
  c: { d: 4, x: 0, spin: -1, model: null, type: null, roarT: 0, frozen: 0, knock: 0 },
  pow: {}, fbDur: 1.35, hitStop: 0, fovKick: 0, trailT: 0, previewWeapon: null, coinHide: 0,
  hearts: MAX_HEARTS, coins: 0, wrong: 0, correct: 0, needed: 0,
  queue: [], extra: [], extraPlaced: 0, baseLeft: 0, nextGate: GATE_FIRST, planned: 0, seen: new Set(),
  current: null, fb: null, finished: false,
  cam: { pos: new THREE.Vector3(0, 4, 8), look: new THREE.Vector3(0, 1, -6), shake: 0, snap: true },
  pausedFrom: null,
};

setQuality(quality);
resize();

function newHero() {
  return { dist: 0, lane: 0, x: 0, y: 0, vy: 0, ground: true, slow: 1, inv: 0, safe: 0, dustT: 0, slide: 0, slideNext: false, jumpBuf: 0, jet: false };
}

async function setChaser(type) {
  G.c.want = type;
  const m = await chaserModel(type);
  if (G.c.want !== type) return;
  if (G.c.model) scene.remove(G.c.model.root);
  G.c.model = m;
  G.c.type = type;
  m.root.rotation.set(0, 0, 0);
  m.root.position.y = 0;
  scene.add(m.root);
}

// ---------- screens ----------
function show(id) {
  $$('.screen').forEach(s => { s.hidden = s.id !== id; });
}
let modeGen = 0; // bumped on every screen change, so a slow stage load knows the player has moved on
function setMode(m) { G.mode = m; G.t = 0; document.body.dataset.mode = m; modeGen++; }

function sceneryOnly(biome) {
  clearModes();
  world.start({ biomeAt: () => biome, onChunk: () => [], wantsHeart: () => false, color: '#ff4081' });
  world.noObstaclesFrom = -Infinity;
  fx.clear();
  G.h = newHero();
  G.c.d = 4.2; G.c.x = 0; G.c.spin = -1;
  clearPowers();
}

function showTitle() {
  setMode('title');
  show('s-title');
  $('#t-coins').textContent = S.coins;
  $('#hud').hidden = true;
  sceneryOnly('mountains');
  setChaser('bear');
  sound.play('title');
}

function showMap() {
  sound.stopSpeech();
  sound.duck(false);
  if (G.mode !== 'title' && G.mode !== 'shop') { sceneryOnly(G.stage ? (G.tour ? 'beach' : G.stage.biome) : 'mountains'); }
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
  if (!LEVELS.length) return;
  for (const level of [...LEVELS].reverse()) {
    const sec = document.createElement('div');
    sec.className = 'm-level';
    const h = document.createElement('h2');
    h.className = 'm-banner';
    h.textContent = level.name;
    const tp = document.createElement('div');
    tp.className = 'm-topic';
    tp.textContent = level.topic;
    sec.append(h, tp);
    const path = document.createElement('div');
    path.className = 'm-path';
    level.stages.forEach((st, i) => {
      const stars = S.stars[stageKey(level, i)] || 0;
      const open = isOpen(level, i);
      const b = document.createElement('button');
      b.className = 'stop' + (open ? '' : ' locked') + (open && !stars ? ' next' : '') + (st.biome === 'tour' ? ' final' : '');
      b.style.setProperty('--c', st.color);
      b.style.setProperty('--off', [0, 1, 0, -1][i % 4]);
      const md = document.createElement('span'); md.className = 'medal'; md.style.setProperty('--c', st.color);
      md.append(icon(open ? st.chaser : 'lock'));
      const nm = document.createElement('span'); nm.className = 's-name'; nm.textContent = st.name;
      const sr = document.createElement('span'); sr.className = 'stars';
      for (let k = 0; k < 3; k++) sr.append(icon('star', k < stars ? 'on' : ''));
      b.append(md, nm, sr);
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
let openSeq = 0;
async function openStage(level, i) {
  const stage = level.stages[i];
  const seq = ++openSeq, gen = modeGen;
  await setChaser(stage.chaser).catch(e => console.warn('Chaser failed to load', e));
  // Another stage was picked, or he left this screen, while the chaser loaded.
  if (seq !== openSeq || gen !== modeGen) return;
  G.level = level; G.stageIdx = i; G.stage = stage;
  G.tour = stage.biome === 'tour';
  clearModes();
  G.play = G.tour ? 'run' : stage.mode || 'run';
  G.segments = G.tour ? level.stages.filter(s => s.biome !== 'tour') : [];
  G.hearts = MAX_HEARTS; G.coins = 0; G.wrong = 0; G.correct = 0;
  G.current = null; G.fb = null; G.finished = false; G.seen = new Set();
  G.queue = []; G.extra = []; G.extraPlaced = 0; G.planned = 0; G.nextMore = 0; G.nextGate = GATE_FIRST;
  if (G.tour) {
    const own = stage.questions;
    G.extra = own.slice(G.segments.length);
    G.baseLeft = G.segments.length + Math.min(G.segments.length, own.length);
    G.needed = G.baseLeft + G.extra.length;
  } else {
    G.queue = planQueue(stage);
    G.needed = G.queue.length;
  }
  if (G.play === 'sky') G.sky = { set: null, next: HOOP_FIRST, v: SKY_SPEED, lane: null };
  if (G.play === 'shoot') G.shoot = { set: null, next: SHOOT_FIRST, busy: false };
  if (G.play === 'boss') G.boss = { hp: G.needed, max: G.needed, rockT: 3, down: -1, rock: BIOME[stage.biome].obstacles.low[0] };
  if (G.play === 'grab') {
    G.grab = { rules: stage.rules, ri: 0, rule: null, got: 0, gems: [], next: 0, phase: 'idle', last: null, wait: 0 };
    G.needed += stage.rules.length;
  }
  world.start({ biomeAt, onChunk, wantsHeart: () => G.hearts < MAX_HEARTS, color: stage.color, powers: POWERS, pickPower, powerIcon: id => iconTexture(POWERS[id].icon, POWERS[id].color),
    sky: G.play === 'sky' ? JET_Y : 0, rows: G.play === 'grab' ? false : G.play === 'shoot' ? 'coins' : true,
    onRockLand: () => { sound.sfx('smashRock'); G.cam.shake = Math.max(G.cam.shake, 0.35); } });
  fx.clear();
  G.h = newHero();
  clearPowers();
  G.c.d = G.boss ? -BOSS_GAP : 4.2; G.c.x = 0; G.c.spin = -1;
  updateBossBar();
  sound.play(stage.music || (G.tour ? 'tour' : stage.biome));

  setMode('intro');
  show('s-intro');
  sound.stopSpeech();
  sound.duck(false);
  $('#s-q').hidden = true;
  $('#hud').hidden = true;
  $('#i-name').textContent = stage.name;
  $('#i-name').style.color = stage.color;
  $('#i-badge').replaceChildren(icon(stage.chaser));
  $('#i-badge').style.setProperty('--c', stage.color);
  const name = CHASER_NAME[stage.chaser];
  const who = 'the ' + (name.includes('.') ? name : name.toLowerCase()); // "T. rex" keeps its capital
  $('#i-chaser').textContent = { sky: `Fly from ${who}!`, shoot: 'Blast the right answer!', boss: `Catch ${who}!`, grab: 'Grab the right ones!' }[G.play] || `Run from ${who}!`;
  setTimeout(() => { if (G.mode === 'intro') roar(); }, 500);
}

function biomeAt(d) {
  if (!G.tour) return G.stage.biome;
  const k = clamp(Math.floor(d / SEGMENT), 0, G.segments.length - 1);
  return G.segments[k].biome;
}

// Called by the world as track is built ahead. Returns gates and region signs for [d0, d1).
function onChunk(d0, d1) {
  if (G.finished || (G.play !== 'run' && G.play !== 'boss')) return [];
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
    ev.push({ type: 'sign', at: s + 14, label: G.segments[k].name, color: G.segments[k].color });
    ev.push({ type: 'gate', at: s + 80, kind: 'review', seg: k });
    // A slot for a missed question, only if one is waiting.
    if (G.extra.length - G.extraPlaced > 0) { G.extraPlaced++; ev.push({ type: 'gate', at: s + 137, kind: 'extra' }); }
    if (k < own.length) ev.push({ type: 'gate', at: s + 195, kind: 'order', idx: k });
  }
  // Past the last region, keep offering gates for missed questions until they are all right.
  if (G.planned >= n) {
    if (!G.nextMore) G.nextMore = n * SEGMENT + 60;
    while (G.nextMore < d1) { ev.push({ type: 'gate', at: G.nextMore, kind: 'more' }); G.nextMore += 100; }
  }
  return ev.filter(e => e.at >= 0);
}

// Questions he has missed before come up more often.
function pickWeighted(list) {
  const w = list.map(q => 1 + 3 * (S.missed[qKey(G.level, q)] || 0));
  let r = Math.random() * w.reduce((a, b) => a + b, 0);
  for (let i = 0; i < w.length; i++) { r -= w[i]; if (r <= 0) return list[i]; }
  return list[0];
}
// A stage asks each of its questions once, in random order. A stage with made questions ({ gen }) can ask more (count):
// every entry once, then extra made ones that lean toward what he has missed.
function planQueue(stage) {
  const list = stage.questions, made = list.filter(e => e.gen);
  const n = made.length ? Math.max(stage.count || 0, list.length) : list.length;
  const out = shuffle(list);
  while (out.length < n) out.push(pickWeighted(made));
  return shuffle(out);
}
// Turns an entry into the question to show. A made question that was already asked this run is made again.
const sig = q => [q.show, q.q, q.a, ...(q.parts || q.options || q.slots || (q.items || []).map(i => i.label) || [])].join('|');
function resolve(e, lane = false) {
  if (!e.gen) return e;
  let q;
  for (let tries = 0; tries < 12; tries++) {
    q = { ...makeQuestion(lane ? { ...e, lane: true } : e), entry: e };
    if (!G.seen.has(sig(q))) break;
  }
  G.seen.add(sig(q));
  return q;
}
function pickReview(seg) { return pickWeighted(G.segments[seg].questions); }
function powerQuestion() {
  const pool = G.tour ? G.level.stages.flatMap(s => s.questions) : G.stage.questions;
  const last = G.current?.q;
  const list = pool.length > 1 ? pool.filter(e => e !== last && e !== last?.entry) : pool;
  return resolve(pickWeighted(list));
}

// The chaser roars, the announcer counts in, and the run starts on "GO!".
function go() {
  sound.unlock();
  sound.sfx('click');
  show(null);
  setMode('start');
  G.cue = 0;
  roar();
  $('#hud').hidden = false;
  updateHud();
}

function roar(force = true) {
  G.c.roarT = 1.1;
  if (G.c.type) sound.roar(G.c.type, force);
  G.cam.shake = Math.max(G.cam.shake, 0.25);
}

// ---------- HUD ----------
function updateHud() {
  const hearts = $('#hearts');
  if (hearts.childElementCount !== MAX_HEARTS) hearts.replaceChildren(...Array.from({ length: MAX_HEARTS }, () => icon('heart')));
  [...hearts.children].forEach((h, i) => h.classList.toggle('gone', i >= G.hearts));
  $('#coin-n').textContent = G.coins;
  const dots = $('#dots');
  if (dots.childElementCount !== G.needed) dots.replaceChildren(...Array.from({ length: G.needed }, () => icon('star')));
  [...dots.children].forEach((d, i) => d.classList.toggle('on', i < G.correct));
  const mon = $('#c-mon');
  if (mon.dataset.type !== G.c.type) { mon.dataset.type = G.c.type; mon.replaceChildren(icon(G.c.type)); }
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
function toast(text, color = '#fff', ic = null) {
  const t = $('#toast');
  t.replaceChildren(...(ic ? [icon(ic), ' '] : []), text);
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
// A jump pressed just before landing still happens on landing, so fast tapping never feels ignored.
function jump() {
  const h = G.h;
  if (G.mode !== 'run' || h.jet) return;
  if (!h.ground) { h.jumpBuf = JUMP_BUFFER; return; }
  h.vy = JUMP_V * (G.pow.jump ? SUPER_JUMP : 1);
  h.g = GRAVITY;
  if (!G.pow.jump) assistJump(h);
  h.ground = false;
  h.slide = 0;
  h.jumpBuf = 0;
  sound.sfx('jump');
  if (G.pow.jump) fx.ring(h.x, 0.15, -h.dist, POWERS.jump.color, 2.5, 0.4);
}
// Jump assist: a jump started too early for the low obstacle ahead stretches into a longer, slightly higher leap
// that lands just past it, so an eager tap still clears it. A jump way too early is left alone.
const LOW_CLEAR = 0.22; // a low obstacle is cleared once the feet are this close to its top
function assistJump(h) {
  const v = runSpeed() * h.slow, lx = h.lane * LANE;
  let o = null;
  for (const c of world.obstacles) {
    if (c.hit || !c.low || c.dist < h.dist || (!c.wide && Math.abs(c.x - lx) > c.w / 2 + 0.3)) continue;
    if (!o || c.dist < o.dist) o = c;
  }
  if (!o) return;
  // Same box as collide(), plus a frame: the height is checked at the end of each frame.
  const thr = o.h - LOW_CLEAR, d = o.dist - h.dist, r = o.d / 2 + 0.2;
  const tIn = (d - r) / v, tOut = (d + r) / v + 0.05;
  const y = (t, V, g) => V * t - (g * t * t) / 2;
  if (tIn < 0 || (y(tIn, h.vy, h.g) >= thr && y(tOut, h.vy, h.g) >= thr)) return;
  const T = tOut + 0.2;
  if (T < (2 * h.vy) / h.g || T > 1.25) return;
  const apex = Math.min(2.8, 2.1 + (T - 0.85) * 1.2);
  h.vy = (4 * apex) / T;
  h.g = (8 * apex) / (T * T);
}
// Down slides under bars. In the air it drops fast and slides on landing.
function slide() {
  const h = G.h;
  if (G.mode !== 'run' || h.jet) return;
  h.jumpBuf = 0;
  if (!h.ground) { h.vy = Math.min(h.vy, -18); h.slideNext = true; return; }
  if (h.slide <= 0) sound.sfx('slide');
  h.slide = SLIDE_TIME;
  hintSeen('slide');
}

window.addEventListener('keydown', e => {
  if (e.repeat) return;
  const k = e.key;
  if (G.mode === 'run') {
    if (k === 'ArrowLeft' || k === 'a' || k === 'A') move(-1);
    else if (k === 'ArrowRight' || k === 'd' || k === 'D') move(1);
    else if (k === 'ArrowUp' || k === 'w' || k === 'W' || k === ' ') jump();
    else if (k === 'ArrowDown' || k === 's' || k === 'S') slide();
    else if (k === 'Escape' || k === 'p' || k === 'P') pause();
    else if (G.pick && !G.pick.done && /^[1-3]$/.test(k)) G.pick.onPick(Number(k) - 1);
    else return;
    e.preventDefault();
  } else if (G.mode === 'question') {
    if (G.current?.ui?.key(k)) e.preventDefault();
  } else if (G.mode === 'feedback' && G.fb === 'wrong' && !$('#tip').hidden && (k === 'Enter' || k === ' ' || k === 'ArrowRight')) {
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
  // In the shoot stage, a tap on a flyer fires at it.
  if (G.shoot?.set) { const i = flyerAt(e.clientX, e.clientY); if (i >= 0) { shootFlyer(i); return; } }
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
  else slide();
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
  h.safe = Math.max(0, h.safe - dt);
  h.jumpBuf = Math.max(0, h.jumpBuf - dt);
  tickPowers(dt);
  if (G.shoot) G.shoot.k = damp(G.shoot.k ?? 1, G.shoot.set && !G.shoot.set.done ? 0.55 : 1, 2, dt);
  const speed = G.sky ? skySpeed(dt) * h.slow : runSpeed() * h.slow * (h.jet ? 1.25 : 1) * (G.grab ? GRAB_SPEED : 1) * (G.shoot ? G.shoot.k : 1);
  const prev = h.dist;
  h.dist += speed * dt;
  h.x = damp(h.x, h.lane * LANE, 18, dt);
  if (h.jet) {
    h.y = damp(h.y, JET_Y, 4, dt);
    h.vy = 0;
    if (Math.random() < dt * 40) jetPuff();
  } else if (!h.ground) {
    h.vy -= (h.g || GRAVITY) * dt;
    h.y += h.vy * dt;
    if (h.y <= 0) {
      h.y = 0; h.vy = 0; h.ground = true; h.g = GRAVITY;
      sound.sfx('land');
      dust(6);
      if (h.jumpBuf > 0) jump();
      else if (h.slideNext) { h.slideNext = false; slide(); }
    }
  }
  if (h.slide > 0) {
    h.slide -= dt;
    if (Math.random() < dt * 30) dust(1);
  }
  h.dustT -= dt;
  if (h.ground && h.dustT <= 0) { h.dustT = 0.09; dust(1); }
  trail(dt, speed);
  speedLines(dt, speed);
  if (G.pow.magnet) magnet(dt);

  // Chaser drifts back to its usual spot after lunging or being knocked away. The boss runs ahead instead.
  if (G.boss?.down >= 0) G.c.d = h.dist - G.boss.at;
  else if (G.boss) G.c.d = damp(G.c.d, -bossGap(), 0.7, dt);
  else G.c.d = damp(G.c.d, CHASE_D, G.c.d < CHASE_D ? 0.8 : 0.6, dt);
  if (!(G.boss?.down >= 0)) G.c.x = damp(G.c.x, h.x, G.boss ? 1.2 : 3, dt);

  hero.animate(heroPose(), dt, { speed, jumpY: h.y });
  G.c.model.animate(G.boss?.down >= 0 ? 'idle' : G.c.roarT > 0 ? 'roar' : 'run', G.boss?.down >= 0 ? dt * 0.2 : dt, G.clock);
  hero.root.visible = h.inv <= 0 || Math.floor(h.inv * 12) % 2 === 0;
  G.fovKick = h.jet ? 6 : (speed - BASE_SPEED) * 1.0;

  collide(prev);
  if (G.mode !== 'run') return;
  if (G.sky) skyStep();
  if (G.grab) grabStep(prev, dt);
  if (G.shoot) shootStep(dt);
  if (G.boss) bossStep(dt);
  if (G.mode !== 'run') return;

  for (const g of world.gates) {
    if (!g.done && h.dist >= g.dist - 10) { g.done = true; ask(g); return; }
    if (g.done && !g.passed && h.dist >= g.dist) { g.passed = true; fx.ring(0, 0.2, -g.dist, G.stage.color, 5); }
  }
  for (const s of world.signs) {
    if (!s.done && h.dist >= s.dist - 2) {
      s.done = true;
      toast(s.label, s.color);
      sound.sfx('gate');
      if (S.settings.autoRead) sound.sayParts([s.label]);
    }
  }
  if (world.finish && h.dist >= world.finish.dist) clear();
  if (!S.hinted && G.t > 0.2 && G.t < 0.4) showHint('move');
  if (!S.hinted && G.t > 5) { S.hinted = true; save(); $('#hint').hidden = true; }
  // The first time a bar shows up, point down so he knows to slide under it.
  if (!S.hintedSlide && G.hint !== 'slide') {
    const bar = world.obstacles.find(o => o.over && !o.hit && o.dist - h.dist > 0 && o.dist - h.dist < 30);
    if (bar) showHint('slide');
  }
}

function runSpeed() { return BASE_SPEED + Math.min(MAX_GAIN, G.h.dist * SPEED_GAIN); }

function heroPose() {
  const h = G.h;
  if (h.jet) return 'jump';
  if (h.slide > 0) return 'slide';
  return h.ground ? 'run' : 'jump';
}

function showHint(kind) {
  G.hint = kind;
  const hint = $('#hint');
  if (kind === 'slide') hint.replaceChildren(icon('hand', 'hand down'), Object.assign(document.createElement('div'), { className: 'arrows' }));
  else hint.replaceChildren(icon('hand', 'hand'), Object.assign(document.createElement('div'), { className: 'arrows' }));
  hint.lastChild.append(...(kind === 'slide' ? [icon('swipe-down')] : [icon('swipe-left'), icon('swipe-up'), icon('swipe-right')]));
  $('#hint').hidden = false;
}
function hintSeen(kind) {
  if (kind === 'slide' && !S.hintedSlide && G.hint === 'slide') { S.hintedSlide = true; save(); $('#hint').hidden = true; G.hint = null; }
}

// ---------- trails ----------
function trail(dt, speed) {
  const t = byId(TRAILS, S.equip.trails);
  if (!t.colors.length) return;
  G.trailT -= dt;
  if (G.trailT > 0) return;
  G.trailT = 0.025;
  const h = G.h, c = t.colors[Math.floor(Math.random() * t.colors.length)];
  const y = h.y + (h.slide > 0 ? 0.3 : 0.5) + Math.random() * 0.6;
  fx.spark({ x: h.x + (Math.random() - 0.5) * 0.5, y, z: -h.dist + 0.4, vx: (Math.random() - 0.5) * 0.6, vy: t.id === 'fire' ? 1.5 : 0.3, vz: speed * 0.15, life: 0.55, size: t.id === 'stars' ? 0.55 : 0.4, color: c, glow: 1.8, drag: 1 });
}

function jetPuff() {
  const h = G.h;
  for (const s of [-0.17, 0.17]) {
    fx.spark({ x: h.x + s, y: h.y + 0.62, z: -h.dist + 0.37, vy: -7, vz: 3, life: 0.22, size: 0.55, color: Math.random() < 0.5 ? '#ffd23f' : '#ff8c1a', glow: 2.5 });
    fx.puff({ x: h.x + s, y: h.y + 0.25, z: -h.dist + 0.5, vy: -3, vz: 4, life: 0.7, size: 0.8, color: '#dddddd', alpha: 0.45, grow: 2 });
  }
}

// Streaks of wind rushing past when running fast or flying.
function speedLines(dt, speed) {
  const k = G.h.jet ? 1 : clamp((speed - 15) / 3, 0, 1);
  if (k <= 0 || Math.random() > dt * 45 * k) return;
  const h = G.h, a = Math.random() * Math.PI * 2, r = 2.5 + Math.random() * 3;
  fx.spark({ x: h.x + Math.cos(a) * r, y: 2.2 + h.y * 0.7 + Math.sin(a) * r * 0.6, z: -h.dist - 18, vz: speed * 2.6, life: 0.4, size: 0.12, color: '#ffffff', alpha: 0.35 * k, glow: 1 });
}

function magnet(dt) {
  const h = G.h;
  for (const c of world.coinList) {
    if (!c.alive) continue;
    const dd = c.dist - h.dist;
    if (dd < -1 || dd > MAGNET_R + 2) continue;
    const dx = h.x - c.x, dy = h.y + 0.9 - c.y;
    if (Math.abs(dx) > MAGNET_R) continue;
    const k = 1 - Math.exp(-10 * dt);
    c.x += dx * k; c.y += dy * k; c.dist -= dd * k;
  }
}

function dust(n) {
  const b = world.biome && BIOME[world.biome].dust;
  for (let i = 0; i < n; i++) fx.spawn({ x: G.h.x + (Math.random() - 0.5) * 0.5, y: 0.1, z: -G.h.dist + 0.3, vx: (Math.random() - 0.5) * 1.5, vy: 0.8 + Math.random(), vz: -6 - Math.random() * 2, life: 0.4, size: 0.1 + Math.random() * 0.08, color: b || '#ccc', g: -2 });
}

// True when [a, b] (the distance covered this frame, widened by r) overlaps a thing at distance d.
const swept = (a, b, d, r) => d >= a - r && d <= b + r;
function collide(prev = G.h.dist) {
  const h = G.h;
  const top = h.y + (h.slide > 0 ? SLIDE_H : STAND_H);
  for (const o of world.obstacles) {
    if (o.hit) continue;
    if (!swept(prev, h.dist, o.dist, o.d / 2 + 0.2)) continue;
    if (Math.abs(o.x - h.x) > o.w / 2 + 0.3) continue;
    // Bars have a gap underneath (o.y0). Everything else starts at the ground.
    if (h.y >= o.h - (o.low ? LOW_CLEAR : 0.1) || top <= o.y0 + 0.05) continue;
    o.hit = true;
    smash(o);
    if (h.inv > 0 || h.safe > 0) continue;
    if (G.pow.shield) {
      sound.sfx('shieldHit');
      G.cam.shake = Math.max(G.cam.shake, 0.3);
      G.hitStop = 0.05;
      fx.ring(h.x, 1, -h.dist - 0.5, POWERS.shield.color, 2.5, 0.35);
      continue;
    }
    hurt();
    h.slow = 0.45;
    h.inv = 1.6;
    h.slide = 0;
    G.hitStop = 0.08;
    hero.stumble();
    sound.sfx('hit');
    if (G.hearts <= 0) { caught(); return; }
  }
  for (const c of world.coinList) {
    if (!c.alive || !swept(prev, h.dist, c.dist, 0.9) || Math.abs(c.x - h.x) > 0.95 || Math.abs(c.y - (h.y + 0.9)) > 1.25) continue;
    c.alive = false;
    G.coins += G.pow.double ? 2 : 1;
    bumpCoins();
    sound.sfx('coin');
    fx.burst(c.x, c.y, -c.dist, { n: 5, colors: G.pow.double ? ['#ffe066', '#ff9f1c', '#ffffff'] : ['#ffe066', '#ffffff'], speed: 2, up: 2, life: 0.4, size: 0.12, g: -4, floor: false, sparks: 3 });
  }
  for (const k of world.crates) {
    if (k.taken || !swept(prev, h.dist, k.dist, 1.1) || Math.abs(k.x - h.x) > 1.1 || Math.abs(k.y - (h.y + 0.9)) > 1.6) continue;
    k.taken = true;
    k.mesh.visible = false;
    sound.sfx('crate');
    fx.burst(k.x, 1.25, -k.dist, { n: 24, colors: [k.power.color, '#ffffff', '#ffd23f'], speed: 5, up: 4, life: 0.8, size: 0.2, sparks: 30, glow: 1.5 });
    fx.ring(k.x, 1.2, -k.dist, k.power.color, 3, 0.4);
    if (k.power.id === 'hearts' && G.hearts >= MAX_HEARTS) { G.coins += 10; bumpCoins(); continue; }
    askPower(k.power.id);
    return;
  }
  for (const ht of world.hearts) {
    if (ht.taken || !swept(prev, h.dist, ht.dist, 1) || Math.abs(ht.x - h.x) > 1.05 || Math.abs(ht.y - (h.y + 0.9)) > 1.6) continue;
    ht.taken = true;
    ht.mesh.visible = false;
    G.hearts = Math.min(MAX_HEARTS, G.hearts + 1);
    sound.sfx('heart');
    fx.burst(ht.x, 1.3, -ht.dist, { n: 16, colors: ['#ff2d55', '#ff9ab0', '#ffffff'], speed: 3, up: 3, life: 0.7, size: 0.15, g: -6 });
    updateHud();
    toast('+1', '#ff3b5c', 'heart');
  }
}

const ROCKY = /rock|boulder/i;
function smash(o) {
  o.mesh.visible = false;
  if (o.type === 'bomb') {
    const y = o.mesh.position.y;
    sound.sfx('boom');
    fx.burst(o.x, y, -o.dist, { n: 30, colors: ['#ffd23f', '#ff7a1a', '#ff3b1a', '#ffffff'], speed: 7, up: 3, life: 0.7, size: 0.3, sparks: 40, glow: 2.5, floor: false, g: -2 });
    for (let i = 0; i < 6; i++) fx.puff({ x: o.x + (Math.random() - 0.5) * 1.4, y: y + (Math.random() - 0.5), z: -o.dist, vx: (Math.random() - 0.5) * 3, vy: 1 + Math.random(), life: 1, size: 1.6, color: '#555555', alpha: 0.55, grow: 1.8, drag: 2 });
    G.cam.shake = Math.max(G.cam.shake, 0.4);
    return;
  }
  sound.sfx(ROCKY.test(o.type) ? 'smashRock' : 'smash');
  const y = o.over ? o.y0 + 0.6 : 0.6;
  fx.burst(o.x, y, -o.dist, { n: 22, colors: ['#8a6c48', '#a3a8b0', '#c8975a', '#5a4a3a'], speed: 5, up: 6, life: 1.1, size: 0.25 });
  for (let i = 0; i < 6; i++) fx.puff({ x: o.x + (Math.random() - 0.5) * 1.5, y: y * 0.5, z: -o.dist, vx: (Math.random() - 0.5) * 3, vy: 1 + Math.random() * 2, life: 0.9, size: 1.3, color: '#cdbfa8', alpha: 0.5, grow: 1.5, drag: 2 });
}

// ---------- power-ups ----------
// A crate gives a question. Only a right answer turns the power on.
const shieldBubble = (() => {
  const m = new THREE.Mesh(new THREE.IcosahedronGeometry(1.25, 3), new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uTime: { value: 0 }, uCol: { value: new THREE.Color(POWERS.shield.color) } },
    vertexShader: 'varying vec3 vN; varying vec3 vV; varying vec3 vP; void main(){ vP = position; vec4 mv = modelViewMatrix * vec4(position,1.); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }',
    fragmentShader: 'uniform float uTime; uniform vec3 uCol; varying vec3 vN; varying vec3 vV; varying vec3 vP; void main(){ float x = clamp(1. - abs(dot(normalize(vN), normalize(vV))), 0., 1.); float f = x * x; float hex = step(.92, fract(vP.y * 4. + uTime * .6)) * .25; gl_FragColor = vec4(uCol * (f * 1.6 + hex + .06), 1.); }',
  }));
  m.visible = false;
  m.renderOrder = 5;
  scene.add(m);
  return m;
})();

// A rocket backpack made of two fuel tanks, shown while the jetpack power is on. Built once the models load.
let jetpack = null;
function makeJetpack() {
  const g = new THREE.Group();
  const tank = propGeometry('fuelBarrel');
  for (const x of [-0.17, 0.17]) {
    const m = new THREE.Mesh(tank, M.solid);
    m.scale.set(0.27, 0.5, 0.27);
    m.position.set(x, -0.27, 0.12);
    m.castShadow = true;
    m.frustumCulled = false;
    g.add(m);
  }
  g.visible = false;
  scene.add(g);
  return g;
}
function updateJetpack() {
  if (!jetpack) return;
  const h = G.h;
  jetpack.visible = h.jet || (G.mode === 'shop' && G.shopPower === 'jetpack');
  if (jetpack.visible) jetpack.position.set(h.x, h.y + 1.05, -h.dist + 0.27);
}

function pickPower() {
  const ids = TIMED_POWERS.filter(id => !G.sky || (id !== 'jetpack' && id !== 'jump'));
  if (G.hearts < MAX_HEARTS - 1) ids.push('hearts', 'hearts');
  const free = ids.filter(id => !G.pow[id]);
  const list = free.length ? free : ids;
  return list[Math.floor(Math.random() * list.length)];
}

function activatePower(id) {
  const p = POWERS[id];
  sound.stinger('powerup');
  post.flash(p.color, 0.25);
  fx.ring(G.h.x, 0.3, -G.h.dist, p.color, 4, 0.5);
  fx.burst(G.h.x, 1.2, -G.h.dist, { n: 30, colors: [p.color, '#ffffff'], speed: 5, up: 5, life: 0.9, size: 0.18, sparks: 40, glow: 2 });
  toast(p.name.toUpperCase() + '!', p.color, p.icon);
  sound.voice('powerUp');
  if (id === 'hearts') {
    G.hearts = Math.min(MAX_HEARTS, G.hearts + 2);
    updateHud();
    return;
  }
  G.pow[id] = { t: powerTime(id, S.upgrades[id] || 0) };
  G.pow[id].total = G.pow[id].t;
  if (id === 'magnet') sound.loop('magnet', true);
  if (id === 'jetpack') {
    const h = G.h;
    h.jet = true; h.ground = false; h.slide = 0;
    sound.sfx('jet');
    sound.loop('jetpack', true);
    const len = runSpeed() * 1.25 * G.pow[id].t;
    world.skyCoins(h.dist + 18, h.dist + len - 8, JET_Y - 0.9 + 0.2);
  }
  renderPowers();
}

function endPower(id) {
  delete G.pow[id];
  sound.sfx('powerOff');
  if (id === 'jetpack' || id === 'magnet') sound.loop(id, false);
  if (id === 'jetpack') {
    const h = G.h;
    h.jet = false;
    h.vy = 0;
    h.safe = 1.6; // lands safely even if something is right underneath
  }
  renderPowers();
}

function clearPowers() {
  G.pow = {};
  G.h.jet = false;
  sound.loop('jetpack', false);
  sound.loop('magnet', false);
  shieldBubble.visible = false;
  renderPowers();
}

function tickPowers(dt) {
  for (const id of Object.keys(G.pow)) {
    const p = G.pow[id];
    p.t -= dt;
    if (p.t <= 0) endPower(id);
  }
  // Badges count down with a ring, and blink in the last two seconds.
  for (const b of $$('#powers .pw')) {
    const p = G.pow[b.dataset.id];
    if (!p) continue;
    b.style.setProperty('--p', (p.t / p.total).toFixed(3));
    b.classList.toggle('ending', p.t < 2);
  }
}

function renderPowers() {
  const box = $('#powers');
  const ids = Object.keys(G.pow);
  if (box.dataset.ids === ids.join()) return;
  box.dataset.ids = ids.join();
  box.innerHTML = '';
  for (const id of ids) {
    const b = document.createElement('div');
    b.className = 'pw';
    b.dataset.id = id;
    b.style.setProperty('--c', POWERS[id].color);
    b.append(icon(POWERS[id].icon));
    box.append(b);
  }
}

function updatePowerFx(dt) {
  const h = G.h, on = (!!G.pow.shield && (G.mode === 'run' || G.mode === 'question' || G.mode === 'feedback')) || (G.mode === 'shop' && G.shopPower === 'shield');
  shieldBubble.visible = on;
  if (on) {
    shieldBubble.position.set(h.x, h.y + (h.slide > 0 ? 0.6 : 1.0), -h.dist);
    shieldBubble.material.uniforms.uTime.value += dt;
    const p = G.pow.shield ? G.pow.shield.t : 9;
    shieldBubble.material.uniforms.uCol.value.set(POWERS.shield.color).multiplyScalar(p < 2 && Math.floor(p * 8) % 2 ? 0.3 : 1);
    shieldBubble.rotation.y += dt;
  }
}

function hurt() {
  G.hearts = Math.max(0, G.hearts - 1);
  sound.sfx('heartLost');
  flash('red');
  G.cam.shake = 0.6;
  if (!G.boss) G.c.d = Math.min(G.c.d, 2.4);
  roar();
  updateHud();
  const hs = $('#hearts');
  hs.classList.remove('hurt'); void hs.offsetWidth; hs.classList.add('hurt');
}

// ---------- sky stage ----------
// He flies the whole stage with a jetpack. Each question comes with three answer hoops ahead, one per lane, and
// flying through a hoop picks its answer. While a question is up the run slows and there are no bombs, so there's
// time to read it; the bombs come between questions.
// A question's hoops arrive no sooner than HOOP_TIME seconds after it shows (more with read-aloud on), so there's
// time to read and think. Tapping an answer at the bottom picks it: he flies to that lane and zooms through.
const HOOP_FIRST = 60, HOOP_AHEAD = 90, HOOP_GAP = 40, HOOP_TIME = 12, HOOP_TIME_READ = 16, SKY_SPEED = 13;
function skySpeed(dt) {
  const s = G.sky, set = s.set;
  let want = SKY_SPEED;
  if (set && !set.done) {
    if (set.locked) want = SKY_SPEED * 1.5;
    else want = Math.min(SKY_SPEED, Math.max(2.5, (set.dist - G.h.dist) / Math.max(0.4, set.arrive - G.clock)));
  }
  s.v = damp(s.v, want, want < s.v ? 4 : 2, dt);
  return s.v;
}
const HOOPS = [['hoopRed', '#ff4b4b'], ['hoopYellow', '#ffb81a'], ['hoopBlue', '#2f8cff']]; // left, middle, right

function liftOff() {
  const h = G.h;
  h.jet = true; h.ground = false; h.slide = 0;
  sound.sfx('jet');
  sound.loop('jetpack', true);
}
function land() {
  const h = G.h;
  h.jet = false; h.vy = 0; h.g = GRAVITY; h.safe = 1.6;
  sound.loop('jetpack', false);
}

function skyStep() {
  const s = G.sky, h = G.h;
  if (!s.set && !G.finished && h.dist >= s.next) {
    if (G.queue.length) spawnHoops(h.dist + HOOP_AHEAD);
    else finishRun();
  }
  // Land just before the finish line.
  if (G.finished && h.jet && world.finish && world.finish.dist - h.dist < 32) land();
  const set = s.set;
  if (!set) return;
  if (s.lane !== h.lane) {
    s.lane = h.lane;
    $$('#sky-ans .sky-a').forEach((b, k) => b.classList.toggle('here', k === h.lane + 1));
  }
  if (!set.done && h.dist >= set.dist) passHoops(set);
  else if (set.done && h.dist > set.dist + 15) { dropHoops(set); s.set = null; s.next = h.dist + HOOP_GAP * (set.right ? 1 : 1.6); }
}

function spawnHoops(dist) {
  const q = resolve(G.queue.shift(), true);
  const answers = shuffle([q.a, ...shuffle(q.wrong).slice(0, 2)]);
  world.clearRange(G.h.dist + 5, dist + 15);
  const meshes = HOOPS.map(([key, color], i) => {
    const m = hoopMesh(key, color, answers[i]);
    m.scale.setScalar(2.05);
    m.position.set((i - 1) * LANE, JET_Y + 0.95, -dist);
    scene.add(m);
    return m;
  });
  G.sky.set = { q, answers, meshes, dist, done: false, right: false, locked: false, arrive: G.clock + (S.settings.autoRead ? HOOP_TIME_READ : HOOP_TIME) };
  G.sky.lane = null;
  showPick(q, answers, HOOPS.map(hp => hp[1]), steerTo);
}

// The question card up top and its answer buttons along the bottom, shared by the sky and shoot stages.
// onPick(i) runs when he taps answer i (or presses 1-3).
let pickToken = 0;
function showPick(q, answers, colors, onPick) {
  const token = ++pickToken;
  G.pick = { q, answers, onPick, done: false, token };
  $('#sky-show').textContent = q.show || '';
  $('#sky-show').hidden = !q.show;
  $('#sky-text').textContent = q.q;
  $('#sky-card').style.setProperty('--c', G.stage.color);
  $('#sky-tip').hidden = true;
  $('#sky-ans').replaceChildren(...answers.map((a, i) => {
    const b = document.createElement('button');
    b.className = 'btn sky-a';
    b.style.setProperty('--lc', colors[i]);
    b.textContent = a;
    b.addEventListener('click', () => onPick(i));
    return b;
  }));
  const box = $('#sky');
  box.hidden = false;
  box.classList.remove('in'); void box.offsetWidth; box.classList.add('in');
  document.body.classList.add('sky-q');
  sound.sfx('gate');
  if (S.settings.autoRead) setTimeout(() => { if (token === pickToken) readPick(); }, 300);
}
function readPick() {
  const p = G.pick;
  if (!p || p.done) return;
  const chips = $$('#sky-ans .sky-a');
  sound.sayParts([p.q.say || [p.q.show, p.q.q].filter(Boolean).join('. '), ...p.answers], i => chips.forEach((b, k) => b.classList.toggle('reading', k === i - 1)));
}
function hidePick(token) {
  if (token !== pickToken) return;
  $('#sky').hidden = true;
  document.body.classList.remove('sky-q');
}
// Scores a sky or shoot answer and marks the buttons. A wrong one shows the tip and costs a heart.
function scorePick(i, right) {
  const p = G.pick, q = p.q, chips = $$('#sky-ans .sky-a'), token = p.token;
  const key = qKey(G.level, entryOf(q));
  p.done = true;
  sound.stopSpeech();
  chips.forEach(b => b.classList.remove('reading'));
  if (right) {
    G.correct++;
    if (S.missed[key]) S.missed[key] = Math.max(0, S.missed[key] - 1);
    G.coins += 5;
    bumpCoins();
    updateHud();
    sound.sfx('correct');
    chips[i].classList.add('right');
    chips.forEach((b, k) => { if (k !== i) b.classList.add('dim'); });
    setTimeout(() => hidePick(token), 900);
  } else {
    S.missed[key] = (S.missed[key] || 0) + 1;
    G.wrong++;
    G.queue.push(entryOf(q));
    sound.sfx('wrong');
    chips[i].classList.add('wrong');
    chips.forEach((b, k) => { if (p.answers[k] === q.a) setTimeout(() => b.classList.add('right'), 300); else if (k !== i) b.classList.add('dim'); });
    $('#sky-tip').textContent = q.why;
    $('#sky-tip').hidden = false;
    if (S.settings.autoRead) sound.sayParts([q.why]);
    setTimeout(() => hidePick(token), 3600);
    hurt();
  }
  save();
  if (G.hearts <= 0) caught();
}
// Tapping an answer at the bottom flies to its lane.
function steerTo(i) {
  const set = G.sky?.set;
  if (G.mode !== 'run' || !set || set.done) return;
  sound.unlock();
  if (G.h.lane !== i - 1) { G.h.lane = i - 1; sound.sfx('swoosh'); }
  if (!set.locked) { set.locked = true; sound.sfx('whoosh'); }
}

function passHoops(set) {
  set.done = true;
  const h = G.h, i = h.lane + 1, q = set.q, right = set.answers[i] === q.a;
  const hoop = set.meshes[i], at = hoop.position, color = HOOPS[i][1];
  set.right = right;
  hoop.userData.board.visible = false;
  if (right) {
    fx.burst(at.x, at.y, at.z, { n: 46, colors: [color, '#ffffff', '#ffd23f'], speed: 7, up: 2, life: 1.1, size: 0.24, sparks: 50, glow: 2, floor: false, g: -3 });
    post.flash(color, 0.18);
    // The right answer knocks the chaser back.
    G.c.d = Math.max(G.c.d, CHASE_D) + 7;
    G.c.spin = 0;
  } else {
    hoop.visible = false;
    fx.burst(at.x, at.y, at.z, { n: 26, colors: ['#888888', '#bbbbbb', color], speed: 5, up: 1, life: 0.9, size: 0.22, floor: false, g: -6 });
  }
  scorePick(i, right);
}
function dropHoops(set) {
  for (const m of set.meshes) { scene.remove(m); disposeLabeled(m); }
}

// ---------- shoot stage ----------
// Pterodactyls fly in carrying the answers and hover ahead of the runner. Tapping one (or its answer at the bottom)
// fires the blaster at it. There are no obstacles, so he can keep his eyes on the question.
const SHOOT_FIRST = 40, SHOOT_GAP = 22, FLYER_AHEAD = 13, FLYER_SIZE = 3.4;
const FLYER_SLOTS = [[-3.4, 3.3], [0, 4.4], [3.4, 3.3]];
const FLYER_COLORS = ['#ff4b4b', '#ffb81a', '#2f8cff'];
const flyerModel = () => loadChaser('pterodactyl', { shadow: false }).catch(() => loadChaser('dragon', { shadow: false })).catch(() => null);

async function spawnFlyers() {
  const s = G.shoot;
  s.busy = true;
  const q = resolve(G.queue.shift(), true);
  const answers = shuffle([q.a, ...shuffle(q.wrong).slice(0, 2)]);
  const models = await Promise.all(answers.map(flyerModel));
  s.busy = false;
  // He left the stage while the models loaded.
  if (G.shoot !== s) return;
  const flyers = answers.map((a, i) => {
    const g = new THREE.Group(), m = models[i];
    if (m) {
      m.root.scale.setScalar(FLYER_SIZE / Math.max(0.1, m.length));
      m.root.rotation.y = Math.PI; // face the runner
      g.add(m.root);
    }
    const sign = signBoard(a, FLYER_COLORS[i]);
    sign.scale.setScalar(1.25);
    sign.position.y = -1.5;
    g.add(sign);
    scene.add(g);
    return { g, model: m, sign, i, t: 0, state: 'in', ph: Math.random() * 6, away: 0 };
  });
  s.set = { q, answers, flyers, done: false, t: 0, end: Infinity };
  showPick(q, answers, FLYER_COLORS, shootFlyer);
}

function shootStep(dt) {
  const s = G.shoot, h = G.h;
  if (!s.set && !s.busy && !G.finished && h.dist >= s.next) {
    if (G.queue.length) spawnFlyers();
    else finishRun();
  }
  const set = s.set;
  if (!set) return;
  set.t += dt;
  for (const f of set.flyers) {
    f.t += dt;
    const [sx, sy] = FLYER_SLOTS[f.i];
    let x = sx + Math.sin(G.clock * 0.9 + f.ph) * 0.45, y = sy + Math.sin(G.clock * 2.2 + f.ph) * 0.3;
    let d = h.dist + FLYER_AHEAD + Math.sin(G.clock * 0.7 + f.ph) * 1.2;
    if (f.state === 'in') {
      const k = Math.min(1, f.t / 1.5), e = 1 - (1 - k) ** 3;
      d += (1 - e) * 70; y += (1 - e) * 12;
      if (k >= 1) f.state = 'hover';
    } else if (f.state === 'away') {
      f.away += dt;
      d += f.away * f.away * 40; y += f.away * 7; x += (sx || 1) * f.away * 3;
    }
    f.g.position.set(x, y, -d);
    f.g.rotation.z = Math.sin(G.clock * 1.6 + f.ph) * 0.12;
    f.sign.rotation.z = -f.g.rotation.z;
    if (f.model) f.model.animate('run', dt);
  }
  if (set.done && set.t > set.end) {
    dropFlyers(set);
    s.set = null;
    s.next = h.dist + SHOOT_GAP;
  }
}

// The flyer under a tap, if any. Generous, so a quick tap near one counts.
function flyerAt(px, py) {
  const set = G.shoot?.set;
  if (!set || set.done) return -1;
  const r = Math.max(70, Math.min(window.innerWidth, window.innerHeight) * 0.11);
  let best = -1, bestD = r;
  for (const f of set.flyers) {
    for (const part of [f.g, f.sign]) {
      const v = part.getWorldPosition(_aim).project(camera);
      const sx = (v.x + 1) / 2 * window.innerWidth, sy = (1 - v.y) / 2 * window.innerHeight;
      const dd = Math.hypot(sx - px, sy - py);
      if (dd < bestD) { bestD = dd; best = f.i; }
    }
  }
  return best;
}

function shootFlyer(i) {
  const set = G.shoot?.set;
  if (G.mode !== 'run' || !set || set.done) return;
  sound.unlock();
  set.done = true;
  const f = set.flyers[i], right = set.answers[i] === set.q.a;
  const to = f.g.getWorldPosition(new THREE.Vector3());
  hero.showWeapon(true);
  hero.aimAt(to);
  const w = byId(WEAPONS, S.equip.weapons);
  const t = fireWeapon(w.id, {
    fx, sound, to, from: hero.muzzle(new THREE.Vector3()),
    chaser: { height: 1.2, length: 1.8 },
    hit: () => flyerHit(set, f, right),
    freeze: () => {},
    flash: (c, a) => post.flash(c, a),
    shake: a => { G.cam.shake = Math.max(G.cam.shake, a); },
  });
  setTimeout(() => { if (G.mode === 'run') hero.showWeapon(false); }, (t + 0.5) * 1000);
  set.end = set.t + t + (right ? 1.6 : 3.6);
  if (right) {
    // The chaser behind gets knocked back too.
    G.c.d = Math.max(G.c.d, CHASE_D) + 5;
    G.c.spin = 0;
  }
  scorePick(i, right);
}
function flyerHit(set, f, right) {
  const p = f.g.position;
  sound.sfx('hit');
  if (right) {
    f.g.visible = false;
    f.state = 'gone';
    fx.burst(p.x, p.y, p.z, { n: 50, colors: [FLYER_COLORS[f.i], '#ffffff', '#ffd23f'], speed: 8, up: 3, life: 1.1, size: 0.26, sparks: 60, glow: 2, floor: false, g: -6 });
    fx.ring(p.x, p.y, p.z, FLYER_COLORS[f.i], 3, 0.4);
  } else {
    fx.burst(p.x, p.y, p.z, { n: 16, colors: ['#888888', '#bbbbbb'], speed: 4, up: 1, life: 0.7, size: 0.2, floor: false, g: -6 });
  }
  for (const o of set.flyers) if (o.state !== 'gone') o.state = 'away';
}
function dropFlyers(set) {
  for (const f of set.flyers) { scene.remove(f.g); disposeLabeled(f.sign); }
}

// ---------- boss stage ----------
// The T. rex took an egg and runs ahead. It throws rocks into the lanes (jump them or switch lanes), and question
// gates come up as in a normal run. Each right answer blasts it and brings it closer; the last one knocks it over.
const BOSS_GAP = 19, BOSS_NEAR = 10, BOSS_ROCK_EVERY = 4.2;
function bossStep(dt) {
  const b = G.boss, h = G.h;
  b.rockT -= dt;
  if (b.rockT <= 0 && !G.finished && G.t > 3) {
    b.rockT = BOSS_ROCK_EVERY * (0.7 + Math.random() * 0.6);
    const lane = Math.random() < 0.5 ? h.lane : Math.floor(Math.random() * 3) - 1;
    if (world.dropRock(lane, h.dist + 32, b.rock)) {
      G.c.roarT = 0.9;
      sound.roar(G.c.type, false);
    }
  }
}
// How far ahead the boss runs: closer as it gets weaker.
const bossGap = () => BOSS_NEAR + (BOSS_GAP - BOSS_NEAR) * (G.boss.hp / G.boss.max);
function bossHit() {
  const b = G.boss;
  b.hp = Math.max(0, b.hp - 1);
  b.flash = 0.5;
  G.hitStop = 0.08;
  G.cam.shake = Math.max(G.cam.shake, 0.45);
  sound.sfx('hit');
  updateBossBar();
}
function updateBossBar() {
  const b = G.boss;
  $('#boss').hidden = !b;
  document.body.classList.toggle('boss', !!b);
  if (!b) return;
  $('#boss-fill').style.setProperty('--k', (b.hp / b.max).toFixed(3));
  if ($('#boss-ic').dataset.type !== G.c.type) { $('#boss-ic').dataset.type = G.c.type; $('#boss-ic').replaceChildren(icon(G.stage.chaser)); }
}
// The last hit: it stumbles off the trail and falls over, and he gets the egg back.
function bossDown() {
  const b = G.boss, h = G.h;
  b.down = 0;
  b.at = h.dist - G.c.d;
  G.c.roarT = 1.2;
  sound.roar(G.c.type, true);
  G.cam.shake = 0.8;
  finishRun();
  setTimeout(() => {
    if (G.boss !== b) return;
    toast('YOU GOT THE EGG!', '#ffd23f', 'egg');
    sound.stinger('star');
    fx.confetti(h.x, 3, -h.dist - 8, 120);
  }, 900);
}

// ---------- catch stage ----------
// Rows of number gems roll in. A rule at the top says which ones to grab ("EVEN numbers"); a wrong grab costs a
// heart. Each round of catching ends with a question gate, then a new rule.
const GEM_GAP = 24, GEM_AHEAD = 85, GEM_NEED = 6, GRAB_SPEED = 0.85;
const GEMS = [['gemBlue', '#2f8cff'], ['gemGreen', '#2fb84f'], ['gemRed', '#ff4b4b'], ['gemYellow', '#f0a800']];

// Rounds and gates take turns until both run out. A missed gate question comes back as another gate.
function nextPhase() {
  const g = G.grab, rounds = g.ri < g.rules.length, gates = G.queue.length > 0;
  const step = g.last === 'round' ? (gates ? 'gate' : rounds ? 'round' : null) : (rounds ? 'round' : gates ? 'gate' : null);
  g.last = step;
  if (step === 'round') startRound();
  else if (step === 'gate') { g.phase = 'gate'; world.addGate(G.h.dist + 60); }
  else { g.phase = 'done'; finishRun(); }
}

function startRound() {
  const g = G.grab;
  g.rule = grabRule(Math.random, g.rules[g.ri++]);
  g.got = 0;
  g.phase = 'round';
  g.next = Math.max(g.next, G.h.dist + 45);
  $('#catch-rule').textContent = g.rule.title;
  $('#catch-pips').replaceChildren(...Array.from({ length: GEM_NEED }, () => document.createElement('i')));
  $('#catch').style.setProperty('--c', G.stage.color);
  $('#catch > .ic').replaceWith(icon(G.level.id === 'math-ch4' ? 'egg' : 'gem'));
  $('#catch').hidden = false;
  $('#catch').classList.remove('in'); void $('#catch').offsetWidth; $('#catch').classList.add('in');
  toast(g.rule.title, '#ffffff', G.level.id === 'math-ch4' ? 'egg' : 'gem');
  if (S.settings.autoRead) sound.sayParts([g.rule.say]);
}

function grabStep(prev, dt) {
  const g = G.grab, h = G.h;
  if (g.phase === 'idle') nextPhase();
  if (g.phase === 'round') while (g.next < h.dist + GEM_AHEAD) { gemRow(g.next); g.next += GEM_GAP; }
  if (g.phase === 'between' && h.dist >= g.wait) nextPhase();
  for (const gem of g.gems) {
    const sp = gem.mesh.userData.spin;
    sp.rotation.y += dt * 2;
    sp.rotation.z = Math.sin(G.clock * 4 + gem.ph) * 0.12;
    gem.mesh.position.y = 0.95 + Math.sin(G.clock * 3 + gem.ph) * 0.12;
    if (gem.taken || !swept(prev, h.dist, gem.dist, 0.8) || Math.abs(gem.x - h.x) > 1.05 || h.y > 1.7) continue;
    takeGem(gem);
    if (G.mode !== 'run') return;
  }
  const gone = g.gems.filter(gem => gem.dist < h.dist - 12);
  if (gone.length) { gone.forEach(dropGem); g.gems = g.gems.filter(gem => !gone.includes(gem)); }
}

// Two or three gems across the lanes, always at least one to grab and one to skip.
function gemRow(d) {
  const g = G.grab, lanes = shuffle([-1, 0, 1]).slice(0, Math.random() < 0.55 ? 3 : 2);
  let items = [];
  for (let t = 0; t < 30; t++) {
    items = lanes.map(() => g.rule.next(Math.random));
    if (items.some(it => it.good) && items.some(it => !it.good) && new Set(items.map(it => it.label)).size === items.length) break;
  }
  items.forEach((it, k) => {
    const [key, color] = GEMS[Math.floor(Math.random() * GEMS.length)];
    // Dino Island hunts eggs; other worlds catch gems.
    const mesh = G.level.id === 'math-ch4' ? eggMesh(color, it.label) : gemMesh(key, color, it.label);
    const x = lanes[k] * LANE;
    mesh.position.set(x, 0.95, -d);
    scene.add(mesh);
    g.gems.push({ ...it, x, dist: d, mesh, color, ph: Math.random() * 6, taken: false });
  });
  const free = [-1, 0, 1].filter(l => !lanes.includes(l));
  if (free.length && Math.random() < 0.6) world.coinLine(free[0], d - 9, 5);
}

function takeGem(gem) {
  const g = G.grab, h = G.h, at = gem.mesh.position;
  gem.taken = true;
  gem.mesh.visible = false;
  if (gem.good) {
    g.got++;
    G.coins += 2;
    bumpCoins();
    sound.sfx('coin');
    sound.sfx('correct', { volume: 0.45 });
    fx.burst(at.x, at.y + 0.4, at.z, { n: 26, colors: [gem.color, '#ffffff', '#ffd23f'], speed: 5, up: 4, life: 0.8, size: 0.2, sparks: 30, glow: 2 });
    const pips = $('#catch-pips').children;
    if (pips[g.got - 1]) pips[g.got - 1].classList.add('on');
    if (g.got >= GEM_NEED) roundDone();
    return;
  }
  G.wrong++;
  sound.sfx('wrong');
  fx.burst(at.x, at.y + 0.4, at.z, { n: 18, colors: ['#888888', '#bbbbbb', gem.color], speed: 4, up: 2, life: 0.7, size: 0.2 });
  toast(gem.why, '#ff8a8a');
  if (S.settings.autoRead) sound.sayParts([gem.why]);
  hurt();
  h.slow = 0.6;
  hero.stumble();
  if (G.hearts <= 0) caught();
}

function roundDone() {
  const g = G.grab, h = G.h;
  g.phase = 'between';
  g.wait = h.dist + 25;
  G.correct++;
  updateHud();
  sound.stinger('star');
  toast('GREAT!', '#7dff8a', 'star');
  fx.confetti(h.x, 2.5, -h.dist - 6, 70);
  // Gems still ahead go away in a puff.
  for (const gem of g.gems) {
    if (gem.taken || gem.dist < h.dist) continue;
    gem.taken = true;
    gem.mesh.visible = false;
    fx.puff({ x: gem.x, y: 1.2, z: -gem.dist, vy: 1, life: 0.7, size: 1.6, color: '#ffffff', alpha: 0.6, grow: 1.6 });
  }
  setTimeout(() => { if (G.grab === g && g.phase !== 'round') $('#catch').hidden = true; }, 1200);
}
function dropGem(gem) { scene.remove(gem.mesh); disposeLabeled(gem.mesh); }

// Clears whatever the sky or catch stage left in the scene.
function clearModes() {
  if (G.sky?.set) dropHoops(G.sky.set);
  if (G.grab) G.grab.gems.forEach(dropGem);
  if (G.shoot?.set) dropFlyers(G.shoot.set);
  if (G.boss && G.c.model) { G.c.model.root.rotation.set(0, 0, 0); G.c.model.root.position.y = 0; }
  G.sky = null;
  G.grab = null;
  G.shoot = null;
  G.boss = null;
  updateBossBar();
  pickToken++;
  G.pick = null;
  $('#sky').hidden = true;
  $('#catch').hidden = true;
  document.body.classList.remove('sky-q');
}

// ---------- questions ----------
function ask(gate) {
  let e = null;
  if (!G.tour) e = G.queue.shift();
  else if (gate.kind === 'review') e = pickReview(gate.seg);
  else if (gate.kind === 'order') e = G.stage.questions[gate.idx];
  else if (gate.kind === 'extra') { e = G.extra.shift(); G.extraPlaced = Math.max(0, G.extraPlaced - 1); }
  else e = G.extra.shift();
  if (!e) return;
  showQuestion(resolve(e), { gate, base: G.tour && (gate.kind === 'review' || gate.kind === 'order') });
  sound.sfx('gate');
  roar();
}

// A crate's power only turns on if he gets its question right.
function askPower(id) {
  // Crates can be anywhere, so clear the trail just ahead: the front camera won't end up inside an obstacle,
  // and he won't run straight into one the moment the game resumes.
  const h = G.h;
  for (const o of world.obstacles) {
    if (o.hit || o.dist < h.dist || o.dist > h.dist + 16) continue;
    o.hit = true;
    o.mesh.visible = false;
  }
  showQuestion(powerQuestion(), { power: id });
}

function showQuestion(q, extra) {
  G.current = { q, ...extra };
  G.fb = null;
  setMode('question');
  $('#hint').hidden = true;
  G.hint = null;
  sound.duck(true);
  hero.showWeapon(false);

  const power = extra.power ? POWERS[extra.power] : null;
  $('#q-power').hidden = !power;
  if (power) {
    $('#q-power').replaceChildren(icon(power.icon));
    $('#q-power').style.setProperty('--pc', power.color);
  }
  $('#s-q').classList.toggle('power', !!power);

  $('#q-pic').replaceChildren(...(q.pic ? [icon(q.pic)] : []));
  $('#q-pic').hidden = !q.pic;
  $('#q-show').textContent = q.show || '';
  $('#q-show').hidden = !q.show;
  $('#q-text').textContent = q.q;
  const fig = q.model ? figure(q.model) : null;
  $('#q-fig').replaceChildren(...(fig ? [fig] : []));
  $('#q-fig').hidden = !fig;
  $('#q-card').style.setProperty('--c', power ? power.color : G.stage.color);
  G.current.ui = mountAnswers(q, $('#answers'), {
    ready: () => G.mode === 'question' && performance.now() >= G.readyAt,
    done: judge,
    sfx: name => sound.sfx(name),
    // Sorting shows one item at a time; each new one is read out when auto-read is on.
    onItem: label => { if (S.settings.autoRead && G.mode === 'question') { $('#b-speak').classList.remove('talking'); sound.sayParts([label]); } },
  });
  $('#tip').hidden = true;
  $('#s-q').hidden = false;
  $('#s-q').classList.remove('in'); void $('#s-q').offsetWidth; $('#s-q').classList.add('in');
  G.readyAt = performance.now() + 350;
  if (S.settings.autoRead) setTimeout(() => { if (G.mode === 'question') readQuestion(); }, 450);
}

function readQuestion() {
  const { q, ui } = G.current || {};
  if (!q) return;
  const els = ui.readEls || [];
  const intro = q.say || [q.show, q.q].filter(Boolean).join('. ');
  $('#b-speak').classList.add('talking');
  sound.sayParts([intro, ...ui.read()], i => {
    els.forEach((b, k) => b.classList.toggle('reading', k === i - 1));
    if (i < 0) $('#b-speak').classList.remove('talking');
  });
}

// Called once per question by its answer area. why: a tip for this exact mistake (a sorted item has its own).
function judge(right, why) {
  const { q } = G.current;
  sound.stopSpeech();
  $('#b-speak').classList.remove('talking');
  $$('#answers .reading').forEach(b => b.classList.remove('reading'));
  const key = qKey(G.level, entryOf(q));
  const power = G.current.power;
  G.current.why = why || q.why;
  setMode('feedback');
  G.fb = right ? 'right' : 'wrong';
  G.fbDur = 1.35;
  if (G.current.base) G.baseLeft--;
  if (right) {
    if (!power) G.correct++;
    if (S.missed[key]) S.missed[key] = Math.max(0, S.missed[key] - 1);
    sound.sfx('correct');
    G.coins += 5;
    bumpCoins();
    updateHud();
    aimAtChaser();
    hero.showWeapon(true);
    setTimeout(fire, 280);
    if (power) setTimeout(() => { if (G.mode === 'feedback') activatePower(power); }, 150);
  } else {
    S.missed[key] = (S.missed[key] || 0) + 1;
    sound.sfx('wrong');
    if (power) {
      // A missed power question just loses the power. No heart lost.
      const p = POWERS[power];
      fx.burst(G.h.x, 1.4, -G.h.dist - 1, { n: 14, colors: ['#888888', '#bbbbbb', p.color], speed: 3, up: 2, life: 0.7, size: 0.18 });
      for (let k = 0; k < 5; k++) fx.puff({ x: G.h.x + (Math.random() - 0.5), y: 1.4, z: -G.h.dist - 1, vy: 1, life: 0.8, size: 1.2, color: '#cccccc', alpha: 0.6, grow: 1.5 });
    } else {
      G.wrong++;
      // It comes back later in the run. A made question comes back as a new one of the same kind.
      if (G.tour) G.extra.push(entryOf(q)); else G.queue.push(entryOf(q));
      hurt();
      if (!G.boss) G.c.d = 1.9;
      hero.stumble();
    }
    $('#tip-text').textContent = G.current.why;
    setTimeout(() => {
      if (G.fb !== 'wrong' || G.mode !== 'feedback') return;
      $('#tip').hidden = false;
      if (S.settings.autoRead) sound.sayParts([G.current.why]);
    }, 600);
  }
  save();
}

const _aim = new THREE.Vector3();
// c.d is the gap to the chaser's nose, so a big one (like the spinosaurus) sits farther back and stays behind the camera.
function chaserZ() {
  const c = G.c, back = G.boss ? 0 : Math.max(0, (c.model.length || 2) / 2 - 2.3);
  return -(G.h.dist - c.d - back);
}
function chaserTarget(out = _aim) {
  const c = G.c;
  return out.set(c.x, (c.model.height || 1.5) * 0.55, chaserZ());
}
function aimAtChaser() { hero.aimAt(chaserTarget()); }

// Fires the equipped blaster at the chaser. Stronger blasters knock it farther back.
function fire(weaponId = S.equip.weapons, done) {
  if (G.mode !== 'feedback' && G.mode !== 'shop') return 0;
  const w = byId(WEAPONS, weaponId), c = G.c;
  const to = chaserTarget(new THREE.Vector3());
  hero.aimAt(to);
  const from = hero.muzzle(new THREE.Vector3());
  const t = fireWeapon(w.id, {
    fx, sound, from, to,
    chaser: { height: c.model.height || 1.5, length: c.model.length || 2 },
    hit: () => {
      if (G.boss) {
        if (!G.current?.power) bossHit();
        if (done) done();
        return;
      }
      c.spin = 0;
      c.knock = w.knock;
      G.hitStop = 0.07;
      G.cam.shake = Math.max(G.cam.shake, 0.35);
      sound.sfx('hit');
      if (done) done();
    },
    freeze: sec => { c.frozen = sec; },
    flash: (col, amt) => post.flash(col, amt),
    shake: amt => { G.cam.shake = Math.max(G.cam.shake, amt); },
  });
  G.fbDur = Math.max(1.35, 0.28 + t + 1.0);
  return t;
}

function afterAnswer() {
  $('#s-q').hidden = true;
  hero.showWeapon(false);
  sound.stopSpeech();
  sound.duck(false);
  const wasGate = !G.current?.power;
  setMode('run');
  // The sky and catch stages finish on their own, after their last hoop or round.
  if (G.sky || G.shoot) return;
  if (G.grab) { if (wasGate && G.grab.phase === 'gate') nextPhase(); return; }
  if (G.boss) { if (G.boss.hp <= 0 && !G.finished) bossDown(); return; }
  const done = G.tour ? G.baseLeft <= 0 && G.extra.length === 0 : G.queue.length === 0;
  if (done) finishRun();
}
function finishRun() {
  if (G.finished) return;
  G.finished = true;
  world.placeFinish(G.h.dist + 45);
  toast('FINISH!', '#ffd23f', 'flag');
}

$('#b-next').addEventListener('click', () => {
  if (G.mode !== 'feedback') return;
  sound.sfx('click');
  if (G.hearts <= 0) { $('#s-q').hidden = true; sound.duck(false); caught(); return; }
  afterAnswer();
});
$('#b-speak').addEventListener('click', () => {
  sound.unlock();
  if (G.mode === 'feedback' && G.fb === 'wrong') sound.sayParts([G.current.why]);
  else readQuestion();
});
$('#b-sky-speak').addEventListener('click', () => { sound.unlock(); readPick(); });
$('#b-tip-speak').addEventListener('click', () => { if (G.current) sound.sayParts([G.current.why || G.current.q.why]); });

// ---------- shop ----------
const shop = new Shop({ S, save, sound, preview: shopPreview });
let shopFrom = 'title';
function openShop() {
  sound.unlock();
  sound.sfx('click');
  shopFrom = G.mode === 'map' ? 'map' : 'title';
  setMode('shop');
  show('s-shop');
  resize();
  Object.assign(G, { shopFire: 0, shopCheer: 0, shopTrail: S.equip.trails, shopPower: null });
  G.c.d = 5.5; G.c.x = 0;
  shop.open();
}
function closeShop() {
  sound.sfx('click');
  G.previewWeapon = null;
  G.shopPower = null;
  hero.showWeapon(false);
  hero.setWeapon(S.equip.weapons);
  if (hero.id !== S.equip.runners) useRunner(S.equip.runners);
  G.h.y = 0;
  G.c.d = 4.2;
  if (shopFrom === 'map') showMap();
  else { setMode('title'); show('s-title'); $('#t-coins').textContent = S.coins; }
  resize();
}
// Shows the selected item on the runner: swap the model, test-fire the blaster, sparkle the trail or show the power.
function shopPreview(tab, id, how) {
  const h = G.h;
  if (how === 'buy') {
    fx.confetti(h.x, 2.6, -h.dist, 90);
    fx.ring(h.x, 0.2, -h.dist, '#ffd23f', 3.5, 0.5);
    sound.sfx('fanfare');
  }
  G.shopPower = tab === 'powers' ? id : null;
  if (tab === 'runners') {
    G.shopCheer = 0;
    useRunner(id).then(() => {
      if (hero.id !== id || G.mode !== 'shop') return;
      G.shopCheer = 1.9;
      fx.burst(h.x, 1, -h.dist, { n: 16, colors: ['#ffffff', '#ffd23f', '#7ff3ff'], speed: 3, up: 3, life: 0.6, size: 0.15, sparks: 20 });
    });
  } else if (tab === 'weapons') {
    G.previewWeapon = id;
    hero.setWeapon(id);
    G.shopCheer = 0;
    G.shopFire = 1.6 + (how === 'look' ? 0 : 0.3);
    G.c.spin = -1;
    G.c.model.root.rotation.x = 0;
    G.c.model.root.position.y = 0;
    hero.showWeapon(true);
    clearTimeout(G.shopShot);
    G.shopShot = setTimeout(() => { if (G.mode === 'shop' && G.previewWeapon === id) G.shopFire = Math.max(G.shopFire, 0.3 + fire(id)); }, 320);
  } else if (tab === 'trails') {
    G.shopTrail = id;
  } else if (tab === 'powers') {
    const p = POWERS[id];
    fx.ring(h.x, 0.2, -h.dist, p.color, 3, 0.5);
    fx.burst(h.x, 1.2, -h.dist, { n: 12, colors: [p.color, '#ffffff'], speed: 3, up: 3, life: 0.6, size: 0.15, sparks: 24, glow: 1.5 });
    if (id === 'double') fx.burst(h.x, 2.2, -h.dist, { n: 24, colors: ['#ffd23f', '#ffe066'], speed: 4, up: 5, life: 1, size: 0.22 });
    sound.sfx('powerOn');
  }
  if (tab !== 'trails') G.shopTrail = S.equip.trails;
}
function shopStep(dt, cdt) {
  const h = G.h, c = G.c;
  const firing = G.shopFire > 0;
  G.shopFire = Math.max(0, G.shopFire - dt);
  G.shopCheer = Math.max(0, G.shopCheer - dt);
  if (firing && G.shopFire === 0) hero.showWeapon(false);
  const hover = G.shopPower === 'jetpack' ? 0.6 + Math.sin(G.clock * 3) * 0.12 : G.shopPower === 'jump' ? Math.abs(Math.sin(G.clock * 3.2)) * 1.4 : 0;
  h.y = damp(h.y, hover, 8, dt);
  if (firing) aimAtChaser();
  hero.animate(firing ? 'zap' : G.shopCheer > 0 ? 'cheer' : hover > 0.3 && G.shopPower === 'jump' ? 'jump' : 'idle', dt, { t: G.clock, jumpY: h.y });
  c.model.animate(c.roarT > 0 ? 'roar' : 'idle', cdt, G.clock);
  if (c.spin < 0) c.d = damp(c.d, 5.5, 2, dt);
  else c.d = damp(c.d, 8 + 2 * (c.knock || 1), 3, dt);
  // Trails swirl around the runner so you can see the colors while standing still.
  const t = byId(TRAILS, G.shopTrail);
  if (t.colors.length && Math.random() < dt * 60) {
    const a = G.clock * 5 + Math.random() * 0.4, r = 0.75;
    fx.spark({ x: h.x + Math.cos(a) * r, y: h.y + 0.2 + ((G.clock * 1.3) % 1.6), z: -h.dist + Math.sin(a) * r, vy: 0.4, life: 0.8, size: t.id === 'stars' ? 0.5 : 0.36, color: t.colors[Math.floor(Math.random() * t.colors.length)], glow: 1.8 });
  }
  if (G.shopPower === 'jetpack' && Math.random() < dt * 40) jetPuff();
  if (G.shopPower === 'magnet' && Math.random() < dt * 8) {
    const a = Math.random() * Math.PI * 2;
    fx.spark({ x: h.x + Math.cos(a) * 3, y: 1.2, z: -h.dist + Math.sin(a) * 3, vx: -Math.cos(a) * 5, vz: -Math.sin(a) * 5, life: 0.55, size: 0.5, color: '#ffd23f', glow: 2 });
  }
}

$('#b-t-shop').addEventListener('click', openShop);
$('#b-m-shop').addEventListener('click', openShop);
$('#b-sh-back').addEventListener('click', closeShop);

// ---------- endings ----------
function caught() {
  setMode('caught');
  $('#s-q').hidden = true;
  G.c.spin = -1;
  $('#hint').hidden = true;
  sound.roar(G.c.type, true);
  sound.sfx('bite');
  sound.stopMusic(0.5);
  setTimeout(() => { if (G.mode === 'caught') sound.stinger('lose'); }, 650);
  flash('red');
  G.cam.shake = 0.8;
  S.coins += G.coins;
  save();
  setTimeout(() => {
    if (G.mode !== 'caught') return;
    show('s-caught');
    $('#hud').hidden = true;
    $('#k-ic').replaceChildren(icon(G.stage.chaser));
    $('#k-ic').style.setProperty('--c', G.stage.color);
    $('#k-coins').textContent = '+' + G.coins;
  }, 1700);
}

function clear() {
  setMode('clear');
  $('#s-q').hidden = true;
  $('#hint').hidden = true;
  G.c.spin = -1;
  const stars = G.wrong === 0 ? 3 : G.wrong <= 2 ? 2 : 1;
  const key = stageKey(G.level, G.stageIdx);
  const first = !S.stars[key];
  S.stars[key] = Math.max(S.stars[key] || 0, stars);
  S.coins += G.coins;
  save();
  sound.stopMusic(0.4);
  sound.stinger('win');
  setTimeout(() => { if (G.mode === 'clear') sound.voice(stars === 3 ? 'congratulations' : 'youWin'); }, 900);
  setTimeout(() => { if (G.mode === 'clear') sound.play('map'); }, 4200);
  fx.confetti(G.h.x, 2, -G.h.dist - 8, 160);
  setTimeout(() => {
    if (G.mode !== 'clear') return;
    show('s-clear');
    $('#hud').hidden = true;
    $('#w-coins').textContent = '+' + G.coins;
    const sr = $('#w-stars');
    sr.innerHTML = '';
    for (let k = 0; k < 3; k++) {
      const x = icon('star');
      sr.append(x);
      if (k < stars) setTimeout(() => { x.classList.add('on'); sound.stinger('star'); }, 350 + k * 350);
    }
    const hasNext = G.stageIdx + 1 < G.level.stages.length;
    $('#b-w-next').hidden = !hasNext;
    $('#w-unlock').hidden = !(first && hasNext);
    if (first && hasNext) {
      const nx = G.level.stages[G.stageIdx + 1];
      $('#w-unlock').replaceChildren(icon('unlock'), 'New: ' + nx.name);
    }
    $('#w-title').textContent = hasNext ? (stars === 3 ? 'PERFECT!' : 'YOU MADE IT!') : 'CHAMPION!';
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
$('#b-credits').addEventListener('click', () => { sound.unlock(); sound.sfx('click'); renderCredits($('#credits-text')); $('#s-credits').hidden = false; });
$('#b-credits-close').addEventListener('click', () => { sound.sfx('click'); $('#s-credits').hidden = true; });

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
  const windy = c.type === 'hurricane' && ['start', 'run', 'question', 'feedback', 'caught'].includes(G.mode);
  if (windy !== G.windy) { G.windy = windy; sound.loop('wind', windy); }
  c.roarT = Math.max(0, c.roarT - dt);
  // A frozen chaser stops moving until the ice breaks.
  const cdt = c.frozen > 0 ? 0 : dt;
  c.frozen = Math.max(0, c.frozen - dt);
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
      if (G.cue === 0 && G.t > 0.35) { G.cue = 1; toast('READY?', '#ffffff'); sound.voice('ready'); }
      if (G.cue === 1 && G.t > 1.25) { G.cue = 2; toast('GO!', '#7dff8a'); sound.voice('go'); sound.sfx('go'); }
      hero.animate(G.t > 1.1 ? 'run' : 'idle', dt, { t: G.clock });
      c.model.animate(G.t > 1.1 ? 'run' : 'roar', dt, G.clock);
      if (G.t > 1.45) { setMode('run'); if (G.sky) liftOff(); }
      break;
    }
    case 'run': runStep(dt); break;
    case 'shop': shopStep(dt, cdt); break;
    case 'question': {
      hero.animate(h.ground ? 'run' : 'jump', dt * 0.06, { jumpY: h.y });
      c.model.animate(c.roarT > 0 ? 'roar' : 'run', dt * 0.3, G.clock);
      c.d = damp(c.d, G.boss ? -bossGap() : 3.2, 3, dt);
      break;
    }
    case 'feedback': {
      if (G.fb === 'right') {
        aimAtChaser();
        hero.animate('zap', dt, { t: G.clock, forward: !!G.boss });
        c.model.animate('roar', cdt, G.clock);
        if (c.spin >= 0) c.d = damp(c.d, 11 + 4 * (c.knock || 1), 3, dt);
        if (G.t > G.fbDur) afterAnswer();
      } else if (G.current?.power) {
        hero.animate('run', dt * 0.06, { jumpY: h.y });
        c.model.animate('run', dt * 0.3, G.clock);
      } else if (G.boss) {
        // A wrong answer: the boss roars and gets farther away.
        hero.animate('run', dt * 0.06, { jumpY: h.y });
        c.model.animate('roar', dt * 0.5, G.clock);
        c.d = damp(c.d, -bossGap() - 6, 2, dt);
      } else {
        hero.animate('run', dt * 0.06, { jumpY: h.y });
        c.model.animate('attack', dt * 0.5, G.clock);
        c.d = damp(c.d, 1.9, 8, dt);
      }
      break;
    }
    case 'caught': {
      if (h.y > 0) h.y = Math.max(0, h.y - dt * 7);
      hero.animate('fall', dt, { t: G.clock });
      c.model.animate(G.boss ? 'roar' : 'attack', dt, G.clock);
      // The boss turns back and roars over him; the others pounce from behind.
      c.d = damp(c.d, G.boss ? -6 : 1.2, G.boss ? 2 : 5, dt);
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
  // The beaten boss tips over beside the trail and stays there.
  if (G.boss?.down >= 0) {
    c.d = h.dist - G.boss.at;
    G.boss.down += cdt;
    const k = Math.min(1, G.boss.down / 1.1);
    c.x = damp(c.x, 5.5, 2.5, dt);
    c.model.root.rotation.z = -k * k * Math.PI * 0.45;
  }
  // Knocked-back chaser does a backflip.
  if (c.spin >= 0) {
    c.spin += cdt * 1.6;
    const k = Math.min(1, c.spin);
    c.model.root.rotation.x = -k * Math.PI * 2;
    c.model.root.position.y = Math.sin(k * Math.PI) * 2.6;
    if (k >= 1) { c.spin = -1; c.model.root.rotation.x = 0; c.model.root.position.y = 0; }
  }
  if (G.boss?.flash > 0) G.boss.flash -= dt;
  hero.root.position.set(h.x, 0, -h.dist);
  hero.root.rotation.z = G.mode === 'run' ? (h.x - h.lane * LANE) * 0.08 : 0;
  updatePowerFx(dt);
  updateJetpack();
  if (G.mode !== 'run') hero.root.visible = true;
  c.model.root.position.x = c.x;
  c.model.root.position.z = chaserZ();
  // A flying chaser keeps up with a flying hero, and hovers low otherwise.
  if (c.model.flies) c.model.body.position.y = damp(c.model.body.position.y, Math.max(c.model.flies, h.y + 0.3), 3, dt);
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
    case 'intro': {
      const cz = z + G.c.d, ch = G.c.model?.height || 1.5, big = ch > 3;
      if (G.boss) {
        // Behind the runner, looking ahead at the boss.
        _pos.set(h.x + (portrait ? 1.6 : 3.0), 2.6, z + (portrait ? 7 : 5.5));
        _look.set(h.x, ch * 0.45, cz);
        rate = 3;
        break;
      }
      _pos.set(h.x + (portrait ? 2.2 : 3.4), big ? 2.8 : 1.8, z - (portrait ? 5.2 : 2.4));
      _look.set(h.x + 0.2, big ? 2.6 : ch * 0.5, z + G.c.d * 0.6);
      rate = 3;
      break;
    }
    case 'question':
    case 'feedback':
    case 'caught':
      if (G.boss) {
        // Over the shoulder toward the boss, so a blaster shot can be seen hitting it.
        _pos.set(h.x + (portrait ? 1.2 : 2.2), 4.2, z + (portrait ? 7 : 6));
        _look.set(h.x * 0.5, 2.6, z + G.c.d);
        rate = 4;
        break;
      }
    // falls through
    case 'start': {
      const side = portrait ? 1.1 : 2.6;
      // Lifted with a flying hero so he stays in the shot along with the chaser below.
      const lift = h.y * 0.7;
      _pos.set(h.x + side, (tall ? 3.0 : 2.4) + lift, z - (portrait ? 7.4 : 6.6));
      _look.set(h.x, (tall ? 2.1 : 1.3) + lift, z + 1.8);
      if (G.mode === 'start' && G.t > 0.9) { _pos.set(h.x * 0.5, portrait ? 5.0 : 4.5, z + (portrait ? 8.6 : 7.9)); _look.set(h.x * 0.3, 1.0, z - 10); }
      rate = G.mode === 'start' ? 3.5 : 6;
      break;
    }
    case 'shop': {
      _pos.set(h.x + (portrait ? 0.9 : 1.6), 1.75, z - (portrait ? 5.2 : 4.6));
      _look.set(h.x, 1.15, z + 1.5);
      rate = 4;
      break;
    }
    case 'clear': {
      _pos.set(h.x + 1.5, 2.2, z - 6);
      _look.set(h.x, 1.4, z);
      rate = 2.5;
      break;
    }
    default: {
      // Flying keeps the usual framing, just lifted with the hero; a normal jump only nudges the camera up.
      const lift = h.y * (h.jet ? 0.85 : 0.25);
      _pos.set(h.x * 0.5, (portrait ? 5.0 : 4.5) + lift, z + (portrait ? 8.6 : 7.9));
      _look.set(h.x * 0.3, 1.0 + (h.jet ? lift : 0), z - 10);
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
  fill.intensity = damp(fill.intensity, G.mode === 'run' || G.mode === 'paused' ? 0.15 : 1.5, 4, dt);
  // Lean into lane changes, and widen the view at high speed.
  G.cam.roll = damp(G.cam.roll || 0, G.mode === 'run' ? (h.lane * LANE - h.x) * 0.035 : 0, 8, dt);
  camera.rotateZ(G.cam.roll);
  const fov = damp(camera.fov, baseFov + (G.mode === 'run' ? G.fovKick : 0), 3, dt);
  if (Math.abs(fov - camera.fov) > 0.01) {
    camera.fov = fov;
    camera.updateProjectionMatrix();
    fx.setViewport(window.innerHeight * renderer.getPixelRatio(), fov);
  }
}

// ---------- quality ----------
// Step down a quality tier on slow devices so the game stays smooth, and remember it for next time.
// The first seconds of each run are skipped because shaders are still warming up.
let perfT = 0, perfN = 0, perfSkip = 0;
function perf(dt) {
  if (G.t < 3 || forcedQ) return;
  perfSkip = Math.max(0, perfSkip - dt);
  if (perfSkip > 0) return;
  perfT += dt; perfN++;
  if (perfT < 2.5) return;
  const avg = perfT / perfN;
  perfT = 0; perfN = 0;
  const i = QUALITY.indexOf(quality);
  if (avg > 1 / 42 && i > 0) {
    setQuality(QUALITY[i - 1]);
    S.quality = quality;
    save();
    perfSkip = 2;
  }
}

// ---------- loop ----------
let last = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (G.mode !== 'paused') {
    // Hit-stop: a split-second slow-down on big hits makes them feel heavy.
    let sdt = dt;
    if (G.hitStop > 0) { G.hitStop -= dt; sdt = dt * 0.1; }
    G.t += sdt;
    G.clock += sdt;
    update(sdt);
    const front = G.mode === 'start' || G.mode === 'question' || G.mode === 'feedback' || G.mode === 'caught';
    G.coinHide = damp(G.coinHide, front ? 1 : 0, 8, dt);
    world.coinGap = G.coinHide > 0.01 ? [G.h.dist - 1, G.h.dist + 9, G.coinHide] : null;
    // While the camera trails the runner it would sit inside the hurricane's funnel, so the hurricane fades away.
    const behind = G.mode === 'run' || (G.mode === 'start' && G.t > 0.9);
    G.c.fadeK = damp(G.c.fadeK ?? 1, behind ? 0 : 1, 10, dt);
    G.c.model?.fade(G.c.fadeK);
    world.update(sdt, G.h.dist, camera, G.h.x);
    fx.update(sdt);
  }
  // Before rendering: a quality change resizes the canvas, which would blank a frame that's already drawn.
  if (G.mode === 'run') perf(dt);
  updateCamera(dt);
  // Snow is bright enough to trip the bloom, which would wash the whole picture out.
  if (post.bloom) post.bloom.threshold = (world.biome && BIOME[world.biome].bloomAt) || 1.2;
  post.render(dt);
}

// Loads the world models, the runner and the first chaser, then starts the game loop.
async function boot() {
  const bar = $('#load-bar');
  const progress = k => { if (bar) bar.style.setProperty('--k', Math.min(1, k).toFixed(3)); };
  try {
    const fonts = document.fonts ? Promise.all(['64px "Lilita One"', '600 32px Fredoka'].map(f => document.fonts.load(f))).catch(() => {}) : null;
    await loadProps('./assets/world.glb', e => { if (e.total) progress(0.8 * e.loaded / e.total); });
    await Promise.race([fonts, new Promise(r => setTimeout(r, 3000))]);
    world = new World(scene, fx, renderer);
    jetpack = makeJetpack();
    world.setShadowSize(TIERS[quality].shadow);
    world.density = TIERS[quality].grass;
    progress(0.85);
    await Promise.all([useRunner(S.equip.runners), setChaser('bear')]);
    // A bought runner that won't load falls back to the default one. With no runner at all, show the error screen.
    if (!hero && !(await useRunner(RUNNERS[0].id))) throw new Error('The runner failed to load');
    progress(0.95);
  } catch (e) {
    console.error(e);
    $('#loading').classList.add('failed');
    return;
  }
  loadBlasters().catch(() => {});
  // The other chasers download in the background, so opening a stage doesn't wait on them.
  (async () => { for (const t of CHASERS) await chaserModel(t).catch(() => {}); })();
  showTitle();
  G.cam.pos.set(5, 2.6, -5);
  requestAnimationFrame(frame);
  await Promise.race([warmUp(), new Promise(r => setTimeout(r, 4000))]);
  progress(1);
  $('#loading').hidden = true;
}
boot();

// Compile every shader while the loading screen is up (hidden power-ups and one-shot effects too),
// so the first shield, jetpack or blaster shot doesn't hitch mid-run.
async function warmUp() {
  const g = new THREE.Group(), geo = new THREE.BoxGeometry(0.01, 0.01, 0.01);
  for (const m of [...warmMaterials(), additiveMat()]) g.add(new THREE.Mesh(geo, m));
  // Kept (hidden) in the scene: disposing these materials would release the compiled programs.
  g.visible = false;
  scene.add(g);
  try { await renderer.compileAsync(scene, camera); } catch (e) { console.warn('Shader warm-up failed', e); }
}

// Handy for testing in the console.
window.__critterRun = { G, S, get world() { return world; }, post, fx, camera, setQuality, scene, renderer, openStage: (i, lv = 0) => openStage(LEVELS[lv], i), save, activatePower, askPower, get hero() { return hero; }, debug: { clear, caught, pause, openShop, showMap, showTitle, ask: () => ask({ kind: 'review', seg: 0 }), show: q => showQuestion(q, {}) } };
