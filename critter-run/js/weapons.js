// Blaster effects fired at the chaser after a right answer. Each returns the time (seconds) until it hits,
// and calls ctx.hit() at impact so the game can knock the chaser back.
import * as THREE from 'three';
import { bend } from './gfx.js';

const V = () => new THREE.Vector3();
const glowMat = (color, k = 1.8) => bend(new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(k) }));
const ballMat = () => bend(new THREE.MeshStandardMaterial({ color: '#4fc3ff', emissive: '#1a7fd0', emissiveIntensity: 0.8, roughness: 0.1, transparent: true, opacity: 0.85 }));
const iceMat = () => bend(new THREE.MeshStandardMaterial({ color: '#bdf2ff', emissive: '#5ccfff', emissiveIntensity: 0.5, roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.55, depthWrite: false }));
const rockMat = () => bend(new THREE.MeshStandardMaterial({ color: '#5a3a2a', emissive: '#ff5a1f', emissiveIntensity: 1.6, roughness: 0.9, flatShading: true }));
// One of each material the effects create, so their shaders can be compiled before the first shot.
export const warmMaterials = () => [glowMat('#ffffff'), ballMat(), iceMat(), rockMat()];
const RAINBOW = ['#ff3b5c', '#ff8c1a', '#ffd23f', '#3cb44b', '#2f7fe0', '#b06cff'];

// Moves obj from a to b over `life` seconds along an arc of height `arc`, calling trail(pos) each frame.
function lob(fx, obj, a, b, life, arc, trail, done) {
  const p = V();
  fx.timed({
    obj, life,
    tick: k => {
      p.lerpVectors(a, b, k);
      p.y += Math.sin(k * Math.PI) * arc;
      obj.position.copy(p);
      obj.rotation.x += 0.3; obj.rotation.y += 0.2;
      if (trail) trail(p, k);
    },
    done,
  });
}

