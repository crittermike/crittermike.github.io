// Crittenden Family Chore Wheel
// Vanilla ES module. State in localStorage. SVG-driven wheel.

const KIDS = [
  { id: 'charlie', name: 'Charlie', age: 15, color: '#2A9D8F' },
  { id: 'henry',   name: 'Henry',   age: 12, color: '#457B9D' },
  { id: 'william', name: 'William', age: 10, color: '#E8834A' },
  { id: 'thomas',  name: 'Thomas',  age: 7,  color: '#E76F51' },
];

const DEFAULT_CHORES = [
  'Vacuum living room',
  'Take out trash',
  'Load/unload dishwasher',
  'Wipe bathroom counters',
  'Sweep kitchen',
  'Fold laundry',
  'Clean own room',
  'Feed Fig & Poppy',
  'Water plants',
  'Tidy mudroom',
];

const LS_KEY = 'crittenden-chore-wheel-v1';

// ----- State -----
function loadState() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {}
  return {
    chores: [...DEFAULT_CHORES],
    currentWeek: weekKey(new Date()),
    assignments: {}, // { kidId: choreString }
    history: [],     // [{ weekKey, label, assignments: { kidId: chore } }]
  };
}
function saveState() { localStorage.setItem(LS_KEY, JSON.stringify(state)); }

