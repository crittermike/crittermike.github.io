// The running world: biomes, streamed track chunks, obstacles, coins, gates, sky, and backdrop.
import * as THREE from 'three';
import { Builder, M, U, bend, textTexture, rng as mkRng } from './gfx.js';

export const LANE = 2.2;
export const CHUNK = 30;
const AHEAD = 165;
const BEHIND = 90; // track kept behind the hero so the camera can look back at the chaser
const TAU = Math.PI * 2;

// ---------- props (all drawn into a chunk's merged Builder) ----------
const P = {
  pine(b, x, z, s = 1, r = Math.random) {
    const ry = r() * TAU;
    b.cyl('#6b4a2b', [x, 0.7 * s, z], 0.17 * s, 1.4 * s, 6);
    b.cone('#2f6b34', [x, 1.8 * s, z], 1.15 * s, 1.7 * s, 7, [0, ry, 0], 0.08);
    b.cone('#3c8a3f', [x, 2.6 * s, z], 0.9 * s, 1.5 * s, 7, [0, ry + 1, 0], 0.08);
    b.cone('#4aa04a', [x, 3.35 * s, z], 0.6 * s, 1.2 * s, 7, [0, ry + 2, 0], 0.08);
  },
  roundTree(b, x, z, s = 1, leaf = '#4caf50', fruit = null, r = Math.random) {
    b.cyl('#7a5232', [x, 0.65 * s, z], 0.16 * s, 1.3 * s, 6);
    b.ico(leaf, [x, 1.95 * s, z], [1.9 * s, 1.6 * s, 1.9 * s], [0, r() * TAU, 0], 0.1);
    if (fruit) for (let i = 0; i < 7; i++) {
      const a = r() * TAU, e = r() * 0.9 - 0.2;
      b.box(fruit, [x + Math.cos(a) * 0.85 * s * Math.cos(e), 1.95 * s + Math.sin(e) * 0.75 * s, z + Math.sin(a) * 0.85 * s * Math.cos(e)], [0.22 * s, 0.22 * s, 0.22 * s]);
    }
  },
  rock(b, x, z, s = 1, c = '#8e939b', r = Math.random) {
    b.ico(c, [x, 0.22 * s, z], [1.2 * s, 0.8 * s, 1.0 * s], [r(), r() * TAU, r()], 0.08);
  },
  bush(b, x, z, s = 1, c = '#5bb04b') { b.ico(c, [x, 0.3 * s, z], [1.1 * s, 0.75 * s, 1.1 * s], [0, x, 0], 0.08); },
  flowers(b, x, z, r = Math.random) {
    const cs = ['#ff5c8a', '#ffd23f', '#ffffff', '#b06cff'];
    for (let i = 0; i < 4; i++) {
      const fx = x + (r() - 0.5) * 1.2, fz = z + (r() - 0.5) * 1.2;
      b.box('#3f8f3a', [fx, 0.15, fz], [0.05, 0.3, 0.05]);
      b.box(cs[Math.floor(r() * cs.length)], [fx, 0.32, fz], [0.16, 0.12, 0.16]);
    }
  },
  mountain(b, x, z, h, rad, c1, c2, r = Math.random) {
    const ry = r() * TAU;
    b.cone(c1, [x, h / 2 - 1, z], rad, h, 5, [0, ry, 0], 0.05);
    b.cone(c2, [x, h - 1 - h * 0.15, z], rad * 0.3, h * 0.3, 5, [0, ry, 0]);
  },
  hill(b, x, z, w, h, c) { b.ico(c, [x, 0, z], [w, h * 2, w * 0.8], [0, x * 0.3, 0], 0.04, 1); },
  fence(b, x, z, len, c = '#c89a63') {
    for (let i = 0; i <= len / 2; i++) b.box(c, [x, 0.45, z - i * 2], [0.14, 0.9, 0.14]);
    b.box(c, [x, 0.6, z - len / 2], [0.08, 0.1, len]);
    b.box(c, [x, 0.3, z - len / 2], [0.08, 0.1, len]);
  },
  barn(b, x, z, ry = 0) {
    b.box('#c8372d', [x, 1.8, z], [4.2, 3.6, 5.5], [0, ry, 0]);
    b.cyl('#6b2a24', [x, 4.4, z], 2.9, 5.7, 3, [-Math.PI / 2, 0, 0]);
    b.box('#ffffff', [x + (Math.sign(-x) * 2.12), 1.3, z], [0.05, 2.4, 2.0], [0, ry, 0]);
    b.box('#8a231c', [x + (Math.sign(-x) * 2.14), 1.3, z], [0.05, 2.1, 1.7], [0, ry, 0]);
  },
  silo(b, x, z) {
    b.cyl('#c9ccd1', [x, 3, z], 1.1, 6, 10);
    b.ico('#9aa3ad', [x, 6, z], [2.2, 1.6, 2.2], null, 0, 1);
    for (let i = 1; i < 6; i++) b.cyl('#aab0b8', [x, i, z], 1.13, 0.08, 10);
  },
  tractor(b, x, z, ry = 0, c = '#2e9d3b') {
    const R = (dx, dz) => [x + dx * Math.cos(ry) + dz * Math.sin(ry), z - dx * Math.sin(ry) + dz * Math.cos(ry)];
    let [px, pz] = R(0, 0);
    b.box(c, [px, 1.0, pz], [1.3, 0.9, 2.2], [0, ry, 0]);
    [px, pz] = R(0, 0.5);
    b.box('#1f6e2a', [px, 1.85, pz], [1.2, 0.9, 1.1], [0, ry, 0]);
    b.box('#bfe6ff', [px, 1.9, pz], [1.22, 0.55, 0.9], [0, ry, 0]);
    for (const [dx, dz, rr] of [[-0.85, 0.6, 0.75], [0.85, 0.6, 0.75], [-0.75, -0.75, 0.42], [0.75, -0.75, 0.42]]) {
      [px, pz] = R(dx, dz);
      b.cyl('#222222', [px, rr, pz], rr, 0.4, 10, [0, ry, Math.PI / 2]);
      b.cyl('#ffd23f', [px, rr, pz], rr * 0.45, 0.44, 8, [0, ry, Math.PI / 2]);
    }
    [px, pz] = R(0.4, -0.7);
    b.cyl('#444444', [px, 2.0, pz], 0.08, 0.9, 6);
  },
  hayRoll(b, x, z, ry = 0) {
    b.cyl('#e5c15a', [x, 0.7, z], 0.7, 1.1, 10, [0, ry, Math.PI / 2], 0.05);
    b.cyl('#c9a23f', [x, 0.7, z], 0.4, 1.12, 8, [0, ry, Math.PI / 2]);
  },
  mill(b, x, z, extras) {
    const s = Math.sign(x);
    b.box('#b5523b', [x, 2.2, z], [6, 4.4, 11], null, 0.03);
    for (let i = 0; i < 5; i++) {
      b.box('#ffe9a8', [x - s * 3.02, 2.6, z - 4 + i * 2], [0.05, 1.2, 1.0]);
      b.box('#8a3b2b', [x, 4.9, z - 4.4 + i * 2.2], [6, 1.0, 0.25], [0.6, 0, 0]);
    }
    b.cyl('#9c4532', [x + s * 1.5, 5.5, z + 3.5], 0.55, 11, 8, null, 0.8);
    b.cyl('#ffffff', [x + s * 1.5, 10.2, z + 3.5], 0.47, 0.5, 8);
    extras.push({ type: 'smoke', x: x + s * 1.5, y: 11, z: z + 3.5 });
  },
  longleaf(b, x, z, s = 1) {
    b.cyl('#7a5434', [x, 3 * s, z], 0.13 * s, 6 * s, 6);
    for (const [dx, dy, dz] of [[0, 6.2, 0], [0.6, 5.6, 0.2], [-0.5, 5.4, -0.3], [0.1, 5.0, 0.5]]) b.ico('#5f9a3a', [x + dx * s, dy * s, z + dz * s], [1.1 * s, 0.7 * s, 1.1 * s], null, 0.1);
  },
  dune(b, x, z, w, h, c = '#e8cf8a') { b.ico(c, [x, 0, z], [w, h * 2, w * 0.7], [0, x, 0], 0.03, 1); },
  cactus(b, x, z, s = 1) {
    b.ico('#5c9a3a', [x, 0.35 * s, z], [0.5 * s, 0.7 * s, 0.18 * s]);
    b.ico('#6aab45', [x + 0.25 * s, 0.85 * s, z], [0.42 * s, 0.6 * s, 0.16 * s], [0, 0, -0.4]);
    b.ico('#6aab45', [x - 0.22 * s, 0.8 * s, z], [0.38 * s, 0.55 * s, 0.16 * s], [0, 0, 0.4]);
    b.box('#ff5c8a', [x + 0.36 * s, 1.15 * s, z], [0.12 * s, 0.12 * s, 0.12 * s]);
  },
  pylon(b, x, z) {
    const c = '#b8bcc4';
    for (const [dx, dz] of [[-0.8, -0.8], [0.8, -0.8], [-0.8, 0.8], [0.8, 0.8]]) b.box(c, [x + dx * 0.55, 4, z + dz * 0.55], [0.12, 8.2, 0.12], [dz * -0.09, 0, dx * 0.09]);
    for (let i = 1; i < 4; i++) b.box(c, [x, i * 2, z], [1.2 - i * 0.2, 0.1, 1.2 - i * 0.2]);
    b.box(c, [x, 7.6, z], [4, 0.18, 0.18]);
    b.box(c, [x, 6.4, z], [3, 0.18, 0.18]);
  },
  cypress(b, x, z, s = 1, r = Math.random) {
    b.cyl('#6a5440', [x, 0.6 * s, z], 0.55 * s, 1.2 * s, 7, null, 0.45);
    b.cyl('#76604a', [x, 3.2 * s, z], 0.24 * s, 4.4 * s, 6, null, 0.7);
    b.ico('#3e6b3a', [x, 5.6 * s, z], [3.2 * s, 1.1 * s, 3.2 * s], [0, r() * TAU, 0], 0.08);
    b.ico('#4c7d45', [x + 0.4 * s, 6.3 * s, z - 0.3 * s], [2.2 * s, 0.9 * s, 2.2 * s], [0, r() * TAU, 0], 0.08);
    for (let i = 0; i < 5; i++) {
      const a = r() * TAU, d = 0.9 + r() * 0.5;
      b.box('#a7b89d', [x + Math.cos(a) * d * s, 4.6 * s, z + Math.sin(a) * d * s], [0.12 * s, 1.4 * s, 0.12 * s]);
    }
  },
  cattails(b, x, z) {
    for (let i = 0; i < 4; i++) {
      const fx = x + (i % 2) * 0.3 - 0.15, fz = z + (i > 1 ? 0.3 : -0.2);
      b.box('#5f8f3a', [fx, 0.6, fz], [0.05, 1.2, 0.05]);
      b.box('#6b4226', [fx, 1.05, fz], [0.12, 0.35, 0.12]);
    }
  },
  logPile(b, x, z, rows = 3) {
    for (let r = 0; r < rows; r++) for (let i = 0; i < rows - r; i++) {
      const px = x - (rows - r - 1) * 0.35 + i * 0.7;
      b.cyl('#7a5232', [px, 0.35 + r * 0.6, z], 0.33, 3.2, 8, [Math.PI / 2, 0, 0]);
      b.cyl('#e3c08a', [px, 0.35 + r * 0.6, z - 1.61], 0.28, 0.02, 8, [Math.PI / 2, 0, 0]);
    }
  },
  palmetto(b, x, z, s = 1, r = Math.random) {
    const lean = (r() - 0.5) * 0.3;
    for (let i = 0; i < 7; i++) b.box(i % 2 ? '#9a7b55' : '#8a6c48', [x + lean * i * 0.4 * s, (0.4 + i * 0.75) * s, z], [0.36 * s, 0.8 * s, 0.36 * s], [0, i, 0]);
    const tx = x + lean * 2.8 * s, ty = 5.4 * s;
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * TAU + r();
      b.box(i % 2 ? '#3f8f3a' : '#2f7a33', [tx + Math.cos(a) * 1.0 * s, ty + 0.1, z + Math.sin(a) * 1.0 * s], [2.2 * s, 0.08, 0.55 * s], [0, -a, -0.35]);
    }
    b.ico('#2f7a33', [tx, ty + 0.2, z], [0.8 * s, 0.6 * s, 0.8 * s]);
  },
  umbrella(b, x, z, c) {
    b.box('#ffffff', [x, 1.1, z], [0.08, 2.2, 0.08]);
    b.cone(c, [x, 2.2, z], 1.3, 0.6, 8);
    b.cone('#ffffff', [x, 2.36, z], 0.6, 0.3, 8);
    b.box('#1fa2d6', [x + 0.9, 0.06, z + 0.2], [0.9, 0.04, 1.7]);
  },
  beachHouse(b, x, z, c) {
    for (const dx of [-1.5, 1.5]) for (const dz of [-1.5, 1.5]) b.box('#d8c7a6', [x + dx, 0.9, z + dz], [0.25, 1.8, 0.25]);
    b.box(c, [x, 3.1, z], [4, 2.6, 4]);
    b.cyl('#4f6d7a', [x, 5.2, z], 3.2, 1.6, 4, [0, Math.PI / 4, 0]);
    b.box('#ffffff', [x - Math.sign(x) * 2.02, 3.2, z], [0.05, 1.1, 1.2]);
  },
  lighthouse(b, x, z) {
    for (let i = 0; i < 8; i++) b.cyl(i % 2 ? '#222222' : '#ffffff', [x, 1 + i * 2, z], 1.1 - i * 0.07, 2, 10, null, 0.94);
    b.cyl('#333333', [x, 17.3, z], 0.8, 0.6, 10);
    b.cyl('#ffe9a8', [x, 18.1, z], 0.55, 1.0, 10);
    b.cone('#c0392b', [x, 19.1, z], 0.75, 1.0, 10);
  },
  shrimpBoat(b, x, z) {
    b.box('#ffffff', [x, 0.5, z], [2.4, 1.2, 6.5]);
    b.box('#c0392b', [x, 0.05, z], [2.42, 0.3, 6.52]);
    b.box('#2e9d3b', [x, 1.8, z - 1.2], [1.8, 1.4, 2]);
    b.box('#bfe6ff', [x, 2.0, z - 2.21], [1.5, 0.5, 0.05]);
    b.box('#8a6c48', [x, 3.5, z + 0.5], [0.15, 5, 0.15]);
    for (const s of [-1, 1]) {
      b.box('#8a6c48', [x + s * 2.4, 4.2, z + 0.5], [4.8, 0.12, 0.12], [0, 0, s * 0.5]);
      b.box('#8fb8a8', [x + s * 4.4, 2.6, z + 0.5], [0.06, 2.6, 2.2]);
    }
  },
  cargoShip(b, x, z) {
    b.box('#34495e', [x, 1, z], [5, 2.4, 22]);
    b.box('#c0392b', [x, -0.1, z], [5.02, 0.4, 22.02]);
    const cs = ['#e67e22', '#2980b9', '#27ae60', '#c0392b', '#f1c40f', '#8e44ad'];
    for (let i = 0; i < 7; i++) for (let j = 0; j < 2; j++) b.box(cs[(i * 3 + j) % cs.length], [x + (j - 0.5) * 2.2, 2.9 + (i % 3 === 0 ? 1.2 : 0), z - 8 + i * 2.4], [2.1, 1.2, 2.2]);
    b.box('#ecf0f1', [x, 4.5, z + 9], [4, 4.5, 3]);
  },
};

