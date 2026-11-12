// Critter Run: a 3D runner where each test is a level and each question is a gate on the trail.
import * as THREE from 'three';
import { makeHero, makeChaser } from './models.js';
import { World, LANE } from './world.js';
import { FX, additiveMat } from './fx.js';
import { Sound } from './audio.js';
import { icon, iconMarkup, hydrateIcons } from './icons.js';
import { CREDITS } from './credits.js';
import { Post, TIERS } from './post.js';
import { bend } from './gfx.js';
import { loadRunner, loadBlasters } from './actors.js';
import { loadChaser, makeHurricane, CHASER_DEFS } from './chasers.js';
import { POWERS, TIMED_POWERS, RUNNERS, WEAPONS, TRAILS, byId, initShopSave, powerTime } from './items.js';
import { fireWeapon, warmMaterials } from './weapons.js';
import { Shop } from './shop.js';
import { renderPortrait } from './portrait.js';

const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
const again = (e, cls) => { e.classList.remove(cls); void e.offsetWidth; e.classList.add(cls); };
// A row of level pictures (icon names), each in a tile of the stage's color.
function pics(names, color) {
  return [].concat(names || []).map(n => { const p = el('span', 'pic'); p.style.setProperty('--c', color); p.append(icon(n)); return p; });
}
hydrateIcons();
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const shade = (hex, k = 0.35) => '#' + new THREE.Color(hex).multiplyScalar(k).getHexString();
const damp = (a, b, rate, dt) => a + (b - a) * (1 - Math.exp(-rate * dt));
const shuffle = a => { a = [...a]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

// A jump lasts about a second and clears roughly 9 m of trail, so a jump pressed a bit early still makes it.
const BASE_SPEED = 11.2, SPEED_GAIN = 0.005, MAX_GAIN = 4.5;
const GRAVITY = 22, JUMP_V = 10.4, SUPER_JUMP = 1.4;
const SLIDE_TIME = 0.75, JUMP_BUFFER = 0.2;
const STAND_H = 1.7, SLIDE_H = 0.85;
// Clipping a low obstacle with your feet while this high (as a fraction of its height) smashes it instead of hurting.
const STOMP_K = 0.45;
const JET_Y = 5.2, MAGNET_R = 5.5;
const MAX_HEARTS = 5;
const GATE_FIRST = 80, GATE_GAP = 122;
const SEGMENT = 180; // length of each region in the final run
const CHASE_D = 10; // how far behind the chaser normally runs (just behind the camera, so it never blocks the path)

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
const qKey = (level, q) => `${level.id}|${q.show || ''}|${q.q}`;
const isOpen = (level, i) => i === 0 || (S.stars[stageKey(level, i - 1)] || 0) > 0;

// ---------- renderer ----------
const canvas = $('#game');
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
} catch (e) {
  $('#loading').innerHTML = '<div class="nogl">This game needs WebGL.<br>Try Chrome or Safari.</div>';
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
const world = new World(scene, fx, renderer);
const sound = new Sound(S.settings);
const post = new Post(renderer, scene, camera);
const QUALITY = ['low', 'mid', 'high'];
const forcedQ = new URLSearchParams(location.search).get('q');
const phone = matchMedia('(pointer: coarse)').matches || Math.min(screen.width, screen.height) < 700;
let quality = QUALITY.includes(forcedQ) ? forcedQ : QUALITY.includes(S.quality) ? S.quality : phone ? 'mid' : 'high';
function setQuality(q) {
  quality = q;
  post.setTier(q);
  world.setShadowSize(TIERS[q].shadow);
  world.grassAmount = TIERS[q].grass;
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
// The voxel kid stands in until the animated runner has loaded (or if it can't load).
let hero = makeHero();
scene.add(hero.root);
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
    r.root.position.copy(hero.root.position);
    scene.remove(hero.root);
    hero = r;
    scene.add(hero.root);
    hero.setWeapon(G.previewWeapon || S.equip.weapons);
  }
  return true;
}
// Real animal models load in the background. Until one arrives an invisible stand-in holds its place (and the
// stage won't start); the old block animal only shows up if the model can't load at all.
const chasers = {}, chaserLoads = {};
const pending = type => ({ root: new THREE.Group(), animate() {}, height: CHASER_DEFS[type].length * 0.45, length: CHASER_DEFS[type].length, pending: true });
function chaserModel(type) {
  if (!chasers[type]) chasers[type] = type === 'hurricane' ? makeHurricane() : pending(type);
  if (CHASER_DEFS[type] && !chaserLoads[type]) {
    chaserLoads[type] = loadChaser(type).catch(e => {
      console.warn('Chaser failed to load', type, e);
      return makeChaser(type === 'spider' ? 'scorpion' : type);
    }).then(m => {
      chasers[type] = m;
      if (G.c.type === type) setChaser(type);
    });
  }
  return chasers[type];
}
const chaserReady = type => !chasers[type]?.pending;

