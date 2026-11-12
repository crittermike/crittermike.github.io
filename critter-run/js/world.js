// The running world: biomes, streamed track chunks, obstacles, pickups, gates, sky, and backdrop.
// Everything you see is a real model from assets/world.glb (see assets/CREDITS.md), merged per chunk so the
// whole world draws in a handful of calls. Only the ground, trail surface, water and sky are generated.
import * as THREE from 'three';
import { Builder, M, U, bend, waterMaterial, textTexture, rng as mkRng, fbm, noise2 } from './gfx.js';
import { prop, PROP_MATS, propGeometry, recolored } from './props.js';
import { pathTexture, groundTexture, PATH_LEN } from './textures.js';

export const LANE = 2.2;
export const CHUNK = 30;
const TRACK = 3.8; // half width of the trail
const AHEAD = 190;
const BEHIND = 90; // track kept behind the hero so the camera can look back at the chaser
const SIDE = 140; // ground reaches this far to each side
const TAU = Math.PI * 2;
const smooth = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

// Props that sway in the wind (drawn with the foliage material).
const FOLIAGE = new Set(['treeRoundA', 'treeRoundB', 'treeRoundC', 'treeUmbrellaA', 'treeUmbrellaB',
  'pineA', 'pineB', 'pineC', 'pineOrange', 'pineYellow', 'pineClump', 'pineSingle', 'willow', 'treeAutumn', 'treeColumn', 'palm1', 'palm2', 'palm3',
  'palmetto', 'palmettoLady', 'palmK', 'palmBendK', 'palmDetailK', 'peachTree', 'appleTree', 'longleafA', 'longleafB', 'longleafC', 'cornRow', 'corn']);

