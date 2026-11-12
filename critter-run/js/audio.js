// All sound is made live with WebAudio: a little procedural band per region, synth sound effects,
// and speechSynthesis for reading questions aloud.
import { rng } from './gfx.js';

const hz = n => 440 * Math.pow(2, (n - 69) / 12);

// Each region gets its own key, tempo, groove, and lead sound. Melodies come from a seed so they stay the same every visit.
const SONGS = {
  title: { root: 60, tempo: 100, mode: 'major', groove: 'chill', lead: 'steel', seed: 5 },
  map: { root: 65, tempo: 108, mode: 'major', groove: 'chill', lead: 'pluck', seed: 9 },
  mountains: { root: 62, tempo: 134, mode: 'major', groove: 'rock', lead: 'square', seed: 11, arp: true },
  foothills: { root: 55, tempo: 128, mode: 'major', groove: 'country', lead: 'pluck', seed: 23 },
  sandhills: { root: 57, tempo: 122, mode: 'minor', groove: 'rock', lead: 'saw', seed: 31 },
  farmland: { root: 60, tempo: 140, mode: 'major', groove: 'country', lead: 'square', seed: 43 },
  swamp: { root: 52, tempo: 114, mode: 'minor', groove: 'swing', lead: 'triangle', seed: 57 },
  beach: { root: 65, tempo: 124, mode: 'major', groove: 'calypso', lead: 'steel', seed: 61, arp: true },
};
const PROG = { major: [[0, 'M'], [7, 'M'], [9, 'm'], [5, 'M']], minor: [[0, 'm'], [8, 'M'], [3, 'M'], [10, 'M']] };
const SCALE = { major: [0, 2, 4, 7, 9], minor: [0, 3, 5, 7, 10] };
const triad = q => (q === 'M' ? [0, 4, 7] : [0, 3, 7]);

function phrase(song, seed, lift) {
  const r = rng(seed);
  const scale = SCALE[song.mode];
  const pitchOf = d => song.root + scale[((d % 5) + 5) % 5] + 12 * Math.floor(d / 5);
  const rhythm = [true, ...Array.from({ length: 7 }, (_, i) => r() < (i % 2 ? 0.45 : 0.8))];
  const notes = new Array(64).fill(null);
  let d = 5 + lift;
  for (let bar = 0; bar < 4; bar++) {
    const [cr, cq] = PROG[song.mode][bar];
    const tones = triad(cq).map(t => (t + cr) % 12);
    const last = bar === 3;
    for (let e = 0; e < 8; e++) {
      if (last && e > 2) break;
      if (!rhythm[e] && !(last && e === 2)) continue;
      d += [-2, -1, -1, 0, 1, 1, 2][Math.floor(r() * 7)];
      d = Math.max(2 + lift, Math.min(10 + lift, d));
      if (e % 4 === 0 || (last && e === 2)) {
        for (const off of [0, -1, 1, -2, 2]) {
          if (tones.includes((pitchOf(d + off) % 12 + 12) % 12)) { d += off; break; }
        }
      }
      notes[bar * 16 + e * 2] = pitchOf(d);
    }
  }
  // Note lengths run until the next note (capped) so lines sound smooth.
  return notes.map((n, i) => {
    if (n == null) return null;
    let len = 1;
    while (i + len < 64 && notes[i + len] == null && len < 6) len++;
    return { n, len };
  });
}

function buildSong(key) {
  const s = SONGS[key] || SONGS.title;
  const A = phrase(s, s.seed, 0), B = phrase(s, s.seed * 7 + 3, 2);
  return { ...s, key, parts: [A, A, B, A] };
}

