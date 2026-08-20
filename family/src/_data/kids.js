/**
 * Per-kid dashboard data: sugar balance + allowance balance + today's assignments.
 *
 * Sources of truth (read-only at build time, no duplication):
 *   - wiki/concepts/sugar.md                 (Balances table)
 *   - wiki/concepts/allowance.md             (Balances table)
 *   - wiki/concepts/school-assignments.md    (Upcoming, due-tomorrow rows)
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

const WIKI = path.join(os.homedir(), '.hermes', 'workspace', 'wiki', 'concepts');
const SUGAR = path.join(WIKI, 'sugar.md');
const ALLOWANCE = path.join(WIKI, 'allowance.md');
const SCHOOL = path.join(WIKI, 'school-assignments.md');

// Summer reading + Summer Solutions removed 2026-08-19 (school year started, per Mike).
// The old READING_TARGETS / READING_DONE / SOLUTIONS_DONE sets and the summer-weekday
// branch are gone. Kid todos now come solely from school-assignments.md (due tomorrow).

// Display order matches the dashboard grid: youngest → oldest
const KIDS = [
  { key: 'thomas',  name: 'Thomas',  grade: '3rd'  },
  { key: 'william', name: 'William', grade: '5th'  },
  { key: 'henry',   name: 'Henry',   grade: '8th'  },
  { key: 'charlie', name: 'Charlie', grade: '11th' },
];

/**
 * Today's recurring assignments per kid.
 * School year: one-off items from school-assignments.md due TOMORROW.
 * Returns [{id, label}, ...] — id must be stable so localStorage checkbox state survives.
 */
function todaysAssignments(kidKey) {
  // ET date components — server is UTC, so use Intl to avoid date drift.
  const et = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    year: 'numeric', month: 'numeric', day: 'numeric', weekday: 'short',
  }).formatToParts(new Date()).reduce((a, p) => (a[p.type] = p.value, a), {});
  // "Due tomorrow" window — heads-up the night before, not the due-date morning.
  const tomorrow = new Date(Date.UTC(parseInt(et.year,10), parseInt(et.month,10)-1, parseInt(et.day,10)+1));
  const tomorrowISO = `${tomorrow.getUTCFullYear()}-${String(tomorrow.getUTCMonth()+1).padStart(2,'0')}-${String(tomorrow.getUTCDate()).padStart(2,'0')}`;

  const out = [];
  // Laundry chores removed from kid todos per Mike 2026-08-17.
  // Append one-off items from school-assignments.md due TOMORROW only.
  // Showing on the due date itself is too late (homework's due that morning,
  // not that evening) and just repeats what was already checked off the day
  // before. The dashboard is a heads-up the night before, not a due-date log.
  for (const item of loadSchoolToday(kidKey, [tomorrowISO])) {
    out.push(item);
  }
  return out;
}

/**
 * Parse school-assignments.md, return items for `kidKey` whose date is in `dateISOs`.
 * File structure: "### <Kid name> (...)" sections under "## Upcoming",
 * with rows like "- **2026-06-11 (Thu):** Finish video for POPCS".
 * Stops at "## Completed".
 */
function loadSchoolToday(kidKey, dateISOs) {
  const text = readSafe(SCHOOL);
  if (!text) return [];
  const upcoming = text.match(/## Upcoming([\s\S]*?)(?=^## Completed|\Z)/m);
  const body = upcoming ? upcoming[1] : text;
  const wanted = new Set(Array.isArray(dateISOs) ? dateISOs : [dateISOs]);

  const sections = body.split(/^###\s+/m).slice(1);
  const kidNameLower = kidKey.toLowerCase();
  const out = [];
  for (const sec of sections) {
    const header = sec.split('\n', 1)[0].toLowerCase();
    if (!header.startsWith(kidNameLower)) continue;
    const rowRe = /^- \*\*(\d{4}-\d{2}-\d{2})[^*]*\*\*\s*(.+)$/gm;
    let m;
    while ((m = rowRe.exec(sec)) !== null) {
      if (!wanted.has(m[1])) continue;
      const desc = m[2].trim();
      const id = `sch-${m[1]}-${desc.toLowerCase().replace(/[^a-z0-9]+/g,'-').slice(0,40)}`;
      out.push({ id, label: desc });
    }
  }
  return out;
}

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
    assignments: todaysAssignments(k.key),
  }));
};
