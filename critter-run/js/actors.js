// Animated runners and toy blasters loaded from the CC0 models in assets/ (see assets/CREDITS.md).
// A runner has the same interface as the voxel hero in models.js, so the game can use either one.
import * as THREE from 'three';
import { GLTFLoader, cloneSkinned } from 'three/addons';
import { bend } from './gfx.js';
import { blobShadow } from './models.js';

const loader = new GLTFLoader();
const files = new Map();
export function loadGLB(url) {
  if (!files.has(url)) files.set(url, loader.loadAsync(url).catch(e => { files.delete(url); throw e; }));
  return files.get(url);
}
const runnerUrl = id => `./assets/runners/${id}.glb`;
const BLASTERS = './assets/blasters.glb';

// Game pose -> clip name. Every human runner borrows the clips stored in the kid's file.
const CLIPS = {
  human: { run: 'Run', jump: 'Jump', slide: 'Roll', idle: 'Idle', cheer: 'Victory', zap: 'Shoot_OneHanded', fall: 'Death', hit: 'RecieveHit' },
  robot: { run: 'Running', jump: 'Jump', idle: 'Idle', cheer: 'Dance', zap: 'Punch', fall: 'Death', hit: 'Punch' },
};
const ONCE = new Set(['jump', 'slide', 'zap', 'fall', 'hit']);
const HAND = { human: 'FistR', robot: 'Palm2R' };
const HEIGHT = 1.8;
const TAU = Math.PI * 2;
const lerp = (a, b, t) => a + (b - a) * t;

const _v = new THREE.Vector3();

// Each blaster is centered on its grip and scaled to about half a meter long, with the barrel along -z.
let blasterSet = null;
export function loadBlasters() {
  if (!blasterSet) {
    blasterSet = loadGLB(BLASTERS).then(g => {
      const out = {};
      for (const node of [...g.scene.children]) {
        const box = new THREE.Box3().setFromObject(node);
        const size = box.getSize(new THREE.Vector3());
        const s = 0.55 / Math.max(size.x, size.y, size.z);
        const grip = new THREE.Vector3((box.min.x + box.max.x) / 2, box.min.y + size.y * 0.3, box.max.z - size.z * 0.3);
        const tip = new THREE.Vector3((box.min.x + box.max.x) / 2, box.max.y - size.y * 0.3, box.min.z);
        node.traverse(o => {
          if (!o.isMesh) return;
          o.material = bend(o.material.clone(), { rim: 0.4 });
          o.castShadow = true;
          o.frustumCulled = false;
        });
        node.position.sub(grip);
        const holder = new THREE.Group();
        holder.add(node);
        holder.scale.setScalar(s);
        holder.userData.tip = tip.sub(grip);
        out[node.name] = holder;
      }
      return out;
    });
  }
  return blasterSet;
}

export async function loadRunner(def) {
  const rig = def.rig || 'human';
  const [own, base] = await Promise.all([loadGLB(runnerUrl(def.id)), rig === 'human' ? loadGLB(runnerUrl('kid')) : null]);
  return buildRunner(def, own.scene, rig === 'human' ? base.animations : own.animations);
}

