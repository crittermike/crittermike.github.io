// Checks for the math question maker (js/mathgen.js): the Question format, the card limits, and the math.
// The answers are worked out again here, separately from the generator.
// Run from the repo root: node --test critter-run/*.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SKILLS, VARIANTS, makeQuestion, rngFrom, grabRule } from './js/mathgen.js';
import { PICS } from './js/catalog.js';

const N = 400;
const EMOJI = /\p{Extended_Pictographic}|\uFE0F|[\u{1F1E6}-\u{1F1FF}]/u;
const SIGNS = ['×', '÷', '+', '−'];
const words = s => s.trim().split(/\s+/).filter(w => /[\p{L}\p{N}]/u.test(w)).length;
const strings = v => (typeof v === 'string' ? [v] : Array.isArray(v) ? v.flatMap(strings) : v && typeof v === 'object' ? Object.values(v).flatMap(strings) : []);
const ids = Object.keys(SKILLS);
const laneIds = ids.filter(id => SKILLS[id].lane);

// ---------- Math, worked out here ----------

const fmt = n => n.toLocaleString('en-US');
const num = s => (/^\d{1,3}(,\d{3})*$/.test(s) ? Number(s.replace(/,/g, '')) : NaN);
// Every number in a line of text, in order ('1,000' is one number).
const nums = s => (s.match(/\d{1,3}(?:,\d{3})+|\d+/g) || []).map(x => Number(x.replace(/,/g, '')));
const sum = list => list.reduce((s, x) => s + x, 0);
const sorted = list => [...list].sort((a, b) => a - b);
const sameNums = (a, b, msg) => assert.deepEqual(sorted(a), sorted(b), msg);
const divExact = (a, b) => {
  assert.equal(a % b, 0, `${a} ÷ ${b} should come out even`);
  return a / b;
};

// The exact value of an expression like '(4 + 2) × 4'. NaN if a division doesn't come out even.
function calc(expr) {
  const js = expr.replace(/(\d),(?=\d{3})/g, '$1').replace(/×/g, '*').replace(/÷/g, '/').replace(/−/g, '-');
  assert.match(js, /^[\d\s+\-*/()]+$/, `not an expression: ${expr}`);
  for (const [, a, b] of js.matchAll(/(\d+)\s*\/\s*(\d+)/g)) if (Number(a) % Number(b) !== 0) return NaN;
  return Function(`"use strict"; return (${js});`)();
}
const isTrueEq = s => {
  const sides = s.split('=');
  return sides.length === 2 && calc(sides[0]) === calc(sides[1]);
};
const remText = (c, b) => (c % b ? `${Math.floor(c / b)} R${c % b}` : `${c / b}`);
// '4 × 6 = 24' or '24 = 4 × 6' -> [4, 6, 24]. Same for ÷: '20 ÷ 4 = 5' -> [20, 4, 5].
function fact(s, op) {
  const m = s.match(new RegExp(`^(\\d+) ${op} (\\d+) = (\\d+)$`));
  if (m) return [+m[1], +m[2], +m[3]];
  const r = s.match(new RegExp(`^(\\d+) = (\\d+) ${op} (\\d+)$`));
  assert.ok(r, `not a ${op} fact: ${s}`);
  return [+r[2], +r[3], +r[1]];
}
// The two numbers in a story, total first (the total is the bigger one).
const storyNums = s => {
  const n = nums(s);
  assert.equal(n.length, 2, `story needs 2 numbers: ${s}`);
  return [Math.max(...n), Math.min(...n)];
};
// The one sign that makes '27 __ 3 = 9' true.
const works = s => SIGNS.filter(op => isTrueEq(s.replace('__', op)));

// 'X op Y = Z' with tiles in the blanks. Division must come out even.
function holds([x, op, y, eq, z]) {
  const [a, b, c] = [x, y, z].map(num);
  if (eq !== '=' || [a, b, c].some(Number.isNaN)) return false;
  if (op === '×') return a * b === c;
  if (op === '÷') return b !== 0 && a % b === 0 && a / b === c;
  if (op === '+') return a + b === c;
  if (op === '−') return a - b === c;
  return false;
}
// Every fill of the blanks that makes a true equation. Tiles may repeat, in case the game allows that.
function trueFills(slots, tiles) {
  const blanks = slots.flatMap((s, i) => (s === null ? [i] : []));
  let fills = [[]];
  for (let k = 0; k < blanks.length; k++) fills = fills.flatMap(f => tiles.map(t => [...f, t]));
  return fills.filter(f => {
    const eq = [...slots];
    blanks.forEach((b, k) => (eq[b] = f[k]));
    return holds(eq);
  });
}

// ---------- The right answer for each variant ----------

