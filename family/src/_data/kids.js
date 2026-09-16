/**
 * Per-kid dashboard data: sugar balance + allowance balance + today's assignments.
 *
 * Sources of truth (read-only at build time, no duplication):
 *   - wiki/concepts/sugar.md                 (Balances table)
 *   - wiki/concepts/allowance.md             (Balances table)
 *   - wiki/concepts/school-assignments.md    (Upcoming, assigned tonight + due tomorrow)
 *
 * Returns:
 *   [
 *     { key, name, grade, sugar: {balance, refill}, allowance: {balance_str} },
 *     ...
 *   ]
 *
 * The kid roster + display order is defined here. Targets (sugar refill)
 * are pulled from the source files themselves so they stay in sync.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { dueTomorrowAssignments } = require('../lib/school-homework');

const WIKI = path.join(os.homedir(), '.hermes', 'workspace', 'wiki', 'concepts');
const SUGAR = path.join(WIKI, 'sugar.md');
const ALLOWANCE = path.join(WIKI, 'allowance.md');
const SCHOOL = path.join(WIKI, 'school-assignments.md');

// Summer reading + Summer Solutions removed 2026-08-19 (school year started, per Mike).
// The old READING_TARGETS / READING_DONE / SOLUTIONS_DONE sets and the summer-weekday
// branch are gone. Kid todos now come solely from school-assignments.md (assigned tonight or due tomorrow).

// Display order matches the dashboard grid: youngest → oldest
const KIDS = [
  { key: 'thomas',  name: 'Thomas',  grade: '3rd'  },
  { key: 'william', name: 'William', grade: '5th'  },
  { key: 'henry',   name: 'Henry',   grade: '8th'  },
  { key: 'charlie', name: 'Charlie', grade: '11th' },
];

function readSafe(p) {
  try { return fs.readFileSync(p, 'utf8'); } catch { return ''; }
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

/**
 * Parse William's Guinea Pig Fund balance from allowance.md.
 * Source line: "### 🐹 William's Guinea Pig Fund: $119.34"
 * William-only (60% of his positive additions auto-save here). Returns the
 * formatted string or null.
 */
function loadGuineaPigFund() {
  const text = readSafe(ALLOWANCE);
  if (!text) return null;
  const m = text.match(/Guinea Pig Fund:\s*(\$-?[\d,]+\.\d{2})/i);
  return m ? m[1] : null;
}

module.exports = function () {
  const sugar = loadSugar();
  const allowance = loadAllowance();
  const guineaPig = loadGuineaPigFund();
  const school = readSafe(SCHOOL);
  const now = new Date();

  return KIDS.map(k => ({
    key: k.key,
    name: k.name,
    grade: k.grade,
    sugar: {
      balance: sugar.balances[k.key] != null ? sugar.balances[k.key] : null,
      refill: sugar.refill,
    },
    allowance: {
      balance_str: allowance[k.key] || null,
    },
    // William-only: 60/40 Guinea Pig Fund savings balance. null for everyone else.
    guineaPig: k.key === 'william' ? guineaPig : null,
    assignments: dueTomorrowAssignments(school, k.key, now),
  }));
};
