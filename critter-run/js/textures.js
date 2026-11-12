// Canvas-painted textures for the trail surface of each biome. Painted once at startup and tiled along the trail.
import * as THREE from 'three';
import { rng } from './gfx.js';

const W = 256, H = 512; // across the trail x along it; maps to TRACK_W x PATH_LEN meters
export const PATH_LEN = 14;

function blotches(x, r, n, colors, rMin, rMax, alpha) {
  for (let i = 0; i < n; i++) {
    x.globalAlpha = alpha * (0.4 + r() * 0.6);
    x.fillStyle = colors[Math.floor(r() * colors.length)];
    const px = r() * W, py = r() * H, rx = rMin + r() * (rMax - rMin), ry = rx * (0.5 + r() * 0.8);
    for (const dy of [-H, 0, H]) { x.beginPath(); x.ellipse(px, py + dy, rx, ry, r() * Math.PI, 0, Math.PI * 2); x.fill(); }
  }
  x.globalAlpha = 1;
}
function pebbles(x, r, n, colors, size, edgeOnly = 0) {
  for (let i = 0; i < n; i++) {
    let px = r() * W;
    if (edgeOnly && r() < edgeOnly) px = r() < 0.5 ? r() * W * 0.14 : W - r() * W * 0.14;
    const py = r() * H, s = size * (0.5 + r()), c = colors[Math.floor(r() * colors.length)];
    for (const dy of [-H, 0, H]) {
      x.fillStyle = 'rgba(0,0,0,0.22)';
      x.beginPath(); x.ellipse(px + 1.5, py + dy + 2, s, s * 0.7, 0, 0, Math.PI * 2); x.fill();
      x.fillStyle = c;
      x.beginPath(); x.ellipse(px, py + dy, s, s * 0.7, r(), 0, Math.PI * 2); x.fill();
      x.fillStyle = 'rgba(255,255,255,0.25)';
      x.beginPath(); x.ellipse(px - s * 0.3, py + dy - s * 0.25, s * 0.4, s * 0.25, 0, 0, Math.PI * 2); x.fill();
    }
  }
}
function edgeGrass(x, r, color, n = 220) {
  x.strokeStyle = color;
  x.lineCap = 'round';
  for (let i = 0; i < n; i++) {
    const left = r() < 0.5, d = Math.pow(r(), 1.8) * W * 0.16;
    const px = left ? d : W - d, py = r() * H, len = 6 + r() * 12;
    x.lineWidth = 1.5 + r() * 2;
    x.globalAlpha = 0.5 + r() * 0.5;
    for (const dy of [-H, 0, H]) { x.beginPath(); x.moveTo(px, py + dy); x.lineTo(px + (r() - 0.5) * 8, py + dy - len); x.stroke(); }
  }
  x.globalAlpha = 1;
}
// Soft darkening toward both edges, and faint grooves between the three lanes so they're easy to see.
function lanes(x, dark = 'rgba(40,25,10,0.18)') {
  const g = x.createLinearGradient(0, 0, W, 0);
  g.addColorStop(0, 'rgba(0,0,0,0.28)'); g.addColorStop(0.1, 'rgba(0,0,0,0)'); g.addColorStop(0.9, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.28)');
  x.fillStyle = g;
  x.fillRect(0, 0, W, H);
  x.fillStyle = dark;
  for (const u of [1 / 3, 2 / 3]) x.fillRect(u * W - 2, 0, 4, H);
}