// ---------- obstacles (shared geometry per type) ----------
const OB = {
  rock: { low: true, w: 1.7, d: 1.1, h: 0.85, draw: b => { b.ico('#8e939b', [0, 0.35, 0], [1.6, 0.95, 1.1], [0.2, 0.5, 0]); b.ico('#a3a8b0', [0.45, 0.3, 0.2], [0.7, 0.6, 0.6]); } },
  log: { low: true, w: 2.0, d: 0.7, h: 0.75, draw: b => { b.cyl('#7a5232', [0, 0.36, 0], 0.36, 2.0, 9, [0, 0, Math.PI / 2]); for (const s of [-1, 1]) b.cyl('#e3c08a', [s * 1.0, 0.36, 0], 0.3, 0.04, 9, [0, 0, Math.PI / 2]); b.box('#4f8f3a', [0.3, 0.72, 0], [0.4, 0.06, 0.2]); } },
  bigLog: { low: true, w: 6.9, d: 0.8, h: 0.8, draw: b => { b.cyl('#6b4a2b', [0, 0.4, 0], 0.4, 6.9, 10, [0, 0, Math.PI / 2], 1, 0.04); for (const s of [-1, 1]) b.cyl('#e3c08a', [s * 3.45, 0.4, 0], 0.34, 0.04, 10, [0, 0, Math.PI / 2]); for (let i = 0; i < 4; i++) b.box('#5aa04a', [-2.4 + i * 1.6, 0.8, 0.1], [0.5, 0.08, 0.3]); } },
  boulder: { low: false, w: 1.9, d: 1.6, h: 3, draw: b => { b.ico('#7d838c', [0, 1.1, 0], [2.0, 2.4, 1.7], [0.3, 0.4, 0.1]); b.ico('#959ba3', [-0.3, 1.9, 0.1], [1.2, 1.0, 1.1], [0, 1, 0]); } },
  crate: { low: true, w: 1.5, d: 1.0, h: 0.9, draw: b => { b.box('#c8975a', [0, 0.42, 0], [1.4, 0.84, 1.0]); b.box('#a87840', [0, 0.42, -0.51], [1.42, 0.12, 0.04]); for (let i = 0; i < 5; i++) b.ico('#ffab76', [-0.5 + i * 0.25, 0.92, (i % 2) * 0.2 - 0.1], [0.3, 0.3, 0.3]); } },
  clothCart: { low: false, w: 1.9, d: 1.5, h: 3, draw: b => { b.box('#8a6c48', [0, 0.6, 0], [1.9, 0.25, 1.5]); for (const [x, z] of [[-0.8, -0.6], [0.8, -0.6], [-0.8, 0.6], [0.8, 0.6]]) b.cyl('#333333', [x, 0.3, z], 0.3, 0.15, 8, [0, 0, Math.PI / 2]); const cs = ['#e74c3c', '#3498db', '#f1c40f', '#9b59b6', '#2ecc71', '#ffffff']; for (let i = 0; i < 6; i++) b.cyl(cs[i], [(i % 2 - 0.5) * 0.9, 1.05 + Math.floor(i / 2) * 0.62, 0], 0.32, 1.4, 10, [Math.PI / 2, 0, 0]); } },
  cactus: { low: true, w: 1.4, d: 0.8, h: 0.95, draw: b => { P.cactus(b, -0.3, 0, 1.0); P.cactus(b, 0.35, 0.1, 0.8); } },
  sandRock: { low: false, w: 1.9, d: 1.6, h: 3, draw: b => { b.ico('#c99a5b', [0, 1.1, 0], [2.0, 2.4, 1.7], [0.2, 0.7, 0]); b.ico('#ddb479', [0.3, 2.0, 0], [1.1, 0.9, 1.0]); b.box('#b98a4b', [0, 0.9, -0.82], [1.6, 0.08, 0.05]); } },
  hay: { low: true, w: 1.6, d: 1.2, h: 0.9, draw: b => { b.box('#e5c15a', [0, 0.45, 0], [1.6, 0.9, 1.1], null, 0.03); b.box('#c9a23f', [0, 0.45, -0.56], [1.62, 0.06, 0.02]); b.box('#c9a23f', [0, 0.25, -0.56], [1.62, 0.06, 0.02]); b.box('#c9a23f', [0, 0.65, -0.56], [1.62, 0.06, 0.02]); } },
  tractor: { low: false, w: 1.9, d: 2.2, h: 3, draw: b => P.tractor(b, 0, 0, 0, '#2e9d3b') },
  hayStack: { low: false, w: 1.8, d: 1.2, h: 3, draw: b => { for (let i = 0; i < 3; i++) b.box(i % 2 ? '#e5c15a' : '#d9b24c', [i === 2 ? 0 : (i - 0.5) * 0.1, 0.45 + i * 0.88, 0], [1.7 - i * 0.15, 0.86, 1.1]); } },
  stump: { low: true, w: 1.4, d: 1.0, h: 0.85, draw: b => { b.cyl('#6a5440', [0, 0.42, 0], 0.6, 0.85, 8, null, 0.75); b.cyl('#c9a77a', [0, 0.86, 0], 0.42, 0.03, 8); b.box('#a7b89d', [0.3, 0.6, -0.5], [0.12, 0.4, 0.1]); } },
  logPile: { low: false, w: 1.9, d: 3.3, h: 3, draw: b => P.logPile(b, 0, 1.6, 3) },
  sandcastle: { low: true, w: 1.5, d: 1.1, h: 0.85, draw: b => { b.box('#e8cf8a', [0, 0.3, 0], [1.4, 0.6, 1.0]); for (const x of [-0.5, 0.5]) { b.box('#e8cf8a', [x, 0.7, 0], [0.4, 0.3, 0.4]); b.cone('#ddc17a', [x, 0.98, 0], 0.25, 0.3, 4, [0, Math.PI / 4, 0]); } b.box('#ff5c8a', [0.5, 1.25, 0], [0.04, 0.3, 0.04]); b.box('#ff5c8a', [0.6, 1.33, 0], [0.18, 0.12, 0.02]); } },
  cooler: { low: true, w: 1.3, d: 0.9, h: 0.8, draw: b => { b.box('#2e86de', [0, 0.32, 0], [1.2, 0.64, 0.8]); b.box('#ffffff', [0, 0.7, 0], [1.24, 0.14, 0.84]); b.box('#dddddd', [0, 0.82, 0], [0.6, 0.06, 0.12]); } },
  lifeguard: { low: false, w: 1.9, d: 1.6, h: 3, draw: b => { for (const x of [-0.7, 0.7]) for (const z of [-0.5, 0.5]) b.box('#ffffff', [x, 1.0, z], [0.14, 2.0, 0.14]); b.box('#e74c3c', [0, 2.1, 0], [1.8, 0.2, 1.3]); b.box('#e74c3c', [0, 2.7, 0.55], [1.8, 1.1, 0.12]); b.box('#ffffff', [0, 2.8, 0.48], [0.5, 0.5, 0.02]); b.box('#e74c3c', [0, 2.8, 0.46], [0.36, 0.1, 0.02]); b.box('#e74c3c', [0, 2.8, 0.46], [0.1, 0.36, 0.02]); } },
};
const obGeo = new Map();
function obstacleMesh(type) {
  let g = obGeo.get(type);
  if (!g) { const b = new Builder(); OB[type].draw(b); g = b.build(); obGeo.set(type, g); }
  const m = new THREE.Mesh(g, M.solid);
  m.frustumCulled = false;
  return m;
}

