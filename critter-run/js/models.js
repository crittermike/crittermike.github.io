// Voxel characters: the hero kid and the chasers. Everything faces -z (the running direction).
import * as THREE from 'three';
import { mesh as gmesh, M, bend } from './gfx.js';

// Character parts use the rim-lit material and cast real shadows.
const mesh = (fn, mat = M.actor) => gmesh(fn, mat, { cast: true, receive: false });

const TAU = Math.PI * 2;
const lerp = (a, b, t) => a + (b - a) * t;

function pivot(parent, x, y, z, fn, mat) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  if (fn) g.add(mesh(fn, mat));
  parent.add(g);
  return g;
}

export function blobShadow(r = 0.55) {
  const m = new THREE.Mesh(
    new THREE.CircleGeometry(r, 20).rotateX(-Math.PI / 2),
    bend(new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.16, depthWrite: false })),
  );
  m.position.y = 0.04;
  m.renderOrder = 1;
  m.frustumCulled = false;
  return m;
}

// ---------- hero ----------
export function makeHero() {
  const C = { skin: '#f5c9a0', shirt: '#ff5a36', pants: '#2f5fd0', shoe: '#30251f', sole: '#f2f2f2', hair: '#6b3e1f', cap: '#18a0e8', pack: '#3db24a', packDark: '#26853a' };
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  const shadow = blobShadow(0.5);
  root.add(shadow);
  const leg = x => pivot(body, x, 0.74, 0, b => {
    b.box(C.pants, [0, -0.27, 0], [0.26, 0.56, 0.3]);
    b.box(C.shoe, [0, -0.62, -0.05], [0.3, 0.18, 0.42]);
    b.box(C.sole, [0, -0.705, -0.05], [0.31, 0.05, 0.43]);
  });
  const legL = leg(-0.16), legR = leg(0.16);
  body.add(mesh(b => {
    b.box(C.shirt, [0, 1.06, 0], [0.64, 0.62, 0.38]);
    b.box('#ffd23f', [0, 1.14, -0.195], [0.22, 0.22, 0.02], [0, 0, Math.PI / 4]);
    b.box(C.pants, [0, 0.78, 0], [0.66, 0.1, 0.4]);
    b.box(C.pack, [0, 1.08, 0.3], [0.52, 0.56, 0.24]);
    b.box(C.packDark, [0, 0.95, 0.43], [0.38, 0.22, 0.05]);
    b.box(C.packDark, [0, 1.36, 0.3], [0.3, 0.08, 0.2]);
    b.box(C.packDark, [-0.2, 1.12, -0.2], [0.07, 0.6, 0.03]);
    b.box(C.packDark, [0.2, 1.12, -0.2], [0.07, 0.6, 0.03]);
  }));
  const arm = x => pivot(body, x, 1.32, 0, b => {
    b.box(C.shirt, [0, -0.1, 0], [0.2, 0.24, 0.24]);
    b.box(C.skin, [0, -0.38, 0], [0.17, 0.34, 0.19]);
  });
  const armL = arm(-0.42), armR = arm(0.42);
  const head = pivot(body, 0, 1.38, 0, b => {
    b.box(C.skin, [0, 0.3, 0], [0.56, 0.54, 0.5]);
    b.box(C.hair, [0, 0.52, 0.03], [0.6, 0.14, 0.54]);
    b.box(C.hair, [0, 0.36, 0.24], [0.6, 0.38, 0.08]);
    b.box(C.hair, [-0.29, 0.42, 0.06], [0.04, 0.2, 0.38]);
    b.box(C.hair, [0.29, 0.42, 0.06], [0.04, 0.2, 0.38]);
    b.box(C.cap, [0, 0.64, 0.02], [0.62, 0.14, 0.56]);
    b.box(C.cap, [0, 0.585, -0.37], [0.5, 0.05, 0.28]);
    b.box('#ffffff', [0, 0.65, -0.265], [0.16, 0.09, 0.02]);
    b.box('#1d1d1d', [-0.12, 0.31, -0.255], [0.08, 0.13, 0.02]);
    b.box('#1d1d1d', [0.12, 0.31, -0.255], [0.08, 0.13, 0.02]);
    b.box('#ffffff', [-0.1, 0.35, -0.262], [0.03, 0.04, 0.01]);
    b.box('#ffffff', [0.14, 0.35, -0.262], [0.03, 0.04, 0.01]);
    b.box('#f08a8a', [-0.2, 0.2, -0.254], [0.08, 0.05, 0.02]);
    b.box('#f08a8a', [0.2, 0.2, -0.254], [0.08, 0.05, 0.02]);
    b.box('#8a2b2b', [0, 0.16, -0.255], [0.16, 0.05, 0.02]);
  });

  let phase = 0, stumbleT = 0, turn = 0;
  return {
    root, body, head, shadow, id: 'voxel',
    stumble() { stumbleT = 0.5; },
    setWeapon() {}, showWeapon() {}, aimAt() {},
    muzzle(out = new THREE.Vector3()) { return body.localToWorld(out.set(0, 1.25, 0.3)); },
    // mode: run | jump | slide | idle | cheer | zap | fall
    animate(mode, dt, { speed = 10, jumpY = 0, t = 0 } = {}) {
      const k = Math.min(1, dt * 14);
      let lL = 0, lR = 0, aL = 0, aR = 0, aLz = 0, aRz = 0, lean = 0, bob = 0, hx = 0, turnTo = 0;
      if (mode === 'run') {
        phase += dt * TAU * 1.45 * Math.max(0.6, speed / 10);
        const s = Math.sin(phase);
        lL = s * 0.95; lR = -s * 0.95; aL = -s * 1.0; aR = s * 1.0;
        lean = -0.16; bob = Math.abs(Math.cos(phase)) * 0.09;
      } else if (mode === 'jump') {
        lL = 1.0; lR = -0.55; aLz = -2.3; aRz = 2.3; lean = -0.05;
      } else if (mode === 'cheer') {
        bob = Math.abs(Math.sin(t * 7)) * 0.35;
        aLz = -2.7 + Math.sin(t * 14) * 0.25; aRz = 2.7 - Math.sin(t * 14) * 0.25;
      } else if (mode === 'zap') {
        turnTo = Math.PI; aR = -1.7; aL = 0.3; lL = 0.4; lR = -0.4; hx = 0.1;
      } else if (mode === 'slide') {
        lean = 1.05; lL = 0.55; lR = 0.4; aLz = -1.3; aRz = 1.3;
      } else if (mode === 'fall') {
        lean = 1.3; aLz = -2.8; aRz = 2.8; lL = -0.4; lR = 0.3;
      } else {
        bob = Math.sin(t * 2.4) * 0.02;
        aLz = -0.08; aRz = 0.08;
      }
      if (stumbleT > 0) {
        stumbleT -= dt;
        const w = Math.sin(stumbleT * 40) * stumbleT * 2;
        body.rotation.z = w * 0.6; aLz = -2.2; aRz = 2.2; lean = 0.3;
      } else body.rotation.z = lerp(body.rotation.z, 0, k);
      legL.rotation.x = lerp(legL.rotation.x, lL, k);
      legR.rotation.x = lerp(legR.rotation.x, lR, k);
      armL.rotation.x = lerp(armL.rotation.x, aL, k);
      armR.rotation.x = lerp(armR.rotation.x, aR, k);
      armL.rotation.z = lerp(armL.rotation.z, aLz, k);
      armR.rotation.z = lerp(armR.rotation.z, aRz, k);
      body.rotation.x = lerp(body.rotation.x, lean, k);
      head.rotation.x = lerp(head.rotation.x, hx, k);
      turn = lerp(turn, turnTo, Math.min(1, dt * 12));
      body.rotation.y = turn;
      body.position.y = jumpY + bob;
      const s = Math.max(0.35, 1 - jumpY * 0.3);
      shadow.scale.set(s, 1, s);
      shadow.material.opacity = 0.22 * s;
    },
  };
}

