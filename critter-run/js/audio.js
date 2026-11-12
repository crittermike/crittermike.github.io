// Real music and sampled sound. Music streams from MP3s through two <audio> elements that crossfade; effects, stingers,
// chaser roars, loops and announcer lines are short MP3s decoded into WebAudio buffers. Questions are read aloud with
// speechSynthesis.
const BASE = new URL('../assets/audio/', import.meta.url);
const musicUrl = file => new URL(`music/${file}.mp3`, BASE).href;
const sfxUrl = file => new URL(`sfx/${file}.mp3`, BASE).href;

// The music files sit around -16 LUFS. The effects are peak-normalized, so the volumes below even them out.
const MASTER = 0.9, MUSIC = 0.45, EFFECTS = 0.85, VOICE = 0.9;
const DUCK = 0.6, XFADE = 0.8, LOOP_FADE = 0.3;

// Music keys -> files in music/. The title, map and shop share the menu theme, which is also the fallback.
const TRACKS = {
  title: 'menu', map: 'menu', shop: 'menu', tour: 'tour',
  mountains: 'mountains', foothills: 'foothills', sandhills: 'sandhills', farmland: 'farmland', swamp: 'swamp', beach: 'beach',
};

// Effect name -> [file in sfx/, volume]. Quiet things (land, swoosh, click) sit under coins, crashes and roars.
const SFX = {
  coin: ['coin', 0.6], jump: ['jump', 0.55], land: ['land', 0.6], swoosh: ['swoosh', 0.6], slide: ['slide', 0.4],
  hit: ['hit', 1], heartLost: ['heart-lost', 0.9], heart: ['heart', 0.4], gate: ['gate', 1], crate: ['crate', 1],
  correct: ['correct', 0.8], wrong: ['wrong', 0.5], whoosh: ['whoosh', 0.7], bite: ['bite', 1],
  smash: ['smash', 1], smashRock: ['smash-rock', 1], click: ['click', 0.9], go: ['go', 0.45],
  powerOn: ['power-on', 0.7], powerOff: ['power-off', 0.7], shieldHit: ['shield-hit', 0.8], jet: ['jet', 0.55],
  zap: ['zap', 0.85], splash: ['splash', 1], splat: ['splat', 1], fire: ['fire', 0.75], freeze: ['freeze', 0.8],
  shatter: ['shatter', 1], rocket: ['rocket', 0.6], boom: ['boom', 0.6], meteor: ['meteor', 0.65],
  meteorBoom: ['meteor-boom', 0.8], rainbow: ['rainbow', 0.65], buy: ['buy', 0.85], equip: ['equip', 0.6], nope: ['nope', 0.15],
};
// UI sounds and tonal jingles keep their pitch. Everything else varies a little so repeats don't sound canned.
const STEADY = new Set(['click', 'equip', 'nope', 'buy', 'go', 'correct', 'wrong', 'heart', 'powerOn', 'powerOff', 'rainbow']);
// Older effect names that now play a stinger.
const ALIAS = { fanfare: 'win', caught: 'lose', star: 'star' };
const STINGERS = { win: ['win', 1], lose: ['lose', 0.9], powerup: ['powerup', 0.7], star: ['star', 0.6] };
// Chaser calls as [file, volume, delay] layers. Unknown types get the generic monster growl.
const ROARS = {
  roar: [['roar', 1]],
  bear: [['bear', 0.7]],
  wolf: [['wolf', 1]],
  spider: [['hiss', 0.7]],
  boar: [['boar', 1]],
  gator: [['gator', 1]],
  shark: [['shark-splash', 0.9], ['shark-chomp', 0.6, 0.45]],
  hurricane: [['hurricane', 0.9]],
};
// Seamless loops: [file, volume, loop length in seconds].
const LOOPS = { jetpack: ['loop-jetpack', 0.5, 5], magnet: ['loop-magnet', 0.25, 5], wind: ['loop-wind', 0.3, 6] };
const VOICES = {
  ready: 'voice-ready', go: 'voice-go', powerUp: 'voice-power-up', youWin: 'voice-you-win',
  congratulations: 'voice-congratulations', correct: 'voice-correct', gameOver: 'voice-game-over', finalRound: 'voice-final-round',
};
const FILES = [...new Set([
  ...Object.values(SFX), ...Object.values(STINGERS), ...Object.values(ROARS).flat(), ...Object.values(LOOPS),
].map(s => s[0]).concat(Object.values(VOICES)))];

