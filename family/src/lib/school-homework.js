/**
 * Strict dashboard projection, not a general reminder feed.
 * Read only Upcoming/<kid>: explicit homework assigned today, or due tomorrow.
 * Ordinary deliverables require deadline or dated submission evidence. A dated
 * standalone recitation is an assessed deliverable and renders as preparation.
 * Work-on dates qualify only on their assigned day, never as invented deadlines.
 * Tracking-only uncertainty, events and study-only items do not qualify.
 * Prefer atomic source rows; legacy lists can share `Homework due:` or a
 * standalone `; due <date>` clause. Never re-date a daily plan in this parser.
 */
'use strict';

const { createHash } = require('node:crypto');

function tomorrowInEastern(now) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(now).reduce((out, part) => (out[part.type] = part.value, out), {});
  return new Date(Date.UTC(+parts.year, +parts.month - 1, +parts.day + 1)).toISOString().slice(0, 10);
}

const SUBJECT = '(?:Honors English|Language Arts|Social Studies|Simple Solutions|Course III|Reading|Spelling|Math|Algebra|English|Spanish|Chemistry|Biology|Science|Religion|History|Grammar|DOL)';
const subjectStart = new RegExp(`^(${SUBJECT}(?:\\s*\\([^)]*\\))?)(?::|\\s+-|\\s+(?=WB|workbook|EIE|IXL))\\s*`, 'i');
const CONTINUATION = /^(?:show all work|thoroughly answer|answer (?:any|all|one|each|the|these)\b.*\bprompts?\b|one step at a time)\b/i;

// Split only at top level: semicolons in source notes and commas in page/problem
// ranges belong to the same task. A conjunction is not inherently a new task.
function splitClauses(text, conjunctions = true) {
  const pieces = [];
  const boundary = new RegExp(`^(?:,\\s+|\\s+(?:and|\\+)\\s+)(?=${SUBJECT}\\b|\\d+\\.\\d+\\s*[#(]|(?:study|review|quiz|test|read|annotate|write|answer|complete|finish|submit)\\b)`, 'i');
  let depth = 0;
  let start = 0;
  for (let i = 0; i < text.length; i++) {
    if (text[i] === '(' || text[i] === '[') depth++;
    if (text[i] === ')' || text[i] === ']') depth = Math.max(0, depth - 1);
    if (depth) continue;
    const separator = text[i] === ';' ? ';' : (conjunctions ? (text.slice(i).match(boundary) || [''])[0] : '');
    if (!separator) continue;
    pieces.push(text.slice(start, i).trim());
    i += separator.length - 1;
    start = i + 1;
  }
  pieces.push(text.slice(start).trim());
  return pieces.filter(Boolean);
}

const UNCERTAIN = /tracking date|submission date not stated|\b(?:unconfirmed|unknown|unclear|uncertain|TBD|cancelled|canceled)\b|✅|(?:date|deadline)s?[^.;]*(?:not (?:stated|shown|provided|specified|confirmed|listed|established)|missing|needs? confirmation)|no (?:confirmed |email |explicit )?(?:submission |due )?(?:date|deadline)|pending clarification|not due|makeup opportunities|due\s*\?|due\s+(?:next|soon|later)\b/i;
const NON_HOMEWORK = /\b(?:school mass|cardinal friday|field trip|choir|chess club|picture day|spirit (?:night|wear)|school (?:event|supplies)|binder setup|parking[- ]pass|jersey orders|eligibility paperwork|permission (?:slip|form)|registration|orientation|school concert|parent.teacher conference)\b/i;
const MONTH = '(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)';
const DATE_TOKEN = `(?:\\d{4}-\\d{2}-\\d{2}|${MONTH}\\.?\\s+\\d{1,2}(?:,\\s*\\d{4})?|\\d{1,2}/\\d{1,2}(?:/\\d{4})?|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)`;
const DEADLINE_DATE = `${DATE_TOKEN}(?:,?\\s+${MONTH}\\.?\\s+\\d{1,2}(?:,\\s*\\d{4})?)?`;
const dueDatePattern = new RegExp(`\\b(?:due|deadline)(?:\\s+(?:on|by))?\\s+(${DEADLINE_DATE})`, 'gi');
const dueTextPattern = new RegExp(`[,\\s]*\\b(?:due|deadline)(?:\\s+(?:on|by))?(?:\\s+${DEADLINE_DATE})?\\s*:?`, 'gi');
const SUBMITTED = '(?:submitted|turned in|handed in|uploaded)';
const PASSIVE_SUBMISSION = `(?:must be|needs? to be|should be|to be)\\s+${SUBMITTED}`;
const SUBMISSION_ACTION = new RegExp(`\\b(?:submit|turn in|hand in|upload|${PASSIVE_SUBMISSION})\\b`, 'i');
const PENDING_STATUS = new RegExp(`\\b(?:not(?:\\s+yet)?(?:\\s+been)?|never|(?:still\\s+)?needs? to be|must be|should be|to be)\\s+(?:${SUBMITTED}|completed|done|finished)\\b`, 'gi');
const OPTIONAL = /\b(?:optional (?:practice|work)|(?:completion|submission) (?:is )?not required|study resource)\b/i;

