const test = require('node:test');
const assert = require('node:assert/strict');
const { dueTomorrowAssignments, tomorrowInEastern } = require('../src/lib/school-homework');
const NOW = new Date('2026-09-15T23:00:00Z');
const row = (description, date = '2026-09-16') => `- **${date} (Wed):** ${description}`;
const document = (...rows) => `## Upcoming\n### Thomas (3rd grade)\n${rows.join('\n')}\n## Completed\n`;
const tasks = (...rows) => dueTomorrowAssignments(document(...rows), 'thomas', NOW);
const labels = (...rows) => tasks(...rows).map(a => a.label);

test('confirmed homework bundle becomes independent deliverables, dropping study and no-homework clauses', () => {
  assert.deepEqual(labels(row('Homework due: Read 20 minutes; Spelling WB p.24; words 11-15 three times each; study Monday-Wednesday DOL; Math WB p.47-48; no English homework; study Religion Unit 1 for Thursday. (Cannon newsletter 9/14-18, email 2026-09-13)')), [
    'Read 20 minutes', 'Spelling WB p.24', 'Spelling: words 11-15 three times each', 'Math WB p.47-48',
  ]);
});

test('subject carries across semicolons while page ranges and problem lists remain intact', () => {
  assert.deepEqual(labels(row('Algebra: 1.2 #15-30odd; 1.3 #25-30 all; due September 16')), [
    'Algebra: 1.2 #15-30odd', 'Algebra: 1.3 #25-30 all',
  ]);
  assert.deepEqual(labels(row('Math: 1.4 (26,28) and 1.5 (22-24) due')), [
    'Math: 1.4 (26,28)', 'Math: 1.5 (22-24)',
  ]);
  assert.deepEqual(labels(row('Homework due: Math WB p.47-48, English EIE p.16; Spelling: words 6-10 written 3 times each')), [
    'Math WB p.47-48', 'English EIE p.16', 'Spelling: words 6-10 written 3 times each',
  ]);
});

test('uncertain dates and work-on plans never become deadlines, even after source atomization', () => {
  const descriptions = [
    'Spelling: Complete WB p.23. Work for Tuesday, submission date not stated. (Cannon newsletter 9/14-18)',
    'Math: Complete WB p.47-48. Work for Wednesday, submission date not stated.',
    'Wednesday homework/study: Math WB p.47-48',
    'Math: WB p.47-48', // a tracking-row date alone is not confirmation
    'Hobbit project due date unclear',
    'English: Essay due date not shown',
    'English: Essay due date unknown',
    'English: Essay due; no confirmed submission date',
    'English: Essay due date missing',
    'English: Essay due next week',
    'English: Essay due soon',
    'English: Essay due?',
    'English: Essay (no email due date)',
    'English: Essay due; revised deadline not specified',
    'English: Essay due; date needs confirmation',
    'English: Essay due September 16? pending clarification',
    'Math: Worksheet due; teacher cancelled',
    'Math: Worksheet due ✅',
    'Religion: Recitation; date TBD',
    'English: Worksheet due September 17',
    'English: Worksheet due 2026-09-17',
  ];
  for (const desc of descriptions) assert.deepEqual(labels(row(desc)), [], desc);
});

test('school events and administrative tasks are not homework', () => {
  for (const desc of [
    'School Mass 8:30am; wear Mass uniform', 'Cardinal Friday; Chess Club',
    'Field trip: bring lunch; permission slip due', 'School Choir rehearsal; complete form due',
    'Binder setup due', 'Parking-pass pickup deadline', 'School supplies due',
    'Senior jersey orders due', 'Exceptional SC eligibility paperwork due to state',
  ]) assert.deepEqual(labels(row(desc)), [], desc);
});

test('tests and study reminders are excluded, including due-labelled quizzes', () => {
  for (const desc of [
    'Math: Simple Solutions Quiz due', 'Science: Astronomy Test 1 due',
    'Spanish: Quiz verbos bota e--ie, p.224-227, due September 16',
    'Religion: Study guide for test due', 'Math: Practice Test A due',
    'Spelling: study words due', 'Reading: review Ooey Gooey recitation due',
    'Religion: Prepare for Unit 1 test due',
  ]) assert.deepEqual(labels(row(desc)), [], desc);
});

test('assigned written deliverables survive test/quiz words and instructions stay with their task', () => {
  assert.deepEqual(labels(row('Homework due: Math WB p.47-48; quiz on chapter 2; English: Complete test corrections; study spelling')), [
    'Math WB p.47-48', 'English: Complete test corrections',
  ]);
  assert.deepEqual(labels(row('Science: Complete study guide worksheet for test due; show all work')), [
    'Science: Complete study guide worksheet for test; show all work',
  ]);
  assert.deepEqual(labels(row('English: Socratic Questions for Chapter 9; thoroughly answer and prepare to discuss for a grade, due September 16')), [
    'English: Socratic Questions for Chapter 9; thoroughly answer and prepare to discuss for a grade',
  ]);
});