const at = q => `${q.skill}/${q.variant}: "${q.show ? `${q.show} ` : ''}${q.q}"`;
function expectChoice(q, answer) {
  const a = typeof answer === 'number' ? fmt(answer) : answer;
  assert.equal(q.a, a, `${at(q)} should be ${a}`);
  assert.ok(!q.wrong.includes(a), `${at(q)}: the right answer is also listed as wrong`);
}
function expectMulti(q, isGood) {
  const want = q.options.flatMap((o, i) => (isGood(o) ? [i] : []));
  assert.deepEqual(sorted(q.correct), want, `${at(q)}: right options in ${q.options.join(' | ')}`);
}
function expectSort(q, binOf) {
  for (const item of q.items) assert.equal(item.bin, binOf(item.label), `${at(q)}: "${item.label}" is in the wrong bin`);
}
function expectTerm(q, table) {
  const text = `${q.show ?? ''}|${q.q}`;
  const hits = table.filter(([re]) => re.test(text));
  assert.equal(hits.length, 1, `${at(q)}: no single answer key entry`);
  const answers = [hits[0][1]].flat();
  assert.ok(answers.includes(q.a), `${at(q)} should be ${answers.join(' or ')}`);
  for (const w of q.wrong) assert.ok(!answers.includes(w), `${at(q)}: ${w} is right too`);
}
const SAME = ['The same number', 'Itself'];
const TERMS = {
  multWords: [
    [/numbers we multiply|multiply to get a product/, 'Factors'], [/answer to a multiplication/, 'Product'],
    [/product is the answer to what/, 'Multiplication'], [/^factor × factor = \?\|/, 'Product'], [/^\? × factor = product\|/, 'Factor'],
  ],
  divWords: [
    [/answer to a division/, 'Quotient'], [/number you divide by/, 'Divisor'], [/number that gets divided/, 'Dividend'],
    [/^dividend ÷ divisor = \?\|/, 'Quotient'], [/^\? ÷ divisor = quotient\|/, 'Dividend'], [/^dividend ÷ \? = quotient\|/, 'Divisor'],
  ],
  zeroOne: [
    [/times 1 is what/, SAME], [/times 0 is what/, '0'], [/divided by 1 is what/, SAME],
    [/divided by itself/, '1'], [/\|0 divided by any number/, '0'], [/^\? × 0 = 0\|/, 'Any number'],
  ],
  evenOdd: [
    [/even number divided by 2 has what remainder/, 'No remainder'], [/odd number divided by 2 has what remainder/, 'A remainder of 1'],
    [/^Divided by 2, it has no remainder/, 'Even'], [/^Divided by 2, it has a remainder of 1/, 'Odd'],
  ],
};
const remOf = e => {
  const [c, b] = nums(e);
  return c % b;
};
function remRange(c, b) {
  assert.ok(c <= 60 && b >= 2 && b <= 9 && c >= b && Math.floor(c / b) <= 10, `${c} ÷ ${b} is out of range`);
}
function nextPrev(q, step) {
  const [x, b, p] = nums(q.show);
  assert.equal(x * b, p, q.show);
  const [y, b2] = nums(q.q);
  assert.equal(b2, b);
  assert.equal(y, x + step);
  expectChoice(q, y * b);
}
function familyChoice(q, op) {
  assert.ok(isTrueEq(q.show), q.show);
  assert.ok(q.a.includes(op) && isTrueEq(q.a), `${at(q)}: ${q.a} must be a true ${op} fact`);
  sameNums(nums(q.a), nums(q.show), `${at(q)}: ${q.a} uses other numbers`);
  for (const w of q.wrong) assert.ok(!isTrueEq(w), `${at(q)}: ${w} would be right too`);
}

