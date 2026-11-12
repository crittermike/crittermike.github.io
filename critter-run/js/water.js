// Water for the beach and the swamp: a grid that knows how deep it is at every point, so it can go from clear
// turquoise shallows (with foam where the waves wash up) to deep blue, or from murky green to dark in the swamp.
// Ripples come from scrolling noise and reflect the sky.
import * as THREE from 'three';
import { bend } from './gfx.js';
import { cloudTex } from './sky.js';
import { CHUNK } from './terrain.js';

export const WATER_Y = -0.06;
const LOOKS = {
  sea: { shallow: '#5fe0d6', deep: '#1d6fb8', foam: 1, alpha: [0.55, 0.94], depthFull: 2.2, rough: 0.05, ripple: 1 },
  swamp: { shallow: '#6f7d44', deep: '#24301c', foam: 0, alpha: [0.75, 0.96], depthFull: 1.0, rough: 0.12, ripple: 0.45 },
};

const flatNormal = (() => { const t = new THREE.DataTexture(new Uint8Array([128, 128, 255, 255]), 1, 1); t.needsUpdate = true; return t; })();
const mats = new Map();
function waterMaterial(kind) {
  if (mats.has(kind)) return mats.get(kind);
  const L = LOOKS[kind];
  const mat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: L.rough, metalness: 0, transparent: true, depthWrite: false, normalMap: flatNormal, envMapIntensity: 1.3 });
  const uni = { tCloud: { value: cloudTex }, uShallow: { value: new THREE.Color(L.shallow) }, uDeep: { value: new THREE.Color(L.deep) }, uFoam: { value: L.foam }, uAlpha: { value: new THREE.Vector2(...L.alpha) }, uFull: { value: L.depthFull }, uRipple: { value: L.ripple } };
  bend(mat, {
    key: 'water',
    patch: sh => {
      Object.assign(sh.uniforms, uni);
      sh.vertexShader = 'attribute float depth;\nuniform float uRipple;\nvarying float vDepth;\nvarying vec2 vW;\n' + sh.vertexShader
        .replace('#include <uv_vertex>', '#include <uv_vertex>\nvNormalMapUv = (modelMatrix * vec4(position, 1.0)).xz;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvDepth = depth;\nvW = (modelMatrix * vec4(position, 1.0)).xz;\ntransformed.y += sin(vW.x * 0.35 + uTime * 1.3) * 0.04 * uRipple + sin(vW.y * 0.27 + uTime * 0.9) * 0.04 * uRipple;');
      sh.fragmentShader = 'uniform float uTime;\nuniform sampler2D tCloud;\nuniform vec3 uShallow;\nuniform vec3 uDeep;\nuniform float uFoam;\nuniform vec2 uAlpha;\nuniform float uFull;\nuniform float uRipple;\nvarying float vDepth;\nvarying vec2 vW;\n'
        + sh.fragmentShader
        .replace('#include <map_fragment>', `
          float dk = smoothstep(0.0, uFull, vDepth);
          vec3 wc = mix(uShallow, uDeep, dk);
          // Foam: a lacy band at the waterline that washes in and out, plus streaks behind each wave.
          float wash = sin(vW.y * 0.12 + uTime * 0.8) * 0.12 + sin(uTime * 1.1 + vW.y * 0.05) * 0.08;
          float lace = texture2D(tCloud, vW * vec2(0.35, 0.18) + vec2(uTime * 0.03, 0.0)).r;
          float foam = uFoam * smoothstep(0.32, 0.05, vDepth + wash) * smoothstep(0.35, 0.6, lace + 0.25);
          foam += uFoam * smoothstep(0.62, 0.8, texture2D(tCloud, vW * vec2(0.09, 0.4) + vec2(uTime * 0.05, uTime * 0.01)).r) * (1.0 - dk) * 0.5;
          diffuseColor.rgb = mix(wc, vec3(1.0), clamp(foam, 0.0, 1.0));
          diffuseColor.a = mix(uAlpha.x, uAlpha.y, dk) * smoothstep(-0.02, 0.06, vDepth) + foam * 0.4;
        `)
        .replace('#include <normal_fragment_maps>', `
          // Two layers of ripples scrolling different ways, turned into a normal by finite differences.
          vec2 q1 = vW * 0.22 + vec2(uTime * 0.04, uTime * 0.025), q2 = vW * 0.53 - vec2(uTime * 0.03, uTime * 0.05);
          float e = 0.015;
          float h0 = texture2D(tCloud, q1).r + texture2D(tCloud, q2).r * 0.5;
          float hx = texture2D(tCloud, q1 + vec2(e, 0.0)).r + texture2D(tCloud, q2 + vec2(e, 0.0)).r * 0.5;
          float hy = texture2D(tCloud, q1 + vec2(0.0, e)).r + texture2D(tCloud, q2 + vec2(0.0, e)).r * 0.5;
          vec3 mapN = normalize(vec3((h0 - hx) * 6.0 * uRipple, (h0 - hy) * 6.0 * uRipple, 1.0));
          normal = normalize(tbn * mapN);
        `)
        .replace('#include <roughnessmap_fragment>', 'float roughnessFactor = mix(roughness, 0.6, clamp(foam, 0.0, 1.0));');
    },
  });
  mats.set(kind, mat);
  return mat;
}

// A water grid over [x0, x1] for one chunk. Depth at each vertex comes from the ground height under it.
export function waterMesh(kind, z0, x0, x1, heightAt) {
  const xs = [];
  for (let x = x0; x < x1; x += x < 30 ? 1.5 : x < 60 ? 4 : 12) xs.push(x);
  xs.push(x1);
  const rows = Math.round(CHUNK / 1.5) + 1, cols = xs.length;
  const pos = new Float32Array(rows * cols * 3), dep = new Float32Array(rows * cols), nor = new Float32Array(rows * cols * 3);
  for (let j = 0; j < rows; j++) {
    const z = z0 - j * 1.5;
    for (let i = 0; i < cols; i++) {
      const k = j * cols + i;
      pos.set([xs[i], WATER_Y, z], k * 3);
      nor.set([0, 1, 0], k * 3);
      dep[k] = WATER_Y - heightAt(xs[i], z);
    }
  }
  const idx = [];
  for (let j = 0; j < rows - 1; j++) for (let i = 0; i < cols - 1; i++) {
    const a = j * cols + i, b = a + 1, c = a + cols, d = c + 1;
    idx.push(a, b, c, b, d, c);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(rows * cols * 2), 2));
  geo.setAttribute('depth', new THREE.BufferAttribute(dep, 1));
  geo.setIndex(idx);
  const m = new THREE.Mesh(geo, waterMaterial(kind));
  m.renderOrder = 2;
  m.receiveShadow = true;
  m.frustumCulled = false;
  return m;
}
