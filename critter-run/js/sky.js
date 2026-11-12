// The sky: a soft gradient with a glowing sun and a layer of drifting cumulus clouds drawn in the sky shader,
// plus distant ridges (mountains, hills, dunes, tree lines or sea) that fade into the haze.
import * as THREE from 'three';
import { SimplexNoise } from 'three/addons';
import { rng } from './gfx.js';

export const SUN_DIR = new THREE.Vector3(-0.21, 0.24, -0.95).normalize();
const TAU = Math.PI * 2;

// A tileable cloud-noise texture: a few octaves of 4D simplex noise wrapped around a torus so it repeats seamlessly.
export const cloudTex = (() => {
  const N = 256, data = new Uint8Array(N * N), sn = new SimplexNoise({ random: rng(99) });
  for (let y = 0; y < N; y++) {
    const b = (y / N) * TAU, cb = Math.cos(b), sb = Math.sin(b);
    for (let x = 0; x < N; x++) {
      const a = (x / N) * TAU, ca = Math.cos(a), sa = Math.sin(a);
      let v = 0, amp = 0.55, f = 1.1;
      for (let o = 0; o < 4; o++) { v += amp * sn.noise4d(ca * f, sa * f, cb * f, sb * f); amp *= 0.5; f *= 2.05; }
      data[y * N + x] = Math.max(0, Math.min(255, Math.round((v * 0.62 + 0.5) * 255)));
    }
  }
  const t = new THREE.DataTexture(data, N, N, THREE.RedFormat, THREE.UnsignedByteType);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.magFilter = THREE.LinearFilter;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.generateMipmaps = true;
  t.needsUpdate = true;
  return t;
})();

const skyU = {
  top: { value: new THREE.Color() }, bottom: { value: new THREE.Color() }, ground: { value: new THREE.Color() },
  sunDir: { value: SUN_DIR }, sunCol: { value: new THREE.Color('#fff0c4') }, tCloud: { value: cloudTex },
  uTime: { value: 0 }, uCloud: { value: 0.5 },
};
const skyShader = forEnv => new THREE.ShaderMaterial({
  uniforms: forEnv ? { ...skyU, top: { value: new THREE.Color() }, bottom: { value: new THREE.Color() }, ground: { value: new THREE.Color() } } : skyU,
  defines: forEnv ? { ENV: 1 } : {},
  vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
  fragmentShader: `uniform vec3 top;
uniform vec3 bottom;
uniform vec3 ground;
uniform vec3 sunDir;
uniform vec3 sunCol;
uniform sampler2D tCloud;
uniform float uTime;
uniform float uCloud;
varying vec3 vP;
float cl(vec2 uv) { return texture2D(tCloud, uv).r * 0.68 + texture2D(tCloud, uv * 2.6 + 0.31).r * 0.32; }
void main() {
  vec3 d = normalize(vP);
  float h = d.y;
  vec3 col = mix(bottom, top, pow(smoothstep(-0.03, 0.62, h), 0.75));
  // A bright band of haze right at the horizon.
  col = mix(col, bottom * 1.08, exp(-abs(h) * 16.0) * 0.55);
  float s = max(dot(d, sunDir), 0.0);
  col += sunCol * (pow(s, 1200.0) * 10.0 + pow(s, 80.0) * 0.5 + pow(s, 6.0) * 0.16);
#ifndef ENV
  if (h > 0.0 && uCloud > 0.0) {
    // Clouds live on a flat layer far overhead, so they shrink and crowd together toward the horizon.
    vec2 uv = d.xz / (h + 0.1) * 0.12 + vec2(uTime * 0.0016, uTime * 0.0007);
    float n = cl(uv);
    float edge = 0.8 - uCloud * 0.45;
    float c = smoothstep(edge, edge + 0.2, n);
    // Puffs are lit from the sun's side: if the cloud gets thicker toward the sun, this spot is in its shadow.
    float toward = cl(uv + sunDir.xz * 0.02);
    float lit = clamp(0.75 - (toward - n) * 4.0 + (n - edge) * 0.9, 0.0, 1.0);
    vec3 shadeCol = mix(top, vec3(0.62, 0.68, 0.8), 0.6);
    vec3 cloudCol = mix(shadeCol, vec3(1.0, 0.99, 0.96), lit) + sunCol * pow(s, 10.0) * 0.45;
    col = mix(col, cloudCol, c * smoothstep(0.015, 0.22, h) * 0.97);
  }
#endif
#ifdef ENV
  col = mix(col, ground, smoothstep(0.0, -0.25, h));
#endif
  gl_FragColor = vec4(col, 1.0);
  #include <colorspace_fragment>
}`,
  side: THREE.BackSide, depthWrite: false, fog: false,
});
export const skyMat = skyShader(false);
export const envSkyMat = skyShader(true);

