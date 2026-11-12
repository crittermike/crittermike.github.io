// The chasers: real animated animals (GLB files in assets/chasers, see assets/CREDITS.md) and a storm-cloud
// hurricane made from swirling cloud shaders. A chaser has the same interface as the old voxel ones in models.js:
// { root, animate(mode, dt, t), height, length } where mode is run | idle | roar | attack.
import * as THREE from 'three';
import { GLTFLoader, MeshoptDecoder, cloneSkinned } from 'three/addons';
import { bend } from './gfx.js';
import { blobShadow } from './models.js';
import { cloudTex } from './sky.js';

const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
const files = new Map();
const load = url => {
  if (!files.has(url)) files.set(url, loader.loadAsync(url).catch(e => { files.delete(url); throw e; }));
  return files.get(url);
};

// length: nose-to-tail size in meters once loaded. yaw turns the model to face the way it runs (-z).
// clips: game pose -> clip name (missing ones are matched by name). speed: run-cycle playback rate at full chase.
export const CHASER_DEFS = {
  bear: { url: 'bear', length: 2.8, yaw: Math.PI, clips: {}, speed: 1.15 },
  wolf: { url: 'wolf', length: 2.4, yaw: Math.PI, clips: {}, speed: 1.1 },
  spider: { url: 'spider', length: 3.0, yaw: Math.PI, clips: {}, speed: 1.3 },
  // The hog model has no tusks of its own, so it gets a pair on its head bone.
  boar: { url: 'boar', length: 2.4, yaw: Math.PI, clips: {}, speed: 1.2, tusks: 'head_27' },
  gator: { url: 'gator', length: 4.8, yaw: Math.PI, clips: {}, speed: 1.4 },
  shark: { url: 'shark', length: 4.6, yaw: Math.PI, clips: {}, speed: 1.6, swim: true },
};
const GUESS = {
  run: [/^run$/i, /gallop/i, /run(?!.*attack)/i, /swim.*fast/i, /swim/i, /charge/i, /walk/i],
  idle: [/^idle$/i, /idle/i, /stand/i, /swim/i],
  attack: [/^attack$/i, /bite/i, /attack/i, /sting/i, /swipe/i, /strike/i],
  roar: [/roar/i, /howl/i, /growl/i, /hiss/i, /attack/i, /bite/i],
};
function pick(clips, pose, wanted) {
  if (wanted) return clips.find(c => c.name === wanted) || null;
  for (const re of GUESS[pose]) { const c = clips.find(c => re.test(c.name)); if (c) return c; }
  return null;
}

export async function loadChaser(type) {
  const def = CHASER_DEFS[type];
  if (!def) throw new Error('No model for ' + type);
  const g = await load(`./assets/chasers/${def.url}.glb`);
  return buildAnimal(type, def, g);
}

function buildAnimal(type, def, gltf) {
  const model = cloneSkinned(gltf.scene);
  model.traverse(o => {
    if (!o.isMesh) return;
    o.material = [].concat(o.material).map(m => bend(m.clone(), { rim: 0.35 }))[0];
    o.castShadow = true;
    o.receiveShadow = false;
    o.frustumCulled = false;
  });
  model.rotation.y = def.yaw;
  model.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(model), size = box.getSize(new THREE.Vector3());
  const k = def.length / Math.max(0.01, size.x, size.z);
  model.scale.multiplyScalar(k);
  model.updateMatrixWorld(true);
  box.setFromObject(model);
  model.position.set(-(box.min.x + box.max.x) / 2, -box.min.y + (def.y || 0), -(box.min.z + box.max.z) / 2);

  const root = new THREE.Group(), body = new THREE.Group();
  root.add(body);
  body.add(model);
  if (def.tusks) addTusks(model, model.getObjectByName(def.tusks), box, def.length);
  const shadow = blobShadow(def.length * 0.32);
  shadow.scale.z = 2.2;
  root.add(shadow);

  const mixer = new THREE.AnimationMixer(model);
  const actions = {};
  for (const pose of ['run', 'idle', 'attack', 'roar']) {
    const clip = pick(gltf.animations, pose, def.clips[pose]);
    if (clip) actions[pose] = mixer.clipAction(clip);
  }
  let cur = null, curPose = '';
  const play = pose => {
    if (pose === curPose) return;
    curPose = pose;
    const a = actions[pose] || actions.run || actions.idle;
    if (!a || a === cur) return;
    a.reset().setEffectiveWeight(1).fadeIn(0.25).play();
    if (cur) cur.fadeOut(0.25);
    cur = a;
  };
  return {
    root, body, gltf: true, type,
    height: box.max.y - box.min.y, length: def.length,
    animate(mode, dt, t) {
      play(mode);
      if (cur) cur.timeScale = mode === 'run' ? def.speed : mode === 'attack' || mode === 'roar' ? 1.2 : 1;
      mixer.update(dt);
      // A lunge forward on attack, and a rear-up on roar, on top of whatever the clip does.
      const lunge = mode === 'attack' ? Math.max(0, Math.sin(t * 6)) * 0.35 : 0;
      body.position.z = THREE.MathUtils.lerp(body.position.z, -lunge, Math.min(1, dt * 10));
      body.rotation.x = THREE.MathUtils.lerp(body.rotation.x, mode === 'roar' && !actions.roar ? 0.25 : 0, Math.min(1, dt * 6));
    },
  };
}

