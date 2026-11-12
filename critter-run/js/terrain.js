// The ground: one textured heightfield per chunk of track. The trail is painted into the same surface with a
// soft, ragged edge where the grass gives way to dirt (or sand), and the land rolls up into hills away from it.
// Ground textures are photo-scanned PBR sets in assets/textures (see assets/CREDITS.md). Until they load (or if
// they can't), noise textures stand in.
import * as THREE from 'three';
import { SimplexNoise } from 'three/addons';
import { bend, rng } from './gfx.js';

export const CHUNK = 30;
export const PATH_W = 4.0; // half-width of the trail

// ---------- shared noise ----------
// One random 256x256 tile, read with the same bilinear filtering in JS and in the shaders, so grass placed by JS
// lines up with the trail edge drawn by the GPU.
const NOISE_N = 256;
const noiseData = (() => {
  const r = rng(1337), d = new Uint8Array(NOISE_N * NOISE_N);
  for (let i = 0; i < d.length; i++) d[i] = Math.floor(r() * 256);
  return d;
})();
export const noiseTex = (() => {
  const t = new THREE.DataTexture(noiseData, NOISE_N, NOISE_N, THREE.RedFormat, THREE.UnsignedByteType);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.magFilter = t.minFilter = THREE.LinearFilter;
  t.needsUpdate = true;
  return t;
})();
// Matches texture2D(tNoise, p / 256.0).r for a LinearFilter + RepeatWrapping texture.
export function noise(x, y) {
  const fx = x - 0.5, fy = y - 0.5;
  const ix = Math.floor(fx), iy = Math.floor(fy), tx = fx - ix, ty = fy - iy;
  const at = (i, j) => noiseData[(((j % NOISE_N) + NOISE_N) % NOISE_N) * NOISE_N + (((i % NOISE_N) + NOISE_N) % NOISE_N)] / 255;
  const a = at(ix, iy), b = at(ix + 1, iy), c = at(ix, iy + 1), d = at(ix + 1, iy + 1);
  return (a + (b - a) * tx) * (1 - ty) + (c + (d - c) * tx) * ty;
}
export const NOISE_GLSL = `
uniform sampler2D tNoise;
float nz(vec2 p) { return texture2D(tNoise, p / 256.0).r; }
// 0 on the grass, 1 on the trail. The edge wanders a little so it looks worn in rather than painted on.
float pathMask(vec2 w, float halfW) {
  float e = nz(w * vec2(0.9, 0.35)) * 0.7 + nz(w * 2.7 + 31.0) * 0.3 - 0.5;
  return 1.0 - smoothstep(halfW - 0.45, halfW + 0.35, abs(w.x) + e);
}`;
export function pathMask(x, z, halfW = PATH_W) {
  const e = noise(x * 0.9, z * 0.35) * 0.7 + noise(x * 2.7 + 31, z * 2.7 + 31) * 0.3 - 0.5;
  const t = Math.min(1, Math.max(0, (Math.abs(x) + e - (halfW - 0.45)) / 0.8));
  return 1 - t * t * (3 - 2 * t);
}

// ---------- biomes ----------
// hills: height of the land well away from the trail. water: ground dips below the water line (swamp) or the
// right-hand side drops into the sea (beach). Colors tint the textures so each region has its own feel.
export const GROUND = {
  mountains: { grass: 'grass', path: 'forest_floor', grassTint: '#ffffff', pathTint: '#ffffff', hills: 9, roll: 0.02, rise: 16, dry: 0.15 },
  foothills: { grass: 'grass', path: 'red_clay', grassTint: '#ffffe8', pathTint: '#ffffff', hills: 6, roll: 0.016, rise: 12, dry: 0.05 },
  sandhills: { grass: 'sand_coarse', path: 'sand_beach', grassTint: '#ffffff', pathTint: '#ffffff', hills: 3.5, roll: 0.028, rise: 10, dry: 1, sandy: true },
  farmland: { grass: 'grass', path: 'dirt_trail', grassTint: '#f4ffd8', pathTint: '#ffffff', hills: 1.6, roll: 0.01, rise: 18, dry: 0.1 },
  swamp: { grass: 'mud_wet', path: 'mud_wet', grassTint: '#ffffff', pathTint: '#ffffff', hills: 0.8, roll: 0.03, rise: 6, dry: 0, sink: 0.9 },
  beach: { grass: 'sand_beach', path: 'sand_beach', grassTint: '#ffffff', pathTint: '#e8d8bc', hills: 2.6, roll: 0.03, rise: 7, dry: 1, sandy: true, sea: true },
};

const simplex = new SimplexNoise({ random: rng(42) });
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

