const test = require('node:test');
const assert = require('node:assert/strict');

const RealDate = Date;

test('Thomas dashboard includes tonight homework plus tomorrow assessments', () => {
  global.Date = class extends RealDate {
    constructor(...args) {
      super(...(args.length ? args : ['2026-08-27T22:00:00Z']));
    }
    static now() { return new RealDate('2026-08-27T22:00:00Z').valueOf(); }
  };

  try {
    delete require.cache[require.resolve('../src/_data/kids.js')];
    const thomas = require('../src/_data/kids.js')().find(k => k.key === 'thomas');
    const labels = thomas.assignments.map(a => a.label);

    assert(labels.includes('Math: workbook p.23-24'));
    assert(labels.includes('English: EIE p.8'));
    assert(labels.includes('Spelling test'));
    assert(labels.includes('DOL quiz'));
  } finally {
    global.Date = RealDate;
  }
});
