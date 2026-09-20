const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { dueTomorrowAssignments } = require('../src/lib/school-homework');
const NOW = new Date('2026-09-20T22:00:00Z');
const canonical = fs.readFileSync(path.join(__dirname, 'fixtures/henry-sep21.md'), 'utf8');
const tasks = (description, date = '2026-09-21', now = NOW) => dueTomorrowAssignments(
  `## Upcoming\n### Henry\n- **${date}:** ${description}\n## Completed`, 'henry', now);

for (const description of [
  'Algebra: 8.2 even-numbered problems due Monday',
  'Algebra: Solve 8.2 exercises 1-15 by hand, due September 21',
  'Honors English: Write a reflection on the guest speaker, due Monday',
  'English: Respond to the author in three sentences due Monday',
  'Science: Create a cell model due Monday',
  'Spanish: Submit the translation by Monday',
  'Spanish: Hand in the completed blue workbook to Ms. Smith on September 21',
  'English: Upload your response Monday',
  'English: Turn in the reflection on 9/21/2026',
  'Math: Submit exercises by 2026-09-21',
  'English: The response must be submitted by Monday',
  'Spanish: Workbook needs to be turned in on Monday',
  'English: Write a response due Monday. It has not yet been submitted.',
]) test(`deadline evidence keeps concrete work: ${description}`, () => {
  assert.equal(tasks(description).length, 1);
});

for (const description of [
  'English: Write a response due Monday. Already submitted.',
  'English: Submit the reflection Monday. It was turned in Friday.',
  'Spanish: Turn in workbook on Monday. Mike confirms it has been handed in.',
  'Math: Worksheet due Monday. Work is already completed.',
  'Spanish: Workbook due Monday; completed and submitted.',
  'English: Upload the response Monday. Already uploaded.',
  'English: Submit the reflection Monday. Submission complete.',
]) test(`completed work/submission stays excluded: ${description}`, () => {
  assert.deepEqual(tasks(description), []);
});

test('completed work still has an independent pending submission obligation', () => {
  for (const status of ['not submitted', 'not yet submitted', 'has not been turned in', 'still needs to be handed in']) {
    assert.equal(tasks(`Spanish: Turn in completed workbook Monday. Work is done but ${status}.`).length, 1, status);
  }
});

for (const description of [
  'History: Trivia Quiz #3 and #4 on Monday; study for the quiz',
  'Spanish: Test on pages 20-30 due Monday',
  'Math: Complete the quiz due Monday',
  'Science: Kahoot study resource due Monday; completion is not required',
  'Science: Write a response to study for the test due Monday; optional practice only',
  'Religion: Study the chapter due Monday',
  'English: Review responses for the quiz due Monday',
  'School concert: Write your name on the registration form due Monday',
  'English: Write a response. Tracking date only; due date not shown',
  'English: Submit the reflection (Classroom email Monday)',
  'English: Submit Monday reflections; tracking only',
  'English: Do not submit the response on Monday',
  'English: Submit the reflection; quiz on Monday',
  'English: Submit the reflection. Study on Monday.',
  'English: Submit the reflection and study on Monday',
  'Science: Complete study guide due Monday; optional practice only',
  'Science: Complete the worksheet due Monday. Completion is not required.',
  'English: Write a response due (Classroom email: due date not shown)',
  'English: Submit the reflection on Tuesday',
  'English: Submit the reflection by September 22',
  'English: Submit the reflection by Monday, September 22',
  'Math: Solve the problems due Monday, September 22',
]) test(`not confirmed actionable homework: ${description}`, () => {
  assert.deepEqual(tasks(description), []);
});

test('date windows keep future work, due-today work, and the quiz off tonight', () => {
  assert.deepEqual(tasks('English: Submit a response Tuesday', '2026-09-22'), []);
  assert.deepEqual(tasks('English: Submit a response Sunday', '2026-09-20'), []);
  assert.deepEqual(dueTomorrowAssignments(canonical, 'henry', new Date('2026-09-21T22:00:00Z')), []);
});

test('new task phrasing honors explicit assigned-tonight dates without invented deadlines', () => {
  const description = 'English: Write a reflection. Homework for Sunday, submission date not stated.';
  const items = tasks(description, '2026-09-20');
  assert.equal(items.length, 1);
  assert.equal(items[0].dueDate, null);
  assert.equal(items[0].workOnDate, '2026-09-20');
  const longLead = tasks('English: Write a reflection due Friday. Homework for Sunday.', '2026-09-20');
  assert.equal(longLead.length, 1, 'an explicit work-on date does not have to equal the later submission date');
  assert.equal(longLead[0].workOnDate, '2026-09-20');
  assert.equal(longLead[0].dueDate, null);
  assert.match(longLead[0].label, /due Friday/, 'preserve the real later deadline in the work-on label');
  assert.deepEqual(tasks(description), []);
  assert.deepEqual(tasks(description.replace('Sunday', 'Monday'), '2026-09-20'), []);
  assert.deepEqual(tasks('English: Study responses. Homework for Sunday, submission date not stated.', '2026-09-20'), []);
});

// Verbatim canonical rows, not rewritten to satisfy the parser's vocabulary.
test('Sep 21 canonical rows yield all four independent Henry deliverables, never the quiz', () => {
  const items = dueTomorrowAssignments(canonical, 'henry', NOW);
  assert.equal(items.length, 4);
  assert.equal(new Set(items.map(item => item.id)).size, 4);
  assert(items.every(item => item.dueDate === '2026-09-21' && !item.workOnDate));
  assert.match(items[0].label, /IXL 6T/);
  assert.match(items[1].label, /8\.2 odd-numbered problems/);
  assert.match(items[2].label, /Student Stories.*Write a response.*answer any or all prompts/);
  assert.match(items[3].label, /Turn in blue workbook p\.155.*bin on Monday.*already completed but was not submitted/);
  assert(items.every(item => !/Trivia|Quiz|INBOX|teacher reply/i.test(item.label)));
  // The existing IXL ID (and therefore its checked/dismissed state) must survive.
  assert.equal(items[0].id, 'sch-2026-09-21-7bff6bc190c42402a8ff12db0e01c3fba8c0f384fc9ac5aca66adb40e91f0549');
});