// ---------- biomes ----------
export const BIOME = {
  mountains: {
    sky: ['#4a9cff', '#d3e8ff'], hemi: ['#cfe6ff', '#3f6b35'], ground: '#4f9a40', track: '#a27c55', speck: '#8a6644', edge: '#6e5236', dust: '#b8946a',
    backdrop: { style: 'peaks', colors: ['#5f86c4', '#7b9fd3', '#9cb8e1'], amp: [70, 58, 48] },
    obstacles: { low: ['rock', 'log'], tall: ['boulder'] },
    decor(b, z0, r, x) {
      for (let i = 0; i < 5; i++) { const s = r() < 0.5 ? -1 : 1; P.mountain(b, s * (24 + r() * 26), z0 - r() * CHUNK, 18 + r() * 22, 9 + r() * 7, r() < 0.5 ? '#4f8f45' : '#5d9a4c', '#9aa0a8', r); }
      for (let i = 0; i < 16; i++) { const s = r() < 0.5 ? -1 : 1; P.pine(b, s * (5.5 + r() * 16), z0 - r() * CHUNK, 0.8 + r() * 0.8, r); }
      for (let i = 0; i < 5; i++) { const s = r() < 0.5 ? -1 : 1; P.rock(b, s * (4.4 + r() * 4), z0 - r() * CHUNK, 0.6 + r() * 0.7, '#8e939b', r); }
      for (let i = 0; i < 3; i++) P.flowers(b, (r() < 0.5 ? -1 : 1) * (4.6 + r() * 2), z0 - r() * CHUNK, r);
      if (r() < 0.45) x.push({ type: 'waterfall', x: (r() < 0.5 ? -1 : 1) * (11 + r() * 4), z: z0 - 8 - r() * 14, h: 9 + r() * 4 });
    },
  },
  foothills: {
    sky: ['#3fa7ff', '#dcf1ff'], hemi: ['#e0f3ff', '#4a7a3a'], ground: '#6cbf4a', track: '#c0603a', speck: '#a24c2c', edge: '#8e3f24', dust: '#c97a55',
    backdrop: { style: 'rolling', colors: ['#5f9f6e', '#7fb38a', '#a3c9ab'], amp: [34, 30, 26] },
    obstacles: { low: ['crate', 'log'], tall: ['clothCart', 'boulder'] },
    decor(b, z0, r, x) {
      for (let i = 0; i < 6; i++) { const s = r() < 0.5 ? -1 : 1; P.hill(b, s * (20 + r() * 25), z0 - r() * CHUNK, 14 + r() * 12, 4 + r() * 5, r() < 0.5 ? '#5aae46' : '#6cbf4a'); }
      for (let i = 0; i < 9; i++) { const s = r() < 0.5 ? -1 : 1; P.roundTree(b, s * (5.5 + r() * 12), z0 - r() * CHUNK, 0.8 + r() * 0.5, '#4caf50', r() < 0.7 ? '#ffab76' : null, r); }
      if (r() < 0.6) P.fence(b, (r() < 0.5 ? -1 : 1) * 4.8, z0 - 2, 26);
      for (let i = 0; i < 3; i++) P.flowers(b, (r() < 0.5 ? -1 : 1) * (4.5 + r() * 3), z0 - r() * CHUNK, r);
      if (r() < 0.4) P.mill(b, (r() < 0.5 ? -1 : 1) * (14 + r() * 4), z0 - 15, x);
      else if (r() < 0.35) x.push({ type: 'waterfall', x: (r() < 0.5 ? -1 : 1) * (12 + r() * 4), z: z0 - 10 - r() * 10, h: 5 + r() * 2 });
    },
  },
  sandhills: {
    sky: ['#4fb0ff', '#fff1cf'], hemi: ['#fff4d6', '#b89a5a'], ground: '#e6cc86', track: '#f3e2ad', speck: '#d9c27e', edge: '#cdb06a', dust: '#f0dca0',
    backdrop: { style: 'dunes', colors: ['#d8b26a', '#e3c58b', '#ecd8ae'], amp: [24, 20, 17] },
    obstacles: { low: ['cactus', 'log'], tall: ['sandRock'] },
    decor(b, z0, r, x) {
      for (let i = 0; i < 6; i++) { const s = r() < 0.5 ? -1 : 1; P.dune(b, s * (12 + r() * 30), z0 - r() * CHUNK, 9 + r() * 10, 2 + r() * 3, r() < 0.5 ? '#e8cf8a' : '#dfc078'); }
      for (let i = 0; i < 7; i++) { const s = r() < 0.5 ? -1 : 1; P.longleaf(b, s * (6 + r() * 16), z0 - r() * CHUNK, 0.8 + r() * 0.4); }
      for (let i = 0; i < 5; i++) { const s = r() < 0.5 ? -1 : 1; P.bush(b, s * (4.6 + r() * 6), z0 - r() * CHUNK, 0.6 + r() * 0.4, '#8a9a4a'); }
      for (let i = 0; i < 2; i++) P.cactus(b, (r() < 0.5 ? -1 : 1) * (4.8 + r() * 3), z0 - r() * CHUNK, 0.8);
      if (r() < 0.5) { const s = r() < 0.5 ? -1 : 1; P.pylon(b, s * 11, z0 - 15); x.push({ type: 'wires', x: s * 11, z: z0 - 15 }); }
      if (r() < 0.3) x.push({ type: 'dam', x: (r() < 0.5 ? -1 : 1) * 20, z: z0 - 15 });
    },
  },
  farmland: {
    sky: ['#38a4ff', '#e2f5ff'], hemi: ['#e8f7ff', '#5a8a3a'], ground: '#79c457', track: '#a67c52', speck: '#8c6640', edge: '#5aa043', dust: '#b38a5f',
    backdrop: { style: 'flat', colors: ['#4f8f4a', '#76ad6e', '#a1c99a'], amp: [10, 9, 8] },
    obstacles: { low: ['hay'], tall: ['tractor', 'hayStack'] },
    decor(b, z0, r, x) {
      const crops = [['#4f9e3a', '#5fae45', null], ['#6cbf4a', '#7fcc58', null], ['#3f8f3a', '#4f9e45', '#ffffff']];
      for (const s of [-1, 1]) {
        const [c1, c2, dot] = crops[Math.floor(r() * crops.length)];
        b.box('#8b6a45', [s * 14.5, 0.02, z0 - CHUNK / 2], [17, 0.05, CHUNK]);
        for (let i = 0; i < 12; i++) {
          const px = s * (6.5 + i * 1.4);
          b.box(i % 2 ? c1 : c2, [px, 0.22, z0 - CHUNK / 2], [0.7, 0.42, CHUNK - 0.1]);
          if (dot) for (let k = 0; k < 6; k++) b.box(dot, [px + (r() - 0.5) * 0.4, 0.48, z0 - r() * CHUNK], [0.2, 0.16, 0.2]);
        }
      }
      if (r() < 0.55) { const s = r() < 0.5 ? -1 : 1; P.barn(b, s * (28 + r() * 5), z0 - 12); if (r() < 0.7) P.silo(b, s * (34 + r() * 3), z0 - 21); }
      if (r() < 0.4) P.tractor(b, (r() < 0.5 ? -1 : 1) * (9 + r() * 8), z0 - r() * CHUNK, r() * TAU);
      for (let i = 0; i < 3; i++) if (r() < 0.5) P.hayRoll(b, (r() < 0.5 ? -1 : 1) * (5 + r() * 2), z0 - r() * CHUNK, r());
      for (let i = 0; i < 4; i++) { const s = r() < 0.5 ? -1 : 1; P.roundTree(b, s * (40 + r() * 10), z0 - r() * CHUNK, 1.1 + r() * 0.5, '#3f8f3a', null, r); }
    },
  },
  swamp: {
    sky: ['#5f9f96', '#cfe1cf'], hemi: ['#d6eadb', '#2f4a30'], ground: '#4d6b44', track: '#8a6a48', edge: '#6a5038', dust: '#9fc6b0', water: '#4a6f4c', style: 'boardwalk',
    backdrop: { style: 'trees', colors: ['#365f45', '#557f62', '#7fa58b'], amp: [16, 14, 12] },
    obstacles: { low: ['stump', 'log'], tall: ['logPile'] },
    decor(b, z0, r, x) {
      for (let i = 0; i < 9; i++) { const s = r() < 0.5 ? -1 : 1; P.cypress(b, s * (6 + r() * 20), z0 - r() * CHUNK, 0.8 + r() * 0.5, r); }
      for (let i = 0; i < 8; i++) { const s = r() < 0.5 ? -1 : 1; b.cone('#6a5440', [s * (5 + r() * 12), 0.2, z0 - r() * CHUNK], 0.18, 0.7, 5); }
      for (let i = 0; i < 9; i++) { const s = r() < 0.5 ? -1 : 1; b.cyl('#4f9e45', [s * (4.6 + r() * 10), 0.08, z0 - r() * CHUNK], 0.35 + r() * 0.2, 0.04, 8); }
      for (let i = 0; i < 4; i++) P.cattails(b, (r() < 0.5 ? -1 : 1) * (4.5 + r() * 3), z0 - r() * CHUNK);
      if (r() < 0.45) {
        const s = r() < 0.5 ? -1 : 1;
        b.box('#7a6a4a', [s * 16, 0.1, z0 - 15], [9, 0.3, 10]);
        P.logPile(b, s * 15, z0 - 12, 3);
        P.logPile(b, s * 17.5, z0 - 17, 2);
      } else if (r() < 0.5) {
        const s = r() < 0.5 ? -1 : 1;
        for (let i = 0; i < 6; i++) b.box('#9fd36a', [s * (11 + i * 1.2), 0.18, z0 - 15], [0.6, 0.3, 12]);
      }
    },
  },
  beach: {
    sky: ['#26a6ff', '#e0f7ff'], hemi: ['#e8f9ff', '#b9a77a'], ground: '#f2dfa3', track: '#e0c98f', speck: '#cdb377', edge: '#ffffff', dust: '#ffffff', water: '#2fa2d8', style: 'surf',
    backdrop: { style: 'sea', colors: ['#2f98cf', '#5cb7de', '#8fd0ea'], amp: [3, 4, 5] },
    obstacles: { low: ['sandcastle', 'cooler'], tall: ['lifeguard'] },
    decor(b, z0, r, x) {
      for (let i = 0; i < 5; i++) P.dune(b, -(10 + r() * 22), z0 - r() * CHUNK, 7 + r() * 6, 1.5 + r() * 1.5, '#f2dfa3');
      for (let i = 0; i < 6; i++) P.palmetto(b, -(6 + r() * 14), z0 - r() * CHUNK, 0.8 + r() * 0.4, r);
      for (let i = 0; i < 6; i++) { const fx = -(4.6 + r() * 3), fz = z0 - r() * CHUNK; b.box('#a7b86a', [fx, 0.4, fz], [0.05, 0.8, 0.05]); b.box('#d9c27e', [fx, 0.85, fz], [0.12, 0.2, 0.12]); }
      if (r() < 0.6) P.umbrella(b, -(5.2 + r() * 2), z0 - r() * CHUNK, ['#e74c3c', '#f1c40f', '#9b59b6', '#2ecc71'][Math.floor(r() * 4)]);
      if (r() < 0.5) P.beachHouse(b, -(22 + r() * 6), z0 - 15, ['#ffb3c7', '#a8e6cf', '#ffd3a5', '#b5d8ff'][Math.floor(r() * 4)]);
      if (r() < 0.12) P.lighthouse(b, -(18 + r() * 4), z0 - 15);
      if (r() < 0.4) P.shrimpBoat(b, 14 + r() * 14, z0 - r() * CHUNK);
      if (r() < 0.25) P.cargoShip(b, 40 + r() * 20, z0 - 15);
      for (let i = 0; i < 2; i++) b.box(i % 2 ? '#e74c3c' : '#2ecc71', [9 + r() * 20, 0.4, z0 - r() * CHUNK], [0.4, 0.8, 0.4]);
    },
  },
};
export const BIOME_ORDER = ['mountains', 'foothills', 'sandhills', 'farmland', 'swamp', 'beach'];

