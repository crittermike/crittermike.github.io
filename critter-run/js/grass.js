// Instanced grass beside the trail: thousands of tufts that sway in the wind, thickest along the edges of the
// path and thinning out toward the hills. Each region has its own grass (lush meadow, dry wiregrass, reeds,
// sea oats). The quality tier sets how much is planted.
import * as THREE from 'three';
import { bend } from './gfx.js';
import { pathMask, PATH_W, CHUNK } from './terrain.js';

export const GRASS = {
  mountains: { base: '#2a4f1a', tip: '#b5d16a', h: 0.55, n: 1, spread: 22 },
  foothills: { base: '#335f1c', tip: '#cfe57a', h: 0.5, n: 1, spread: 22 },
  sandhills: { base: '#6f6436', tip: '#e6d79c', h: 0.62, n: 0.3, spread: 26, clumpy: true },
  farmland: { base: '#346220', tip: '#c8e872', h: 0.45, n: 0.8, spread: 3.2 },
  swamp: { base: '#26401c', tip: '#90a656', h: 1.0, n: 0.55, spread: 14, clumpy: true },
  beach: { base: '#7c7a46', tip: '#efe3a8', h: 0.85, n: 0.28, spread: 20, clumpy: true, leftOnly: true },
};

// One tuft: five slim blades fanned around the center, each bending outward as it rises.
function tuftGeometry() {
  const pos = [], uv = [], nor = [], idx = [];
  const blades = 5, segs = 3;
  for (let b = 0; b < blades; b++) {
    const a = (b / blades) * Math.PI * 2 + b * 0.7;
    const lean = 0.18 + (b % 3) * 0.08, w = 0.05 + (b % 2) * 0.015, tall = 0.75 + ((b * 37) % 10) / 30;
    const dx = Math.cos(a), dz = Math.sin(a), px = -dz, pz = dx;
    const start = pos.length / 3;
    for (let s = 0; s <= segs; s++) {
      const t = s / segs, off = lean * t * t, y = tall * t, half = w * (1 - t * 0.85);
      for (const side of [-1, 1]) {
        pos.push(dx * off * 0.6 + px * half * side + dx * 0.03, y, dz * off * 0.6 + pz * half * side + dz * 0.03);
        uv.push(side * 0.5 + 0.5, t);
        // Mostly-up normals light grass like the ground under it, so tufts blend in instead of flickering.
        nor.push(dx * 0.35, 0.94, dz * 0.35);
      }
    }
    for (let s = 0; s < segs; s++) {
      const i = start + s * 2;
      idx.push(i, i + 1, i + 2, i + 1, i + 3, i + 2);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  return g;
}
const TUFT = tuftGeometry();

const mats = new Map();
function grassMaterial(key) {
  if (mats.has(key)) return mats.get(key);
  const gr = GRASS[key];
  const uni = { uBase: { value: new THREE.Color(gr.base) }, uTip: { value: new THREE.Color(gr.tip) } };
  const mat = new THREE.MeshStandardMaterial({ roughness: 0.85, metalness: 0, side: THREE.DoubleSide });
  bend(mat, {
    key: 'grass',
    patch: sh => {
      Object.assign(sh.uniforms, uni);
      sh.vertexShader = 'varying float vGH;\n' + sh.vertexShader.replace('#include <project_vertex>', `
        vGH = uv.y;
        #ifdef USE_INSTANCING
        {
          // Wind blows in world space, in slow gusts that roll across the field.
          vec3 ip = (modelMatrix * instanceMatrix[3]).xyz;
          float gust = sin(uTime * 1.3 + ip.x * 0.21 + ip.z * 0.17) * 0.6 + sin(uTime * 2.7 + ip.z * 0.53 + ip.x * 0.11) * 0.4;
          vec3 push = vec3(0.16 + gust * 0.14, 0.0, gust * 0.06) * uv.y * uv.y;
          mat3 im = mat3(instanceMatrix);
          transformed += transpose(im) * push / dot(im[0], im[0]);
        }
        #endif
        #include <project_vertex>`);
      sh.fragmentShader = 'varying float vGH;\nuniform vec3 uBase;\nuniform vec3 uTip;\n' + sh.fragmentShader.replace('#include <color_fragment>', `
        #include <color_fragment>
        diffuseColor.rgb *= mix(uBase, uTip, smoothstep(0.0, 1.0, vGH)) * mix(0.6, 1.0, vGH);`);
    },
  });
  mats.set(key, mat);
  return mat;
}

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _p = new THREE.Vector3(), _s = new THREE.Vector3(), _c = new THREE.Color(), _up = new THREE.Vector3(0, 1, 0);

// Plants the grass for one chunk. heightAt(x, z) gives the ground height; keep(x, z) can veto spots (crop rows, water).
export function grassForChunk(key, z0, heightAt, r, amount, keep = () => true) {
  const gr = GRASS[key];
  const want = Math.round(2600 * gr.n * amount);
  if (want <= 0) return null;
  const mesh = new THREE.InstancedMesh(TUFT, grassMaterial(key), want);
  let n = 0;
  for (let tries = 0; n < want && tries < want * 3; tries++) {
    const side = gr.leftOnly || r() < 0.5 ? -1 : 1;
    // Thickest right at the trail edge, thinning out with distance.
    const x = side * (PATH_W - 0.6 + Math.pow(r(), 1.7) * gr.spread);
    const z = z0 - r() * CHUNK;
    if (pathMask(x, z) > 0.25 || !keep(x, z)) continue;
    if (gr.clumpy && Math.sin(x * 0.7 + Math.sin(z * 0.3) * 2) + Math.sin(z * 0.45) < 0.4) continue;
    const y = heightAt(x, z);
    if (y < -0.15) continue;
    const s = gr.h * (0.65 + r() * 0.7) * (Math.abs(x) < PATH_W + 0.6 ? 0.7 : 1);
    _q.setFromAxisAngle(_up, r() * Math.PI * 2);
    _m.compose(_p.set(x, y - 0.02, z), _q, _s.set(s * (0.8 + r() * 0.5), s, s * (0.8 + r() * 0.5)));
    mesh.setMatrixAt(n, _m);
    mesh.setColorAt(n, _c.setHSL(0, 0, 0.82 + r() * 0.36).offsetHSL((r() - 0.5) * 0.04, 0, 0));
    n++;
  }
  mesh.count = n;
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  mesh.frustumCulled = false;
  mesh.receiveShadow = true;
  mesh.castShadow = false;
  return mesh;
}