const MATH = {
  multWords: {
    define: q => expectTerm(q, TERMS.multWords),
    label(q) {
      const [a, b, p] = fact(q.parts.join(' '), '×');
      assert.equal(a * b, p);
      const left = q.parts[1] === '=';
      assert.deepEqual(sorted(q.answer), /product/.test(q.q) ? [left ? 0 : 4] : left ? [2, 4] : [0, 2]);
    },
    name(q) {
      const [a, b, p] = fact(q.show, '×');
      assert.equal(a * b, p);
      const two = q.q.match(/^What are (\d+) and (\d+) called\?$/);
      if (two) {
        sameNums([+two[1], +two[2]], [a, b]);
        return expectChoice(q, 'Factors');
      }
      const n = +q.q.match(/^What is (\d+) called\?$/)[1];
      assert.ok([a, b, p].includes(n));
      expectChoice(q, n === p ? 'Product' : 'Factor');
    },
    sort(q) {
      const facts = q.show.split(' and ').map(s => fact(s, '×'));
      for (const [a, b, p] of facts) assert.equal(a * b, p);
      assert.equal(new Set(facts.flat()).size, 6, q.show);
      expectSort(q, l => (facts.some(f => f[2] === num(l)) ? 1 : (assert.ok(facts.some(f => f.includes(num(l)))), 0)));
    },
  },
  divWords: {
    define: q => expectTerm(q, TERMS.divWords),
    label(q) {
      const [c, b, d] = fact(q.parts.join(' '), '÷');
      assert.equal(b * d, c);
      const where = q.parts[1] === '=' ? { quotient: 0, dividend: 2, divisor: 4 } : { dividend: 0, divisor: 2, quotient: 4 };
      assert.deepEqual(q.answer, [where[q.q.match(/^Tap the (quotient|divisor|dividend)\.$/)[1]]]);
    },
    name(q) {
      const [c, b, d] = fact(q.show, '÷');
      assert.equal(b * d, c);
      const n = +q.q.match(/^What is (\d+) called\?$/)[1];
      expectChoice(q, n === c ? 'Dividend' : n === b ? 'Divisor' : (assert.equal(n, d), 'Quotient'));
    },
    sortWords: q => expectSort(q, l => ({ Factor: 0, Product: 0, Quotient: 1, Divisor: 1, Dividend: 1 })[l]),
    sortNums(q) {
      const facts = q.show.split(' and ').map(s => fact(s, '÷'));
      for (const [c, b, d] of facts) assert.equal(b * d, c);
      assert.equal(new Set(facts.flat()).size, 6, q.show);
      expectSort(q, l => (facts.some(f => f[1] === num(l)) ? 0 : (assert.ok(facts.some(f => f[2] === num(l))), 1)));
    },
  },
  groups: {
    picture(q) {
      const [g, e] = q.model ? [q.model.groups, q.model.each] : nums(q.show);
      if (!q.model) assert.match(q.show, /^\d+ groups of \d+$/);
      expectChoice(q, /in all/.test(q.q) ? g * e : /in each/.test(q.q) ? e : (assert.match(q.q, /groups|units/), g));
    },
    array(q) {
      const [r, c] = q.model ? [q.model.rows, q.model.cols] : nums(q.show);
      expectChoice(q, /in all|in the array/.test(q.q) ? r * c : /each row/.test(q.q) ? c : (assert.match(q.q, /How many rows/), r));
    },
    match(q) {
      const m = q.model;
      const [g, e] = m ? (m.kind === 'array' ? [m.rows, m.cols] : [m.groups, m.each]) : nums(q.q);
      const right = [`${g} × ${e}`, `${e} × ${g}`];
      assert.ok(right.includes(q.a), `${at(q)}: ${q.a}`);
      for (const w of q.wrong) {
        assert.ok(!right.includes(w), `${at(q)}: ${w} is right too`);
        assert.notEqual(calc(w), g * e, `${at(q)}: ${w} is worth the same`);
      }
    },
    units: q => expectChoice(q, /^What are equal groups called\?$/.test(q.q) ? 'Units' : 'A unit'),
    sameTotal(q) {
      const total = +q.q.match(/make (\d+) in all/)[1];
      expectMulti(q, o => {
        const [g, e] = o.match(/^(\d+) groups of (\d+)$/).slice(1).map(Number);
        return g * e === total;
      });
    },
  },
  bars: {
    count: q => expectChoice(q, `${sum(q.model.bars)} units`),
    total(q) {
      assert.equal(q.model.bars.length, 1);
      expectChoice(q, q.model.bars[0] * num(q.model.unit));
    },
    unitValue: q => expectChoice(q, divExact(num(q.model.total), q.model.bars[0])),
    buildTotal(q) {
      const n = sum(q.model.bars), u = num(q.model.unit);
      assert.equal(q.slots[0], String(u));
      assert.deepEqual(q.solutions, [['×', String(n), String(n * u)]]);
    },
    buildUnit(q) {
      const n = sum(q.model.bars), t = num(q.model.total);
      assert.equal(q.slots[0], String(t));
      assert.ok(q.solutions.some(s => s.join(' ') === `÷ ${n} ${divExact(t, n)}`), `${at(q)}: ${JSON.stringify(q.solutions)}`);
    },
    timesAsMany(q) {
      const [one, k] = q.model.bars, u = num(q.model.unit);
      assert.equal(one, 1);
      assert.deepEqual(nums(q.show), [u, k]);
      expectChoice(q, /in all/.test(q.q) ? (k + 1) * u : k * u);
    },
  },
  multFacts: {
    fact(q) {
      const [a, b] = q.show.match(/^(\d+) × (\d+) = \?$/).slice(1).map(Number);
      expectChoice(q, a * b);
    },
    missing(q) {
      const m = q.show.match(/^\? × (\d+) = (\d+)$/) || q.show.match(/^(\d+) × \? = (\d+)$/);
      expectChoice(q, divExact(+m[2], +m[1]));
    },
    trueFalse: q => expectSort(q, l => (isTrueEq(l) ? 0 : 1)),
    build(q) {
      assert.deepEqual([q.slots[0], q.slots[1], q.slots[2], q.slots[3]], [null, '×', null, '=']);
    },
    sameProduct(q) {
      const t = +q.q.match(/equal (\d+)\.$/)[1];
      expectMulti(q, o => calc(o) === t);
    },
  },
  divFacts: {
    fact(q) {
      const [c, b] = q.show.match(/^(\d+) ÷ (\d+) = \?$/).slice(1).map(Number);
      expectChoice(q, divExact(c, b));
    },
    missing(q) {
      const d = q.show.match(/^(\d+) ÷ \? = (\d+)$/);
      if (d) return expectChoice(q, divExact(+d[1], +d[2]));
      const m = q.show.match(/^\? ÷ (\d+) = (\d+)$/);
      expectChoice(q, +m[1] * +m[2]);
    },
    split(q) {
      assert.match(q.show, /^\d+ (divided|split) into \d+ (equal )?groups/);
      const [c, b] = nums(q.show);
      expectChoice(q, divExact(c, b));
    },
    groupsOf(q) {
      assert.match(q.show, /groups of \d+$/);
      const [c, b] = nums(q.show);
      expectChoice(q, divExact(c, b));
    },
    sameQuotient(q) {
      const t = +q.q.match(/equal (\d+)\.$/)[1];
      expectMulti(q, o => calc(o) === t);
    },
  },
  oneMore: {
    more(q) {
      const [a, b, c, d] = nums(q.show ?? q.q);
      assert.ok(b === d && a === c + 1, q.show ?? q.q);
      expectChoice(q, a * b - c * d);
    },
    less(q) {
      const [a, b, c, d] = nums(q.show ?? q.q);
      assert.ok(b === d && c === a + 1, q.show ?? q.q);
      expectChoice(q, c * d - a * b);
    },
    next: q => nextPrev(q, 1),
    prev: q => nextPrev(q, -1),
    build(q) {
      const [x, b, p] = nums(q.show), [a, b2] = nums(q.q);
      assert.ok(x * b === p && b2 === b && a === x + 1);
      assert.equal(q.slots[0], String(p));
      assert.deepEqual(q.solutions, [[String(b), String(a * b)]]);
    },
  },
  breakApart: {
    sum(q) {
      const [a, b, c, d, e] = nums(q.show);
      assert.ok(b === d && d === e, q.show);
      expectChoice(q, a + c);
    },
    split(q) {
      const [n, b, a, b2, b3] = nums(q.show);
      assert.ok(b === b2 && b2 === b3, q.show);
      expectChoice(q, n - a);
    },
    combine(q) {
      const [a, b, p, c, d, r] = nums(q.show), [n, b2] = nums(q.q);
      assert.ok(a * b === p && c * d === r && b === d && b2 === b && n === a + c, `${q.show} ${q.q}`);
      expectChoice(q, n * b);
    },
    which(q) {
      const [n, b] = nums(q.q);
      const [a, b1, c, b2] = q.a.match(/^(\d+) × (\d+) \+ (\d+) × (\d+)$/).slice(1).map(Number);
      assert.ok(b1 === b && b2 === b && a + c === n, `${at(q)}: ${q.a}`);
      for (const w of q.wrong) assert.notEqual(calc(w), n * b, `${at(q)}: ${w} is worth the same`);
    },
    build(q) {
      const [n, b, a, b2, c, b3] = nums(q.show);
      assert.ok(b === b2 && b2 === b3 && a + c === n, q.show);
      assert.equal(q.slots[4], String(n * b));
      sameNums(q.solutions[0].map(Number), [a * b, c * b]);
    },
  },
  zeroOne: {
    fact: q => expectChoice(q, fmt(calc(q.show.match(/^(.+) = \?$/)[1]))),
    rule: q => expectTerm(q, TERMS.zeroOne),
    trueFalse: q => expectSort(q, l => (isTrueEq(l) ? 0 : 1)),
    sameAnswer(q) {
      const t = num(q.q.match(/equal ([\d,]+)\.$/)[1]);
      expectMulti(q, o => calc(o) === t);
    },
  },
  signs: {
    choose(q) {
      const w = works(q.show);
      assert.equal(w.length, 1, q.show);
      expectChoice(q, w[0]);
    },
    build: q => assert.deepEqual([...q.tiles].sort(), [...SIGNS].sort()),
    multi(q) {
      const op = q.q.match(/need (×|÷)\.$/)[1];
      expectMulti(q, o => {
        const w = works(o);
        assert.equal(w.length, 1, o);
        return w[0] === op;
      });
    },
    sort: q => expectSort(q, l => {
      const w = works(l);
      assert.ok(w.length === 1 && ['×', '÷'].includes(w[0]), l);
      return w[0] === '×' ? 0 : 1;
    }),
  },
  factFamily: {
    matchDiv: q => familyChoice(q, '÷'),
    matchMult: q => familyChoice(q, '×'),
    build(q) {
      const family = nums(q.show);
      assert.ok(isTrueEq(q.show));
      for (const s of q.solutions) {
        const eq = [...q.slots];
        let k = 0;
        eq.forEach((x, i) => { if (x === null) eq[i] = s[k++]; });
        sameNums(eq.filter(x => /\d/.test(x)).map(Number), family, `${at(q)}: ${eq.join(' ')}`);
      }
    },
    family(q) {
      const family = nums(q.show);
      assert.ok(isTrueEq(q.show));
      expectMulti(q, o => isTrueEq(o) && sorted(nums(o)).join() === sorted(family).join());
    },
    missing(q) {
      assert.ok(isTrueEq(q.show), q.show);
      const expr = q.q.match(/^So what is (.+)\?$/)[1];
      sameNums(nums(expr).concat(calc(expr)), nums(q.show));
      expectChoice(q, calc(expr));
    },
  },
  remainders: {
    solve(q) {
      const [c, b] = q.show.match(/^(\d+) ÷ (\d+) = \?$/).slice(1).map(Number);
      remRange(c, b);
      expectChoice(q, remText(c, b));
    },
    remainder(q) {
      const [c, b, x] = nums(q.show);
      remRange(c, b);
      assert.ok(c % b > 0, q.show);
      if (/is \d+ with a remainder of __$/.test(q.show)) {
        assert.equal(x, Math.floor(c / b));
        return expectChoice(q, c % b);
      }
      if (/is __ with a remainder of \d+$/.test(q.show)) {
        assert.equal(x, c % b);
        return expectChoice(q, Math.floor(c / b));
      }
      assert.match(q.q, /What is the remainder/);
      expectChoice(q, c % b);
    },
    which(q) {
      const t = /no remainder/.test(q.q) ? 0 : +q.q.match(/remainder of (\d)\?$/)[1];
      assert.equal(remOf(q.a), t, `${at(q)}: ${q.a}`);
      for (const w of q.wrong) assert.notEqual(remOf(w), t, `${at(q)}: ${w} is right too`);
      for (const e of [q.a, ...q.wrong]) remRange(...nums(e));
    },
    multi(q) {
      const ok = /no remainder/.test(q.q) ? r => r === 0 : /remainder of 1/.test(q.q) ? r => r === 1 : r => r > 0;
      expectMulti(q, o => ok(remOf(o)));
    },
    sort: q => expectSort(q, l => (remOf(l) ? 0 : 1)),
    tapParts(q) {
      const [c, , b, , d, , r] = q.parts.map(Number);
      assert.ok(c === b * d + r && r > 0 && r < b, q.parts.join(' '));
      assert.deepEqual(q.answer, [{ dividend: 0, divisor: 2, quotient: 4, remainder: 6 }[q.q.match(/^Tap the (\w+)\.$/)[1]]]);
    },
    biggest: q => expectChoice(q, nums(q.q)[0] - 1),
  },
  remainderStory: {
    roundUp(q) {
      const [c, b] = storyNums(q.show);
      assert.ok(c % b > 0);
      expectChoice(q, Math.ceil(c / b));
    },
    drop(q) {
      const [c, b] = storyNums(q.show);
      assert.ok(c % b > 0);
      expectChoice(q, Math.floor(c / b));
    },
    leftover(q) {
      const [c, b] = storyNums(q.show);
      expectChoice(q, c % b);
    },
    sort: q => expectSort(q, l => (/\b(all|every)/i.test(l) ? 0 : (assert.match(l, /full|exactly|each/i), 1))),
    pair(q) {
      const [c, b] = storyNums(q.show);
      expectMulti(q, o => {
        const m = o.match(/^(\d+) (full \w+|left over)$/);
        assert.ok(m, o);
        return +m[1] === (m[2] === 'left over' ? c % b : Math.floor(c / b));
      });
    },
    equation(q) {
      const [c, b] = storyNums(q.show);
      expectChoice(q, `${c} ÷ ${b}`);
    },
  },
  evenOdd: {
    define: q => expectTerm(q, TERMS.evenOdd),
    notEven(q) {
      const odd = /not an even|is odd/.test(q.q) ? 1 : 0;
      assert.equal(num(q.a) % 2, odd, at(q));
      for (const w of q.wrong) assert.equal(num(w) % 2, 1 - odd, `${at(q)}: ${w}`);
    },
    sort: q => expectSort(q, l => num(l) % 2),
    multi(q) {
      const odd = /odd/.test(q.q) ? 1 : 0;
      expectMulti(q, o => num(o) % 2 === odd);
    },
    lastDigit(q) {
      const digits = `${q.show ?? ''} ${q.q}`.match(/\d{1,3}(?:,\d{3})+|\d+/)[0].replace(/,/g, '');
      expectChoice(q, digits.at(-1));
      for (const w of q.wrong) assert.ok(digits.slice(0, -1).includes(w), `${at(q)}: ${w}`);
    },
    defineSort: q => expectSort(q, l => {
      const like = l.match(/^Like ([\d,]+) and ([\d,]+)$/);
      if (like) {
        assert.equal(num(like[1]) % 2, num(like[2]) % 2, l);
        return num(like[1]) % 2;
      }
      return { 'No remainder when divided by 2': 0, 'Splits into 2 equal groups': 0, 'Every one has a partner': 0, 'Remainder 1 when divided by 2': 1, 'One is left without a partner': 1 }[l];
    }),
  },
  oddEvenProducts: {
    multi(q) {
      const odd = /odd/.test(q.q) ? 1 : 0;
      expectMulti(q, o => calc(o) % 2 === odd);
    },
    sort: q => expectSort(q, l => calc(l) % 2),
    pick(q) {
      const odd = /odd/.test(q.q) ? 1 : 0;
      assert.equal(calc(q.a) % 2, odd, at(q));
      for (const w of q.wrong) assert.equal(calc(w) % 2, 1 - odd, `${at(q)}: ${w}`);
    },
    compute(q) {
      const v = calc(q.show.match(/^(.+) = \?$/)[1]);
      expectChoice(q, `${v}, ${v % 2 ? 'odd' : 'even'}`);
    },
  },
  expressions: {
    groups(q) {
      const [x, y] = nums(`${q.show} ${q.q}`);
      assert.ok([`${x} × ${y}`, `${y} × ${x}`].includes(q.a), `${at(q)}: ${q.a}`);
      for (const w of q.wrong) assert.notEqual(calc(w), x * y, `${at(q)}: ${w} is worth the same`);
    },
    share(q) {
      const [c, b] = storyNums(q.show);
      expectChoice(q, `${c} ÷ ${b}`);
      for (const w of q.wrong) assert.notEqual(calc(w), c / b, `${at(q)}: ${w} is worth the same`);
    },
    build(q) {
      if (q.slots[1] === '×') {
        const [e, n] = nums(q.show);
        for (const s of q.solutions) assert.equal(+s[2], e * n);
      } else {
        const [c, b] = storyNums(q.show);
        assert.equal(q.slots[2], String(b));
        assert.deepEqual(q.solutions, [[String(c), String(c / b)]]);
      }
    },
    multi(q) {
      const [n, e] = nums(q.show);
      expectMulti(q, o => calc(o) === n * e);
    },
  },
  wordProblems: {
    multiply(q) {
      const [n, e] = nums(q.show);
      expectChoice(q, n * e);
    },
    divide(q) {
      const [c, b] = storyNums(q.show);
      expectChoice(q, divExact(c, b));
    },
    twoStepAdd(q) {
      const [x, y] = nums(q.show), [n] = nums(q.q);
      expectChoice(q, (x + y) * n);
    },
    twoStepSub(q) {
      const [total, red] = nums(q.show), [b] = nums(q.q);
      expectChoice(q, divExact(total - red, b));
    },
    compare(q) {
      const [u, k] = nums(q.show);
      if (q.model) assert.deepEqual([q.model.bars, q.model.unit], [[1, k], String(u)]);
      expectChoice(q, /in all/.test(q.q) ? (k + 1) * u : k * u);
    },
    build(q) {
      const n = nums(`${q.show} ${q.q}`);
      if (q.slots[0] !== null) {
        const [u, k] = n;
        assert.equal(q.slots[0], String(u));
        assert.deepEqual(q.solutions, [[String(k), String(k * u)]]);
      } else {
        const [x, y, groups] = n;
        for (const s of q.solutions) assert.equal(+s[2], (x + y) * groups);
      }
    },
  },
};