// ---------- animated textures ----------
function stripeTexture() {
  const c = document.createElement('canvas');
  c.width = 64; c.height = 256;
  const x = c.getContext('2d');
  x.fillStyle = '#9fdcff'; x.fillRect(0, 0, 64, 256);
  for (let i = 0; i < 40; i++) {
    x.fillStyle = Math.random() < 0.5 ? '#ffffff' : '#d4f1ff';
    x.fillRect(Math.random() * 64, Math.random() * 256, 3 + Math.random() * 6, 20 + Math.random() * 60);
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
const fallTex = stripeTexture();
const fallMat = bend(new THREE.MeshBasicMaterial({ map: fallTex }));

// ---------- sky and backdrop ----------
const skyMat = new THREE.ShaderMaterial({
  uniforms: { top: { value: new THREE.Color() }, bottom: { value: new THREE.Color() } },
  vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
  fragmentShader: `uniform vec3 top;
uniform vec3 bottom;
varying vec3 vP;
void main() {
  float h = smoothstep(-0.02, 0.45, vP.y);
  gl_FragColor = vec4(mix(bottom, top, h), 1.0);
  #include <colorspace_fragment>
}`,
  side: THREE.BackSide, depthWrite: false, fog: false,
});

function ridgeGeometry(style, amp, seed) {
  const r = mkRng(seed);
  const W = 1400, N = 140, pts = [];
  const s1 = r() * 10, s2 = r() * 10;
  for (let i = 0; i <= N; i++) {
    const x = -W / 2 + (W * i) / N;
    let y;
    if (style === 'peaks') y = amp * (i % 2 ? 0.35 + r() * 0.25 : 0.6 + r() * 0.4);
    else if (style === 'rolling') y = amp * (0.55 + 0.25 * Math.sin(x * 0.013 + s1) + 0.18 * Math.sin(x * 0.037 + s2));
    else if (style === 'dunes') y = amp * (0.35 + 0.4 * Math.abs(Math.sin(x * 0.015 + s1)) + 0.1 * Math.sin(x * 0.05 + s2));
    else if (style === 'trees') y = amp * (0.55 + 0.35 * r() + 0.15 * Math.sin(x * 0.02 + s1));
    else if (style === 'flat') y = amp * (0.25 + 0.5 * r() * (Math.sin(x * 0.01 + s1) > 0 ? 1 : 0.3));
    else y = amp * (Math.sin(x * 0.01 + s1) > 0.92 ? 1 : 0.05);
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
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(800, 24, 16), skyMat);
    this.sky.renderOrder = -10;
    this.sky.frustumCulled = false;
    scene.add(this.sky);
    scene.add(this.group);
    this.layers = [];
    const sun = new THREE.Mesh(new THREE.CircleGeometry(16, 24), new THREE.MeshBasicMaterial({ color: '#fff6c4', fog: false }));
    sun.position.set(-120, 120, -520);
    const halo = new THREE.Mesh(new THREE.CircleGeometry(30, 24), new THREE.MeshBasicMaterial({ color: '#fff6c4', transparent: true, opacity: 0.3, fog: false, depthWrite: false }));
    halo.position.set(-120, 120, -521);
    this.group.add(sun, halo);
    this.clouds = [];
    for (let i = 0; i < 9; i++) {
      const b = new Builder();
      const n = 3 + (i % 3);
      for (let k = 0; k < n; k++) b.ico('#ffffff', [k * 9 - n * 4, (k % 2) * 3, (k % 3) * 2], [14, 9, 10], [0, k, 0], 0.05);
      const m = new THREE.Mesh(b.build(), new THREE.MeshBasicMaterial({ vertexColors: true, fog: false }));
      m.position.set(-400 + i * 95 + Math.random() * 40, 70 + Math.random() * 60, -420 - Math.random() * 60);
      this.clouds.push(m);
      this.group.add(m);
    }
    this.key = null;
  }
  set(biomeKey) {
    if (this.key === biomeKey) return;
    this.key = biomeKey;
    const bd = BIOME[biomeKey].backdrop;
    this.layers.forEach(l => { this.group.remove(l); l.geometry.dispose(); l.material.dispose(); });
    this.layers = bd.colors.map((c, i) => {
      const m = new THREE.Mesh(ridgeGeometry(bd.style, bd.amp[i], i * 17 + biomeKey.length * 31), new THREE.MeshBasicMaterial({ color: c, fog: false }));
      m.position.set(0, -10 - i * 2, -330 - i * 45);
      m.renderOrder = -5 - i;
      return m;
    });
    // Draw far layers first.
    [...this.layers].reverse().forEach(l => this.group.add(l));
  }
  update(camera, dt) {
    this.sky.position.copy(camera.position);
    this.group.position.set(camera.position.x * 0.9, camera.position.y * 0.5, camera.position.z);
    for (const c of this.clouds) { c.position.x += dt * 2; if (c.position.x > 480) c.position.x = -480; }
  }
}

// ---------- coins ----------
const coinGeo = (() => {
  const b = new Builder();
  b.cyl('#ffc61a', [0, 0, 0], 0.36, 0.1, 14, [Math.PI / 2, 0, 0]);
  b.cyl('#ffe066', [0, 0, 0], 0.24, 0.12, 14, [Math.PI / 2, 0, 0]);
  b.box('#ffc61a', [0, 0, 0], [0.08, 0.26, 0.14]);
  return b.build();
})();
const coinMat = bend(new THREE.MeshToonMaterial({ vertexColors: true, emissive: '#6a4a00' }));

function heartMesh() {
  const b = new Builder();
  const px = [[-1, 2], [1, 2], [-2, 1], [-1, 1], [0, 1], [1, 1], [2, 1], [-2, 0], [-1, 0], [0, 0], [1, 0], [2, 0], [-1, -1], [0, -1], [1, -1], [0, -2]];
  for (const [x, y] of px) b.box(y === 2 || (x === -1 && y === 1) ? '#ff7a8a' : '#ff2d55', [x * 0.17, y * 0.17, 0], [0.17, 0.17, 0.2]);
  const m = new THREE.Mesh(b.build(), M.glow);
  m.frustumCulled = false;
  return m;
}

function archMesh(color, label, { checker = false } = {}) {
  const g = new THREE.Group();
  const b = new Builder();
  for (const s of [-1, 1]) {
    b.box(color, [s * 4.2, 2.4, 0], [0.7, 4.8, 0.7], null, 0.04);
    b.box('#ffffff', [s * 4.2, 4.9, 0], [0.9, 0.2, 0.9]);
    b.box(color, [s * 4.2, 0.15, 0], [1.0, 0.3, 1.0]);
  }
  b.box(color, [0, 5.3, 0], [9.4, 0.6, 0.6]);
  g.add(b.mesh());
  const tex = checker ? checkerTexture() : textTexture(label, { w: 512, h: 128, bg: '#ffffff', fg: '#222', border: color, size: 76 });
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(checker ? 8.4 : 6, checker ? 1.2 : 1.5), bend(new THREE.MeshBasicMaterial({ map: tex, transparent: true })));
  sign.position.set(0, checker ? 5.3 : 6.3, 0.32);
  sign.frustumCulled = false;
  g.add(sign);
  g.userData.tex = tex;
  return g;
}
function checkerTexture() {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 64;
  const x = c.getContext('2d');
  for (let i = 0; i < 32; i++) for (let j = 0; j < 4; j++) { x.fillStyle = (i + j) % 2 ? '#111' : '#fff'; x.fillRect(i * 16, j * 16, 16, 16); }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
function gateMesh(color) {
  const g = archMesh(color, '?');
  const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(0.75, 0), bend(new THREE.MeshToonMaterial({ color: '#ffd23f', emissive: '#a06a00' })));
  crystal.position.set(0, 2.6, 0);
  crystal.frustumCulled = false;
  g.add(crystal);
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(8.4, 4.6), bend(new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.18, depthWrite: false, side: THREE.DoubleSide })));
  glow.position.set(0, 2.5, 0);
  glow.frustumCulled = false;
  g.add(glow);
  g.userData.crystal = crystal;
  return g;
}

