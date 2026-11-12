// Post-processing: soft bloom on glowing things, a gentle color grade, a vignette, and full-screen flashes.
// Three quality tiers keep it smooth on older tablets: the low tier skips post-processing entirely.
import * as THREE from 'three';
import { EffectComposer, RenderPass, UnrealBloomPass, OutputPass } from 'three/addons';

export const TIERS = {
  high: { ratio: 2, post: true, bloomScale: 1, shadow: 2048, grass: 1 },
  mid: { ratio: 1.35, post: true, bloomScale: 0.5, shadow: 1024, grass: 0.6 },
  low: { ratio: 1, post: false, bloomScale: 0, shadow: 512, grass: 0 },
};

export class Post {
  constructor(renderer, scene, camera) {
    this.renderer = renderer;
    this.scene = scene;
    this.camera = camera;
    this.tierName = null;
    this.size = [1, 1];
    this.flashAmt = 0;
    this.uniforms = {
      uSat: { value: 1.12 },
      uVig: { value: 0.55 },
      uFlash: { value: 0 },
      uFlashCol: { value: new THREE.Color('#ffffff') },
    };
  }

  build() {
    if (this.composer) return;
    const rt = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 });
    this.composer = new EffectComposer(this.renderer, rt);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    // The threshold sits above sunlit sand and white paint, so only truly glowing things bloom.
    this.bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.5, 0.55, 1.2);
    const setBloomSize = this.bloom.setSize.bind(this.bloom);
    this.bloom.setSize = (w, h) => setBloomSize(Math.max(1, Math.round(w * this.bloomScale)), Math.max(1, Math.round(h * this.bloomScale)));
    this.composer.addPass(this.bloom);
    this.output = new OutputPass();
    Object.assign(this.output.uniforms, this.uniforms);
    // Grade after tone mapping and before the sRGB transfer, so the numbers behave like normal 0..1 colors.
    this.output.material.fragmentShader = this.output.material.fragmentShader
      .replace('varying vec2 vUv;', `varying vec2 vUv;
        uniform float uSat;
        uniform float uVig;
        uniform float uFlash;
        uniform vec3 uFlashCol;`)
      .replace('// color space', `
        float lum = dot(gl_FragColor.rgb, vec3(0.2126, 0.7152, 0.0722));
        gl_FragColor.rgb = max(mix(vec3(lum), gl_FragColor.rgb, uSat), 0.0);
        vec2 vq = vUv - 0.5;
        gl_FragColor.rgb *= 1.0 - dot(vq, vq) * uVig;
        gl_FragColor.rgb = mix(gl_FragColor.rgb, uFlashCol, uFlash);
        // color space`);
    this.output.material.needsUpdate = true;
    this.composer.addPass(this.output);
  }

  setTier(name) {
    if (this.tierName === name) return;
    this.tierName = name;
    this.tier = TIERS[name];
    this.bloomScale = this.tier.bloomScale;
    if (this.tier.post) this.build();
    if (this.bloom) this.bloom.enabled = this.tier.bloomScale > 0;
    this.applySize();
  }

  get pixelRatio() { return Math.min(window.devicePixelRatio || 1, this.tier.ratio); }

  setSize(w, h) {
    this.size = [w, h];
    this.applySize();
  }
  applySize() {
    if (!this.tier) return;
    const [w, h] = this.size;
    const pr = this.pixelRatio;
    this.renderer.setPixelRatio(pr);
    this.renderer.setSize(w, h);
    if (this.composer) {
      this.composer.setPixelRatio(pr);
      this.composer.setSize(w, h);
    }
  }

  flash(color = '#ffffff', amount = 0.6) {
    this.uniforms.uFlashCol.value.set(color);
    this.flashAmt = Math.max(this.flashAmt, amount);
  }

  render(dt) {
    this.flashAmt = Math.max(0, this.flashAmt - dt * 2.4);
    this.uniforms.uFlash.value = this.flashAmt;
    if (this.tier.post) this.composer.render(dt);
    else this.renderer.render(this.scene, this.camera);
  }
}