// ---------- Format and card limits ----------

const BASE_KEYS = ['skill', 'variant', 'type', 'show', 'q', 'say', 'why', 'pic', 'model'];
const TYPE_KEYS = { choice: ['a', 'wrong'], tap: ['parts', 'answer'], multi: ['options', 'correct'], build: ['slots', 'tiles', 'solutions'], sort: ['bins', 'items'] };

function short(s, maxWords, maxChars, what) {
  assert.equal(typeof s, 'string', `${what} must be text`);
  assert.ok(s.trim().length > 0, `${what} is empty`);
  assert.ok(words(s) <= maxWords, `${what} "${s}" has more than ${maxWords} words`);
  assert.ok(s.length <= maxChars, `${what} "${s}" is longer than ${maxChars} characters`);
}
function distinct(list, what) {
  const keys = list.map(x => String(x).trim().toLowerCase());
  assert.equal(new Set(keys).size, keys.length, `${what} must all be different: ${list.join(' | ')}`);
}
const whole = (n, lo, hi) => Number.isInteger(n) && n >= lo && n <= hi;

function checkModel(m, where) {
  if (m.kind === 'groups') {
    assert.deepEqual(Object.keys(m).sort(), ['each', 'groups', 'kind'], where);
    assert.ok(whole(m.groups, 1, 8) && whole(m.each, 1, 9), `${where}: groups model out of range`);
  } else if (m.kind === 'array') {
    assert.deepEqual(Object.keys(m).sort(), ['cols', 'kind', 'rows'], where);
    assert.ok(whole(m.rows, 1, 6) && whole(m.cols, 1, 10), `${where}: array model out of range`);
  } else {
    assert.equal(m.kind, 'bars', `${where}: unknown model kind`);
    assert.deepEqual(Object.keys(m).filter(k => !['kind', 'bars', 'unit', 'total', 'names'].includes(k)), [], where);
    assert.ok(Array.isArray(m.bars) && m.bars.length >= 1 && m.bars.length <= 3 && m.bars.every(n => whole(n, 1, 10)), `${where}: bars out of range`);
    if (m.unit !== undefined) assert.ok(typeof m.unit === 'string' && m.unit.length >= 1 && m.unit.length <= 4, `${where}: unit label`);
    if (m.total !== undefined) assert.ok(typeof m.total === 'string' && m.total.length >= 1 && m.total.length <= 4, `${where}: total label`);
    if (m.names !== undefined) {
      assert.equal(m.names.length, m.bars.length, `${where}: one name per bar`);
      for (const n of m.names) assert.ok(typeof n === 'string' && n.length >= 1 && n.length <= 10, `${where}: bar name "${n}"`);
    }
  }
}