test('assessed recitations become preparation, not a checkbox claiming tomorrow performance is done', () => {
  assert.deepEqual(labels(row('Poem Recitation - Whole Duty of Children (language arts test)')), [
    'Prepare: Poem Recitation - Whole Duty of Children (language arts test)',
  ]);
  assert.deepEqual(labels(row('Religion: Recite CCC 32')), ['Prepare: Religion: Recite CCC 32']);
});

test('ET midnight, DST, leap-day, month/year rollovers use calendar tomorrow, not 24 hours or UTC today', () => {
  for (const [instant, expected] of [
    ['2026-09-16T03:59:59Z', '2026-09-16'], ['2026-09-16T04:00:00Z', '2026-09-17'],
    ['2026-03-08T04:30:00Z', '2026-03-08'], ['2026-03-09T03:30:00Z', '2026-03-09'],
    ['2026-11-01T05:30:00Z', '2026-11-02'], ['2026-11-01T06:30:00Z', '2026-11-02'],
    ['2026-12-31T23:00:00Z', '2027-01-01'], ['2028-02-28T23:00:00Z', '2028-02-29'],
  ]) assert.equal(tomorrowInEastern(new Date(instant)), expected, instant);
  assert.deepEqual(labels(row('Math: Worksheet due', '2026-09-15'), row('Math: Worksheet due', '2026-09-17')), []);
});

test('only the exact kid in Upcoming is read; no Completed, other sections, or date-range rows', () => {
  const source = `### Thomas\n${row('Math: Worksheet due')}\n## Upcoming\n### Thomasina\n${row('Math: Worksheet due')}\n### Thomas\n- **2026-09-16 - 2026-09-18:** English: Essay due\n## Notes\n### Thomas\n${row('English: Essay due')}\n## Completed\n### Thomas\n${row('English: Essay due')}`;
  assert.deepEqual(dueTomorrowAssignments(source, 'thomas', NOW), []);
  assert.equal(dueTomorrowAssignments(document(row('English: Essay due')), 'thomas', NOW).length, 1);
});

test('IDs are independent, stable after reordering/adding tasks, and deduplicate equivalent source rows', () => {
  const long = 'English: Complete worksheet with the very long common description and final question ';
  const original = tasks(row(long + '1 due'), row(long + '2 due'));
  assert.notEqual(original[0].id, original[1].id);
  const reordered = tasks(row('Math: Worksheet due'), row(long + '2 due'), row(long + '1 due'));
  assert.equal(original[0].id, reordered[2].id);
  assert.equal(original[1].id, reordered[1].id);
  assert.equal(tasks(row('Math: WB p.47-48 due'), row('Math: WB p.47-48 due (Cannon newsletter 9/14-18)')).length, 1);
  assert.equal(tasks(row('Homework due: Math: WB p.47-48; English: EIE p.16'))[0].id,
    tasks(row('Math: WB p.47-48 due'))[0].id);
  assert.equal(tasks(row('Math:  WB p.47-48 due'))[0].id, tasks(row('Math: WB p.47-48 due'))[0].id);
});

test('there is no arbitrary task count or label truncation', () => {
  const rows = Array.from({ length: 30 }, (_, i) => row(`English: Worksheet ${i} ${'long directions '.repeat(20)} due`));
  const actual = tasks(...rows);
  assert.equal(actual.length, 30);
  assert.equal(new Set(actual.map(a => a.id)).size, 30);
  assert(actual.every(a => a.label.length > 250 && a.dueDate === '2026-09-16'));
});

test('a sibling deadline does not confirm unrelated work; only explicit bundle deadlines are shared', () => {
  assert.deepEqual(labels(row('Math: WB p.24; Science: Quiz due September 16')), []);
  assert.deepEqual(labels(row('Math: Worksheet due; English: EIE p.16')), ['Math: Worksheet']);
});

test('real standalone page deliverables are retained with their confirmed dates', () => {
  assert.deepEqual(labels(row('Spanish (Simon): P.156 due (Classroom 2026-09-15)')), ['Spanish (Simon): P.156']);
  assert.deepEqual(labels(row('Religion (Principal Barontini): Saints Worksheet, Chosen 1-5 due (Classroom 2026-09-08)')), ['Religion (Principal Barontini): Saints Worksheet, Chosen 1-5']);
  assert.deepEqual(labels(row('Honors English (deMarrais): Literary Analysis Essay Final Draft due September 16 (Classroom assignment 2026-09-10)')), ['Honors English (deMarrais): Literary Analysis Essay Final Draft']);
});

test('separate reading and written deliverables joined with and get separate checkboxes', () => {
  assert.deepEqual(labels(row('English: Read chapter 9 and answer questions 1-5 due September 16')), [
    'English: Read chapter 9', 'English: answer questions 1-5',
  ]);
});

test('separate IXL skills are separate boxes, not separate page numbers', () => {
  assert.deepEqual(labels(row('Spanish (Simon): IXL Unit 4 - 4J & 4L due; complete over the preceding weekend')), [
    'Spanish (Simon): IXL Unit 4 - 4J', 'Spanish (Simon): IXL Unit 4 - 4L',
  ]);
});