// ---------- game state ----------
const G = {
  mode: 'title', t: 0, clock: 0,
  level: null, stageIdx: 0, stage: null, tour: false, segments: [],
  h: newHero(),
  c: { d: 4, x: 0, spin: -1, model: null, type: null, roarT: 0, frozen: 0, knock: 0 },
  pow: {}, fbDur: 1.35, hitStop: 0, fovKick: 0, trailT: 0, previewWeapon: null,
  hearts: MAX_HEARTS, coins: 0, wrong: 0, correct: 0, needed: 0,
  queue: [], extra: [], extraPlaced: 0, baseLeft: 0, nextGate: GATE_FIRST, planned: 0,
  current: null, fb: null, finished: false,
  cam: { pos: new THREE.Vector3(0, 4, 8), look: new THREE.Vector3(0, 1, -6), shake: 0, snap: true },
  pausedFrom: null,
};

setQuality(quality);
resize();

function newHero() {
  return { dist: 0, lane: 0, x: 0, y: 0, vy: 0, ground: true, slow: 1, inv: 0, safe: 0, dustT: 0, slide: 0, slideNext: false, jumpBuf: 0, jet: false };
}

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

// Starts the world now, then once the regions' scenery models have loaded, rebuilds it with them
// (only if nothing has moved on in the meantime).
let worldToken = 0;
function startWorld(cfg, biomes, { before = () => {}, after = () => {} } = {}) {
  const token = ++worldToken;
  const run = () => { before(); world.start(cfg); after(); };
  run();
  if (world.isPrepared(biomes)) return Promise.resolve();
  return world.prepare(biomes).then(() => {
    if (token !== worldToken || G.h.dist > 1) return;
    run();
  });
}

function sceneryOnly(biome) {
  startWorld({ biomeAt: () => biome, onChunk: () => [], wantsHeart: () => false, color: '#ff4081' }, [biome], { after: () => { world.noObstaclesFrom = -Infinity; } });
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
    const sec = el('div', 'm-level');
    sec.append(el('div', 'm-title', level.name));
    const path = el('div', 'm-path');
    level.stages.forEach((st, i) => {
      const stars = S.stars[stageKey(level, i)] || 0;
      const open = isOpen(level, i);
      const b = el('button', 'stop' + (open ? '' : ' locked') + (open && !stars ? ' next' : '') + (st.biome === 'tour' ? ' final' : ''));
      b.style.setProperty('--c', st.color);
      b.style.setProperty('--off', [0, 1, 0, -1][i % 4]);
      const medal = el('span', 'medal');
      medal.append(icon(open ? st.chaser : 'lock'));
      const sr = el('span', 'stars');
      for (let k = 0; k < 3; k++) sr.append(icon(k < stars ? 'star-gold' : 'star-empty'));
      b.append(medal, el('span', 'name', st.name), sr);
      b.setAttribute('aria-label', st.name + (open ? '' : ' (locked)'));
      if (open) b.addEventListener('click', () => { sound.sfx('click'); openStage(level, i); });
      else b.addEventListener('click', () => { sound.sfx('nope'); again(b, 'nope'); });
      path.append(b);
    });
    sec.append(path);
    list.append(sec);
    requestAnimationFrame(() => drawTrail(path));
  }
  syncToggles();
}