function checkQuestion(q, id, lane) {
  const where = `${id}/${q.variant}`;
  assert.equal(q.skill, id);
  assert.ok((lane ? SKILLS[id].laneVariants : VARIANTS[id]).includes(q.variant), `${where}: unknown variant`);
  assert.ok(TYPE_KEYS[q.type], `${where}: unknown type ${q.type}`);
  const allowed = [...BASE_KEYS, ...TYPE_KEYS[q.type]];
  assert.deepEqual(Object.keys(q).filter(k => !allowed.includes(k)), [], `${where}: unknown keys`);
  for (const k of TYPE_KEYS[q.type]) assert.ok(q[k] !== undefined, `${where}: missing ${k}`);
  for (const k of Object.keys(q)) assert.notEqual(q[k], undefined, `${where}: ${k} is undefined`);

  if (q.show !== undefined) short(q.show, 12, lane ? 24 : 64, `${where} show`);
  short(q.q, 10, lane ? 40 : 56, `${where} q`);
  short(q.why, 8, 48, `${where} why`);
  if (q.say !== undefined) assert.ok(typeof q.say === 'string' && q.say.trim() && q.say.length <= 180, `${where}: say "${q.say}"`);
  if (q.pic !== undefined) assert.ok(PICS.includes(q.pic), `${where}: pic "${q.pic}" is not in PICS`);
  if (q.model !== undefined) checkModel(q.model, where);
  for (const s of strings(q)) assert.ok(!EMOJI.test(s), `${where}: "${s}" has an emoji`);
  for (const s of strings(q)) assert.ok(!/[*/]|\d\s?-\s?\d|\s-\s/.test(s), `${where}: "${s}" uses an ASCII math sign (use × ÷ −)`);
  for (const s of strings(q)) assert.ok(!/\d{4,}/.test(s), `${where}: "${s}" needs commas in big numbers`);
  if (q.say !== undefined) assert.ok(!/[×÷−=]|__|(^|\s)\?(\s|$)/.test(q.say), `${where}: say "${q.say}" should be words`);

  if (lane) {
    assert.equal(q.type, 'choice', `${where}: lane questions are choices`);
    assert.equal(q.model, undefined, `${where}: the lane banner can't draw a picture`);
  }
  if (q.type === 'choice') {
    assert.ok(Array.isArray(q.wrong) && q.wrong.length >= (lane ? 2 : 3), `${where}: needs more wrong answers`);
    for (const ans of [q.a, ...q.wrong]) short(ans, 4, lane ? 8 : 24, `${where} answer`);
    distinct([q.a, ...q.wrong], `${where} answers`);
  } else if (q.type === 'tap') {
    assert.ok(q.parts.length >= 3 && q.parts.length <= 7, `${where}: 3-7 parts`);
    for (const p of q.parts) assert.ok(typeof p === 'string' && p.length >= 1 && p.length <= 5, `${where}: part "${p}"`);
    assert.ok(q.answer.length >= 1 && new Set(q.answer).size === q.answer.length, `${where}: answer indexes`);
    for (const i of q.answer) assert.ok(Number.isInteger(i) && !Number.isNaN(num(q.parts[i] ?? '')), `${where}: answer ${i} must point at a number`);
  } else if (q.type === 'multi') {
    assert.ok(q.options.length >= 4 && q.options.length <= 6, `${where}: 4-6 options`);
    for (const o of q.options) assert.ok(typeof o === 'string' && o.length >= 1 && o.length <= 16, `${where}: option "${o}"`);
    distinct(q.options, `${where} options`);
    assert.ok(q.correct.length >= 1 && q.correct.length <= 3 && q.correct.length < q.options.length, `${where}: 1-3 right options`);
    assert.ok(q.correct.every(i => Number.isInteger(i) && i >= 0 && i < q.options.length) && new Set(q.correct).size === q.correct.length, `${where}: correct indexes`);
    assert.match(q.q, new RegExp(`\\b${q.correct.length}\\b`), `${where}: q must say how many to tap`);
  } else if (q.type === 'build') {
    assert.equal(q.slots.length, 5, `${where}: 5 slots`);
    assert.equal(q.slots[3], '=', `${where}: slot 4 is =`);
    const blanks = q.slots.filter(s => s === null).length;
    assert.ok(blanks >= 1 && blanks <= 3, `${where}: 1-3 blanks`);
    for (const s of q.slots) if (s !== null) assert.ok(typeof s === 'string' && s.length <= 5, `${where}: slot "${s}"`);
    assert.ok(q.tiles.length >= 4 && q.tiles.length <= 8, `${where}: 4-8 tiles, got ${q.tiles.join(' ')}`);
    for (const t of q.tiles) assert.ok(typeof t === 'string' && t.length >= 1 && t.length <= 5, `${where}: tile "${t}"`);
    distinct(q.tiles, `${where} tiles`);
    assert.ok(q.solutions.length >= 1, `${where}: needs a solution`);
    for (const s of q.solutions) {
      assert.equal(s.length, blanks, `${where}: a solution fills every blank`);
      assert.ok(s.every(t => q.tiles.includes(t)), `${where}: solution ${s.join(' ')} uses a missing tile`);
      assert.equal(new Set(s).size, s.length, `${where}: solution ${s.join(' ')} needs a tile twice`);
    }
    const used = new Set(q.solutions.flat()), spare = q.tiles.filter(t => !used.has(t));
    if ([0, 2, 4].some(i => q.slots[i] === null)) assert.ok(spare.filter(t => !SIGNS.includes(t)).length >= 2, `${where}: needs 2+ wrong number tiles: ${q.tiles.join(' ')}`);
    if (q.slots[1] === null) assert.ok(spare.some(t => SIGNS.includes(t)), `${where}: needs a wrong sign tile: ${q.tiles.join(' ')}`);
    const key = f => f.join(' | ');
    const found = trueFills(q.slots, q.tiles).map(key).sort();
    assert.deepEqual(found, q.solutions.map(key).sort(), `${where}: ${q.slots.map(s => s ?? '__').join(' ')} with tiles ${q.tiles.join(' ')}`);
  } else if (q.type === 'sort') {
    assert.equal(q.bins.length, 2, `${where}: 2 bins`);
    for (const b of q.bins) assert.ok(typeof b === 'string' && b.length >= 1 && b.length <= 12, `${where}: bin "${b}"`);
    distinct(q.bins, `${where} bins`);
    assert.ok(q.items.length >= 4 && q.items.length <= 6, `${where}: 4-6 items`);
    distinct(q.items.map(i => i.label), `${where} item labels`);
    for (const i of q.items) {
      assert.deepEqual(Object.keys(i).filter(k => !['label', 'bin', 'why'].includes(k)), [], `${where}: item keys`);
      short(i.label, 6, 32, `${where} item`);
      assert.ok(i.bin === 0 || i.bin === 1, `${where}: bin must be 0 or 1`);
      if (i.why !== undefined) assert.ok(typeof i.why === 'string' && i.why.trim() && i.why.length <= 32, `${where}: item why "${i.why}"`);
    }
    assert.ok(q.items.some(i => i.bin === 0) && q.items.some(i => i.bin === 1), `${where}: both bins get items`);
  }
  MATH[id][q.variant](q, lane);
}

