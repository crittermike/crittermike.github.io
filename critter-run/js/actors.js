// Animated runners and toy blasters loaded from the CC0 models in assets/ (see assets/CREDITS.md).
// Every runner shares one skeleton (the Quaternius universal humanoid), so all of them use the clips in
// assets/runners/anims.glb.
import * as THREE from 'three';
import { cloneSkinned } from 'three/addons';
import { bend } from './gfx.js';
import { blobShadow } from './models.js';
import { gltfLoader as loader } from './props.js';

const files = new Map();
export function loadGLB(url) {
  if (!files.has(url)) files.set(url, loader.loadAsync(url).catch(e => { files.delete(url); throw e; }));
  return files.get(url);
}
const runnerUrl = id => `./assets/runners/${id}.glb`;
const ANIMS = './assets/runners/anims.glb';
const BLASTERS = './assets/blasters.glb';

// Game pose -> clip name in anims.glb.
const CLIPS = { run: 'Sprint_Loop', jump: 'Jump_Loop', slide: 'Slide_Loop', idle: 'Idle_Loop', cheer: 'Victory', zap: 'Pistol_Shoot', fall: 'Death01', hit: 'Hit_Chest' };
const ONCE = new Set(['cheer', 'fall', 'hit']);
const HAND = 'hand_r';
// One shared size for everyone, so crowns and helmets don't shrink the person wearing them.
const SCALE = 0.95;
// The airborne pose tucks the feet up, so the body rides a little higher to keep the jump height honest.
const JUMP_TUCK = 0.1;
const TAU = Math.PI * 2;
const lerp = (a, b, t) => a + (b - a) * t;

const _v = new THREE.Vector3(), _axis = new THREE.Vector3();

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
  const [own, lib] = await Promise.all([loadGLB(runnerUrl(def.id)), loadGLB(ANIMS)]);
  return buildRunner(def, own.scene, lib.animations);
}

function buildRunner(def, source, clips) {
  const model = cloneSkinned(source);
  model.traverse(o => {
    if (!o.isMesh) return;
    const mats = [].concat(o.material).map(m => bend(m.clone(), { rim: 0.35 }));
    o.material = Array.isArray(o.material) ? mats : mats[0];
    o.castShadow = true;
    o.receiveShadow = false;
    o.frustumCulled = false;
  });
  model.scale.setScalar(SCALE);
  model.rotation.y = Math.PI; // models face +z; the runner faces -z

  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  body.add(model);
  const shadow = blobShadow(0.5);
  root.add(shadow);

  const mixer = new THREE.AnimationMixer(model);
  const actions = {};
  for (const [pose, name] of Object.entries(CLIPS)) {
    const clip = clips.find(c => c.name === name);
    if (!clip) continue;
    const a = mixer.clipAction(clip);
    if (ONCE.has(pose)) { a.setLoop(THREE.LoopOnce, 1); a.clampWhenFinished = true; }
    actions[pose] = a;
  }
  const hand = model.getObjectByName(HAND);

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
    // The grip sits a few centimeters along the fingers (the hand bone's +Y), not at the wrist.
    hand.getWorldPosition(_v).add(_axis.set(0, 1, 0).transformDirection(hand.matrixWorld).multiplyScalar(0.07));
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
    animate(mode, dt, { speed = 13.5, jumpY = 0, t = 0 } = {}) {
      hitT -= dt;
      const pose = hitT > 0 && (mode === 'run' || mode === 'jump') && actions.hit ? 'hit' : mode;
      play(pose, pose === 'jump' ? 0.08 : pose === 'slide' ? 0.06 : 0.16);
      if (cur) {
        if (pose === 'run') cur.timeScale = 1.25 * Math.sqrt(Math.max(0.3, speed / 13.5));
        else if (pose === 'zap') cur.timeScale = 0.85;
        else cur.timeScale = 1;
      }
      mixer.update(dt);

      const k = Math.min(1, dt * 14);
      // Turn around to face the chaser when firing.
      const turnTo = mode === 'zap' ? Math.PI : 0;
      turn = lerp(turn, turnTo, Math.min(1, dt * 12));
      body.rotation.y = turn;
      // Without a slide clip, squash down instead.
      const sq = mode === 'slide' && !actions.slide ? 0.5 : 1;
      squash = lerp(squash, sq, k);
      model.scale.y = SCALE * squash;
      if (stumbleT > 0) {
        stumbleT -= dt;
        body.rotation.z = Math.sin(stumbleT * 40) * stumbleT * 1.2;
      } else body.rotation.z = lerp(body.rotation.z, 0, k);
      body.position.y = jumpY + (pose === 'jump' && jumpY > 0.05 ? JUMP_TUCK : 0) + (mode === 'cheer' && !actions.cheer ? Math.abs(Math.sin(t * 7)) * 0.35 : 0);
      const s = Math.max(0.35, 1 - jumpY * 0.3);
      shadow.scale.set(s, 1, s);
      shadow.material.opacity = 0.2 * s;

      if (gun.visible) placeGun();
    },
  };
}

// A quick spin used by the shop preview.
export function spin(obj, dt, rate = 0.6) { obj.rotation.y = (obj.rotation.y + dt * rate) % TAU; }