// A dashed trail winds from medal to medal, like a board-game path.
function drawTrail(path) {
  path.querySelector('svg.trail')?.remove();
  const box = path.getBoundingClientRect();
  const pts = [...path.querySelectorAll('.medal')].map(m => {
    const r = m.getBoundingClientRect();
    return [r.left + r.width / 2 - box.left, r.top + r.height / 2 - box.top];
  });
  if (pts.length < 2) return;
  let d = `M${pts[0][0]} ${pts[0][1]}`;
  for (let i = 1; i < pts.length; i++) {
    const [x0, y0] = pts[i - 1], [x1, y1] = pts[i], my = (y0 + y1) / 2;
    d += ` C${x0} ${my} ${x1} ${my} ${x1} ${y1}`;
  }
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', 'trail');
  svg.innerHTML = `<path d="${d}" fill="none" stroke="rgba(10,16,48,.45)" stroke-width="16" stroke-linecap="round"/>`
    + `<path d="${d}" fill="none" stroke="#fff6d8" stroke-width="7" stroke-linecap="round" stroke-dasharray="2 16"/>`;
  path.prepend(svg);
}
window.addEventListener('resize', () => { if (G.mode === 'map') $$('.m-path').forEach(drawTrail); });

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
  G.biomes = G.tour ? G.segments.map(s => s.biome) : [stage.biome];
  G.goWhenReady = false;
  $('#b-go').classList.remove('busy');
  // Gates are planned as the track is built, so planning starts over whenever the world does.
  const replan = () => { G.nextGate = GATE_FIRST; G.planned = 0; G.nextMore = 0; G.extraPlaced = 0; };
  G.ready = startWorld({ biomeAt, onChunk, wantsHeart: () => G.hearts < MAX_HEARTS, color: stage.color, powers: POWERS, pickPower }, G.biomes, { before: replan })
    .then(() => chaserLoads[stage.chaser])
    .then(() => { $('#b-go').classList.remove('busy'); if (G.goWhenReady && G.mode === 'intro') go(); });
  fx.clear();
  G.h = newHero();
  clearPowers();
  setChaser(stage.chaser);
  G.c.d = 4.2; G.c.x = 0; G.c.spin = -1;
  // Start fetching the next stage's chaser so it's ready when this one is cleared.
  if (level.stages[i + 1]) chaserModel(level.stages[i + 1].chaser);
  // The final run gets one big song of its own; every other stage plays its region's song.
  sound.play(G.tour ? 'tour' : stage.biome);

  setMode('intro');
  show('s-intro');
  sound.stopSpeech();
  sound.duck(false);
  $('#s-q').hidden = true;
  $('#hud').hidden = true;
  $('#i-foe').replaceChildren(icon(stage.chaser));
  $('#i-name').textContent = stage.name;
  $('#i-icons').replaceChildren(...pics(stage.icons, stage.color));
  $('#s-intro .panel').style.setProperty('--c', stage.color);
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
    ev.push({ type: 'gate', at: s + 60, kind: 'review', seg: k });
    // A slot for a missed question, only if one is waiting.
    if (G.extra.length - G.extraPlaced > 0) { G.extraPlaced++; ev.push({ type: 'gate', at: s + 105, kind: 'extra' }); }
    if (k < own.length) ev.push({ type: 'gate', at: s + 150, kind: 'order', idx: k });
  }
  // Past the last region, keep offering gates for missed questions until they are all right.
  if (G.planned >= n) {
    if (!G.nextMore) G.nextMore = n * SEGMENT + 45;
    while (G.nextMore < d1) { ev.push({ type: 'gate', at: G.nextMore, kind: 'more' }); G.nextMore += 80; }
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
function pickReview(seg) { return pickWeighted(G.segments[seg].questions); }
function powerQuestion() {
  const pool = G.tour ? G.level.stages.flatMap(s => s.questions) : G.stage.questions;
  const last = G.current?.q;
  const list = pool.length > 1 ? pool.filter(q => q !== last) : pool;
  return pickWeighted(list);
}

function go() {
  sound.unlock();
  // Still fetching this region's scenery: spin the button and start as soon as it's ready.
  if (!world.isPrepared(G.biomes || []) || !chaserReady(G.stage.chaser)) { G.goWhenReady = true; $('#b-go').classList.add('busy'); sound.sfx('click'); return; }
  sound.sfx('voice-ready');
  show(null);
  setMode('start');
  roar();
  $('#hud').hidden = false;
  updateHud();
}

function roar() {
  G.c.roarT = 1.1;
  sound.sfx('roar', G.c.type);
  G.cam.shake = Math.max(G.cam.shake, 0.25);
}

// ---------- HUD ----------
function updateHud() {
  const hearts = $('#hearts');
  if (hearts.dataset.n !== String(G.hearts)) {
    hearts.dataset.n = G.hearts;
    hearts.replaceChildren(...Array.from({ length: MAX_HEARTS }, (_, i) => icon(i < G.hearts ? 'life' : 'life-empty')));
  }
  $('#coin-n').textContent = G.coins;
  const dots = $('#dots');
  if (dots.childElementCount !== G.needed) { dots.innerHTML = ''; for (let i = 0; i < G.needed; i++) dots.append(document.createElement('i')); }
  [...dots.children].forEach((d, i) => d.classList.toggle('on', i < G.correct));
  const mon = $('#c-mon');
  if (mon.dataset.type !== G.c.type) { mon.dataset.type = G.c.type; mon.replaceChildren(icon(G.c.type)); }
}
function bumpCoins() {
  $('#coin-n').textContent = G.coins;
  again($('#coins'), 'bump');
}
function flash(color = 'red') {
  const f = $('#flash');
  f.className = ''; void f.offsetWidth; f.className = color;
}
let toastTimer = 0;
// A big pop-up word or picture in the middle of the screen. ico is an optional icon name shown before the text.
function toast(text, color = '#fff', ico = null) {
  const t = $('#toast');
  t.replaceChildren(...(ico ? [icon(ico)] : []), ...(text ? [el('span', null, text)] : []));
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
  h.ground = false;
  h.slide = 0;
  h.jumpBuf = 0;
  sound.sfx('jump');
  if (G.pow.jump) fx.ring(h.x, 0.15, -h.dist, POWERS.jump.color, 2.5, 0.4);
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
  const speed = runSpeed() * h.slow * (h.jet ? 1.25 : 1);
  h.dist += speed * dt;
  h.x = damp(h.x, h.lane * LANE, 18, dt);
  if (h.jet) {
    h.y = damp(h.y, JET_Y, 4, dt);
    h.vy = 0;
    if (Math.random() < dt * 40) jetPuff();
  } else if (!h.ground) {
    h.vy -= GRAVITY * dt;
    h.y += h.vy * dt;
    if (h.y <= 0) {
      h.y = 0; h.vy = 0; h.ground = true;
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

  // Chaser drifts back to its usual spot after lunging or being knocked away.
  G.c.d = damp(G.c.d, CHASE_D, G.c.d < CHASE_D ? 0.8 : 0.6, dt);
  G.c.x = damp(G.c.x, h.x, 3, dt);

  hero.animate(heroPose(), dt, { speed, jumpY: h.y });
  G.c.model.animate(G.c.roarT > 0 ? 'roar' : 'run', dt, G.clock);
  hero.root.visible = h.inv <= 0 || Math.floor(h.inv * 12) % 2 === 0;
  G.fovKick = h.jet ? 6 : (speed - BASE_SPEED) * 1.2;

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
      if (S.settings.autoRead) sound.sayParts([s.label]);
    }
  }
  if (world.finish && h.dist >= world.finish.dist) clear();
  if (!S.hinted && G.t > 0.2 && G.t < 0.4) showHint('move');
  if (!S.hinted && G.t > 5) { S.hinted = true; save(); $('#hint').hidden = true; }
  // The first time a bar shows up, point down so he knows to slide under it.
  if (!S.hintedSlide && G.hint !== 'slide') {
    const bar = world.obstacles.find(o => o.over && !o.hit && o.dist - h.dist > 0 && o.dist - h.dist < 22);
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
  $('#hint').innerHTML = kind === 'slide'
    ? `<span class="hand down">${iconMarkup('hand')}</span><span class="arrows">${iconMarkup('down')}</span>`
    : `<span class="hand">${iconMarkup('hand')}</span><span class="arrows">${iconMarkup('left')}${iconMarkup('up')}${iconMarkup('right')}</span>`;
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
  const k = G.h.jet ? 1 : clamp((speed - 12.8) / 3, 0, 1);
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
  const b = world.biome && ({ mountains: '#b8946a', foothills: '#c97a55', sandhills: '#f0dca0', farmland: '#b38a5f', swamp: '#9fc6b0', beach: '#ffffff' })[world.biome];
  for (let i = 0; i < n; i++) fx.spawn({ x: G.h.x + (Math.random() - 0.5) * 0.5, y: 0.1, z: -G.h.dist + 0.3, vx: (Math.random() - 0.5) * 1.5, vy: 0.8 + Math.random(), vz: -6 - Math.random() * 2, life: 0.4, size: 0.1 + Math.random() * 0.08, color: b || '#ccc', g: -2 });
}

function collide() {
  const h = G.h;
  const top = h.y + (h.slide > 0 ? SLIDE_H : STAND_H);
  for (const o of world.obstacles) {
    if (o.hit) continue;
    // Hit boxes are a little smaller than the models, so near misses count as misses.
    if (Math.abs(o.dist - h.dist) > o.d / 2 + 0.12) continue;
    if (Math.abs(o.x - h.x) > o.w / 2 + 0.18) continue;
    // Bars have a gap underneath (o.y0). Everything else starts at the ground.
    if (h.y >= o.h - 0.25 || top <= o.y0 + 0.05) continue;
    o.hit = true;
    smash(o);
    // A jump that was a bit early or late still clips the top of a low obstacle: it breaks, he bounces, no harm.
    if (o.low && h.y > o.h * STOMP_K) { stomp(); continue; }
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
    if (!c.alive || Math.abs(c.dist - h.dist) > 0.9 || Math.abs(c.x - h.x) > 0.9 || Math.abs(c.y - (h.y + 0.9)) > 1.2) continue;
    c.alive = false;
    G.coins += G.pow.double ? 2 : 1;
    bumpCoins();
    sound.sfx('coin');
    fx.burst(c.x, c.y, -c.dist, { n: 5, colors: G.pow.double ? ['#ffe066', '#ff9f1c', '#ffffff'] : ['#ffe066', '#ffffff'], speed: 2, up: 2, life: 0.4, size: 0.12, g: -4, floor: false, sparks: 3 });
  }
  for (const k of world.crates) {
    if (k.taken || Math.abs(k.dist - h.dist) > 1.1 || Math.abs(k.x - h.x) > 1.1 || h.y > 2.2) continue;
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
    if (ht.taken || Math.abs(ht.dist - h.dist) > 1 || Math.abs(ht.x - h.x) > 1) continue;
    ht.taken = true;
    ht.mesh.visible = false;
    G.hearts = Math.min(MAX_HEARTS, G.hearts + 1);
    sound.sfx('heart');
    fx.burst(ht.x, 1.3, -ht.dist, { n: 16, colors: ['#ff2d55', '#ff9ab0', '#ffffff'], speed: 3, up: 3, life: 0.7, size: 0.15, g: -6 });
    updateHud();
    toast('+1', '#d42f4f', 'life');
  }
}

// Debris colors by what the obstacle is made of.
const WOOD = ['#7a5232', '#a07040', '#5c3d22', '#c8975a'], ROCK = ['#7d838c', '#a3a8b0', '#5f656e', '#8e8a80'], SAND = ['#e2cc96', '#c9ae74', '#f0dcae'], HAY = ['#e5c15a', '#c9a23f', '#f2d98a'];
const DEBRIS = {
  log: WOOD, logPile: WOOD, bigLog: WOOD, crate: WOOD, crates: WOOD, barrels: WOOD, stump: WOOD, logStack: WOOD, logOver: WOOD, mossBranch: ['#6b5a3a', '#8a9a6a', '#a7b89d'],
  boulder: ROCK, rockWall: ROCK, sandFlat: SAND, sandRocks: ['#c99a5b', '#ddb479', '#a87a4b'], sandBlock: ['#c99a5b', '#ddb479', '#a87a4b'], castle: SAND,
  hay: HAY, hayStack: HAY, cooler: ['#2e86de', '#ffffff', '#dfe6ee'], tractor: ['#2f7d32', '#f1c40f', '#333333'], lifeguard: ['#c0392b', '#ecf0f1', '#8a6c48'],
  banner: ['#e74c3c', '#f1c40f', '#3498db', '#2ecc71'], net: ['#ffffff', '#cccccc'], pipe: ['#c3c9d1', '#8a8f97', '#a65a3a'], boom: ['#c3c9d1', '#8a8f97'],
};
function smash(o) {
  o.mesh.visible = false;
  sound.sfx('smash');
  const y = o.over ? o.y0 + 0.6 : 0.6;
  fx.burst(o.x, y, -o.dist, { n: 26, colors: DEBRIS[o.type] || WOOD, speed: 5, up: 6, life: 1.2, size: 0.16 });
  for (let i = 0; i < 6; i++) fx.puff({ x: o.x + (Math.random() - 0.5) * 1.5, y: y * 0.5, z: -o.dist, vx: (Math.random() - 0.5) * 3, vy: 1 + Math.random() * 2, life: 0.9, size: 1.3, color: '#cdbfa8', alpha: 0.5, grow: 1.5, drag: 2 });
}

// Coming down on top of a low obstacle bounces him back up; rising through it just carries on.
function stomp() {
  const h = G.h;
  if (h.vy < 0) { h.vy = 7; h.ground = false; sound.sfx('stomp'); }
  G.cam.shake = Math.max(G.cam.shake, 0.18);
  fx.ring(h.x, 0.25, -h.dist, '#ffffff', 2.2, 0.35);
}

// ---------- power-ups ----------
// A crate gives a question. Only a right answer turns the power on.
const shieldBubble = (() => {
  const m = new THREE.Mesh(new THREE.IcosahedronGeometry(1.25, 3), new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uTime: { value: 0 }, uCol: { value: new THREE.Color(POWERS.shield.color) } },
    vertexShader: 'varying vec3 vN; varying vec3 vV; varying vec3 vP; void main(){ vP = position; vec4 mv = modelViewMatrix * vec4(position,1.); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }',
    fragmentShader: 'uniform float uTime; uniform vec3 uCol; varying vec3 vN; varying vec3 vV; varying vec3 vP; void main(){ float f = pow(1. - abs(dot(vN, vV)), 2.2); float hex = step(.92, fract(vP.y * 4. + uTime * .6)) * .25; gl_FragColor = vec4(uCol * (f * 1.6 + hex + .06), 1.); }',
  }));
  m.visible = false;
  m.renderOrder = 5;
  scene.add(m);
  return m;
})();

