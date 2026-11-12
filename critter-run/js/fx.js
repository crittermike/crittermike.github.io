// Particles and one-shot effects. Lit rock-and-wood chips for debris, paper squares for confetti, soft glowing
// points for sparks, glows, dust and smoke, plus beams, shock rings and a generic timed-effect hook the weapons use.
import * as THREE from 'three';
import { bend, softTexture, U } from './gfx.js';

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _p = new THREE.Vector3(), _s = new THREE.Vector3();

// Glowing see-through material for beams and shock rings.
export const additiveMat = (color = '#ffffff', k = 1.6, opacity = 0.9) => bend(new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(k), transparent: true, opacity, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending }));

// Soft round points that follow the same world bend as everything else.
const pointShader = blending => new THREE.ShaderMaterial({
  uniforms: { map: { value: softTexture() }, uBend: U.uBend, uScale: { value: 400 } },
  vertexShader: `attribute float size;
attribute vec4 col;
uniform float uBend;
uniform float uScale;
varying vec4 vCol;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vec3 upV = viewMatrix[1].xyz;
  float hgt = dot(upV, mv.xyz);
  mv.xyz -= upV * (max(dot(mv.xyz, mv.xyz) - hgt * hgt, 0.0) * uBend);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = size * uScale / max(-mv.z, 0.1);
  vCol = col;
}`,
  fragmentShader: `uniform sampler2D map;
varying vec4 vCol;
void main() {
  float a = texture2D(map, gl_PointCoord).a * vCol.a;
  if (a < 0.003) discard;
  gl_FragColor = vec4(vCol.rgb, a);
}`,
  transparent: true, depthWrite: false, blending,
});