// ---------- chasers ----------
function face(b, { w, y, z, eye = '#ffd23f', brow = '#1a1a1a', size = 0.13, gap = 0.17 }) {
  for (const sx of [-1, 1]) {
    b.box('#ffffff', [sx * gap, y, z], [size * 1.25, size, 0.03]);
    b.box(eye, [sx * gap, y, z - 0.012], [size * 0.75, size * 0.75, 0.03]);
    b.box('#111111', [sx * gap + sx * 0.01, y - 0.005, z - 0.024], [size * 0.32, size * 0.55, 0.02]);
    b.box(brow, [sx * gap, y + size * 0.85, z - 0.01], [size * 1.7, size * 0.35, 0.06], [0, 0, sx * 0.45]);
  }
}
function teeth(b, { w, y, z0, z1, dir = -1, size = 0.07, color = '#fffaf0' }) {
  const n = Math.max(2, Math.round((z1 - z0) / (size * 1.6)));
  for (let i = 0; i <= n; i++) {
    const z = z0 + (z1 - z0) * (i / n);
    b.cone(color, [-w / 2, y + dir * size * 0.5, z], size * 0.5, size, 4, [dir > 0 ? 0 : Math.PI, 0, 0]);
    b.cone(color, [w / 2, y + dir * size * 0.5, z], size * 0.5, size, 4, [dir > 0 ? 0 : Math.PI, 0, 0]);
  }
  b.cone(color, [-w / 4, y + dir * size * 0.5, z0], size * 0.5, size, 4, [dir > 0 ? 0 : Math.PI, 0, 0]);
  b.cone(color, [w / 4, y + dir * size * 0.5, z0], size * 0.5, size, 4, [dir > 0 ? 0 : Math.PI, 0, 0]);
}