// Show + q + answer, for counting how varied the questions are.
function key(q) {
  const answer = { choice: () => q.a, tap: () => `${q.parts.join(' ')}>${q.answer}`, multi: () => `${q.options}>${q.correct}`, build: () => `${q.slots}>${JSON.stringify(q.solutions)}`, sort: () => JSON.stringify(q.items) }[q.type]();
  return `${q.show ?? ''}|${q.q}|${answer}`;
}

const made = new Map();
function batch(id, lane) {
  const k = `${id}|${lane}`;
  if (!made.has(k)) {
    const rng = rngFrom(1000 + ids.indexOf(id) * 7 + (lane ? 1 : 0));
    made.set(k, Array.from({ length: N }, () => SKILLS[id].gen(rng, { lane })));
  }
  return made.get(k);
}

// ---------- Tests ----------

test('every skill has a title, variants and a lane flag', () => {
  assert.equal(ids.length, 17);
  for (const id of ids) {
    const s = SKILLS[id];
    short(s.title, 4, 20, `${id} title`);
    assert.ok(!EMOJI.test(s.title));
    assert.equal(typeof s.gen, 'function');
    assert.deepEqual(VARIANTS[id], s.variants, `${id}: VARIANTS matches SKILLS`);
    assert.ok(s.variants.length >= 3, `${id}: at least 3 variants`);
    distinct(s.variants, `${id} variants`);
    assert.ok(s.laneVariants.every(v => s.variants.includes(v)), `${id}: lane variants are variants`);
    assert.equal(s.lane, s.laneVariants.length > 0);
  }
  for (const id of ['multFacts', 'divFacts', 'oneMore', 'breakApart', 'zeroOne', 'signs', 'factFamily', 'remainders', 'evenOdd', 'oddEvenProducts']) {
    assert.ok(SKILLS[id].lane, `${id} must have lane questions for the sky stage`);
  }
});