function buildRunner(def, source, clips) {
  const rig = def.rig || 'human';
  const model = cloneSkinned(source);
  const tint = def.tint || {};
  model.traverse(o => {
    if (!o.isMesh) return;
    const mats = [].concat(o.material).map(m => {
      const c = m.clone();
      if (tint[c.name]) c.color.set(tint[c.name]);
      c.metalness = 0;
      c.roughness = 0.75;
      return bend(c, { rim: 0.55 });
    });
    o.material = Array.isArray(o.material) ? mats : mats[0];
    o.castShadow = true;
    o.receiveShadow = false;
    o.frustumCulled = false;
  });
  model.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(model);
  const k = (def.height || HEIGHT) / Math.max(0.01, box.max.y - box.min.y);
  model.scale.multiplyScalar(k);
  model.position.y = -box.min.y * k;
  model.rotation.y = Math.PI; // models face +z; the runner faces -z

  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  body.add(model);
  const shadow = blobShadow(0.5);
  root.add(shadow);

  const mixer = new THREE.AnimationMixer(model);
  const actions = {};
  for (const [pose, name] of Object.entries(CLIPS[rig])) {
    const clip = clips.find(c => c.name === name);
    if (!clip) continue;
    const a = mixer.clipAction(clip);
    if (ONCE.has(pose)) { a.setLoop(THREE.LoopOnce, 1); a.clampWhenFinished = true; }
    actions[pose] = a;
  }
  const hand = model.getObjectByName(HAND[rig]);

  // The blaster follows the hand but always aims where we tell it, so it never clips through the body.
  const gun = new THREE.Group();
  gun.visible = false;
  root.add(gun);
  let gunModel = null, gunId = null;
  const aim = new THREE.Vector3(0, 1.2, -10);

  let cur = null, curPose = '', hitT = 0, stumbleT = 0, turn = 0, squash = 1;
  function placeGun() {
    if (!hand) return;
    root.updateMatrixWorld(true);
    hand.getWorldPosition(_v);
    root.worldToLocal(gun.position.copy(_v));
    gun.lookAt(aim); // lookAt accounts for the parent's rotation
    gun.rotateY(Math.PI);
    gun.updateMatrixWorld(true);
  }
  function play(pose, fade = 0.14) {
    if (pose === curPose) return;
    const a = actions[pose] || actions.run;
    curPose = pose;
    if (a === cur) { if (ONCE.has(pose)) a.reset().play(); return; }
    a.reset().setEffectiveTimeScale(1).setEffectiveWeight(1).fadeIn(fade).play();
    if (cur) cur.fadeOut(fade);
    cur = a;
  }

  return {
    root, body, shadow, id: def.id, gltf: true,
    stumble() { stumbleT = 0.5; hitT = 0.42; },
    async setWeapon(id) {
      gunId = id;
      const set = await loadBlasters().catch(() => null);
      if (!set || gunId !== id) return;
      if (gunModel) gun.remove(gunModel);
      gunModel = set[id] ? set[id].clone() : null;
      if (gunModel) gun.add(gunModel);
    },
    showWeapon(on) { gun.visible = on && !!gunModel; },
    aimAt(worldPos) { aim.copy(worldPos); },
    // Where shots come out, in world space.
    muzzle(out = new THREE.Vector3()) {
      if (!gunModel || !gun.visible || !hand) return body.localToWorld(out.set(0, 1.25, 0.3));
      placeGun();
      return gunModel.localToWorld(out.copy(gunModel.userData.tip));
    },
    // mode: run | jump | slide | idle | cheer | zap | fall
    animate(mode, dt, { speed = 10, jumpY = 0, t = 0 } = {}) {
      hitT -= dt;
      const pose = hitT > 0 && (mode === 'run' || mode === 'jump') && actions.hit ? 'hit' : mode;
      play(pose, pose === 'jump' ? 0.08 : pose === 'slide' ? 0.06 : 0.16);
      if (cur) {
        if (pose === 'run') cur.timeScale = Math.max(0.6, speed / 9.5) * 1.05;
        else if (pose === 'jump') cur.timeScale = 1.35;
        else if (pose === 'slide') cur.timeScale = 1.2;
        else if (pose === 'zap') cur.timeScale = 1.1;
        else cur.timeScale = 1;
      }
      mixer.update(dt);

      const k = Math.min(1, dt * 14);
      // Turn around to face the chaser when firing.
      const turnTo = mode === 'zap' ? Math.PI : 0;
      turn = lerp(turn, turnTo, Math.min(1, dt * 12));
      body.rotation.y = turn;
      // The robot has no roll clip, so it squashes down instead.
      const sq = mode === 'slide' && !actions.slide ? 0.5 : 1;
      squash = lerp(squash, sq, k);
      model.scale.y = model.scale.x * squash;
      if (stumbleT > 0) {
        stumbleT -= dt;
        body.rotation.z = Math.sin(stumbleT * 40) * stumbleT * 1.2;
      } else body.rotation.z = lerp(body.rotation.z, 0, k);
      body.position.y = jumpY + (mode === 'cheer' && !actions.cheer ? Math.abs(Math.sin(t * 7)) * 0.35 : 0);
      const s = Math.max(0.35, 1 - jumpY * 0.3);
      shadow.scale.set(s, 1, s);
      shadow.material.opacity = 0.2 * s;

      if (gun.visible) placeGun();
    },
  };
}

// A quick spin used by the shop preview.
export function spin(obj, dt, rate = 0.6) { obj.rotation.y = (obj.rotation.y + dt * rate) % TAU; }