// Furry four-legged chasers share one rig with different proportions.
function quadruped(o) {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  root.add(blobShadow(o.wid * 1.1));
  const H = o.legH;
  body.add(mesh(b => {
    b.box(o.color, [0, H + o.hgt / 2, 0], [o.wid, o.hgt, o.len], null, 0.04);
    b.box(o.belly, [0, H + 0.08, 0], [o.wid * 0.8, 0.18, o.len * 0.85]);
    if (o.hump) b.box(o.color, [0, H + o.hgt + 0.1, -o.len * 0.22], [o.wid * 0.85, 0.3, o.len * 0.4]);
    if (o.ridge) for (let i = 0; i < 7; i++) b.box(o.dark, [0, H + o.hgt + 0.06 + (i % 2) * 0.05, -o.len * 0.42 + i * o.len * 0.13], [0.12, 0.22, 0.12], [0.4, 0, 0]);
    if (o.mane) b.box(o.dark, [0, H + o.hgt * 0.65, -o.len * 0.38], [o.wid * 1.08, o.hgt * 0.9, o.len * 0.28]);
  }));
  const legs = [];
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    legs.push(pivot(body, sx * (o.wid / 2 - o.legW / 2), H + 0.05, sz * (o.len / 2 - o.legW / 1.5), b => {
      b.box(o.legColor || o.color, [0, -H / 2, 0], [o.legW, H + 0.1, o.legW]);
      b.box(o.dark, [0, -H + 0.04, -0.04], [o.legW * 1.15, 0.12, o.legW * 1.3]);
      if (o.claws) for (const cx of [-1, 0, 1]) b.cone('#f2eadc', [cx * o.legW * 0.3, -H + 0.04, -o.legW * 0.75], 0.04, 0.16, 4, [-Math.PI / 2, 0, 0]);
    }));
  }
  const [hw, hh, hd] = o.head, [sw, sh, sd] = o.snout;
  const head = pivot(body, 0, H + o.hgt * 0.75, -o.len / 2 - 0.05, b => {
    b.box(o.color, [0, 0, -hd / 2], [hw, hh, hd], null, 0.03);
    b.box(o.snoutColor, [0, -hh * 0.18 + sh / 2 - sh / 2, -hd - sd / 2 + 0.02], [sw, sh * 0.6, sd]);
    b.box(o.nose || '#1a1a1a', [0, -hh * 0.18 + sh * 0.12, -hd - sd + 0.02], [sw * 0.5, sh * 0.32, 0.08]);
    b.box('#6e1414', [0, -hh * 0.18 - sh * 0.3, -hd - sd * 0.4], [sw * 0.85, sh * 0.2, sd * 0.8]);
    teeth(b, { w: sw * 0.8, y: -hh * 0.18 - sh * 0.3, z0: -hd - sd + 0.06, z1: -hd - 0.05, dir: -1, size: o.tooth || 0.08 });
    if (o.tusks) for (const sx of [-1, 1]) {
      b.box('#fff8e6', [sx * sw * 0.55, -hh * 0.1, -hd - sd * 0.7], [0.07, 0.07, 0.3], [0.5, 0, 0]);
      b.box('#fff8e6', [sx * sw * 0.55, 0.06, -hd - sd * 0.92], [0.07, 0.22, 0.07]);
    }
    face(b, { w: hw, y: hh * 0.18, z: -hd - 0.012, eye: o.eye, gap: hw * 0.24, size: hw * 0.17 });
    if (o.ears === 'round') for (const sx of [-1, 1]) b.box(o.color, [sx * hw * 0.38, hh / 2 + 0.1, -hd * 0.45], [0.22, 0.2, 0.12]);
    if (o.ears === 'point') for (const sx of [-1, 1]) b.cone(o.color, [sx * hw * 0.32, hh / 2 + 0.18, -hd * 0.4], 0.12, 0.38, 4, [0, Math.PI / 4, sx * -0.2]);
  });
  const jaw = pivot(head, 0, -hh * 0.18 - sh * 0.3, -hd + 0.02, b => {
    b.box(o.snoutColor, [0, -sh * 0.22, -sd / 2], [sw * 0.92, sh * 0.42, sd * 0.95]);
    b.box('#a51d2d', [0, -sh * 0.02, -sd * 0.5], [sw * 0.6, 0.04, sd * 0.7]);
    teeth(b, { w: sw * 0.78, y: -sh * 0.02, z0: -sd + 0.06, z1: -0.05, dir: 1, size: o.tooth || 0.08 });
  });
  const tail = pivot(body, 0, H + o.hgt * 0.8, o.len / 2, b => {
    if (o.tail === 'bushy') b.box(o.color, [0, -0.12, 0.38], [0.24, 0.24, 0.8], [0.5, 0, 0]), b.box(o.belly, [0, -0.32, 0.72], [0.2, 0.2, 0.22], [0.5, 0, 0]);
    else if (o.tail === 'thin') b.box(o.dark, [0, -0.1, 0.2], [0.06, 0.06, 0.4], [0.6, 0, 0]);
    else b.box(o.color, [0, 0, 0.08], [0.22, 0.2, 0.18]);
  });
  let ph = 0;
  return {
    root, body, head, jaw, height: H + o.hgt + 0.6, length: o.len + hd + sd,
    animate(mode, dt, t) {
      const k = Math.min(1, dt * 12);
      let jawTo = -0.15, headX = 0, by = 0, pitch = 0;
      if (mode === 'run' || mode === 'attack' || mode === 'roar') {
        ph += dt * TAU * (mode === 'roar' ? 0.8 : 1.9);
        const s = Math.sin(ph);
        legs[0].rotation.x = s * 0.9; legs[1].rotation.x = Math.sin(ph + 0.5) * 0.9;
        legs[2].rotation.x = -s * 0.9; legs[3].rotation.x = -Math.sin(ph + 0.5) * 0.9;
        pitch = Math.cos(ph) * 0.07; by = Math.abs(s) * 0.12;
        tail.rotation.y = Math.sin(ph * 0.5) * 0.4;
      }
      if (mode === 'roar') { jawTo = -0.75 + Math.sin(t * 40) * 0.06; headX = 0.35 + Math.sin(t * 30) * 0.03; }
      if (mode === 'attack') { jawTo = Math.sin(t * 16) > 0 ? -0.8 : 0; headX = -0.15; }
      if (mode === 'idle') { by = Math.sin(t * 2) * 0.03; jawTo = -0.3; }
      jaw.rotation.x = lerp(jaw.rotation.x, jawTo, Math.min(1, dt * 20));
      head.rotation.x = lerp(head.rotation.x, headX, k);
      body.rotation.x = pitch;
      body.position.y = by;
    },
  };
}

