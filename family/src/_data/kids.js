/**
 * Per-kid dashboard data: summer reading progress + sugar balance + allowance balance.
 *
 * Sources of truth (read-only at build time, no duplication):
 *   - wiki/concepts/summer-reading-2026.md   (Progress log: latest line wins)
 *   - wiki/concepts/sugar.md                 (Balances table)
 *   - wiki/concepts/allowance.md             (Balances table)
 *
 * Returns:
 *   [
 *     { key, name, grade, reading: {pages, target, pct} | null, sugar: {balance, refill}, allowance: {balance_str} },
 *     ...
 *   ]
 *
 * The kid roster + display order is defined here. Targets (reading & sugar refill)
 * are pulled from the source files themselves so they stay in sync.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

const WIKI = path.join(os.homedir(), '.hermes', 'workspace', 'wiki', 'concepts');
const READING = path.join(WIKI, 'summer-reading-2026.md');
const SUGAR = path.join(WIKI, 'sugar.md');
const ALLOWANCE = path.join(WIKI, 'allowance.md');

// Display order matches the dashboard grid: Charlie, Henry, William, Thomas
const KIDS = [
  { key: 'charlie', name: 'Charlie', grade: 'rising 11th' },
  { key: 'henry',   name: 'Henry',   grade: 'rising 8th'  },
  { key: 'william', name: 'William', grade: 'rising 5th'  },
  { key: 'thomas',  name: 'Thomas',  grade: 'rising 3rd'  },
];

function readSafe(p) {
  try { return fs.readFileSync(p, 'utf8'); } catch { return ''; }
}

/**
 * Parse the summer reading file. Returns per-kid {pages, target}.
 * Targets come from the "Targets" table. Latest progress line wins.
 *   - YYYY-MM-DD: Thomas N, William N, Henry N (notes)
 */
function loadReading() {
  const text = readSafe(READING);
  if (!text) return {};

  // Targets table
  const targets = {};
  const targetRe = /\|\s*(Thomas|William|Henry|Charlie)\s*\|.*?\|\s*(\d+)\s*\|/gi;
  let m;
  while ((m = targetRe.exec(text)) !== null) {
    targets[m[1].toLowerCase()] = parseInt(m[2], 10);
  }

  // Latest progress log line — scan in order, last match wins
  const progress = {};
  const lineRe = /^- (\d{4}-\d{2}-\d{2}):\s*(.+)$/gm;
  let lastLine = null;
  while ((m = lineRe.exec(text)) !== null) lastLine = m[2];
  if (lastLine) {
    // "Thomas 0, William 0, Henry 0 (challenge announced)"
    const partRe = /(Thomas|William|Henry|Charlie)\s+(\d+)/gi;
    let p;
    while ((p = partRe.exec(lastLine)) !== null) {
      progress[p[1].toLowerCase()] = parseInt(p[2], 10);
    }
  }

  const out = {};
  for (const kid of ['thomas','william','henry','charlie']) {
    if (targets[kid] != null) {
      out[kid] = {
        pages: progress[kid] || 0,
        target: targets[kid],
        pct: Math.min(100, Math.round((progress[kid] || 0) / targets[kid] * 100)),
      };
    }
  }
  return out;
}

/**
 * Parse the sugar.md Balances table.
 * | Charlie (15) | 156 |
 * Refill is parsed from policy line: "**60g/week per kid, refilled every Saturday**"
 */
function loadSugar() {
  const text = readSafe(SUGAR);
  if (!text) return { balances: {}, refill: 60 };

  // Refill amount
  let refill = 60;
  const refillMatch = text.match(/\*\*(\d+)\s*g\/week/);
  if (refillMatch) refill = parseInt(refillMatch[1], 10);

  // Balances table: pull rows under "## Balances" until next "##"
  const balances = {};
  const balSection = text.match(/## Balances([\s\S]*?)(?=^##\s)/m);
  const body = balSection ? balSection[1] : text;
  const rowRe = /\|\s*(Charlie|Henry|William|Thomas)[^|]*\|\s*(-?\d+)\s*\|/gi;
  let m;
  while ((m = rowRe.exec(body)) !== null) {
    balances[m[1].toLowerCase()] = parseInt(m[2], 10);
  }
  return { balances, refill };
}

/**
 * Parse the allowance.md Balances table.
 * | Charlie (15) | $-273.23 |
 */
function loadAllowance() {
  const text = readSafe(ALLOWANCE);
  if (!text) return {};
  const balances = {};
  const balSection = text.match(/## Balances([\s\S]*?)(?=^##\s|^###\s)/m);
  const body = balSection ? balSection[1] : text;
  // Match e.g.  | Charlie (15) | $-273.23 |  or  | Henry (12) | $72.13 |
  const rowRe = /\|\s*(Charlie|Henry|William|Thomas)[^|]*\|\s*(\$-?[\d,]+\.\d{2})\s*\|/gi;
  let m;
  while ((m = rowRe.exec(body)) !== null) {
    balances[m[1].toLowerCase()] = m[2];
  }
  return balances;
}

module.exports = function () {
  const reading = loadReading();
  const sugar = loadSugar();
  const allowance = loadAllowance();

  return KIDS.map(k => ({
    key: k.key,
    name: k.name,
    grade: k.grade,
    reading: reading[k.key] || null,
    sugar: {
      balance: sugar.balances[k.key] != null ? sugar.balances[k.key] : null,
      refill: sugar.refill,
    },
    allowance: {
      balance_str: allowance[k.key] || null,
    },
  }));
};