// A little rocket backpack shown while the jetpack power is on.
const jetpack = (() => {
  const g = new THREE.Group();
  const red = bend(new THREE.MeshStandardMaterial({ color: '#e63946', roughness: 0.45 }), { rim: 0.4 });
  const metal = bend(new THREE.MeshStandardMaterial({ color: '#d9dee6', roughness: 0.3, metalness: 0.6 }), { rim: 0.3 });
  const dark = bend(new THREE.MeshStandardMaterial({ color: '#333a44', roughness: 0.6 }));
  const pack = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.5, 0.18), red);
  g.add(pack);
  for (const x of [-0.17, 0.17]) {
    const tank = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.55, 14), metal);
    tank.position.set(x, -0.02, 0.1);
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.1, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), red);
    cap.position.set(x, 0.255, 0.1);
    const nozzle = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.1, 0.12, 12), dark);
    nozzle.position.set(x, -0.35, 0.1);
    g.add(tank, cap, nozzle);
  }
  g.traverse(o => { if (o.isMesh) o.castShadow = true; });
  g.visible = false;
  scene.add(g);
  return g;
})();
function updateJetpack() {
  const h = G.h;
  jetpack.visible = h.jet || (G.mode === 'shop' && G.shopPower === 'jetpack');
  if (jetpack.visible) jetpack.position.set(h.x, h.y + 1.05, -h.dist + 0.27);
}