function scorpion() {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  root.add(blobShadow(1.1));
  const C = '#c9923d', D = '#8a5a20', Y = 0.75;
  body.add(mesh(b => {
    b.box(C, [0, Y, -0.35], [1.0, 0.38, 0.95], null, 0.03);
    b.box(D, [0, Y + 0.2, -0.35], [0.8, 0.06, 0.8]);
    for (let i = 0; i < 4; i++) b.box(i % 2 ? C : '#b88232', [0, Y - 0.02, 0.32 + i * 0.32], [0.92 - i * 0.1, 0.34, 0.34]);
    face(b, { w: 0.6, y: Y + 0.1, z: -0.83, eye: '#ff3b30', gap: 0.15, size: 0.12, brow: '#3a240c' });
    b.box('#5a1010', [0, Y - 0.1, -0.84], [0.32, 0.08, 0.03]);
    teeth(b, { w: 0.3, y: Y - 0.07, z0: -0.86, z1: -0.86, dir: -1, size: 0.06 });
  }));
  const legs = [];
  for (const sx of [-1, 1]) for (let i = 0; i < 4; i++) {
    legs.push(pivot(body, sx * 0.48, Y, -0.55 + i * 0.32, b => {
      b.box(D, [sx * 0.3, 0.12, 0], [0.62, 0.1, 0.1], [0, 0, sx * 0.45]);
      b.box(C, [sx * 0.68, -0.32, 0], [0.1, 0.85, 0.1], [0, 0, sx * -0.25]);
    }));
  }
  const claws = [], fingers = [];
  for (const sx of [-1, 1]) {
    const arm = pivot(body, sx * 0.45, Y + 0.05, -0.75, b => {
      b.box(D, [sx * 0.15, 0, -0.3], [0.18, 0.18, 0.6], [0, sx * 0.4, 0]);
      b.box(C, [sx * 0.32, 0.02, -0.75], [0.42, 0.3, 0.55], null, 0.04);
      b.box(D, [sx * 0.42, 0.02, -1.12], [0.14, 0.18, 0.4]);
    });
    claws.push(arm);
    fingers.push(pivot(arm, sx * 0.2, 0.02, -0.95, b => b.box(C, [0, 0, -0.18], [0.12, 0.16, 0.42])));
  }
  // Tail: a chain of segments that curls up and over the back.
  let parent = pivot(body, 0, Y + 0.05, 1.45);
  const segs = [];
  for (let i = 0; i < 5; i++) {
    const s = 0.34 - i * 0.03;
    const seg = pivot(parent, 0, 0, i === 0 ? 0 : 0.36, b => b.box(i % 2 ? C : '#b88232', [0, 0, 0.18], [s, s, 0.38]));
    seg.rotation.x = -0.6;
    segs.push(seg);
    parent = seg;
  }
  pivot(parent, 0, 0, 0.36, b => {
    b.ico(D, [0, 0, 0.12], [0.34, 0.3, 0.36]);
    b.cone('#d6352e', [0, -0.1, 0.36], 0.08, 0.34, 5, [Math.PI / 2 + 0.6, 0, 0]);
  });
  let ph = 0;
  return {
    root, body, height: 2.6, length: 2.6,
    animate(mode, dt, t) {
      ph += dt * TAU * (mode === 'idle' ? 0.5 : 2.4);
      legs.forEach((l, i) => { l.rotation.y = Math.sin(ph + i * 1.3) * 0.35; l.rotation.z = Math.cos(ph + i * 1.3) * 0.12; });
      const snap = mode === 'roar' || mode === 'attack' ? Math.sin(t * 18) : Math.sin(t * 4);
      fingers.forEach((f, i) => { f.rotation.y = (i ? -1 : 1) * (0.15 + Math.max(0, snap) * 0.45); });
      claws.forEach((c, i) => { c.rotation.y = (i ? -1 : 1) * (mode === 'roar' ? -0.35 : 0) + Math.sin(ph * 0.5 + i) * 0.08; c.rotation.x = mode === 'roar' ? -0.4 : 0; });
      const strike = mode === 'attack' ? Math.max(0, Math.sin(t * 10)) * 0.35 : 0;
      segs.forEach((s, i) => { s.rotation.x = -0.6 - strike + Math.sin(t * 3 + i * 0.6) * 0.06; });
      body.position.y = Math.abs(Math.sin(ph)) * 0.04;
    },
  };
}

