// Shared rendering helpers: curved-world shader, toon materials, and a voxel geometry builder.
import * as THREE from 'three';

// Uniforms shared by every bent material. uBend curves the world down with distance
// (a rolling "tiny planet" horizon); uCurveX swings the trail gently left/right.
export const U = { uBend: { value: 0.0017 }, uCurveX: { value: 0 }, uTime: { value: 0 } };

export function bend(mat, { wave = false } = {}) {
  mat.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, U);
    sh.vertexShader = 'uniform float uBend;\nuniform float uCurveX;\nuniform float uTime;\n' + sh.vertexShader.replace(
      '#include <project_vertex>',
      `#include <project_vertex>
      ${wave ? `vec4 wpos = modelMatrix * vec4(transformed, 1.0);
      mvPosition.y += sin(wpos.x * 0.8 + uTime * 2.1) * 0.07 + sin(wpos.z * 0.6 + uTime * 1.6) * 0.07;` : ''}
      float bz = min(mvPosition.z, 0.0);
      mvPosition.y -= bz * bz * uBend;
      mvPosition.x += bz * bz * uCurveX;
      gl_Position = projectionMatrix * mvPosition;`,
    );
  };
  mat.customProgramCacheKey = () => (wave ? 'bend-wave' : 'bend');
  return mat;
}

const gradient = new THREE.DataTexture(new Uint8Array([120, 190, 255]), 3, 1, THREE.RedFormat);
gradient.minFilter = gradient.magFilter = THREE.NearestFilter;
gradient.needsUpdate = true;

export const M = {
  solid: bend(new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: gradient })),
  glow: bend(new THREE.MeshBasicMaterial({ vertexColors: true })),
  water: bend(new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: gradient, transparent: true, opacity: 0.86, depthWrite: false }), { wave: true }),
};

// ---------- voxel builder ----------
// Base shapes are unit-sized, non-indexed, and flat-shaded so every part gets crisp low-poly faces.
const BASE = new Map();
function base(key, make) {
  let g = BASE.get(key);
  if (!g) {
    g = make();
    if (g.index) g = g.toNonIndexed();
    g.deleteAttribute('uv');
    g.computeVertexNormals();
    BASE.set(key, g);
  }
  return g;
}
const shapes = {
  box: () => base('box', () => new THREE.BoxGeometry(1, 1, 1)),
  cone: seg => base('cone' + seg, () => new THREE.ConeGeometry(0.5, 1, seg)),
  cyl: (seg, top) => base(`cyl${seg}:${top}`, () => new THREE.CylinderGeometry(0.5 * top, 0.5, 1, seg)),
  ico: detail => base('ico' + detail, () => new THREE.IcosahedronGeometry(0.5, detail)),
  oct: () => base('oct', () => new THREE.OctahedronGeometry(0.5, 0)),
  plane: () => base('plane', () => new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2)),
};

const _p = new THREE.Vector3(), _s = new THREE.Vector3(), _q = new THREE.Quaternion(), _e = new THREE.Euler();
const _v = new THREE.Vector3(), _nm = new THREE.Matrix3();

export class Builder {
  constructor() { this.parts = []; }
  // pos [x,y,z] is the shape's center; size [w,h,d]; rot [rx,ry,rz].
  add(geo, color, pos, size, rot = null, jitter = 0) {
    const m = new THREE.Matrix4().compose(
      _p.set(pos[0], pos[1], pos[2]),
      rot ? _q.setFromEuler(_e.set(rot[0] || 0, rot[1] || 0, rot[2] || 0)) : _q.identity(),
      _s.set(size[0], size[1], size[2]),
    );
    const c = new THREE.Color(color);
    if (jitter) c.offsetHSL(0, 0, (Math.random() - 0.5) * jitter);
    this.parts.push({ g: geo, m, c });
    return this;
  }
  box(color, pos, size, rot, jitter) { return this.add(shapes.box(), color, pos, size, rot, jitter); }
  cone(color, pos, r, h, seg = 6, rot, jitter) { return this.add(shapes.cone(seg), color, pos, [r * 2, h, r * 2], rot, jitter); }
  cyl(color, pos, r, h, seg = 8, rot, top = 1, jitter) { return this.add(shapes.cyl(seg, top), color, pos, [r * 2, h, r * 2], rot, jitter); }
  ico(color, pos, size, rot, jitter, detail = 0) { return this.add(shapes.ico(detail), color, pos, size, rot, jitter); }
  oct(color, pos, size, rot) { return this.add(shapes.oct(), color, pos, size, rot); }
  plane(color, pos, size, rot) { return this.add(shapes.plane(), color, pos, [size[0], 1, size[1]], rot); }
  get empty() { return this.parts.length === 0; }
  build() {
    let n = 0;
    for (const p of this.parts) n += p.g.attributes.position.count;
    const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), col = new Float32Array(n * 3);
    let o = 0;
    for (const { g, m, c } of this.parts) {
      const P = g.attributes.position.array, N = g.attributes.normal.array, cnt = g.attributes.position.count;
      _nm.getNormalMatrix(m);
      for (let i = 0; i < cnt; i++) {
        const k = (o + i) * 3;
        _v.fromArray(P, i * 3).applyMatrix4(m).toArray(pos, k);
        _v.fromArray(N, i * 3).applyMatrix3(_nm).normalize().toArray(nor, k);
        col[k] = c.r; col[k + 1] = c.g; col[k + 2] = c.b;
      }
      o += cnt;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    geo.computeBoundingSphere();
    return geo;
  }
  mesh(material = M.solid) {
    const mesh = new THREE.Mesh(this.build(), material);
    mesh.frustumCulled = false; // the bend shader moves vertices, so CPU culling would be wrong
    return mesh;
  }
}

export function mesh(fn, material = M.solid) {
  const b = new Builder();
  fn(b);
  return b.mesh(material);
}

// ---------- text on a canvas ----------
export function textTexture(text, { w = 512, h = 128, bg = '#ffffff', fg = '#222', border = '#222', font = 700, size = 72 } = {}) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const x = c.getContext('2d');
  const r = h * 0.28;
  x.fillStyle = border;
  roundRect(x, 0, 0, w, h, r); x.fill();
  x.fillStyle = bg;
  roundRect(x, 8, 8, w - 16, h - 16, r - 6); x.fill();
  x.fillStyle = fg;
  x.textAlign = 'center';
  x.textBaseline = 'middle';
  let s = size;
  do { x.font = `${font} ${s}px Fredoka, "Arial Rounded MT Bold", system-ui, sans-serif`; s -= 4; } while (x.measureText(text).width > w - 40 && s > 20);
  x.fillText(text, w / 2, h / 2 + 4);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}
function roundRect(x, l, t, w, h, r) {
  x.beginPath();
  x.moveTo(l + r, t);
  x.arcTo(l + w, t, l + w, t + h, r);
  x.arcTo(l + w, t + h, l, t + h, r);
  x.arcTo(l, t + h, l, t, r);
  x.arcTo(l, t, l + w, t, r);
  x.closePath();
}

export const rng = seed => () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