// ---------- distant ridges ----------
// Ridges fade into the horizon haze toward their base and toward the back, which gives the scene real depth.
export const hazeU = { value: new THREE.Color() };
const ridgeMat = (color, amp, back, snow) => new THREE.ShaderMaterial({
  uniforms: { color: { value: new THREE.Color(color) }, haze: hazeU, amp: { value: amp }, back: { value: back }, snow: { value: snow }, tCloud: { value: cloudTex } },
  vertexShader: 'varying vec2 vXY; void main(){ vXY = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
  fragmentShader: `uniform vec3 color;
uniform vec3 haze;
uniform float amp;
uniform float back;
uniform float snow;
uniform sampler2D tCloud;
varying vec2 vXY;
void main() {
  float t = clamp(vXY.y / amp, 0.0, 1.0);
  // Streaky gullies down the slopes and a ragged snow line.
  float n = texture2D(tCloud, vXY * vec2(0.0035, 0.016)).r;
  float m = texture2D(tCloud, vXY * vec2(0.011, 0.004) + 0.5).r;
  vec3 c = mix(color * 0.72, color * 1.1, t) * (0.8 + 0.36 * n) * (0.92 + 0.16 * m);
  float line = 0.6 + (n - 0.5) * 0.3;
  c = mix(c, vec3(0.94, 0.96, 1.0) * (0.85 + 0.2 * m), snow * smoothstep(line, line + 0.05, t));
  c = mix(c, haze, back + (1.0 - back) * 0.55 * (1.0 - smoothstep(-0.2, 0.55, t)));
  gl_FragColor = vec4(c, 1.0);
  #include <colorspace_fragment>
}`,
  fog: false,
});

const ridgeNoise = new SimplexNoise({ random: rng(7) });
function ridgeGeometry(style, amp, seed) {
  const r = rng(seed);
  const W = 1400, N = 220, pts = [];
  const s1 = r() * 100, s2 = r() * 100;
  const fbm = (x, f) => ridgeNoise.noise(x * f + s1, s2) * 0.6 + ridgeNoise.noise(x * f * 2.3 + s2, s1) * 0.28 + ridgeNoise.noise(x * f * 5.1, s1 + s2) * 0.12;
  for (let i = 0; i <= N; i++) {
    const x = -W / 2 + (W * i) / N;
    let y;
    if (style === 'peaks') y = amp * (0.3 + 0.7 * Math.pow(1 - Math.abs(fbm(x, 0.0045)), 1.8));
    else if (style === 'rolling') y = amp * (0.5 + 0.35 * fbm(x, 0.004) + 0.1 * fbm(x, 0.02));
    else if (style === 'dunes') y = amp * (0.35 + 0.45 * Math.abs(Math.sin(x * 0.012 + s1)) + 0.12 * fbm(x, 0.02));
    else if (style === 'trees') y = amp * (0.62 + 0.18 * fbm(x, 0.01) + 0.2 * Math.abs(fbm(x, 0.09)));
    else if (style === 'flat') y = amp * (0.3 + 0.25 * fbm(x, 0.006) + 0.35 * Math.max(0, fbm(x, 0.05)));
    else y = amp * (Math.sin(x * 0.01 + s1) > 0.92 ? 1 : 0.05);
    pts.push(new THREE.Vector2(x, y));
  }
  const shape = new THREE.Shape();
  shape.moveTo(-W / 2, -120);
  pts.forEach(p => shape.lineTo(p.x, p.y));
  shape.lineTo(W / 2, -120);
  return new THREE.ShapeGeometry(shape);
}

// backdrop: { style, colors: [near..far], amp: [...] }, clouds: coverage 0..1
export class Backdrop {
  constructor(scene) {
    this.group = new THREE.Group();
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(800, 48, 24), skyMat);
    this.sky.renderOrder = -10;
    this.sky.frustumCulled = false;
    scene.add(this.sky);
    scene.add(this.group);
    this.layers = [];
    this.key = null;
    this.cloudTarget = 0.5;
  }
  set(key, bd, clouds = 0.5) {
    this.cloudTarget = clouds;
    if (this.key === key) return;
    this.key = key;
    this.layers.forEach(l => { this.group.remove(l); l.geometry.dispose(); l.material.dispose(); });
    const n = bd.colors.length;
    this.layers = bd.colors.map((c, i) => {
      const m = new THREE.Mesh(
        ridgeGeometry(bd.style, bd.amp[i], i * 17 + key.length * 31),
        ridgeMat(c, bd.amp[i], (i / Math.max(1, n - 1)) * 0.45, bd.style === 'peaks' && i < 2 ? 1 : 0),
      );
      m.position.set(0, -10 - i * 2, -330 - i * 45);
      m.renderOrder = -5 - i;
      return m;
    });
    // Draw far layers first.
    [...this.layers].reverse().forEach(l => this.group.add(l));
  }
  colors(top, bottom) {
    skyU.top.value.copy(top);
    skyU.bottom.value.copy(bottom);
    hazeU.value.copy(bottom);
  }
  update(camera, dt) {
    skyU.uTime.value += dt;
    skyU.uCloud.value += (this.cloudTarget - skyU.uCloud.value) * Math.min(1, dt);
    this.sky.position.copy(camera.position);
    this.group.position.set(camera.position.x * 0.9, camera.position.y * 0.5, camera.position.z);
  }
}