const COIN_STEPS = [0, 1, 2, 3, 4, 5, 6, 7];
const STAR_STEPS = [0, 4, 7, 12];
const jitter = () => 1 + (Math.random() * 2 - 1) * 0.03;

function ramp(param, to, t, sec) {
  param.cancelScheduledValues(t);
  param.setValueAtTime(param.value, t);
  param.linearRampToValueAtTime(to, t + sec);
}

// A decoder that ignores the MP3 gapless header keeps the encoder padding, which would put a gap in the loop.
// In that case the loop starts after the leading silence.
function loopStart(b, len) {
  if (b.duration - len < 0.01) return 0;
  const d = b.getChannelData(0), max = Math.min(d.length, Math.round(b.sampleRate * 0.06));
  let i = 0;
  while (i < max && Math.abs(d[i]) < 1e-4) i++;
  return i < max ? i / b.sampleRate : 0;
}

// ---------- speech ----------
const synth = typeof window !== 'undefined' && 'speechSynthesis' in window ? window.speechSynthesis : null;
let voice = null;
function pickVoice() {
  const vs = synth.getVoices();
  voice = vs.find(v => /Samantha/.test(v.name)) || vs.find(v => /Google US English/.test(v.name))
    || vs.find(v => /^en[-_]US/i.test(v.lang) && v.localService) || vs.find(v => /^en[-_]US/i.test(v.lang))
    || vs.find(v => /^en/i.test(v.lang)) || null;
}
if (synth) { pickVoice(); synth.addEventListener?.('voiceschanged', pickVoice); }

export class Sound {
  constructor(settings) {
    this.settings = settings;
    this.ctx = null;
    this.want = 'title';
    this.ducked = false;
    this.speechRun = 0;
    this.buf = {};
    this.loops = {};
    this.loopWant = {};
    this.streaks = {};
    this.roarEnd = 0;
    this.roarShots = [];
    // Samples download right away and are decoded once there is an AudioContext.
    this.data = new Map(FILES.map(f => [f, fetch(sfxUrl(f)).then(r => (r.ok ? r.arrayBuffer() : null)).catch(() => null)]));
    // Two <audio> elements take turns so tracks can crossfade.
    this.els = [0, 1].map(() => Object.assign(new Audio(), { loop: true, preload: 'auto' }));
    this.file = ['', ''];
    this.cur = -1;
    this.stopT = [0, 0];
    // Resolves once every sample has been decoded (after the first unlock).
    this.ready = new Promise(res => { this.readied = res; });
  }

  unlock() {
    if (!this.ctx) this.init();
    const c = this.ctx;
    if (c && c.state !== 'running') {
      Promise.resolve(c.resume?.()).catch(() => {});
      // Older iOS also wants a sound started inside the tap.
      const s = c.createBufferSource();
      s.buffer = c.createBuffer(1, 1, c.sampleRate);
      s.connect(c.destination);
      s.start();
    }
    // iOS only allows speech after a tap has spoken once.
    if (synth && !synth.speaking) { const u = new SpeechSynthesisUtterance(' '); u.volume = 0; synth.speak(u); }
    if (!c) return;
    this.bless();
    this.syncMusic();
  }