const _m = new THREE.Matrix4(), _p = new THREE.Vector3(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _s = new THREE.Vector3(), _tc = new THREE.Color();

// Builders for one chunk, one per material.
class Batch {
  constructor() { this.by = new Map(); }
  get(key) {
    let b = this.by.get(key);
    if (!b) { b = new Builder({ uv: key.startsWith('tex:') || key === 'path' || key === 'ground' }); this.by.set(key, b); }
    return b;
  }
  // o: { s (number or [x,y,z]), rx, ry, rz, tint (color multiplier), sway (override), shadow: false }
  prop(key, x, y, z, o = {}) {
    const p = prop(key);
    if (!p) return this;
    const s = o.s ?? 1;
    _m.compose(_p.set(x, y, z), _q.setFromEuler(_e.set(o.rx || 0, o.ry || 0, o.rz || 0)), Array.isArray(s) ? _s.set(s[0], s[1], s[2]) : _s.setScalar(s));
    const tint = o.tint ? _tc.set(o.tint) : null;
    const sway = o.sway ?? FOLIAGE.has(key);
    for (const part of p.parts) {
      const mat = part.mat === 'vcol' ? (sway ? 'foliage' : 'solid') : part.mat;
      this.get(mat).add(part.geo, _m, tint, { x: o.shadow === false ? 999 : x, z });
    }
    return this;
  }
}

// ---------- obstacles ----------
// Each type is built once from props into a merged mesh. w/d/h is the collision box (meters); over types are
// bars with a gap of y0 underneath to slide through.
const R90 = Math.PI / 2;
const OB = {
  // Blue Ridge
  log: { low: true, w: 2.0, d: 0.85, h: 0.82, build: b => b.prop('logA', 0, 0.31, 0, { ry: R90, s: [1.15, 1.1, 1.5] }) },
  rock: { low: true, w: 1.7, d: 1.1, h: 0.85, build: b => b.prop('rockA', 0, 0.45, 0, { s: [1.75, 1.0, 1.35] }).prop('rockC', 0.75, 0.2, 0.3, { s: 0.45, ry: 1 }) },
  boulder: { low: false, w: 2.0, d: 1.7, h: 2.8, build: b => b.prop('boulderH', 0, 1.32, 0, { s: [1.05, 1.35, 1.0] }) },
  boulderTall: { low: false, w: 2.0, d: 1.7, h: 2.8, build: b => b.prop('rockTallG', 0.2, 0, 0, { s: [1.15, 1.5, 1.1], ry: 0.4 }) },
  fallenTree: { over: true, w: 2.2, d: 0.8, h: 2.5, y0: 1.2, build: b => {
    for (const sx of [-1, 1]) b.prop('rockSlab', sx * 1.15, 0, 0, { s: [1.0, 1.15, 0.9], ry: sx > 0 ? 0 : Math.PI });
    b.prop('logMoss', 0, 1.25, 0, { ry: R90, s: [0.85, 0.85, 0.8] });
  } },
  bigLog: { low: true, wide: true, w: 7.2, d: 0.9, h: 0.85, build: b => b.prop('logLong', 0, 0, 0, { s: [2.05, 0.83, 0.85] }).prop('mushrooms', 2.2, 0.75, 0.1, { s: 0.45 }) },
  // Piedmont
  textiles: { low: true, w: 1.8, d: 1.2, h: 0.85, build: b => b.prop('textiles', 0, 0.03, 0, { s: [1.1, 0.88, 0.72], ry: 0 }) },
  crates: { low: true, w: 1.9, d: 0.9, h: 0.86, build: b => b.prop('crate', -0.47, 0, 0, { s: 1.03 }).prop('crate', 0.47, 0, 0.04, { s: 1.03, ry: 0.15 }) },
  cart: { low: false, w: 2.1, d: 2.8, h: 2.7, build: b => b.prop('cartHigh', 0, 0, 0, { s: [0.95, 1.25, 0.8], ry: Math.PI }) },
  banner: { over: true, w: 2.2, d: 0.6, h: 2.6, y0: 1.2, build: b => {
    b.prop('poles', 0, 0, 1.1, { ry: R90, s: [1, 1.45, 0.95] });
    b.prop('bannerRed', 0, 0.95, 1.0, { ry: R90, s: [1, 0.68, 1.55] });
  } },
  // Sandhills
  cactus: { low: true, w: 1.8, d: 0.6, h: 0.86, build: b => b.prop('pricklyPear', -0.45, 0, 0, { s: 0.86, ry: 0.2 }).prop('pricklyPear', 0.5, 0, 0.05, { s: 0.78, ry: -0.4 }) },
  sandRock: { low: true, w: 1.75, d: 1.2, h: 0.85, build: b => b.prop('rockSandA', 0, 0, 0, { s: [1.05, 0.72, 0.85] }) },
  sandBoulder: { low: false, w: 2.1, d: 1.9, h: 2.75, build: b => b.prop('rocksSand', 0.15, 0, 0, { s: [0.42, 0.86, 0.42] }) },
  cactusTall: { low: false, w: 1.7, d: 0.7, h: 2.8, build: b => b.prop('cactusTall', 0, 0, 0, { ry: R90, s: 1.4 }) },
  pipe: { over: true, w: 2.2, d: 0.75, h: 2.5, y0: 1.22, build: b => {
    for (const sx of [-1, 1]) b.prop('strut', sx * 1.2, 0, 0, { s: [0.6, 0.98, 0.6] });
    b.prop('pipeYellow', 1.3, 1.6, 0, { rz: R90, s: [0.36, 1.3, 0.36] });
  } },
  // Inner Coastal Plain
  hay: { low: true, w: 1.85, d: 1.05, h: 0.86, build: b => b.prop('haySquare', 0, 0, 0, { ry: R90, s: [1.0, 0.95, 1.02] }) },
  pumpkins: { low: true, w: 1.9, d: 1.0, h: 0.8, build: b => b.prop('pumpkin', -0.48, 0, 0, { s: 1.12 }).prop('pumpkin', 0.5, 0, 0.1, { s: 1.0, ry: 1.2 }) },
  tractor: { low: false, w: 2.0, d: 3.2, h: 2.75, build: b => b.prop('tractor', 0, 0, 0, { s: [1.0, 1.15, 0.95], ry: 0 }) },
  haystack: { low: false, w: 2.1, d: 1.7, h: 2.8, build: b => b.prop('haystack', 0, 0, 0, { s: [0.55, 0.93, 0.62] }) },
  irrigation: { over: true, w: 2.2, d: 0.75, h: 2.5, y0: 1.22, build: b => {
    for (const sx of [-1, 1]) b.prop('strut', sx * 1.2, 0, 0, { s: [0.6, 0.98, 0.6] });
    b.prop('pipeRed', 1.3, 1.6, 0, { rz: R90, s: [0.36, 1.3, 0.36] });
  } },
  // Outer Coastal Plain
  stump: { low: true, w: 1.75, d: 1.2, h: 0.84, build: b => b.prop('stumpMoss', 0, 0, 0, { s: [1.15, 1.2, 1.0] }) },
  swampLog: { low: true, w: 2.0, d: 0.8, h: 0.8, build: b => b.prop('logB', 0, 0.41, 0, { ry: R90, s: [1.45, 1.45, 1.42] }) },
  logStack: { low: false, w: 1.8, d: 1.5, h: 2.95, build: b => b.prop('logStack', 0, 0, 0, { s: 1.05 }).prop('logStack', 0.05, 1.5, 0.02, { s: 0.98, ry: 0.06 }) },
  snag: { low: false, w: 1.7, d: 1.6, h: 2.8, build: b => b.prop('stumpTall', 0, 0, 0, { s: [1.6, 1.4, 1.45] }) },
  mossBranch: { over: true, w: 2.2, d: 0.7, h: 2.6, y0: 1.22, build: b => {
    for (const sx of [-1, 1]) b.prop('stumpTall', sx * 1.18, 0, 0, { s: [0.55, 0.78, 0.55], ry: sx });
    b.prop('logB', 0, 1.65, 0, { ry: R90, s: [0.75, 0.75, 1.8] });
    for (const x of [-0.8, -0.25, 0.35, 0.85]) b.prop('moss', x, 1.38, -1.42 * 0.3, { s: [0.9, 0.3, 0.3] });
  } },
  // Coastal Zone
  sandcastle: { low: true, w: 1.6, d: 1.1, h: 0.84, build: b => b.prop('sandcastle', 0, 0, 0, { s: [1.9, 1.05, 1.1] }).prop('starfish', 0.6, 0.02, 0.6, { s: 1.4 }) },
  coolers: { low: true, w: 2.0, d: 0.9, h: 0.81, build: b => b.prop('cooler', -0.52, 0, 0, { s: 1.45 }).prop('cooler', 0.52, 0, 0.05, { s: 1.45, ry: 0.15, tint: '#ff8080' }) },
  lifeguard: { low: false, w: 1.4, d: 1.3, h: 2.9, build: b => b.prop('guardTower', 0, 0, 0, { s: 0.72 }) },
  surfboards: { low: false, w: 1.9, d: 0.6, h: 2.75, build: b => {
    [['#ffffff', -0.62], ['#7fd0ff', 0], ['#ffd23f', 0.62]].forEach(([c, x], i) => b.prop('surfboard', x, 0, 0, { s: 1.25, ry: R90 + (i - 1) * 0.2, tint: c }));
  } },
  dock: { over: true, w: 2.2, d: 1.6, h: 2.6, y0: 1.22, build: b => {
    b.prop('dockPlatform', 0, 0, 0, { s: [0.92, 1.12, 0.6] });
    b.prop('barrel', -0.5, 1.45, 0, { s: 0.95 }).prop('crate', 0.45, 1.45, 0.05, { s: 0.9, ry: 0.3 });
  } },
};
const obGeo = new Map();
function obstacleMesh(type) {
  let parts = obGeo.get(type);
  if (!parts) {
    const b = new Batch();
    OB[type].build(b);
    parts = [...b.by].map(([k, bl]) => [k, bl.build()]);
    obGeo.set(type, parts);
  }
  const g = new THREE.Group();
  for (const [k, geo] of parts) {
    const m = new THREE.Mesh(geo, k === 'solid' || k === 'foliage' ? M.solid : PROP_MATS.get(k));
    m.frustumCulled = false;
    m.castShadow = m.receiveShadow = true;
    g.add(m);
  }
  return g;
}

// ---------- biomes ----------
// height(x, z): ground height beside the trail (the trail itself is always at 0).
// ground(x, z, h, out): ground color. decor(scene): scenery for one chunk.
const mix3 = (out, a, b, t) => out.copy(a).lerp(b, t);
const col = s => new THREE.Color(s);

export const BIOME = {
  mountains: {
    sky: ['#3d8fe8', '#cfe6fb'], hemi: ['#d7ecff', '#4a6b35'], fog: [55, 190], path: 'dirt', dust: '#b8946a',
    backdrop: { style: 'peaks', colors: ['#5776a8', '#7590bd', '#9fb4d6'], amp: [80, 66, 54] },
    obstacles: { low: ['log', 'rock'], tall: ['boulder', 'boulderTall'], over: ['fallenTree'], wide: 'bigLog' },
    height: (x, z) => { const a = Math.abs(x); return smooth(6, 50, a) * (3 + 16 * fbm(x * 0.022 + 40, z * 0.018)) + smooth(5, 12, a) * 0.6 * noise2(x * 0.2, z * 0.2); },
    ground: (() => { const a = col('#2f7330'), b = col('#5f9f3f'), d = col('#8a8048'), r = col('#8b8f86'); return (x, z, h, out) => { mix3(out, a, b, smooth(0.3, 0.72, fbm(x * 0.07, z * 0.07))); out.lerp(d, smooth(0.62, 0.8, noise2(x * 0.045 + 5, z * 0.045)) * 0.55); return out.lerp(r, smooth(9, 16, h) * 0.55); }; })(),
    decor(s) {
      const { r } = s;
      s.edge(['grassA', 'grassC', 'rockA', 'rockC', 'grassTallC', 'flowersTall'], 9);
      for (let i = 0; i < 4; i++) s.place(s.pick(['bushC', 'bushE', 'bushLow']), s.side() * (5.5 + r() * 5), s.z(), { s: 0.8 + r() * 0.6 });
      for (let i = 0; i < 2; i++) s.place('mushrooms', s.side() * (4.8 + r() * 3), s.z(), { s: 0.6 + r() * 0.5 });
      for (let i = 0; i < 6; i++) s.place(r() < 0.18 ? s.pick(['pineOrange', 'pineYellow']) : s.pick(['pineA', 'pineB', 'pineB']), s.side() * (8 + r() * 14), s.z(), { s: 0.8 + r() * 0.6 });
      for (let i = 0; i < 9; i++) s.place(r() < 0.15 ? 'pineOrange' : s.pick(['pineB', 'pineC', 'pineClump']), s.side() * (22 + r() * 60), s.z(), { s: 1 + r() * 1.2 });
      for (let i = 0; i < 2; i++) s.place(s.pick(['rockTallG', 'boulderE', 'rockSlab']), s.side() * (6 + r() * 10), s.z(), { s: 0.5 + r() * 0.6, y: -0.15 });
      if (r() < 0.5) s.place(s.pick(['cliffJ', 'cliffK', 'spireN']), s.side() * (16 + r() * 20), s.z(), { s: 1.6 + r() * 2.2, y: -0.5 });
      if (r() < 0.5) s.place(s.pick(['logMoss', 'stumpMoss']), s.side() * (5.5 + r() * 4), s.z(), {});
      if (r() < 0.32) s.waterfall(s.side() * (13 + r() * 6), s.z(0.3, 0.7), 8 + r() * 5);
    },
  },
  foothills: {
    sky: ['#3a9ef0', '#d8efff'], hemi: ['#e0f3ff', '#4f7a3a'], fog: [55, 190], path: 'clay', dust: '#c97a55',
    backdrop: { style: 'rolling', colors: ['#5f9f6e', '#7fb38a', '#a3c9ab'], amp: [34, 30, 26] },
    obstacles: { low: ['textiles', 'crates'], tall: ['cart', 'boulder'], over: ['banner', 'fallenTree'] },
    height: (x, z) => { const a = Math.abs(x); return smooth(7, 34, a) * (1.5 + 7 * fbm(x * 0.025 + 7, z * 0.022)); },
    ground: (() => { const a = col('#3f8f37'), b = col('#79b84f'), c2 = col('#2f7a33'), y = col('#b3b04f'); return (x, z, h, out) => { mix3(out, a, b, smooth(0.3, 0.72, fbm(x * 0.06, z * 0.06))); out.lerp(y, smooth(0.66, 0.82, noise2(x * 0.05 + 9, z * 0.05)) * 0.4); return out.lerp(c2, smooth(0.55, 0.8, noise2(x * 0.03, z * 0.03)) * 0.5); }; })(),
    decor(s) {
      const { r } = s;
      s.edge(['grassA', 'grassC', 'flowers', 'flowersTall', 'grassTallC'], 9);
      if (r() < 0.6) s.fence(s.side() * 5.2);
      for (let i = 0; i < 3; i++) s.place(s.pick(['peachTree', 'appleTree']), s.side() * (7 + r() * 7), s.z(), { s: 0.85 + r() * 0.3 });
      for (let i = 0; i < 7; i++) s.place(s.pick(['treeRoundA', 'treeRoundB', 'treeRoundC', 'treeUmbrellaB', 'treeAutumn']), s.side() * (14 + r() * 45), s.z(), { s: 0.9 + r() * 0.7 });
      if (r() < 0.25) s.place(s.pick(['cart', 'signpost']), s.side() * (5.6 + r() * 1.5), s.z(), { ry: R90 + (r() - 0.5) * 0.6 });
      for (let i = 0; i < 3; i++) s.place(s.pick(['bushC', 'bushE', 'bushLow']), s.side() * (5.5 + r() * 6), s.z(), { s: 0.8 + r() * 0.5 });
      const roll = r();
      if (roll < 0.3) s.place('mill', s.side() * (34 + r() * 8), s.z(0.3, 0.7), { ry: R90 * (r() < 0.5 ? 1 : -1), smoke: [[-6, 15.5, 4], [6, 15.5, 4]] });
      else if (roll < 0.5) { const sx = s.side(); s.place('brickA', sx * (26 + r() * 6), s.z(0.2, 0.4), { ry: sx * R90, s: 0.75, smoke: [[0, 11, 0]] }); s.place('brickB', sx * (27 + r() * 6), s.z(0.6, 0.8), { ry: sx * R90, s: 0.75 }); }
      else if (roll < 0.68) s.place('farmhouse', s.side() * (24 + r() * 8), s.z(0.3, 0.7), { ry: R90 * (r() < 0.5 ? 1 : -1), s: 0.85 });
      else if (roll < 0.8) s.waterfall(s.side() * (14 + r() * 5), s.z(0.3, 0.7), 5 + r() * 3);
      if (r() < 0.4) s.place(s.pick(['textilesB', 'crateOpen', 'wheelbarrow', 'barrel']), s.side() * (5 + r() * 2), s.z(), { ry: r() * TAU });
    },
  },
  sandhills: {
    sky: ['#4aaaf2', '#fbefcf'], hemi: ['#fff4d6', '#b89a5a'], fog: [55, 200], path: 'sand', dust: '#f0dca0',
    backdrop: { style: 'dunes', colors: ['#d8b26a', '#e3c58b', '#ecd8ae'], amp: [24, 20, 17] },
    obstacles: { low: ['cactus', 'sandRock'], tall: ['sandBoulder', 'cactusTall'], over: ['pipe'] },
    height: (x, z) => { const a = Math.abs(x); return smooth(5, 26, a) * (0.8 + 4.5 * Math.abs(Math.sin(x * 0.07 + fbm(x * 0.02, z * 0.03) * 4)) * fbm(x * 0.03 + 3, z * 0.02 + 5)); },
    ground: (() => { const a = col('#e3c27f'), b = col('#f2dca3'), g = col('#a8a85a'); return (x, z, h, out) => { mix3(out, a, b, fbm(x * 0.05, z * 0.05)); return out.lerp(g, smooth(0.6, 0.85, noise2(x * 0.08, z * 0.08)) * 0.45); }; })(),
    decor(s) {
      const { r } = s;
      s.edge(['grassA', 'scrubA', 'rockC', 'rockSandA'], 6, { tint: '#d9c98a' });
      for (let i = 0; i < 4; i++) s.place(s.pick(['scrubA', 'scrubB', 'pricklyPear', 'cactusRound', 'pricklyFlower']), s.side() * (5 + r() * 7), s.z(), { s: 0.7 + r() * 0.5 });
      for (let i = 0; i < 6; i++) s.place(s.pick(['longleafA', 'longleafB', 'longleafC']), s.side() * (9 + r() * 30), s.z(), { s: 1.4 + r() * 0.9 });
      for (let i = 0; i < 4; i++) s.place(s.pick(['longleafB', 'pineC', 'treeUmbrellaA']), s.side() * (35 + r() * 50), s.z(), { s: 1.3 + r() * 1 });
      for (let i = 0; i < 2; i++) s.place(s.pick(['rocksSand', 'rockSandB']), s.side() * (7 + r() * 12), s.z(), { s: 0.5 + r() * 0.5, y: -0.2 });
      if (r() < 0.55) { const tx = s.side() * (15 + r() * 4); s.place('tower', tx, s.z(0.4, 0.6), { s: 0.6, ry: 0, sway: false }); s.wires(tx); }
      if (r() < 0.22) s.dam(s.side() * 55, s.z(0.5, 0.5));
    },
  },
  farmland: {
    sky: ['#3399f0', '#e2f5ff'], hemi: ['#e8f7ff', '#5a8a3a'], fog: [60, 210], path: 'farm', dust: '#b38a5f',
    backdrop: { style: 'trees', colors: ['#4f8f4a', '#76ad6e', '#a1c99a'], amp: [12, 11, 10] },
    obstacles: { low: ['hay', 'pumpkins'], tall: ['tractor', 'haystack'], over: ['irrigation'] },
    height: (x, z) => smooth(12, 70, Math.abs(x)) * 2.5 * fbm(x * 0.02, z * 0.02),
    ground: (() => { const a = col('#4a9636'), b = col('#86bf52'), y = col('#c2b25a'); return (x, z, h, out) => { mix3(out, a, b, smooth(0.3, 0.72, fbm(x * 0.05, z * 0.05))); return out.lerp(y, smooth(0.62, 0.8, noise2(x * 0.04 + 3, z * 0.04)) * 0.45); }; })(),
    decor(s) {
      const { r } = s;
      s.edge(['grassA', 'grassC', 'wheat', 'flowers'], 7);
      for (const sx of [-1, 1]) s.crops(sx, s.pick(['corn', 'wheat', 'soy']));
      if (r() < 0.5) s.fence(s.side() * 5.0, 'fence');
      const roll = r();
      if (roll < 0.35) { const sx = s.side(); s.place(s.pick(['barn', 'barnSmall', 'barnOpen']), sx * (27 + r() * 5), s.z(0.3, 0.5), { ry: -sx * R90 }); if (r() < 0.7) s.place(s.pick(['silo', 'siloHouse']), sx * (36 + r() * 4), s.z(0.6, 0.8), {}); if (r() < 0.5) s.place('chickenCoop', sx * (19 + r() * 3), s.z(0.1, 0.3), { ry: -sx * R90 }); }
      else if (roll < 0.5) s.place('windmill', s.side() * (30 + r() * 10), s.z(0.4, 0.6), { ry: r() * TAU });
      else if (roll < 0.62) s.place('waterTower', s.side() * (32 + r() * 10), s.z(0.4, 0.6), {});
      if (r() < 0.4) s.place('tractor', s.side() * (12 + r() * 8), s.z(), { ry: r() * TAU });
      for (let i = 0; i < 3; i++) if (r() < 0.5) s.place(s.pick(['hayRound', 'haySquare', 'haySheaf']), s.side() * (6 + r() * 4), s.z(), { ry: r() * TAU });
      if (r() < 0.3) s.place('scarecrow', s.side() * (9 + r() * 5), s.z(), { ry: (r() - 0.5) * 0.6 });
      for (let i = 0; i < 5; i++) s.place(s.pick(['treeRoundA', 'treeRoundB', 'treeColumn']), s.side() * (55 + r() * 25), s.z(), { s: 1.1 + r() * 0.5 });
    },
  },
  swamp: {
    sky: ['#5b9c94', '#d4e4cf'], hemi: ['#d6eadb', '#2f4a30'], fog: [40, 160], path: 'boards', dust: '#9fc6b0', boardwalk: true,
    water: { deep: '#294a35', shallow: '#56795a', y: -0.32, opacity: 0.9, ripple: 0.6, speed: 0.5 },
    backdrop: { style: 'trees', colors: ['#365f45', '#557f62', '#7fa58b'], amp: [20, 17, 14] },
    obstacles: { low: ['stump', 'swampLog'], tall: ['logStack', 'snag'], over: ['mossBranch'] },
    height: (x, z) => { const a = Math.abs(x); return -0.9 + 1.15 * smooth(0.48, 0.66, fbm(x * 0.035 + 11, z * 0.035)) * smooth(4.5, 8, a) + smooth(30, 90, a) * 0.6; },
    ground: (() => { const a = col('#4a6b3c'), b = col('#6d8a4a'), m = col('#5a4a33'); return (x, z, h, out) => { mix3(out, m, a, smooth(-0.6, -0.1, h)); return out.lerp(b, fbm(x * 0.08, z * 0.08) * 0.5); }; })(),
    decor(s) {
      const { r } = s;
      for (let i = 0; i < 10; i++) s.water(s.pick(['lilyA', 'lilyB', 'lilyFlower']), s.side() * (4.4 + r() * 14), s.z(), { s: 0.8 + r() * 0.8 });
      for (let i = 0; i < 6; i++) s.place(s.pick(['cattails', 'reedsB', 'cattailTall', 'reedsA']), s.side() * (4.6 + r() * 10), s.z(), { s: 0.9 + r() * 0.6, any: true });
      for (let i = 0; i < 6; i++) s.cypress(s.side() * (7 + r() * 18), s.z());
      for (let i = 0; i < 7; i++) { const k = s.pick(['willow', 'willow', 'deadTree']); s.place(k, s.side() * (24 + r() * 50), s.z(), { s: 1.1 + r() * 0.8, any: true, tint: k === 'deadTree' ? '#8d9aa3' : null }); }
      for (let i = 0; i < 2; i++) s.place(s.pick(['stumpMoss', 'logMoss', 'stumpTall']), s.side() * (5 + r() * 8), s.z(), { ry: r() * TAU, any: true, y: -0.1 });
      if (r() < 0.4) { const sx = s.side(), z = s.z(0.3, 0.7); s.island(sx * 16, z, 7); s.place('logPile', sx * 15, z + 1.5, { ry: 0.3, any: true, y: 0.2 }); s.place('logStack', sx * 17.5, z - 2, { ry: -0.4, any: true, y: 0.2 }); }
      if (r() < 0.35) s.water(s.pick(['canoe', 'rowboat']), s.side() * (8 + r() * 6), s.z(), { ry: r() * TAU, y: 0.05 });
      if (r() < 0.2) { const sx = s.side(); s.place('cabinPiers', sx * (30 + r() * 10), s.z(0.3, 0.7), { ry: sx * R90, any: true, y: -0.3 }); }
      else if (r() < 0.25) { const sx = s.side(); s.place('dockLong', sx * (9.5 + r() * 2), s.z(0.3, 0.7), { ry: sx * R90, any: true, y: -0.9 }); }
      s.fireflies();
    },
  },
  beach: {
    sky: ['#1f9cf5', '#dff6ff'], hemi: ['#e8f9ff', '#c9b585'], fog: [70, 230], path: 'beach', dust: '#ffffff', ocean: true,
    water: { deep: '#0f6fae', shallow: '#3fd0d8', y: -0.12, opacity: 0.94, ripple: 1.1, speed: 1, foam: 1 },
    backdrop: { style: 'sea', colors: ['#2a8fc4', '#5cb7de', '#8fd0ea'], amp: [3, 4, 5] },
    obstacles: { low: ['sandcastle', 'coolers'], tall: ['lifeguard', 'surfboards'], over: ['dock'] },
    height: (x, z) => (x < 0 ? smooth(-6, -28, x) * (1 + 3.2 * fbm(x * 0.04, z * 0.03)) : -smooth(4.2, 16, x) * 1.6 - smooth(16, 60, x) * 3),
    ground: (() => { const a = col('#ecd39c'), b = col('#f6e6be'), w = col('#cdb27b'), g = col('#9fae6a'); return (x, z, h, out) => { mix3(out, a, b, fbm(x * 0.06, z * 0.06)); if (x > 3.8) out.lerp(w, smooth(4, 7, x)); return x < -9 ? out.lerp(g, smooth(0.55, 0.75, noise2(x * 0.1, z * 0.1)) * 0.6) : out; }; })(),
    decor(s) {
      const { r } = s;
      for (let i = 0; i < 5; i++) s.place(s.pick(['seashells', 'starfish', 'crab']), (r() < 0.7 ? 1 : -1) * (4.2 + r() * 2.5), s.z(), { s: 1.5 + r(), ry: r() * TAU });
      for (let i = 0; i < 5; i++) s.place(s.pick(['grassTallA', 'grassA', 'scrubA']), -(5 + r() * 8), s.z(), { tint: '#cfd08a', s: 1 + r() * 0.5 });
      for (let i = 0; i < 2; i++) if (r() < 0.6) { const x = -(5.5 + r() * 4), z = s.z(); s.place(s.pick(['umbrellaRed', 'umbrellaBlue', 'umbrellaRainbow']), x, z, { ry: r() * TAU, s: 1.1 }); s.place('beachChair', x + 0.9, z + 0.6, { ry: -0.6 + r() * 0.4 }); if (r() < 0.5) s.place('beachBall', x - 1.2, z + 1, {}); }
      for (let i = 0; i < 5; i++) s.place(s.pick(['palmetto', 'palmettoLady', 'palmK', 'palmBendK']), -(9 + r() * 22), s.z(), { s: 0.9 + r() * 0.5, ry: r() * TAU });
      for (let i = 0; i < 2; i++) s.place(s.pick(['palm1', 'palm2', 'palm3']), -(20 + r() * 25), s.z(), { s: 0.9 + r() * 0.4, ry: r() * TAU });
      if (r() < 0.3) s.place('rowboat', 5 + r() * 1.5, s.z(), { ry: r() * TAU, y: -0.15 });
      if (r() < 0.2) s.place('dockLong', 12, s.z(0.3, 0.7), { ry: R90, y: -1.6 });
      if (r() < 0.45) s.place('stiltHouse', -(28 + r() * 8), s.z(0.3, 0.7), { ry: R90 });
      if (r() < 0.12) s.place(s.pick(['lighthouse', 'lighthouseRW']), -(24 + r() * 6), s.z(0.4, 0.6), { ry: R90 });
      if (r() < 0.45) s.water(s.pick(['sailA', 'sailB', 'fishingBoat']), 18 + r() * 30, s.z(), { ry: r() * TAU, bob: true });
      if (r() < 0.3) s.water('shrimpBoat', 30 + r() * 25, s.z(), { ry: R90 + (r() - 0.5), bob: true });
      if (r() < 0.25) s.water(s.pick(['cargoShip', 'containerShip']), 80 + r() * 60, s.z(), { ry: R90, s: 1.4, bob: true });
      if (r() < 0.4) s.water('buoy', 10 + r() * 10, s.z(), { s: 0.5, bob: true });
      if (r() < 0.25) s.place('guardTower', -(6 + r() * 3), s.z(), { ry: R90 });
    },
  },
};
export const BIOME_ORDER = ['mountains', 'foothills', 'sandhills', 'farmland', 'swamp', 'beach'];

// ---------- sky ----------
export const SUN_DIR = new THREE.Vector3(-0.21, 0.26, -0.94).normalize();
const skyShader = ground => new THREE.ShaderMaterial({
  uniforms: {
    top: { value: new THREE.Color() }, bottom: { value: new THREE.Color() }, ground: { value: new THREE.Color() },
    sunDir: { value: SUN_DIR }, sunCol: { value: new THREE.Color('#fff1c9') }, useGround: { value: ground ? 1 : 0 },
  },
  vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
  fragmentShader: `uniform vec3 top;
uniform vec3 bottom;
uniform vec3 ground;
uniform vec3 sunDir;
uniform vec3 sunCol;
uniform float useGround;
varying vec3 vP;
void main() {
  vec3 d = normalize(vP);
  float h = d.y;
  vec3 col = mix(bottom, top, smoothstep(-0.02, 0.6, h));
  col += bottom * 0.15 * pow(1.0 - abs(h), 12.0);
  float s = max(dot(d, sunDir), 0.0);
  col += sunCol * (pow(s, 1400.0) * 8.0 + pow(s, 90.0) * 0.6 + pow(s, 8.0) * 0.14);
  col = mix(col, ground, useGround * smoothstep(0.0, -0.25, h));
  gl_FragColor = vec4(col, 1.0);
  #include <colorspace_fragment>
}`,
  side: THREE.BackSide, depthWrite: false, fog: false,
});
const skyMat = skyShader(false);
const envSkyMat = skyShader(true);
// Far ridges fade into the horizon haze toward their base and toward the back, which gives the scene depth.
const hazeU = { value: new THREE.Color() };
const ridgeMat = (color, amp, back) => new THREE.ShaderMaterial({
  uniforms: { color: { value: new THREE.Color(color) }, haze: hazeU, amp: { value: amp }, back: { value: back } },
  vertexShader: 'varying float vY; void main(){ vY = position.y; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
  fragmentShader: `uniform vec3 color;
uniform vec3 haze;
uniform float amp;
uniform float back;
varying float vY;
void main() {
  float t = clamp(vY / amp, 0.0, 1.0);
  vec3 c = mix(color * 0.8, color * 1.08, t);
  c = mix(c, haze, back + (1.0 - back) * 0.6 * (1.0 - smoothstep(-0.2, 0.6, t)));
  gl_FragColor = vec4(c, 1.0);
  #include <colorspace_fragment>
}`,
  fog: false,
});

function ridgeGeometry(style, amp, seed) {
  const r = mkRng(seed);
  const W = 1500, N = 260, pts = [];
  const s1 = r() * 10, s2 = r() * 10;
  // Tree lines are made of overlapping round crowns.
  const crowns = style === 'trees' ? Array.from({ length: 150 }, () => [-W / 2 + r() * W, 0.45 + r() * 0.55, 6 + r() * 10]) : null;
  for (let i = 0; i <= N; i++) {
    const x = -W / 2 + (W * i) / N;
    let y;
    if (style === 'peaks') y = amp * (0.35 + 0.42 * Math.abs(Math.sin(x * 0.006 + s1)) + 0.25 * Math.abs(Math.sin(x * 0.017 + s2)) + 0.06 * Math.sin(x * 0.09));
    else if (style === 'rolling') y = amp * (0.55 + 0.25 * Math.sin(x * 0.013 + s1) + 0.18 * Math.sin(x * 0.037 + s2));
    else if (style === 'dunes') y = amp * (0.35 + 0.4 * Math.abs(Math.sin(x * 0.015 + s1)) + 0.1 * Math.sin(x * 0.05 + s2));
    else if (style === 'trees') { y = amp * 0.35; for (const [cx, k, rad] of crowns) { const d = Math.abs(x - cx); if (d < rad) y = Math.max(y, amp * k + Math.sqrt(rad * rad - d * d) * 0.6); } }
    else y = amp * 0.05;
    pts.push(new THREE.Vector2(x, y));
  }
  const shape = new THREE.Shape();
  shape.moveTo(-W / 2, -120);
  pts.forEach(p => shape.lineTo(p.x, p.y));
  shape.lineTo(W / 2, -120);
  return new THREE.ShapeGeometry(shape);
}

class Backdrop {
  constructor(scene) {
    this.group = new THREE.Group();
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(900, 32, 20), skyMat);
    this.sky.renderOrder = -10;
    this.sky.frustumCulled = false;
    scene.add(this.sky);
    scene.add(this.group);
    this.layers = [];
    this.clouds = [];
    const cloudMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, emissive: '#ffffff', emissiveIntensity: 0.38, fog: false });
    this.cloudSets = [propGeometry('cloudBig'), propGeometry('cloudSmall')].map(g => {
      const m = new THREE.InstancedMesh(g, cloudMat, 8);
      m.frustumCulled = false;
      m.renderOrder = -6;
      this.group.add(m);
      return m;
    });
    for (let i = 0; i < 16; i++) {
      const a = -1.2 + (i / 16) * 2.4 + Math.random() * 0.1;
      const d = 330 + Math.random() * 160;
      this.clouds.push({ set: i % 2, i: i >> 1, pos: new THREE.Vector3(Math.sin(a) * d, 70 + Math.random() * 90, -Math.cos(a) * d), s: 2.4 + Math.random() * 2.2, ry: Math.random() * TAU });
    }
    this.key = null;
  }
  set(biomeKey) {
    if (this.key === biomeKey) return;
    this.key = biomeKey;
    const bd = BIOME[biomeKey].backdrop;
    this.layers.forEach(l => { this.group.remove(l); l.geometry.dispose(); l.material.dispose(); });
    const n = bd.colors.length;
    this.layers = bd.colors.map((c, i) => {
      const m = new THREE.Mesh(ridgeGeometry(bd.style, bd.amp[i], i * 17 + biomeKey.length * 31), ridgeMat(c, bd.amp[i], (i / Math.max(1, n - 1)) * 0.5));
      m.position.set(0, -14 - i * 2, -360 - i * 50);
      m.renderOrder = -5 - i;
      return m;
    });
    [...this.layers].reverse().forEach(l => this.group.add(l));
  }
  update(camera, dt) {
    this.sky.position.copy(camera.position);
    this.group.position.set(camera.position.x * 0.9, camera.position.y * 0.5, camera.position.z);
    for (const c of this.clouds) {
      c.pos.x += dt * 2.2;
      if (c.pos.x > 560) c.pos.x = -560;
      _m.compose(c.pos, _q.setFromEuler(_e.set(0, c.ry, 0)), _s.setScalar(c.s));
      this.cloudSets[c.set].setMatrixAt(c.i, _m);
    }
    for (const m of this.cloudSets) m.instanceMatrix.needsUpdate = true;
  }
}

