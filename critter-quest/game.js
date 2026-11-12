// Critter Quest game engine. Level content lives in levels/*.js (see README.md).
(() => {
'use strict';

const CQ = window.CritterQuest;
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const rand = n => Math.floor(Math.random() * n);
const pick = arr => arr[rand(arr.length)];
const sleep = ms => new Promise(res => setTimeout(res, ms));
const shuffle = arr => {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = rand(i + 1); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
};
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const isEmojiOnly = s => /\p{Extended_Pictographic}/u.test(s) && !/[\p{L}\p{N}]/u.test(s);

// ---------- levels ----------
const ALL_LEVELS = CQ.levels.slice().sort((a, b) => a.date.localeCompare(b.date));
// ?island=<id> shows just that island (for sharing one test); unknown ids show everything.
const onlyId = new URLSearchParams(location.search).get('island');
const LEVELS = ALL_LEVELS.some(lv => lv.id === onlyId) ? ALL_LEVELS.filter(lv => lv.id === onlyId) : ALL_LEVELS;
LEVELS.forEach(lv => {
  lv.stages.forEach((st, si) => st.questions.forEach(q => {
    q.level = lv;
    q.stage = si;
    q.id = `${lv.id}|${q.show || ''}|${q.q}`;
  }));
});
const allQs = lv => lv.stages.flatMap(st => st.questions);
const levelById = id => LEVELS.find(lv => lv.id === id);

// ---------- save data ----------
const KEY = 'critter-quest-v1';
const fresh = () => ({
  coins: 0, xp: 0, owned: ['hero:🧒', 'atk:⚡', 'pet:'], hero: '🧒', atk: '⚡', pet: '',
  clears: {}, stats: {}, arenaBest: 0, sfx: true, autoRead: false,
});
let S;
function load() {
  try { S = Object.assign(fresh(), JSON.parse(localStorage.getItem(KEY)) || {}); } catch { S = fresh(); }
  delete S.read; // old auto-read flag that defaulted to on; replaced by autoRead (off by default)
}
function save() {
  try { localStorage.setItem(KEY, JSON.stringify(S)); } catch { /* private mode: play without saving */ }
}
const clr = lv => S.clears[lv.id] || { s: [], boss: 0 };
const clrW = lv => (S.clears[lv.id] ||= { s: [], boss: 0 });
const stageOpen = (lv, i) => i === 0 || clr(lv).s[i - 1] > 0;
const bossOpen = lv => lv.stages.every((_, i) => clr(lv).s[i] > 0);
const islandStars = lv => clr(lv).s.reduce((t, n) => t + (n || 0), 0) + (clr(lv).boss || 0);
const totalStars = () => LEVELS.reduce((t, lv) => t + islandStars(lv), 0);
const maxStars = lv => (lv.stages.length + 1) * 3;
const heroLevel = xp => Math.floor(Math.sqrt(xp / 5)) + 1;

// Next unbeaten node on an island: a stage index, 'boss', or null when fully cleared.
function nextNode(lv) {
  const c = clr(lv);
  for (let i = 0; i < lv.stages.length; i++) if (!(c.s[i] > 0)) return i;
  return c.boss > 0 ? null : 'boss';
}
// The hero stands on the newest test first; once that's beaten, on the oldest unfinished island.
function markerSpot() {
  const newest = LEVELS[LEVELS.length - 1];
  for (const lv of [newest, ...LEVELS]) {
    const n = nextNode(lv);
    if (n !== null) return { lv, n };
  }
  return { lv: newest, n: 'boss' };
}

// Weak questions (missed, especially last time) come up more often.
function weight(q) {
  const st = S.stats[q.id];
  if (!st) return 2;
  const [r, w, last] = st;
  return Math.max(0.5, 1 + Math.min(w, 4) * 1.5 + (last ? 3 : 0) - Math.min(r * 0.3, 2));
}
function weightedPick(pool, n, avoid = []) {
  let cands = pool.filter(q => !avoid.includes(q.id));
  if (cands.length < n) cands = pool.slice();
  const out = [];
  while (out.length < n && cands.length) {
    let r = Math.random() * cands.reduce((t, q) => t + weight(q), 0);
    let k = 0;
    for (; k < cands.length - 1; k++) { r -= weight(cands[k]); if (r <= 0) break; }
    out.push(cands.splice(k, 1)[0]);
  }
  return out;
}
function record(q, right) {
  const st = S.stats[q.id] || [0, 0, 0];
  if (right) { st[0]++; st[2] = 0; } else { st[1]++; st[2] = 1; }
  S.stats[q.id] = st;
}

// ---------- shop catalog ----------
const SHOP = {
  hero: [['🧒', 0], ['🦸', 150], ['🥷', 250], ['🧙', 350], ['🤖', 500], ['🧑‍🚀', 650], ['🦖', 800], ['🧛', 950], ['🐲', 1200]],
  atk: [['⚡', 0], ['🔥', 100], ['❄️', 150], ['⚽', 200], ['🍕', 250], ['💨', 300], ['🌪️', 400], ['☄️', 550], ['🌈', 700]],
  pet: [['', 0], ['🐶', 120], ['🐱', 120], ['🐸', 200], ['🦊', 250], ['🐧', 300], ['🐼', 400], ['🦄', 600], ['🐉', 900]],
};

// ---------- speech ----------
const synth = 'speechSynthesis' in window ? window.speechSynthesis : null;
let voice = null;
function pickVoice() {
  const vs = synth.getVoices();
  voice = vs.find(v => /Samantha/.test(v.name)) || vs.find(v => /Google US English/.test(v.name))
    || vs.find(v => /^en[-_]US/i.test(v.lang) && v.localService) || vs.find(v => /^en[-_]US/i.test(v.lang))
    || vs.find(v => /^en/i.test(v.lang)) || null;
}
if (synth) { pickVoice(); synth.addEventListener?.('voiceschanged', pickVoice); }
const spoken = t => String(t)
  .replace(/¼/g, ' and a quarter').replace(/½/g, ' and a half').replace(/¾/g, ' and three quarters')
  .replace(/\s[−-]\s/g, ' minus ').replace(/\+/g, ' plus ').replace(/=/g, ' equals ').replace(/→/g, ', ');
let speechRun = 0;
function stopSpeech() {
  speechRun++;
  if (synth) synth.cancel();
  $$('.ans.reading').forEach(b => b.classList.remove('reading'));
  $('#b-speak').classList.remove('talking');
}
function sayOne(text) {
  return new Promise(res => {
    if (!synth) { setTimeout(res, 400); return; }
    const u = new SpeechSynthesisUtterance(spoken(text));
    if (voice) u.voice = voice;
    u.lang = 'en-US'; u.rate = 0.9; u.pitch = 1.1;
    let done = false;
    const fin = () => { if (!done) { done = true; res(); } };
    u.onend = fin; u.onerror = fin;
    setTimeout(fin, 2000 + String(text).length * 110); // some browsers never fire onend
    synth.speak(u);
  });
}
// parts: [{ text, el? }] read in order; el is highlighted while its text is read.
async function sayParts(parts) {
  stopSpeech();
  const run = speechRun;
  await sleep(60);
  if (run !== speechRun) return;
  $('#b-speak').classList.add('talking');
  for (const p of parts) {
    if (run !== speechRun) return;
    p.el?.classList.add('reading');
    await sayOne(p.text);
    p.el?.classList.remove('reading');
    await sleep(150);
  }
  if (run === speechRun) $('#b-speak').classList.remove('talking');
}

// ---------- sound effects (synthesized, no files) ----------
let ac = null;
function audio() {
  if (!ac) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ac = new AC();
  }
  if (ac.state === 'suspended') ac.resume();
  return ac;
}
function tone(freq, dur, { type = 'sine', vol = 0.16, at = 0, slide = 0 } = {}) {
  const a = S.sfx && audio();
  if (!a) return;
  const t = a.currentTime + at;
  const o = a.createOscillator();
  const g = a.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(slide, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.015);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(a.destination);
  o.start(t); o.stop(t + dur + 0.05);
}
function noise(dur, { at = 0, vol = 0.2, freq = 800, q = 1 } = {}) {
  const a = S.sfx && audio();
  if (!a) return;
  const t = a.currentTime + at;
  const buf = a.createBuffer(1, Math.ceil(a.sampleRate * dur), a.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  const src = a.createBufferSource();
  src.buffer = buf;
  const f = a.createBiquadFilter();
  f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = q;
  const g = a.createGain();
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f).connect(g).connect(a.destination);
  src.start(t); src.stop(t + dur);
}
const notes = (list, gap, opts) => list.forEach((f, i) => tone(f, gap * 1.8, { ...opts, at: i * gap }));
const SFX = {
  tap: () => tone(700, 0.07, { type: 'triangle', vol: 0.1 }),
  right: () => notes([660, 880, 1320], 0.09, { type: 'triangle' }),
  wrong: () => { tone(240, 0.28, { type: 'sawtooth', vol: 0.09, slide: 140 }); tone(190, 0.32, { type: 'square', vol: 0.05, at: 0.12, slide: 100 }); },
  hit: () => { noise(0.2, { vol: 0.35, freq: 420 }); tone(160, 0.16, { type: 'square', vol: 0.08, slide: 60 }); },
  zap: () => tone(1300, 0.22, { type: 'sawtooth', vol: 0.07, slide: 220 }),
  fart: () => { tone(90, 0.5, { type: 'sawtooth', vol: 0.22, slide: 55 }); noise(0.45, { vol: 0.18, freq: 150, q: 3 }); },
  roar: () => { noise(0.8, { vol: 0.3, freq: 260, q: 0.7 }); tone(120, 0.7, { type: 'sawtooth', vol: 0.1, slide: 70 }); },
  coin: () => { tone(988, 0.08, { type: 'square', vol: 0.06 }); tone(1319, 0.25, { type: 'square', vol: 0.06, at: 0.07 }); },
  star: () => tone(1046, 0.3, { type: 'triangle', slide: 2093 }),
  win: () => notes([523, 659, 784, 1046, 784, 1046], 0.11, { type: 'triangle' }),
  lose: () => notes([392, 330, 262, 196], 0.18, { type: 'triangle', vol: 0.12 }),
  buy: () => notes([784, 988, 1175, 1568], 0.07, { type: 'square', vol: 0.06 }),
  levelUp: () => notes([523, 659, 784, 1046, 1319, 1568], 0.08, { type: 'triangle' }),
  bonk: () => tone(130, 0.16, { type: 'square', vol: 0.1, slide: 80 }),
};
const attackSound = () => (S.atk === '💨' ? SFX.fart() : SFX.zap());

// iOS only allows audio and speech after a touch.
addEventListener('pointerdown', () => {
  audio();
  if (synth && !synth.speaking) { const u = new SpeechSynthesisUtterance(' '); u.volume = 0; synth.speak(u); }
}, { once: true });
document.addEventListener('visibilitychange', () => { if (document.hidden) stopSpeech(); });

// ---------- visual effects ----------
const fx = $('#fx');
const centerOf = el => { const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; };
function spawn(cls, text, size) {
  const p = document.createElement('span');
  p.className = cls;
  p.textContent = text;
  if (size) p.style.fontSize = size + 'px';
  fx.append(p);
  return p;
}
function burst(x, y, emojis, n = 12) {
  if (reduced) n = Math.min(n, 4);
  for (let i = 0; i < n; i++) {
    const p = spawn('particle', emojis[i % emojis.length], 22 + rand(24));
    const ang = Math.random() * Math.PI * 2;
    const dist = 60 + Math.random() * 120;
    const dx = Math.cos(ang) * dist, dy = Math.sin(ang) * dist - 40;
    p.animate([
      { transform: `translate(${x}px, ${y}px) translate(-50%, -50%) scale(.4)`, opacity: 1 },
      { transform: `translate(${x + dx}px, ${y + dy}px) translate(-50%, -50%) scale(1.1) rotate(${rand(360) - 180}deg)`, opacity: 0 },
    ], { duration: 700 + rand(400), easing: 'cubic-bezier(.2,.8,.3,1)', fill: 'forwards' }).onfinish = () => p.remove();
  }
}
function floater(x, y, text) {
  const p = spawn('floater', text);
  p.animate([
    { transform: `translate(${x}px, ${y}px) translate(-50%, -50%) scale(.6)`, opacity: 1 },
    { transform: `translate(${x}px, ${y - 30}px) translate(-50%, -50%) scale(1.15)`, opacity: 1, offset: 0.3 },
    { transform: `translate(${x}px, ${y - 90}px) translate(-50%, -50%) scale(1)`, opacity: 0 },
  ], { duration: 1100, easing: 'ease-out', fill: 'forwards' }).onfinish = () => p.remove();
}
function confetti(n = 40) {
  if (reduced) n = 8;
  const pieces = ['🎉', '⭐', '✨', '🎊', '🪙', '💥'];
  for (let i = 0; i < n; i++) {
    const p = spawn('particle', pick(pieces), 20 + rand(22));
    const x = Math.random() * innerWidth;
    p.animate([
      { transform: `translate(${x}px, -40px) rotate(0deg)` },
      { transform: `translate(${x + rand(160) - 80}px, ${innerHeight + 40}px) rotate(${rand(720) - 360}deg)` },
    ], { duration: 1600 + rand(1400), delay: rand(600), easing: 'cubic-bezier(.3,.1,.6,1)', fill: 'both' }).onfinish = () => p.remove();
  }
}
function shakeEl(el) {
  el.classList.remove('shake');
  void el.offsetWidth;
  el.classList.add('shake');
  setTimeout(() => el.classList.remove('shake'), 500);
}
const anim = (el, frames, opts) => (reduced ? Promise.resolve() : el.animate(frames, opts).finished.catch(() => {}));

// ---------- HUD ----------
function renderHud() {
  $('#hud-hero').textContent = S.hero;
  $('#hud-lv').textContent = 'Lv ' + heroLevel(S.xp);
  $('#hud-stars').textContent = totalStars();
  $('#hud-coins').textContent = S.coins;
  $('#b-coins').textContent = S.coins;
  const read = $('#tog-read'), sfx = $('#tog-sfx');
  read.textContent = S.autoRead ? '🗣️' : '🤐';
  read.classList.toggle('off', !S.autoRead);
  read.setAttribute('aria-pressed', S.autoRead);
  sfx.textContent = S.sfx ? '🔔' : '🔕';
  sfx.classList.toggle('off', !S.sfx);
  sfx.setAttribute('aria-pressed', S.sfx);
  const arenaLocked = arenaPool().length === 0;
  $('#nav-arena').innerHTML = `<span>🏟️</span><small>Arena</small>${arenaLocked ? '<b class="badge">🔒</b>' : ''}`;
}

// ---------- map ----------
const XS = [50, 76, 50, 24];
const ROW = 118;
const TOP = 104;
function renderMap() {
  const world = $('#world');
  world.innerHTML = '';
  const spot = markerSpot();
  const newest = LEVELS[LEVELS.length - 1];
  LEVELS.forEach(lv => {
    const c = clr(lv);
    const isle = document.createElement('section');
    isle.className = 'island';
    isle.id = 'isle-' + lv.id;
    isle.style.setProperty('--land', lv.color);
    const fresh = lv === newest && nextNode(lv) !== null;
    isle.innerHTML = `
      <div class="isle-head">
        <span class="isle-emoji">${esc(lv.emoji)}</span>
        <div class="isle-txt"><div class="isle-name">${esc(lv.name)}</div><div class="isle-topic">${esc(lv.topic)}</div></div>
        <div class="isle-stars">⭐ ${islandStars(lv)}/${maxStars(lv)}</div>
        ${fresh ? '<span class="new-badge">NEW!</span>' : ''}
      </div>`;

    const n = lv.stages.length;
    const pts = lv.stages.map((_, i) => ({ x: XS[i % 4], y: TOP + i * ROW }));
    pts.push({ x: 50, y: TOP + n * ROW + 14 });
    const path = document.createElement('div');
    path.className = 'path';
    path.style.height = pts[n].y + 100 + 'px';
    let lines = '';
    for (let i = 0; i < n; i++) {
      lines += `<line x1="${pts[i].x}%" y1="${pts[i].y}" x2="${pts[i + 1].x}%" y2="${pts[i + 1].y}"/>`;
    }
    path.innerHTML = `<svg aria-hidden="true">${lines}</svg>`;

    // decorations on the empty side of each row
    const decor = lv.decor || [];
    pts.forEach((p, i) => {
      if (!decor.length) return;
      const side = p.x === 50 ? (i % 4 === 0 ? [13] : [87]) : [p.x > 50 ? 22 : 78];
      if (i === n) side.splice(0, 1, 12, 88);
      side.forEach((x, k) => {
        const d = document.createElement('span');
        d.className = 'decor';
        d.textContent = decor[(i + k) % decor.length];
        d.style.left = x + '%';
        d.style.top = p.y + (i === n ? 10 : 0) + 'px';
        path.append(d);
      });
    });

    pts.forEach((p, i) => {
      const isBoss = i === n;
      const done = isBoss ? c.boss > 0 : c.s[i] > 0;
      const open = isBoss ? bossOpen(lv) : stageOpen(lv, i);
      const starsGot = isBoss ? c.boss || 0 : c.s[i] || 0;
      const sp = document.createElement('div');
      sp.className = 'spot';
      sp.style.left = p.x + '%';
      sp.style.top = p.y + 'px';
      const node = document.createElement('button');
      node.className = `node ${isBoss ? 'boss' : ''} ${done ? 'done' : open ? 'open' : 'locked'}`;
      node.dataset.level = lv.id;
      node.dataset.node = isBoss ? 'boss' : i;
      node.setAttribute('aria-label', isBoss ? 'Boss battle' : `Battle ${i + 1}`);
      node.innerHTML = (isBoss ? '<span class="crown">👑</span>' : '')
        + `<span class="mon">${esc(isBoss ? lv.boss : lv.stages[i].monster)}</span>`
        + (open ? '' : '<span class="lock">🔒</span>')
        + (done ? `<span class="stars">${starRow(starsGot)}</span>` : '');
      sp.append(node);
      if (spot.lv === lv && String(spot.n) === String(isBoss ? 'boss' : i)) {
        const me = document.createElement('div');
        me.className = 'me-marker' + (isBoss ? ' on-boss' : '');
        me.id = 'me-marker';
        me.innerHTML = (S.pet ? `<span class="pet-mini">${esc(S.pet)}</span>` : '') + esc(S.hero);
        sp.append(me);
      }
      path.append(sp);
    });
    isle.append(path);
    world.append(isle);
  });
}
const starRow = n => [1, 2, 3].map(k => `<span class="${k <= n ? '' : 'off'}">⭐</span>`).join('');
function scrollToMarker(smooth) {
  const me = $('#me-marker');
  if (me) me.scrollIntoView({ block: 'center', behavior: smooth && !reduced ? 'smooth' : 'auto' });
}
$('#world').addEventListener('click', e => {
  const node = e.target.closest('.node');
  if (!node) return;
  const lv = levelById(node.dataset.level);
  const n = node.dataset.node === 'boss' ? 'boss' : +node.dataset.node;
  if (node.classList.contains('locked')) { SFX.bonk(); shakeEl(node); return; }
  SFX.tap();
  startBattle(n === 'boss' ? 'boss' : 'stage', lv, n);
});

// ---------- battle ----------
const HEARTS = { stage: 4, boss: 5, arena: 3 };
let B = null;
let battleRun = 0;
const arenaPool = () => LEVELS.flatMap(lv => lv.stages.flatMap((st, i) => (clr(lv).s[i] > 0 ? st.questions : [])));
const mult = () => (B.combo >= 5 ? 3 : B.combo >= 3 ? 2 : 1);
const alive = run => B && B.run === run;

function startBattle(mode, lv, stageIdx) {
  closeOverlay();
  stopSpeech();
  B = {
    mode, lv, stageIdx, run: ++battleRun, hearts: HEARTS[mode], maxHearts: HEARTS[mode],
    mistakes: 0, combo: 0, earned: 0, xp0: S.xp, beaten: 0, recent: [], busy: true,
  };
  if (mode === 'stage') {
    B.queue = shuffle(lv.stages[stageIdx].questions);
    B.foe = lv.stages[stageIdx].monster;
  } else if (mode === 'boss') {
    const all = allQs(lv);
    B.queue = weightedPick(all, Math.min(8, all.length));
    B.foe = lv.boss;
  } else {
    nextArenaFoe();
  }
  B.maxHp = B.queue.length;
  document.body.classList.add('in-battle');
  $('#battle').classList.remove('hidden');
  $('#battle').scrollTop = 0;
  renderBattleScene();
  intro(B.run);
}

function nextArenaFoe() {
  const hp = Math.min(6, 3 + Math.floor(B.beaten / 3));
  const pool = arenaPool();
  B.queue = weightedPick(pool, Math.min(hp, pool.length), B.recent);
  const caught = LEVELS.flatMap(lv => [
    ...lv.stages.filter((_, i) => clr(lv).s[i] > 0).map(st => ({ lv, m: st.monster })),
    ...(clr(lv).boss > 0 ? [{ lv, m: lv.boss }] : []),
  ]);
  const foe = pick(caught.filter(c => c.m !== B.foe)) || pick(caught);
  B.foe = foe.m;
  B.lv = foe.lv;
  B.maxHp = B.queue.length;
}

const isBossFight = () => B.mode === 'boss' || B.foe === B.lv.boss;
function renderBattleScene() {
  $('#battle').style.setProperty('--land', B.lv.color);
  $('#b-hero').textContent = S.hero;
  $('#b-pet').textContent = S.pet;
  $('#b-foe').textContent = B.foe;
  $('#b-crown').classList.toggle('hidden', !isBossFight());
  $('#b-foe-wrap').classList.toggle('boss', isBossFight());
  $('#b-foe-wrap').getAnimations().forEach(a => a.cancel());
  $('#b-why').classList.add('hidden');
  $('#b-banner').classList.add('hidden');
  renderHearts(); renderHp(); renderCombo(); renderScore(); renderHud();
}
function renderHearts() {
  $('#b-hearts').innerHTML = Array.from({ length: B.maxHearts }, (_, i) => `<span>${i < B.hearts ? '❤️' : '🤍'}</span>`).join('');
}
function renderHp() {
  $('#b-hp').innerHTML = Array.from({ length: B.maxHp }, (_, i) => `<i class="${i < B.queue.length ? '' : 'gone'}"></i>`).join('');
}
function renderCombo() {
  const el = $('#b-combo');
  const m = mult();
  const was = el.textContent;
  el.textContent = '🔥x' + m;
  el.classList.toggle('hidden', m < 2);
  if (m >= 2 && was !== el.textContent) anim(el, [{ scale: 1.6 }, { scale: 1 }], { duration: 350, easing: 'ease-out' });
}
function renderScore() {
  const el = $('#b-score');
  el.classList.toggle('hidden', B.mode !== 'arena');
  el.textContent = '🏆 ' + B.beaten;
}

async function banner(text, ms = 900) {
  const b = $('#b-banner');
  b.textContent = text;
  b.classList.remove('hidden');
  if (reduced) await sleep(ms);
  else await anim(b, [
    { transform: 'scale(.2)', opacity: 0 }, { transform: 'scale(1.2)', opacity: 1, offset: 0.35 },
    { transform: 'scale(1)', opacity: 1, offset: 0.8 }, { transform: 'scale(1)', opacity: 0 },
  ], { duration: ms, easing: 'ease-out' });
  b.classList.add('hidden');
}
const foeEnter = () => anim($('#b-foe-wrap'), [
  { translate: '150% 0', rotate: '25deg' }, { translate: '0 0', rotate: '0deg' },
], { duration: 550, easing: 'cubic-bezier(.3,1.4,.5,1)' });

async function intro(run) {
  showQuestion(false);
  if (isBossFight()) SFX.roar();
  await foeEnter();
  if (!alive(run)) return;
  await banner(B.mode === 'boss' ? 'BOSS!' : B.mode === 'arena' ? 'ARENA!' : 'GO!');
  if (!alive(run)) return;
  B.busy = false;
  if (S.autoRead) readQuestion();
}

function showQuestion(start = true) {
  const q = B.queue[0];
  B.q = q;
  B.answered = false;
  B.waiting = false;
  B.recent = [q.id, ...B.recent.filter(id => id !== q.id)].slice(0, 6);
  B.opts = shuffle([q.a, ...shuffle(q.wrong).slice(0, 3)]);
  const show = $('#b-show');
  show.textContent = q.show || '';
  show.classList.toggle('hidden', !q.show);
  $('#b-q').innerHTML = (q.pic ? `<span class="qpic">${esc(q.pic)}</span>` : '') + esc(q.q);
  const box = $('#b-answers');
  box.classList.toggle('emoji-answers', B.opts.every(isEmojiOnly));
  box.innerHTML = B.opts.map((o, i) => {
    const long = /\S{11,}/.test(o) || o.length > 16;
    return `<button class="ans${long ? ' long' : ''}" data-i="${i}">${esc(o)}</button>`;
  }).join('');
  $('#b-why').classList.add('hidden');
  if (start) {
    B.busy = false;
    if (S.autoRead) readQuestion();
  }
}
function readQuestion() {
  if (!B?.q) return;
  if (B.waiting) { sayParts([{ text: B.q.why }]); return; }
  const btns = $$('#b-answers .ans');
  sayParts([
    { text: B.q.say || [B.q.show, B.q.q].filter(Boolean).join('. ') },
    ...B.opts.map((o, i) => ({ text: o, el: btns[i] })),
  ]);
}

async function answer(i) {
  if (!B || B.busy || B.answered || !B.opts[i]) return;
  B.answered = true;
  B.busy = true;
  stopSpeech();
  const run = B.run;
  const q = B.q;
  const btns = $$('#b-answers .ans');
  const btn = btns[i];
  const right = B.opts[i] === q.a;
  record(q, right);
  if (right) {
    btn.classList.add('right');
    btn.insertAdjacentHTML('beforeend', '<span class="mark">✅</span>');
    btns.forEach(b => b !== btn && b.classList.add('dim'));
    SFX.right();
    const c = centerOf(btn);
    burst(c.x, c.y, ['⭐', '✨', '🎉'], 12);
    B.combo++;
    const gain = 10 * mult();
    S.coins += gain;
    B.earned += gain;
    S.xp++;
    floater(c.x, c.y - 20, `+${gain} 🪙`);
    setTimeout(SFX.coin, 250);
    B.queue.shift();
    save(); renderHud(); renderCombo();
    await sleep(reduced ? 100 : 250);
    if (!alive(run)) return;
    await attack();
    if (!alive(run)) return;
    if (!B.queue.length) { foeDefeated(run); return; }
    await sleep(reduced ? 150 : 400);
    if (!alive(run)) return;
    showQuestion();
  } else {
    btn.classList.add('wrong');
    btn.insertAdjacentHTML('beforeend', '<span class="mark">❌</span>');
    const good = btns[B.opts.indexOf(q.a)];
    good.classList.add('show-right');
    btns.forEach(b => b !== btn && b !== good && b.classList.add('dim'));
    SFX.wrong();
    shakeEl($('#arena'));
    anim($('#b-foe-wrap'), [{ translate: '0 0' }, { translate: '-45% 0', scale: 1.2, offset: 0.4 }, { translate: '0 0' }], { duration: 450 });
    anim($('#b-hero-wrap'), [{ rotate: '0deg' }, { rotate: '-14deg', offset: 0.5 }, { rotate: '0deg' }], { duration: 450, delay: 150 });
    B.combo = 0;
    B.mistakes++;
    B.hearts--;
    renderCombo();
    const heart = $$('#b-hearts span')[B.hearts];
    if (heart) {
      const c = centerOf(heart);
      burst(c.x, c.y, ['💔'], 4);
      heart.textContent = '🤍';
      anim(heart, [{ scale: 1.8 }, { scale: 1 }], { duration: 350 });
    }
    // Missed questions come back two turns later so the right answer sticks.
    B.queue.shift();
    B.queue.splice(Math.min(2, B.queue.length), 0, q);
    save();
    await sleep(reduced ? 150 : 550);
    if (!alive(run)) return;
    $('#b-why-text').textContent = q.why;
    $('#b-why').classList.remove('hidden');
    anim($('#b-why'), [{ scale: 0.6, opacity: 0 }, { scale: 1, opacity: 1 }], { duration: 260, easing: 'cubic-bezier(.3,1.5,.5,1)' });
    B.waiting = true;
    B.busy = false;
    if (S.autoRead) sayParts([{ text: q.why }]);
  }
}
function next() {
  if (!B?.waiting) return;
  B.waiting = false;
  stopSpeech();
  SFX.tap();
  $('#b-why').classList.add('hidden');
  if (B.hearts <= 0) battleOver(false);
  else showQuestion();
}

async function attack() {
  const foe = $('#b-foe');
  anim($('#b-hero-wrap'), [{ translate: '0 0' }, { translate: '30px -10px', offset: 0.4 }, { translate: '0 0' }], { duration: 350 });
  attackSound();
  const from = centerOf($('#b-hero'));
  const to = centerOf(foe);
  if (!reduced) {
    const shot = spawn('shot', S.atk, 56);
    const spin = ['⚽', '🍕', '🌪️', '❄️'].includes(S.atk) ? 720 : 0;
    await shot.animate([
      { transform: `translate(${from.x}px, ${from.y}px) translate(-50%, -50%) scale(.6) rotate(0deg)` },
      { transform: `translate(${to.x}px, ${to.y}px) translate(-50%, -50%) scale(1.3) rotate(${spin}deg)` },
    ], { duration: 380, easing: 'ease-in' }).finished.catch(() => {});
    shot.remove();
  }
  SFX.hit();
  burst(to.x, to.y, ['💥', S.atk, '⭐'], 10);
  anim(foe, [{ filter: 'brightness(2.6)' }, { filter: 'none' }], { duration: 300 });
  anim($('#b-foe-wrap'), [{ translate: '0 0' }, { translate: '18px 0', rotate: '8deg' }, { translate: '-10px 0' }, { translate: '0 0' }], { duration: 320 });
  renderHp();
  await sleep(250);
}

async function foeDefeated(run) {
  const wrap = $('#b-foe-wrap');
  const c = centerOf($('#b-foe'));
  burst(c.x, c.y, ['💥', '⭐', '✨', '💫'], 18);
  SFX.star();
  await anim(wrap, [{ rotate: '0deg', scale: 1, opacity: 1 }, { rotate: '540deg', scale: 0, opacity: 0 }], { duration: 650, easing: 'ease-in', fill: 'forwards' });
  if (!alive(run)) return;
  if (B.mode !== 'arena') { battleOver(true); return; }

  B.beaten++;
  S.coins += 15;
  B.earned += 15;
  floater(c.x, c.y, '+15 🪙');
  SFX.coin();
  if (B.beaten % 3 === 0 && B.hearts < B.maxHearts) {
    B.hearts++;
    const h = centerOf($('#b-hearts'));
    burst(h.x, h.y, ['❤️', '✨'], 8);
  }
  S.arenaBest = Math.max(S.arenaBest, B.beaten);
  save();
  nextArenaFoe();
  renderBattleScene();
  showQuestion(false);
  await foeEnter();
  if (!alive(run)) return;
  await banner('🏆 ' + B.beaten, 750);
  if (!alive(run)) return;
  B.busy = false;
  if (S.autoRead) readQuestion();
}

function battleOver(win) {
  stopSpeech();
  B.busy = true;
  let stars = 0, firstCatch = false;
  if (win) {
    stars = B.mistakes === 0 ? 3 : B.mistakes <= 2 ? 2 : 1;
    const c = clrW(B.lv);
    if (B.mode === 'stage') {
      firstCatch = !(c.s[B.stageIdx] > 0);
      c.s[B.stageIdx] = Math.max(c.s[B.stageIdx] || 0, stars);
    } else {
      firstCatch = !(c.boss > 0);
      c.boss = Math.max(c.boss || 0, stars);
    }
    const bonus = (B.mode === 'boss' ? 100 : 25) + stars * 10;
    S.coins += bonus;
    B.earned += bonus;
  }
  save();
  renderHud();
  showResult(win, stars, firstCatch);
}

function exitBattle() {
  stopSpeech();
  B = null;
  closeOverlay();
  $('#battle').classList.add('hidden');
  document.body.classList.remove('in-battle');
  renderHud();
  renderMap();
  scrollToMarker(false);
}

// ---------- overlays ----------
let overlayModal = false;
function openOverlay(html, { modal = false, pop = true } = {}) {
  const sheet = $('#sheet');
  const keepScroll = pop ? 0 : sheet.scrollTop;
  sheet.innerHTML = html;
  $('#overlay').classList.remove('hidden');
  overlayModal = modal;
  sheet.scrollTop = keepScroll;
  if (pop) anim(sheet, [{ scale: 0.8, opacity: 0 }, { scale: 1, opacity: 1 }], { duration: 240, easing: 'cubic-bezier(.3,1.5,.5,1)' });
}
function closeOverlay() {
  $('#overlay').classList.add('hidden');
  $('#sheet').innerHTML = '';
  overlayModal = false;
}
const overlayOpen = () => !$('#overlay').classList.contains('hidden');
const closeBtn = '<button class="icon-btn close" data-act="close" aria-label="Close">✖️</button>';

function showResult(win, stars, firstCatch) {
  const { mode, lv, foe } = B;
  const lvUp = heroLevel(S.xp) > heroLevel(B.xp0) ? `<div class="lvup">⬆️ Lv ${heroLevel(S.xp)}</div>` : '';
  const coins = `<div class="res-line">+${B.earned} 🪙</div>`;
  const btn = (act, emoji, label, primary) => `<button class="big-btn${primary ? ' primary' : ''}" data-act="${act}" aria-label="${label}">${emoji}</button>`;
  let html;
  if (mode === 'arena') {
    const best = B.beaten >= S.arenaBest && B.beaten > 0;
    html = `<div class="big-emoji">🏟️</div>
      <div class="res-title win">🏆 ${B.beaten}</div>
      <div class="res-line">${best ? '🎉 BEST!' : '🥇 ' + S.arenaBest}</div>${coins}${lvUp}
      <div class="res-btns">${btn('map', '🗺️', 'Map')}${btn('again', '🔁', 'Play again', true)}</div>`;
    SFX.win();
    if (best) confetti(30);
  } else if (win) {
    const n = nextNode(lv);
    html = `<div class="big-emoji">${mode === 'boss' ? '<span class="crown">👑</span>' : ''}${esc(foe)}</div>
      <div class="res-title win">${mode === 'boss' ? 'BOSS DOWN!' : 'YOU WIN!'}</div>
      <div class="res-stars">${[1, 2, 3].map(k => `<span class="${k <= stars ? 'on' : ''}" style="animation-delay:${0.2 + k * 0.25}s">⭐</span>`).join('')}</div>
      ${coins}${firstCatch ? `<div class="caught">📖 + ${esc(foe)}</div>` : ''}${lvUp}
      <div class="res-btns">${n === null
        ? btn('again', '🔁', 'Play again') + btn('map', '🗺️', 'Map', true)
        : btn('map', '🗺️', 'Map') + btn('again', '🔁', 'Play again') + btn('next', '▶️', 'Next battle', true)}</div>`;
    SFX.win();
    for (let k = 1; k <= stars; k++) setTimeout(SFX.star, 200 + k * 250);
    confetti(mode === 'boss' ? 60 : 36);
  } else {
    html = `<div class="big-emoji">${esc(foe)}</div>
      <div class="res-title">OOPS!</div>${coins}${lvUp}
      <div class="res-btns">${btn('map', '🗺️', 'Map')}${btn('again', '🔁', 'Try again', true)}</div>`;
    SFX.lose();
  }
  openOverlay(html, { modal: true });
  if (lvUp) setTimeout(SFX.levelUp, 900);
}

let shopTab = 'hero';
function openShop(pop = true) {
  stopSpeech();
  const tabs = [['hero', '🦸', 'Heroes'], ['atk', '⚡', 'Attacks'], ['pet', '🐾', 'Pets']];
  const items = SHOP[shopTab].map(([e, price]) => {
    const owned = S.owned.includes(shopTab + ':' + e);
    const on = S[shopTab] === e;
    const cls = on ? 'equipped' : owned ? 'owned' : S.coins < price ? 'cant' : '';
    const label = on ? '✅' : owned ? '' : '🪙' + price;
    return `<button class="item ${cls}" data-buy="${esc(e)}" data-price="${price}" aria-label="${owned ? 'Use' : 'Buy for ' + price}">
      <span class="ie">${e ? esc(e) : '🚫'}</span><span class="price">${label}</span></button>`;
  }).join('');
  openOverlay(`${closeBtn}
    <div class="sheet-title">🛒 Shop</div>
    <div class="preview">${S.pet ? `<span class="pv-small">${esc(S.pet)}</span>` : ''}${esc(S.hero)}<span class="pv-small">${esc(S.atk)}</span></div>
    <div class="pill wallet">🪙 ${S.coins}</div>
    <div class="tabs">${tabs.map(([k, e, label]) => `<button class="tab${k === shopTab ? ' on' : ''}" data-tab="${k}" aria-label="${label}">${e}</button>`).join('')}</div>
    <div class="grid">${items}</div>`, { pop });
}
function shopTap(btn) {
  const e = btn.dataset.buy;
  const price = +btn.dataset.price;
  const id = shopTab + ':' + e;
  const c = centerOf(btn);
  if (S.owned.includes(id)) {
    S[shopTab] = e;
    SFX.tap();
    burst(c.x, c.y, ['✨'], 6);
  } else if (S.coins >= price) {
    S.coins -= price;
    S.owned.push(id);
    S[shopTab] = e;
    SFX.buy();
    burst(c.x, c.y, ['🪙', '✨', '🎉', e || '✨'], 16);
  } else {
    SFX.bonk();
    shakeEl(btn);
    return;
  }
  if (shopTab === 'atk') setTimeout(attackSound, 250);
  save();
  renderHud();
  openShop(false);
}

function openBook() {
  stopSpeech();
  let got = 0, total = 0;
  const rows = LEVELS.map(lv => {
    const c = clr(lv);
    const mons = [
      ...lv.stages.map((st, i) => ({ m: st.monster, have: c.s[i] > 0 })),
      { m: lv.boss, have: c.boss > 0, boss: true },
    ];
    total += mons.length;
    got += mons.filter(x => x.have).length;
    return `<div class="book-row" style="--land:${esc(lv.color)}">
      <div class="book-head">${esc(lv.emoji)} ${esc(lv.name)}</div>
      <div class="mons">${mons.map(x => `<button class="mon-card${x.boss ? ' boss' : ''}${x.have ? '' : ' no'}" data-have="${x.have ? 1 : 0}" aria-label="${x.have ? 'Caught' : 'Not caught yet'}">
        <span>${esc(x.m)}</span>${x.boss ? '<span class="k">👑</span>' : ''}</button>`).join('')}</div>
    </div>`;
  }).join('');
  openOverlay(`${closeBtn}<div class="sheet-title">📖 ${got}/${total}</div>${rows}`);
}

function openArena() {
  if (!arenaPool().length) {
    SFX.bonk();
    shakeEl($('#nav-arena'));
    if (S.autoRead) sayParts([{ text: 'Win a battle first!' }]);
    return;
  }
  SFX.tap();
  startBattle('arena');
}

$('#overlay').addEventListener('click', e => {
  if (e.target.id === 'overlay') {
    if (!overlayModal) { SFX.tap(); closeOverlay(); }
    return;
  }
  const t = e.target.closest('button');
  if (!t) return;
  if (t.dataset.act) { act(t.dataset.act); return; }
  if (t.dataset.tab) { shopTab = t.dataset.tab; SFX.tap(); openShop(false); return; }
  if (t.dataset.buy !== undefined) { shopTap(t); return; }
  if (t.classList.contains('mon-card')) {
    if (t.dataset.have === '1') {
      t.classList.contains('boss') ? SFX.roar() : SFX.tap();
      const c = centerOf(t);
      burst(c.x, c.y, ['✨', '⭐'], 8);
      anim(t.firstElementChild, [{ scale: 1, rotate: '0deg' }, { scale: 1.5, rotate: '-12deg' }, { scale: 1, rotate: '0deg' }], { duration: 450 });
    } else {
      SFX.bonk();
      shakeEl(t);
    }
  }
});
function act(a) {
  SFX.tap();
  if (a === 'close') { closeOverlay(); return; }
  if (a === 'map') { exitBattle(); return; }
  if (!B) return;
  if (a === 'again') { startBattle(B.mode, B.lv, B.stageIdx); return; }
  if (a === 'next') {
    const n = nextNode(B.lv);
    if (n === null) exitBattle();
    else startBattle(n === 'boss' ? 'boss' : 'stage', B.lv, n);
  }
}

// ---------- wiring ----------
$('#tog-read').addEventListener('click', () => {
  S.autoRead = !S.autoRead;
  if (!S.autoRead) stopSpeech();
  save(); renderHud(); SFX.tap();
});
$('#tog-sfx').addEventListener('click', () => {
  S.sfx = !S.sfx;
  save(); renderHud(); SFX.tap();
});
$('#hud-me').addEventListener('click', () => { SFX.tap(); openShop(); });
$('#nav-shop').addEventListener('click', () => { SFX.tap(); openShop(); });
$('#nav-book').addEventListener('click', () => { SFX.tap(); openBook(); });
$('#nav-arena').addEventListener('click', openArena);
$('#b-flee').addEventListener('click', () => { SFX.tap(); exitBattle(); });
$('#b-speak').addEventListener('click', readQuestion);
$('#b-why').addEventListener('click', next);
$('#b-answers').addEventListener('click', e => {
  const b = e.target.closest('.ans');
  if (b) answer(+b.dataset.i);
});
addEventListener('keydown', e => {
  if (e.key === 'Escape' && overlayOpen() && !overlayModal) { closeOverlay(); return; }
  if (overlayOpen()) {
    if (e.key === 'Enter' && overlayModal) { e.preventDefault(); $('#sheet .primary')?.click(); }
    return;
  }
  if (!B) return;
  if (/^[1-4]$/.test(e.key)) answer(+e.key - 1);
  else if (e.key === 'Enter' && B.waiting) { e.preventDefault(); next(); }
});

load();
if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
renderHud();
renderMap();
requestAnimationFrame(() => scrollToMarker(false));

// Hooks for automated browser tests.
CQ.game = {
  levels: LEVELS,
  get save() { return S; },
  get battle() { return B; },
  rightIndex: () => (B?.q ? B.opts.indexOf(B.q.a) : -1),
  wrongIndex: () => (B?.q ? B.opts.findIndex(o => o !== B.q.a) : -1),
  setSave(patch) { Object.assign(S, patch); save(); renderHud(); renderMap(); },
  reset() { localStorage.removeItem(KEY); load(); exitBattle(); },
};
})();