// ---------- world ----------
export class World {
  constructor(scene, fx) {
    this.scene = scene;
    this.fx = fx;
    this.backdrop = new Backdrop(scene);
    this.hemi = new THREE.HemisphereLight('#ffffff', '#446644', 1.9);
    this.sun = new THREE.DirectionalLight('#ffffff', 1.9);
    this.sun.position.set(-4, 10, 6);
    scene.add(this.hemi, this.sun);
    scene.fog = new THREE.Fog('#d3e8ff', 40, 130);
    this.coins = new THREE.InstancedMesh(coinGeo, coinMat, 260);
    this.coins.frustumCulled = false;
    this.coins.count = 0;
    scene.add(this.coins);
    this.skyNow = { top: new THREE.Color('#4a9cff'), bottom: new THREE.Color('#d3e8ff') };
    this.chunks = [];
    this.time = 0;
  }

  // cfg: { biomeAt(dist), onChunk(d0, d1) -> events, wantsHeart(), color }
  start(cfg) {
    this.reset();
    this.cfg = cfg;
    this.genDist = -BEHIND;
    this.nextRow = 34;
    this.coinList = [];
    this.finish = null;
    this.calm = [];
    this.noObstaclesFrom = Infinity;
    this.r = mkRng(Math.floor(Math.random() * 1e9));
    this.pending = [];
    this.queueEvents(this.genDist, this.genDist + CHUNK);
    this.applyBiome(cfg.biomeAt(0), true);
  }
  queueEvents(d0, d1) {
    for (const ev of this.cfg.onChunk(d0, d1) || []) {
      this.calm.push([ev.at - 14, ev.at + 12]);
      this.pending.push(ev);
    }
  }
  reset() {
    for (const c of this.chunks) this.disposeChunk(c);
    this.chunks = [];
    this.coinList = [];
    if (this.finish) { this.scene.remove(this.finish.mesh); this.finish = null; }
  }
  applyBiome(key, instant = false) {
    const bi = BIOME[key];
    this.biome = key;
    this.backdrop.set(key);
    this.skyTarget = { top: new THREE.Color(bi.sky[0]), bottom: new THREE.Color(bi.sky[1]) };
    this.hemi.color.set(bi.hemi[0]);
    this.hemi.groundColor.set(bi.hemi[1]);
    if (instant) { this.skyNow.top.copy(this.skyTarget.top); this.skyNow.bottom.copy(this.skyTarget.bottom); }
  }

