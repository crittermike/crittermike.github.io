// Shared rendering helpers: the curved-world shader, shared materials, a geometry batcher that merges real
// models into one draw call per chunk, a water material, and small canvas textures.
import * as THREE from 'three';

// Uniforms shared by every bent material. uBend curves the world down with horizontal distance from the camera
// (a rolling "tiny planet" horizon). uRim lights character edges so they pop off the background.
export const U = { uBend: { value: 0.0016 }, uTime: { value: 0 }, uRim: { value: new THREE.Color('#fff4d6') } };

const BEND_GLSL = `
      vec3 upV = viewMatrix[1].xyz;
      float hgt = dot(upV, mvPosition.xyz);
      float d2 = max(dot(mvPosition.xyz, mvPosition.xyz) - hgt * hgt, 0.0);
      mvPosition.xyz -= upV * (d2 * uBend);
      gl_Position = projectionMatrix * mvPosition;`;

// The bend runs in view space but measures distance in the world's horizontal plane, so turning or tilting
// the camera never changes how much a point sinks. Shadows are drawn unbent, which still lines up because the
// receiver looks up its shadow with its unbent world position too.
// sway: foliage near the top of a model drifts in the wind (amount scales with height above the ground).
export function bend(mat, { rim = 0, sway = 0, key = '' } = {}) {
  mat.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, U);
    sh.vertexShader = 'uniform float uBend;\nuniform float uTime;\n' + sh.vertexShader.replace(
      '#include <project_vertex>',
      `${sway ? `{
        vec4 wp = modelMatrix * vec4(transformed, 1.0);
        float k = smoothstep(1.2, 6.0, wp.y) * ${sway.toFixed(3)};
        transformed.x += sin(uTime * 1.3 + wp.x * 0.35 + wp.z * 0.2) * k;
        transformed.z += cos(uTime * 1.1 + wp.z * 0.3) * k * 0.6;
      }` : ''}
      #include <project_vertex>
      ${BEND_GLSL}`,
    );
    if (rim && sh.fragmentShader.includes('#include <emissivemap_fragment>')) {
      sh.fragmentShader = 'uniform vec3 uRim;\n' + sh.fragmentShader.replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
        float rimF = 1.0 - clamp(dot(normal, normalize(vViewPosition)), 0.0, 1.0);
        totalEmissiveRadiance += uRim * (pow(rimF, 3.0) * ${rim.toFixed(3)});`,
      );
    }
  };
  mat.customProgramCacheKey = () => `bend:${rim}:${sway}:${key}`;
  return mat;
}

const solid = opts => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.88, metalness: 0, ...opts });

export const M = {
  solid: bend(solid()),
  // Trees and bushes far from the trail sway a little in the wind.
  foliage: bend(solid(), { sway: 0.07 }),
  // Characters get a soft rim light so they read clearly against busy scenery.
  actor: bend(solid({ roughness: 0.7 }), { rim: 0.55 }),
  // Glow colors go above 1.0 so the bloom pass picks them up.
  glow: bend(new THREE.MeshBasicMaterial({ vertexColors: true, color: new THREE.Color(1.5, 1.5, 1.5) })),
};

// ---------- water ----------
// Lit water with moving ripples: a few crossing waves perturb the normal so the sky and sun glint off it.
// Vertex color red = how shallow the water is (0 deep, 1 shallow); green = foam (shoreline surf).
const WAVES = `
vec3 waterWaves(vec2 p, float t) {
  float a1 = p.x * 0.9 + t * 1.7 + sin(p.y * 0.4 + t);
  float a2 = p.y * 1.3 - t * 2.1 + p.x * 0.3;
  float a3 = (p.x + p.y) * 2.3 + t * 3.1;
  float h = 0.5 * sin(a1) + 0.35 * sin(a2) + 0.15 * sin(a3);
  float dx = 0.45 * cos(a1) + 0.105 * cos(a2) + 0.345 * cos(a3);
  float dz = 0.2 * cos(a1) * cos(p.y * 0.4 + t) + 0.455 * cos(a2) + 0.345 * cos(a3);
  return vec3(h, dx, dz);
}
`;
export function waterMaterial({ deep = '#1f7fb0', shallow = '#4fc1d9', opacity = 0.92, ripple = 1, speed = 1, foam = 0 } = {}) {
  const mat = new THREE.MeshStandardMaterial({ color: '#ffffff', vertexColors: true, roughness: 0.08, metalness: 0, transparent: opacity < 1, opacity, depthWrite: opacity >= 1, envMapIntensity: 1.4 });
  const uni = { uDeep: { value: new THREE.Color(deep) }, uShallow: { value: new THREE.Color(shallow) }, uRipple: { value: ripple }, uSpeed: { value: speed }, uFoam: { value: foam } };
  mat.userData.uniforms = uni;
  mat.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, U, uni);
    sh.vertexShader = 'uniform float uBend;\nuniform float uTime;\nvarying vec3 vWPos;\n' + sh.vertexShader.replace(
      '#include <project_vertex>',
      `vWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;
      transformed.y += (sin(vWPos.x * 0.7 + uTime * 1.6) + sin(vWPos.z * 0.5 + uTime * 1.2)) * 0.03;
      #include <project_vertex>
      ${BEND_GLSL}`,
    );
    sh.fragmentShader = 'uniform float uTime;\nuniform vec3 uDeep;\nuniform vec3 uShallow;\nuniform float uRipple;\nuniform float uSpeed;\nuniform float uFoam;\nvarying vec3 vWPos;\n' + WAVES + sh.fragmentShader
      .replace('#include <color_fragment>', `
        vec3 wv = waterWaves(vWPos.xz, uTime * uSpeed);
        diffuseColor.rgb = mix(uDeep, uShallow, clamp(vColor.r + wv.x * 0.06, 0.0, 1.0));
        diffuseColor.rgb += vec3(smoothstep(0.55, 1.0, wv.x) * 0.06);
        float surf = vColor.g * smoothstep(0.35, 0.95, sin(vWPos.z * 0.35 + vWPos.x * 1.7 - uTime * 2.2) * 0.5 + 0.5);
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(1.0), clamp(surf * uFoam, 0.0, 0.85));`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
        {
          vec3 nw = normalize(vec3(-wv.y * 0.16 * uRipple, 1.0, -wv.z * 0.16 * uRipple));
          normal = normalize((viewMatrix * vec4(nw, 0.0)).xyz);
        }`);
  };
  mat.customProgramCacheKey = () => 'water';
  return mat;
}