  init() {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const c = (this.ctx = new AC());
    // A fast limiter: it only catches pile-ups of loud effects (a crash, booms), so coins and music never pump.
    const comp = (this.comp = c.createDynamicsCompressor());
    comp.threshold.value = -6; comp.knee.value = 3; comp.ratio.value = 20; comp.attack.value = 0.001; comp.release.value = 0.15;
    comp.connect(c.destination);
    this.master = c.createGain(); this.master.gain.value = MASTER; this.master.connect(comp);
    this.musicBus = c.createGain(); this.musicBus.gain.value = this.musicLevel(); this.musicBus.connect(this.master);
    this.stingDuck = c.createGain(); this.stingDuck.connect(this.musicBus);
    this.musicFilter = c.createBiquadFilter(); this.musicFilter.type = 'lowpass';
    this.musicFilter.frequency.value = this.ducked ? 900 : 20000;
    this.musicFilter.connect(this.stingDuck);
    this.sfxBus = c.createGain(); this.sfxBus.gain.value = this.settings.sfx ? EFFECTS : 0; this.sfxBus.connect(this.master);
    this.elGain = this.els.map(el => {
      const g = c.createGain();
      g.gain.value = 0;
      c.createMediaElementSource(el).connect(g);
      g.connect(this.musicFilter);
      return g;
    });
    Promise.all(FILES.map(f => this.data.get(f)
      .then(data => data && c.decodeAudioData(data))
      .then(b => { if (b) this.buf[f] = b; })
      .catch(() => {})))
      .then(() => { Object.keys(this.loopWant).forEach(n => this.syncLoop(n)); this.readied(); });
    document.addEventListener('visibilitychange', () => this.onVisibility());
    // iOS can stop the context (a call, Siri, the lock screen) and only lets it restart in a tap, so any tap does that.
    for (const type of ['touchend', 'click', 'keydown']) {
      document.addEventListener(type, () => { if (c.state !== 'running' && !document.hidden) this.unlock(); }, true);
    }
  }

  musicLevel() { return this.settings.music ? MUSIC * (this.ducked ? DUCK : 1) : 0; }

  // Effects only play while the context runs. Otherwise they would pile up and all fire on resume.
  live() { return !!this.ctx && this.ctx.state === 'running' && !!this.settings.sfx; }

  onVisibility() {
    const c = this.ctx;
    if (document.hidden) {
      this.els.forEach(el => el.pause());
      Promise.resolve(c.suspend?.()).catch(() => {});
    } else {
      Promise.resolve(c.resume?.()).catch(() => {});
      this.syncMusic();
    }
  }

  // iOS lets an <audio> element start later without a tap only if play() was first called during one.
  bless() {
    if (this.blessed || navigator.userActivation?.isActive === false) return;
    this.blessed = true;
    for (const el of this.els) {
      if (!el.paused) continue;
      el.play().catch(() => {});
      el.pause();
    }
  }