// ---------- pickups ----------
const coinMat = bend(new THREE.MeshStandardMaterial({ vertexColors: true, metalness: 0.65, roughness: 0.28, emissive: '#ff9a00', emissiveIntensity: 0.32 }), { key: 'coin' });
const glowProp = (color, k = 0.55) => bend(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.35, emissive: color, emissiveIntensity: k }), { key: 'glowprop' });
const heartMat = glowProp('#ff2d55', 0.45);

function heartMesh() {
  const m = new THREE.Mesh(propGeometry('heart'), heartMat);
  m.scale.setScalar(0.85);
  m.frustumCulled = false;
  m.castShadow = true;
  return m;
}

// Power-up crates: a mystery box in the power's color with its icon floating above.
const crateGeo = new Map(), crateMats = new Map();
function crateMesh(power, iconTexture) {
  const g = new THREE.Group();
  if (!crateGeo.has(power.color)) crateGeo.set(power.color, recolored('mystery', power.color));
  if (!crateMats.has(power.color)) crateMats.set(power.color, glowProp(power.color, 0.35));
  const box = new THREE.Mesh(crateGeo.get(power.color), crateMats.get(power.color));
  box.position.y = -0.5;
  box.scale.setScalar(1.05);
  box.castShadow = true;
  box.frustumCulled = false;
  const spin = new THREE.Group();
  spin.add(box);
  g.add(spin);
  g.userData.spin = spin;
  if (iconTexture) {
    const icon = new THREE.Mesh(new THREE.PlaneGeometry(0.95, 0.95), bend(new THREE.MeshBasicMaterial({ map: iconTexture, transparent: true, depthWrite: false }), { key: 'icon' }));
    icon.position.y = 1.15;
    icon.frustumCulled = false;
    g.add(icon);
    g.userData.icon = icon;
  }
  return g;
}