function gator() {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  root.add(blobShadow(0.9));
  const G = '#3f6b2e', D = '#2a4d1f', B = '#c2c98a', Y = 0.5;
  body.add(mesh(b => {
    b.box(G, [0, Y, 0], [0.95, 0.45, 1.9], null, 0.03);
    b.box(B, [0, Y - 0.2, 0], [0.8, 0.1, 1.7]);
    for (let i = 0; i < 8; i++) for (const sx of [-1, 0, 1]) b.box(D, [sx * 0.25, Y + 0.27, -0.8 + i * 0.23], [0.12, 0.12, 0.14], [0, 0, 0.785]);
  }));
  const legs = [];
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) legs.push(pivot(body, sx * 0.5, Y - 0.05, sz * 0.62, b => {
    b.box(G, [sx * 0.18, -0.08, 0], [0.38, 0.18, 0.2]);
    b.box(G, [sx * 0.32, -0.26, 0], [0.18, 0.3, 0.2]);
    b.box(D, [sx * 0.34, -0.42, -0.08], [0.24, 0.07, 0.3]);
  }));
  const head = pivot(body, 0, Y + 0.05, -0.95, b => {
    b.box(G, [0, 0.05, -0.28], [0.8, 0.36, 0.6]);
    b.box(G, [0, 0.02, -0.98], [0.56, 0.22, 0.9]);
    b.box(D, [0, 0.14, -1.4], [0.22, 0.08, 0.1]);
    for (const sx of [-1, 1]) {
      b.box(G, [sx * 0.24, 0.3, -0.32], [0.2, 0.16, 0.22]);
      b.box('#ffd23f', [sx * 0.24, 0.34, -0.44], [0.16, 0.1, 0.02]);
      b.box('#111111', [sx * 0.24, 0.34, -0.452], [0.04, 0.1, 0.02]);
      b.box('#1a2a12', [sx * 0.24, 0.42, -0.44], [0.24, 0.05, 0.04], [0, 0, sx * 0.4]);
    }
    b.box('#7a1a1a', [0, -0.1, -0.9], [0.46, 0.05, 0.85]);
    teeth(b, { w: 0.5, y: -0.09, z0: -1.4, z1: -0.55, dir: -1, size: 0.08 });
  });
  const jaw = pivot(head, 0, -0.1, -0.5, b => {
    b.box(B, [0, -0.07, -0.45], [0.52, 0.14, 0.95]);
    b.box('#a51d2d', [0, 0.01, -0.45], [0.38, 0.03, 0.8]);
    teeth(b, { w: 0.46, y: 0.0, z0: -0.88, z1: -0.08, dir: 1, size: 0.08 });
  });
  const tail = [];
  let parent = body, z = 0.95;
  for (let i = 0; i < 3; i++) {
    const w = 0.7 - i * 0.18;
    const seg = pivot(parent, 0, i === 0 ? Y : 0, i === 0 ? z : 0.8, b => {
      b.box(G, [0, -i * 0.04, 0.4], [w, 0.36 - i * 0.08, 0.82]);
      b.box(D, [0, 0.18 - i * 0.06, 0.4], [0.1, 0.12, 0.7]);
    });
    tail.push(seg);
    parent = seg;
  }
  let ph = 0;
  return {
    root, body, height: 1.5, length: 4.5,
    animate(mode, dt, t) {
      ph += dt * TAU * (mode === 'idle' ? 0.4 : 2.2);
      const s = Math.sin(ph);
      legs.forEach((l, i) => { l.rotation.x = (i === 0 || i === 3 ? s : -s) * 0.7; });
      tail.forEach((seg, i) => { seg.rotation.y = Math.sin(ph - i * 0.8) * 0.3; });
      body.rotation.y = Math.sin(ph) * 0.06;
      const open = mode === 'roar' ? 0.65 + Math.sin(t * 30) * 0.05 : mode === 'attack' ? (Math.sin(t * 14) > 0 ? 0.75 : 0) : 0.1;
      jaw.rotation.x = lerp(jaw.rotation.x, open, Math.min(1, dt * 18));
      head.rotation.x = lerp(head.rotation.x, mode === 'roar' ? -0.35 : 0, Math.min(1, dt * 10));
    },
  };
}

