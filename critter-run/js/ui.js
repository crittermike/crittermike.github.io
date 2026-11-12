// UI helpers: the SVG icon set (js/icons.js) for the page, and the same icons painted onto textures for 3D.
import * as THREE from 'three';
import { ICONS, installIcons, icon, iconHTML } from './icons.js';

export { ICONS, installIcons, icon, iconHTML };

// A round badge with an icon, used above power-up crates in the world.
const texCache = new Map();
export function iconTexture(name, color = '#ffffff') {
  const key = name + color;
  if (texCache.has(key)) return texCache.get(key);
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const x = c.getContext('2d');
  x.fillStyle = '#1b1f4a';
  x.beginPath(); x.arc(128, 132, 120, 0, Math.PI * 2); x.fill();
  x.fillStyle = color;
  x.beginPath(); x.arc(128, 126, 114, 0, Math.PI * 2); x.fill();
  const g = x.createRadialGradient(110, 96, 10, 128, 126, 100);
  g.addColorStop(0, '#ffffff'); g.addColorStop(1, '#eef1fb');
  x.fillStyle = g;
  x.beginPath(); x.arc(128, 126, 96, 0, Math.PI * 2); x.fill();
  x.save();
  x.translate(128 - 72, 126 - 72);
  x.scale(144 / 512, 144 / 512);
  x.fillStyle = color;
  for (const d of [].concat(ICONS[name] || ICONS.question)) x.fill(new Path2D(d));
  x.restore();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  texCache.set(key, t);
  return t;
}