// The question gate: a big hoop in the stage color, a shimmering portal, and a "?" badge.
const gateGeo = new Map();
let qTex = null;
function questionTexture() {
  if (qTex) return qTex;
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const x = c.getContext('2d');
  const g = x.createRadialGradient(128, 110, 20, 128, 128, 124);
  g.addColorStop(0, '#fff6c8'); g.addColorStop(0.6, '#ffd23f'); g.addColorStop(1, '#e89a00');
  x.fillStyle = '#7a4a00'; x.beginPath(); x.arc(128, 132, 120, 0, TAU); x.fill();
  x.fillStyle = g; x.beginPath(); x.arc(128, 124, 116, 0, TAU); x.fill();
  x.lineWidth = 10; x.strokeStyle = '#fff3b0'; x.beginPath(); x.arc(128, 124, 100, 0, TAU); x.stroke();
  x.font = '190px "Lilita One", Fredoka, sans-serif';
  x.textAlign = 'center'; x.textBaseline = 'middle';
  x.fillStyle = '#7a4a00'; x.fillText('?', 132, 142);
  x.fillStyle = '#ffffff'; x.fillText('?', 128, 134);
  qTex = new THREE.CanvasTexture(c);
  qTex.colorSpace = THREE.SRGBColorSpace;
  return qTex;
}
const portalMat = color => new THREE.ShaderMaterial({
  uniforms: { uTime: U.uTime, uBend: U.uBend, uCol: { value: new THREE.Color(color) } },
  vertexShader: `uniform float uBend; varying vec2 vUv; void main(){ vUv = uv; vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    vec3 upV = viewMatrix[1].xyz; float hgt = dot(upV, mvPosition.xyz); mvPosition.xyz -= upV * (max(dot(mvPosition.xyz, mvPosition.xyz) - hgt * hgt, 0.0) * uBend);
    gl_Position = projectionMatrix * mvPosition; }`,
  fragmentShader: `uniform float uTime; uniform vec3 uCol; varying vec2 vUv; void main(){
    vec2 p = vUv - vec2(0.5, 0.0); float r = length(p * vec2(1.0, 1.25));
    float edge = smoothstep(0.62, 0.48, r);
    float swirl = 0.5 + 0.5 * sin(atan(p.y, p.x) * 6.0 - uTime * 3.0 + r * 18.0);
    float a = edge * (0.18 + 0.22 * swirl) * smoothstep(0.0, 0.1, vUv.y);
    gl_FragColor = vec4(mix(uCol, vec3(1.0), 0.35 + 0.3 * swirl) * 1.6, a); }`,
  transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
});
function gateMesh(color) {
  const g = new THREE.Group();
  if (!gateGeo.has(color)) gateGeo.set(color, recolored('arch', color));
  const arch = new THREE.Mesh(gateGeo.get(color), M.solid);
  arch.scale.set(1.68, 1.68, 1.3);
  arch.castShadow = arch.receiveShadow = true;
  arch.frustumCulled = false;
  g.add(arch);
  const portal = new THREE.Mesh(new THREE.PlaneGeometry(8.4, 5.9), portalMat(color));
  portal.position.set(0, 2.95, 0);
  portal.frustumCulled = false;
  g.add(portal);
  const q = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 1.7), bend(new THREE.MeshBasicMaterial({ map: questionTexture(), transparent: true }), { key: 'badge' }));
  q.position.set(0, 4.7, 0.3);
  q.frustumCulled = false;
  g.add(q);
  g.userData.badge = q;
  return g;
}
function signMesh(color, label) {
  const g = gateMesh(color);
  g.remove(g.userData.badge);
  g.userData.badge = null;
  const tex = textTexture(label, { w: 768, h: 160, bg: '#fff8e6', fg: '#3a2410', border: color, size: 96 });
  const board = new THREE.Mesh(new THREE.PlaneGeometry(7.2, 1.5), bend(new THREE.MeshBasicMaterial({ map: tex, transparent: true }), { key: 'board' }));
  board.position.set(0, 6.9, 0.2);
  board.frustumCulled = false;
  g.add(board);
  g.userData.tex = tex;
  return g;
}