  applySettings() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.musicBus.gain.setTargetAtTime(this.musicLevel(), t, 0.05);
    this.sfxBus.gain.setTargetAtTime(this.settings.sfx ? EFFECTS : 0, t, 0.05);
    this.syncMusic();
  }

  play(key, force = false) {
    this.want = key;
    if (this.ctx) this.syncMusic(force);
    else if (this.settings.music) this.preload(TRACKS[key] || 'menu');
  }

  // Before the first tap, start downloading the wanted track. Desktop browsers do; iOS waits for the tap.
  preload(file) {
    if (this.file.includes(file)) return;
    this.els[0].src = musicUrl(file);
    this.file[0] = file;
  }

  stopMusic(fade = 0.6) {
    this.want = null;
    this.cur = -1;
    if (!this.ctx) return;
    // Both elements, since an old track keeps playing until a new one has loaded.
    this.els.forEach((el, i) => { if (!el.paused) this.fadeOut(i, fade); });
  }

  duck(on) {
    this.ducked = on;
    if (!this.ctx) return;
    this.musicFilter.frequency.setTargetAtTime(on ? 900 : 20000, this.ctx.currentTime, 0.12);
    this.applySettings();
  }

  // Makes the music elements match the wanted track, the music setting and page visibility.
  syncMusic(restart = false) {
    if (!this.ctx) return;
    clearTimeout(this.offT);
    if (!this.settings.music || document.hidden) {
      // Pause once the bus has faded out.
      this.offT = setTimeout(() => {
        if (!this.settings.music || document.hidden) this.els.forEach(el => el.pause());
      }, 300);
      return;
    }
    if (!this.want) return;
    const file = TRACKS[this.want] || 'menu', i = this.cur;
    if (!restart && i >= 0 && this.file[i] === file) {
      if (this.els[i].paused) this.els[i].play().catch(() => {});
      return;
    }
    this.switchTo(file, restart);
  }

  // Crossfades to a track on the other element. An element that already holds the track keeps its place if it is
  // still fading out. Otherwise tracks start over, except the menu theme, which picks up where it left off.
  switchTo(file, restart) {
    const prev = this.cur;
    let next = this.file.indexOf(file);
    if (next < 0 || next === prev) next = prev === 0 ? 1 : 0;
    const el = this.els[next];
    if (this.file[next] !== file) {
      el.src = musicUrl(file);
      this.file[next] = file;
    } else if (restart || (el.paused && file !== 'menu')) {
      el.currentTime = 0;
    }
    clearTimeout(this.stopT[next]);
    this.cur = next;
    el.play().catch(() => {});
    // Fade once the new track actually plays, so a slow download doesn't leave a gap.
    const fade = () => {
      if (this.cur !== next || this.file[next] !== file) return;
      ramp(this.elGain[next].gain, 1, this.ctx.currentTime, XFADE);
      if (prev >= 0 && prev !== next) this.fadeOut(prev, XFADE);
    };
    if (el.readyState >= 3) fade();
    else el.addEventListener('playing', fade, { once: true });
  }

  fadeOut(i, sec) {
    ramp(this.elGain[i].gain, 0, this.ctx.currentTime, sec);
    clearTimeout(this.stopT[i]);
    this.stopT[i] = setTimeout(() => { if (this.cur !== i) this.els[i].pause(); }, sec * 1000 + 100);
  }

  sfx(name, { rate, volume = 1 } = {}) {
    if (ALIAS[name]) { this.stinger(ALIAS[name]); return; }
    if (name === 'roar') { this.roar('roar'); return; }
    const s = SFX[name];
    if (!s || !this.live()) return;
    let r = rate ?? (STEADY.has(name) ? 1 : jitter());
    // Coins picked up in a quick run climb a semitone each, up to a fifth.
    if (name === 'coin') r = (rate ?? 1) * this.streak('coin', 0.3, COIN_STEPS);
    this.shot(s[0], { volume: s[1] * volume, rate: r });
  }

  stinger(name) {
    const s = STINGERS[name];
    if (!s || !this.live()) return;
    // Stars revealed one after another step up an arpeggio.
    const rate = name === 'star' ? this.streak('star', 0.8, STAR_STEPS) : 1;
    const shot = this.shot(s[0], { volume: s[1], rate });
    if (shot && (name === 'win' || name === 'lose')) this.duckFor(shot.dur);
  }

  // Dips the music under a win or lose stinger, then brings it back.
  duckFor(sec) {
    const g = this.stingDuck.gain, t = this.ctx.currentTime;
    ramp(g, 0.3, t, 0.15);
    g.setValueAtTime(0.3, t + Math.max(0.15, sec - 0.6));
    g.linearRampToValueAtTime(1, t + sec + 0.6);
  }

  // One roar at a time: a new one is dropped while another plays, unless forced, which cuts the current one short.
  roar(type, force = false) {
    const layers = ROARS[type] || ROARS.roar;
    if (!this.live() || !this.buf[layers[0][0]]) return;
    const t = this.ctx.currentTime;
    if (t < this.roarEnd) {
      if (!force) return;
      this.roarShots.forEach(s => this.stopShot(s, 0.08));
    }
    this.roarShots = layers.map(([f, v, delay = 0]) => this.shot(f, { volume: v, rate: jitter(), delay })).filter(Boolean);
    this.roarEnd = t + Math.max(...this.roarShots.map(s => s.delay + s.dur));
  }

  loop(name, on) {
    if (!LOOPS[name]) return;
    this.loopWant[name] = !!on;
    this.syncLoop(name);
  }

  syncLoop(name) {
    const c = this.ctx, cur = this.loops[name];
    if (!c) return;
    const [file, vol, len] = LOOPS[name], b = this.buf[file], t = c.currentTime;
    if (this.loopWant[name] && !cur && b) {
      const src = c.createBufferSource(), gain = c.createGain(), start = loopStart(b, len);
      src.buffer = b;
      src.loop = true;
      src.loopStart = start;
      src.loopEnd = Math.min(b.duration, start + len);
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(vol, t + LOOP_FADE);
      src.connect(gain);
      gain.connect(this.sfxBus);
      src.onended = () => gain.disconnect();
      src.start(t, start);
      this.loops[name] = { src, gain };
    } else if (!this.loopWant[name] && cur) {
      this.stopShot(cur, LOOP_FADE);
      delete this.loops[name];
    }
  }

  voice(line) {
    const f = VOICES[line];
    if (!f || !this.live()) return;
    if (this.voiceShot) this.stopShot(this.voiceShot, 0.05);
    this.voiceShot = this.shot(f, { volume: VOICE });
  }

  shot(file, { volume = 1, rate = 1, delay = 0 } = {}) {
    const b = this.buf[file];
    if (!b) return null;
    const c = this.ctx, src = c.createBufferSource(), gain = c.createGain();
    src.buffer = b;
    src.playbackRate.value = rate;
    gain.gain.value = volume;
    src.connect(gain);
    gain.connect(this.sfxBus);
    src.onended = () => gain.disconnect();
    src.start(c.currentTime + delay);
    return { src, gain, delay, dur: b.duration / rate };
  }

  stopShot({ src, gain }, sec) {
    const t = this.ctx.currentTime;
    ramp(gain.gain, 0, t, sec);
    try { src.stop(t + sec); } catch { /* already stopped */ }
  }

  // Counts quick repeats (less than gap seconds apart) and returns the playback rate for this one.
  streak(key, gap, steps) {
    const now = performance.now() / 1000, s = this.streaks[key] || (this.streaks[key] = { t: -Infinity, n: 0 });
    s.n = now - s.t < gap ? Math.min(s.n + 1, steps.length - 1) : 0;
    s.t = now;
    return 2 ** (steps[s.n] / 12);
  }

  // ---------- speech ----------
  get canSpeak() { return !!synth; }
  stopSpeech() { this.speechRun++; if (synth) synth.cancel(); }
  say(text) {
    return new Promise(res => {
      if (!synth) { setTimeout(res, 300); return; }
      const u = new SpeechSynthesisUtterance(String(text).replace(/→/g, ', ').replace(/\+/g, ' plus '));
      if (voice) u.voice = voice;
      u.lang = 'en-US'; u.rate = 0.9; u.pitch = 1.1;
      let done = false;
      const fin = () => { if (!done) { done = true; res(); } };
      u.onend = fin; u.onerror = fin;
      setTimeout(fin, 2000 + String(text).length * 110);
      synth.speak(u);
    });
  }
  // Reads parts in order, calling onPart(index) so the UI can highlight what is being read.
  async sayParts(parts, onPart = () => {}) {
    this.stopSpeech();
    const run = this.speechRun;
    for (let i = 0; i < parts.length; i++) {
      if (run !== this.speechRun) return;
      onPart(i);
      await this.say(parts[i]);
    }
    if (run === this.speechRun) onPart(-1);
  }
}
