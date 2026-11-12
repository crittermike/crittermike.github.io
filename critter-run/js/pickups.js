// Things on the trail you can grab or run through: coins, hearts, power-up bubbles, question gates, region
// arches and the finish line. All smooth, beveled and glossy, like collectibles in a console platformer.
import * as THREE from 'three';
import { SVGLoader, RoundedBoxGeometry, mergeGeometries, mergeVertices } from 'three/addons';
import { bend, textTexture } from './gfx.js';
import { iconPath } from './icons.js';

const TAU = Math.PI * 2;

// Extrusions come out with hard per-face normals; welding and re-averaging them gives soft, rounded bevels.
function smooth(geo) {
  geo.deleteAttribute('normal');
  geo.deleteAttribute('uv');
  const g = mergeVertices(geo, 1e-4);
  g.computeVertexNormals();
  return g;
}

// ---------- extruded icons ----------
const svg = new SVGLoader();
const iconGeos = new Map();
// A game icon as a chunky 3D badge, centered, about `size` meters across, facing +z.
export function iconGeometry(name, size = 1, depth = 0.18) {
  const key = name + size + depth;
  if (iconGeos.has(key)) return iconGeos.get(key);
  const ip = iconPath(name);
  if (!ip) return null;
  const data = svg.parse(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${ip.size} ${ip.size}"><path d="${ip.d}"/></svg>`);
  // Rebuild each outline from its points without repeats: zero-length edges make the bevel math blow up.
  const tidy = pts => pts.filter((p, i) => p.distanceTo(pts[(i + pts.length - 1) % pts.length]) > 0.2);
  const shapes = data.paths.flatMap(p => p.toShapes(true)).map(sh => {
    const { shape, holes } = sh.extractPoints(5);
    const out = new THREE.Shape(tidy(shape));
    out.holes = holes.map(tidy).filter(h => h.length > 2).map(h => new THREE.Path(h));
    return out;
  }).filter(sh => sh.getPoints().length > 2);
  const k = size / ip.size;
  let geo = new THREE.ExtrudeGeometry(shapes, { depth: depth / k, bevelEnabled: true, bevelThickness: depth * 0.35 / k, bevelSize: depth * 0.22 / k, bevelSegments: 2, curveSegments: 5 });
  geo.scale(k, k, k);
  geo.rotateX(Math.PI); // SVG y points down; a turn (not a mirror) keeps the faces pointing outward
  geo = smooth(geo);
  geo.computeBoundingBox();
  const c = geo.boundingBox.getCenter(new THREE.Vector3());
  geo.translate(-c.x, -c.y, -c.z);
  iconGeos.set(key, geo);
  return geo;
}

// ---------- coins ----------
// A lathe-turned coin with a raised rim, plus a star embossed on both faces.
export const coinGeo = (() => {
  const r = 0.36, t = 0.06;
  const prof = [[0, -t * 0.7], [r * 0.78, -t * 0.7], [r * 0.84, -t], [r, -t * 0.85], [r, t * 0.85], [r * 0.84, t], [r * 0.78, t * 0.7], [0, t * 0.7]].map(([x, y]) => new THREE.Vector2(x, y));
  const lathe = new THREE.LatheGeometry(prof, 28).rotateX(Math.PI / 2);
  const star = new THREE.Shape();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i / 10) * TAU, rad = i % 2 ? 0.085 : 0.2;
    star[i ? 'lineTo' : 'moveTo'](Math.cos(a) * rad, -Math.sin(a) * rad);
  }
  const front = smooth(new THREE.ExtrudeGeometry(star, { depth: 0.012, bevelEnabled: true, bevelThickness: 0.012, bevelSize: 0.012, bevelSegments: 1 })).translate(0, 0, t * 0.7);
  const back = front.clone().rotateY(Math.PI);
  lathe.deleteAttribute('uv');
  return mergeGeometries([lathe, front, back].map(g => (g.index ? g.toNonIndexed() : g)));
})();
export const coinMat = bend(new THREE.MeshStandardMaterial({ color: '#ffc531', metalness: 1, roughness: 0.22, emissive: '#5a3400', emissiveIntensity: 0.6, envMapIntensity: 1.6 }), { rim: 0.5 });

