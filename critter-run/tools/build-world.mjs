// Bakes the props listed in world-list.mjs into assets/world.glb.
// - Texture colors are sampled per vertex into COLOR_0 so every prop can share ONE vertex-color material
//   and a whole chunk of scenery can be merged into a single draw call at runtime.
// - Props whose textures carry detail that vertex colors can't hold (measured, see bakeError) keep their texture.
// The source packs (see assets/CREDITS.md) aren't in the repo. Download them into one folder, laid out like the
// paths in world-list.mjs, then in a scratch folder:
//   npm i @gltf-transform/core@4 @gltf-transform/extensions@4 @gltf-transform/functions@4 meshoptimizer sharp
//   ENV=/path/to/packs node /path/to/build-world.mjs critter-run/assets/world.glb
import { NodeIO, Document } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { weld, meshopt, dedup, prune } from '@gltf-transform/functions';
import { MeshoptEncoder, MeshoptDecoder } from 'meshoptimizer';
import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';
import { PROPS } from './world-list.mjs';

const ENV = process.env.ENV || path.resolve(path.dirname(new URL(import.meta.url).pathname), '../assets-staging/env');
const OUT = process.argv[2] || 'world.glb';
const ERR_LIMIT = Number(process.env.ERR_LIMIT || 0.055);
await MeshoptEncoder.ready;
await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder });

const srgbToLinear = c => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
const hexToLinear = h => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(v => srgbToLinear(v / 255)); };
const linToSrgb = c => (c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055);

const imageCache = new Map();
async function decodeTexture(tex) {
  if (imageCache.has(tex)) return imageCache.get(tex);
  const { data, info } = await sharp(Buffer.from(tex.getImage())).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const img = { data, w: info.width, h: info.height, src: tex };
  imageCache.set(tex, img);
  return img;
}
// Nearest texel, repeat wrapping, returned in linear space.
function sample(img, u, v, out) {
  const x = Math.min(img.w - 1, Math.floor((u - Math.floor(u)) * img.w));
  const y = Math.min(img.h - 1, Math.floor((v - Math.floor(v)) * img.h));
  const i = (y * img.w + x) * 4;
  out[0] = srgbToLinear(img.data[i] / 255); out[1] = srgbToLinear(img.data[i + 1] / 255); out[2] = srgbToLinear(img.data[i + 2] / 255);
  return out;
}
function uvTransform(info) {
  const t = info && info.getExtension('KHR_texture_transform');
  if (!t) return (u, v) => [u, v];
  const [ox, oy] = t.getOffset(), r = t.getRotation(), [sx, sy] = t.getScale();
  const c = Math.cos(r), s = Math.sin(r);
  return (u, v) => { const x = u * sx, y = v * sy; return [c * x + s * y + ox, -s * x + c * y + oy]; };
}

function mat4MulPoint(m, x, y, z) { return [m[0] * x + m[4] * y + m[8] * z + m[12], m[1] * x + m[5] * y + m[9] * z + m[13], m[2] * x + m[6] * y + m[10] * z + m[14]]; }
function mat4MulDir(m, x, y, z) {
  // Normal matrix: inverse transpose of the upper 3x3. Props only use rotation + (possibly non-uniform) scale.
  const a = [m[0], m[1], m[2], m[4], m[5], m[6], m[8], m[9], m[10]];
  const det = a[0] * (a[4] * a[8] - a[5] * a[7]) - a[3] * (a[1] * a[8] - a[2] * a[7]) + a[6] * (a[1] * a[5] - a[2] * a[4]);
  const inv = [
    (a[4] * a[8] - a[5] * a[7]) / det, (a[2] * a[7] - a[1] * a[8]) / det, (a[1] * a[5] - a[2] * a[4]) / det,
    (a[5] * a[6] - a[3] * a[8]) / det, (a[0] * a[8] - a[2] * a[6]) / det, (a[2] * a[3] - a[0] * a[5]) / det,
    (a[3] * a[7] - a[4] * a[6]) / det, (a[1] * a[6] - a[0] * a[7]) / det, (a[0] * a[4] - a[1] * a[3]) / det,
  ];
  // transpose(inv) * n, with inv stored column-major like gl-matrix
  const nx = inv[0] * x + inv[1] * y + inv[2] * z, ny = inv[3] * x + inv[4] * y + inv[5] * z, nz = inv[6] * x + inv[7] * y + inv[8] * z;
  const l = Math.hypot(nx, ny, nz) || 1;
  return [nx / l, ny / l, nz / l];
}
function mat4Mul(a, b) {
  const o = new Array(16).fill(0);
  for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) for (let k = 0; k < 4; k++) o[c * 4 + r] += a[k * 4 + r] * b[c * 4 + k];
  return o;
}
function userMatrix({ s = 1, ry = 0 } = {}) {
  const [sx, sy, sz] = Array.isArray(s) ? s : [s, s, s];
  const c = Math.cos(ry), n = Math.sin(ry);
  return [c * sx, 0, -n * sx, 0, 0, sy, 0, 0, n * sz, 0, c * sz, 0, 0, 0, 0, 1];
}