function shark() {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  const T = '#5f7d90', W = '#eef3f6', Y = 0.45;
  body.add(mesh(b => {
    b.box(T, [0, Y + 0.05, -0.2], [1.05, 0.9, 1.3], null, 0.03);
    b.box(W, [0, Y - 0.38, -0.2], [0.95, 0.2, 1.25]);
    b.box(T, [0, Y + 0.12, 0.4], [1.08, 0.04, 0.04]);
    b.box(T, [0, Y + 1.0, 0.0], [0.14, 1.1, 0.7], [-0.55, 0, 0]);
    for (const sx of [-1, 1]) b.box(T, [sx * 0.75, Y - 0.25, -0.3], [0.8, 0.08, 0.45], [0, sx * 0.4, sx * -0.3]);
    for (let i = 0; i < 3; i++) for (const sx of [-1, 1]) b.box('#3e5664', [sx * 0.53, Y + 0.12, -0.6 + i * 0.13], [0.02, 0.3, 0.04]);
  }));
  const head = pivot(body, 0, Y, -0.85, b => {
    b.box(T, [0, 0.18, -0.35], [0.95, 0.6, 0.7]);
    b.box(T, [0, 0.25, -0.85], [0.75, 0.4, 0.45]);
    b.box('#7a1a1a', [0, -0.05, -0.55], [0.75, 0.1, 0.75]);
    teeth(b, { w: 0.78, y: -0.02, z0: -0.95, z1: -0.25, dir: -1, size: 0.11 });
    for (const sx of [-1, 1]) {
      b.box('#111111', [sx * 0.43, 0.3, -0.55], [0.06, 0.13, 0.13]);
      b.box('#ffffff', [sx * 0.465, 0.33, -0.57], [0.02, 0.04, 0.04]);
      b.box('#2c3a42', [sx * 0.43, 0.42, -0.6], [0.08, 0.05, 0.22], [sx * 0.4, 0, 0]);
    }
  });
  const jaw = pivot(head, 0, -0.05, -0.15, b => {
    b.box(W, [0, -0.13, -0.4], [0.85, 0.24, 0.8]);
    b.box('#a51d2d', [0, 0.0, -0.4], [0.6, 0.04, 0.7]);
    teeth(b, { w: 0.75, y: 0.0, z0: -0.75, z1: -0.1, dir: 1, size: 0.11 });
  });
  const tail = [];
  let parent = body;
  for (let i = 0; i < 3; i++) {
    const seg = pivot(parent, 0, i === 0 ? Y + 0.05 : 0, i === 0 ? 0.45 : 0.6, b => {
      if (i < 2) {
        b.box(T, [0, 0, 0.3], [0.8 - i * 0.3, 0.75 - i * 0.25, 0.65]);
        b.box(W, [0, -0.3 + i * 0.1, 0.3], [0.7 - i * 0.3, 0.14, 0.6]);
      } else {
        b.box(T, [0, 0.45, 0.35], [0.1, 1.0, 0.35], [0.55, 0, 0]);
        b.box(T, [0, -0.3, 0.3], [0.1, 0.65, 0.3], [-0.6, 0, 0]);
      }
    });
    tail.push(seg);
    parent = seg;
  }
  let ph = 0;
  return {
    root, body, height: 2.3, length: 3.8,
    animate(mode, dt, t) {
      ph += dt * TAU * (mode === 'idle' ? 0.6 : 1.6);
      tail.forEach((s, i) => { s.rotation.y = Math.sin(ph - i * 0.9) * (0.25 + i * 0.12); });
      head.rotation.y = -Math.sin(ph) * 0.08;
      const leap = mode === 'attack' ? Math.max(0, Math.sin(t * 8)) * 0.6 : 0;
      body.position.y = -0.45 + Math.sin(ph * 2) * 0.06 + leap + (mode === 'roar' ? 0.3 : 0);
      body.rotation.x = mode === 'roar' ? -0.25 : -leap * 0.4;
      const open = mode === 'roar' ? 0.7 + Math.sin(t * 28) * 0.05 : mode === 'attack' ? (Math.sin(t * 16) > 0 ? 0.8 : 0) : 0.25;
      jaw.rotation.x = lerp(jaw.rotation.x, open, Math.min(1, dt * 18));
    },
  };
}