// ---------- hearts ----------
const heartShape = (() => {
  const s = new THREE.Shape();
  s.moveTo(0, -0.42);
  s.bezierCurveTo(-0.08, -0.32, -0.46, -0.06, -0.46, 0.14);
  s.bezierCurveTo(-0.46, 0.34, -0.3, 0.44, -0.18, 0.44);
  s.bezierCurveTo(-0.06, 0.44, 0, 0.36, 0, 0.3);
  s.bezierCurveTo(0, 0.36, 0.06, 0.44, 0.18, 0.44);
  s.bezierCurveTo(0.3, 0.44, 0.46, 0.34, 0.46, 0.14);
  s.bezierCurveTo(0.46, -0.06, 0.08, -0.32, 0, -0.42);
  return s;
})();
const heartGeo = smooth(new THREE.ExtrudeGeometry(heartShape, { depth: 0.16, bevelEnabled: true, bevelThickness: 0.1, bevelSize: 0.08, bevelSegments: 5, curveSegments: 16 }).translate(0, 0, -0.08));
const heartMat = bend(new THREE.MeshStandardMaterial({ color: '#ff2a4f', roughness: 0.18, metalness: 0.05, emissive: '#7a0016', emissiveIntensity: 0.55 }), { rim: 0.8 });
export function heartMesh() {
  const g = new THREE.Group();
  const m = new THREE.Mesh(heartGeo, heartMat);
  m.scale.setScalar(1.15);
  m.castShadow = true;
  m.frustumCulled = false;
  g.add(m, glowSprite('#ff3355', 2.2));
  return g;
}

// A soft glow card that always faces the camera.
let glowTex = null;
function glowSprite(color, size) {
  if (!glowTex) {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const x = c.getContext('2d'), gr = x.createRadialGradient(64, 64, 0, 64, 64, 64);
    gr.addColorStop(0, 'rgba(255,255,255,0.9)'); gr.addColorStop(0.3, 'rgba(255,255,255,0.35)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = gr; x.fillRect(0, 0, 128, 128);
    glowTex = new THREE.CanvasTexture(c);
  }
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: new THREE.Color(color).multiplyScalar(1.6), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  s.scale.setScalar(size);
  s.renderOrder = 4;
  return s;
}

// ---------- power-up bubbles ----------
// A glassy bubble in the power's color with its icon floating inside as a chunky 3D badge.
const bubbleGeo = new THREE.SphereGeometry(0.78, 32, 20);
const bubbleMats = new Map(), badgeMats = new Map();
function bubbleMat(color) {
  if (!bubbleMats.has(color)) {
    bubbleMats.set(color, new THREE.ShaderMaterial({
      uniforms: { uCol: { value: new THREE.Color(color) } },
      vertexShader: 'varying vec3 vN; varying vec3 vV; void main(){ vec4 mv = modelViewMatrix * vec4(position,1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }',
      fragmentShader: `uniform vec3 uCol; varying vec3 vN; varying vec3 vV;
        void main() {
          float f = 1.0 - abs(dot(vN, vV));
          float rim = pow(f, 2.2);
          // A bright window highlight in the upper left, like light on glass.
          float hl = smoothstep(0.82, 0.98, dot(vN, normalize(vec3(-0.45, 0.6, 0.65))));
          vec3 c = uCol * (0.25 + rim * 1.6) + vec3(1.0) * hl * 1.4;
          gl_FragColor = vec4(c, 0.18 + rim * 0.65 + hl * 0.6);
          #include <colorspace_fragment>
        }`,
      transparent: true, depthWrite: false,
    }));
  }
  return bubbleMats.get(color);
}
function badgeMat(color) {
  if (!badgeMats.has(color)) badgeMats.set(color, bend(new THREE.MeshStandardMaterial({ color: new THREE.Color(color).lerp(new THREE.Color('#ffffff'), 0.25), roughness: 0.25, metalness: 0.1, emissive: color, emissiveIntensity: 0.55 }), { rim: 0.6 }));
  return badgeMats.get(color);
}
export function powerOrb(power) {
  const g = new THREE.Group();
  const bubble = new THREE.Mesh(bubbleGeo, bubbleMat(power.color));
  bubble.renderOrder = 5;
  const badge = new THREE.Mesh(iconGeometry(power.icon, 0.95, 0.16) || new THREE.SphereGeometry(0.3), badgeMat(power.color));
  badge.castShadow = true;
  g.add(badge, bubble, glowSprite(power.color, 2.6));
  for (const o of g.children) o.frustumCulled = false;
  g.userData.badge = badge;
  return g;
}

// ---------- gates and arches ----------
// Rounded posts and a beam, glossy paint in the stage color with white trim.
const paintMats = new Map();
function paint(color) {
  if (!paintMats.has(color)) paintMats.set(color, bend(new THREE.MeshStandardMaterial({ color, roughness: 0.32, metalness: 0.05 }), { rim: 0.35 }));
  return paintMats.get(color);
}
const trimMat = bend(new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.35 }), { rim: 0.3 });
const postGeo = new RoundedBoxGeometry(0.75, 5.0, 0.75, 4, 0.16).translate(0, 2.5, 0);
const capGeo = new RoundedBoxGeometry(1.05, 0.32, 1.05, 3, 0.1);
const footGeo = new RoundedBoxGeometry(1.15, 0.36, 1.15, 3, 0.1).translate(0, 0.18, 0);
const beamGeo = new RoundedBoxGeometry(9.6, 0.7, 0.7, 4, 0.18);
function archFrame(color) {
  const g = new THREE.Group();
  const add = (geo, mat, x, y) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, 0); m.castShadow = m.receiveShadow = true; m.frustumCulled = false; g.add(m); return m; };
  for (const s of [-1, 1]) {
    add(postGeo, paint(color), s * 4.3, 0);
    add(capGeo, trimMat, s * 4.3, 5.05);
    add(footGeo, trimMat, s * 4.3, 0);
  }
  add(beamGeo, paint(color), 0, 5.45);
  return g;
}

