// Obstacles on the trail, built from the scenery models: things to jump (low), dodge (tall) or slide under (over).
// The hit box comes from the finished model itself, so what you see is what you hit. Overhead obstacles span the
// whole trail, and their clearance is the lowest point of the model above the lanes.
import * as THREE from 'three';
import { model, ready } from './scenery.js';
import { single } from './props.js';

// parts: [model, { s: scale (number or [x, y, z]), rot: turn around y, x, y, z: offset }]
const P = (m, o = {}) => [m, o];
export const OBSTACLES = {
  log: { kind: 'low', parts: [P('log', { s: [1.12, 1.7, 1.25] })] },
  logPile: { kind: 'low', parts: [P('logPile', { s: [0.72, 1.05, 0.8] })] },
  boulder: { kind: 'low', parts: [P('boulder', { s: 1.2, rot: 0.4 })] },
  crate: { kind: 'low', parts: [P('crate', { s: 1.55, rot: Math.PI / 2 })] },
  barrels: { kind: 'low', parts: [P('barrel', { s: 1.05, x: -0.45 }), P('barrel', { s: 1.05, x: 0.45, rot: 1.3 })] },
  sandFlat: { kind: 'low', parts: [P('sandFlat', { s: 1.35 })] },
  sandRocks: { kind: 'low', parts: [P('sandRocks', { s: 0.75 })] },
  hay: { kind: 'low', parts: [P('haySquare', { s: 1.3, rot: Math.PI / 2 })] },
  stump: { kind: 'low', parts: [P('stump', { s: 1.25 })] },
  castle: { kind: 'low', parts: [P('castle', { s: 0.85 })] },
  cooler: { kind: 'low', parts: [P('cooler', { s: 2.2, rot: 0.15 })] },
  // A fallen trunk across the whole trail: everyone has to jump.
  bigLog: { kind: 'low', full: true, parts: [P('logBig', { s: [1.9, 0.75, 0.75] })] },
  rockWall: { kind: 'tall', parts: [P('boulder', { s: [1.45, 2.6, 1.25], rot: 0.3 })] },
  crates: { kind: 'tall', parts: [P('crate', { s: 1.55, rot: Math.PI / 2 }), P('crate', { s: 1.55, rot: Math.PI / 2 + 0.12, y: 0.71 }), P('crate', { s: 1.5, rot: Math.PI / 2 - 0.1, y: 1.42 }), P('barrel', { s: 1.0, y: 2.12 })] },
  sandBlock: { kind: 'tall', parts: [P('sandBlock', { s: [0.8, 1.8, 0.75] })] },
  tractor: { kind: 'tall', parts: [P('tractor', { s: 0.67, rot: Math.PI / 2 })] },
  hayStack: { kind: 'tall', parts: [P('hayStack', { s: 1.0, rot: Math.PI / 2 })] },
  logStack: { kind: 'tall', parts: [P('logStack', { s: [0.5, 0.95, 0.8] })] },
  lifeguard: { kind: 'tall', parts: [P('lifeguard', { s: 0.8 })] },
  logOver: { kind: 'over', parts: [P('logOver', { s: [0.95, 1.3, 1.0] })] },
  banner: { kind: 'over', parts: [P('banner', { s: [0.98, 1.35, 1.0] })] },
  mossBranch: { kind: 'over', parts: [P('mossBranch', { s: [0.95, 1.0, 1.0] })] },
  net: { kind: 'over', parts: [P('net', { s: [1.0, 1.0, 1.0] })] },
  pipe: { kind: 'over', parts: [P('pipeModel', { s: [1.0, 1.0, 1.0] })] },
  boom: { kind: 'over', parts: [P('boomModel', { s: [0.95, 1.0, 1.0] })] },
};
export const BIOME_OBSTACLES = {
  mountains: { low: ['log', 'boulder', 'logPile'], tall: ['rockWall'], over: ['logOver'] },
  foothills: { low: ['crate', 'barrels', 'log'], tall: ['crates'], over: ['banner'] },
  sandhills: { low: ['sandFlat', 'sandRocks', 'log'], tall: ['sandBlock'], over: ['pipe'] },
  farmland: { low: ['hay', 'barrels'], tall: ['tractor', 'hayStack'], over: ['boom'] },
  swamp: { low: ['stump', 'log'], tall: ['logStack'], over: ['mossBranch'] },
  beach: { low: ['castle', 'cooler'], tall: ['lifeguard'], over: ['net'] },
};

// Every scenery model the obstacles of these regions need.
export function obstacleModels(biomes) {
  const out = new Set(['logBig']);
  for (const b of biomes) for (const t of Object.values(BIOME_OBSTACLES[b] || {}).flat()) for (const [m] of OBSTACLES[t].parts) out.add(m);
  return [...out];
}
export const loadObstacleModels = biomes => Promise.all(obstacleModels(biomes).map(n => model(n).catch(() => null)));

// ---------- templates ----------
const templates = new Map();
const _v = new THREE.Vector3(), _box = new THREE.Box3();
function build(type) {
  const def = OBSTACLES[type];
  const g = new THREE.Group();
  for (const [name, o] of def.parts) {
    const m = ready(name);
    if (!m) return null;
    const part = single(m);
    const s = Array.isArray(o.s) ? o.s : [o.s || 1, o.s || 1, o.s || 1];
    part.scale.set(...s);
    part.rotation.y = o.rot || 0;
    part.position.set(o.x || 0, o.y || 0, o.z || 0);
    g.add(part);
  }
  g.updateMatrixWorld(true);
  _box.setFromObject(g);
  const size = _box.getSize(new THREE.Vector3());
  // Over the lanes, find the lowest point (the clearance) and the highest point of the overhead piece.
  let y0 = 0, top = _box.max.y;
  if (def.kind === 'over') {
    y0 = Infinity; top = 0;
    g.traverse(o => {
      if (!o.isMesh) return;
      const p = o.geometry.attributes.position;
      for (let i = 0; i < p.count; i++) {
        _v.fromBufferAttribute(p, i).applyMatrix4(o.matrixWorld);
        if (Math.abs(_v.x) > 3.3 || _v.y < 0.3) continue;
        y0 = Math.min(y0, _v.y);
        top = Math.max(top, _v.y);
      }
    });
    if (!isFinite(y0)) y0 = 1.3;
  }
  // Hit boxes are trimmed a little inside the visible shape.
  const t = { group: g, kind: def.kind, full: !!def.full || def.kind === 'over', w: def.kind === 'over' ? 7.6 : Math.min(size.x, def.full ? 7.6 : 2.1) * 0.92, d: Math.max(0.5, size.z * 0.8), h: top * 0.94, y0 };
  templates.set(type, t);
  return t;
}
// A fresh copy of an obstacle (sharing geometry and materials), with its hit box, or null if its models aren't loaded.
export function makeObstacle(type) {
  const t = templates.get(type) || build(type);
  if (!t) return null;
  const mesh = t.group.clone();
  return { mesh, kind: t.kind, full: t.full, w: t.w, d: t.d, h: t.h, y0: t.y0 };
}