for (const id of ids) {
  test(`${id}: ${N} questions are well formed and right`, () => {
    for (const q of batch(id, false)) checkQuestion(q, id, false);
  });
  if (SKILLS[id].lane) {
    test(`${id}: ${N} lane questions are well formed and right`, () => {
      for (const q of batch(id, true)) checkQuestion(q, id, true);
    });
  }
}

test('each skill makes every one of its variants and types', () => {
  for (const id of ids) {
    const qs = batch(id, false);
    assert.deepEqual([...new Set(qs.map(q => q.variant))].sort(), [...VARIANTS[id]].sort(), `${id}: variants made`);
    const typeOf = {};
    for (const q of qs) {
      typeOf[q.variant] ??= q.type;
      assert.equal(q.type, typeOf[q.variant], `${id}/${q.variant} always has the same type`);
    }
    assert.ok(new Set(Object.values(typeOf)).size >= 2, `${id}: mixes question types`);
    if (SKILLS[id].lane) {
      const lane = batch(id, true);
      assert.deepEqual([...new Set(lane.map(q => q.variant))].sort(), [...SKILLS[id].laneVariants].sort(), `${id}: lane variants made`);
    }
  }
});

test('questions are varied', () => {
  for (const id of ids) {
    assert.ok(new Set(batch(id, false).map(key)).size >= 30, `${id}: at least 30 different questions in ${N}`);
    if (SKILLS[id].lane) assert.ok(new Set(batch(id, true).map(key)).size >= 30, `${id}: at least 30 different lane questions in ${N}`);
  }
});

