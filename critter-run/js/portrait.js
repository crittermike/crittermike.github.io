// Shop portraits: renders a model (a runner or a blaster) into a small picture, like the character cards in a
// console game's store. Rendered once per item and cached as an image URL.
import * as THREE from 'three';

const studio = new THREE.Scene();
const key = new THREE.DirectionalLight('#fff4e0', 3.2);
key.position.set(2, 3, 4);
const rim = new THREE.DirectionalLight('#b9dcff', 2.4);
rim.position.set(-3, 2, -3);
studio.add(new THREE.HemisphereLight('#ffffff', '#8a7a6a', 1.6), key, rim);
const cam = new THREE.PerspectiveCamera(28, 1, 0.05, 100);
const _box = new THREE.Box3(), _c = new THREE.Vector3(), _s = new THREE.Vector3();

// view: { yaw, pitch, fill (0..1 of the frame the model should fill), focus (0..1 height to center on, for faces) }
export function renderPortrait(renderer, object, { size = 256, yaw = 0.5, pitch = 0.12, fill = 0.86, focus = 0.5, env = null } = {}) {
  const parent = object.parent, saved = { p: object.position.clone(), r: object.rotation.clone() };
  studio.add(object);
  object.position.set(0, 0, 0);
  object.updateMatrixWorld(true);
  _box.setFromObject(object);
  _box.getCenter(_c);
  _box.getSize(_s);
  _c.y = _box.min.y + _s.y * focus;
  const radius = Math.max(_s.x, _s.y, _s.z) * 0.5 / fill;
  const dist = radius / Math.tan(THREE.MathUtils.degToRad(cam.fov / 2));
  cam.position.set(_c.x + Math.sin(yaw) * Math.cos(pitch) * dist, _c.y + Math.sin(pitch) * dist, _c.z + Math.cos(yaw) * Math.cos(pitch) * dist);
  cam.lookAt(_c);
  cam.updateProjectionMatrix();
  studio.environment = env;

  const rt = new THREE.WebGLRenderTarget(size, size, { samples: 4 });
  rt.texture.colorSpace = THREE.SRGBColorSpace;
  const prev = renderer.getRenderTarget(), prevColor = renderer.getClearColor(new THREE.Color()), prevAlpha = renderer.getClearAlpha();
  renderer.setRenderTarget(rt);
  renderer.setClearColor(0x000000, 0);
  renderer.clear();
  renderer.render(studio, cam);
  const px = new Uint8Array(size * size * 4);
  renderer.readRenderTargetPixels(rt, 0, 0, size, size, px);
  renderer.setRenderTarget(prev);
  renderer.setClearColor(prevColor, prevAlpha);
  rt.dispose();

  studio.remove(object);
  if (parent) parent.add(object);
  object.position.copy(saved.p);
  object.rotation.copy(saved.r);

  // Pixels come out bottom row first.
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d'), img = ctx.createImageData(size, size), row = size * 4;
  for (let y = 0; y < size; y++) img.data.set(px.subarray((size - 1 - y) * row, (size - y) * row), y * row);
  ctx.putImageData(img, 0, 0);
  return c.toDataURL('image/png');
}