const GROOVES = {
  rock: { kick: [0, 8, 10], snare: [4, 12], hat: [0, 2, 4, 6, 8, 10, 12, 14], bass: { 0: 0, 2: 0, 4: 12, 6: 0, 8: 0, 10: 0, 12: 12, 14: 7 } },
  country: { kick: [0, 8], snare: [4, 12], hat: [2, 6, 10, 14], bass: { 0: 0, 4: 7, 8: 0, 12: 7 } },
  swing: { kick: [0, 10], snare: [4, 12], hat: [0, 3, 4, 7, 8, 11, 12, 15], bass: { 0: 0, 4: 4, 8: 7, 12: 9 } },
  calypso: { kick: [0, 4, 8, 12], snare: [6, 14], hat: [2, 6, 10, 14], bass: { 0: 0, 3: 0, 6: 7, 8: 0, 11: 7, 14: 12 } },
  chill: { kick: [0, 10], snare: [8], hat: [4, 12], bass: { 0: 0, 8: 7 } },
};

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
    this.song = null;
    this.wantSong = 'title';
    this.speechRun = 0;
  }

  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      const c = (this.ctx = new AC());
      this.master = c.createGain(); this.master.gain.value = 0.8; this.master.connect(c.destination);
      this.comp = c.createDynamicsCompressor(); this.comp.connect(this.master);
      this.musicFilter = c.createBiquadFilter(); this.musicFilter.type = 'lowpass'; this.musicFilter.frequency.value = 18000;
      this.musicGain = c.createGain(); this.musicGain.gain.value = this.settings.music ? 0.32 : 0;
      this.musicFilter.connect(this.musicGain); this.musicGain.connect(this.comp);
      this.sfxGain = c.createGain(); this.sfxGain.gain.value = this.settings.sfx ? 0.6 : 0; this.sfxGain.connect(this.comp);
      const len = c.sampleRate;
      this.noise = c.createBuffer(1, len, c.sampleRate);
      const d = this.noise.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      document.addEventListener('visibilitychange', () => (document.hidden ? c.suspend() : c.resume()));
      this.timer = setInterval(() => this.tick(), 25);
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
    // iOS only allows speech after a tap has spoken once.
    if (synth && !synth.speaking) { const u = new SpeechSynthesisUtterance(' '); u.volume = 0; synth.speak(u); }
    this.play(this.wantSong, true);
  }

  applySettings() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.musicGain.gain.setTargetAtTime(this.settings.music ? (this.ducked ? 0.2 : 0.32) : 0, t, 0.05);
    this.sfxGain.gain.setTargetAtTime(this.settings.sfx ? 0.6 : 0, t, 0.05);
  }

  play(key, force = false) {
    this.wantSong = key;
    if (!this.ctx) return;
    if (!force && this.song && this.song.key === key) return;
    this.song = buildSong(key);
    this.step = 0;
    this.nextTime = this.ctx.currentTime + 0.08;
  }

  duck(on) {
    this.ducked = on;
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.musicFilter.frequency.setTargetAtTime(on ? 900 : 18000, t, 0.12);
    this.applySettings();
  }

  tick() {
    const c = this.ctx;
    if (!c || !this.song || c.state !== 'running') return;
    const stepDur = 60 / this.song.tempo / 4;
    if (this.nextTime < c.currentTime - 0.05) this.nextTime = c.currentTime + 0.05;
    while (this.nextTime < c.currentTime + 0.14) {
      this.playStep(this.step, this.nextTime, stepDur);
      this.nextTime += stepDur;
      this.step++;
    }
  }

  playStep(i, t, sd) {
    const s = this.song, g = GROOVES[s.groove], out = this.musicFilter;
    const s16 = i % 16, bar = Math.floor(i / 16) % 16;
    const [cr, cq] = PROG[s.mode][bar % 4];
    const chord = triad(cq).map(x => s.root + cr + x);
    if (g.kick.includes(s16)) this.kick(t, out);
    if (g.snare.includes(s16)) this.snare(t, out, s.groove === 'chill' ? 0.5 : 1);
    if (g.hat.includes(s16)) this.hat(t, out, s16 % 4 === 2 ? 1 : 0.6);
    if (g.bass[s16] !== undefined) this.tone(t, hz(s.root - 24 + cr + (g.bass[s16] === 4 && cq === 'm' ? 3 : g.bass[s16])), sd * 1.7, { type: 'triangle', gain: 0.5, release: 0.05, dest: out });
    if (s16 === 0) for (const n of chord) this.tone(t, hz(n - 12), sd * 15, { type: 'sine', gain: 0.07, attack: 0.08, release: 0.3, dest: out });
    if (s.arp && s16 % 2 === 1) this.tone(t, hz(chord[(s16 >> 1) % 3] + 12), sd * 0.9, { type: 'square', gain: 0.025, release: 0.03, filter: 2500, dest: out });
    const note = s.parts[Math.floor(bar / 4)][(bar % 4) * 16 + s16];
    if (note) this.lead(t, hz(note.n + 12), note.len * sd, s.lead, out);
  }

  lead(t, f, dur, kind, out) {
    if (kind === 'steel') {
      this.tone(t, f, 0.35, { type: 'sine', gain: 0.16, release: 0.25, dest: out });
      this.tone(t, f * 2.01, 0.18, { type: 'sine', gain: 0.05, release: 0.12, dest: out });
    } else if (kind === 'pluck') {
      this.tone(t, f, Math.min(dur, 0.25), { type: 'triangle', gain: 0.2, release: 0.18, dest: out });
      this.tone(t, f * 2, 0.08, { type: 'square', gain: 0.03, release: 0.05, filter: 3000, dest: out });
    } else if (kind === 'saw') {
      this.tone(t, f, dur * 0.9, { type: 'sawtooth', gain: 0.07, release: 0.08, filter: 1800, vibrato: true, dest: out });
    } else if (kind === 'triangle') {
      this.tone(t, f, dur * 0.9, { type: 'triangle', gain: 0.2, release: 0.1, vibrato: true, dest: out });
    } else {
      this.tone(t, f, dur * 0.85, { type: 'square', gain: 0.06, release: 0.06, filter: 3200, dest: out });
    }
  }

  tone(t, f, dur, { type = 'square', gain = 0.1, attack = 0.005, release = 0.08, filter = 0, slide = 0, vibrato = false, dest = this.sfxGain } = {}) {
    const c = this.ctx;
    const o = c.createOscillator(), e = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, slide), t + dur);
    if (vibrato) {
      const l = c.createOscillator(), lg = c.createGain();
      l.frequency.value = 5.5; lg.gain.value = f * 0.012;
      l.connect(lg); lg.connect(o.frequency);
      l.start(t + 0.12); l.stop(t + dur + release);
    }
    e.gain.setValueAtTime(0, t);
    e.gain.linearRampToValueAtTime(gain, t + attack);
    e.gain.setValueAtTime(gain, t + Math.max(attack, dur - 0.01));
    e.gain.exponentialRampToValueAtTime(0.0001, t + dur + release);
    let n = o;
    if (filter) { const fl = c.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = filter; o.connect(fl); n = fl; }
    n.connect(e); e.connect(dest);
    o.start(t); o.stop(t + dur + release + 0.02);
  }

  noiseHit(t, dur, { gain = 0.3, type = 'highpass', freq = 1000, q = 1, sweep = 0, dest = this.sfxGain } = {}) {
    const c = this.ctx;
    const src = c.createBufferSource(); src.buffer = this.noise;
    const fl = c.createBiquadFilter(); fl.type = type; fl.frequency.setValueAtTime(freq, t); fl.Q.value = q;
    if (sweep) fl.frequency.exponentialRampToValueAtTime(sweep, t + dur);
    const e = c.createGain();
    e.gain.setValueAtTime(gain, t);
    e.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(fl); fl.connect(e); e.connect(dest);
    src.start(t, Math.random() * 0.5); src.stop(t + dur + 0.02);
  }

  kick(t, out) { this.tone(t, 150, 0.12, { type: 'sine', gain: 0.9, slide: 42, release: 0.12, dest: out }); }
  snare(t, out, v = 1) { this.noiseHit(t, 0.16, { gain: 0.32 * v, freq: 1500, dest: out }); this.tone(t, 190, 0.05, { type: 'triangle', gain: 0.25 * v, release: 0.05, dest: out }); }
  hat(t, out, v = 1) { this.noiseHit(t, 0.045, { gain: 0.11 * v, freq: 7500, dest: out }); }

  sfx(name) {
    const c = this.ctx;
    if (!c || !this.settings.sfx) return;
    const t = c.currentTime + 0.01;
    const T = (...a) => this.tone(...a);
    switch (name) {
      case 'coin': T(t, 988, 0.05, { gain: 0.12 }); T(t + 0.05, 1319, 0.12, { gain: 0.12 }); break;
      case 'jump': T(t, 320, 0.16, { type: 'triangle', gain: 0.3, slide: 720 }); break;
      case 'land': this.noiseHit(t, 0.08, { gain: 0.2, type: 'lowpass', freq: 600 }); break;
      case 'swoosh': this.noiseHit(t, 0.14, { gain: 0.16, type: 'bandpass', freq: 900, sweep: 3000, q: 2 }); break;
      case 'hit':
        this.noiseHit(t, 0.3, { gain: 0.5, type: 'lowpass', freq: 1500, sweep: 200 });
        T(t, 160, 0.25, { type: 'sawtooth', gain: 0.25, slide: 50, filter: 900 });
        break;
      case 'heartLost': [523, 392, 262].forEach((f, i) => T(t + i * 0.1, f, 0.1, { type: 'triangle', gain: 0.3 })); break;
      case 'heart': [523, 659, 784, 1047].forEach((f, i) => T(t + i * 0.06, f, 0.08, { type: 'triangle', gain: 0.25 })); break;
      case 'gate':
        [784, 988, 1175, 1568].forEach((f, i) => T(t + i * 0.05, f, 0.12, { type: 'sine', gain: 0.18 }));
        this.noiseHit(t, 0.5, { gain: 0.12, type: 'bandpass', freq: 3000, sweep: 400, q: 3 });
        break;
      case 'zap':
        T(t, 1400, 0.35, { type: 'sawtooth', gain: 0.18, slide: 180, filter: 4000 });
        T(t, 2100, 0.3, { type: 'square', gain: 0.06, slide: 300 });
        this.noiseHit(t, 0.4, { gain: 0.2, type: 'bandpass', freq: 5000, sweep: 800, q: 4 });
        break;
      case 'correct': [523, 659, 784, 1047].forEach((f, i) => T(t + i * 0.08, f, 0.14, { type: 'square', gain: 0.13, filter: 4000 })); break;
      case 'wrong': T(t, 233, 0.22, { type: 'sawtooth', gain: 0.2, filter: 1200 }); T(t + 0.24, 196, 0.4, { type: 'sawtooth', gain: 0.2, filter: 1000, slide: 150 }); break;
      case 'roar': {
        this.noiseHit(t, 0.9, { gain: 0.55, type: 'lowpass', freq: 900, sweep: 250, q: 6 });
        T(t, 95, 0.8, { type: 'sawtooth', gain: 0.35, slide: 55, filter: 700, vibrato: true });
        T(t, 140, 0.6, { type: 'square', gain: 0.12, slide: 70, filter: 500 });
        break;
      }
      case 'whoosh': this.noiseHit(t, 0.6, { gain: 0.25, type: 'bandpass', freq: 400, sweep: 2500, q: 1.5 }); break;
      case 'smash':
        this.noiseHit(t, 0.4, { gain: 0.6, type: 'lowpass', freq: 3000, sweep: 300 });
        for (let i = 0; i < 4; i++) T(t + i * 0.04, 300 + Math.random() * 500, 0.05, { type: 'square', gain: 0.08 });
        break;
      case 'fanfare': [[523, 0], [659, 0.12], [784, 0.24], [1047, 0.36], [784, 0.56], [1047, 0.68]].forEach(([f, d], i) => T(t + d, f, i === 5 ? 0.6 : 0.11, { type: 'square', gain: 0.14, filter: 3500 })); break;
      case 'caught': [392, 370, 349, 330].forEach((f, i) => T(t + i * 0.32, f, i === 3 ? 0.8 : 0.28, { type: 'sawtooth', gain: 0.18, filter: 900, vibrato: i === 3 })); break;
      case 'star': T(t, 1568, 0.08, { type: 'sine', gain: 0.25 }); T(t + 0.07, 2093, 0.25, { type: 'sine', gain: 0.2 }); break;
      case 'click': T(t, 660, 0.04, { type: 'triangle', gain: 0.2 }); break;
      case 'go': T(t, 523, 0.12, { gain: 0.15 }); T(t + 0.14, 784, 0.3, { gain: 0.15 }); break;
      default: break;
    }
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