// The swirling portal that fills a question gate.
const portalMat = color => new THREE.ShaderMaterial({
  uniforms: { uCol: { value: new THREE.Color(color) }, uTime: { value: 0 } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
  fragmentShader: `uniform vec3 uCol; uniform float uTime; varying vec2 vUv;
    void main() {
      vec2 p = (vUv - 0.5) * vec2(1.75, 1.0);
      float r = length(p), a = atan(p.y, p.x);
      float swirl = sin(a * 5.0 + r * 14.0 - uTime * 3.0) * 0.5 + 0.5;
      float edge = smoothstep(0.5, 0.18, abs(vUv.x - 0.5)) * smoothstep(0.5, 0.15, abs(vUv.y - 0.5));
      vec3 c = mix(uCol, vec3(1.0), swirl * 0.35) * (1.2 + swirl * 0.6);
      gl_FragColor = vec4(c, (0.1 + swirl * 0.18) * edge);
      #include <colorspace_fragment>
    }`,
  transparent: true, depthWrite: false, side: THREE.DoubleSide,
});
const qMat = bend(new THREE.MeshStandardMaterial({ color: '#ffd23f', roughness: 0.18, metalness: 0.35, emissive: '#ff9d00', emissiveIntensity: 0.9 }), { rim: 0.6 });
export function gateMesh(color) {
  const g = archFrame(color);
  const portal = new THREE.Mesh(new THREE.PlaneGeometry(8, 5.1), portalMat(color));
  portal.material.userData.own = true; // one per gate, freed with its chunk
  portal.position.set(0, 2.6, 0);
  portal.renderOrder = 3;
  portal.frustumCulled = false;
  const q = new THREE.Mesh(iconGeometry('question-mark', 2.0, 0.4), qMat);
  q.position.set(0, 2.7, 0);
  q.castShadow = true;
  q.frustumCulled = false;
  g.add(portal, q, glowSprite('#ffd23f', 4.5));
  g.children[g.children.length - 1].position.set(0, 2.7, 0.2);
  g.userData.crystal = q;
  g.userData.portal = portal;
  return g;
}

// A region sign: the arch with a cloth banner showing the name.
export function signArch(color, label) {
  const g = archFrame(color);
  const tex = textTexture(label, { w: 1024, h: 192, bg: '#fffaf0', fg: '#22263f', border: color, size: 120 });
  const banner = new THREE.Mesh(new THREE.PlaneGeometry(7.2, 1.35, 12, 2), bend(new THREE.MeshStandardMaterial({ map: tex, roughness: 0.8, side: THREE.DoubleSide }), { wave: true }));
  banner.position.set(0, 4.45, 0.05);
  banner.castShadow = true;
  banner.frustumCulled = false;
  g.add(banner);
  g.userData.tex = tex;
  return g;
}

// The finish line: a gold arch with a checkered banner and a checkered strip across the trail.
let checkTex = null;
function checker() {
  if (checkTex) return checkTex;
  const c = document.createElement('canvas');
  c.width = 512; c.height = 64;
  const x = c.getContext('2d');
  for (let i = 0; i < 32; i++) for (let j = 0; j < 4; j++) { x.fillStyle = (i + j) % 2 ? '#15151a' : '#ffffff'; x.fillRect(i * 16, j * 16, 16, 16); }
  checkTex = new THREE.CanvasTexture(c);
  checkTex.colorSpace = THREE.SRGBColorSpace;
  return checkTex;
}
export function finishArch() {
  const g = archFrame('#ffbf1f');
  const mat = bend(new THREE.MeshStandardMaterial({ map: checker(), roughness: 0.6, side: THREE.DoubleSide }), { wave: true });
  const banner = new THREE.Mesh(new THREE.PlaneGeometry(8.4, 1.1, 12, 2), mat);
  banner.position.set(0, 4.5, 0.05);
  const strip = new THREE.Mesh(new THREE.PlaneGeometry(7.6, 0.9).rotateX(-Math.PI / 2), bend(new THREE.MeshStandardMaterial({ map: checker(), roughness: 0.7 })));
  strip.position.set(0, 0.03, 0);
  strip.receiveShadow = true;
  for (const m of [banner, strip]) { m.frustumCulled = false; g.add(m); }
  return g;
}