// Reads one source file into flat arrays (world space, user transform applied) plus per-vertex UVs/texture refs.
async function readProp(file, opt) {
  const doc = await io.read(path.join(ENV, file));
  const U = userMatrix(opt);
  const tint = Object.fromEntries(Object.entries(opt.tint || {}).map(([k, v]) => [k, hexToLinear(v)]));
  const parts = [];
  const tmp = [0, 0, 0];
  for (const scene of doc.getRoot().listScenes()) scene.traverse(node => {
    const mesh = node.getMesh();
    if (!mesh) return;
    const M = mat4Mul(U, node.getWorldMatrix());
    for (const prim of mesh.listPrimitives()) {
      if (prim.getMode() !== 4) continue;
      const P = prim.getAttribute('POSITION'), N = prim.getAttribute('NORMAL'), C = prim.getAttribute('COLOR_0');
      const mat = prim.getMaterial();
      const info = mat && mat.getBaseColorTextureInfo();
      const tex = mat && mat.getBaseColorTexture();
      const UV = tex ? prim.getAttribute('TEXCOORD_' + (info.getTexCoord() || 0)) : null;
      const xf = uvTransform(info);
      const factor = mat ? mat.getBaseColorFactor() : [1, 1, 1, 1];
      const t = mat && tint[mat.getName()];
      const n = P.getCount();
      const part = { pos: new Float32Array(n * 3), nor: new Float32Array(n * 3), uv: UV ? new Float32Array(n * 2) : null, base: new Float32Array(n * 3), tex, mat, idx: null };
      for (let i = 0; i < n; i++) {
        const p = P.getElement(i, []);
        part.pos.set(mat4MulPoint(M, p[0], p[1], p[2]), i * 3);
        const nn = N ? N.getElement(i, []) : [0, 1, 0];
        part.nor.set(mat4MulDir(M, nn[0], nn[1], nn[2]), i * 3);
        let r = t ? t[0] : factor[0], g = t ? t[1] : factor[1], b = t ? t[2] : factor[2];
        if (C) { const c = C.getElement(i, tmp.slice()); r *= c[0]; g *= c[1]; b *= c[2]; }
        part.base.set([r, g, b], i * 3);
        if (UV) { const q = UV.getElement(i, []); part.uv.set(xf(q[0], q[1]), i * 2); }
      }
      const I = prim.getIndices();
      part.idx = I ? Uint32Array.from(I.getArray()) : Uint32Array.from({ length: n }, (_, i) => i);
      parts.push(part);
    }
  });
  return parts;
}

// Area-weighted color error between the texture and per-vertex colors, sampled inside each triangle.
async function bakeError(part, colors) {
  if (!part.tex) return 0;
  const img = await decodeTexture(part.tex);
  const { pos, uv, idx } = part;
  let err = 0, area = 0;
  const s = [0, 0, 0];
  const bary = [[1 / 3, 1 / 3, 1 / 3], [0.6, 0.2, 0.2], [0.2, 0.6, 0.2], [0.2, 0.2, 0.6]];
  for (let t = 0; t < idx.length; t += 3) {
    const a = idx[t], b = idx[t + 1], c = idx[t + 2];
    const ab = [pos[b * 3] - pos[a * 3], pos[b * 3 + 1] - pos[a * 3 + 1], pos[b * 3 + 2] - pos[a * 3 + 2]];
    const ac = [pos[c * 3] - pos[a * 3], pos[c * 3 + 1] - pos[a * 3 + 1], pos[c * 3 + 2] - pos[a * 3 + 2]];
    const ar = Math.hypot(ab[1] * ac[2] - ab[2] * ac[1], ab[2] * ac[0] - ab[0] * ac[2], ab[0] * ac[1] - ab[1] * ac[0]) / 2;
    if (!ar) continue;
    let e = 0;
    for (const [wa, wb, wc] of bary) {
      sample(img, uv[a * 2] * wa + uv[b * 2] * wb + uv[c * 2] * wc, uv[a * 2 + 1] * wa + uv[b * 2 + 1] * wb + uv[c * 2 + 1] * wc, s);
      for (let k = 0; k < 3; k++) {
        const vc = colors[a * 3 + k] * wa + colors[b * 3 + k] * wb + colors[c * 3 + k] * wc;
        e += Math.abs(linToSrgb(s[k] * part.base[a * 3 + k]) - linToSrgb(vc));
      }
    }
    err += (e / 12) * ar;
    area += ar;
  }
  return area ? err / area : 0;
}