// Waterfalls: a scrolling sheet of water down a cliff face, with a pool and mist at the bottom.
function stripeTexture() {
  const c = document.createElement('canvas');
  c.width = 64; c.height = 256;
  const x = c.getContext('2d');
  const g = x.createLinearGradient(0, 0, 64, 0);
  g.addColorStop(0, '#8fd0f0'); g.addColorStop(0.5, '#c8ecff'); g.addColorStop(1, '#8fd0f0');
  x.fillStyle = g; x.fillRect(0, 0, 64, 256);
  for (let i = 0; i < 46; i++) {
    x.fillStyle = Math.random() < 0.5 ? 'rgba(255,255,255,0.9)' : 'rgba(210,240,255,0.8)';
    x.fillRect(Math.random() * 64, Math.random() * 256, 2 + Math.random() * 5, 20 + Math.random() * 70);
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
const fallTex = stripeTexture();
const fallMat = bend(new THREE.MeshBasicMaterial({ map: fallTex, transparent: true, opacity: 0.92 }), { key: 'fall' });
let poolMat = null;

// ---------- world ----------
export class World {
  constructor(scene, fx, renderer) {
    this.scene = scene;
    this.fx = fx;
    this.renderer = renderer;
    this.backdrop = new Backdrop(scene);
    this.hemi = new THREE.HemisphereLight('#ffffff', '#446644', 1.25);
    // The sun shines from behind the camera's left shoulder, so faces toward the player are lit and shadows
    // fall forward onto the trail where they can be seen.
    this.sun = new THREE.DirectionalLight('#fff1d6', 2.8);
    this.sunOffset = new THREE.Vector3(-0.42, 0.8, 0.43).normalize().multiplyScalar(80);
    this.shadowR = 36;
    const sc = this.sun.shadow.camera;
    sc.left = sc.bottom = -this.shadowR; sc.right = sc.top = this.shadowR; sc.near = 5; sc.far = 190;
    this.sun.shadow.bias = -0.0005;
    this.sun.shadow.normalBias = 0.035;
    this.sun.shadow.radius = 2.5;
    this.setShadowSize(2048);
    scene.add(this.hemi, this.sun, this.sun.target);
    scene.fog = new THREE.Fog('#d3e8ff', 55, 190);
    if (renderer) {
      this.pmrem = new THREE.PMREMGenerator(renderer);
      this.envScene = new THREE.Scene();
      this.envScene.add(new THREE.Mesh(new THREE.SphereGeometry(100, 32, 16), envSkyMat));
      scene.environmentIntensity = 0.6;
    }
    this.coins = new THREE.InstancedMesh(propGeometry('coin'), coinMat, 320);
    this.coins.frustumCulled = false;
    this.coins.castShadow = true;
    this.coins.count = 0;
    scene.add(this.coins);
    this.mats = {};
    this.groundMat = bend(new THREE.MeshStandardMaterial({ map: groundTexture(renderer), vertexColors: true, roughness: 0.95, metalness: 0 }), { key: 'ground' });
    this.skyNow = { top: new THREE.Color('#4a9cff'), bottom: new THREE.Color('#d3e8ff') };
    this.chunks = [];
    this.time = 0;
    this.density = 1;
  }

  // Trail surface and water materials, made once per biome.
  matsFor(key) {
    if (!this.mats[key]) {
      const bi = BIOME[key];
      const tex = pathTexture(bi.path, this.renderer).clone();
      tex.needsUpdate = true;
      tex.repeat.set(1 / (TRACK * 2), 1 / PATH_LEN);
      tex.offset.set(0.5, 0);
      this.mats[key] = {
        path: bend(new THREE.MeshStandardMaterial({ map: tex, vertexColors: true, roughness: 0.95, metalness: 0 }), { key: 'path' }),
        water: bi.water ? waterMaterial(bi.water) : null,
      };
    }
    return this.mats[key];
  }

  // cfg: { biomeAt(dist), onChunk(d0, d1) -> events, wantsHeart(), color, powers, pickPower(), powerIcon(id) }
  start(cfg) {
    this.reset();
    this.cfg = cfg;
    this.genDist = -BEHIND;
    this.nextRow = 40;
    this.coinList = [];
    this.finish = null;
    this.calm = [];
    this.noObstaclesFrom = Infinity;
    this.r = mkRng(Math.floor(Math.random() * 1e9));
    this.nextCrate = 150 + this.r() * 60;
    this.pending = [];
    this.queueEvents(this.genDist, this.genDist + CHUNK);
    this.applyBiome(cfg.biomeAt(0), true);
  }
  queueEvents(d0, d1) {
    for (const ev of this.cfg.onChunk(d0, d1) || []) {
      this.calm.push([ev.at - 20, ev.at + 16]);
      this.pending.push(ev);
    }
  }
  reset() {
    for (const c of this.chunks) this.disposeChunk(c);
    this.chunks = [];
    this.coinList = [];
    this.coinGap = null;
    if (this.finish) { this.scene.remove(this.finish.mesh); this.finish = null; }
  }
  applyBiome(key, instant = false) {
    const bi = BIOME[key];
    this.biome = key;
    this.backdrop.set(key);
    this.skyTarget = { top: new THREE.Color(bi.sky[0]), bottom: new THREE.Color(bi.sky[1]) };
    this.hemi.color.set(bi.hemi[0]);
    this.hemi.groundColor.set(bi.hemi[1]);
    this.scene.fog.near = bi.fog[0];
    this.scene.fog.far = bi.fog[1];
    if (instant) { this.skyNow.top.copy(this.skyTarget.top); this.skyNow.bottom.copy(this.skyTarget.bottom); }
    this.updateEnv(bi);
  }
  // Image-based light from this biome's sky, so shiny things (coins, water) reflect the right colors.
  updateEnv(bi) {
    if (!this.pmrem) return;
    envSkyMat.uniforms.top.value.copy(this.skyTarget.top);
    envSkyMat.uniforms.bottom.value.copy(this.skyTarget.bottom);
    envSkyMat.uniforms.ground.value.set(bi.hemi[1]);
    const old = this.envRT;
    this.envRT = this.pmrem.fromScene(this.envScene, 0, 1, 200, { size: 64 });
    this.scene.environment = this.envRT.texture;
    if (old) old.dispose();
  }
  setShadowSize(n) {
    const sh = this.sun.shadow;
    if (sh.mapSize.x === n && sh.map) return;
    sh.mapSize.set(n, n);
    if (sh.map) { sh.map.dispose(); sh.map = null; }
    this.sun.castShadow = n > 0;
  }
  // The shadow box follows the hero but snaps to whole shadow-map texels, so shadow edges don't crawl.
  followSun(heroDist, heroX) {
    const R = this.shadowR;
    const c = _c.set(heroX * 0.5, 0, -(heroDist + R * 0.55));
    const f = _f.copy(this.sunOffset).negate().normalize();
    const rt = _r.crossVectors(f, _up).normalize();
    const up = _u.crossVectors(rt, f);
    const texel = (R * 2) / this.sun.shadow.mapSize.x;
    const a = Math.round(c.dot(rt) / texel) * texel, b = Math.round(c.dot(up) / texel) * texel, z = c.dot(f);
    c.copy(rt).multiplyScalar(a).addScaledVector(up, b).addScaledVector(f, z);
    this.sun.target.position.copy(c);
    this.sun.position.copy(c).add(this.sunOffset);
  }

  get obstacles() { return this.chunks.flatMap(c => c.obstacles); }
  get gates() { return this.chunks.flatMap(c => c.gates); }
  get signs() { return this.chunks.flatMap(c => c.signs); }
  get hearts() { return this.chunks.flatMap(c => c.hearts); }
  get crates() { return this.chunks.flatMap(c => c.crates); }

  update(dt, heroDist, camera, heroX = 0) {
    this.time += dt;
    this.followSun(heroDist, heroX);
    U.uTime.value = this.time;
    fallTex.offset.y += dt * 1.8;
    while (this.genDist < heroDist + AHEAD) this.buildChunk();
    while (this.chunks.length && this.chunks[0].d1 < heroDist - BEHIND) this.disposeChunk(this.chunks.shift());
    const key = this.cfg.biomeAt(heroDist);
    if (key !== this.biome) this.applyBiome(key);
    const k = Math.min(1, dt * 1.5);
    this.skyNow.top.lerp(this.skyTarget.top, k);
    this.skyNow.bottom.lerp(this.skyTarget.bottom, k);
    skyMat.uniforms.top.value.copy(this.skyNow.top);
    skyMat.uniforms.bottom.value.copy(this.skyNow.bottom);
    this.scene.fog.color.copy(this.skyNow.bottom);
    hazeU.value.copy(this.skyNow.bottom);
    this.backdrop.update(camera, dt);
    // coins
    // coinGap [from, to, k] shrinks coins between the hero and a camera in front of him, so they don't fill the shot.
    let n = 0;
    const gap = this.coinGap;
    for (const c of this.coinList) {
      if (!c.alive || c.dist > heroDist + AHEAD || c.dist < heroDist - 12) continue;
      let s = 0.62;
      if (gap && c.dist > gap[0] && c.dist < gap[1]) { s *= 1 - gap[2]; if (s < 0.01) continue; }
      _q.setFromEuler(_e.set(0, this.time * 3.2 + c.dist * 0.3, 0));
      _m.compose(_p.set(c.x, c.y + Math.sin(this.time * 4 + c.dist) * 0.08, -c.dist), _q, _s.setScalar(s));
      this.coins.setMatrixAt(n++, _m);
      if (n >= 320) break;
    }
    this.coins.count = n;
    this.coins.instanceMatrix.needsUpdate = true;
    for (const c of this.chunks) {
      for (const g of c.gates) { const q = g.mesh.userData.badge; if (q) { q.position.y = 4.7 + Math.sin(this.time * 3) * 0.15; q.rotation.y = Math.sin(this.time * 1.5) * 0.35; } }
      for (const h of c.hearts) { h.mesh.rotation.y += dt * 2.5; h.mesh.position.y = 1.25 + Math.sin(this.time * 4) * 0.15; }
      for (const k of c.crates) {
        if (k.taken) continue;
        const sp = k.mesh.userData.spin;
        sp.rotation.y += dt * 1.6;
        sp.rotation.x = Math.sin(this.time * 2 + k.dist) * 0.2;
        k.mesh.position.y = 1.2 + Math.sin(this.time * 3 + k.dist) * 0.15;
        if (k.mesh.userData.icon) k.mesh.userData.icon.position.y = 1.15 + Math.sin(this.time * 4) * 0.08;
        k.spark -= dt;
        if (k.spark <= 0 && Math.abs(k.dist - heroDist) < 70) {
          k.spark = 0.07;
          const a = Math.random() * TAU;
          this.fx.spark({ x: k.x + Math.cos(a) * 0.9, y: k.mesh.position.y + (Math.random() - 0.5) * 1.2, z: -k.dist + Math.sin(a) * 0.9, vy: 0.8, life: 0.7, size: 0.4, color: Math.random() < 0.5 ? k.power.color : '#ffffff', glow: 2 });
        }
      }
      for (const b of c.bobbers) { b.mesh.position.y = b.y + Math.sin(this.time * 1.3 + b.ph) * 0.12; b.mesh.rotation.z = Math.sin(this.time * 1.1 + b.ph) * 0.03; }
      for (const em of c.emitters) {
        em.t -= dt;
        if (em.t > 0) continue;
        if (em.type === 'smoke') { em.t = 0.4; this.fx.puff({ x: em.x, y: em.y, z: em.z, vx: 0.7, vy: 2.4, vz: 0, life: 3.4, size: 3.4, color: '#f4f4f4', alpha: 0.7, g: -0.1, grow: 2.2 }); }
        if (em.type === 'mist') { em.t = 0.12; this.fx.puff({ x: em.x + (Math.random() - 0.5) * em.w, y: em.y + 0.6, z: em.z + 0.6, vx: (Math.random() - 0.5), vy: 1.5, vz: 1, life: 1.4, size: 2.2, color: '#ffffff', alpha: 0.5, grow: 1.6 }); }
        if (em.type === 'firefly') { em.t = 0.4; this.fx.spark({ x: em.x + (Math.random() - 0.5) * 10, y: 0.6 + Math.random() * 2.4, z: em.z + (Math.random() - 0.5) * 24, vx: (Math.random() - 0.5) * 0.6, vy: 0.2, vz: (Math.random() - 0.5) * 0.6, life: 2.6, size: 0.45, color: '#fff27a', glow: 2.5 }); }
      }
    }
  }

  inCalm(d) { return d < 34 || d > this.noObstaclesFrom || this.calm.some(([a, b]) => d > a && d < b); }

  // Ground height at a point, blended across biome borders in the final run.
  heightAt(x, z) {
    const d = -z;
    const a = this.cfg.biomeAt(d - 12), b = this.cfg.biomeAt(d + 12);
    if (a === b) return BIOME[a].height(x, z);
    let lo = d - 12, hi = d + 12;
    for (let i = 0; i < 6; i++) { const mid = (lo + hi) / 2; if (this.cfg.biomeAt(mid) === a) lo = mid; else hi = mid; }
    const t = smooth(lo - 12, lo + 12, d);
    return BIOME[a].height(x, z) * (1 - t) + BIOME[b].height(x, z) * t;
  }

  buildChunk() {
    const d0 = this.genDist, d1 = d0 + CHUNK, z0 = -d0, z1 = -d1;
    const r = this.r;
    const key = this.cfg.biomeAt(d0 + CHUNK / 2);
    const bi = BIOME[key];
    const chunk = { d0, d1, key, meshes: [], obstacles: [], gates: [], signs: [], hearts: [], crates: [], emitters: [], bobbers: [], extraGeos: [] };
    const batch = new Batch();
    const H = (x, z) => this.heightAt(x, z);
    const tmpC = new THREE.Color();

    // ground beside the trail, a little darker right next to it like soft ambient shadow
    const groundCol = (x, z, out) => bi.ground(x, z, H(x, z), out).multiplyScalar(0.82 + 0.18 * smooth(TRACK, TRACK + 2.5, Math.abs(x)));
    const g = batch.get('ground');
    if (bi.boardwalk) g.grid(-SIDE, SIDE, z0, z1, H, groundCol, 3);
    else {
      const gy = (x, z) => (Math.abs(x) <= TRACK + 0.01 ? 0 : H(x, z));
      g.grid(-SIDE, -TRACK, z0, z1, gy, groundCol, 2.5);
      g.grid(TRACK, SIDE, z0, z1, gy, groundCol, 2.5);
    }
    // trail
    batch.get('path').grid(-TRACK, TRACK, z0, z1, bi.boardwalk ? 0.02 : 0.012, (x, z, out) => out.set('#ffffff'), 1.9);
    if (bi.boardwalk) this.boardwalk(batch, z0);
    // water
    if (bi.water) {
      const wb = batch.get('water');
      if (bi.ocean) wb.grid(TRACK + 0.4, 260, z0, z1, bi.water.y, (x, z, out) => out.setRGB(1 - smooth(5, 45, x), 1 - smooth(5, 11, x), 0), 4);
      else wb.grid(-SIDE, SIDE, z0, z1, bi.water.y, (x, z, out) => out.setRGB(0.3 + 0.5 * fbm(x * 0.05, z * 0.05), 0, 0), 4);
    }

    // scenery
    const self = this;
    const s = {
      r, z0,
      pick: arr => arr[Math.floor(r() * arr.length)],
      side: () => (r() < 0.5 ? -1 : 1),
      z: (a = 0, b = 1) => z0 - (a + r() * (b - a)) * CHUNK,
      place(k, x, z, o = {}) {
        const h = H(x, z);
        if (bi.water && !bi.ocean && !o.any && h < bi.water.y + 0.05) return;
        batch.prop(k, x, h + (o.y || 0), z, { ry: o.ry ?? r() * TAU, ...o });
        if (o.smoke) for (const [sx, sy, sz] of o.smoke) {
          const c = Math.cos(o.ry || 0), n = Math.sin(o.ry || 0), sc = o.s || 1;
          chunk.emitters.push({ type: 'smoke', x: x + (sx * c + sz * n) * sc, y: h + sy * sc, z: z + (-sx * n + sz * c) * sc, t: r() });
        }
      },
      water(k, x, z, o = {}) {
        const y = bi.water.y + (o.y || 0);
        if (!o.bob) { batch.prop(k, x, y, z, { ry: o.ry ?? r() * TAU, ...o }); return; }
        const b = new Batch();
        b.prop(k, 0, 0, 0, { ry: o.ry ?? r() * TAU, s: o.s || 1, sway: false });
        for (const [mk, bl] of b.by) {
          const mesh = bl.mesh(mk === 'solid' || mk === 'foliage' ? M.solid : PROP_MATS.get(mk), { cast: Math.abs(x) < 30, receive: true });
          mesh.position.set(x, y, z);
          self.scene.add(mesh);
          chunk.meshes.push(mesh);
          chunk.extraGeos.push(mesh.geometry);
          chunk.bobbers.push({ mesh, y, ph: r() * TAU });
        }
      },
      // A border of small things along both trail edges.
      edge(keys, n, o = {}) {
        const k = Math.round(n * self.density);
        for (let i = 0; i < k; i++) {
          const sx = r() < 0.5 ? -1 : 1, x = sx * (TRACK + 0.2 + r() * 1.3), z = z0 - r() * CHUNK;
          batch.prop(keys[Math.floor(r() * keys.length)], x, H(x, z), z, { ry: r() * TAU, s: (0.7 + r() * 0.6) * (o.s || 1), tint: o.tint });
        }
      },
      fence(x, k = 'fenceRail') {
        const len = 5.89;
        for (let i = 0; i < CHUNK / len; i++) batch.prop(k, x, H(x, z0 - i * len), z0 - len / 2 - i * len, { ry: R90 });
      },
      crops(sx, type) {
        if (r() < 0.2) return;
        for (let row = 0; row < 3; row++) {
          const x = sx * (TRACK + 3 + row * 1.9), step = row ? 2.6 : 1.7;
          batch.prop('dirtRows', x, H(x, z0) - 0.02, z0 - CHUNK / 2, { s: [0.62, 1, CHUNK / 2.81], ry: 0, sway: false });
          for (let i = 0; i < CHUNK / step; i++) {
            const z = z0 - step / 2 - i * step;
            const o = { ry: r() * TAU, shadow: row === 0 };
            if (type === 'corn') batch.prop('cornRow', x, H(x, z), z, { ...o, s: [0.95, 0.55 + r() * 0.1, 0.95] });
            else if (type === 'wheat') batch.prop('wheatRow', x, H(x, z), z, { ...o, s: [1.1, 0.7, 1.1] });
            else batch.prop('soyRow', x, H(x, z), z, { ...o, s: [1.2, 0.42, 1.2] });
          }
        }
      },
      cypress(x, z) {
        const base = Math.max(H(x, z), bi.water.y);
        const k = r() < 0.55 ? 'willow' : r() < 0.5 ? 'bareA' : 'bareB';
        const sc = k === 'willow' ? 0.9 + r() * 0.4 : 1.6 + r() * 0.8;
        batch.prop(k, x, base - 0.1, z, { s: sc, ry: r() * TAU, tint: k === 'willow' ? null : '#8d9aa3' });
        if (k !== 'willow') for (let i = 0; i < 3; i++) batch.prop('moss', x + (r() - 0.5) * 1.2, base + 2.2 * sc + r(), z + (r() - 0.5) * 1.2, { ry: r() * TAU, s: [1, 0.8 + r() * 0.6, 1] });
      },
      island(x, z, rad) {
        batch.get('ground').grid(x - rad, x + rad, z + rad, z - rad, (px, pz) => 0.18 - Math.max(0, Math.hypot(px - x, pz - z) / rad - 0.6) * 1.2, (px, pz, out) => out.set('#6d6a3a').lerp(tmpC.set('#4f6b3c'), fbm(px * 0.2, pz * 0.2)), 2);
      },
      fireflies() { chunk.emitters.push({ type: 'firefly', x: (r() < 0.5 ? -1 : 1) * 8, z: z0 - 15, t: r() }); },
      wires(x) { for (const dy of [14.2, 12.4]) for (const dx of [-1.6, 1.6]) for (let i = 0; i < CHUNK / 3; i++) batch.get('solid').box('#2b2b2b', [x + dx, H(x, z0) + dy + Math.sin((i + 0.5) / 10 * Math.PI) * -0.6, z0 - 1.5 - i * 3], [0.05, 0.05, 3.05]); },
      waterfall(x, z, h) { self.waterfall(chunk, batch, x, z, h, H); },
      dam(x, z) { self.dam(chunk, batch, x, z, H); },
    };
    bi.decor(s);

    // Scripted events (gates, region signs) are fetched one chunk early so their calm zones are known in time.
    this.queueEvents(d1, d1 + CHUNK);
    const events = this.pending.filter(ev => ev.at < d1);
    this.pending = this.pending.filter(ev => ev.at >= d1);
    for (const ev of events) {
      const mesh = ev.type === 'gate' ? gateMesh(this.cfg.color) : signMesh(ev.color, ev.label);
      mesh.position.set(0, 0, -ev.at);
      this.scene.add(mesh);
      chunk.meshes.push(mesh);
      (ev.type === 'gate' ? chunk.gates : chunk.signs).push({ ...ev, dist: ev.at, mesh, done: false });
    }

    this.placeRows(chunk, bi, d1);
    this.finishChunk(chunk, batch, key);
    this.chunks.push(chunk);
    this.genDist = d1;
  }

  // Obstacle rows and coins. Rows are far enough apart that there's time to react at full speed.
  placeRows(chunk, bi, d1) {
    const r = this.r;
    while (this.nextRow < d1) {
      const d = this.nextRow;
      const gap = Math.max(17, 26 - d / 160);
      this.nextRow += gap * (0.85 + r() * 0.3);
      if (this.inCalm(d)) { if (!this.inCalm(d + 5)) this.coinLine(Math.floor(r() * 3) - 1, d + 2, 7); continue; }
      const lanes = [-1, 0, 1];
      const pick = arr => arr[Math.floor(r() * arr.length)];
      const pattern = r();
      const ob = bi.obstacles;
      if (pattern < 0.1 && d > 160 && ob.wide) {
        this.addObstacle(chunk, ob.wide, 0, d);
        this.coinArc(0, d);
      } else if (pattern < 0.26 && d > 180 && ob.over) {
        // A bar to slide under, sometimes with a wall beside it so sliding is the way through.
        const lane = pick(lanes);
        this.addObstacle(chunk, pick(ob.over), lane, d);
        this.coinLine(lane, d - 5, 7, -0.35);
        if (r() < 0.5) this.addObstacle(chunk, pick(ob.tall), pick(lanes.filter(l => l !== lane)), d);
      } else if (pattern < 0.46) {
        const lane = pick(lanes);
        this.addObstacle(chunk, pick(ob.low), lane, d);
        this.coinArc(lane, d);
      } else if (pattern < 0.72 || d < 110) {
        const lane = pick(lanes);
        this.addObstacle(chunk, pick(ob.tall), lane, d);
        this.coinLine(pick(lanes.filter(l => l !== lane)), d - 6, 7);
      } else {
        const open = pick(lanes);
        const others = lanes.filter(l => l !== open);
        this.addObstacle(chunk, pick(ob.tall), others[0], d);
        this.addObstacle(chunk, r() < 0.5 ? pick(ob.tall) : pick(ob.low), others[1], d);
        this.coinLine(open, d - 7, 8);
      }
      if (this.cfg.wantsHeart() && r() < 0.18) this.addHeart(chunk, pick(lanes), d + gap * 0.5);
      else if (d > this.nextCrate && this.cfg.pickPower && !this.inCalm(d + gap * 0.5)) {
        const power = this.cfg.pickPower();
        if (power) {
          this.addCrate(chunk, pick(lanes), d + gap * 0.5, power);
          this.nextCrate = d + 220 + r() * 120;
        }
      }
    }
  }

  // Merges the chunk's batches into meshes. Solid things near the trail cast shadows; the rest only receive them.
  finishChunk(chunk, batch, key) {
    const mats = this.matsFor(key);
    const add = (m, order = 0) => { m.renderOrder = order; this.scene.add(m); chunk.meshes.push(m); chunk.extraGeos.push(m.geometry); };
    for (const [k, b] of batch.by) {
      if (b.empty) continue;
      if (k === 'ground') add(b.mesh(this.groundMat, { cast: false, receive: true }));
      else if (k === 'path') add(b.mesh(mats.path, { cast: false, receive: true }));
      else if (k === 'water') add(b.mesh(mats.water, { cast: false, receive: true }), 2);
      else {
        const mat = k === 'solid' ? M.solid : k === 'foliage' ? M.foliage : PROP_MATS.get(k);
        const [near, far] = b.split(p => Math.abs(p.x ?? 99) < 16);
        if (!near.empty) add(near.mesh(mat, { cast: true, receive: true }));
        if (!far.empty) add(far.mesh(mat, { cast: false, receive: true }));
      }
      b.dispose();
    }
  }

  // Swamp boardwalk: posts and side rails along the trail, standing in the water.
  boardwalk(batch, z0) {
    const b = batch.get('solid');
    for (let i = 0; i < CHUNK / 3; i++) for (const sx of [-1, 1]) {
      const z = z0 - i * 3 - 1.5;
      b.box('#6a5038', [sx * (TRACK + 0.05), -0.45, z], [0.26, 1.3, 0.26]);
      b.box('#7c5e3f', [sx * (TRACK + 0.05), 0.55, z], [0.18, 1.0, 0.18]);
    }
    for (const sx of [-1, 1]) {
      b.box('#8a6a48', [sx * (TRACK + 0.05), 1.0, z0 - CHUNK / 2], [0.16, 0.12, CHUNK]);
      b.box('#5e4630', [sx * TRACK, -0.04, z0 - CHUNK / 2], [0.3, 0.14, CHUNK]);
    }
  }

  waterfall(chunk, batch, x, z, h, H) {
    const s = Math.sign(x), base = H(x, z);
    batch.prop('cliffJ', x + s * 2.5, base - 0.6, z - 1.5, { s: [2.2, h / 3.2, 1.6], ry: s > 0 ? 0 : Math.PI });
    batch.prop('cliffK', x - s * 1.8, base - 0.6, z - 2.2, { s: [1.6, (h * 0.8) / 3.5, 1.5], ry: 1 });
    batch.prop('boulderK', x - s * 3, base + 0.3, z + 2.2, { s: 0.8 });
    batch.prop('rockE', x + s * 2.6, base + 0.2, z + 2.6, { s: 0.9 });
    const geo = new THREE.PlaneGeometry(2.4, h, 1, Math.ceil(h / 2));
    const m = new THREE.Mesh(geo, fallMat);
    m.position.set(x, base + h / 2 - 0.4, z + 0.9);
    m.frustumCulled = false;
    this.scene.add(m);
    chunk.meshes.push(m);
    chunk.extraGeos.push(geo);
    if (!poolMat) poolMat = waterMaterial({ deep: '#2f8fc9', shallow: '#7fd6f0', opacity: 0.9, ripple: 1.4, speed: 1.6 });
    const pool = new Builder();
    pool.grid(x - 3.2, x + 3.2, z + 5, z + 0.4, base + 0.12, (px, pz, out) => out.setRGB(0.55, 0, 0), 1.6);
    const pm = pool.mesh(poolMat, { cast: false, receive: true });
    pm.renderOrder = 2;
    this.scene.add(pm);
    chunk.meshes.push(pm);
    chunk.extraGeos.push(pm.geometry);
    pool.dispose();
    chunk.emitters.push({ type: 'mist', x, y: base, z: z + 1.4, w: 2.4, t: 0 });
  }

  // The fall line: a hydroelectric dam far off to the side, with mist where the water pours out.
  dam(chunk, batch, x, z, H) {
    const base = H(x, z);
    batch.prop('dam', x, base - 1, z, { ry: Math.sign(x) * R90, s: 0.7, sway: false });
    chunk.emitters.push({ type: 'mist', x, y: base, z: z + 4, w: 14, t: 0 });
  }

  addObstacle(chunk, type, lane, d) {
    const def = OB[type];
    const mesh = obstacleMesh(type);
    const x = def.wide ? 0 : lane * LANE;
    mesh.position.set(x, 0, -d);
    this.scene.add(mesh);
    chunk.meshes.push(mesh);
    const o = { type, x, dist: d, w: def.w, d: def.d, h: def.h, low: !!def.low, over: !!def.over, wide: !!def.wide, y0: def.y0 || 0, mesh, hit: false };
    chunk.obstacles.push(o);
    return o;
  }
  addHeart(chunk, lane, d) {
    if (this.inCalm(d)) return;
    const mesh = heartMesh();
    mesh.position.set(lane * LANE, 1.25, -d);
    this.scene.add(mesh);
    chunk.meshes.push(mesh);
    chunk.hearts.push({ x: lane * LANE, dist: d, mesh, taken: false });
  }
  addCrate(chunk, lane, d, powerId) {
    const power = { id: powerId, ...this.cfg.powers[powerId] };
    const mesh = crateMesh(power, this.cfg.powerIcon ? this.cfg.powerIcon(powerId) : null);
    mesh.position.set(lane * LANE, 1.2, -d);
    this.scene.add(mesh);
    chunk.meshes.push(mesh);
    chunk.crates.push({ x: lane * LANE, dist: d, mesh, power, taken: false, spark: 0 });
  }
  // A zig-zag line of coins up in the sky for the jetpack.
  skyCoins(d0, d1, y) {
    let lane = 0, d = d0;
    while (d < d1) {
      this.coinLine(lane, d, 7, y);
      d += 7 * 1.6 + 5;
      lane = Math.max(-1, Math.min(1, lane + (Math.random() < 0.5 ? -1 : 1)));
    }
  }
  coinLine(lane, d, n, y = 0) {
    for (let i = 0; i < n; i++) this.coinList.push({ x: lane * LANE, y: 0.95 + y, dist: d + i * 1.6, alive: true });
  }
  // An arc of coins over a low obstacle, matching the jump.
  coinArc(lane, d, y = 0) {
    for (let i = -4; i <= 4; i++) this.coinList.push({ x: lane * LANE, y: 0.95 + y + (1 - (i / 4.4) ** 2) * 1.6, dist: d + i * 1.4, alive: true });
  }

  // When the questions are done: clear everything ahead and put the finish line in front of the hero.
  placeFinish(dist) {
    this.noObstaclesFrom = dist - 50;
    this.pending = [];
    for (const c of this.chunks) {
      c.obstacles = c.obstacles.filter(o => { if (o.dist > dist - 50) { this.scene.remove(o.mesh); return false; } return true; });
      c.gates = c.gates.filter(g => { if (g.dist > dist - 50) { this.scene.remove(g.mesh); return false; } return true; });
      c.crates = c.crates.filter(k => { if (k.dist > dist - 50) { this.scene.remove(k.mesh); return false; } return true; });
    }
    this.coinList = this.coinList.filter(c => c.dist < dist - 50);
    for (let i = 0; i < 4; i++) this.coinLine(i % 3 - 1, dist - 44 + i * 10, 6);
    const g = new THREE.Group();
    const b = new Batch();
    b.prop('finish', 0, 0, 0, { s: [1.0, 1.25, 1.0] });
    for (const sx of [-1, 1]) b.prop(sx < 0 ? 'flagRed' : 'flagBlue', sx * 5.2, 0, 0, { s: 1.4, ry: sx < 0 ? 0 : Math.PI });
    for (const [k, bl] of b.by) g.add(bl.mesh(k === 'solid' || k === 'foliage' ? M.solid : PROP_MATS.get(k), { cast: true, receive: true }));
    g.position.set(0, 0, -dist);
    this.scene.add(g);
    this.finish = { dist, mesh: g };
  }

  disposeChunk(c) {
    for (const m of c.meshes) {
      this.scene.remove(m);
      m.traverse?.(o => { if (o.userData?.tex) o.userData.tex.dispose(); });
    }
    for (const g of c.extraGeos) g.dispose();
    this.coinList = this.coinList.filter(k => k.dist >= c.d1 - 2 || k.dist < c.d0);
  }
}
const _c = new THREE.Vector3(), _f = new THREE.Vector3(), _r = new THREE.Vector3(), _u = new THREE.Vector3(), _up = new THREE.Vector3(0, 1, 0);
