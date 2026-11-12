// The animated chasers, loaded from assets/chasers/<id>.glb (see assets/CREDITS.md). Every chaser faces -z
// (the running direction) and answers animate(mode, dt, t) with mode: run | idle | roar | attack.
import * as THREE from 'three';
import { cloneSkinned } from 'three/addons';
import { gltfLoader } from './props.js';
import { bend, waterMaterial } from './gfx.js';

export function blobShadow(r = 0.55) {
  const m = new THREE.Mesh(
    new THREE.CircleGeometry(r, 24).rotateX(-Math.PI / 2),
    bend(new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.18, depthWrite: false }), { key: 'blob' }),
  );
  m.position.y = 0.03;
  m.renderOrder = 1;
  m.frustumCulled = false;
  return m;
}

// len/height: target size in meters (they're drawn a little bigger than life, for drama).
// clips: game mode -> clip name. rate: run-cycle speed at the base running speed.
const CHASERS = {
  bear: { len: 2.8, clips: { run: 'Run', idle: 'Idle', attack: 'Attack', roar: 'Attack' }, rate: 1.05, tint: { 'Brown fur': '#2e241e', 'Tan fur': '#b48c63' } },
  wolf: { len: 2.7, clips: { run: 'Gallop', idle: 'Idle', attack: 'Attack', roar: 'Attack' }, rate: 1.0, tint: { Main: '#6d6a66', Main_Light: '#c9c2b6' } },
  scorpion: { len: 2.9, clips: { run: 'Run', idle: 'Idle', attack: 'Attack', roar: 'Attack' }, rate: 0.9 },
  boar: { len: 2.6, clips: { run: 'Run', idle: 'Idle', attack: 'Attack', roar: 'Attack' }, rate: 0.95 },
  gator: { len: 4.4, clips: { run: 'Run', idle: 'Idle', attack: 'Attack', roar: 'Attack' }, rate: 1.0 },
  shark: { len: 4.2, clips: { run: 'Swim_Fast', idle: 'Swim', attack: 'Swim_Bite', roar: 'Swim_Bite' }, rate: 1.2, y: -0.55, wake: true },
  hurricane: { height: 6.5, clips: { run: 'Spin', idle: 'Spin', attack: 'Attack', roar: 'Attack' }, rate: 1.0, keepMaterials: true },
};
const LOOP_ONCE = new Set();
const cache = new Map();

export function loadChaser(type) {
  if (!cache.has(type)) cache.set(type, gltfLoader.loadAsync(`./assets/chasers/${type}.glb`).catch(e => { cache.delete(type); throw e; }));
  return cache.get(type).then(gltf => buildChaser(type, gltf));
}

function buildChaser(type, gltf) {
  const def = CHASERS[type];
  const model = cloneSkinned(gltf.scene);
  model.traverse(o => {
    if (!o.isMesh) return;
    const mats = [].concat(o.material).map(m => {
      const c = m.clone();
      if (def.tint && def.tint[c.name]) c.color.set(def.tint[c.name]);
      if (!def.keepMaterials) { c.metalness = 0; c.roughness = Math.max(0.55, c.roughness); }
      return bend(c, { rim: 0.45, key: 'chaser' });
    });
    o.material = Array.isArray(o.material) ? mats : mats[0];
    o.castShadow = true;
    o.receiveShadow = false;
    o.frustumCulled = false;
  });
  model.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(model);
  const size = box.getSize(new THREE.Vector3());
  const k = def.height ? def.height / size.y : def.len / Math.max(size.z, size.x);
  model.scale.multiplyScalar(k);
  model.position.set(-(box.min.x + box.max.x) / 2 * k, -box.min.y * k + (def.y || 0), -(box.min.z + box.max.z) / 2 * k);
  const pivot = new THREE.Group();
  pivot.rotation.y = Math.PI; // models face +z; chasers run toward -z
  pivot.add(model);

  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  body.add(pivot);
  root.add(blobShadow(Math.max(size.x, size.z) * k * 0.32));
  if (def.wake) root.add(wake(size.x * k));

  const mixer = new THREE.AnimationMixer(model);
  const actions = {};
  for (const [mode, name] of Object.entries(def.clips)) {
    const clip = THREE.AnimationClip.findByName(gltf.animations, name);
    if (!clip) continue;
    const a = mixer.clipAction(clip);
    if (LOOP_ONCE.has(mode)) { a.setLoop(THREE.LoopOnce, 1); a.clampWhenFinished = true; }
    actions[mode] = a;
  }
  let cur = null, curMode = '';
  const play = mode => {
    if (mode === curMode) return;
    const a = actions[mode] || actions.run;
    curMode = mode;
    if (a === cur) return;
    a.reset().setEffectiveWeight(1).fadeIn(0.18).play();
    if (cur) cur.fadeOut(0.18);
    cur = a;
  };
  return {
    root, body, type,
    height: size.y * k + (def.y || 0), length: Math.max(size.z, size.x) * k,
    animate(mode, dt) {
      play(mode);
      if (cur) cur.timeScale = mode === 'run' ? def.rate * 1.15 : 1;
      mixer.update(dt);
    },
  };
}

// The shark swims inside a patch of churning surf that follows it along the beach.
function wake(width) {
  const g = new THREE.Group();
  const geo = new THREE.CircleGeometry(1, 40).rotateX(-Math.PI / 2);
  const col = new Float32Array(geo.attributes.position.count * 3);
  for (let i = 0; i < geo.attributes.position.count; i++) {
    const r = Math.hypot(geo.attributes.position.getX(i), geo.attributes.position.getZ(i));
    col.set([0.6, r > 0.85 ? 1 : 0.25, 0], i * 3);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const m = new THREE.Mesh(geo, waterMaterial({ deep: '#1677b5', shallow: '#48d1dc', opacity: 0.9, ripple: 1.6, speed: 2.2, foam: 1.6 }));
  m.scale.set(width * 1.3, 1, width * 2.4);
  m.position.y = 0.05;
  m.renderOrder = 2;
  m.frustumCulled = false;
  g.add(m);
  return g;
}