// ----- Week helpers -----
function startOfWeek(date) {
  const d = new Date(date);
  const day = d.getDay(); // 0=Sun
  const diff = (day === 0 ? -6 : 1 - day); // Monday-start
  d.setDate(d.getDate() + diff);
  d.setHours(0,0,0,0);
  return d;
}
function weekKey(date) {
  const d = startOfWeek(date);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
function weekLabel(date) {
  const start = startOfWeek(date);
  const end = new Date(start); end.setDate(end.getDate() + 6);
  const monthFmt = { month: 'short', day: 'numeric' };
  const yearFmt = { year: 'numeric' };
  if (start.getMonth() === end.getMonth()) {
    return `Week of ${start.toLocaleDateString(undefined, monthFmt)}–${end.getDate()}, ${start.getFullYear()}`;
  }
  return `Week of ${start.toLocaleDateString(undefined, monthFmt)} – ${end.toLocaleDateString(undefined, monthFmt)}, ${start.getFullYear()}`;
}

// ----- State init -----
let state = loadState();
// Auto-roll if currentWeek is stale
const todayKey = weekKey(new Date());
if (state.currentWeek !== todayKey) {
  // Move current to history if it had any assignments
  if (Object.keys(state.assignments).length > 0) {
    state.history.unshift({
      weekKey: state.currentWeek,
      label: weekLabel(new Date(state.currentWeek)),
      assignments: { ...state.assignments },
    });
    state.history = state.history.slice(0, 4);
  }
  state.currentWeek = todayKey;
  state.assignments = {};
  saveState();
}

// ----- DOM refs -----
const wheel = document.getElementById('wheel');
const kidsEl = document.getElementById('kids');
const choreListEl = document.getElementById('choreList');
const addChoreForm = document.getElementById('addChoreForm');
const newChoreInput = document.getElementById('newChore');
const weekLabelEl = document.getElementById('weekLabel');
const spinAllBtn = document.getElementById('spinAll');
const lockWeekBtn = document.getElementById('lockWeek');
const resetBtn = document.getElementById('resetBtn');
const resultBanner = document.getElementById('resultBanner');
const historyEl = document.getElementById('history');

// ----- Render -----
function render() {
  weekLabelEl.textContent = weekLabel(new Date(state.currentWeek));
  renderWheel();
  renderKids();
  renderChores();
  renderHistory();
}

function renderWheel() {
  const chores = state.chores;
  wheel.innerHTML = '';
  if (chores.length === 0) {
    const t = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    t.setAttribute('text-anchor', 'middle'); t.setAttribute('y', '5');
    t.setAttribute('fill', '#94a3b8'); t.setAttribute('font-size', '12');
    t.textContent = 'Add chores ↓';
    wheel.appendChild(t);
    return;
  }
  const n = chores.length;
  const sliceAngle = 360 / n;
  const r = 100;
  const palette = ['#2A9D8F','#457B9D','#E8834A','#E76F51','#F4A261','#E9C46A','#264653','#8AB17D','#A98DE6','#EF8AA1'];

  for (let i = 0; i < n; i++) {
    const a0 = (i * sliceAngle - 90) * Math.PI / 180;
    const a1 = ((i+1) * sliceAngle - 90) * Math.PI / 180;
    const x0 = Math.cos(a0)*r, y0 = Math.sin(a0)*r;
    const x1 = Math.cos(a1)*r, y1 = Math.sin(a1)*r;
    const large = sliceAngle > 180 ? 1 : 0;
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', `M0,0 L${x0.toFixed(3)},${y0.toFixed(3)} A${r},${r} 0 ${large} 1 ${x1.toFixed(3)},${y1.toFixed(3)} Z`);
    path.setAttribute('fill', palette[i % palette.length]);
    path.setAttribute('stroke', 'rgba(255,255,255,0.7)');
    path.setAttribute('stroke-width', '0.6');
    wheel.appendChild(path);

    // Label
    const midA = (a0 + a1) / 2;
    const lr = r * 0.62;
    const lx = Math.cos(midA) * lr;
    const ly = Math.sin(midA) * lr;
    const rotDeg = (midA * 180/Math.PI);
    const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    text.setAttribute('x', lx.toFixed(3));
    text.setAttribute('y', ly.toFixed(3));
    text.setAttribute('fill', 'white');
    text.setAttribute('font-size', n > 8 ? '5.5' : '7');
    text.setAttribute('font-weight', '700');
    text.setAttribute('text-anchor', 'middle');
    text.setAttribute('dominant-baseline', 'middle');
    text.setAttribute('transform', `rotate(${rotDeg.toFixed(2)} ${lx.toFixed(3)} ${ly.toFixed(3)})`);
    text.setAttribute('style', 'pointer-events:none; text-shadow:0 1px 2px rgba(0,0,0,0.5)');
    // Truncate long labels
    const label = chores[i].length > 18 ? chores[i].slice(0, 17) + '…' : chores[i];
    text.textContent = label;
    wheel.appendChild(text);
  }

  // Hub
  const hub = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  hub.setAttribute('r', '14');
  hub.setAttribute('fill', '#1f2937');
  hub.setAttribute('stroke', '#fbbf24');
  hub.setAttribute('stroke-width', '2');
  wheel.appendChild(hub);
  const star = document.createElementNS('http://www.w3.org/2000/svg', 'text');
  star.setAttribute('text-anchor','middle'); star.setAttribute('dominant-baseline','central');
  star.setAttribute('font-size','14'); star.textContent = '🎡';
  wheel.appendChild(star);
}

function renderKids() {
  kidsEl.innerHTML = '';
  for (const kid of KIDS) {
    const card = document.createElement('div');
    card.className = 'kid-card';
    const assigned = state.assignments[kid.id];
    card.innerHTML = `
      <div class="kid-name"><span class="kid-dot" style="background:${kid.color}"></span>${kid.name}</div>
      <div class="kid-chore ${assigned ? '' : 'empty'}">${assigned || 'Not assigned yet'}</div>
      <button class="kid-spin" data-kid="${kid.id}">🎲 Spin for ${kid.name}</button>
    `;
    kidsEl.appendChild(card);
  }
  kidsEl.querySelectorAll('.kid-spin').forEach(btn => {
    btn.addEventListener('click', () => spinForKid(btn.dataset.kid));
  });
}

function renderChores() {
  choreListEl.innerHTML = '';
  state.chores.forEach((c, i) => {
    const li = document.createElement('li');
    li.innerHTML = `<span>${escapeHtml(c)}</span><button class="del" aria-label="Delete">✕</button>`;
    li.querySelector('.del').addEventListener('click', () => {
      state.chores.splice(i, 1); saveState(); render();
    });
    choreListEl.appendChild(li);
  });
}

function renderHistory() {
  historyEl.innerHTML = '';
  if (state.history.length === 0) {
    historyEl.innerHTML = '<p class="hint">No locked-in weeks yet. Spin and tap “Lock in this week” when you’re happy.</p>';
    return;
  }
  for (const week of state.history) {
    const div = document.createElement('div');
    div.className = 'history-week';
    let rows = '';
    for (const kid of KIDS) {
      const c = week.assignments[kid.id] || '—';
      rows += `<div class="history-row"><span class="kid-dot" style="background:${kid.color}"></span><span class="name">${kid.name}</span><span>${escapeHtml(c)}</span></div>`;
    }
    div.innerHTML = `<h3>${escapeHtml(week.label)}</h3>${rows}`;
    historyEl.appendChild(div);
  }
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

// ----- Wheel spin logic -----
let currentRotation = 0;
let isSpinning = false;

function lastWeekChoreFor(kidId) {
  const last = state.history[0];
  return last ? last.assignments[kidId] : null;
}

function pickChoreForKid(kidId) {
  const used = new Set(Object.entries(state.assignments)
    .filter(([k]) => k !== kidId)
    .map(([,v]) => v));
  const lastWeek = lastWeekChoreFor(kidId);

  let pool = state.chores.filter(c => !used.has(c));
  if (pool.length === 0) return null;

  // Avoid same as last week if possible
  const filtered = pool.filter(c => c !== lastWeek);
  const final = filtered.length > 0 ? filtered : pool;
  return final[Math.floor(Math.random() * final.length)];
}

function spinForKid(kidId) {
  if (isSpinning) return;
  if (state.chores.length === 0) {
    flashBanner('Add some chores first!');
    return;
  }
  const chore = pickChoreForKid(kidId);
  if (!chore) {
    flashBanner('No chores left in the pool — add more or unlock another kid.');
    return;
  }
  const idx = state.chores.indexOf(chore);
  spinTo(idx, () => {
    state.assignments[kidId] = chore;
    saveState();
    renderKids();
    const kid = KIDS.find(k => k.id === kidId);
    flashBanner(`🎉 ${kid.name} → ${chore}`);
    confettiBurst(kid.color);
  });
}

function spinTo(targetIndex, done) {
  const n = state.chores.length;
  const slice = 360 / n;
  // Pointer is at top. We want slice center to land at top (angle 0 in rotation terms = -90 unrotated).
  // After rotation R, slice i center sits at: (i*slice + slice/2) - 90 + R degrees.
  // We want that = -90 (mod 360) → R ≡ -i*slice - slice/2 (mod 360)
  const targetAngle = -(targetIndex * slice + slice / 2);
  // Add several full spins
  const spins = 5 + Math.floor(Math.random() * 3);
  // Snap to current rotation modulus, then add spins to land at desired
  const currentMod = ((currentRotation % 360) + 360) % 360;
  let delta = ((targetAngle - currentMod) % 360 + 360) % 360;
  // Tiny jitter so it lands a hair off-center but still in slice (stays within ±slice*0.3)
  const jitter = (Math.random() - 0.5) * slice * 0.4;
  const newRotation = currentRotation + (360 - currentMod) + spins * 360 + delta + jitter;

  isSpinning = true;
  currentRotation = newRotation;
  wheel.style.transform = `rotate(${currentRotation}deg)`;

  const onEnd = () => {
    wheel.removeEventListener('transitionend', onEnd);
    isSpinning = false;
    done && done();
  };
  wheel.addEventListener('transitionend', onEnd);
  // Safety
  setTimeout(() => { if (isSpinning) onEnd(); }, 4600);
}

async function spinAll() {
  if (isSpinning) return;
  if (state.chores.length < KIDS.length) {
    flashBanner(`Need at least ${KIDS.length} chores. You have ${state.chores.length}.`);
    return;
  }
  // Reset assignments so we redraw from scratch
  state.assignments = {};
  saveState(); renderKids();
  for (const kid of KIDS) {
    await new Promise(res => {
      const chore = pickChoreForKid(kid.id);
      if (!chore) return res();
      const idx = state.chores.indexOf(chore);
      spinTo(idx, () => {
        state.assignments[kid.id] = chore;
        saveState(); renderKids();
        confettiBurst(kid.color);
        flashBanner(`🎉 ${kid.name} → ${chore}`);
        setTimeout(res, 600);
      });
    });
  }
}

// ----- Lock week -----
function lockWeek() {
  const assigned = Object.keys(state.assignments).length;
  if (assigned === 0) { flashBanner('Spin some chores first!'); return; }
  state.history.unshift({
    weekKey: state.currentWeek,
    label: weekLabel(new Date(state.currentWeek)),
    assignments: { ...state.assignments },
  });
  state.history = state.history.slice(0, 4);
  state.assignments = {};
  // Advance currentWeek to next Monday
  const next = new Date(state.currentWeek);
  next.setDate(next.getDate() + 7);
  state.currentWeek = weekKey(next);
  saveState();
  render();
  flashBanner('🔒 Locked in! Memory rolled forward.');
}

// ----- Chore add -----
addChoreForm.addEventListener('submit', e => {
  e.preventDefault();
  const v = newChoreInput.value.trim();
  if (!v) return;
  if (state.chores.includes(v)) { flashBanner('Already on the list.'); return; }
  state.chores.push(v); saveState(); render();
  newChoreInput.value = '';
});

spinAllBtn.addEventListener('click', spinAll);
lockWeekBtn.addEventListener('click', lockWeek);
resetBtn.addEventListener('click', () => {
  if (!confirm('Reset everything (chores, assignments, history)?')) return;
  localStorage.removeItem(LS_KEY);
  state = loadState();
  saveState();
  render();
});

// ----- Banner / Confetti -----
let bannerTimer;
function flashBanner(text) {
  resultBanner.textContent = text;
  resultBanner.hidden = false;
  clearTimeout(bannerTimer);
  bannerTimer = setTimeout(() => { resultBanner.hidden = true; }, 3500);
}

const confettiCanvas = document.getElementById('confetti');
const cctx = confettiCanvas.getContext('2d');
function resizeCanvas() {
  confettiCanvas.width = window.innerWidth;
  confettiCanvas.height = window.innerHeight;
}
window.addEventListener('resize', resizeCanvas); resizeCanvas();

let particles = [];
function confettiBurst(color) {
  const n = 80;
  const cx = window.innerWidth / 2;
  const cy = window.innerHeight / 3;
  const colors = [color, '#fbbf24', '#ffffff', '#f87171', '#60a5fa'];
  for (let i = 0; i < n; i++) {
    particles.push({
      x: cx, y: cy,
      vx: (Math.random() - 0.5) * 14,
      vy: (Math.random() * -10) - 4,
      g: 0.4 + Math.random()*0.2,
      size: 4 + Math.random()*5,
      color: colors[Math.floor(Math.random()*colors.length)],
      life: 0, maxLife: 80 + Math.random()*40,
      rot: Math.random()*Math.PI*2, vr: (Math.random()-0.5)*0.3,
    });
  }
  if (!confettiRunning) startConfetti();
}
let confettiRunning = false;
function startConfetti() {
  confettiRunning = true;
  function frame() {
    cctx.clearRect(0,0,confettiCanvas.width, confettiCanvas.height);
    particles = particles.filter(p => p.life < p.maxLife);
    for (const p of particles) {
      p.vy += p.g;
      p.x += p.vx; p.y += p.vy;
      p.rot += p.vr;
      p.life++;
      cctx.save();
      cctx.translate(p.x, p.y);
      cctx.rotate(p.rot);
      cctx.globalAlpha = Math.max(0, 1 - p.life / p.maxLife);
      cctx.fillStyle = p.color;
      cctx.fillRect(-p.size/2, -p.size/2, p.size, p.size*0.6);
      cctx.restore();
    }
    if (particles.length > 0) requestAnimationFrame(frame);
    else { confettiRunning = false; cctx.clearRect(0,0,confettiCanvas.width, confettiCanvas.height); }
  }
  requestAnimationFrame(frame);
}

// ----- Kickoff -----
render();