// Height of the land. The trail strip is always flat at y = 0 so runners and obstacles sit on it.
export function heightFor(g, x, z) {
  const ax = Math.abs(x);
  const away = smooth(PATH_W + 2.2, PATH_W + 2.2 + g.rise, ax);
  if (away <= 0) return 0;
  const n1 = simplex.noise(x * g.roll, z * g.roll) * 0.5 + 0.5;
  const n2 = simplex.noise(x * g.roll * 3.1 + 17, z * g.roll * 3.1) * 0.5 + 0.5;
  let h = away * g.hills * (0.25 + 0.75 * n1 * smooth(4, 40, ax) + 0.25 * n2);
  if (g.sink) h -= away * g.sink;
  // The sea side of the beach slopes down under the water.
  if (g.sea && x > 0) h = -away * (0.6 + Math.min(4, (ax - PATH_W) * 0.08));
  return h;
}

// ---------- textures ----------
const texLoader = new THREE.TextureLoader();
const sets = new Map();
// A tiling PBR set: albedo (sRGB) and normal map. Missing files fall back to the noise stand-ins.
function textureSet(name) {
  if (sets.has(name)) return sets.get(name);
  const fb = FALLBACK[name] || FALLBACK.grass;
  const set = { map: fb.map(), normal: fb.normal() };
  const base = `./assets/textures/${name}/`;
  // The stand-in is already on the GPU at its own size, so free it before the bigger photo takes its place.
  const swap = (tex, img) => { tex.dispose(); tex.image = img; tex.needsUpdate = true; };
  texLoader.load(base + 'albedo.webp', t => { set.map.colorSpace = THREE.SRGBColorSpace; swap(set.map, t.image); }, undefined, () => {});
  texLoader.load(base + 'normal.webp', t => swap(set.normal, t.image), undefined, () => {});
  sets.set(name, set);
  return set;
}
function tile(t) {
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  t.generateMipmaps = true;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  return t;
}
// Stand-in textures made from noise: speckled color plus a matching bumpy normal map.
function noiseCanvas(size, paint) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const x = c.getContext('2d');
  paint(x, size);
  return c;
}
function speckle(base, dots, n = 9000) {
  return () => {
    const t = new THREE.CanvasTexture(noiseCanvas(256, (x, s) => {
      x.fillStyle = base; x.fillRect(0, 0, s, s);
      const r = rng(7);
      for (let i = 0; i < n; i++) { x.fillStyle = dots[Math.floor(r() * dots.length)]; x.globalAlpha = 0.25 + r() * 0.5; x.fillRect(r() * s, r() * s, 1 + r() * 2.5, 1 + r() * 2.5); }
    }));
    t.colorSpace = THREE.SRGBColorSpace;
    return tile(t);
  };
}
// A canvas (not a DataTexture) so the real normal map can later be swapped into the same texture.
function flatNormal() {
  const t = new THREE.CanvasTexture(noiseCanvas(4, (x, s) => { x.fillStyle = 'rgb(128,128,255)'; x.fillRect(0, 0, s, s); }));
  return tile(t);
}
const FALLBACK = {
  grass: { map: speckle('#5d8f3a', ['#4a7a2c', '#7cae4c', '#3d6a26', '#8fbf5a']), normal: flatNormal },
  forest_floor: { map: speckle('#7a6a52', ['#6e5238', '#8a7a62', '#5a4330']), normal: flatNormal },
  dirt_trail: { map: speckle('#8a6a4a', ['#6e5238', '#a3825e', '#5a4330', '#b39270']), normal: flatNormal },
  red_clay: { map: speckle('#a65a3a', ['#8a4a2e', '#c0704a', '#7a3d26']), normal: flatNormal },
  sand_coarse: { map: speckle('#cbb98e', ['#bba878', '#d9c9a0', '#b09a6c']), normal: flatNormal },
  sand_beach: { map: speckle('#e2cc96', ['#d4bb82', '#efdcab', '#c9ae74', '#f5e6bd']), normal: flatNormal },
  mud_wet: { map: speckle('#5d5a3c', ['#4a4830', '#6f6a48', '#3c3a26']), normal: flatNormal },
};

