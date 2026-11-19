// Math pictures shown on a question card: equal groups, arrays and bar models, drawn as SVG.
// Colors come from CSS (the card's --c), so a figure matches its stage.
const NS = 'http://www.w3.org/2000/svg';
function el(tag, attrs = {}, ...kids) {
  const e = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  e.append(...kids);
  return e;
}
const label = (x, y, text, cls = 'f-t') => el('text', { x, y, class: cls, 'text-anchor': 'middle', 'dominant-baseline': 'central' }, String(text));

// Dots in a small grid, centered on (cx, cy). The last row is centered too.
function dotGrid(g, n, cx, cy, step, r, cols) {
  const rows = Math.ceil(n / cols);
  for (let i = 0; i < n; i++) {
    const row = Math.floor(i / cols), inRow = row === rows - 1 ? n - row * cols : cols;
    const x = cx + ((i % cols) - (inRow - 1) / 2) * step, y = cy + (row - (rows - 1) / 2) * step;
    g.append(el('circle', { cx: x, cy: y, r, class: 'f-dot' }));
  }
}

function groups({ groups: n, each: k }) {
  const R = 46, gap = 18, perRow = n <= 5 ? n : Math.ceil(n / 2), rows = Math.ceil(n / perRow);
  const w = perRow * 2 * R + (perRow - 1) * gap, h = rows * 2 * R + (rows - 1) * gap;
  const g = el('g');
  for (let i = 0; i < n; i++) {
    const row = Math.floor(i / perRow), inRow = row === rows - 1 ? n - row * perRow : perRow;
    const cx = w / 2 + ((i % perRow) - (inRow - 1) / 2) * (2 * R + gap), cy = R + row * (2 * R + gap);
    g.append(el('circle', { cx, cy, r: R - 2, class: 'f-group' }));
    dotGrid(g, k, cx, cy, 23, 7.5, k <= 2 ? k : k <= 4 ? 2 : 3);
  }
  return [g, w, h];
}

function array({ rows, cols }) {
  const step = 34, pad = 22, w = (cols - 1) * step + pad * 2, h = (rows - 1) * step + pad * 2;
  const g = el('g', {}, el('rect', { x: 0, y: 0, width: w, height: h, rx: 18, class: 'f-group' }));
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) g.append(el('circle', { cx: pad + c * step, cy: pad + r * step, r: 10, class: 'f-dot' }));
  return [g, w, h];
}

// Bars of equal units, stacked and lined up on the left. A brace on the right labels the total of all the bars.
function bars({ bars: list, unit, total, names }) {
  const most = Math.max(...list), nameW = names ? 150 : 0;
  const U = Math.min(84, 520 / most), H = 58, gap = 16;
  const h = list.length * H + (list.length - 1) * gap, barsW = most * U;
  const g = el('g');
  list.forEach((n, i) => {
    const y = i * (H + gap);
    if (names?.[i]) g.append(el('text', { x: nameW - 14, y: y + H / 2, class: 'f-name', 'text-anchor': 'end', 'dominant-baseline': 'central' }, names[i]));
    for (let j = 0; j < n; j++) {
      const x = nameW + j * U;
      g.append(el('rect', { x, y, width: U, height: H, rx: 6, class: 'f-unit' + (i % 2 ? ' alt' : '') }));
      if (unit !== undefined) g.append(label(x + U / 2, y + H / 2, unit, U < 52 ? 'f-t small' : 'f-t'));
    }
  });
  let w = nameW + barsW;
  if (total !== undefined) {
    const x = w + 12, b = 16, m = h / 2;
    g.append(el('path', { class: 'f-brace', d: `M${x} 2 Q${x + b} 2 ${x + b} ${b + 2} L${x + b} ${m - b} Q${x + b} ${m} ${x + 2 * b} ${m} Q${x + b} ${m} ${x + b} ${m + b} L${x + b} ${h - b - 2} Q${x + b} ${h - 2} ${x} ${h - 2}` }));
    const tw = Math.max(54, String(total).length * 26 + 18);
    g.append(el('rect', { x: x + 2 * b + 8, y: m - 26, width: tw, height: 52, rx: 14, class: 'f-total' }));
    g.append(label(x + 2 * b + 8 + tw / 2, m, total, 'f-t on'));
    w = x + 2 * b + 8 + tw;
  }
  return [g, w, h];
}

const DRAW = { groups, array, bars };
// What the picture shows, for screen readers.
const DESCRIBE = {
  groups: m => `${m.groups} circles with ${m.each} dots in each`,
  array: m => `${m.rows} rows of ${m.cols} dots`,
  bars: m => m.bars.map((n, i) => `${m.names?.[i] ? m.names[i] + ': ' : ''}a bar of ${n} units${m.unit !== undefined ? ` of ${m.unit}` : ''}`).join(', ')
    + (m.total !== undefined ? `, ${m.total} in all` : ''),
};

export function figure(model) {
  const draw = DRAW[model?.kind];
  if (!draw) return null;
  const [g, w, h] = draw(model);
  const pad = 6;
  return el('svg', { class: 'fig ' + model.kind, viewBox: `${-pad} ${-pad} ${w + pad * 2} ${h + pad * 2}`, role: 'img', 'aria-label': DESCRIBE[model.kind](model) }, g);
}
