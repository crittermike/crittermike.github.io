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
const SUGAR = path.join(WIKI, 'sugar.md');
const ALLOWANCE = path.join(WIKI, 'allowance.md');
const SCHOOL = path.join(WIKI, 'school-assignments.md');

// Summer reading 2026 — targets hardcoded; running totals live entirely in the
// dashboard's localStorage (`reading-local-adds`). No wiki source. Mike will
// tell us to remove this block at end of summer.
const READING_TARGETS = {
  thomas:  200,
  william: 400,
  henry:   500,
};

// Display order matches the dashboard grid: youngest → oldest
const KIDS = [
  { key: 'thomas',  name: 'Thomas',  grade: 'rising 3rd'  },
  { key: 'william', name: 'William', grade: 'rising 5th'  },
  { key: 'henry',   name: 'Henry',   grade: 'rising 8th'  },
  { key: 'charlie', name: 'Charlie', grade: 'rising 11th' },
];

/**
 * Today's recurring assignments per kid.
 * Summer mode (Jun/Jul, Mon-Fri): non-Charlie kids get Summer Solutions + 20 min reading.
 * Returns [{id, label}, ...] — id must be stable so localStorage checkbox state survives.
 */
function todaysAssignments(kidKey) {
  // ET date components — server is UTC, so use Intl to avoid date drift.
  const et = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    year: 'numeric', month: 'numeric', day: 'numeric', weekday: 'short',
  }).formatToParts(new Date()).reduce((a, p) => (a[p.type] = p.value, a), {});
  const month = parseInt(et.month, 10);
  const dow = et.weekday; // Mon, Tue, Wed, Thu, Fri, Sat, Sun
  const isSummerWeekday = (month === 6 || month === 7) &&
    ['Mon','Tue','Wed','Thu','Fri'].includes(dow);
  const todayISO = `${et.year}-${String(et.month).padStart(2,'0')}-${String(et.day).padStart(2,'0')}`;
  // "Due today or tomorrow" window — gives Charlie a heads-up the night before.
  const tomorrow = new Date(Date.UTC(parseInt(et.year,10), parseInt(et.month,10)-1, parseInt(et.day,10)+1));
  const tomorrowISO = `${tomorrow.getUTCFullYear()}-${String(tomorrow.getUTCMonth()+1).padStart(2,'0')}-${String(tomorrow.getUTCDate()).padStart(2,'0')}`;

  const out = [];
  if (isSummerWeekday && kidKey !== 'charlie') {
    out.push({ id: 'summer-solutions', label: 'Summer Solutions' });
    out.push({ id: 'reading-20m',      label: 'Read 20 min' });
  }
  if (isSummerWeekday && kidKey === 'charlie') {
    out.push({ id: 'take-medicine',  label: 'Take medicine' });
    out.push({ id: 'popcs-video',    label: 'Finish video for POPCS' });
  }
  // Append one-off items from school-assignments.md due today or tomorrow.
  for (const item of loadSchoolToday(kidKey, [todayISO, tomorrowISO])) {
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
 * Summer reading: server-side base is always 0. The dashboard's tap-to-add
 * widget keeps the running total in localStorage (`reading-local-adds`) and
 * reconciles client-side. We only emit the hardcoded targets here; pages=0 at
 * build time and the client adds its delta on render.
 */
function loadReading() {
  const out = {};
  for (const [kid, target] of Object.entries(READING_TARGETS)) {
    out[kid] = { pages: 0, target, pct: 0 };
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
    assignments: todaysAssignments(k.key),
  }));
};