// ---------- material ----------
const mats = new Map();
export function groundMaterial(key) {
  if (mats.has(key)) return mats.get(key);
  const g = GROUND[key];
  const grass = textureSet(g.grass), path = textureSet(g.path);
  const mat = new THREE.MeshStandardMaterial({ map: grass.map, normalMap: grass.normal, roughness: 1, metalness: 0 });
  mat.normalScale.set(0.9, 0.9);
  const uni = {
    tNoise: { value: noiseTex },
    tPath: { value: path.map }, tPathN: { value: path.normal },
    uGrassTint: { value: new THREE.Color(g.grassTint) }, uPathTint: { value: new THREE.Color(g.pathTint) },
    uPathW: { value: PATH_W }, uSandy: { value: g.sandy ? 1 : 0 },
  };
  bend(mat, {
    key: 'ground',
    patch: sh => {
      Object.assign(sh.uniforms, uni);
      sh.vertexShader = 'varying vec3 vWorldP;\n' + sh.vertexShader
        .replace('#include <uv_vertex>', '#include <uv_vertex>\nvNormalMapUv = (modelMatrix * vec4(position, 1.0)).xz;')
        .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvWorldP = (modelMatrix * vec4(transformed, 1.0)).xyz;');
      sh.fragmentShader = 'varying vec3 vWorldP;\nuniform sampler2D tPath;\nuniform sampler2D tPathN;\nuniform vec3 uGrassTint;\nuniform vec3 uPathTint;\nuniform float uPathW;\nuniform float uSandy;\n'
        + NOISE_GLSL + '\n' + sh.fragmentShader
        .replace('#include <map_fragment>', `
          vec2 wp = vWorldP.xz;
          float pm = pathMask(wp, uPathW);
          // Two scales of each texture, blended, so the tiling doesn't show; plus slow patches of lighter and darker ground.
          vec3 g1 = texture2D(map, wp * 0.21).rgb, g2 = texture2D(map, wp * 0.047 + 0.37).rgb;
          vec3 p1 = texture2D(tPath, wp * 0.24).rgb, p2 = texture2D(tPath, wp * 0.061 + 0.53).rgb;
          float macro = nz(wp * 0.05) * 0.6 + nz(wp * 0.013 + 7.0) * 0.4;
          vec3 grassCol = mix(g1, g2, 0.4) * uGrassTint * (0.78 + 0.44 * macro);
          vec3 pathCol = mix(p1, p2, 0.35) * uPathTint * (0.9 + 0.2 * nz(wp * 0.11 + 3.0));
          // Footworn lanes: the middle of each lane is a touch darker and smoother.
          float lanes = 1.0 - 0.1 * (1.0 - smoothstep(0.0, 0.9, abs(fract((wp.x + 3.3) / 2.2) - 0.5) * 2.2)) * (1.0 - uSandy);
          vec3 col = mix(grassCol, pathCol * lanes, pm);
          // A darker rim where grass meets the trail grounds the edge.
          col *= 1.0 - 0.18 * (1.0 - uSandy) * smoothstep(0.5, 0.0, abs(pm - 0.5)) ;
          diffuseColor.rgb *= col;
        `)
        .replace('#include <normal_fragment_maps>', `
          vec3 nG = mix(texture2D(normalMap, wp * 0.21).xyz, texture2D(normalMap, wp * 0.047 + 0.37).xyz, 0.4) * 2.0 - 1.0;
          vec3 nP = texture2D(tPathN, wp * 0.24).xyz * 2.0 - 1.0;
          vec3 mapN = normalize(mix(nG, nP, pm));
          mapN.xy *= normalScale;
          normal = normalize(tbn * mapN);
        `)
        .replace('#include <roughnessmap_fragment>', 'float roughnessFactor = mix(1.0, 0.92, pm);');
    },
  });
  mats.set(key, mat);
  return mat;
}

// ---------- geometry ----------
// Columns are dense near the trail and spread out toward the hills; rows every 1.5 m so the curved-world bend stays smooth.
const COLS = (() => {
  const half = [0, 1.2, 2.4, 3.3, 4.1, 4.9, 5.8, 7, 8.5, 10.5, 13, 16, 20, 25, 31, 38, 47, 58, 72, 90, 112, 140];
  return [...half.slice(1).reverse().map(x => -x), ...half];
})();
const ROW = 1.5;

// Builds the ground for one chunk. heightAt(x, z) gives the land height, which may blend two biomes.
export function groundGeometry(z0, heightAt) {
  const rows = Math.round(CHUNK / ROW) + 1, cols = COLS.length;
  const pos = new Float32Array(rows * cols * 3), nor = new Float32Array(rows * cols * 3);
  const e = 0.6;
  for (let j = 0; j < rows; j++) {
    const z = z0 - j * ROW;
    for (let i = 0; i < cols; i++) {
      const x = COLS[i], k = (j * cols + i) * 3;
      pos[k] = x; pos[k + 1] = heightAt(x, z); pos[k + 2] = z;
      // Normals from the height function itself, so neighboring chunks shade seamlessly.
      const dx = heightAt(x + e, z) - heightAt(x - e, z), dz = heightAt(x, z + e) - heightAt(x, z - e);
      const n = new THREE.Vector3(-dx, 2 * e, -dz).normalize();
      nor[k] = n.x; nor[k + 1] = n.y; nor[k + 2] = n.z;
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
  // The ground shader makes its own UVs from world position; this attribute just satisfies three.js.
  geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(rows * cols * 2), 2));
  geo.setIndex(idx);
  geo.computeBoundingSphere();
  return geo;
}