function hurricane() {
  const root = new THREE.Group();
  const rings = [];
  const greys = ['#dfe6ee', '#c4ced9', '#aab6c4', '#eef2f6', '#93a1b2'];
  for (let i = 0; i < 11; i++) {
    const r = 0.45 + i * 0.32, n = 8 + i * 2;
    const ring = pivot(root, 0, 0.3 + i * 0.5, 0, b => {
      for (let k = 0; k < n; k++) {
        const a = (k / n) * TAU;
        const s = 0.42 + (k % 3) * 0.12;
        b.box(greys[(k + i) % greys.length], [Math.cos(a) * r, (k % 2) * 0.12, Math.sin(a) * r], [s, s * 0.8, s], [0, -a, 0]);
      }
      if (i > 2 && i % 2) for (let k = 0; k < 3; k++) {
        const a = k * 2.1 + i;
        b.box(['#7a4f2a', '#3f8f3a', '#c0392b'][k], [Math.cos(a) * (r + 0.5), 0.2, Math.sin(a) * (r + 0.5)], [0.22, 0.08, 0.3], [0.4, a, 0.3]);
      }
    });
    rings.push(ring);
  }
  // A face that always looks forward, floating in the funnel.
  const faceG = pivot(root, 0, 3.0, -1.6, b => {
    face(b, { w: 1.2, y: 0, z: 0, eye: '#ff3b30', gap: 0.38, size: 0.3, brow: '#2c3440' });
    b.box('#2c3440', [0, -0.5, -0.02], [0.8, 0.22, 0.05]);
    teeth(b, { w: 0.7, y: -0.42, z0: -0.05, z1: -0.05, dir: -1, size: 0.12 });
  }, M.glow);
  return {
    root, body: root, height: 6, length: 3,
    animate(mode, dt, t) {
      const spin = mode === 'roar' || mode === 'attack' ? 9 : 5;
      rings.forEach((r, i) => {
        r.rotation.y += dt * (spin - i * 0.25);
        r.position.x = Math.sin(t * 2 + i * 0.5) * 0.12 * i;
        r.position.z = Math.cos(t * 1.7 + i * 0.4) * 0.08 * i;
      });
      faceG.position.x = rings[6].position.x;
      faceG.scale.setScalar(mode === 'roar' ? 1.15 + Math.sin(t * 30) * 0.03 : 1);
    },
  };
}