const STYLES = {
  dirt: (x, r) => {
    x.fillStyle = '#a07a52'; x.fillRect(0, 0, W, H);
    blotches(x, r, 140, ['#8c6a46', '#b38c62', '#94714b', '#7d5f3f'], 10, 40, 0.5);
    for (const u of [1 / 6, 0.5, 5 / 6]) { x.fillStyle = 'rgba(255,230,190,0.10)'; x.fillRect(u * W - 18, 0, 36, H); }
    pebbles(x, r, 90, ['#8e939b', '#a3a8b0', '#7d6a55', '#b8a58a'], 3.2);
    edgeGrass(x, r, '#4f9a3a');
    lanes(x);
  },
  clay: (x, r) => {
    x.fillStyle = '#b8643f'; x.fillRect(0, 0, W, H);
    blotches(x, r, 150, ['#a4552f', '#c4744c', '#9b4f2c', '#cf8256'], 8, 36, 0.5);
    for (const u of [1 / 6, 0.5, 5 / 6]) { x.fillStyle = 'rgba(255,220,180,0.10)'; x.fillRect(u * W - 16, 0, 32, H); }
    pebbles(x, r, 60, ['#d9c3a5', '#8c5a3c', '#e0cdb0'], 2.8);
    edgeGrass(x, r, '#5fae45');
    lanes(x, 'rgba(70,20,5,0.2)');
  },
  sand: (x, r) => {
    x.fillStyle = '#ecd59c'; x.fillRect(0, 0, W, H);
    blotches(x, r, 120, ['#e3c98a', '#f4e2b0', '#dcc07f'], 10, 40, 0.45);
    x.strokeStyle = 'rgba(160,120,60,0.18)';
    x.lineWidth = 2;
    for (let i = 0; i < 40; i++) { const py = r() * H; x.beginPath(); x.moveTo(0, py); for (let px = 0; px <= W; px += 16) x.lineTo(px, py + Math.sin(px * 0.05 + i) * 4); x.stroke(); }
    pebbles(x, r, 30, ['#c9b48a', '#a89474', '#f6ecd3'], 2.4);
    edgeGrass(x, r, '#9aa85a', 120);
    lanes(x, 'rgba(120,80,30,0.14)');
  },
  farm: (x, r) => {
    x.fillStyle = '#9c7650'; x.fillRect(0, 0, W, H);
    blotches(x, r, 130, ['#8a6644', '#ab855c', '#7a5a3c'], 10, 36, 0.5);
    for (const u of [1 / 6, 0.5, 5 / 6]) for (const o of [-14, 14]) { x.fillStyle = 'rgba(60,35,15,0.22)'; x.fillRect(u * W + o - 5, 0, 10, H); }
    pebbles(x, r, 50, ['#8e939b', '#b8a58a'], 2.6);
    edgeGrass(x, r, '#5aa83f', 260);
    lanes(x);
  },
  boards: (x, r) => {
    const n = 32, ph = H / n;
    for (let i = 0; i < n; i++) {
      const base = ['#9a7350', '#8c6847', '#a57d58', '#94704c'][Math.floor(r() * 4)];
      x.fillStyle = base; x.fillRect(0, i * ph, W, ph);
      x.strokeStyle = 'rgba(60,40,20,0.25)'; x.lineWidth = 1;
      for (let k = 0; k < 4; k++) { const py = i * ph + 2 + r() * (ph - 4); x.beginPath(); x.moveTo(0, py); x.bezierCurveTo(W * 0.3, py + 1.5, W * 0.6, py - 1.5, W, py); x.stroke(); }
      x.fillStyle = 'rgba(30,18,8,0.75)'; x.fillRect(0, i * ph + ph - 2, W, 2);
      x.fillStyle = 'rgba(255,240,210,0.12)'; x.fillRect(0, i * ph, W, 2);
      x.fillStyle = '#4a3a2a';
      for (const u of [0.04, 0.5, 0.96]) { x.beginPath(); x.arc(u * W, i * ph + ph / 2, 1.8, 0, Math.PI * 2); x.fill(); }
    }
    blotches(x, r, 40, ['#5f4a33', '#b89470'], 10, 30, 0.15);
    lanes(x, 'rgba(30,20,10,0.12)');
  },
  beach: (x, r) => {
    x.fillStyle = '#e9d29c'; x.fillRect(0, 0, W, H);
    blotches(x, r, 120, ['#dfc68c', '#f2e1b2', '#d4b97c', '#c9ad73'], 10, 40, 0.45);
    pebbles(x, r, 40, ['#ffffff', '#f2c1a5', '#d9b38c', '#c9d8e0'], 2.2);
    lanes(x, 'rgba(120,80,30,0.12)');
  },
};

const cache = new Map();
export function pathTexture(style, renderer) {
  if (cache.has(style)) return cache.get(style);
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  STYLES[style](c.getContext('2d'), rng(style.length * 977 + 13));
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = THREE.ClampToEdgeWrapping;
  t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = renderer ? Math.min(8, renderer.capabilities.getMaxAnisotropy()) : 4;
  cache.set(style, t);
  return t;
}

// A light, tileable grass/soil detail that multiplies the ground's vertex colors, so wide fields aren't flat.
let groundTex = null;
export function groundTexture(renderer) {
  if (groundTex) return groundTex;
  const N = 256, c = document.createElement('canvas');
  c.width = c.height = N;
  const x = c.getContext('2d'), r = rng(4242);
  x.fillStyle = '#e9e9e9';
  x.fillRect(0, 0, N, N);
  const wrap = (fn) => { for (const dx of [-N, 0, N]) for (const dy of [-N, 0, N]) fn(dx, dy); };
  for (let i = 0; i < 90; i++) {
    const px = r() * N, py = r() * N, rad = 10 + r() * 28, v = r() < 0.5 ? 205 + r() * 20 : 245 + r() * 10;
    x.fillStyle = `rgba(${v},${v},${v},0.35)`;
    wrap((dx, dy) => { x.beginPath(); x.ellipse(px + dx, py + dy, rad, rad * 0.7, r() * 3, 0, Math.PI * 2); x.fill(); });
  }
  x.lineCap = 'round';
  for (let i = 0; i < 900; i++) {
    const px = r() * N, py = r() * N, len = 3 + r() * 7, a = -Math.PI / 2 + (r() - 0.5) * 0.9;
    const v = r() < 0.75 ? 150 + r() * 50 : 255;
    x.strokeStyle = `rgba(${v},${v},${v},${0.35 + r() * 0.4})`;
    x.lineWidth = 1 + r() * 1.4;
    wrap((dx, dy) => { x.beginPath(); x.moveTo(px + dx, py + dy); x.lineTo(px + dx + Math.cos(a) * len, py + dy + Math.sin(a) * len); x.stroke(); });
  }
  groundTex = new THREE.CanvasTexture(c);
  groundTex.colorSpace = THREE.SRGBColorSpace;
  groundTex.wrapS = groundTex.wrapT = THREE.RepeatWrapping;
  groundTex.repeat.set(1 / 3.5, 1 / 3.5);
  groundTex.anisotropy = renderer ? Math.min(8, renderer.capabilities.getMaxAnisotropy()) : 4;
  return groundTex;
}
