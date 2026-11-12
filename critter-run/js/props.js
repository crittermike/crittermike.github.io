// The scenery, obstacle and pickup models baked into assets/world.glb (see assets/CREDITS.md).
// Each prop is kept as plain geometry so a whole chunk of the world can be merged into a few draw calls.
import * as THREE from 'three';
import { GLTFLoader, MeshoptDecoder } from 'three/addons';
import { bend } from './gfx.js';

export const gltfLoader = new GLTFLoader();
gltfLoader.setMeshoptDecoder(MeshoptDecoder);

// key -> { parts: [{ geo, mat }], box: Box3, size: Vector3 }
const PROPS = new Map();
// Material keys other than 'vcol' (props that kept their texture) -> material
export const PROP_MATS = new Map();

// Quantized attributes are expanded to plain floats so they can be transformed and merged.
function floatAttr(a) {
  const n = a.count, s = a.itemSize, out = new Float32Array(n * s);
  const get = ['getX', 'getY', 'getZ', 'getW'];
  for (let i = 0; i < n; i++) for (let k = 0; k < s; k++) out[i * s + k] = a[get[k]](i);
  return new THREE.BufferAttribute(out, s);
}

// Faceted canopies get smooth normals so they read as soft foliage rather than low-poly shapes.
const SMOOTH = new Set(['willow', 'peachTree', 'appleTree', 'treeAutumn']);
function smoothNormals(g) {
  const p = g.attributes.position, n = g.attributes.normal, acc = new Map();
  const key = i => `${Math.round(p.getX(i) * 1e3)},${Math.round(p.getY(i) * 1e3)},${Math.round(p.getZ(i) * 1e3)}`;
  for (let i = 0; i < p.count; i++) {
    const k = key(i);
    let a = acc.get(k);
    if (!a) acc.set(k, (a = [0, 0, 0]));
    a[0] += n.getX(i); a[1] += n.getY(i); a[2] += n.getZ(i);
  }
  for (let i = 0; i < p.count; i++) {
    const a = acc.get(key(i)), l = Math.hypot(a[0], a[1], a[2]);
    if (l > 1e-4) n.setXYZ(i, a[0] / l, a[1] / l, a[2] / l);
  }
}

export async function loadProps(url, onProgress) {
  const gltf = await gltfLoader.loadAsync(url, onProgress);
  gltf.scene.updateMatrixWorld(true);
  for (const node of gltf.scene.children) {
    const parts = [];
    node.traverse(o => {
      if (!o.isMesh) return;
      const g = new THREE.BufferGeometry();
      for (const name of ['position', 'normal', 'color', 'uv']) if (o.geometry.attributes[name]) g.setAttribute(name, floatAttr(o.geometry.attributes[name]));
      if (o.geometry.index) g.setIndex(new THREE.BufferAttribute(Uint32Array.from(o.geometry.index.array), 1));
      g.applyMatrix4(o.matrixWorld);
      if (SMOOTH.has(node.name) && g.attributes.normal) smoothNormals(g);
      let mat = 'vcol';
      if (o.material.map) {
        mat = 'tex:' + o.material.name;
        if (!PROP_MATS.has(mat)) {
          o.material.map.anisotropy = 4;
          PROP_MATS.set(mat, bend(new THREE.MeshStandardMaterial({ map: o.material.map, vertexColors: true, roughness: 0.9, metalness: 0 }), { key: mat }));
        }
      }
      parts.push({ geo: g, mat });
    });
    const box = new THREE.Box3();
    for (const p of parts) { p.geo.computeBoundingBox(); box.union(p.geo.boundingBox); }
    PROPS.set(node.name, { parts, box, size: box.getSize(new THREE.Vector3()) });
  }
  return PROPS;
}

export const prop = key => {
  const p = PROPS.get(key);
  if (!p) console.warn('Missing prop', key);
  return p;
};
export const hasProp = key => PROPS.has(key);

// One merged geometry for a prop (all parts), used for instanced pickups like coins.
export function propGeometry(key) {
  const p = prop(key);
  if (!p) return new THREE.BoxGeometry(0.5, 0.5, 0.5);
  if (p.parts.length === 1) return p.parts[0].geo;
  const geos = p.parts.map(x => x.geo);
  const out = new THREE.BufferGeometry();
  let nv = 0, ni = 0;
  for (const g of geos) { nv += g.attributes.position.count; ni += g.index.count; }
  for (const name of ['position', 'normal', 'color']) {
    const arr = new Float32Array(nv * 3);
    let o = 0;
    for (const g of geos) { arr.set(g.attributes[name] ? g.attributes[name].array : new Float32Array(g.attributes.position.count * 3).fill(1), o); o += g.attributes.position.count * 3; }
    out.setAttribute(name, new THREE.BufferAttribute(arr, 3));
  }
  const idx = new Uint32Array(ni);
  let io = 0, vo = 0;
  for (const g of geos) { for (const i of g.index.array) idx[io++] = i + vo; vo += g.attributes.position.count; }
  out.setIndex(new THREE.BufferAttribute(idx, 1));
  return out;
}

// Recolors a prop's saturated colors (for example a yellow arch or a green mystery box) to a new color,
// keeping white and grey parts and the original shading.
export function recolored(key, color) {
  const src = propGeometry(key).clone();
  const c = src.attributes.color, target = new THREE.Color(color);
  const hsl = {}, t = {};
  target.getHSL(t);
  const tmp = new THREE.Color();
  for (let i = 0; i < c.count; i++) {
    tmp.setRGB(c.getX(i), c.getY(i), c.getZ(i));
    tmp.getHSL(hsl);
    if (hsl.s < 0.25) continue;
    tmp.setHSL(t.h, Math.min(1, t.s * 1.05), Math.min(0.85, t.l * (0.6 + hsl.l)));
    c.setXYZ(i, tmp.r, tmp.g, tmp.b);
  }
  return src;
}
