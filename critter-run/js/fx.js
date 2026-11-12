// Particles (one instanced cube pool) plus a few one-shot effects: zap beams and shock rings.
import * as THREE from 'three';
import { bend } from './gfx.js';

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _p = new THREE.Vector3(), _s = new THREE.Vector3(), _c = new THREE.Color();

export class FX {
  constructor(scene, max = 1400) {
    this.scene = scene;
    this.max = max;
    this.mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), bend(new THREE.MeshBasicMaterial({ color: '#ffffff' })), max);
    this.mesh.frustumCulled = false;
    for (let i = 0; i < max; i++) this.mesh.setColorAt(i, _c.set('#ffffff'));
    this.mesh.count = 0;
    scene.add(this.mesh);
    this.ps = [];
    this.oneShots = [];
  }

  // g is gravity (negative pulls down). grow makes puffs swell (smoke) instead of shrink.
  spawn({ x, y, z, vx = 0, vy = 0, vz = 0, life = 1, size = 0.2, color = '#ffffff', g = -14, grow = false, floor = false }) {
    if (this.ps.length >= this.max) this.ps.shift();
    this.ps.push({ x, y, z, vx, vy, vz, life, t: 0, size, color: new THREE.Color(color), g, grow, floor, rx: Math.random() * 6, ry: Math.random() * 6, sp: (Math.random() - 0.5) * 12 });
  }

  burst(x, y, z, { n = 20, colors = ['#ffd23f'], speed = 6, up = 4, life = 0.9, size = 0.18, g = -14, floor = true, spread = 1 } = {}) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, s = speed * (0.4 + Math.random() * 0.6);
      this.spawn({
        x: x + (Math.random() - 0.5) * 0.3 * spread, y: y + (Math.random() - 0.5) * 0.3 * spread, z: z + (Math.random() - 0.5) * 0.3 * spread,
        vx: Math.cos(a) * s, vy: up * (0.5 + Math.random()), vz: Math.sin(a) * s,
        life: life * (0.6 + Math.random() * 0.6), size: size * (0.6 + Math.random() * 0.8),
        color: colors[i % colors.length], g, floor,
      });
    }
  }

  confetti(x, y, z, n = 120) {
    const cs = ['#ff3b5c', '#ffd23f', '#3cb44b', '#2f7fe0', '#ff8c1a', '#b06cff', '#ffffff'];
    for (let i = 0; i < n; i++) this.spawn({
      x: x + (Math.random() - 0.5) * 8, y: y + Math.random() * 3, z: z + (Math.random() - 0.5) * 6,
      vx: (Math.random() - 0.5) * 6, vy: 6 + Math.random() * 8, vz: (Math.random() - 0.5) * 6,
      life: 2.5 + Math.random(), size: 0.16 + Math.random() * 0.1, color: cs[i % cs.length], g: -7,
    });
  }

  beam(from, to, color = '#7ff3ff') {
    const dir = new THREE.Vector3().subVectors(to, from);
    const len = dir.length();
    const group = new THREE.Group();
    for (const [r, c, o] of [[0.32, color, 0.45], [0.12, '#ffffff', 1]]) {
      const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 10, 1, true), bend(new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: o, depthWrite: false, side: THREE.DoubleSide })));
      m.frustumCulled = false;
      group.add(m);
    }
    group.position.copy(from).addScaledVector(dir, 0.5);
    group.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
    this.scene.add(group);
    this.oneShots.push({ obj: group, t: 0, life: 0.6, kind: 'beam' });
    for (let i = 0; i < 18; i++) {
      const k = Math.random();
      this.spawn({ x: from.x + (to.x - from.x) * k, y: from.y + (to.y - from.y) * k, z: from.z + (to.z - from.z) * k, vx: (Math.random() - 0.5) * 3, vy: Math.random() * 3, vz: (Math.random() - 0.5) * 3, life: 0.5, size: 0.14, color: i % 2 ? color : '#ffffff', g: 0 });
    }
  }

  ring(x, y, z, color = '#ffffff', max = 6) {
    const m = new THREE.Mesh(new THREE.RingGeometry(0.8, 1, 32).rotateX(-Math.PI / 2), bend(new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, depthWrite: false, side: THREE.DoubleSide })));
    m.position.set(x, y, z);
    m.frustumCulled = false;
    this.scene.add(m);
    this.oneShots.push({ obj: m, t: 0, life: 0.55, kind: 'ring', max });
  }

  update(dt) {
    let n = 0;
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
      this.mesh.setMatrixAt(n, _m);
      this.mesh.setColorAt(n, p.color);
      n++;
    }
    this.mesh.count = n;
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;

    for (let i = this.oneShots.length - 1; i >= 0; i--) {
      const o = this.oneShots[i];
      o.t += dt;
      const k = o.t / o.life;
      if (k >= 1) {
        this.scene.remove(o.obj);
        o.obj.traverse(c => { if (c.isMesh) { c.geometry.dispose(); c.material.dispose(); } });
        this.oneShots.splice(i, 1);
        continue;
      }
      if (o.kind === 'beam') {
        o.obj.scale.set(1 - k, 1, 1 - k);
      } else if (o.kind === 'ring') {
        o.obj.scale.setScalar(1 + k * o.max);
        o.obj.material.opacity = 0.9 * (1 - k);
      }
    }
  }

  clear() {
    this.ps.length = 0;
    this.mesh.count = 0;
    for (const o of this.oneShots) this.scene.remove(o.obj);
    this.oneShots.length = 0;
  }
}