function pickPower() {
  const ids = [...TIMED_POWERS];
  if (G.hearts < MAX_HEARTS - 1) ids.push('hearts', 'hearts');
  const free = ids.filter(id => !G.pow[id]);
  const list = free.length ? free : ids;
  return list[Math.floor(Math.random() * list.length)];
}

function activatePower(id) {
  const p = POWERS[id];
  sound.sfx('powerOn');
  setTimeout(() => sound.sfx('voice-power-up'), 350);
  post.flash(p.color, 0.25);
  fx.ring(G.h.x, 0.3, -G.h.dist, p.color, 4, 0.5);
  fx.burst(G.h.x, 1.2, -G.h.dist, { n: 30, colors: [p.color, '#ffffff'], speed: 5, up: 5, life: 0.9, size: 0.18, sparks: 40, glow: 2 });
  toast(p.name, shade(p.color), p.icon);
  if (id === 'hearts') {
    G.hearts = Math.min(MAX_HEARTS, G.hearts + 2);
    updateHud();
    return;
  }
  G.pow[id] = { t: powerTime(id, S.upgrades[id] || 0) };
  G.pow[id].total = G.pow[id].t;
  if (id === 'jetpack') {
    const h = G.h;
    h.jet = true; h.ground = false; h.slide = 0;
    sound.sfx('jet');
    const len = runSpeed() * 1.25 * G.pow[id].t;
    world.skyCoins(h.dist + 18, h.dist + len - 8, JET_Y - 0.9 + 0.2);
  }
  renderPowers();
}