// ---------- geometry batcher ----------
// Unit shapes used for ground strips, planks and posts. Each is indexed with position + normal.
const SHAPES = new Map();
function shape(key, make) {
  let g = SHAPES.get(key);
  if (!g) {
    g = make();
    g.deleteAttribute('uv');
    SHAPES.set(key, g);
  }
  return g;
}
const unit = {
  box: () => shape('box', () => new THREE.BoxGeometry(1, 1, 1)),
  cyl: (seg, top) => shape(`cyl${seg}:${top}`, () => new THREE.CylinderGeometry(0.5 * top, 0.5, 1, seg)),
  cone: seg => shape('cone' + seg, () => new THREE.ConeGeometry(0.5, 1, seg)),
  sphere: (w, h) => shape(`sph${w}:${h}`, () => new THREE.SphereGeometry(0.5, w, h)),
};

const _m = new THREE.Matrix4(), _p = new THREE.Vector3(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _s = new THREE.Vector3();
const _v = new THREE.Vector3(), _n = new THREE.Vector3(), _nm = new THREE.Matrix3(), _c = new THREE.Color();

// Collects transformed copies of geometries (real models or unit shapes) and merges them into one indexed
// geometry. color multiplies the source vertex colors (or sets them for shapes without colors).
export class Builder {
  constructor({ uv = false } = {}) { this.parts = []; this.uv = uv; }
  get empty() { return this.parts.length === 0; }
  add(geo, matrix, color = null, extra = {}) {
    this.parts.push({ geo, m: matrix.clone(), color: color ? (color.isColor ? color.clone() : new THREE.Color(color)) : null, ...extra });
    return this;
  }
  // pos [x,y,z], rot [rx,ry,rz], scale number or [x,y,z]
  addAt(geo, pos, rot, scale, color, extra) {
    const s = Array.isArray(scale) ? scale : [scale, scale, scale];
    _m.compose(_p.set(pos[0], pos[1], pos[2]), _q.setFromEuler(_e.set(rot ? rot[0] : 0, rot ? rot[1] : 0, rot ? rot[2] : 0)), _s.set(s[0], s[1], s[2]));
    return this.add(geo, _m, color, extra);
  }
  box(color, pos, size, rot) { return this.addAt(unit.box(), pos, rot, size, color); }
  cyl(color, pos, r, h, seg = 8, rot, top = 1) { return this.addAt(unit.cyl(seg, top), pos, rot, [r * 2, h, r * 2], color); }
  cone(color, pos, r, h, seg = 8, rot) { return this.addAt(unit.cone(seg), pos, rot, [r * 2, h, r * 2], color); }
  sphere(color, pos, size, rot) { return this.addAt(unit.sphere(10, 7), pos, rot, size, color); }
  // A flat ground grid. The bend is per-vertex, so big flat pieces need a vertex every few meters to curve
  // with everything else. colorAt(x, z) can vary the color per vertex.
  grid(x0, x1, z0, z1, y, colorAt, cell = 3) {
    const nx = Math.max(1, Math.ceil((x1 - x0) / cell)), nz = Math.max(1, Math.ceil((z1 - z0) / cell));
    const n = (nx + 1) * (nz + 1);
    const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), col = new Float32Array(n * 3), uv = new Float32Array(n * 2);
    const idx = [];
    let k = 0;
    for (let j = 0; j <= nz; j++) for (let i = 0; i <= nx; i++) {
      const x = x0 + ((x1 - x0) * i) / nx, z = z0 + ((z1 - z0) * j) / nz;
      pos.set([x, typeof y === 'function' ? y(x, z) : y, z], k * 3);
      nor.set([0, 1, 0], k * 3);
      const c = colorAt(x, z, _c);
      col.set([c.r, c.g, c.b], k * 3);
      uv.set([x, z], k * 2);
      k++;
    }
    // Triangles face up whichever way the grid runs.
    const flip = (x1 - x0) * (z1 - z0) < 0;
    for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
      const a = j * (nx + 1) + i, b = a + 1, c = a + nx + 1, d = c + 1;
      if (flip) idx.push(a, b, c, b, d, c);
      else idx.push(a, c, b, b, c, d);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    g.setIndex(idx);
    if (typeof y === 'function') g.computeVertexNormals();
    this.parts.push({ geo: g, m: null, color: null, flat: true, own: true });
    return this;
  }
  // Splits parts into two builders, e.g. things near the trail that cast shadows versus far scenery.
  split(test) {
    const a = new Builder({ uv: this.uv }), b = new Builder({ uv: this.uv });
    for (const p of this.parts) (test(p) ? a : b).parts.push(p);
    return [a, b];
  }
  build() {
    let nv = 0, ni = 0;
    for (const p of this.parts) {
      const c = p.geo.attributes.position.count;
      nv += c;
      ni += p.geo.index ? p.geo.index.count : c;
    }
    const pos = new Float32Array(nv * 3), nor = new Float32Array(nv * 3), col = new Uint8Array(nv * 3);
    const uv = this.uv ? new Float32Array(nv * 2) : null;
    const idx = nv > 65535 ? new Uint32Array(ni) : new Uint16Array(ni);
    let vo = 0, io = 0;
    for (const { geo, m, color } of this.parts) {
      const P = geo.attributes.position, N = geo.attributes.normal, C = geo.attributes.color, T = geo.attributes.uv;
      const cnt = P.count;
      if (m) _nm.getNormalMatrix(m);
      const cr = color ? color.r : 1, cg = color ? color.g : 1, cb = color ? color.b : 1;
      for (let i = 0; i < cnt; i++) {
        _v.fromBufferAttribute(P, i);
        _n.fromBufferAttribute(N, i);
        if (m) { _v.applyMatrix4(m); _n.applyMatrix3(_nm).normalize(); }
        const k = (vo + i) * 3;
        pos[k] = _v.x; pos[k + 1] = _v.y; pos[k + 2] = _v.z;
        nor[k] = _n.x; nor[k + 1] = _n.y; nor[k + 2] = _n.z;
        const r = C ? C.getX(i) * cr : cr, g = C ? C.getY(i) * cg : cg, b = C ? C.getZ(i) * cb : cb;
        col[k] = Math.min(255, r * 255 + 0.5); col[k + 1] = Math.min(255, g * 255 + 0.5); col[k + 2] = Math.min(255, b * 255 + 0.5);
        if (uv) { uv[(vo + i) * 2] = T ? T.getX(i) : 0; uv[(vo + i) * 2 + 1] = T ? T.getY(i) : 0; }
      }
      if (geo.index) { const I = geo.index.array; for (let i = 0; i < I.length; i++) idx[io++] = I[i] + vo; }
      else for (let i = 0; i < cnt; i++) idx[io++] = vo + i;
      vo += cnt;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    g.setAttribute('color', new THREE.BufferAttribute(col, 3, true));
    if (uv) g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    g.setIndex(new THREE.BufferAttribute(idx, 1));
    g.computeBoundingSphere();
    return g;
  }
  // Culling uses the unbent bounds, padded so things bent down into view at the horizon still draw. It mostly
  // skips chunks behind the camera and keeps far chunks out of the shadow pass.
  mesh(material = M.solid, { cast = true, receive = true, cull = true } = {}) {
    const mesh = new THREE.Mesh(this.build(), material);
    mesh.frustumCulled = cull;
    if (cull) mesh.geometry.boundingSphere.radius += 6;
    mesh.castShadow = cast;
    mesh.receiveShadow = receive;
    return mesh;
  }
  dispose() { for (const p of this.parts) if (p.own) p.geo.dispose(); }
}

// ---------- noise ----------
export const rng = seed => () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const hash = (x, y) => { let h = Math.imul(x, 374761393) + Math.imul(y, 668265263); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
// Smooth 2D value noise in [0, 1].
export function noise2(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash(xi, yi), b = hash(xi + 1, yi), c = hash(xi, yi + 1), d = hash(xi + 1, yi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
export const fbm = (x, y) => noise2(x, y) * 0.6 + noise2(x * 2.1 + 17, y * 2.1 + 9) * 0.3 + noise2(x * 4.3 + 3, y * 4.3 + 41) * 0.1;

// ---------- canvas textures ----------
let softTex = null;
export function softTexture() {
  if (softTex) return softTex;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const x = c.getContext('2d');
  const g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.35, 'rgba(255,255,255,0.75)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g;
  x.fillRect(0, 0, 64, 64);
  softTex = new THREE.CanvasTexture(c);
  return softTex;
}

export const FONT = '"Lilita One", Fredoka, "Arial Rounded MT Bold", system-ui, sans-serif';

export function roundRect(x, l, t, w, h, r) {
  x.beginPath();
  x.moveTo(l + r, t);
  x.arcTo(l + w, t, l + w, t + h, r);
  x.arcTo(l + w, t + h, l, t + h, r);
  x.arcTo(l, t + h, l, t, r);
  x.arcTo(l, t, l + w, t, r);
  x.closePath();
}

// A wooden or colored sign board with big outlined text.
export function textTexture(text, { w = 512, h = 128, bg = '#ffffff', fg = '#222', border = '#222', size = 76, font = FONT } = {}) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const x = c.getContext('2d');
  const r = h * 0.3;
  x.fillStyle = border;
  roundRect(x, 0, 0, w, h, r); x.fill();
  x.fillStyle = bg;
  roundRect(x, 9, 9, w - 18, h - 18, r - 8); x.fill();
  x.fillStyle = fg;
  x.textAlign = 'center';
  x.textBaseline = 'middle';
  let s = size;
  do { x.font = `${s}px ${font}`; s -= 4; } while (x.measureText(text).width > w - 48 && s > 20);
  x.fillText(text, w / 2, h / 2 + s * 0.06);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}
