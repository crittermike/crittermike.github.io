// Small pictures of the runners and blasters for the shop, rendered once from the real models with a tiny
// separate renderer, then kept as images.
import * as THREE from 'three';
import { U } from './gfx.js';
import { loadRunner, loadBlasters } from './actors.js';
import { RUNNERS, WEAPONS } from './items.js';

const SIZE = 160;
const urls = new Map(); // 'runners:kid' -> data URL
let jobs = null;

export const thumb = (tab, id) => urls.get(`${tab}:${id}`) || null;

function stage() {
  const canvas = document.createElement('canvas');
  const r = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, preserveDrawingBuffer: true });
  r.setPixelRatio(1);
  r.setSize(SIZE, SIZE, false);
  r.toneMapping = THREE.NeutralToneMapping;
  r.setClearColor(0x000000, 0);
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight('#ffffff', '#7f8fa8', 2.4));
  const key = new THREE.DirectionalLight('#fff4e0', 2.6);
  key.position.set(-2, 4, -5);
  scene.add(key);
  const rim = new THREE.DirectionalLight('#bfe4ff', 1.6);
  rim.position.set(3, 2, 4);
  scene.add(rim);
  const cam = new THREE.PerspectiveCamera(28, 1, 0.05, 50);
  return { r, scene, cam };
}

// top: the share of the model's height to show, from the top down (1 shows all of it).
function snap(st, obj, fit, top = 1) {
  st.scene.add(obj);
  obj.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(obj, true);
  box.min.y = box.max.y - (box.max.y - box.min.y) * top;
  const c = box.getCenter(new THREE.Vector3()), s = box.getSize(new THREE.Vector3());
  const d = (Math.max(s.y, s.x * 0.9) * fit) / (2 * Math.tan(THREE.MathUtils.degToRad(st.cam.fov / 2)));
  st.cam.position.set(c.x + d * 0.35, c.y + d * 0.12, c.z - d);
  st.cam.lookAt(c);
  const bend = U.uBend.value;
  U.uBend.value = 0;
  st.r.render(st.scene, st.cam);
  U.uBend.value = bend;
  st.scene.remove(obj);
  return st.r.domElement.toDataURL('image/png');
}

// Renders every runner and blaster once. onEach(tab, id) runs as each picture is ready.
export function makeThumbs(onEach) {
  if (jobs) return jobs;
  jobs = (async () => {
    const st = stage();
    try {
      for (const def of RUNNERS) {
        try {
          const runner = await loadRunner(def);
          runner.root.remove(runner.shadow);
          runner.animate('idle', 0.4, { t: 0 });
          urls.set(`runners:${def.id}`, snap(st, runner.root, 1.0, 0.55));
          onEach('runners', def.id);
        } catch (e) { console.warn('Thumbnail failed', def.id, e); }
      }
      const set = await loadBlasters().catch(() => null);
      if (set) for (const w of WEAPONS) {
        if (!set[w.id]) continue;
        const g = set[w.id].clone();
        g.rotation.set(0, -2.2, 0);
        urls.set(`weapons:${w.id}`, snap(st, g, 1.25));
        onEach('weapons', w.id);
      }
    } finally {
      st.r.dispose();
      st.r.forceContextLoss();
    }
  })();
  return jobs;
}