class PointPool {
  constructor(scene, max, blending) {
    this.max = max;
    this.ps = [];
    const g = new THREE.BufferGeometry();
    this.pos = new Float32Array(max * 3);
    this.col = new Float32Array(max * 4);
    this.size = new Float32Array(max);
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('col', new THREE.BufferAttribute(this.col, 4).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('size', new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage));
    g.setDrawRange(0, 0);
    this.geo = g;
    this.mat = pointShader(blending);
    this.points = new THREE.Points(g, this.mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = 5;
    scene.add(this.points);
  }
  spawn(o) {
    if (this.ps.length >= this.max) this.ps.shift();
    const c = new THREE.Color(o.color || '#ffffff').multiplyScalar(o.glow || 1);
    this.ps.push({ x: o.x, y: o.y, z: o.z, vx: o.vx || 0, vy: o.vy || 0, vz: o.vz || 0, life: o.life || 1, t: 0, size: o.size || 0.5, c, a: o.alpha ?? 1, g: o.g || 0, grow: o.grow || 0, drag: o.drag || 0 });
  }
  update(dt) {
    const ps = this.ps;
    let n = 0;
    for (let i = ps.length - 1; i >= 0; i--) {
      const p = ps[i];
      p.t += dt;
      if (p.t >= p.life) { ps[i] = ps[ps.length - 1]; ps.pop(); continue; }
      if (p.drag) { const k = Math.exp(-p.drag * dt); p.vx *= k; p.vy *= k; p.vz *= k; }
      p.vy += p.g * dt;
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      const k = p.t / p.life;
      this.pos[n * 3] = p.x; this.pos[n * 3 + 1] = p.y; this.pos[n * 3 + 2] = p.z;
      this.size[n] = p.size * (p.grow ? 1 + k * p.grow : 1 - k * 0.6);
      // fade in quickly, fade out smoothly
      const a = p.a * Math.min(1, p.t * 12) * (1 - k * k);
      this.col[n * 4] = p.c.r; this.col[n * 4 + 1] = p.c.g; this.col[n * 4 + 2] = p.c.b; this.col[n * 4 + 3] = a;
      n++;
    }
    this.geo.setDrawRange(0, n);
    for (const k of ['position', 'col', 'size']) this.geo.attributes[k].needsUpdate = true;
  }
  clear() { this.ps.length = 0; this.geo.setDrawRange(0, 0); }
}

export class FX {
  constructor(scene, max = 1400) {
    this.scene = scene;
    this.max = max;
    // Debris: small irregular chips that catch the light. Confetti: thin paper squares that glow a little.
    const chip = new THREE.IcosahedronGeometry(0.55, 0).scale(1, 0.7, 0.85);
    this.mesh = new THREE.InstancedMesh(chip, bend(new THREE.MeshStandardMaterial({ roughness: 0.75, metalness: 0.05, flatShading: true })), max);
    this.paper = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 0.06, 0.7), bend(new THREE.MeshBasicMaterial({ color: '#ffffff' })), max);
    for (const m of [this.mesh, this.paper]) {
      m.frustumCulled = false;
      m.setColorAt(0, new THREE.Color('#ffffff'));
      m.count = 0;
      m.castShadow = m === this.mesh;
      scene.add(m);
    }
    this.sparks = new PointPool(scene, 1600, THREE.AdditiveBlending);
    this.puffs = new PointPool(scene, 700, THREE.NormalBlending);
    this.ps = [];
    this.oneShots = [];
  }

  // Pixel scale for soft points: viewport height in device pixels over 2*tan(fov/2).
  setViewport(heightPx, fovDeg) {
    const s = heightPx / (2 * Math.tan(THREE.MathUtils.degToRad(fovDeg) / 2));
    this.sparks.mat.uniforms.uScale.value = s;
    this.puffs.mat.uniforms.uScale.value = s;
  }

  // Chunky cube particle. g is gravity (negative pulls down). grow makes puffs swell instead of shrink.
  spawn({ x, y, z, vx = 0, vy = 0, vz = 0, life = 1, size = 0.2, color = '#ffffff', g = -14, grow = false, floor = false, glow = 1, paper = false }) {
    if (this.ps.length >= this.max) this.ps.shift();
    this.ps.push({ x, y, z, vx, vy, vz, life, t: 0, size, color: new THREE.Color(color).multiplyScalar(glow), g, grow, floor, paper, rx: Math.random() * 6, ry: Math.random() * 6, sp: (Math.random() - 0.5) * 12 });
  }
  // Soft additive glow (sparks, magic, fire). Use glow > 1 to feed the bloom.
  spark(o) { this.sparks.spawn(o); }
  // Soft alpha puff (dust, smoke, mist, splash).
  puff(o) { this.puffs.spawn(o); }

  burst(x, y, z, { n = 20, colors = ['#ffd23f'], speed = 6, up = 4, life = 0.9, size = 0.18, g = -14, floor = true, spread = 1, glow = 1, sparks = 0 } = {}) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, s = speed * (0.4 + Math.random() * 0.6);
      this.spawn({
        x: x + (Math.random() - 0.5) * 0.3 * spread, y: y + (Math.random() - 0.5) * 0.3 * spread, z: z + (Math.random() - 0.5) * 0.3 * spread,
        vx: Math.cos(a) * s, vy: up * (0.5 + Math.random()), vz: Math.sin(a) * s,
        life: life * (0.6 + Math.random() * 0.6), size: size * (0.6 + Math.random() * 0.8),
        color: colors[i % colors.length], g, floor, glow,
      });
    }
    for (let i = 0; i < sparks; i++) {
      const d = new THREE.Vector3().randomDirection().multiplyScalar(speed * (0.5 + Math.random()));
      this.spark({ x, y, z, vx: d.x, vy: d.y + up * 0.3, vz: d.z, life: life * (0.5 + Math.random() * 0.5), size: size * 4, color: colors[i % colors.length], glow: 2, g: g * 0.3, drag: 2 });
    }
  }

  // A soft flash of light at a point (impacts, pickups).
  glowAt(x, y, z, color = '#ffffff', size = 3, life = 0.35) {
    this.spark({ x, y, z, life, size, color, glow: 2.2, grow: 1.2 });
  }

  confetti(x, y, z, n = 120) {
    const cs = ['#ff3b5c', '#ffd23f', '#3cb44b', '#2f7fe0', '#ff8c1a', '#b06cff', '#ffffff'];
    for (let i = 0; i < n; i++) this.spawn({
      x: x + (Math.random() - 0.5) * 8, y: y + Math.random() * 3, z: z + (Math.random() - 0.5) * 6,
      vx: (Math.random() - 0.5) * 6, vy: 6 + Math.random() * 8, vz: (Math.random() - 0.5) * 6,
      life: 2.5 + Math.random(), size: 0.16 + Math.random() * 0.1, color: cs[i % cs.length], g: -7, paper: true,
    });
  }

  // A glowing beam between two points. colors lists the outer-to-inner layers.
  beam(from, to, color = '#7ff3ff', { width = 1, life = 0.6, colors = null } = {}) {
    const dir = new THREE.Vector3().subVectors(to, from);
    const len = dir.length();
    const group = new THREE.Group();
    const layers = colors
      ? colors.map((c, i) => [0.16 * width * (colors.length - i) / colors.length + 0.05, c, 0.9])
      : [[0.34 * width, color, 0.5], [0.12 * width, '#ffffff', 1]];
    for (const [r, c, o] of layers) {
      const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 12, 1, true), additiveMat(c, 1.8, o));
      m.frustumCulled = false;
      group.add(m);
    }
    group.position.copy(from).addScaledVector(dir, 0.5);
    group.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
    this.scene.add(group);
    this.oneShots.push({ obj: group, t: 0, life, kind: 'beam' });
    const cs = colors || [color, '#ffffff'];
    for (let i = 0; i < 26; i++) {
      const k = Math.random();
      this.spark({ x: from.x + (to.x - from.x) * k, y: from.y + (to.y - from.y) * k, z: from.z + (to.z - from.z) * k, vx: (Math.random() - 0.5) * 3, vy: Math.random() * 3, vz: (Math.random() - 0.5) * 3, life: 0.6, size: 0.45, color: cs[i % cs.length], glow: 1.6, drag: 3 });
    }
    this.glowAt(from.x, from.y, from.z, cs[0], 0.9, 0.25);
  }

  ring(x, y, z, color = '#ffffff', max = 6, life = 0.55) {
    const m = new THREE.Mesh(new THREE.RingGeometry(0.8, 1, 48).rotateX(-Math.PI / 2), additiveMat(color, 1.6, 0.9));
    m.position.set(x, y, z);
    m.frustumCulled = false;
    this.scene.add(m);
    this.oneShots.push({ obj: m, t: 0, life, kind: 'ring', max });
  }

  // Generic timed effect: tick(k, dt, t) runs every frame with k going 0..1; done() runs at the end.
  // obj (optional) is added to the scene and disposed afterward.
  timed({ obj = null, life = 1, tick = null, done = null }) {
    if (obj) this.scene.add(obj);
    const o = { obj, t: 0, life, kind: 'timed', tick, done };
    this.oneShots.push(o);
    return o;
  }

  update(dt) {
    let n = 0, np = 0;
    const ps = this.ps;
    for (let i = ps.length - 1; i >= 0; i--) {
      const p = ps[i];
      p.t += dt;
      if (p.t >= p.life) { ps[i] = ps[ps.length - 1]; ps.pop(); continue; }
      p.vy += p.g * dt;
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      if (p.floor && p.y < 0.05) { p.y = 0.05; p.vy *= -0.4; p.vx *= 0.7; p.vz *= 0.7; }
      p.rx += p.sp * dt; p.ry += p.sp * dt * 0.7;
      const k = p.t / p.life;
      const s = p.grow ? p.size * (1 + k * 2.2) * (1 - k * k) : p.size * (1 - k * k);
      _m.compose(_p.set(p.x, p.y, p.z), _q.setFromEuler(_e.set(p.rx, p.ry, 0)), _s.set(s, s, s));
      if (p.paper) { this.paper.setMatrixAt(np, _m); this.paper.setColorAt(np, p.color); np++; }
      else { this.mesh.setMatrixAt(n, _m); this.mesh.setColorAt(n, p.color); n++; }
    }
    for (const [m, c] of [[this.mesh, n], [this.paper, np]]) {
      m.count = c;
      m.instanceMatrix.needsUpdate = true;
      if (m.instanceColor) m.instanceColor.needsUpdate = true;
    }
    this.sparks.update(dt);
    this.puffs.update(dt);

    for (let i = this.oneShots.length - 1; i >= 0; i--) {
      const o = this.oneShots[i];
      o.t += dt;
      const k = Math.min(1, o.t / o.life);
      if (o.kind === 'beam') {
        o.obj.scale.set(1 - k, 1, 1 - k);
      } else if (o.kind === 'ring') {
        o.obj.scale.setScalar(1 + k * o.max);
        o.obj.material.opacity = 0.9 * (1 - k);
      } else if (o.tick) {
        o.tick(k, dt, o.t);
      }
      if (o.t >= o.life) {
        this.oneShots.splice(i, 1);
        if (o.done) o.done();
        this.dispose(o.obj);
      }
    }
  }

  dispose(obj) {
    if (!obj) return;
    this.scene.remove(obj);
    obj.traverse(c => {
      if (!c.isMesh || c.userData.keep) return;
      c.geometry.dispose();
      (Array.isArray(c.material) ? c.material : [c.material]).forEach(m => m.dispose());
    });
  }

  clear() {
    this.ps.length = 0;
    this.mesh.count = 0;
    this.paper.count = 0;
    this.sparks.clear();
    this.puffs.clear();
    for (const o of this.oneShots) this.dispose(o.obj);
    this.oneShots.length = 0;
  }
}