function endPower(id) {
  delete G.pow[id];
  sound.sfx('powerOff');
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
    const b = el('div', 'pw');
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
  G.c.d = Math.min(G.c.d, 2.4);
  roar();
  updateHud();
  const hs = $('#hearts');
  hs.classList.remove('hurt'); void hs.offsetWidth; hs.classList.add('hurt');
}

// ---------- questions ----------
function ask(gate) {
  let q = null;
  if (!G.tour) {
    // Don't repeat the question he just answered at a crate.
    if (G.queue.length > 1 && G.queue[0] === G.current?.q) G.queue.splice(1, 0, G.queue.shift());
    q = G.queue.shift();
  } else if (gate.kind === 'review') q = pickReview(gate.seg);
  else if (gate.kind === 'order') q = G.stage.questions[gate.idx];
  else if (gate.kind === 'extra') { q = G.extra.shift(); G.extraPlaced = Math.max(0, G.extraPlaced - 1); }
  else q = G.extra.shift();
  if (!q) return;
  showQuestion(q, { gate, base: G.tour && (gate.kind === 'review' || gate.kind === 'order') });
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

  const answers = shuffle([q.a, ...shuffle(q.wrong).slice(0, 3)]);
  G.current.answers = answers;
  const tint = power ? power.color : G.stage.color;
  $('#q-pics').replaceChildren(...pics(q.pic, tint));
  $('#q-pics').hidden = !q.pic;
  $('#q-show').textContent = q.show || '';
  $('#q-show').hidden = !q.show;
  $('#q-text').textContent = q.q;
  $('#q-card').style.setProperty('--c', tint);
  const box = $('#answers');
  box.innerHTML = '';
  answers.forEach((a, i) => {
    const b = el('button', 'btn ans');
    b.dataset.i = i;
    b.append(el('span', null, a));
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

// Colors an answer button and pins a check or a cross to its corner.
function mark(b, how) {
  b.classList.add(how);
  const m = el('span', 'mark');
  m.append(icon(how === 'right' ? 'check' : 'close'));
  b.append(m);
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
  const power = G.current.power;
  setMode('feedback');
  G.fb = right ? 'right' : 'wrong';
  G.fbDur = 1.35;
  if (G.current.base) G.baseLeft--;
  if (right) {
    mark(btns[i], 'right');
    btns.forEach((b, k) => { if (k !== i) b.classList.add('dim'); });
    if (!power) G.correct++;
    if (S.missed[key]) S.missed[key] = Math.max(0, S.missed[key] - 1);
    sound.sfx('correct');
    if (G.correct % 3 === 0 && !power) setTimeout(() => sound.sfx('voice-great-job'), 500);
    G.coins += 5;
    bumpCoins();
    updateHud();
    aimAtChaser();
    hero.showWeapon(true);
    setTimeout(fire, 280);
    if (power) setTimeout(() => { if (G.mode === 'feedback') activatePower(power); }, 150);
  } else {
    mark(btns[i], 'wrong');
    btns.forEach((b, k) => { if (answers[k] === q.a) setTimeout(() => mark(b, 'right'), 350); else if (k !== i) b.classList.add('dim'); });
    S.missed[key] = (S.missed[key] || 0) + 1;
    sound.sfx('wrong');
    if (power) {
      // A missed power question just loses the power. No heart lost.
      const p = POWERS[power];
      fx.burst(G.h.x, 1.4, -G.h.dist - 1, { n: 14, colors: ['#888888', '#bbbbbb', p.color], speed: 3, up: 2, life: 0.7, size: 0.18 });
      for (let k = 0; k < 5; k++) fx.puff({ x: G.h.x + (Math.random() - 0.5), y: 1.4, z: -G.h.dist - 1, vy: 1, life: 0.8, size: 1.2, color: '#cccccc', alpha: 0.6, grow: 1.5 });
    } else {
      G.wrong++;
      if (G.tour) G.extra.push(q); else G.queue.push(q);
      hurt();
      G.c.d = 1.9;
      hero.stumble();
    }
    $('#tip-text').textContent = q.why;
    setTimeout(() => {
      if (G.fb !== 'wrong' || G.mode !== 'feedback') return;
      $('#tip').hidden = false;
      if (S.settings.autoRead) sound.sayParts([q.why]);
    }, 600);
  }
  save();
}

const _aim = new THREE.Vector3();
function chaserTarget(out = _aim) {
  const c = G.c;
  return out.set(c.x, (c.model.height || 1.5) * 0.55, -(G.h.dist - c.d));
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
  const done = G.tour ? G.baseLeft <= 0 && G.extra.length === 0 : G.queue.length === 0;
  if (done && !G.finished) {
    G.finished = true;
    world.placeFinish(G.h.dist + 45);
    toast(null, '#c27a00', 'finish');
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

// ---------- shop ----------
const shop = new Shop({ S, save, sound, preview: shopPreview, thumb });
// Shop cards show real renders of the runners and blasters, made once and cached.
const portraits = new Map();
function thumb(tab, id) {
  const k = tab + ':' + id;
  if (portraits.has(k)) return portraits.get(k);
  let p = null;
  if (tab === 'runners') {
    p = (runnerCache.has(id) ? Promise.resolve(runnerCache.get(id)) : loadRunner(byId(RUNNERS, id)).then(r => { runnerCache.set(id, r); return r; }))
      .then(r => {
        if (r !== hero) r.animate('idle', 0.5, { t: 0 });
        return renderPortrait(renderer, r.root, { yaw: Math.PI - 0.45, pitch: 0.06, focus: 0.74, fill: 1.55, env: scene.environment });
      });
  } else if (tab === 'weapons') {
    p = loadBlasters().then(set => (set[id] ? renderPortrait(renderer, set[id].clone(), { yaw: Math.PI / 2 + 0.35, pitch: 0.3, fill: 0.95, env: scene.environment }) : null));
  }
  if (p) portraits.set(k, p.catch(() => null));
  return portraits.get(k) || null;
}
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
// Counts a coin total up from zero with a little tick, so the reward feels earned.
function countUp(node, n) {
  const t0 = performance.now(), dur = Math.min(1200, 300 + n * 12);
  node.textContent = '+0';
  const step = now => {
    const k = Math.min(1, (now - t0) / dur);
    node.textContent = '+' + Math.round(n * k * (2 - k));
    if (k < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

function caught() {
  setMode('caught');
  G.c.spin = -1;
  $('#hint').hidden = true;
  sound.sfx('roar', G.c.type);
  setTimeout(() => sound.sfx('caught'), 500);
  flash('red');
  G.cam.shake = 0.8;
  S.coins += G.coins;
  save();
  setTimeout(() => {
    if (G.mode !== 'caught') return;
    show('s-caught');
    $('#hud').hidden = true;
    $('#k-foe').replaceChildren(icon(G.stage.chaser));
    countUp($('#k-coins'), G.coins);
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
  const last = G.stageIdx + 1 >= G.level.stages.length;
  setTimeout(() => sound.sfx(last ? 'voice-you-win' : 'voice-level-complete'), 900);
  sound.play('map');
  fx.confetti(G.h.x, 2, -G.h.dist - 8, 160);
  setTimeout(() => {
    if (G.mode !== 'clear') return;
    show('s-clear');
    $('#hud').hidden = true;
    $('#w-title').textContent = ['NICE!', 'NICE!', 'GREAT!', 'PERFECT!'][stars];
    countUp($('#w-coins'), G.coins);
    const sr = $('#w-stars');
    sr.replaceChildren(...[0, 1, 2].map(() => icon('star-empty')));
    for (let k = 0; k < stars; k++) {
      setTimeout(() => {
        if (G.mode !== 'clear') return;
        const st = icon('star-gold', 'on');
        sr.children[k].replaceWith(st);
        sound.sfx('star');
      }, 450 + k * 380);
    }
    const hasNext = G.stageIdx + 1 < G.level.stages.length;
    $('#b-w-next').hidden = !hasNext;
    $('#w-unlock').hidden = !(first && hasNext);
    if (first && hasNext) {
      const foe = el('span', 'foe');
      foe.append(icon(G.level.stages[G.stageIdx + 1].chaser));
      $('#w-unlock').replaceChildren(icon('unlock'), foe);
      setTimeout(() => { if (G.mode === 'clear') sound.sfx('unlock'); }, 450 + stars * 380 + 300);
    }
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
$('#b-credits').addEventListener('click', () => {
  sound.unlock();
  sound.sfx('click');
  const body = $('#credits-body');
  if (!body.childElementCount) for (const sec of CREDITS) body.append(el('h4', null, sec.title), ...sec.lines.map(l => el('p', null, l)));
  show('s-credits');
  body.scrollTop = 0;
});
$('#b-cr-back').addEventListener('click', () => { sound.sfx('click'); show('s-title'); });

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
      hero.animate(G.t > 1.0 ? 'run' : 'idle', dt, { t: G.clock });
      c.model.animate('roar', dt, G.clock);
      if (G.t > 1.25) { setMode('run'); sound.sfx('go'); sound.sfx('voice-go'); }
      break;
    }
    case 'run': runStep(dt); break;
    case 'shop': shopStep(dt, cdt); break;
    case 'question': {
      hero.animate(h.ground ? 'run' : 'jump', dt * 0.06, { jumpY: h.y });
      c.model.animate(c.roarT > 0 ? 'roar' : 'run', dt * 0.3, G.clock);
      c.d = damp(c.d, 3.2, 3, dt);
      break;
    }
    case 'feedback': {
      if (G.fb === 'right') {
        aimAtChaser();
        hero.animate('zap', dt, { t: G.clock });
        c.model.animate('roar', cdt, G.clock);
        if (c.spin >= 0) c.d = damp(c.d, 11 + 4 * (c.knock || 1), 3, dt);
        if (G.t > G.fbDur) afterAnswer();
      } else if (G.current?.power) {
        hero.animate('run', dt * 0.06, { jumpY: h.y });
        c.model.animate('run', dt * 0.3, G.clock);
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
    c.spin += cdt * 1.6;
    const k = Math.min(1, c.spin);
    c.model.root.rotation.x = -k * Math.PI * 2;
    c.model.root.position.y = Math.sin(k * Math.PI) * 2.6;
    if (k >= 1) { c.spin = -1; c.model.root.rotation.x = 0; c.model.root.position.y = 0; }
  }
  hero.root.position.set(h.x, 0, -h.dist);
  hero.root.rotation.z = G.mode === 'run' ? (h.x - h.lane * LANE) * 0.08 : 0;
  updatePowerFx(dt);
  updateJetpack();
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
      // Lifted with a flying hero so he stays in the shot along with the chaser below.
      const lift = h.y * 0.7;
      _pos.set(h.x + side, (tall ? 3.0 : 2.4) + lift, z - (portrait ? 7.4 : 6.6));
      _look.set(h.x, (tall ? 2.1 : 1.3) + lift, z + 1.8);
      if (G.mode === 'start' && G.t > 0.9) { _pos.set(h.x * 0.55, 3.55, z + 6.1); _look.set(h.x * 0.35, 1.35, z - 6); }
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
      _pos.set(h.x * 0.55, 3.55 + lift, z + 6.1);
      _look.set(h.x * 0.35, 1.35 + (h.jet ? lift : 0), z - 6);
      rate = 7;
    }
  }
  // The hurricane is taller than the view. When it lunges in front of the run camera, it opens a window
  // around him so he can still see what's coming.
  if (G.c.model?.setNear) {
    const runCam = G.mode === 'run' || G.mode === 'paused' || (G.mode === 'start' && G.t > 0.9);
    const near = runCam ? 1 - clamp((G.c.d - 8.5) / 1.1, 0, 1) : 0;
    G.c.near = damp(G.c.near || 0, near, 6, dt);
    G.c.model.setNear(G.c.near);
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
    world.update(sdt, G.h.dist, camera, G.h.x);
    fx.update(sdt);
  }
  updateCamera(dt);
  world.cull(camera, G.h.dist);
  post.render(dt);
  if (G.mode === 'run') perf(dt);
}

showTitle();
G.cam.pos.set(5, 2.6, -5);
requestAnimationFrame(frame);
loadBlasters().catch(() => {});
const wait = ms => new Promise(r => setTimeout(r, ms));
// The loading bar follows every file the loaders fetch (models, textures) plus the fonts.
THREE.DefaultLoadingManager.onProgress = (url, done, total) => loadProgress(done / Math.max(1, total));
function loadProgress(p) { $('#load-fill').style.setProperty('--p', Math.max(Number($('#load-fill').style.getPropertyValue('--p')) || 0, p).toFixed(3)); }
Promise.race([Promise.all([document.fonts.ready, useRunner(S.equip.runners), chaserLoads.bear, world.prepare(['mountains'])]), wait(20000)])
  .then(() => Promise.race([warmUp(), wait(4000)]))
  .finally(() => {
    loadProgress(1);
    setTimeout(() => { $('#loading').classList.add('done'); setTimeout(() => { $('#loading').hidden = true; }, 600); }, 250);
  });

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
window.__critterRun = { G, S, world, post, fx, camera, setQuality, openStage: (i, lv = 0) => openStage(LEVELS[lv], i), save, activatePower, askPower, caught, clear, get hero() { return hero; } };