const W = {
  zap(ctx) {
    const { fx, sound, from, to } = ctx;
    fx.beam(from, to, '#7ff3ff');
    sound.sfx('zap');
    setTimeout(() => {
      fx.burst(to.x, to.y, to.z, { n: 30, colors: ['#7ff3ff', '#ffffff', '#ffd23f'], speed: 7, up: 5, life: 0.9, size: 0.2, sparks: 30 });
      fx.glowAt(to.x, to.y, to.z, '#7ff3ff', 2.2);
      ctx.hit();
    }, 120);
    return 0.12;
  },

  splash(ctx) {
    const { fx, sound, from, to } = ctx;
    sound.sfx('splash');
    for (let i = 0; i < 3; i++) {
      setTimeout(() => {
        const ball = new THREE.Mesh(new THREE.IcosahedronGeometry(0.35, 1), ballMat());
        ball.frustumCulled = false;
        const end = to.clone().add(V().set((i - 1) * 0.5, (i - 1) * 0.2, 0));
        lob(fx, ball, from, end, 0.42, 1.6, p => {
          if (Math.random() < 0.7) fx.puff({ x: p.x, y: p.y, z: p.z, vy: -1, life: 0.4, size: 0.5, color: '#bfeaff', alpha: 0.7 });
        }, () => {
          sound.sfx('splat');
          for (let k = 0; k < 14; k++) fx.puff({ x: end.x, y: end.y, z: end.z, vx: (Math.random() - 0.5) * 6, vy: Math.random() * 5, vz: (Math.random() - 0.5) * 6, g: -12, life: 0.7, size: 0.7, color: k % 2 ? '#4fc3ff' : '#ffffff', alpha: 0.85 });
          fx.burst(end.x, end.y, end.z, { n: 10, colors: ['#4fc3ff', '#bfeaff'], speed: 5, up: 4, life: 0.7, size: 0.14 });
          if (i === 2) ctx.hit();
        });
      }, i * 110);
    }
    return 0.22 + 0.42;
  },

  fire(ctx) {
    const { fx, sound, from, to } = ctx;
    sound.sfx('fire');
    const dir = V().subVectors(to, from);
    const life = 0.5;
    fx.timed({
      life,
      tick: () => {
        for (let i = 0; i < 6; i++) {
          const s = 0.8 + Math.random() * 0.4;
          fx.spark({ x: from.x, y: from.y, z: from.z, vx: dir.x * 2.2 * s + (Math.random() - 0.5) * 2, vy: dir.y * 2.2 * s + (Math.random() - 0.5) * 2 + 1, vz: dir.z * 2.2 * s + (Math.random() - 0.5) * 2, life: 0.45, size: 0.9 + Math.random() * 0.6, color: ['#ffd23f', '#ff8c1a', '#ff3b1a'][i % 3], glow: 2, grow: 1.5 });
        }
      },
    });
    setTimeout(() => {
      for (let k = 0; k < 10; k++) fx.puff({ x: to.x + (Math.random() - 0.5), y: to.y, z: to.z + (Math.random() - 0.5), vy: 2 + Math.random() * 2, life: 1.4, size: 1.6, color: '#555555', alpha: 0.6, grow: 2 });
      fx.burst(to.x, to.y, to.z, { n: 16, colors: ['#ff8c1a', '#ffd23f', '#ff3b1a'], speed: 6, up: 5, life: 0.8, size: 0.16, sparks: 30, glow: 1.5 });
      fx.glowAt(to.x, to.y, to.z, '#ff8c1a', 2.6, 0.4);
      ctx.hit();
    }, 420);
    return 0.42;
  },

  freeze(ctx) {
    const { fx, sound, from, to, chaser } = ctx;
    fx.beam(from, to, '#bdf2ff', { width: 1.3, life: 0.45, colors: ['#5ccfff', '#bdf2ff', '#ffffff'] });
    sound.sfx('freeze');
    setTimeout(() => {
      const h = chaser.height || 1.6, l = chaser.length || 2;
      const ice = new THREE.Mesh(new THREE.BoxGeometry(Math.max(1.6, h * 0.8), h * 1.15, l * 1.1), iceMat());
      ice.frustumCulled = false;
      ice.position.set(to.x, h * 0.55, to.z);
      ctx.freeze(1.05);
      fx.timed({
        obj: ice, life: 1.0,
        tick: k => { ice.scale.setScalar(Math.min(1, k * 6)); ice.rotation.y = Math.sin(k * 40) * 0.02 * k; },
        done: () => {
          sound.sfx('shatter');
          fx.burst(to.x, h * 0.6, to.z, { n: 50, colors: ['#bdf2ff', '#ffffff', '#5ccfff'], speed: 9, up: 6, life: 1.1, size: 0.3, sparks: 24 });
          ctx.hit();
        },
      });
    }, 300);
    return 1.3;
  },

  fireworks(ctx) {
    const { fx, sound, from, to } = ctx;
    sound.sfx('rocket');
    for (let i = 0; i < 3; i++) {
      setTimeout(() => {
        const g = new THREE.Group();
        const body = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 0.5, 8).rotateX(Math.PI / 2), glowMat(RAINBOW[i * 2], 1.2));
        const nose = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.22, 8).rotateX(Math.PI / 2).translate(0, 0, 0.36), glowMat('#ffffff', 1.2));
        body.frustumCulled = nose.frustumCulled = false;
        g.add(body, nose);
        const end = to.clone().add(V().set((i - 1) * 0.9, 0.4 + (i % 2) * 0.5, 0));
        const prev = from.clone();
        lob(fx, g, from, end, 0.55, 3 + i, p => {
          g.lookAt(V().copy(p).multiplyScalar(2).sub(prev));
          prev.copy(p);
          fx.spark({ x: p.x, y: p.y, z: p.z, vx: (Math.random() - 0.5), vy: (Math.random() - 0.5), vz: (Math.random() - 0.5), life: 0.35, size: 0.5, color: '#ffd23f', glow: 2 });
          if (Math.random() < 0.5) fx.puff({ x: p.x, y: p.y, z: p.z, life: 0.8, size: 0.6, color: '#dddddd', alpha: 0.5, grow: 2 });
        }, () => {
          sound.sfx('boom');
          const cs = [RAINBOW[(i * 2) % 6], RAINBOW[(i * 2 + 3) % 6], '#ffffff'];
          for (let k = 0; k < 70; k++) {
            const d = V().randomDirection().multiplyScalar(6 + Math.random() * 3);
            fx.spark({ x: end.x, y: end.y, z: end.z, vx: d.x, vy: d.y, vz: d.z, life: 0.9 + Math.random() * 0.5, size: 0.5, color: cs[k % 3], glow: 2.2, g: -3, drag: 2.2 });
          }
          fx.glowAt(end.x, end.y, end.z, cs[0], 3, 0.35);
          ctx.flash(cs[0], 0.18);
          if (i === 2) ctx.hit();
        });
      }, i * 160);
    }
    return 0.32 + 0.55;
  },

  rainbow(ctx) {
    const { fx, sound, from, to } = ctx;
    sound.sfx('rainbow');
    fx.beam(from, to, '#ffffff', { width: 2.4, life: 0.9, colors: RAINBOW });
    fx.timed({
      life: 0.7,
      tick: () => {
        const k = Math.random();
        fx.spark({ x: from.x + (to.x - from.x) * k, y: from.y + (to.y - from.y) * k + (Math.random() - 0.5), z: from.z + (to.z - from.z) * k, vy: 1 + Math.random() * 2, life: 0.8, size: 0.6, color: RAINBOW[Math.floor(Math.random() * 6)], glow: 2, drag: 1 });
      },
    });
    setTimeout(() => {
      fx.burst(to.x, to.y, to.z, { n: 40, colors: RAINBOW, speed: 8, up: 6, life: 1.1, size: 0.2, sparks: 50 });
      fx.ring(to.x, 0.3, to.z, '#ffffff', 7);
      ctx.flash('#ffffff', 0.2);
      ctx.hit();
    }, 300);
    return 0.3;
  },

  meteor(ctx) {
    const { fx, sound, to } = ctx;
    sound.sfx('meteor');
    const rock = new THREE.Mesh(new THREE.IcosahedronGeometry(1.1, 0), rockMat());
    rock.frustumCulled = false;
    const start = to.clone().add(V().set(-14, 34, -18)), end = to.clone().setY(0.6);
    fx.timed({
      obj: rock, life: 0.75,
      tick: k => {
        const e = k * k;
        rock.position.lerpVectors(start, end, e);
        rock.rotation.x += 0.15; rock.rotation.z += 0.1;
        const p = rock.position;
        for (let i = 0; i < 3; i++) fx.spark({ x: p.x + (Math.random() - 0.5), y: p.y + (Math.random() - 0.5), z: p.z + (Math.random() - 0.5), life: 0.5, size: 1.6, color: i ? '#ff8c1a' : '#ffd23f', glow: 2.2, grow: 1 });
        fx.puff({ x: p.x, y: p.y, z: p.z, life: 1.2, size: 2, color: '#444444', alpha: 0.5, grow: 2 });
      },
      done: () => {
        sound.sfx('boom');
        sound.sfx('smash');
        fx.burst(end.x, 0.5, end.z, { n: 60, colors: ['#5a3a2a', '#8a6c48', '#ff8c1a', '#ffd23f'], speed: 11, up: 9, life: 1.3, size: 0.32, sparks: 60, glow: 1.2 });
        for (let k = 0; k < 16; k++) fx.puff({ x: end.x, y: 0.6, z: end.z, vx: (Math.random() - 0.5) * 10, vy: Math.random() * 3, vz: (Math.random() - 0.5) * 10, drag: 2, life: 1.6, size: 2.6, color: '#7a6a5a', alpha: 0.6, grow: 1.5 });
        fx.ring(end.x, 0.2, end.z, '#ff8c1a', 10, 0.7);
        fx.ring(end.x, 0.25, end.z, '#ffd23f', 6, 0.5);
        fx.glowAt(end.x, 1, end.z, '#ff8c1a', 5, 0.5);
        ctx.flash('#ffb066', 0.4);
        ctx.shake(1.1);
        ctx.hit();
      },
    });
    return 0.75;
  },
};

export function fireWeapon(id, ctx) {
  return (W[id] || W.zap)(ctx);
}
