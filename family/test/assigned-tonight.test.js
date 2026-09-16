const test = require('node:test');
const assert = require('node:assert/strict');
const { dueTomorrowAssignments } = require('../src/lib/school-homework');
const ui = require('../src/assets/assignment-long-press');
const NOW = new Date('2026-09-16T15:00:00Z');
const row = (text, date='2026-09-16') => `- **${date}:** ${text}`;
const doc = rows => `## Upcoming\n### Thomas\n${rows.join('\n')}\n## Completed\n`;
const actual = rows => dueTomorrowAssignments(doc(rows),'thomas',NOW);

test('Wednesday nightly homework is visible today without inventing due dates', () => {
 const items=actual([
  row('Reading: Read 20 minutes. Work for Wednesday, submission date not stated. (Cannon newsletter 9/14-18, email 2026-09-13)'),
  row('Spelling: Complete WB p.24. Work for Wednesday, submission date not stated.'),
  row('Spelling: Write words 11-15 three times each. Work for Wednesday, submission date not stated.'),
  row('Math: Complete WB pp.47-48. Work for Wednesday, submission date not stated.'),
  row('DOL: Study Monday-Wednesday DOL. Work for Wednesday, submission date not stated.'),
  row('Religion: Study Unit 1 for Thursday. Work for Wednesday, submission date not stated.'),
  row('English: No Homework. Work for Wednesday, submission date not stated.'),
  row('Reading: Read 20 minutes. Work for Thursday, submission date not stated.','2026-09-17'),
  row('Math: Complete WB pp.44-45. Work for Tuesday, submission date not stated.','2026-09-15'),
 ]);
 assert.deepEqual(items.map(x=>x.label),['Reading: Read 20 minutes','Spelling: Complete WB p.24','Spelling: Write words 11-15 three times each','Math: Complete WB pp.47-48']);
 assert(items.every(x=>x.workOnDate==='2026-09-16' && x.dueDate===null));
 assert.equal(new Set(items.map(x=>x.id)).size,4);
});
test('due-tomorrow deliverables still qualify; same-day due and tracking-only do not',()=>{
 const items=actual([row('English: Essay due','2026-09-17'),row('Math: Worksheet due'),row('Math: WB p.99; tracking date only'),row('Math: Complete WB p.40. Work for Tuesday, submission date not stated.')]);
 assert.deepEqual(items.map(x=>x.label),['English: Essay']);
 assert.equal(items[0].dueDate,'2026-09-17');
});
test('Choice Board is a concrete assignment; mixed study clauses are excluded',()=>{
 const items=actual([row('Spelling: Complete Choice Board: What It’s Worth; study for spelling test. Work for Wednesday, submission date not stated.')]);
 assert.deepEqual(items.map(x=>x.label),['Spelling: Complete Choice Board: What It’s Worth']);
});
test('all four children support same-day explicit homework',()=>{
 for(const kid of ['Thomas','William','Henry','Charlie']){
  const source=`## Upcoming\n### ${kid}\n${row('Math: Complete WB p.24. Homework for Wednesday, submission date not stated.')}\n## Completed\n`;
  assert.equal(dueTomorrowAssignments(source,kid.toLowerCase(),NOW).length,1,kid);
 }
});
test('work-on IDs persist after reordering and source annotation changes',()=>{
 const a=row('Math: Complete WB p.24. Work for Wednesday, submission date not stated.');
 const b=row('Reading: Read 20 minutes. Work for Wednesday, submission date not stated.');
 assert.equal(actual([a,b])[0].id,actual([b,a.replace('stated.','stated. (Cannon newsletter screenshot)')])[1].id);
});
test('UI accepts only current work-on date or confirmed tomorrow deadline',()=>{
 assert(ui.isActionableTonight('', '2026-09-16','2026-09-16'));
 assert(ui.isActionableTonight('2026-09-17','','2026-09-16'));
 assert(!ui.isActionableTonight('2026-09-16','','2026-09-16'));
 assert(!ui.isActionableTonight('', '2026-09-17','2026-09-16'));
 assert(!ui.isActionableTonight('', '2026-09-15','2026-09-16'));
 assert(!ui.isActionableTonight('', '', '2026-09-16'));
});
