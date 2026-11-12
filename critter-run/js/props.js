// Scenery and obstacle models (GLB files in assets/nature, see assets/CREDITS.md). Each model is loaded once,
// centered on its base and scaled to real size, then split into parts (geometry + material) so a whole chunk's
// worth of one tree or rock is drawn with one InstancedMesh per part.
import * as THREE from 'three';
import { GLTFLoader, MeshoptDecoder } from 'three/addons';
import { bend } from './gfx.js';

const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
const models = new Map();

// Leaves, needles, moss and grass cards sway in the wind: the higher above the base, the more they move.
const swayPatch = amount => sh => {
  sh.uniforms.uSway = { value: amount };
  sh.vertexShader = 'uniform float uSway;\n' + sh.vertexShader.replace('#include <project_vertex>', `
    {
      #ifdef USE_INSTANCING
      vec3 ip = (modelMatrix * instanceMatrix[3]).xyz;
      #else
      vec3 ip = (modelMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
      #endif
      float gust = sin(uTime * 1.1 + ip.x * 0.31 + ip.z * 0.17) * 0.6 + sin(uTime * 2.3 + ip.z * 0.71 + position.y) * 0.4;
      float k = max(position.y, 0.0);
      transformed.x += gust * uSway * k * k * 0.01;
      transformed.z += gust * uSway * k * k * 0.005;
    }
    #include <project_vertex>`);
};
const FOLIAGE = /leaf|leaves|foliage|needle|frond|moss|grass|fern|bush|branch|twig|palm|card|plant|reed/i;

// opts: height (meters, top of the model) or scale; sway (0..1) for foliage; rim light; shadow (cast).
export function loadModel(url, opts = {}) {
  const key = url + JSON.stringify(opts);
  if (!models.has(key)) models.set(key, loader.loadAsync(url).then(g => prepare(g.scene, opts)).catch(e => { models.delete(key); throw e; }));
  return models.get(key);
}

function prepare(root, opts) {
  root.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(root);
  const size = box.getSize(new THREE.Vector3());
  const k = opts.scale || (opts.height ? opts.height / Math.max(0.001, size.y) : 1);
  // Base center at the origin, then scaled.
  const norm = new THREE.Matrix4().makeScale(k, k, k).multiply(new THREE.Matrix4().makeTranslation(-(box.min.x + box.max.x) / 2, -box.min.y, -(box.min.z + box.max.z) / 2));
  const parts = [];
  const matCache = new Map();
  root.traverse(o => {
    if (!o.isMesh) return;
    const geo = floatCopy(o.geometry).applyMatrix4(new THREE.Matrix4().multiplyMatrices(norm, o.matrixWorld));
    if (o.matrixWorld.determinant() < 0) flipWinding(geo);
    const src = [].concat(o.material)[0];
    if (geo.attributes.color && !src.vertexColors) geo.deleteAttribute('color');
    let mat = matCache.get(src);
    if (!mat) {
      mat = src.clone();
      const leafy = FOLIAGE.test(src.name || '') || FOLIAGE.test(o.name || '') || src.alphaTest > 0 || src.transparent;
      if (leafy && src.map) {
        // Cut-out leaves: hard alpha edges draw in any order and cast leaf-shaped shadows.
        mat.transparent = false;
        mat.alphaTest = Math.max(0.4, src.alphaTest || 0);
        mat.depthWrite = true;
        mat.side = THREE.DoubleSide;
      }
      if (opts.tint) mat.color.multiply(new THREE.Color(opts.tint));
      if ('roughness' in mat && opts.rough != null) mat.roughness = opts.rough;
      const sway = leafy ? (opts.sway ?? 0.5) : (opts.swayAll || 0);
      bend(mat, { rim: opts.rim || 0, patch: sway ? swayPatch(sway) : null, key: sway ? 'sway' : '' });
      matCache.set(src, mat);
    }
    // Trees come with a detailed (LOD0_*) and a light (LOD1_*) version; other models have one version.
    const lod = /^LOD(\d)_/.exec(o.name || '');
    parts.push({ geo, mat, leafy: mat.alphaTest > 0, lod: lod ? Number(lod[1]) : null });
  });
  const fbox = new THREE.Box3().setFromObject(root).applyMatrix4(norm);
  const lods = new Set(parts.map(p => p.lod).filter(l => l != null));
  return { parts, lods, size: fbox.getSize(new THREE.Vector3()), height: size.y * k, radius: Math.max(size.x, size.z) * k / 2, opts };
}

// Compressed models store positions as small integers that only cover the model's own box. Baking a transform
// into them needs real floats, so copy every attribute out as Float32.
function floatCopy(src) {
  const geo = new THREE.BufferGeometry();
  for (const [name, a] of Object.entries(src.attributes)) {
    const n = a.count, k = a.itemSize, out = new Float32Array(n * k);
    for (let i = 0; i < n; i++) for (let c = 0; c < k; c++) out[i * k + c] = a.getComponent(i, c);
    geo.setAttribute(name, new THREE.BufferAttribute(out, k));
  }
  if (src.index) geo.setIndex(src.index.clone());
  for (const g of src.groups) geo.addGroup(g.start, g.count, g.materialIndex);
  return geo;
}

function flipWinding(geo) {
  const idx = geo.index;
  if (!idx) return;
  const a = idx.array;
  for (let i = 0; i < a.length; i += 3) { const t = a[i + 1]; a[i + 1] = a[i + 2]; a[i + 2] = t; }
  idx.needsUpdate = true;
}

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _p = new THREE.Vector3(), _s = new THREE.Vector3(), _up = new THREE.Vector3(0, 1, 0);
export function placeMatrix(x, y, z, rot = 0, scale = 1, out = new THREE.Matrix4()) {
  return out.compose(_p.set(x, y, z), _q.setFromAxisAngle(_up, rot), _s.set(scale, scale, scale));
}

// The parts to draw for a level of detail (0 = full, 1 = light), falling back to whatever the model has.
const partsFor = (model, lod) => {
  const want = model.lods.has(lod) ? lod : model.lods.size ? Math.min(...model.lods) : null;
  return model.parts.filter(p => p.lod == null || p.lod === want);
};

// Draws one model many times. placements: [{x, y, z, rot, scale}]. Returns the meshes (one per part).
export function instances(model, placements, { cast = true, receive = true, lod = 0 } = {}) {
  if (!placements.length) return [];
  return partsFor(model, lod).map(p => {
    const mesh = new THREE.InstancedMesh(p.geo, p.mat, placements.length);
    placements.forEach((pl, i) => mesh.setMatrixAt(i, placeMatrix(pl.x, pl.y, pl.z, pl.rot, pl.scale, _m)));
    mesh.instanceMatrix.needsUpdate = true;
    mesh.castShadow = cast;
    mesh.receiveShadow = receive;
    // The curved-world bend moves vertices on the GPU, so CPU culling would drop things that are really on screen.
    mesh.frustumCulled = false;
    return mesh;
  });
}

// One copy of a model as an ordinary object (for obstacles that get knocked away one at a time).
export function single(model, { cast = true, receive = true } = {}) {
  const g = new THREE.Group();
  for (const p of partsFor(model, 0)) {
    const m = new THREE.Mesh(p.geo, p.mat);
    m.castShadow = cast;
    m.receiveShadow = receive;
    m.frustumCulled = false;
    g.add(m);
  }
  return g;
}