test('opts.variant picks the variant, for re-asking a missed question', () => {
  const rng = rngFrom(7);
  for (const id of ids) {
    for (const v of VARIANTS[id]) {
      for (let i = 0; i < 25; i++) {
        const q = makeQuestion({ gen: id, variant: v }, rng);
        assert.equal(q.variant, v);
        checkQuestion(q, id, false);
      }
    }
    for (const v of SKILLS[id].laneVariants) {
      for (let i = 0; i < 25; i++) {
        const q = makeQuestion({ gen: id, variant: v, lane: true }, rng);
        assert.equal(q.variant, v);
        checkQuestion(q, id, true);
      }
    }
  }
  assert.throws(() => makeQuestion({ gen: 'remainders', variant: 'nope' }, rng), /variant/);
  assert.throws(() => SKILLS.remainders.gen(rng, { variant: 'toString' }), /variant/);
  // A missed sort question re-asked in a lane section turns into a lane-ready variant of the same skill.
  const q = makeQuestion({ gen: 'remainders', variant: 'sort', lane: true }, rng);
  assert.ok(SKILLS.remainders.laneVariants.includes(q.variant));
  checkQuestion(q, 'remainders', true);
  assert.throws(() => makeQuestion({ gen: 'bars', lane: true }, rng), /lane/);
});

test('makeQuestion throws on unknown skills', () => {
  for (const gen of ['nope', 'toString', '__proto__', 'constructor', undefined]) assert.throws(() => makeQuestion({ gen }), /skill/);
  assert.throws(() => makeQuestion(undefined), /skill/);
});

test('the same seed makes the same question', () => {
  for (const id of ids) assert.deepEqual(makeQuestion({ gen: id }, rngFrom(42)), makeQuestion({ gen: id }, rngFrom(42)));
});

test('grab rules hand out right and wrong items, about half good', () => {
  const rng = rngFrom(99);
  const checks = {
    even: () => l => num(l) % 2 === 0,
    odd: () => l => num(l) % 2 === 1,
    times: t => {
      const k = +t.match(/^Numbers in the (\d+)s$/)[1];
      assert.ok(k >= 2 && k <= 10);
      return l => num(l) % k === 0 && num(l) / k >= 1 && num(l) / k <= 10;
    },
    equals: t => {
      const total = +t.match(/^Facts that make (\d+)$/)[1];
      return l => calc(l) === total;
    },
    oddAnswer: () => l => calc(l) % 2 === 1,
    evenAnswer: () => l => calc(l) % 2 === 0,
  };
  for (const [kind, makeCheck] of Object.entries(checks)) {
    for (let r = 0; r < 20; r++) {
      const rule = grabRule(rng, kind);
      assert.equal(rule.kind, kind);
      short(rule.title, 5, 22, `${kind} title`);
      assert.ok(typeof rule.say === 'string' && rule.say.length > 0 && rule.say.length <= 60);
      const isGood = makeCheck(rule.title);
      let good = 0;
      for (let i = 0; i < 60; i++) {
        const item = rule.next(rng);
        assert.deepEqual(Object.keys(item).sort(), ['good', 'label', 'why']);
        assert.ok(item.label.length >= 1 && item.label.length <= 8, `${kind}: label "${item.label}"`);
        assert.ok(item.why.length >= 1 && item.why.length <= 24, `${kind}: why "${item.why}"`);
        for (const s of strings(item)) assert.ok(!EMOJI.test(s));
        assert.equal(item.good, isGood(item.label), `${kind} (${rule.title}): "${item.label}"`);
        if (item.good) good++;
      }
      assert.ok(good >= 15 && good <= 45, `${kind}: ${good} of 60 were good`);
    }
  }
  assert.throws(() => grabRule(rng, 'nope'), /grab rule/);
});