// Two ivory tusks curving up from the snout, attached to the head bone so they follow every bite.
const tuskGeo = new THREE.ConeGeometry(0.045, 0.26, 12).translate(0, 0.13, 0);
const tuskMat = bend(new THREE.MeshStandardMaterial({ color: '#f4ecd6', roughness: 0.35 }), { rim: 0.3 });
function addTusks(model, head, box, len) {
  if (!head) return;
  const h = box.max.y - box.min.y;
  for (const s of [-1, 1]) {
    const t = new THREE.Mesh(tuskGeo, tuskMat);
    t.position.set(s * len * 0.05, box.min.y + h * 0.36, box.min.z + len * 0.08);
    t.rotation.set(-1.15, 0, s * -0.45);
    t.castShadow = true;
    t.frustumCulled = false;
    model.add(t);
    model.updateMatrixWorld(true);
    head.attach(t);
  }
}

// ---------- hurricane ----------
// A funnel of stacked, open cones with swirling cloud texture, debris whirling around it, and two angry eyes.
const funnelMat = (shade, alpha) => new THREE.ShaderMaterial({
  uniforms: { tCloud: { value: cloudTex }, uTime: { value: 0 }, uShade: { value: new THREE.Color(shade) }, uAlpha: { value: alpha }, uSpin: { value: 1 }, uNear: { value: 0 } },
  vertexShader: `varying vec2 vUv; varying float vRim; varying vec4 vClip;
    void main() {
      vUv = uv;
      vec4 mv = modelViewMatrix * vec4(position, 1.0);
      vec3 n = normalize(normalMatrix * normal);
      vRim = 1.0 - abs(dot(n, normalize(-mv.xyz)));
      gl_Position = projectionMatrix * mv;
      vClip = gl_Position;
    }`,
  fragmentShader: `uniform sampler2D tCloud; uniform float uTime; uniform vec3 uShade; uniform float uAlpha; uniform float uSpin; uniform float uNear;
    varying vec2 vUv; varying float vRim; varying vec4 vClip;
    void main() {
      vec2 p = vec2(vUv.x * 3.0 + uTime * 0.55 * uSpin + vUv.y * 0.8, vUv.y * 1.6 - uTime * 0.12);
      float n = texture2D(tCloud, p).r * 0.65 + texture2D(tCloud, p * 2.7 + 0.4).r * 0.35;
      float a = smoothstep(0.32, 0.72, n) * uAlpha * (0.45 + 0.55 * vRim) * smoothstep(0.0, 0.12, vUv.y) * smoothstep(1.0, 0.85, vUv.y);
      // uNear opens a clear window around the runner and the trail ahead (the middle of the screen).
      float hole = smoothstep(0.55, 1.05, length((vClip.xy / vClip.w - vec2(0.0, -0.2)) / vec2(0.62, 0.7)));
      a *= mix(1.0, 0.1 + 0.9 * hole, uNear);
      vec3 c = mix(uShade * 0.62, uShade, n);
      gl_FragColor = vec4(c, a);
      #include <colorspace_fragment>
    }`,
  transparent: true, depthWrite: false, side: THREE.DoubleSide,
});

