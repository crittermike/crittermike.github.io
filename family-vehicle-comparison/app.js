(() => {
  const { VEHICLES, FEATURE_GROUPS, FACTORS } = VC;
  const $ = (s, r = document) => r.querySelector(s);
  const KEY = 'vc-state-v2';
  const DEFAULTS = { type: 'all', power: 'all', iihs: 'any', flat: false, num: {}, feat: {}, miles: 12000, gas: 3.25, elec: 0.15, years: 8, curmpg: null,
    weights: { price: 3, energy: 2, space: 3, features: 2, safety: 2 }, selected: [], browse: 'start', query: '', view: 'cards', diffOnly: false, checks: {}, sort: { key: 'rank', dir: -1 } };
  let st;
  try { st = Object.assign({}, DEFAULTS, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch { st = Object.assign({}, DEFAULTS); }
  st.weights = Object.assign({}, DEFAULTS.weights, st.weights);
  st.num = Object.assign({}, st.num); st.feat = Object.assign({}, st.feat);
  st.selected = [...new Set(st.selected)].filter(id => VEHICLES.some(v => v.id === id)).slice(0, VC.MAX_COMPARE);
  const expanded = new Set();
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(st)); } catch {} };

  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const money = (n) => Number.isFinite(n) ? '$' + Math.round(n).toLocaleString('en-US') : 'n/a';
  const kmoney = (n) => Number.isFinite(n) ? '$' + (n / 1000).toFixed(n >= 100000 ? 0 : 1) + 'k' : 'n/a';
  const num = (n, d = 0) => Number.isFinite(n) ? n.toLocaleString('en-US', { maximumFractionDigits: d, minimumFractionDigits: d }) : 'n/a';
  const assumptions = () => ({ miles: st.miles, gas: st.gas, elec: st.elec, years: st.years });
  const total = (v) => v.price.typical + (v.price.dest || 0);
  const filtered = () => VC.filterVehicles(VEHICLES, st, assumptions());
  const visible = () => VC.discoverVehicles(filtered(), st);
  const POWER = { gas: 'Gas / mild hybrid', hybrid: 'Full hybrid', phev: 'Plug-in hybrid', ev: 'Electric' };
  const ICON = { s: '✓', o: '+', u: '↑', n: '✕', q: '?' };
  const STATUS = { s: 'Standard', o: 'Optional', u: 'Higher trim only', n: 'Not available', q: 'Unverified' };
  const RANK = { s: 4, o: 3, u: 2, q: 1, n: 0 };
  const FCOLORS = { price: 'var(--cp-accent)', energy: 'var(--cp-success)', space: 'var(--cp-warning)', features: 'var(--cp-text-soft)', safety: 'var(--cp-link)' };
  const FLABEL = { price: 'Price', energy: 'Energy cost', space: 'Space', features: 'Features', safety: 'Safety' };
  const featRows = FEATURE_GROUPS.flatMap(g => g.rows.map(([key, label, kind]) => ({ key, label, kind, group: g.name })));
  const icon = (c) => `<i class="ic ic-${c.s}" title="${esc(STATUS[c.s] + (c.note ? ': ' + c.note : ''))}" aria-label="${esc(STATUS[c.s] + (c.note ? ': ' + c.note : ''))}">${ICON[c.s]}</i>`;
  const efficiency = (v) => v.power === 'ev' ? `${v.kwhPer100} kWh/100mi` : `${v.mpg} mpg${v.power === 'phev' ? ' on gas' : ''}`;
  const photos = (v) => (v.photo ? [{ src: v.photo.src, caption: `Exterior. ${v.photo.note} Credit: ${v.photo.credit}. ${v.photo.license}`, alt: v.photo.alt }] : []).concat(v.interior.map(p => ({ src: p.src, caption: `${p.caption} Credit: ${p.credit}`, alt: p.caption })));
  function route() {
    const hash = location.hash.slice(1);
    const page = ['compare', 'features', 'space', 'cost'].includes(hash) ? 'compare' : ['ctl-h', 'rank'].includes(hash) ? 'priorities' : hash === 'checklist' ? 'checklist' : 'explore';
    if (hash.startsWith('card-')) {
      st.browse = 'all'; st.query = ''; st.view = 'cards'; $('#search').value = ''; render();
      const card = document.getElementById(hash);
      if (card) { expanded.add(hash.slice(5)); card.querySelector('[data-details]').open = true; }
    }
    document.querySelectorAll('[data-panel]').forEach(el => { el.hidden = el.dataset.panel !== page; });
    document.querySelectorAll('[data-page]').forEach(el => {
      if (el.dataset.page === page) el.setAttribute('aria-current', 'page'); else el.removeAttribute('aria-current');
    });
    requestAnimationFrame(() => document.getElementById(hash)?.scrollIntoView());
  }
  window.addEventListener('hashchange', route);
  document.querySelector('.browse').addEventListener('click', e => {
    const button = e.target.closest('[data-browse]'); if (!button) return;
    st.browse = button.dataset.browse; st.query = ''; $('#search').value = ''; render();
  });
  $('#search').value = st.query;
  $('#search').addEventListener('input', e => { st.query = e.target.value; render(); });

  /* ---------- controls ---------- */
  const form = $('#controls');
  function syncControls() {
    ['miles', 'gas', 'elec', 'years', 'curmpg'].forEach(k => { const el = $('#' + k); el.value = st[k] ?? ''; el.removeAttribute('aria-invalid'); });
    $('#diff-only').checked = st.diffOnly;
  }
  form.addEventListener('input', (e) => {
    const el = e.target; if (el.type !== 'number') return;
    if (el.id === 'curmpg' && el.value === '') { st.curmpg = null; el.removeAttribute('aria-invalid'); render(); return; }
    const n = Number(el.value);
    const ok = el.value !== '' && Number.isFinite(n) && n >= 0 && (el.id !== 'years' || n >= 1);
    el.setAttribute('aria-invalid', String(!ok));
    if (ok) { st[el.id] = n; render(); }
  });
  $('#reset').addEventListener('click', () => {
    Object.assign(st, { miles: 12000, gas: 3.25, elec: 0.15, years: 8, curmpg: null, weights: Object.assign({}, DEFAULTS.weights) });
    syncControls(); buildWeights(); render();
  });

  /* ---------- filters ---------- */
  const fl = $('#flt'), fd = $('#fd');
  const FEAT_OPTS = [['any', 'Any'], ['trim', 'On some trim'], ['avail', 'On listed trim'], ['std', 'Standard']];
  const AWARD = { 'TSP+': 'Top Safety Pick+', TSP: 'Top Safety Pick' };
  const SELECTS = {
    type: { label: 'Body', opts: [['all', 'Any'], ['van', 'Minivan'], ['suv', 'SUV']] },
    power: { label: 'Powertrain', opts: [['all', 'Any'], ...Object.entries(POWER)] },
    iihs: { label: 'Crash-test award', opts: [['any', 'Any'], ['tsp', 'Top Safety Pick'], ['tspplus', 'Top Safety Pick+']] },
    flat: { label: 'Flat load floor', opts: [['any', 'Any'], ['yes', 'Required']] }
  };
  const NUMS = Object.fromEntries(VC.NUM_FILTERS.map(d => [d.key, d]));
  const numLabel = (d) => d.key === 'own' ? `${st.years}-year cost` : d.label;
  const selRow = (k) => { const d = SELECTS[k]; return `<label class="fr"><span>${esc(d.label)}</span><select data-sel="${k}">${d.opts.map(([v, t]) => `<option value="${v}">${t}</option>`).join('')}</select></label>`; };
  const numRow = (k) => { const d = NUMS[k]; return `<label class="fr"><span data-nl="${k}">${esc(numLabel(d))}</span><span class="nb"><em>${d.dir === 'max' ? 'under' : 'at least'}${d.pre ? ' ' + d.pre : ''}</em><input data-num="${k}" type="number" inputmode="decimal" min="0" step="${d.step}" placeholder="Any">${d.unit ? `<em>${d.unit}</em>` : ''}</span></label>`; };
  const featRow = (key, label) => `<label class="fr"><span>${esc(label)}</span><select data-feat="${key}">${FEAT_OPTS.map(([v, t]) => `<option value="${v}">${t}</option>`).join('')}</select></label>`;
  const GROUPS = [
    { name: 'Basics', open: true, rows: () => ['type', 'power', 'iihs'].map(selRow).join('') + numRow('seats') },
    { name: 'Cost', open: true, rows: () => ['price', 'energy', 'own'].map(numRow).join('') },
    { name: 'Space', rows: () => ['cargo1', 'cargo3', 'leg2', 'leg3', 'length', 'tow', 'range'].map(numRow).join('') }
  ].concat(FEATURE_GROUPS.map(g => ({ name: g.name, rows: () => g.rows.filter(r => r[2] !== 'text').map(([k, l]) => featRow(k, l) + (k === 'flat3' ? selRow('flat') : '')).join('') })));
  function buildFilters() {
    fl.innerHTML = GROUPS.map(g => `<details class="fg"${g.open ? ' open' : ''}><summary>${esc(g.name)}<b></b></summary><div class="frows">${g.rows()}</div></details>`).join('');
  }
  const selVal = (k) => k === 'flat' ? (st.flat ? 'yes' : 'any') : st[k];
  function syncFilters() {
    fl.querySelectorAll('[data-sel]').forEach(el => { el.value = selVal(el.dataset.sel); });
    fl.querySelectorAll('[data-feat]').forEach(el => { el.value = st.feat[el.dataset.feat] || 'any'; });
    fl.querySelectorAll('[data-num]').forEach(el => { if (document.activeElement !== el) { const n = st.num[el.dataset.num]; el.value = Number.isFinite(n) ? n : ''; } });
    fl.querySelectorAll('[data-nl]').forEach(el => { el.textContent = numLabel(NUMS[el.dataset.nl]); });
    fl.querySelectorAll('.fr').forEach(r => { const c = r.querySelector('select,input'); r.classList.toggle('on', c.tagName === 'SELECT' ? !['any', 'all'].includes(c.value) : c.value !== ''); });
    fl.querySelectorAll('.fg').forEach(g => { const n = g.querySelectorAll('.fr.on').length; g.querySelector('summary b').textContent = n || ''; });
  }
  function activeChips() {
    const out = [];
    ['type', 'power', 'iihs', 'flat'].forEach(k => { const v = selVal(k); if (!['any', 'all'].includes(v)) out.push({ id: 's:' + k, text: k === 'flat' ? 'Flat load floor' : SELECTS[k].opts.find(o => o[0] === v)[1] }); });
    VC.NUM_FILTERS.forEach(d => { const n = st.num[d.key]; if (Number.isFinite(n)) out.push({ id: 'n:' + d.key, text: `${numLabel(d)} ${d.dir === 'max' ? '≤' : '≥'} ${d.pre || ''}${n.toLocaleString('en-US')}${d.unit ? ' ' + d.unit : ''}` }); });
    featRows.forEach(r => { const v = st.feat[r.key]; if (v) out.push({ id: 'f:' + r.key, text: `${r.label}${v === 'std' ? ' (std)' : v === 'trim' ? ' (any trim)' : ''}` }); });
    return out;
  }
  function renderFilterBar(list) {
    const chips = activeChips();
    $('#flt-count').textContent = chips.length || '';
    $('#fchips').innerHTML = chips.map(c => `<button type="button" class="fchip" data-rm="${c.id}" aria-label="Remove ${esc(c.text)}">${esc(c.text)}<i>&times;</i></button>`).join('')
      + `<span class="fres">${list.length} of ${VEHICLES.length}</span>`;
    $('#fd-go').textContent = list.length === 1 ? 'Show 1 vehicle' : `Show ${list.length} vehicles`;
    syncFilters();
  }
  $('#fchips').addEventListener('click', (e) => {
    const b = e.target.closest('[data-rm]'); if (!b) return;
    const [t, k] = b.dataset.rm.split(':');
    if (t === 's') { if (k === 'flat') st.flat = false; else st[k] = SELECTS[k].opts[0][0]; }
    else if (t === 'n') delete st.num[k]; else delete st.feat[k];
    render();
  });
  $('#open-flt').addEventListener('click', () => fd.showModal());
  $('#fd-close').addEventListener('click', () => fd.close());
  $('#fd-go').addEventListener('click', () => { fd.close(); $('#vehicles').scrollIntoView(); });
  fd.addEventListener('click', (e) => { if (e.target === fd) fd.close(); });
  fl.addEventListener('change', (e) => {
    const el = e.target;
    if (el.dataset.sel) { const k = el.dataset.sel; if (k === 'flat') st.flat = el.value === 'yes'; else st[k] = el.value; }
    else if (el.dataset.feat) { if (el.value === 'any') delete st.feat[el.dataset.feat]; else st.feat[el.dataset.feat] = el.value; }
    else return;
    render();
  });
  fl.addEventListener('input', (e) => {
    const el = e.target; if (!el.dataset.num) return;
    const k = el.dataset.num, n = Number(el.value);
    if (el.value === '') delete st.num[k];
    else if (Number.isFinite(n) && n >= 0) st.num[k] = n;
    else return;
    render();
  });
  $('#clear-flt').addEventListener('click', () => {
    Object.assign(st, { type: 'all', power: 'all', iihs: 'any', flat: false, num: {}, feat: {} });
    fl.querySelectorAll('[data-num]').forEach(el => { el.value = ''; });
    render();
  });

  /* ---------- ranking ---------- */
  function buildWeights() {
    $('#weights').innerHTML = FACTORS.map(k => `<label><span>${FLABEL[k]}</span><input type="range" min="0" max="5" step="1" name="${k}" value="${st.weights[k]}" aria-label="${FLABEL[k]} weight"><output>${st.weights[k]}</output></label>`).join('');
  }
  $('#weights').addEventListener('input', (e) => {
    if (e.target.type !== 'range') return;
    st.weights[e.target.name] = Number(e.target.value);
    e.target.nextElementSibling.textContent = e.target.value;
    render();
  });
  function renderRanking(list) {
    const ranked = VC.scoreVehicles(list, assumptions(), st.weights);
    const byId = Object.fromEntries(VEHICLES.map(v => [v.id, v]));
    $('#ranking').innerHTML = ranked.slice(0, 5).map((r, i) => {
      const segs = FACTORS.map(k => `<span style="width:${r.parts[k]}%;background:${FCOLORS[k]}" title="${FLABEL[k]}: ${r.parts[k].toFixed(0)}"></span>`).join('');
      return `<li><span class="pos">${i + 1}</span><a class="nm" href="#card-${r.id}">${esc(byId[r.id].short)}</a><span class="stack" role="img" aria-label="Score breakdown">${segs}</span><span class="sc">${r.score.toFixed(0)}</span></li>`;
    }).join('') || '<li>No matches.</li>';
    $('#rank-legend').innerHTML = FACTORS.map(k => `<span><i style="background:${FCOLORS[k]}"></i>${FLABEL[k]}</span>`).join('');
    return Object.fromEntries(ranked.map((r, i) => [r.id, { pos: i + 1, score: r.score }]));
  }

  /* ---------- cards ---------- */
  function renderCards(list) {
    const ul = $('#cards');
    if (!list.length) { ul.innerHTML = '<li class="empty">No matches. Change the group or filters.</li>'; return; }
    ul.innerHTML = list.map(v => {
      const ph = photos(v);
      const e = VC.annualEnergyCost(v, assumptions());
      const sel = st.selected.includes(v.id);
      const full = st.selected.length >= VC.MAX_COMPARE && !sel;
      const cargoDelta = Math.round((v.space.cargo1 / 144.9 - 1) * 100);
      return `<li class="card${sel ? ' selected' : ''}" id="card-${v.id}">
        <div class="card-body">
          <h3>${esc(v.make)} ${esc(v.model)}</h3>
          <p class="trim">${v.year} &middot; ${esc(v.trim)}</p>
          <div class="chips"><span class="chip pw">${v.power === 'gas' ? (/mild hybrid/i.test(v.drivetrain) ? 'Mild hybrid' : 'Gas') : POWER[v.power]}</span><span class="chip">${v.seats} seats</span>${v.provisional ? '<span class="chip verify">Verify specs</span>' : ''}</div>
          <dl class="stats">
            <div><dt>${v.provisional ? 'Est. price' : 'Price + dest.'}</dt><dd>${kmoney(total(v))}</dd></div>
            <div><dt>Max cargo</dt><dd>${v.space.cargo1} <small>cu ft</small></dd></div>
            <div><dt>${v.power === 'ev' ? 'Electric range' : 'Combined MPG'}</dt><dd>${v.power === 'ev' ? `${v.range} <small>mi</small>` : `${v.mpg}${v.power === 'phev' ? ' <small>on gas</small>' : ''}`}</dd></div>
          </dl>
          <p class="cargo-note">${Math.abs(cargoDelta) <= 2 ? 'Cargo \u2248 Odyssey' : `${Math.abs(cargoDelta)}% ${cargoDelta < 0 ? 'less' : 'more'} cargo vs. Odyssey`}</p>
          <p class="floor-note">${VC.flatFloor(v) ? (VC.feature(v, 'remove2').s === 's' && VC.feature(v, 'flat2').s !== 's' ? 'Flat floor: remove 2nd row' : 'Rear rows fold flat') : 'Flat floor: no / unverified'}</p>
          <details data-details="${v.id}"${expanded.has(v.id) ? ' open' : ''}><summary>Details</summary>
          ${v.provisional ? '<p class="src">Price and trim specs need confirmation.</p>' : ''}
          ${ph.length ? `<div class="gallery" data-id="${v.id}">
          <figure><button type="button" data-open="0" aria-label="Enlarge photo"><img src="${ph[0].src}" alt="${esc(ph[0].alt)}" loading="lazy" width="960" height="600"></button></figure>
          <div class="thumbs">${ph.map((p, i) => `<button type="button" data-i="${i}" aria-current="${i === 0}" aria-label="Photo ${i + 1} of ${ph.length}"><img src="${p.src}" alt="" loading="lazy"></button>`).join('')}</div>
          </div>` : ''}
          <dl class="stats">
            <div><dt>Price</dt><dd>${money(total(v))} <small>w/ dest.</small></dd></div>
            <div><dt>Energy / yr</dt><dd>${money(e)}</dd></div>
            <div><dt>Efficiency</dt><dd>${efficiency(v)}</dd></div>
            <div><dt>Range</dt><dd>${num(VC.rangeMiles(v))} <small>mi</small></dd></div>
            <div><dt>Max cargo</dt><dd>${v.space.cargo1} <small>cu ft</small></dd></div>
            <div><dt>Cargo behind 3rd</dt><dd>${v.space.cargo3} <small>cu ft</small></dd></div>
          </dl>
          <ul class="cons">${v.cons.map(p => `<li>${esc(p)}</li>`).join('')}</ul>
          ${v.charging ? `<p class="src"><strong>Charging:</strong> ${esc(v.charging)}</p>` : ''}
          <p class="src">${esc(v.drivetrain)}. ${esc(v.price.note)}</p><p class="src">${v.price.sources.concat(v.efficiencySource).filter((s, i, a) => a.findIndex(x => x.url === s.url) === i).map(s => `<a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.label)}</a>`).join(' · ')}</p>
          </details>
          <button type="button" class="btn" data-cmp="${v.id}" aria-label="${sel ? 'Remove' : 'Compare'} ${esc(v.short)}" aria-pressed="${sel}" ${full ? 'disabled' : ''}>${sel ? 'Selected \u2713' : full ? '3 selected (limit)' : '+ Compare'}</button>
        </div>
      </li>`;
    }).join('');
  }
  $('#cards').addEventListener('toggle', e => {
    const id = e.target.dataset.details;
    if (id) { if (e.target.open) expanded.add(id); else expanded.delete(id); }
  }, true);
  $('#cards').addEventListener('click', (e) => {
    const t = e.target.closest('button'); if (!t) return;
    if (t.dataset.cmp) {
      const id = t.dataset.cmp; st.selected = VC.toggleCompare(st.selected, id); render();
      $(`[data-cmp="${id}"]`)?.focus({ preventScroll: true }); return;
    }
    const g = t.closest('.gallery'); if (!g) return;
    const v = VEHICLES.find(x => x.id === g.dataset.id), ph = photos(v);
    if (t.dataset.i != null) {
      const i = Number(t.dataset.i);
      const img = $('figure img', g); img.src = ph[i].src; img.alt = ph[i].alt;
      $('figure button', g).dataset.open = i;
      g.querySelectorAll('.thumbs button').forEach(b => b.setAttribute('aria-current', String(b === t)));
    } else if (t.dataset.open != null) openLightbox(v, Number(t.dataset.open));
  });

  /* ---------- lightbox ---------- */
  const lb = $('#lb'); let lbV = null, lbI = 0;
  function showLb() { const ph = photos(lbV); lbI = (lbI + ph.length) % ph.length; $('#lb-img').src = ph[lbI].src; $('#lb-img').alt = ph[lbI].alt; $('#lb-cap').textContent = `${lbV.short} · ${lbI + 1}/${ph.length} · ${ph[lbI].caption}`; }
  function openLightbox(v, i) { lbV = v; lbI = i; showLb(); lb.showModal(); }
  $('#lb-prev').onclick = () => { lbI--; showLb(); };
  $('#lb-next').onclick = () => { lbI++; showLb(); };
  $('#lb-close').onclick = () => lb.close();
  lb.addEventListener('click', (e) => { if (e.target === lb) lb.close(); });
  lb.addEventListener('keydown', (e) => { if (e.key === 'ArrowLeft') { lbI--; showLb(); } if (e.key === 'ArrowRight') { lbI++; showLb(); } });
  let tx = null;
  lb.addEventListener('touchstart', (e) => { tx = e.touches[0].clientX; }, { passive: true });
  lb.addEventListener('touchend', (e) => { if (tx == null) return; const dx = e.changedTouches[0].clientX - tx; if (Math.abs(dx) > 40) { lbI += dx < 0 ? 1 : -1; showLb(); } tx = null; });

  /* ---------- big table ---------- */
  function bigColumns() {
    const a = assumptions();
    const cols = [
      { g: 'Cost', key: 'price', label: 'Price', val: total, fmt: v => kmoney(total(v)), best: 'min' },
      { g: 'Cost', key: 'energy', label: 'Energy / yr', val: v => VC.annualEnergyCost(v, a), fmt: v => money(VC.annualEnergyCost(v, a)), best: 'min' },
      { g: 'Cost', key: 'own', label: `${st.years}-yr purchase + energy`, val: v => VC.ownershipCost(v, a, st.years), fmt: v => kmoney(VC.ownershipCost(v, a, st.years)), best: 'min' },
      { g: 'Basics', key: 'rank', label: 'Rank', val: v => -(rankInfo[v.id]?.pos ?? 99), fmt: v => rankInfo[v.id] ? '#' + rankInfo[v.id].pos : 'n/a', best: 'max' },
      { g: 'Basics', key: 'eff', label: 'MPG / kWh', val: v => v.mpg ?? -v.kwhPer100, fmt: v => v.mpg ? v.mpg + ' mpg' : v.kwhPer100 + ' kWh' },
      { g: 'Basics', key: 'range', label: 'Range mi', val: VC.rangeMiles, fmt: v => num(VC.rangeMiles(v)), best: 'max' },
      { g: 'Basics', key: 'seats', label: 'Seats', val: v => v.seats, fmt: v => v.seats },
      { g: 'Basics', key: 'iihs', label: 'Crash-test award', val: v => ({ 'TSP+': 2, TSP: 1 }[v.iihs] || 0), fmt: v => AWARD[v.iihs] || 'Not verified', best: 'max' },
      { g: 'Space', key: 'leg2', label: '2nd-row leg in', val: v => v.space.leg2, fmt: v => num(v.space.leg2, 1), best: 'max' },
      { g: 'Space', key: 'cargo1', label: 'Max cargo', val: v => v.space.cargo1, fmt: v => v.space.cargo1, best: 'max' },
      { g: 'Space', key: 'cargo3', label: 'Cargo behind 3rd', val: v => v.space.cargo3, fmt: v => v.space.cargo3, best: 'max' },
      { g: 'Space', key: 'tow', label: 'Tow lb', val: v => v.space.tow, fmt: v => num(v.space.tow), best: 'max' }
    ];
    featRows.filter(r => r.kind !== 'text').forEach(r => cols.push({ g: r.group, key: 'f:' + r.key, label: r.label, feat: r.key, val: v => RANK[VC.feature(v, r.key).s] }));
    return cols;
  }
  let rankInfo = {};
  function renderBig(list) {
    const cols = bigColumns();
    const col = cols.find(c => c.key === st.sort.key) || cols.find(c => c.key === 'rank');
    const sv = (v) => { const x = col.val(v); return Number.isFinite(x) ? x : -Infinity; };
    const rows = list.slice().sort((x, y) => (sv(x) - sv(y)) * st.sort.dir || (rankInfo[x.id]?.pos ?? 0) - (rankInfo[y.id]?.pos ?? 0));
    const groups = []; cols.forEach(c => { const last = groups[groups.length - 1]; if (last && last.g === c.g) last.n++; else groups.push({ g: c.g, n: 1 }); });
    const bests = {};
    cols.forEach(c => { if (!c.best) return; const vals = list.map(c.val).filter(Number.isFinite); if (vals.length > 1) bests[c.key] = c.best === 'min' ? Math.min(...vals) : Math.max(...vals); });
    const firstOfGroup = new Set(groups.reduce((acc, g) => { acc.push(acc.length ? acc[acc.length - 1] + groups[acc.length - 1].n : 0); return acc; }, []));
    const head = `<thead><tr class="grp"><th scope="col"></th>${groups.map(g => `<th scope="colgroup" colspan="${g.n}">${esc(g.g)}</th>`).join('')}</tr>
      <tr class="cols"><th scope="col">Vehicle</th>${cols.map((c, i) => `<th scope="col"${c.key === col.key ? ` aria-sort="${st.sort.dir === 1 ? 'ascending' : 'descending'}"` : ''}${firstOfGroup.has(i) ? ' class="gs"' : ''}><button type="button" data-sort="${c.key}">${esc(c.label)}</button></th>`).join('')}</tr></thead>`;
    const body = rows.map(v => `<tr><th scope="row"><a href="#card-${v.id}" data-goto="${v.id}">${esc(v.short)}</a></th>${cols.map((c, i) => {
      const gs = firstOfGroup.has(i) ? ' gs' : '';
      if (c.feat) return `<td class="c${gs}">${icon(VC.feature(v, c.feat))}</td>`;
      const isBest = bests[c.key] != null && c.val(v) === bests[c.key];
      return `<td class="${isBest ? 'best' : ''}${gs}">${c.fmt(v)}</td>`;
    }).join('')}</tr>`).join('');
    $('#big-wrap').innerHTML = list.length ? `<table class="big">${head}<tbody>${body}</tbody></table>` : '<p class="empty">No matches.</p>';
    const g = $('#big-wrap .grp'); if (g) $('#big-wrap table').style.setProperty('--grp-h', g.getBoundingClientRect().height + 'px');
  }
  $('#big-wrap').addEventListener('click', (e) => {
    const b = e.target.closest('[data-sort]');
    if (b) { const k = b.dataset.sort, c = bigColumns().find(x => x.key === k); st.sort = { key: k, dir: st.sort.key === k ? -st.sort.dir : c.best === 'min' ? 1 : -1 }; render(); return; }
    const a = e.target.closest('[data-goto]');
    if (a) { e.preventDefault(); expanded.add(a.dataset.goto); setView('cards'); requestAnimationFrame(() => $('#card-' + a.dataset.goto).scrollIntoView({ behavior: 'smooth' })); }
  });
  function setView(v) { st.view = v; render(); }
  document.querySelectorAll('[data-view]').forEach(b => b.addEventListener('click', () => setView(b.dataset.view)));

  /* ---------- feature matrix ---------- */
  function renderMatrix(list) {
    $('#feat-key').innerHTML = Object.keys(ICON).map(k => `<span>${icon({ s: k, note: '' })} ${STATUS[k]}</span>`).join('');
    if (!list.length) { $('#matrix-wrap').innerHTML = '<p class="empty">No matches.</p>'; return; }
    const only = VC.uniqueFeatures(list);
    const differs = (r) => { const vals = list.map(v => { const c = VC.feature(v, r.key); return c.text ?? c.s; }); return new Set(vals).size > 1; };
    let html = `<table class="matrix"><thead><tr><th scope="col">Feature</th>${list.map(v => `<th scope="col">${esc(v.short)}<br><span style="text-transform:none;letter-spacing:0;font-weight:500">${esc(v.trim)}</span></th>`).join('')}</tr></thead><tbody>`;
    FEATURE_GROUPS.forEach(g => {
      const rows = g.rows.map(([key, label, kind]) => ({ key, label, kind })).filter(r => !st.diffOnly || differs(r));
      if (!rows.length) return;
      html += `<tr class="grp"><th scope="rowgroup" colspan="${list.length + 1}"><span>${esc(g.name)}</span></th></tr>`;
      rows.forEach(r => {
        html += `<tr><th scope="row">${esc(r.label)}</th>${list.map(v => {
          const c = VC.feature(v, r.key);
          if (c.text != null) return `<td><span class="cell-note">${esc(c.text)}</span></td>`;
          return `<td><span class="st st-${c.s}"><i>${ICON[c.s]}</i>${c.s === 'n' ? 'No' : STATUS[c.s].replace(' only', '')}</span>${only[r.key] === v.id ? '<span class="only">Only here</span>' : ''}${c.note ? `<span class="cell-note">${esc(c.note)}</span>` : ''}</td>`;
        }).join('')}</tr>`;
      });
    });
    $('#matrix-wrap').innerHTML = html + '</tbody></table>';
  }
  $('#diff-only').addEventListener('change', (e) => { st.diffOnly = e.target.checked; render(); });

  /* ---------- bars ---------- */
  function barGroup(title, unit, list, val, fmt, best = 'max') {
    const vals = list.map(val);
    const max = Math.max(...vals.filter(Number.isFinite), 0) || 1;
    const known = vals.filter(Number.isFinite);
    const target = best === 'max' ? Math.max(...known) : best === 'min' ? Math.min(...known) : null;
    const rows = list.map((v, i) => ({ v, x: vals[i] })).sort((a, b) => best === 'min' ? a.x - b.x : b.x - a.x);
    return `<div class="bar-group"><h3>${esc(title)} <small>${esc(unit)}</small></h3>${rows.map(({ v, x }) => `<div class="bar${x === target && list.length > 1 ? ' top' : ''}"><span class="nm">${esc(v.short)}</span><span class="track"><span class="fill" style="width:${Number.isFinite(x) ? Math.max(2, x / max * 100) : 0}%"></span></span><span class="v">${fmt(x)}</span></div>`).join('')}</div>`;
  }
  function renderSpace(list) {
    if (!list.length) { $('#space-bars').innerHTML = ''; return; }
    const s = (k) => (v) => v.space[k];
    $('#space-bars').innerHTML = [
      barGroup('Max cargo', 'cu ft', list, s('cargo1'), x => x.toFixed(1)),
      barGroup('2nd-row legroom', 'in', list, s('leg2'), x => num(x, 1)),
      barGroup('3rd-row headroom', 'in', list, s('head3'), x => num(x, 1)),
      barGroup('Cargo behind 3rd row', 'cu ft', list, s('cargo3'), x => x.toFixed(1)),
      barGroup('Cargo behind 2nd row', 'cu ft', list, s('cargo2'), x => num(x, 1)),
      barGroup('Length', 'in', list, s('length'), x => x.toFixed(1), 'min'),
      barGroup('Towing', 'lb', list, s('tow'), x => num(x)),
      barGroup('Range', 'mi', list, VC.rangeMiles, x => num(x))
    ].join('');
  }
  function renderCost(list) {
    const a = assumptions();
    if (!list.length) { $('#cost-bars').innerHTML = ''; return; }
    const groups = [
      barGroup(`${st.years}-year purchase + energy`, '', list, v => VC.ownershipCost(v, a, st.years), kmoney, 'min'),
      barGroup('Energy per year', '', list, v => VC.annualEnergyCost(v, a), money, 'min'),
      barGroup('Energy per month', '', list, v => VC.annualEnergyCost(v, a) / 12, money, 'min')
    ];
    if (st.curmpg > 0) {
      const cur = st.miles / st.curmpg * st.gas;
      groups.push(barGroup('Saved per year vs. your car', `${st.curmpg} mpg = ${money(cur)}/yr`, list, v => cur - VC.annualEnergyCost(v, a), x => (x < 0 ? '-' : '') + money(Math.abs(x))));
    }
    $('#cost-bars').innerHTML = groups.join('');
  }

  /* ---------- compare ---------- */
  function renderCompare() {
    const sel = st.selected.map(id => VEHICLES.find(v => v.id === id)).filter(Boolean);
    $('#nav-count').textContent = sel.length;
    $('#compare-tray').hidden = !sel.length;
    $('#selected-names').innerHTML = sel.map(v => `<button type="button" class="fchip" data-remove="${v.id}" aria-label="Remove ${esc(v.short)}">${esc(v.short)} &times;</button>`).join('');
    $('#compare-link').textContent = `Compare (${sel.length}/3)`;
    $('#clear-cmp').hidden = !sel.length;
    $('#comparison-details').hidden = sel.length < 2;
    if (sel.length < 2) { $('#compare-out').innerHTML = `<p class="empty">${sel.length ? 'Select one more.' : 'Select 2 or 3 vehicles.'} <a href="#vehicles">Explore</a></p>`; return; }
    const a = assumptions();
    const rows = [
      ['Price w/ destination', total, money, 'min'],
      ['Energy per year', v => VC.annualEnergyCost(v, a), money, 'min'],
      [`${st.years}-year purchase + energy`, v => VC.ownershipCost(v, a, st.years), money, 'min'],
      ['Efficiency', null, efficiency],
      ['Range', VC.rangeMiles, x => num(x) + ' mi', 'max'],
      ['Seats', v => v.seats, x => x, 'max'],
      ['Max cargo', v => v.space.cargo1, x => x + ' cu ft', 'max'],
      ['Cargo behind 3rd', v => v.space.cargo3, x => x + ' cu ft', 'max'],
      ['2nd-row legroom', v => v.space.leg2, x => Number.isFinite(x) ? x + ' in' : 'Unverified', 'max'],
      ['Flat load floor', null, v => VC.flatFloor(v) ? (VC.feature(v, 'remove2').s === 's' && VC.feature(v, 'flat2').s !== 's' ? 'Remove 2nd row' : 'Rear rows fold') : 'No / unverified'],
      ['Center screen', null, v => VC.feature(v, 'screens').text || 'Unverified'],
      ['Electric-only range', null, v => v.power === 'ev' ? `${v.range} mi` : v.electricRange ? `${v.electricRange} mi (PHEV)` : 'Not applicable'],
      ['Towing', v => v.space.tow, x => num(x) + ' lb', 'max'],
      ['Crash-test award', null, v => AWARD[v.iihs] || 'Not verified'],
      ['Drivetrain', null, v => v.drivetrain]
    ];
    let html = `<div class="table-wrap"><table><thead><tr><th scope="col">2025 models</th>${sel.map(v => `<th scope="col">${esc(v.short)}${v.provisional ? '<br>Verify specs' : ''}</th>`).join('')}</tr></thead><tbody>`;
    rows.forEach(([label, val, fmt, best]) => {
      let target = null;
      if (val && best) { const xs = sel.map(val).filter(Number.isFinite); target = best === 'min' ? Math.min(...xs) : Math.max(...xs); }
      html += `<tr><th scope="row">${esc(label)}</th>${sel.map(v => val ? `<td class="${val(v) === target ? 'best' : ''}">${esc(fmt(val(v)))}</td>` : `<td>${esc(fmt(v))}</td>`).join('')}</tr>`;
    });
    const diffRows = featRows.filter(r => r.kind !== 'text' && new Set(sel.map(v => VC.feature(v, r.key).s)).size > 1);
    if (diffRows.length) {
      html += `<tr class="grp"><th scope="rowgroup" colspan="${sel.length + 1}">Features that differ</th></tr>`;
      diffRows.forEach(r => { html += `<tr><th scope="row">${esc(r.label)}</th>${sel.map(v => { const c = VC.feature(v, r.key); return `<td>${icon(c)}${c.note ? ` <span class="cell-note" style="display:inline">${esc(c.note)}</span>` : ''}</td>`; }).join('')}</tr>`; });
    }
    $('#compare-out').innerHTML = html + '</tbody></table></div>';
  }
  $('#selected-names').addEventListener('click', e => {
    const button = e.target.closest('[data-remove]'); if (!button) return;
    st.selected = st.selected.filter(id => id !== button.dataset.remove); render();
    ($('#selected-names button') || $('[data-page="explore"]')).focus({ preventScroll: true });
  });
  $('#clear-cmp').addEventListener('click', () => { st.selected = []; render(); $('[data-page="explore"]').focus({ preventScroll: true }); });

  /* ---------- checklist ---------- */
  const CHECKS = [
    'Install every car seat you own in the seats you’d actually use, then check that the 3rd row is still reachable',
    'Have an adult sit in the 3rd row for 10 minutes',
    'Load the stroller, groceries and sports gear behind the 3rd row with all seats up',
    'Measure your garage and check the car fits with the liftgate open',
    'Pair your phone; try CarPlay/Android Auto and the phone key',
    'Reach every climate and seat-heat control while driving; count how many are screen-only',
    'Try the rear-seat camera or intercom from the driver’s seat with the kids in back',
    'Hybrids: floor it from a stop and listen for engine drone',
    'EVs: check public chargers on your usual trips and get a home charger install quote',
    'Run the VIN at nhtsa.gov/recalls (Grand Highlander airbag, EV9 ICCU, EX90 computer upgrade)',
    'Get insurance quotes for your top two',
    'Ask about dealer markups, add-ons and current incentives in writing',
    'Fold or remove both rear rows yourself; measure the narrowest width and usable length for a 4x8 sheet'
  ];
  function buildChecklist() {
    $('#chk').innerHTML = CHECKS.map((c, i) => `<li><label><input type="checkbox" data-c="${i}" ${st.checks[i] ? 'checked' : ''}><span>${esc(c)}</span></label></li>`).join('');
  }
  $('#chk').addEventListener('change', (e) => { st.checks[e.target.dataset.c] = e.target.checked; save(); });
  $('#clear-chk').addEventListener('click', () => { st.checks = {}; buildChecklist(); save(); });

  /* ---------- render ---------- */
  function render() {
    const list = visible();
    renderFilterBar(list);
    document.querySelectorAll('[data-browse]').forEach(b => b.setAttribute('aria-pressed', String(!st.query.trim() && b.dataset.browse === st.browse)));
    rankInfo = renderRanking(filtered());
    const table = st.view === 'table';
    document.querySelectorAll('[data-view]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.view === st.view)));
    $('#cards').hidden = table; $('#big').hidden = !table;
    if (table) renderBig(list); else renderCards(list);
    const selected = st.selected.map(id => VEHICLES.find(v => v.id === id)).filter(Boolean);
    renderMatrix(selected); renderSpace(selected); renderCost(selected); renderCompare();
    save();
  }

  buildFilters(); syncControls(); buildWeights(); buildChecklist(); render(); route();
})();
