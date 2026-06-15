/**
 * Calendar data layer — pulls from iCloud CalDAV via cal_today.py.
 *
 * Single source of truth: ~/.hermes/scripts/cal_today.py --days 90 --json
 * That script reads all of Mike's iCloud calendars (home, family, work,
 * microsoft-work, thomas-soccer) over CalDAV and outputs sorted JSON in ET.
 *
 * We normalize each event to the shape the dashboard expects:
 *   { date: 'YYYY-MM-DD', time: '6:00p' | 'all day', what, who, calendar }
 *
 * `who` is heuristically inferred from event summary so the existing per-person
 * pill colors light up. Calendar source is preserved separately for filtering.
 *
 * Build-time. If CalDAV is unreachable we return [] (template hides the widget).
 */

const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const SCRIPT = path.join(os.homedir(), '.hermes', 'scripts', 'cal_today.py');

// Pull a wide window so the "See all" modal has 2-3 months of forward visibility.
const DAYS = 90;

function fmtTime(dateStr, allDay) {
  if (allDay) return 'all day';
  // cal_today.py returns ISO with explicit offset, e.g. "2026-06-07T08:00:00-04:00".
  // We MUST format in that original offset (ET), not the server's local TZ (UTC).
  // Parse hour/minute directly from the string instead of relying on Date.getHours().
  const m = dateStr.match(/T(\d{2}):(\d{2})/);
  if (!m) return '';
  let h = parseInt(m[1], 10);
  const mm = parseInt(m[2], 10);
  const ampm = h >= 12 ? 'p' : 'a';
  h = ((h + 11) % 12) + 1;
  return mm === 0 ? `${h}${ampm}` : `${h}:${String(mm).padStart(2,'0')}${ampm}`;
}

function inferWho(summary, calendar) {
  const s = (summary || '').toLowerCase();
  // Most specific first — name matches beat generic patterns.
  if (/\bcharlie\b/.test(s)) return 'charlie';
  if (/\bhenry\b/.test(s))   return 'henry';
  if (/\bwilliam\b/.test(s)) return 'william';
  if (/\bthomas\b/.test(s))  return 'thomas';
  if (/\bnancy\b/.test(s))   return 'nancy';
  if (/\bmike\b/.test(s))    return 'mike';
  if (/date night|anniversary|valentine/.test(s)) return 'parents';
  if (calendar === 'thomas-soccer') return 'thomas';
  if (calendar === 'family') return 'family';
  if (calendar === 'work' || calendar === 'microsoft-work' || calendar === 'outlook') return 'mike';
  return 'family';
}

// Retry cal_today.py up to MAX_TRIES times. Treats both throws AND a successful
// run that yields 0 events as transient CalDAV failures — the 90-day window
// across all of Mike's calendars is never legitimately empty (outlook alone
// produces hundreds), so [] means a connection blip we should retry through.
const MAX_TRIES = 3;
const RETRY_DELAY_MS = 2000;

function sleepSync(ms) {
  // Node's execFileSync is blocking already; use a tiny busy-wait via spawnSync.
  const { spawnSync } = require('child_process');
  spawnSync('sleep', [String(ms / 1000)]);
}

function fetchEventsOnce() {
  let raw;
  try {
    raw = execFileSync('python3', [SCRIPT, '--days', String(DAYS), '--json'], {
      encoding: 'utf8',
      timeout: 30000,
      maxBuffer: 8 * 1024 * 1024,
    });
  } catch (e) {
    return { ok: false, reason: `script error: ${e.message}` };
  }
  try {
    const parsed = JSON.parse(raw);
    return { ok: true, events: parsed };
  } catch (e) {
    return { ok: false, reason: `invalid JSON: ${e.message}` };
  }
}

module.exports = function () {
  // Local-dev fast path: on a machine without Mike's ~/.hermes tree the script
  // is absent, so skip the 3×2s retry/sleep loop and return [] immediately.
  // Keeps hot reload snappy; the widget just renders empty. On Mike's main
  // machine the script exists and the normal CalDAV retry logic runs.
  if (!fs.existsSync(SCRIPT)) {
    console.warn(`[calendar] ${SCRIPT} not found — returning [] (calendar widget will be empty)`);
    return [];
  }

  let events = null;
  let lastReason = '';
  for (let attempt = 1; attempt <= MAX_TRIES; attempt++) {
    const result = fetchEventsOnce();
    if (result.ok && Array.isArray(result.events) && result.events.length > 0) {
      events = result.events;
      if (attempt > 1) {
        console.warn(`[calendar] succeeded on attempt ${attempt} (${events.length} events)`);
      }
      break;
    }
    lastReason = result.ok
      ? `empty result (0 events) — likely CalDAV blip`
      : result.reason;
    console.warn(`[calendar] attempt ${attempt}/${MAX_TRIES} failed: ${lastReason}`);
    if (attempt < MAX_TRIES) sleepSync(RETRY_DELAY_MS);
  }
  if (!events) {
    console.warn(`[calendar] all ${MAX_TRIES} attempts failed — calendar will be empty (${lastReason})`);
    return [];
  }

  const out = [];
  // Kitchen dashboard shows family-relevant calendars only.
  // Mike's work focus blocks and lunch reminders are noise here.
  const KITCHEN_CALS = new Set(['home', 'family', 'thomas-soccer']);
  for (const ev of events) {
    if (!ev || !ev.start) continue;
    if (!KITCHEN_CALS.has(ev.calendar)) continue;
    const date = ev.start.slice(0, 10);  // YYYY-MM-DD from ISO with TZ
    out.push({
      date,
      time: fmtTime(ev.start, ev.all_day),
      what: ev.summary || '(no title)',
      who: inferWho(ev.summary, ev.calendar),
      calendar: ev.calendar || '',
      all_day: !!ev.all_day,
      end: ev.end || '',
    });
  }
  return out;
};