const out = new Document();
const buffer = out.createBuffer();
const scene = out.createScene('props');
const vcol = out.createMaterial('vcol').setBaseColorFactor([1, 1, 1, 1]).setRoughnessFactor(0.9).setMetallicFactor(0);
const texMats = new Map();
const acc = (type, arr) => out.createAccessor().setType(type).setArray(arr).setBuffer(buffer);
const report = [];

for (const [key, [file, opt = {}]] of Object.entries(PROPS)) {
  const parts = await readProp(file, opt);
  // Bake colors and decide per prop whether the texture has to stay.
  let worst = 0;
  for (const p of parts) {
    const n = p.pos.length / 3;
    p.col = new Float32Array(n * 3);
    if (p.tex) {
      const img = await decodeTexture(p.tex);
      const s = [0, 0, 0];
      for (let i = 0; i < n; i++) {
        sample(img, p.uv[i * 2], p.uv[i * 2 + 1], s);
        for (let k = 0; k < 3; k++) p.col[i * 3 + k] = s[k] * p.base[i * 3 + k];
      }
      worst = Math.max(worst, await bakeError(p, p.col));
    } else p.col.set(p.base);
  }
  const keepTex = opt.tex || (!opt.bake && worst > ERR_LIMIT);
  // Group parts by output material: one vertex-color group, or one group per kept texture.
  const groups = new Map();
  for (const p of parts) {
    const k = keepTex && p.tex ? p.tex : 'vcol';
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(p);
  }
  const mesh = out.createMesh(key);
  let tris = 0;
  for (const [k, list] of groups) {
    const textured = k !== 'vcol';
    let nv = 0, ni = 0;
    for (const p of list) { nv += p.pos.length / 3; ni += p.idx.length; }
    const dup = opt.ds ? 2 : 1;
    const pos = new Float32Array(nv * 3 * dup), nor = new Float32Array(nv * 3 * dup), col = new Float32Array(nv * 3 * dup);
    const uv = textured ? new Float32Array(nv * 2 * dup) : null;
    const idx = new Uint32Array(ni * dup);
    let vo = 0, io2 = 0;
    for (let d = 0; d < dup; d++) for (const p of list) {
      const n = p.pos.length / 3;
      pos.set(p.pos, vo * 3);
      for (let i = 0; i < n * 3; i++) nor[vo * 3 + i] = d ? -p.nor[i] : p.nor[i];
      // Textured groups keep the material color in COLOR_0 (texture is multiplied in the shader).
      col.set(textured ? p.base : p.col, vo * 3);
      if (uv) uv.set(p.uv, vo * 2);
      for (let i = 0; i < p.idx.length; i += 3) {
        idx[io2++] = p.idx[i] + vo;
        idx[io2++] = p.idx[i + (d ? 2 : 1)] + vo;
        idx[io2++] = p.idx[i + (d ? 1 : 2)] + vo;
      }
      vo += n;
    }
    tris += idx.length / 3;
    const prim = out.createPrimitive().setAttribute('POSITION', acc('VEC3', pos)).setAttribute('NORMAL', acc('VEC3', nor)).setAttribute('COLOR_0', acc('VEC3', col)).setIndices(acc('SCALAR', idx));
    if (uv) prim.setAttribute('TEXCOORD_0', acc('VEC2', uv));
    if (textured) {
      if (!texMats.has(k)) {
        const img = await decodeTexture(k);
        const size = Math.min(512, Math.max(img.w, img.h));
        const jpg = await sharp(Buffer.from(k.getImage())).resize(size, size, { fit: 'inside' }).jpeg({ quality: 82 }).toBuffer();
        const t = out.createTexture(key).setImage(new Uint8Array(jpg)).setMimeType('image/jpeg');
        texMats.set(k, out.createMaterial('tex:' + key).setBaseColorTexture(t).setRoughnessFactor(0.9).setMetallicFactor(0));
      }
      prim.setMaterial(texMats.get(k));
    } else prim.setMaterial(vcol);
    mesh.addPrimitive(prim);
  }
  scene.addChild(out.createNode(key).setMesh(mesh));
  report.push({ key, file, tris, err: +worst.toFixed(3), tex: keepTex });
}

await out.transform(dedup(), weld(), prune(), meshopt({ encoder: MeshoptEncoder, level: 'high', quantizeNormal: 8, quantizePosition: 14 }));
await io.write(OUT, out);
const kept = report.filter(r => r.tex);
console.log(report.map(r => `${r.key.padEnd(16)} ${String(r.tris).padStart(5)}t err ${r.err.toFixed(3)}${r.tex ? '  TEXTURE' : ''}`).join('\n'));
console.log(`\n${report.length} props, ${report.reduce((a, r) => a + r.tris, 0)} tris, ${kept.length} keep textures (${kept.map(r => r.key).join(', ')})`);
console.log(`${OUT}: ${(fs.statSync(OUT).size / 1024).toFixed(0)} KB`);