  get obstacles() { return this.chunks.flatMap(c => c.obstacles); }
  get gates() { return this.chunks.flatMap(c => c.gates); }
  get signs() { return this.chunks.flatMap(c => c.signs); }
  get hearts() { return this.chunks.flatMap(c => c.hearts); }

  update(dt, heroDist, camera) {
    this.time += dt;
    U.uTime.value = this.time;
    fallTex.offset.y += dt * 1.6;
    while (this.genDist < heroDist + AHEAD) this.buildChunk();
    while (this.chunks.length && this.chunks[0].d1 < heroDist - BEHIND) this.disposeChunk(this.chunks.shift());
    // sky follows the biome under the hero
    const key = this.cfg.biomeAt(heroDist);
    if (key !== this.biome) this.applyBiome(key);
    const k = Math.min(1, dt * 1.5);
    this.skyNow.top.lerp(this.skyTarget.top, k);
    this.skyNow.bottom.lerp(this.skyTarget.bottom, k);
    skyMat.uniforms.top.value.copy(this.skyNow.top);
    skyMat.uniforms.bottom.value.copy(this.skyNow.bottom);
    this.scene.fog.color.copy(this.skyNow.bottom);
    this.backdrop.update(camera, dt);
    // coins
    let n = 0;
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), p = new THREE.Vector3(), s = new THREE.Vector3(1, 1, 1);
    for (const c of this.coinList) {
      if (!c.alive || c.dist > heroDist + AHEAD || c.dist < heroDist - 10) continue;
      q.setFromEuler(e.set(0, this.time * 3 + c.dist * 0.3, 0));
      m.compose(p.set(c.x, c.y + Math.sin(this.time * 4 + c.dist) * 0.08, -c.dist), q, s);
      this.coins.setMatrixAt(n++, m);
      if (n >= 260) break;
    }
    this.coins.count = n;
    this.coins.instanceMatrix.needsUpdate = true;
    // gates, hearts, emitters
    for (const c of this.chunks) {
      for (const g of c.gates) { const cr = g.mesh.userData.crystal; cr.rotation.y += dt * 2; cr.position.y = 2.6 + Math.sin(this.time * 3) * 0.2; }
      for (const h of c.hearts) { h.mesh.rotation.y += dt * 2.5; h.mesh.position.y = 1.2 + Math.sin(this.time * 4) * 0.15; }
      for (const em of c.emitters) {
        em.t -= dt;
        if (em.t > 0) continue;
        if (em.type === 'smoke') { em.t = 0.35; this.fx.spawn({ x: em.x, y: em.y, z: em.z, vx: 0.6, vy: 2.2, vz: 0, life: 3, size: 1.4, color: '#e8e8e8', g: -0.2, grow: true }); }
        if (em.type === 'mist') { em.t = 0.12; this.fx.spawn({ x: em.x + (Math.random() - 0.5) * em.w, y: 0.6, z: em.z + 0.6, vx: (Math.random() - 0.5), vy: 1.5, vz: 1, life: 1.2, size: 0.6, color: '#ffffff', g: 0, grow: true }); }
        if (em.type === 'firefly') { em.t = 0.5; this.fx.spawn({ x: em.x + (Math.random() - 0.5) * 8, y: 1 + Math.random() * 2, z: em.z + (Math.random() - 0.5) * 20, vx: (Math.random() - 0.5) * 0.6, vy: 0.2, vz: (Math.random() - 0.5) * 0.6, life: 2.5, size: 0.14, color: '#fff27a', g: 0 }); }
      }
    }
  }

  inCalm(d) { return d < 30 || d > this.noObstaclesFrom || this.calm.some(([a, b]) => d > a && d < b); }

  buildChunk() {
    const d0 = this.genDist, d1 = d0 + CHUNK, z0 = -d0;
    const r = this.r;
    const key = this.cfg.biomeAt(d0 + CHUNK / 2);
    const bi = BIOME[key];
    const chunk = { d0, d1, meshes: [], obstacles: [], gates: [], signs: [], hearts: [], emitters: [], extraGeos: [] };
    const b = new Builder(), w = new Builder();
    const extras = [];

    // ground and track
    if (bi.style === 'boardwalk') {
      w.plane(bi.water, [0, -0.08, z0 - CHUNK / 2], [260, CHUNK]);
      b.plane('#2f3f2a', [0, -0.5, z0 - CHUNK / 2], [260, CHUNK]);
      for (let i = 0; i < CHUNK / 0.6; i++) b.box(i % 2 ? '#8a6a48' : '#7c5e3f', [0, 0.0, z0 - i * 0.6 - 0.3], [7.8, 0.12, 0.56], null, 0.03);
      for (let i = 0; i < CHUNK / 3; i++) for (const s of [-1, 1]) b.box('#6a5038', [s * 4.0, 0.35, z0 - i * 3], [0.22, 1.3, 0.22]);
      for (const s of [-1, 1]) b.box('#7c5e3f', [s * 4.0, 0.9, z0 - CHUNK / 2], [0.14, 0.12, CHUNK]);
      chunk.emitters.push({ type: 'firefly', x: (r() < 0.5 ? -1 : 1) * 8, z: z0 - 15, t: r() });
    } else if (bi.style === 'surf') {
      b.plane(bi.ground, [-70, 0, z0 - CHUNK / 2], [140, CHUNK]);
      b.plane(bi.track, [0, 0.01, z0 - CHUNK / 2], [8.2, CHUNK]);
      w.plane('#7fd6e6', [0, 0.1, z0 - CHUNK / 2], [8.2, CHUNK]);
      w.plane(bi.water, [154, 0.05, z0 - CHUNK / 2], [300, CHUNK]);
      b.plane('#1d6f9a', [154, -0.6, z0 - CHUNK / 2], [300, CHUNK]);
      for (let i = 0; i < 10; i++) b.box('#ffffff', [4.4 + r() * 0.6, 0.12, z0 - r() * CHUNK], [0.5 + r(), 0.06, 0.8 + r() * 2]);
      for (let i = 0; i < 8; i++) b.box('#fff6dc', [(r() - 0.5) * 7, 0.03, z0 - r() * CHUNK], [0.3, 0.04, 0.3]);
    } else {
      b.plane(bi.ground, [0, 0, z0 - CHUNK / 2], [260, CHUNK]);
      b.plane(bi.track, [0, 0.015, z0 - CHUNK / 2], [7.4, CHUNK]);
      for (const s of [-1, 1]) b.box(bi.edge, [s * 3.8, 0.06, z0 - CHUNK / 2], [0.35, 0.12, CHUNK]);
      for (let i = 0; i < 26; i++) b.box(bi.speck, [(r() - 0.5) * 6.8, 0.04, z0 - r() * CHUNK], [0.15 + r() * 0.3, 0.05, 0.15 + r() * 0.3]);
      for (const s of [-1, 1]) for (let i = 0; i < CHUNK / 3; i++) b.box(bi.speck, [s * LANE / 2, 0.03, z0 - i * 3 - 1], [0.08, 0.03, 1.2]);
    }
    bi.decor(b, z0, r, extras);

    for (const ex of extras) {
      if (ex.type === 'waterfall' || ex.type === 'dam') this.addWaterfall(chunk, b, w, ex, bi);
      if (ex.type === 'smoke') chunk.emitters.push({ ...ex, t: r() });
      if (ex.type === 'wires') for (const dy of [7.6, 6.4]) for (const dx of [-1.9, 1.9, -1.4, 1.4]) if (Math.abs(dx) === (dy > 7 ? 1.9 : 1.4)) b.box('#333333', [ex.x + dx, dy - 0.3, ex.z], [0.04, 0.04, CHUNK + 0.2]);
    }

    // Scripted events (gates, region signs) are fetched one chunk early so their calm zones are known in time.
    this.queueEvents(d1, d1 + CHUNK);
    const events = this.pending.filter(ev => ev.at < d1);
    this.pending = this.pending.filter(ev => ev.at >= d1);
    for (const ev of events) {
      if (ev.type === 'gate') {
        const mesh = gateMesh(this.cfg.color);
        mesh.position.set(0, 0, -ev.at);
        this.scene.add(mesh);
        chunk.meshes.push(mesh);
        chunk.gates.push({ ...ev, dist: ev.at, mesh, done: false });
      } else if (ev.type === 'sign') {
        const mesh = archMesh(ev.color, ev.label);
        mesh.position.set(0, 0, -ev.at);
        this.scene.add(mesh);
        chunk.meshes.push(mesh);
        chunk.signs.push({ ...ev, dist: ev.at, mesh, done: false });
      }
    }

    // obstacle rows + coins
    const yBase = 0;
    while (this.nextRow < d1) {
      const d = this.nextRow;
      const gap = Math.max(12, 19 - d / 120);
      this.nextRow += gap * (0.85 + r() * 0.3);
      if (this.inCalm(d)) { if (!this.inCalm(d + 4)) this.coinLine(Math.floor(r() * 3) - 1, d + 2, 6, yBase); continue; }
      const lanes = [-1, 0, 1];
      const pick = arr => arr[Math.floor(r() * arr.length)];
      const pattern = r();
      const placed = [];
      if (pattern < 0.12 && d > 120) {
        placed.push(this.addObstacle(chunk, 'bigLog', 0, d, yBase));
        this.coinArc(0, d, yBase);
      } else if (pattern < 0.42) {
        const lane = pick(lanes);
        placed.push(this.addObstacle(chunk, pick(bi.obstacles.low), lane, d, yBase));
        this.coinArc(lane, d, yBase);
      } else if (pattern < 0.7 || d < 90) {
        const lane = pick(lanes);
        placed.push(this.addObstacle(chunk, pick(bi.obstacles.tall), lane, d, yBase));
        const free = lanes.filter(l => l !== lane);
        this.coinLine(pick(free), d - 4, 6, yBase);
      } else {
        const open = pick(lanes);
        const others = lanes.filter(l => l !== open);
        placed.push(this.addObstacle(chunk, pick(bi.obstacles.tall), others[0], d, yBase));
        placed.push(this.addObstacle(chunk, r() < 0.5 ? pick(bi.obstacles.tall) : pick(bi.obstacles.low), others[1], d, yBase));
        this.coinLine(open, d - 5, 7, yBase);
      }
      if (this.cfg.wantsHeart() && r() < 0.18) this.addHeart(chunk, pick(lanes), d + gap * 0.5, yBase);
    }

    if (!b.empty) { const m = b.mesh(); this.scene.add(m); chunk.meshes.push(m); chunk.extraGeos.push(m.geometry); }
    if (!w.empty) { const m = w.mesh(M.water); m.renderOrder = 2; this.scene.add(m); chunk.meshes.push(m); chunk.extraGeos.push(m.geometry); }
    this.chunks.push(chunk);
    this.genDist = d1;
  }

  addWaterfall(chunk, b, w, ex, bi) {
    const s = Math.sign(ex.x);
    if (ex.type === 'dam') {
      b.box('#c9c9c9', [ex.x, 3, ex.z], [16, 6, 2.5]);
      b.box('#b0b0b0', [ex.x, 6.2, ex.z], [16.4, 0.5, 3]);
      b.box('#8fd3ff', [ex.x, 0.06, ex.z + 8], [6, 0.08, 14]);
      for (let i = 0; i < 3; i++) this.addFall(chunk, ex.x - 4 + i * 4, 5.6, ex.z + 1.3, 2.2, 5.6);
      chunk.emitters.push({ type: 'mist', x: ex.x, z: ex.z + 1.5, w: 12, t: 0 });
      return;
    }
    const h = ex.h;
    b.box('#7d838c', [ex.x + s * 3, h / 2, ex.z - 1], [10, h, 4], null, 0.04);
    b.box('#5d9a4c', [ex.x + s * 3, h + 0.3, ex.z - 1], [10.4, 0.6, 4.4]);
    b.ico('#8e939b', [ex.x - s * 2.5, 0.8, ex.z + 1.5], [2.4, 1.8, 2], null, 0.05);
    w.plane('#5fb7e6', [ex.x, 0.08, ex.z + 2.5], [6, 5]);
    this.addFall(chunk, ex.x, h, ex.z + 1.05, 2.6, h);
    chunk.emitters.push({ type: 'mist', x: ex.x, z: ex.z + 1.5, w: 2.6, t: 0 });
  }
  addFall(chunk, x, top, z, wid, h) {
    const g = new THREE.PlaneGeometry(wid, h);
    const m = new THREE.Mesh(g, fallMat);
    m.position.set(x, top - h / 2, z);
    m.frustumCulled = false;
    this.scene.add(m);
    chunk.meshes.push(m);
    chunk.extraGeos.push(g);
  }

  addObstacle(chunk, type, lane, d, y = 0) {
    const def = OB[type];
    const mesh = obstacleMesh(type);
    const x = type === 'bigLog' ? 0 : lane * LANE;
    mesh.position.set(x, y, -d);
    this.scene.add(mesh);
    chunk.meshes.push(mesh);
    const o = { type, x, dist: d, w: def.w, d: def.d, h: def.h + y, low: def.low, mesh, hit: false };
    chunk.obstacles.push(o);
    return o;
  }
  addHeart(chunk, lane, d, y = 0) {
    if (this.inCalm(d)) return;
    const mesh = heartMesh();
    mesh.position.set(lane * LANE, 1.2 + y, -d);
    this.scene.add(mesh);
    chunk.meshes.push(mesh);
    chunk.hearts.push({ x: lane * LANE, dist: d, mesh, taken: false });
  }
  coinLine(lane, d, n, y = 0) {
    for (let i = 0; i < n; i++) this.coinList.push({ x: lane * LANE, y: 0.9 + y, dist: d + i * 1.5, alive: true });
  }
  coinArc(lane, d, y = 0) {
    for (let i = -3; i <= 3; i++) this.coinList.push({ x: lane * LANE, y: 0.9 + y + (1 - (i / 3.6) ** 2) * 1.5, dist: d + i * 1.2, alive: true });
  }

  // When the questions are done: clear everything ahead and put the finish line in front of the hero.
  placeFinish(dist) {
    this.noObstaclesFrom = dist - 40;
    this.pending = [];
    for (const c of this.chunks) {
      c.obstacles = c.obstacles.filter(o => { if (o.dist > dist - 40) { this.scene.remove(o.mesh); return false; } return true; });
      c.gates = c.gates.filter(g => { if (g.dist > dist - 40) { this.scene.remove(g.mesh); return false; } return true; });
    }
    this.coinList = this.coinList.filter(c => c.dist < dist - 40);
    for (let i = 0; i < 4; i++) this.coinLine(i % 3 - 1, dist - 34 + i * 8, 5);
    const mesh = archMesh('#ffd23f', '', { checker: true });
    mesh.position.set(0, 0, -dist);
    this.scene.add(mesh);
    this.finish = { dist, mesh };
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