// A submission imperative supplies deadline evidence without the word "due".
// Source annotations are removed before inspecting dates. Do not borrow a date
// from a sibling clause (e.g. an undated essay followed by Monday's quiz).
function submissionDates(text) {
  const dates = [];
  for (const clause of splitClauses(text)) {
    const action = clause.match(SUBMISSION_ACTION);
    if (!action) continue;
    const instruction = clause.slice(action.index).replace(/\b(Mr|Mrs|Ms|Dr|p|pp)\./gi, '$1')
      .split(/\.(?:\s+|$)/)[0];
    const deadline = instruction.match(new RegExp(`(?:\\b(?:by|on)\\s+(${DEADLINE_DATE})|\\b(${DEADLINE_DATE})(?=\\s*(?:$|for\\b|at\\b)))`, 'i'));
    if (deadline) {
      for (const match of (deadline[1] || deadline[2]).matchAll(new RegExp(DATE_TOKEN, 'gi'))) dates.push(match[0]);
    }
  }
  return dates;
}

function hasDeadline(group, clause) {
  return /\b(?:due(?!\s+to\b)|deadline)\b/i.test(group) || submissionDates(clause).length > 0;
}

// Action + object is evidence of work even when the teacher uses a new title
// or deliverable noun. Bare notices still need a concrete coursework shape.
function concreteTask(text) {
  return SUBMISSION_ACTION.test(text) || /\b(?:complete|finish|write|answer|solve|respond to|create|draw|record|translate)\s+\S/i.test(text)
    || /\b(?:WB|workbook|worksheet|EIE|IXL|p(?:p)?\.?\s*\d+|pages?\s+\d+|read|annotate|words|questions|essay|draft|project|report|packet|assignment|choice board|corrections|notetaking|video|dialogue)\b|^\d+\.\d+\s*(?:[#(]|(?:odd|even)(?:-numbered)?\b|problems?\b)/i.test(text);
}

function completedTask(text) {
  // Negated/pending submission is not submission complete. Strip only these
  // status phrases before checking positive completion, not the whole task.
  const status = text.replace(PENDING_STATUS, '');
  if (/\b(?:submitted|turned in|handed in|uploaded|submission (?:is )?complete)\b/i.test(status)) return true;
  const workDone = /\b(?:already|is|was|has been)\s+(?:already\s+)?(?:completed|done|finished)\b|^(?:completed|done|finished)\b/i.test(status);
  const pendingSubmission = SUBMISSION_ACTION.test(text) || text.match(PENDING_STATUS)?.some(value => new RegExp(SUBMITTED, 'i').test(value));
  return workDone && !pendingSubmission;
}

function conflictingDueDate(description, date) {
  for (const deadline of description.matchAll(dueDatePattern)) {
    for (const match of deadline[1].matchAll(new RegExp(DATE_TOKEN, 'gi'))) {
      const token = match[0];
      if (/day$/i.test(token)) {
        const weekday = new Intl.DateTimeFormat('en-US', { weekday: 'long', timeZone: 'UTC' }).format(new Date(date));
        if (weekday.toLowerCase() !== token.toLowerCase()) return true;
      } else {
        let parsed;
        if (/^\d{4}-/.test(token)) parsed = new Date(token + 'T12:00:00Z');
        else parsed = new Date(`${token}${/\d{4}$/.test(token) ? '' : ' ' + date.slice(0, 4)} 12:00:00 GMT`);
        if (Number.isNaN(+parsed) || parsed.toISOString().slice(0, 10) !== date) return true;
      }
    }
  }
  return false;
}

function stripDue(text) {
  return text.replace(dueTextPattern, ' ').replace(/[.\s]+$/, '').trim();
}

function atomicLabels(description, date, assignedTonight = false) {
  // An explicit work-on assignment is not a submission deadline. Remove only
  // its known metadata; other uncertainty/cancellation guards still apply.
  if (assignedTonight) {
    description = description.replace(/\s*(?:Work|Homework) for (?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)(?:,\s*submission date not stated)?[.\s]*/gi, ' ').trim();
  }
  // Fail closed: a dated tracking row or a future work-on plan is NOT evidence
  // of a deadline. Preserve uncertainty in the wiki; never infer next morning.
  if (UNCERTAIN.test(description) || NON_HOMEWORK.test(description)) return [];
  description = description.replace(/\s*\([^()]*(?:newsletter|Classroom|email|INBOX|teacher reply)[^()]*\)/gi, '').trim();
  // The row's date is a work-on date for explicit tonight work. A separately
  // stated later submission deadline must not hide that work or be rewritten.
  if (!assignedTonight && (conflictingDueDate(description, date)
    || submissionDates(description).some(token => conflictingDueDate(`due ${token}`, date)))) return [];
  const cleanLabel = value => assignedTonight ? value.replace(/[.\s]+$/, '').trim() : stripDue(value);
  const bundleConfirmed = assignedTonight || /^(?:homework|HW)\s+due\b|(?:^|;)\s*(?:due|deadline)\b/i.test(description);
  const text = description.replace(/^(?:(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)\s+)?(?:homework(?:\/study)?|HW)(?:\s+due)?\s*:\s*/i, '');
  // Semicolon-delimited tasks own their deadlines. Only a bundle heading or
  // standalone deadline clause confirms the whole list; a quiz's due date must
  // not turn its undated homework sibling into a confirmed assignment.
  const groups = [];
  for (const part of splitClauses(text, false)) {
    if ((CONTINUATION.test(part) || OPTIONAL.test(part) || /^(?:already |work (?:is |was )?)?(?:completed|done|finished|submitted|turned in|handed in|uploaded)\b/i.test(part)) && !subjectStart.test(part) && groups.length) groups[groups.length - 1] += '; ' + part;
    else groups.push(part);
  }
  const clauses = groups.flatMap(group => splitClauses(group).map(clause => ({
    clause, confirmed: bundleConfirmed || hasDeadline(group, clause), completed: completedTask(group) || OPTIONAL.test(group),
  })));
  let subject = '';
  let previousKept = false;
  const labels = [];
  for (let { clause, confirmed, completed } of clauses) {
    const ownSubject = clause.match(subjectStart);
    if (ownSubject) subject = ownSubject[1];
    let body = ownSubject ? clause.slice(ownSubject[0].length) : clause;
    if (completed) { previousKept = false; continue; }
    const continuation = CONTINUATION.test(body);
    if (continuation && previousKept && labels.length) {
      labels[labels.length - 1] += '; ' + cleanLabel(clause);
      continue;
    }
    previousKept = false;
    if (/^(?:study|review|begin studying|prepare for|no\b|do not\b|don't\b|complete over the preceding weekend)/i.test(body)) continue;
    const recitation = /\b(recitation|recite)\b/i.test(body);
    if (!confirmed && !recitation) continue;
    // Tests are reminders unless the clause explicitly assigns written work.
    const written = /\b(?:complete|finish|write|submit|turn in|answer)\b.*\b(?:worksheet|guide|corrections|questions|essay|dialogue|report|packet)\b|\b(?:worksheet|guide|corrections|questions|essay|dialogue|report|packet)\b.*\b(?:complete|finish|write|submit|turn in|answer)\b/i.test(body);
    if (!recitation && /\b(?:tests?|quizzes?|quiz|exam|assessment|prueba)\b/i.test(body) && !written) continue;
    clause = cleanLabel(clause);
    body = cleanLabel(body);
    if (!body) continue;
    // Accept concrete deliverables, not arbitrary notices containing "due".
    if (!recitation && !concreteTask(body)) continue;
    const label = ownSubject ? clause : (subject ? `${subject}: ${clause}` : clause);
    const ixl = label.match(/^(.*\bIXL\s+(?:Unit\s+\d+\s*[-–]\s*)?)(\d+[A-Z](?:\s*(?:,|&|and)\s*\d+[A-Z])+)(.*)$/i);
    if (ixl) {
      for (const code of ixl[2].split(/\s*(?:,|&|and)\s*/i)) labels.push(ixl[1] + code + ixl[3]);
    } else {
      labels.push(recitation ? 'Prepare: ' + label : label);
    }
    previousKept = true;
  }
  return labels;
}

// No IO or implicit clock: callers supply the source snapshot and instant.
function dueTomorrowAssignments(text, kidKey, now) {
  const tomorrow = tomorrowInEastern(now);
  const todayDate = new Date(tomorrow + 'T12:00:00Z');
  todayDate.setUTCDate(todayDate.getUTCDate() - 1);
  const today = todayDate.toISOString().slice(0, 10);
  const todayWeekday = new Intl.DateTimeFormat('en-US', { weekday: 'long', timeZone: 'America/New_York' }).format(now);
  const out = [];
  let upcoming = false;
  let kid = '';
  for (const line of text.split(/\r?\n/)) {
    if (/^##\s+/.test(line)) {
      upcoming = /^## Upcoming\s*$/.test(line);
      kid = '';
    }
    const header = line.match(/^###\s+(\w+)\b/);
    if (header) kid = header[1].toLowerCase();
    if (!upcoming || kid !== kidKey.toLowerCase()) continue;
    const row = line.match(/^- \*\*(\d{4}-\d{2}-\d{2})(?:\s+\([A-Za-z]+\))?:?\*\*\s*(.+)$/);
    if (!row) continue;
    const workFor = row[2].match(/\b(?:Work|Homework) for (Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)\b/i);
    const assignedTonight = row[1] === today && workFor && workFor[1].toLowerCase() === todayWeekday.toLowerCase();
    if (row[1] !== tomorrow && !assignedTonight) continue;
    const actionDate = assignedTonight ? today : tomorrow;
    for (const rawLabel of atomicLabels(row[2].trim(), row[1], !!assignedTonight)) {
      const label = rawLabel.replace(/\s+/g, ' ').trim();
      // Full task content, not its position or a truncated bundle prefix. Source
      // notes and a sibling's edits do not invalidate an existing checkbox.
      const digest = createHash('sha256').update(`${kid}\n${assignedTonight ? "work-on:" : ""}${actionDate}\n${label.toLowerCase()}`).digest('hex');
      const id = `sch-${assignedTonight ? "work-on-" : ""}${actionDate}-${digest}`;
      if (!out.some(item => item.id === id)) out.push(assignedTonight ? { id, label, dueDate: null, workOnDate: today } : { id, label, dueDate: tomorrow });
    }
  }
  return out;
}

module.exports = { dueTomorrowAssignments, tomorrowInEastern };
