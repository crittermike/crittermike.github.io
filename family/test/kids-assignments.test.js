const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// Exercise the real loader with read-only in-memory sources, never the live wiki.
const SCHOOL = `## Upcoming
### Thomas (3rd grade)
- **2026-09-15 (Tue):** Tuesday homework/study: Spelling WB p.23; Math WB p.44-45. Work for Tuesday, submission date not stated.
- **2026-09-16 (Wed):** September Poetry Recitation - Ooey Gooey
- **2026-09-16 (Wed):** Wednesday homework/study: Read 20 minutes; Spelling WB p.24; words 11-15 three times each; study Monday-Wednesday DOL; Math WB p.47-48; no English homework; study Religion Unit 1 for Thursday. Work for Wednesday, submission date not stated. (Cannon newsletter 9/14-18, email 2026-09-13)
- **2026-09-16 (Wed):** Math: Simple Solutions Quiz
### William
- **2026-09-16 (Wed):** Science: Astronomy Test 1
### Henry
- **2026-09-17 (Thu):** Religion: Saints Worksheet, Chosen 1-5 due
### Charlie
## Completed
`;

function loadKids(text = SCHOOL) {
  const filename = path.resolve(__dirname, '../src/_data/kids.js');
  const module = { exports: {} };
  class FixedDate extends Date {
    constructor(...args) { super(...(args.length ? args : ['2026-09-15T23:00:00Z'])); }
  }
  vm.runInNewContext(fs.readFileSync(filename, 'utf8'), {
    module, Date: FixedDate, Intl,
    require(name) {
      if (name === 'fs') return { readFileSync(file) {
        if (file.endsWith('school-assignments.md')) return text;
        if (file.endsWith('sugar.md')) return '**60g/week**\n## Balances\n| Thomas | 42 |\n';
        return '## Balances\n| Thomas | $10.00 |\n### 🐹 William\'s Guinea Pig Fund: $119.34';
      } };
      return require(name.startsWith('.') ? path.resolve(path.dirname(filename), name) : name);
    },
  }, { filename });
  return JSON.parse(JSON.stringify(module.exports()));
}

module.exports = { loadKids };

test('export and both dashboard renderings preserve atomic IDs and honest due-tomorrow labels', () => {
  const nunjucks = require('nunjucks');
  const env = new nunjucks.Environment(new nunjucks.FileSystemLoader(path.resolve(__dirname, '../src/_includes')), { autoescape: true });
  const template = fs.readFileSync(path.resolve(__dirname, '../src/dashboard-edit.njk'), 'utf8');
  const kids = loadKids(`## Upcoming\n### Thomas\n- **2026-09-16 (Wed):** Homework due: Math WB p.47-48; English EIE p.16\n## Completed`);
  const context = { kids, chores: {}, calendar: [], recipes: [], mealweek: [], weather: null };
  const html = env.renderString(template, context);
  const exported = JSON.parse(new (require('../src/data.11ty.js'))().render(context));
  assert.deepEqual(exported.kids, kids);
  assert.match(html, /kidtile-sec-lbl">✏️ Due tomorrow</);
  assert.match(html, /No confirmed assignments due tomorrow\./);
  assert.doesNotMatch(html, /Nothing today|Nothing assigned today/);
  for (const task of kids[0].assignments) {
    assert.equal(html.split(`data-id="${task.id}"`).length - 1, 2);
  }
  assert.match(html, /data-tpl="chores"/);
  assert.match(html, /data-tpl="budget"/);
  assert.match(html, /data-tpl="calendar"/);
});

test('loader surfaces only the confirmed recitation tomorrow, not daily plans or assessments', () => {
  const kids = loadKids();
  assert.deepEqual(kids.map(k => k.assignments.map(a => a.label)), [
    ['Prepare: September Poetry Recitation - Ooey Gooey'], [], [], [],
  ]);
  assert.equal(kids[0].sugar.balance, 42);
  assert.equal(kids[0].allowance.balance_str, '$10.00');
  assert.equal(kids[1].guineaPig, '$119.34');
});