export function makeHurricane() {
  const root = new THREE.Group(), body = new THREE.Group();
  root.add(body);
  const layers = [];
  // Inner dark core, then lighter outer veils, each spinning at its own speed.
  [['#6f7c8c', 0.9, 0.35, 1.0], ['#aab6c4', 0.75, 0.75, 1.25], ['#e6edf4', 0.55, 1.15, 1.6]].forEach(([shade, alpha, grow, spin], i) => {
    const geo = new THREE.CylinderGeometry(2.4 + grow, 0.35 + grow * 0.3, 7, 40, 10, true);
    geo.translate(0, 3.5, 0);
    const m = new THREE.Mesh(geo, funnelMat(shade, alpha));
    m.material.uniforms.uSpin.value = spin;
    m.renderOrder = 3 + i;
    m.frustumCulled = false;
    body.add(m);
    layers.push(m);
  });
  // Dust skirt at the bottom.
  const skirt = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 2.6, 1.2, 40, 2, true).translate(0, 0.5, 0), funnelMat('#b9a98e', 0.8));
  skirt.renderOrder = 6;
  body.add(skirt);
  layers.push(skirt);
  // Debris: leaves and sticks caught in the wind.
  const debris = new THREE.InstancedMesh(new THREE.BoxGeometry(0.28, 0.05, 0.14), bend(new THREE.MeshStandardMaterial({ roughness: 0.9 })), 40);
  const colors = ['#5a7a2e', '#7a5232', '#9a8a3a', '#6b4a2b'].map(c => new THREE.Color(c));
  for (let i = 0; i < 40; i++) debris.setColorAt(i, colors[i % colors.length]);
  debris.frustumCulled = false;
  body.add(debris);
  const seeds = Array.from({ length: 40 }, (_, i) => ({ a: i * 2.4, h: (i * 0.173) % 1, r: 1.2 + ((i * 0.37) % 1) * 2.2, s: 2 + (i % 5) }));
  // Glowing eyes peering out of the funnel.
  const eyeMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 0.5, 0.25) });
  const eyes = new THREE.Group();
  for (const x of [-0.42, 0.42]) {
    const e = new THREE.Mesh(new THREE.SphereGeometry(0.2, 16, 12), eyeMat);
    e.scale.set(1.3, 0.75, 0.5);
    e.position.set(x, 0, 0);
    e.rotation.z = x > 0 ? 0.35 : -0.35;
    eyes.add(e);
  }
  eyes.position.set(0, 3.4, -2.1); // the chaser runs toward -z, so its face is on that side
  body.add(eyes);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e3 = new THREE.Euler(), p3 = new THREE.Vector3(), s3 = new THREE.Vector3(1, 1, 1);
  let time = 0;
  return {
    root, body, height: 6.5, length: 3,
    setNear(k) {
      for (const l of layers) l.material.uniforms.uNear.value = k;
      // Up close the eyes and debris would fill the screen, so only the swirling veil stays.
      eyes.visible = debris.visible = k < 0.5;
    },
    animate(mode, dt, t) {
      time += dt * (mode === 'roar' || mode === 'attack' ? 1.8 : 1);
      for (const l of layers) l.material.uniforms.uTime.value = time;
      body.rotation.z = Math.sin(t * 0.9) * 0.06;
      body.position.x = Math.sin(t * 1.3) * 0.25;
      seeds.forEach((sd, i) => {
        const a = sd.a + time * sd.s, h = ((sd.h + time * 0.15) % 1) * 6.5, r = sd.r * (0.4 + h / 6.5);
        q.setFromEuler(e3.set(time * 3 + i, time * 2, i));
        m4.compose(p3.set(Math.cos(a) * r, h, Math.sin(a) * r), q, s3);
        debris.setMatrixAt(i, m4);
      });
      debris.instanceMatrix.needsUpdate = true;
      eyes.scale.setScalar(mode === 'roar' ? 1.25 + Math.sin(t * 30) * 0.05 : 1);
      eyes.position.x = Math.sin(t * 1.3) * 0.1;
    },
  };
}