export function makeChaser(type) {
  switch (type) {
    case 'bear': return quadruped({ len: 1.9, wid: 1.15, hgt: 1.0, legH: 0.68, legW: 0.34, color: '#2b231f', belly: '#3d322b', dark: '#1a1411', head: [0.9, 0.78, 0.7], snout: [0.46, 0.36, 0.42], snoutColor: '#a77d55', ears: 'round', tail: 'stub', eye: '#ffcc33', claws: true, hump: true, tooth: 0.09 });
    case 'wolf': return quadruped({ len: 1.6, wid: 0.62, hgt: 0.62, legH: 0.8, legW: 0.2, color: '#8f8a7e', belly: '#ddd5c4', dark: '#4e4a44', head: [0.6, 0.55, 0.5], snout: [0.3, 0.28, 0.55], snoutColor: '#cdbfa8', ears: 'point', tail: 'bushy', eye: '#ffd23f', mane: true, tooth: 0.07 });
    case 'boar': return quadruped({ len: 1.55, wid: 0.88, hgt: 0.85, legH: 0.45, legW: 0.24, color: '#4b3a32', belly: '#5f4a3f', dark: '#2a1f1a', head: [0.68, 0.62, 0.55], snout: [0.44, 0.36, 0.32], snoutColor: '#b88a7e', nose: '#7a4a44', ears: 'point', tail: 'thin', eye: '#ff3b30', tusks: true, ridge: true, tooth: 0.06 });
    case 'scorpion': return scorpion();
    case 'gator': return gator();
    case 'shark': return shark();
    case 'hurricane': return hurricane();
    default: throw new Error('Unknown chaser ' + type);
  }
}
