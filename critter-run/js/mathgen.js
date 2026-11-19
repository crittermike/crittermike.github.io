// Math questions for Critter Run: Ch. 4, multiplication and division (3rd grade).
// Every call makes a new question with random numbers and wording, in the format the game draws:
//   { skill, variant, type, show?, q, say?, why, pic?, model?, ...the fields for its type }
// A missed question comes back as makeQuestion({ gen: skill, variant }) with new numbers.
// No imports and no Node APIs: the game loads it in the browser and the tests load it in Node.

// ---------- Random helpers ----------

// A small seeded random number generator (mulberry32), for tests and repeatable samples.
export function rngFrom(seed = 1) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const int = (rng, lo, hi) => lo + Math.floor(rng() * (hi - lo + 1));
const pick = (rng, list) => list[Math.floor(rng() * list.length)];
const chance = (rng, p) => rng() < p;
function shuffle(rng, list) {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
const sample = (rng, list, n) => shuffle(rng, list).slice(0, n);
const unique = list => [...new Set(list)];
function twoDiff(rng, lo, hi) {
  const a = int(rng, lo, hi);
  let b;
  do b = int(rng, lo, hi); while (b === a);
  return [a, b];
}

// ---------- Numbers and math text ----------

const fmt = n => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
const times = (a, b) => `${fmt(a)} × ${fmt(b)}`;
const divBy = (a, b) => `${fmt(a)} ÷ ${fmt(b)}`;
const withR = (q, r) => (r ? `${fmt(q)} R${r}` : fmt(q));
const plural = (n, one, many) => `${fmt(n)} ${n === 1 ? one : many}`;
const cap = s => s[0].toUpperCase() + s.slice(1);

// The value of a short expression like '5 × 4 + 2 × 4' or '(4 + 2) × 4'. Division must come out even, or it's NaN.
function value(expr) {
  const t = expr.replace(/,/g, '').match(/\d+|[×÷+−()]/g) || [];
  let i = 0;
  const atom = () => {
    if (t[i] !== '(') return Number(t[i++]);
    i++;
    const v = sum();
    i++;
    return v;
  };
  const product = () => {
    let v = atom();
    while (t[i] === '×' || t[i] === '÷') {
      const op = t[i++], w = atom();
      v = op === '×' ? v * w : w !== 0 && v % w === 0 ? v / w : NaN;
    }
    return v;
  };
  const sum = () => {
    let v = product();
    while (t[i] === '+' || t[i] === '−') {
      const op = t[i++], w = product();
      v = op === '+' ? v + w : v - w;
    }
    return v;
  };
  return sum();
}
const holds = eq => {
  const [left, right] = eq.split('=');
  return right !== undefined && value(left) === value(right);
};

// Wrong number answers: every `must` mistake, then random `maybe` ones, then nearby numbers. Never the answer, never twice.
function wrongNums(rng, answer, must = [], maybe = [], { count = 3, min = 1, as = fmt } = {}) {
  const out = [];
  const add = m => {
    if (out.length < count && Number.isInteger(m) && m >= min && m !== answer && !out.includes(m)) out.push(m);
  };
  must.forEach(add);
  shuffle(rng, maybe).forEach(add);
  for (let d = 1; out.length < count; d++) [answer + d, answer - d].forEach(add);
  return out.map(as);
}

// Wrong expression answers. Any worth the same as the answer is dropped, since it would be right too.
function wrongExprs(rng, worth, right, list, count = 3) {
  const out = [];
  for (const e of shuffle(rng, list)) {
    if (out.length < count && !right.includes(e) && !out.includes(e) && value(e) !== worth) out.push(e);
  }
  return out;
}

// Words for the read-aloud voice: '6 × ? = 42' becomes '6 times what equals 42'.
const speak = s => s
  .replace(/__/g, 'blank')
  .replace(/(^|\s)\?(?=\s|$)/g, '$1what')
  .replace(/\b(\d+) R(\d+)\b/g, '$1 remainder $2')
  .replace(/×/g, 'times').replace(/÷/g, 'divided by').replace(/−/g, 'minus').replace(/\+/g, 'plus').replace(/=/g, 'equals');

// ---------- Question types ----------

const choice = o => ({ type: 'choice', ...o });

// A read-aloud line from a math line and the question: '6 × ? = 42' and q -> '6 times what equals 42. What is...'.
const sayIt = (line, q) => `${cap(speak(line))}. ${speak(q)}`;

// An equation drawn as tiles. Tapping any number listed in `answer` is right.
const tap = (o, parts, answer) => ({ type: 'tap', ...o, say: o.say ?? sayIt(parts.join(' '), o.q), parts: parts.map(String), answer });

function multi(rng, o, good, bad) {
  const options = shuffle(rng, [...good, ...bad]);
  return { type: 'multi', ...o, options, correct: options.flatMap((x, i) => (good.includes(x) ? [i] : [])) };
}

const sort = (rng, o, bins, items) => ({ type: 'sort', ...o, bins, items: shuffle(rng, items) });

const NUM = /^\d{1,3}(,\d{3})*$/;
const numOf = s => (NUM.test(s) ? Number(s.replace(/,/g, '')) : NaN);

// Is the filled equation 'X op Y = Z' true? Division has to come out even.
function isTrue([x, op, y, , z]) {
  const [a, b, c] = [x, y, z].map(numOf);
  if (Number.isNaN(a + b + c)) return false;
  if (op === '×') return a * b === c;
  if (op === '÷') return b !== 0 && a === b * c;
  if (op === '+') return a + b === c;
  if (op === '−') return a - b === c;
  return false;
}

// Every way to fill the blanks from the tiles that makes a true equation. A tile may be used twice here,
// in case the game lets him tap the same tile again.
function trueFills(slots, tiles) {
  const blanks = slots.flatMap((s, i) => (s === null ? [i] : []));
  const found = [];
  const walk = fill => {
    if (fill.length === blanks.length) {
      const eq = [...slots];
      blanks.forEach((b, k) => (eq[b] = fill[k]));
      if (isTrue(eq)) found.push(fill);
      return;
    }
    for (const t of tiles) walk([...fill, t]);
  };
  walk([]);
  return found;
}

// A build question. The tiles are the answers' tiles plus decoys, and a decoy is only kept
// if it can't make some other true equation.
function build(rng, o, slots, solutions, decoys) {
  const key = f => f.join('|');
  const want = new Set(solutions.map(key));
  const tiles = unique(solutions.flat());
  const extra = unique(decoys.filter(d => typeof d === 'string' || d >= 1).map(d => (typeof d === 'number' ? fmt(d) : d))).filter(d => !tiles.includes(d));
  // Decoys of each kind: every other sign when the sign is the only blank, else 1-2 signs for a sign blank,
  // and 2-3 numbers (enough for 4 tiles) for number blanks.
  const blanks = slots.filter(s => s === null).length, signBlank = slots[1] === null, numBlanks = blanks - (signBlank ? 1 : 0);
  const room = { sign: !signBlank ? 0 : numBlanks ? int(rng, 1, 2) : 3, num: 0 };
  if (numBlanks) room.num = Math.max(int(rng, 2, 3), 4 - tiles.length - room.sign);
  const isSign = d => SIGNS.includes(d);
  for (const d of [...shuffle(rng, extra.filter(isSign)), ...shuffle(rng, extra.filter(d => !isSign(d)))]) {
    const kind = isSign(d) ? 'sign' : 'num';
    if (room[kind] > 0 && tiles.length < 8 && trueFills(slots, [...tiles, d]).every(f => want.has(key(f)))) {
      tiles.push(d);
      room[kind]--;
    }
  }
  return { type: 'build', ...o, slots, tiles: shuffle(rng, tiles), solutions };
}

// ---------- Card limits ----------

const words = s => s.trim().split(/\s+/).filter(w => /[\p{L}\p{N}]/u.test(w)).length;
const short = (s, w, c) => typeof s === 'string' && s.trim() !== '' && words(s) <= w && s.length <= c;

// A made question that breaks a card limit is made again with new numbers.
function fits(q, lane) {
  if (q.show !== undefined && !short(q.show, 12, lane ? 24 : 64)) return false;
  if (!short(q.q, 10, lane ? 40 : 56) || !short(q.why, 8, 48)) return false;
  if (q.say !== undefined && q.say.length > 180) return false;
  if (lane && q.type !== 'choice') return false;
  switch (q.type) {
    case 'choice': {
      const all = [q.a, ...q.wrong];
      return q.wrong.length >= (lane ? 2 : 3) && all.every(s => short(s, 4, lane ? 8 : 24))
        && unique(all.map(s => s.toLowerCase())).length === all.length;
    }
    case 'tap':
      return q.parts.length >= 3 && q.parts.length <= 7 && q.parts.every(p => p.length <= 5) && q.answer.length > 0;
    case 'multi':
      return q.options.length >= 4 && q.options.length <= 6 && q.options.every(o => o.length <= 16)
        && unique(q.options).length === q.options.length && q.correct.length >= 1 && q.correct.length <= 3;
    case 'build': {
      // Real choices: 2+ spare numbers for number blanks, and a spare sign for a sign blank.
      const used = new Set(q.solutions.flat()), spare = q.tiles.filter(t => !used.has(t));
      const numBlanks = [0, 2, 4].some(i => q.slots[i] === null);
      return q.tiles.length >= 4 && q.tiles.length <= 8 && q.tiles.every(t => t.length <= 5)
        && (!numBlanks || spare.filter(t => !SIGNS.includes(t)).length >= 2) && (q.slots[1] !== null || spare.some(t => SIGNS.includes(t)));
    }
    case 'sort':
      return q.items.length >= 4 && q.items.length <= 6 && q.bins.every(b => b.length <= 12)
        && unique(q.items.map(i => i.label)).length === q.items.length
        && q.items.every(i => short(i.label, 6, 32) && (i.why === undefined || i.why.length <= 32))
        && [0, 1].every(b => q.items.some(i => i.bin === b));
  }
  return false;
}

const TYPE_KEYS = { choice: ['a', 'wrong'], tap: ['parts', 'answer'], multi: ['options', 'correct'], build: ['slots', 'tiles', 'solutions'], sort: ['bins', 'items'] };

function finish(skill, variant, q) {
  const out = { skill, variant, type: q.type };
  for (const k of ['show', 'q', 'say', 'why', 'pic', 'model', ...TYPE_KEYS[q.type]]) if (q[k] !== undefined) out[k] = q[k];
  // A show line with a blank or a '?' reads badly as-is, so the voice gets words instead.
  if (out.say === undefined && out.show && /(^|\s)(\?|__)(\s|$)/.test(out.show)) out.say = sayIt(out.show, out.q);
  return out;
}

// ---------- Story words ----------

const NAMES = ['Maria', 'Shelby', 'Leo', 'Ava', 'Sam', 'Mia', 'Noah', 'Zoe', 'Ben', 'Lily', 'Omar', 'Ivy', 'Jack', 'Ella', 'Max', 'Rosa', 'Kai', 'Nora'];
const TEACHERS = ['Mrs. Cannon', 'Mrs. Avery', 'Mr. Lee', 'Ms. Diaz'];

const place = (one, many, at = 'in') => ({ one, many, at });
const PLACES = {
  box: place('box', 'boxes'), bag: place('bag', 'bags'), jar: place('jar', 'jars'), cup: place('cup', 'cups'),
  tray: place('tray', 'trays', 'on'), plate: place('plate', 'plates', 'on'), shelf: place('shelf', 'shelves', 'on'),
  page: place('page', 'pages', 'on'), pack: place('pack', 'packs'), basket: place('basket', 'baskets'),
  bucket: place('bucket', 'buckets'), pot: place('pot', 'pots'), vase: place('vase', 'vases'), row: place('row', 'rows'),
};
const thing = (one, many, homes, pic) => ({ one, many, homes, pic });
const ITEMS = [
  thing('book', 'books', ['box', 'shelf', 'bag'], 'book'),
  thing('sticker', 'stickers', ['page', 'pack'], 'star'),
  thing('crayon', 'crayons', ['box', 'cup', 'pack'], 'pencil'),
  thing('cookie', 'cookies', ['plate', 'bag', 'jar', 'tray']),
  thing('marble', 'marbles', ['bag', 'jar', 'cup']),
  thing('apple', 'apples', ['basket', 'bag', 'box'], 'apple'),
  thing('card', 'cards', ['pack', 'box']),
  thing('pencil', 'pencils', ['box', 'cup', 'pack'], 'pencil'),
  thing('marker', 'markers', ['box', 'cup', 'pack'], 'pencil'),
  thing('shell', 'shells', ['bucket', 'bag', 'jar'], 'beach'),
  thing('cupcake', 'cupcakes', ['tray', 'box', 'plate']),
  thing('toy car', 'toy cars', ['box', 'shelf'], 'car'),
  thing('seed', 'seeds', ['pot', 'row', 'cup'], 'sprout'),
  thing('bead', 'beads', ['jar', 'bag', 'cup']),
  thing('peach', 'peaches', ['basket', 'box', 'bag'], 'peach'),
  thing('flower', 'flowers', ['vase', 'pot'], 'flower'),
];
// Something to count and where it goes: { it: books, at: boxes }.
function stuff(rng) {
  const it = pick(rng, ITEMS);
  return { it, at: PLACES[pick(rng, it.homes)] };
}

// A vocabulary question from a fixed list. The first wrong answer is the likeliest mix-up, so it's always offered.
// Lane mode only uses the short entries and answers.
function term(rng, entries, lane) {
  const fit = e => e.a.length <= 8 && e.q.length <= 40 && (!e.show || e.show.length <= 24);
  const e = pick(rng, lane ? entries.filter(fit) : entries);
  const [first, ...rest] = lane ? e.wrong.filter(w => w.length <= 8) : e.wrong;
  return choice({ show: e.show, q: e.q, a: e.a, wrong: wrongStrs(rng, e.a, [first], rest), why: e.why, pic: e.pic });
}

// ---------- 1. Factors and product ----------

const multWords = {
  title: 'Factors and Product',
  variants: {
    define: {
      w: 2, lane: true,
      make: (rng, lane) => term(rng, [
        { q: 'The numbers we multiply are called what?', a: 'Factors', wrong: ['Products', 'Divisors', 'Sums', 'Units'], why: 'We multiply factors to get a product.' },
        { q: 'What do we multiply to get a product?', a: 'Factors', wrong: ['Divisors', 'Quotients', 'Remainders', 'Sums'], why: 'Factor × factor = product.' },
        { q: 'What is the answer to a multiplication problem?', a: 'Product', wrong: ['Factor', 'Quotient', 'Sum', 'Divisor'], why: 'Factor × factor = product.' },
        { q: 'A product is the answer to what?', a: 'Multiplication', wrong: ['Division', 'Addition', 'Subtraction'], why: 'Factor × factor = product.' },
        { show: 'factor × factor = ?', q: 'What is the missing word?', a: 'Product', wrong: ['Factor', 'Quotient', 'Dividend', 'Sum'], why: 'Factor × factor = product.' },
        { show: '? × factor = product', q: 'What is the missing word?', a: 'Factor', wrong: ['Product', 'Quotient', 'Dividend', 'Divisor'], why: 'Factor × factor = product.' },
      ], lane),
    },
    // Label a random equation, sometimes written product first ('24 = 4 × 6').
    label: {
      w: 3,
      make(rng) {
        const a = int(rng, 2, 10), b = int(rng, 2, 10), p = a * b;
        const left = chance(rng, 0.35);
        const parts = left ? [p, '=', a, '×', b] : [a, '×', b, '=', p];
        if (chance(rng, 0.5)) {
          return tap({ q: pick(rng, ['Tap the product.', 'Which number is the product?']), why: `The product is the answer: ${p}.` }, parts, [left ? 0 : 4]);
        }
        return tap({ q: pick(rng, ['Tap a factor.', 'Tap one of the factors.']), why: `${a} and ${b} are the factors.` }, parts, left ? [2, 4] : [0, 2]);
      },
    },
    name: {
      w: 3, lane: true,
      make(rng) {
        const [a, b] = twoDiff(rng, 2, 10), p = a * b;
        const show = chance(rng, 0.3) ? `${p} = ${times(a, b)}` : `${times(a, b)} = ${p}`;
        const ask = pick(rng, ['product', 'factors', 'factor']);
        if (ask === 'product') {
          return choice({ show, q: `What is ${p} called?`, a: 'Product', wrong: wrongStrs(rng, 'Product', ['Factor'], ['Quotient', 'Sum', 'Dividend']), why: `${p} is the answer, the product.` });
        }
        if (ask === 'factors') {
          return choice({ show, q: `What are ${a} and ${b} called?`, a: 'Factors', wrong: wrongStrs(rng, 'Factors', ['Products'], ['Divisors', 'Sums', 'Units']), why: `We multiply the factors, ${a} and ${b}.` });
        }
        const f = pick(rng, [a, b]);
        return choice({ show, q: `What is ${f} called?`, a: 'Factor', wrong: wrongStrs(rng, 'Factor', ['Product'], ['Divisor', 'Quotient', 'Dividend']), why: `${f} is multiplied, so it is a factor.` });
      },
    },
    sort: {
      w: 2,
      make(rng) {
        let a, b, c, d;
        do [a, b, c, d] = [int(rng, 2, 10), int(rng, 2, 10), int(rng, 2, 10), int(rng, 2, 10)];
        while (unique([a, b, a * b, c, d, c * d]).length < 6);
        const fact = (x, y) => (chance(rng, 0.3) ? `${x * y} = ${times(x, y)}` : `${times(x, y)} = ${x * y}`);
        const show = `${fact(a, b)} and ${fact(c, d)}`;
        const q = 'Is each number a factor or a product?';
        const factors = sample(rng, [a, b, c, d], int(rng, 2, 4)).map(n => ({ label: String(n), bin: 0, why: `${n} is multiplied: a factor.` }));
        const products = [a * b, c * d].map(n => ({ label: String(n), bin: 1, why: `${n} is the answer: a product.` }));
        return sort(rng, { show, q, say: sayIt(show, q), why: 'Factors are multiplied to make the product.' }, ['Factor', 'Product'], [...factors, ...products]);
      },
    },
  },
};

// ---------- 2. Quotient, divisor, dividend ----------

const divWords = {
  title: 'Division Words',
  variants: {
    define: {
      w: 2, lane: true,
      make: (rng, lane) => term(rng, [
        { q: 'What is the answer to a division problem called?', a: 'Quotient', wrong: ['Product', 'Divisor', 'Dividend', 'Factor'], why: 'Dividend ÷ divisor = quotient.' },
        { q: 'What is the number you divide by called?', a: 'Divisor', wrong: ['Dividend', 'Quotient', 'Product', 'Factor'], why: 'You divide by the divisor.' },
        { q: 'What is the number that gets divided called?', a: 'Dividend', wrong: ['Divisor', 'Quotient', 'Product', 'Factor'], why: 'The dividend is the number divided.' },
        { show: 'dividend ÷ divisor = ?', q: 'What is the missing word?', a: 'Quotient', wrong: ['Product', 'Factor', 'Remainder', 'Sum'], why: 'Dividend ÷ divisor = quotient.' },
        { show: '? ÷ divisor = quotient', q: 'What is the missing word?', a: 'Dividend', wrong: ['Product', 'Factor', 'Remainder', 'Sum'], why: 'Dividend ÷ divisor = quotient.' },
        { show: 'dividend ÷ ? = quotient', q: 'What is the missing word?', a: 'Divisor', wrong: ['Product', 'Factor', 'Remainder', 'Sum'], why: 'Dividend ÷ divisor = quotient.' },
      ], lane),
    },
    // Label a random equation, sometimes written quotient first ('5 = 20 ÷ 4').
    label: {
      w: 3,
      make(rng) {
        const [b, q] = twoDiff(rng, 2, 10), c = b * q;
        const left = chance(rng, 0.35);
        const parts = left ? [q, '=', c, '÷', b] : [c, '÷', b, '=', q];
        const at = left ? { quotient: 0, dividend: 2, divisor: 4 } : { dividend: 0, divisor: 2, quotient: 4 };
        const role = pick(rng, ['quotient', 'divisor', 'dividend']);
        const why = { quotient: `The quotient is the answer: ${q}.`, divisor: `We divide by ${b}, the divisor.`, dividend: `${c} gets divided: the dividend.` }[role];
        return tap({ q: `Tap the ${role}.`, why }, parts, [at[role]]);
      },
    },
    name: {
      w: 3, lane: true,
      make(rng) {
        const [b, q] = twoDiff(rng, 2, 10), c = b * q;
        const show = chance(rng, 0.3) ? `${q} = ${divBy(c, b)}` : `${divBy(c, b)} = ${q}`;
        const [n, a] = pick(rng, [[c, 'Dividend'], [b, 'Divisor'], [q, 'Quotient']]);
        const wrong = wrongStrs(rng, a, ['Dividend', 'Divisor', 'Quotient'], ['Product', 'Factor']);
        return choice({ show, q: `What is ${n} called?`, a, wrong, why: `${divBy(c, b)} = ${q}. ${n} is the ${a.toLowerCase()}.` });
      },
    },
    sortWords: {
      w: 1,
      make(rng) {
        const all = [
          ['Factor', 0, 'We multiply factors.'], ['Product', 0, 'The answer to ×.'],
          ['Quotient', 1, 'The answer to ÷.'], ['Divisor', 1, 'We divide by the divisor.'], ['Dividend', 1, 'The dividend gets divided.'],
        ];
        const items = sample(rng, all, int(rng, 4, 5)).map(([label, bin, why]) => ({ label, bin, why }));
        return sort(rng, { q: 'Does each word go with multiply or divide?', why: 'Factors and products go with ×.' }, ['Multiply ×', 'Divide ÷'], items);
      },
    },
    sortNums: {
      w: 2,
      make(rng) {
        let b1, q1, b2, q2;
        do [[b1, q1], [b2, q2]] = [twoDiff(rng, 2, 10), twoDiff(rng, 2, 10)];
        while (unique([b1, q1, b1 * q1, b2, q2, b2 * q2]).length < 6);
        const show = `${divBy(b1 * q1, b1)} = ${q1} and ${divBy(b2 * q2, b2)} = ${q2}`;
        const q = 'Is each number a divisor or a quotient?';
        const items = [
          ...[b1, b2].map(n => ({ label: String(n), bin: 0, why: `We divide by ${n}: the divisor.` })),
          ...[q1, q2].map(n => ({ label: String(n), bin: 1, why: `${n} is the answer: the quotient.` })),
        ];
        return sort(rng, { show, q, say: sayIt(show, q), why: 'Divide by the divisor to get the quotient.' }, ['Divisor', 'Quotient'], items);
      },
    },
  },
};

// ---------- 3. Equal groups and arrays ----------

const groups = {
  title: 'Equal Groups',
  variants: {
    // Circles with dots. Lane mode says it in words instead.
    picture: {
      w: 3, lane: true,
      make(rng, lane) {
        const g = int(rng, 2, 8);
        let e;
        do e = int(rng, 2, 9); while (e === g);
        const ask = lane ? 'all' : pick(rng, ['groups', 'each', 'all']);
        const base = lane ? { show: `${g} groups of ${e}` } : { model: { kind: 'groups', groups: g, each: e } };
        const withQ = q => (lane ? { ...base, q } : { ...base, q, say: `Look at the picture. ${q}` });
        if (ask === 'groups') {
          const q = pick(rng, ['How many equal groups are there?', 'How many units are in this picture?', 'How many groups are in this picture?']);
          return choice({ ...withQ(q), a: String(g), wrong: wrongNums(rng, g, [e], [g * e, g + 1, g - 1]), why: `Count the circles: ${g} groups.` });
        }
        if (ask === 'each') {
          const q = pick(rng, ['How many dots are in each group?', 'How many dots are in each unit?']);
          return choice({ ...withQ(q), a: String(e), wrong: wrongNums(rng, e, [g], [g * e, e + 1, e - 1]), why: `Each circle has ${e} dots.` });
        }
        const q = lane ? 'How many in all?' : pick(rng, ['How many dots are there in all?', 'How many dots in all?']);
        return choice({ ...withQ(q), a: String(g * e), wrong: wrongNums(rng, g * e, [g + e], [(g - 1) * e, (g + 1) * e, g * (e - 1), g * (e + 1)]), why: `${g} groups of ${e}: ${g} × ${e} = ${g * e}.` });
      },
    },
    array: {
      w: 2, lane: true,
      make(rng, lane) {
        const r = int(rng, 2, 6);
        let c;
        do c = int(rng, 2, 10); while (c === r);
        const ask = lane ? 'all' : pick(rng, ['rows', 'each', 'all']);
        const base = lane ? { show: `${r} rows of ${c}` } : { model: { kind: 'array', rows: r, cols: c } };
        const withQ = q => (lane ? { ...base, q } : { ...base, q, say: `Look at the array. ${q}` });
        if (ask === 'rows') {
          return choice({ ...withQ('How many rows are there?'), a: String(r), wrong: wrongNums(rng, r, [c], [r * c, r + 1, r - 1]), why: `Count the rows: ${r}.` });
        }
        if (ask === 'each') {
          return choice({ ...withQ('How many dots are in each row?'), a: String(c), wrong: wrongNums(rng, c, [r], [r * c, c + 1, c - 1]), why: `Each row has ${c} dots.` });
        }
        const q = lane ? 'How many in all?' : 'How many dots are in the array?';
        return choice({ ...withQ(q), a: String(r * c), wrong: wrongNums(rng, r * c, [r + c], [(r - 1) * c, (r + 1) * c, r * (c - 1)]), why: `${r} rows of ${c}: ${r} × ${c} = ${r * c}.` });
      },
    },
    // Which multiplication matches the picture. The other factor order is right too, so it's never a wrong answer.
    match: {
      w: 2, lane: true,
      make(rng, lane) {
        const rows = chance(rng, 0.4);
        const g = rows ? int(rng, 2, 6) : int(rng, 2, 8);
        let e;
        do e = rows ? int(rng, 2, 10) : int(rng, 2, 9); while (e === g);
        const what = rows ? 'rows' : 'groups';
        const wrong = wrongExprs(rng, g * e, [times(g, e), times(e, g)], [`${g} + ${e}`, times(g, e + 1), times(g + 1, e), times(g - 1, e), times(g, e - 1)]);
        const why = `${g} ${what} of ${e} is ${times(g, e)}.`;
        if (lane) return choice({ q: `Which shows ${g} ${what} of ${e}?`, a: times(g, e), wrong, why });
        const q = `Which multiplication matches the ${rows ? 'array' : 'picture'}?`;
        const model = rows ? { kind: 'array', rows: g, cols: e } : { kind: 'groups', groups: g, each: e };
        return choice({ q, say: `Look at the picture. ${q}`, model, a: times(g, e), wrong, why });
      },
    },
    units: {
      w: 1, lane: true,
      make(rng, lane) {
        if (lane || chance(rng, 0.5)) {
          return choice({ q: 'What are equal groups called?', a: 'Units', wrong: sample(rng, lane ? ['Factors', 'Products', 'Divisors'] : ['Factors', 'Products', 'Quotients', 'Remainders'], 3), why: 'Equal groups are called units.' });
        }
        const bar = chance(rng, 0.5);
        const q = bar ? 'What do we call each equal box on a bar?' : 'What do we call each equal group?';
        const model = bar ? { kind: 'bars', bars: [int(rng, 3, 8)] } : { kind: 'groups', groups: int(rng, 3, 6), each: int(rng, 2, 5) };
        return choice({ q, say: `Look at the picture. ${q}`, model, a: 'A unit', wrong: sample(rng, ['A factor', 'A product', 'A remainder', 'A quotient'], 3), why: 'Each equal group is a unit.' });
      },
    },
    // Tap the 2 ways to make a total, like '3 groups of 4' and '2 groups of 6' for 12.
    sameTotal: {
      w: 1,
      make(rng) {
        const total = pick(rng, [12, 16, 18, 20, 24, 30, 36, 40]);
        const ways = [];
        for (let g = 2; g <= 8; g++) if (total % g === 0 && total / g >= 2 && total / g <= 9) ways.push([g, total / g]);
        const good = sample(rng, ways, 2);
        const label = ([g, e]) => `${g} groups of ${e}`;
        const near = good.flatMap(([g, e]) => [[g, e + 1], [g, e - 1], [g + 1, e], [g - 1, e]]);
        for (let g = 2; g < total - 1 && g <= 9; g++) if (total - g >= 2 && total - g <= 9) near.push([g, total - g]);
        const bad = unique(near.filter(([g, e]) => g >= 2 && e >= 2 && g <= 9 && e <= 10 && g * e !== total).map(label));
        const why = `${times(...good[0])} = ${total} and ${times(...good[1])} = ${total}.`;
        return multi(rng, { q: `Tap the 2 that make ${total} in all.`, why }, good.map(label), sample(rng, bad, int(rng, 2, 3)));
      },
    },
  },
};

// ---------- 4. Bar models ----------

// Pairs for 'has 8 holy cards and 4 times as many stickers'.
const PAIRS = [
  ['holy cards', 'stickers', 'church'], ['pencils', 'crayons', 'pencil'], ['books', 'stickers', 'book'], ['shells', 'beads', 'beach'],
  ['apples', 'peaches', 'apple'], ['toy cars', 'marbles', 'car'], ['cupcakes', 'cookies'], ['flowers', 'seeds', 'flower'],
];

// 'Mrs. Cannon has 8 holy cards and 4 times as many stickers.' Shared by bars and wordProblems.
function timesAsMany(rng, inAll) {
  const u = int(rng, 2, 10), k = int(rng, 2, 9), all = (k + 1) * u;
  let show, q, names, pic;
  if (chance(rng, 0.5)) {
    const [a, b, icon] = pick(rng, PAIRS);
    show = `${pick(rng, [...TEACHERS, ...NAMES])} has ${u} ${a} and ${k} times as many ${b}.`;
    q = inAll ? `How many ${a} and ${b} in all?` : `How many ${b} are there?`;
    names = [cap(a), cap(b)];
    pic = icon;
  } else {
    const [n1, n2] = sample(rng, NAMES, 2), it = pick(rng, ITEMS);
    show = `${n1} has ${u} ${it.many}. ${n2} has ${k} times as many.`;
    q = inAll ? `How many ${it.many} do they have in all?` : `How many ${it.many} does ${n2} have?`;
    names = [n1, n2];
    pic = it.pic;
  }
  const model = { kind: 'bars', bars: [1, k], unit: String(u), names, ...(inAll ? { total: '?' } : {}) };
  if (inAll) {
    return { show, q, pic, model, a: all, wrong: wrongNums(rng, all, [k * u], [u + k, k * u + k, (k + 2) * u]), why: `${k + 1} units of ${u}: ${k + 1} × ${u} = ${all}.` };
  }
  return { show, q, pic, model, a: k * u, wrong: wrongNums(rng, k * u, [u + k], [all, (k - 1) * u, k * u + k]), why: `${k} units of ${u}: ${k} × ${u} = ${k * u}.` };
}

const bars = {
  title: 'Bar Models',
  variants: {
    count: {
      w: 2,
      make(rng) {
        const units = n => plural(n, 'unit', 'units');
        if (chance(rng, 0.6)) {
          const n = int(rng, 2, 10);
          const q = pick(rng, ['How many units are on this bar?', 'How many equal units are shown?', 'How many units does this bar have?']);
          return choice({ q, say: `Look at the bar. ${q}`, model: { kind: 'bars', bars: [n] }, a: units(n), wrong: wrongNums(rng, n, [], [n - 1, n + 1, n + 2, n - 2], { min: 2, as: units }), why: `Count the equal boxes: ${n} units.` });
        }
        // A long bar with 1 unit under it, like the bars on the test.
        const top = int(rng, 2, 9), n = top + 1;
        const q = 'How many units are on both bars?';
        return choice({ q, say: `Look at the bars. ${q}`, model: { kind: 'bars', bars: [top, 1] }, a: units(n), wrong: wrongNums(rng, n, [top], [n + 1, n + 2, n - 2], { min: 2, as: units }), why: `${top} + 1 = ${n} units.` });
      },
    },
    total: {
      w: 2,
      make(rng) {
        const n = int(rng, 2, 10), u = int(rng, 2, 10);
        const q = pick(rng, ['What is the total?', 'What is the total of the bar?']);
        return choice({
          q, say: `The bar has ${n} units. Each unit is ${u}. ${q}`, model: { kind: 'bars', bars: [n], unit: String(u), total: '?' },
          a: fmt(n * u), wrong: wrongNums(rng, n * u, [n + u], [(n - 1) * u, (n + 1) * u, n * (u - 1)]), why: `${n} units of ${u}: ${n} × ${u} = ${n * u}.`,
        });
      },
    },
    unitValue: {
      w: 2,
      make(rng) {
        const n = int(rng, 2, 10), u = int(rng, 2, 10), t = n * u;
        const q = pick(rng, ['What number goes in each unit?', 'How much is each unit?']);
        return choice({
          q, say: `The bar has ${n} equal units. The total is ${t}. ${q}`, model: { kind: 'bars', bars: [n], unit: '?', total: String(t) },
          a: String(u), wrong: wrongNums(rng, u, [], [n, t - n, u + 1, u - 1]), why: `${t} ÷ ${n} = ${u} in each unit.`,
        });
      },
    },
    // Like test question 12: a long bar and 1 unit under it, each unit worth 6. '6 __ __ = __' is 6 × 6 = 36.
    buildTotal: {
      w: 2,
      make(rng) {
        const top = int(rng, 2, 9), n = top + 1, u = int(rng, 2, 10), t = n * u;
        const q = 'Complete the equation to find the unknown number.';
        return build(rng, {
          q, say: `The top bar has ${top} units. The bottom bar has 1 unit. Each unit is ${u}. ${q}`,
          why: `${n} units of ${u}: ${u} × ${n} = ${t}.`, model: { kind: 'bars', bars: [top, 1], unit: String(u), total: '?' },
        }, [String(u), null, null, '=', null], [['×', String(n), String(t)]], ['÷', '+', '−', top, top * u, u + top, t + u, t - u, n + 1]);
      },
    },
    // Like test question 11: 3 units and 1 more make 40, so '40 ÷ 4 = 10'. 40 ÷ 10 = 4 is true too, so it counts.
    buildUnit: {
      w: 2,
      make(rng) {
        const top = int(rng, 2, 9), n = top + 1;
        let u;
        do u = int(rng, 2, 10); while (u === n);
        const t = n * u;
        const q = 'Complete the equation to find the unknown number.';
        return build(rng, {
          q, say: `The top bar has ${top} units. The bottom bar has 1 unit. Both bars together are ${t}. ${q}`,
          why: `${n} units make ${t}. ${t} ÷ ${n} = ${u}.`, model: { kind: 'bars', bars: [top, 1], unit: '?', total: String(t) },
        }, [String(t), null, null, '=', null], [['÷', String(n), String(u)], ['÷', String(u), String(n)]], ['×', '+', '−', top, u + 1, u - 1, n + 1, t - n]);
      },
    },
    // Like test question 16: 'has 8 holy cards and 4 times as many stickers'.
    timesAsMany: {
      w: 2,
      make(rng) {
        const s = timesAsMany(rng, chance(rng, 0.6));
        return choice({ show: s.show, q: s.q, pic: s.pic, model: s.model, a: fmt(s.a), wrong: s.wrong, why: s.why });
      },
    },
  },
};

// ---------- 5. Multiplication facts ----------

// Totals that can be made 2 ways from factors 2-10, like 24 = 3 × 8 = 4 × 6.
const TOTALS = [12, 16, 18, 20, 24, 30, 36, 40];
const factorPairs = total => {
  const out = [];
  for (let a = 2; a <= 10; a++) if (total % a === 0 && total / a >= a && total / a <= 10) out.push([a, total / a]);
  return out;
};

const multFacts = {
  title: 'Times Facts',
  variants: {
    fact: {
      w: 4, lane: true,
      make(rng) {
        const a = int(rng, 2, 10), b = int(rng, 2, 10), p = a * b;
        const why = pick(rng, [`${a} groups of ${b} is ${p}.`, `${times(a, b)} = ${p}. Skip count by ${b}s.`]);
        return choice({ show: `${times(a, b)} = ?`, q: pick(rng, ['What is the product?', 'What is the answer?']), a: fmt(p), wrong: wrongNums(rng, p, [], [p - a, p + a, p - b, p + b, a + b]), why });
      },
    },
    missing: {
      w: 3, lane: true,
      make(rng) {
        const a = int(rng, 2, 10), b = int(rng, 2, 10), p = a * b;
        const first = chance(rng, 0.5);
        const [m, given] = first ? [a, b] : [b, a];
        return choice({
          show: first ? `? × ${b} = ${p}` : `${a} × ? = ${p}`, q: 'What is the missing factor?',
          a: String(m), wrong: wrongNums(rng, m, [], [m + 1, m - 1, given, p - given, m + 2]), why: `${divBy(p, given)} = ${m}, so ${times(a, b)} = ${p}.`,
        });
      },
    },
    trueFalse: {
      w: 2,
      make(rng) {
        const items = [];
        for (let n = int(rng, 4, 6); items.length < n;) {
          const a = int(rng, 2, 10), b = int(rng, 2, 10), p = a * b;
          const ok = items.length < 2 ? items.length === 0 : chance(rng, 0.5);
          const label = `${times(a, b)} = ${ok ? p : pick(rng, [p + a, p - a, p + b, p - b].filter(x => x !== a && x !== b))}`;
          if (!items.some(i => i.label.startsWith(`${times(a, b)} =`))) items.push({ label, bin: ok ? 0 : 1, why: `${ok ? 'Yes' : 'No'}, ${times(a, b)} = ${p}.` });
        }
        return sort(rng, { q: 'Is each fact true or false?', why: 'Check each product with skip counting.' }, ['True', 'False'], items);
      },
    },
    // '__ × __ = 24': every pair of tiles that makes 24 counts.
    build: {
      w: 2,
      make(rng) {
        const total = pick(rng, TOTALS);
        const pairs = factorPairs(total).filter(([x, y]) => x !== y);
        const use = sample(rng, pairs, pairs.length > 1 && chance(rng, 0.5) ? 2 : 1);
        const solutions = use.flatMap(([x, y]) => [[String(x), String(y)], [String(y), String(x)]]);
        const q = `Make a fact with the product ${total}.`;
        return build(rng, {
          q, say: `Blank times blank equals ${total}. ${q}`, why: `${use.map(([x, y]) => `${times(x, y)} = ${total}`).join(' or ')}.`,
        }, [null, '×', null, '=', String(total)], solutions, [2, 3, 4, 5, 6, 7, 8, 9, 10]);
      },
    },
    sameProduct: {
      w: 2,
      make(rng) {
        const total = pick(rng, TOTALS);
        const good = sample(rng, factorPairs(total), 2).map(([x, y]) => (chance(rng, 0.5) ? [x, y] : [y, x]));
        const near = good.flatMap(([x, y]) => [[x, y + 1], [x, y - 1], [x + 1, y], [x - 1, y]]);
        const bad = unique(near.filter(([x, y]) => x >= 2 && y >= 2 && x <= 10 && y <= 10 && x * y !== total).map(([x, y]) => times(x, y)));
        const g = good.map(([x, y]) => times(x, y));
        return multi(rng, { q: `Tap the 2 that equal ${total}.`, why: `${g[0]} = ${total} and ${g[1]} = ${total}.` }, g, sample(rng, bad, int(rng, 2, 3)));
      },
    },
  },
};

// ---------- 6. Division facts ----------

const divFacts = {
  title: 'Division Facts',
  variants: {
    fact: {
      w: 4, lane: true,
      make(rng) {
        const b = int(rng, 2, 10), q = int(rng, 2, 10), c = b * q;
        return choice({ show: `${divBy(c, b)} = ?`, q: pick(rng, ['What is the quotient?', 'What is the answer?']), a: String(q), wrong: wrongNums(rng, q, [], [q + 1, q - 1, b, c - b, q + 2]), why: `${times(b, q)} = ${c}, so ${divBy(c, b)} = ${q}.` });
      },
    },
    missing: {
      w: 3, lane: true,
      make(rng) {
        const b = int(rng, 2, 10), q = int(rng, 2, 10), c = b * q;
        if (chance(rng, 0.5)) {
          return choice({ show: `${c} ÷ ? = ${q}`, q: 'What is the missing number?', a: String(b), wrong: wrongNums(rng, b, [], [b + 1, b - 1, q, b + 2]), why: `${divBy(c, b)} = ${q}, because ${times(b, q)} = ${c}.` });
        }
        return choice({ show: `? ÷ ${b} = ${q}`, q: 'What is the missing number?', a: String(c), wrong: wrongNums(rng, c, [], [c + b, c - b, b + q, c + 1]), why: `${times(b, q)} = ${c}, so ${divBy(c, b)} = ${q}.` });
      },
    },
    // Like test question 5: '8 divided into 8 groups is __ in each group.'
    split: {
      w: 3, lane: true,
      make(rng, lane) {
        const b = int(rng, 2, 10), q = chance(rng, 0.35) ? 1 : int(rng, 2, 10), c = b * q;
        const wrong = q === 1 ? wrongNums(rng, 1, [b, 0, 2 * b], [], { min: 0 }) : wrongNums(rng, q, [], [b, q + 1, q - 1, c - b]);
        const why = q === 1 ? `${divBy(c, c)} = 1. One in each group.` : `${divBy(c, b)} = ${q} in each group.`;
        if (lane) return choice({ show: `${c} split into ${b} groups`, q: 'How many in each group?', a: String(q), wrong, why });
        if (chance(rng, 0.5)) return choice({ show: `${c} divided into ${b} groups is __ in each group`, q: 'What number goes in the blank?', a: String(q), wrong, why });
        return choice({ show: `${c} divided into ${b} equal groups`, q: 'How many are in each group?', a: String(q), wrong, why });
      },
    },
    groupsOf: {
      w: 2, lane: true,
      make(rng, lane) {
        const b = int(rng, 2, 10), q = int(rng, 2, 10), c = b * q;
        const show = lane ? `${c} in groups of ${b}` : `${c} split into groups of ${b}`;
        return choice({ show, q: 'How many groups are there?', a: String(q), wrong: wrongNums(rng, q, [], [b, q + 1, q - 1, c - b]), why: `${divBy(c, b)} = ${q} groups.` });
      },
    },
    sameQuotient: {
      w: 2,
      make(rng) {
        const q = int(rng, 2, 9), [b1, b2] = twoDiff(rng, 2, 10);
        const good = [divBy(b1 * q, b1), divBy(b2 * q, b2)];
        const bad = [];
        while (bad.length < 3) {
          const b = int(rng, 2, 10), e = divBy(b * (q + pick(rng, [1, -1])), b);
          if (!good.includes(e) && !bad.includes(e)) bad.push(e);
        }
        return multi(rng, { q: `Tap the 2 that equal ${q}.`, why: `${good[0]} = ${q} and ${good[1]} = ${q}.` }, good, bad.slice(0, int(rng, 2, 3)));
      },
    },
  },
};

// ---------- 7. One more group, one less group ----------

const oneMore = {
  title: 'One More Group',
  variants: {
    // Like test question 1: '8 × 4 is __ more than 7 × 4' (it's one more group of 4).
    more: {
      w: 3, lane: true,
      make(rng, lane) {
        const a = int(rng, 2, 10), b = int(rng, 2, 10);
        const wrong = wrongNums(rng, b, [1], [a, a + 1, b + 1, 2 * b]);
        const why = `One more group of ${b} is ${b} more.`;
        if (lane) return choice({ q: `How much more is ${times(a, b)} than ${times(a - 1, b)}?`, a: String(b), wrong, why });
        return choice({ show: `${times(a, b)} is __ more than ${times(a - 1, b)}`, q: pick(rng, ['What number goes in the blank?', 'How much more is it?']), a: String(b), wrong, why });
      },
    },
    less: {
      w: 2, lane: true,
      make(rng, lane) {
        const a = int(rng, 2, 10), b = int(rng, 2, 10);
        const wrong = wrongNums(rng, b, [1], [a, a - 1, b + 1, 2 * b]);
        const why = `One less group of ${b} is ${b} less.`;
        if (lane) return choice({ q: `How much less is ${times(a - 1, b)} than ${times(a, b)}?`, a: String(b), wrong, why });
        return choice({ show: `${times(a - 1, b)} is __ less than ${times(a, b)}`, q: pick(rng, ['What number goes in the blank?', 'How much less is it?']), a: String(b), wrong, why });
      },
    },
    next: {
      w: 3, lane: true,
      make(rng) {
        const a = int(rng, 2, 10), b = int(rng, 2, 10), p = (a - 1) * b;
        return choice({ show: `${times(a - 1, b)} = ${p}`, q: `So what is ${times(a, b)}?`, a: fmt(p + b), wrong: wrongNums(rng, p + b, [p + 1], [p + a, p + 2 * b, p - b, p]), why: `${p} + ${b} = ${p + b}. One more ${b}.` });
      },
    },
    prev: {
      w: 2, lane: true,
      make(rng) {
        const a = int(rng, 3, 10), b = int(rng, 2, 10), p = a * b;
        return choice({ show: `${times(a, b)} = ${p}`, q: `So what is ${times(a - 1, b)}?`, a: fmt(p - b), wrong: wrongNums(rng, p - b, [p - 1], [p - a, p - 2 * b, p + b, p]), why: `${p} − ${b} = ${p - b}. One less ${b}.` });
      },
    },
    // '28 + __ = __': add one more group to the fact he knows.
    build: {
      w: 2,
      make(rng) {
        const a = int(rng, 2, 10), b = int(rng, 2, 10), p = (a - 1) * b;
        const show = `${times(a - 1, b)} = ${p}`, q = `Add one more group to find ${times(a, b)}.`;
        return build(rng, { show, q, say: `${sayIt(show, q)} ${p} plus blank equals blank.`, why: `${p} + ${b} = ${p + b}, so ${times(a, b)} = ${p + b}.` },
          [String(p), '+', null, '=', null], [[String(b), String(p + b)]], [a, p + a, 1, p + 1, b + 1, p + b + 1, 2 * b, p + 2 * b, p + b - 1]);
      },
    },
  },
};

// ---------- 8. Break apart a fact ----------

// n groups of b split into a groups and c groups.
function splitFact(rng, minA = 1) {
  const b = int(rng, 2, 10), n = int(rng, minA + 2, 10), a = int(rng, minA, n - minA);
  return { a, b, c: n - a, n };
}

const breakApart = {
  title: 'Break Apart',
  variants: {
    // Like test question 2: 'The sum of 3 × 5 and 6 × 5 is __ × 5.'
    sum: {
      w: 3, lane: true,
      make(rng, lane) {
        const { a, b, c, n } = splitFact(rng);
        const show = lane ? `${times(a, b)} + ${times(c, b)} = ? × ${b}` : `The sum of ${times(a, b)} and ${times(c, b)} is __ × ${b}`;
        return choice({ show, q: lane ? 'What is the missing number?' : 'What number goes in the blank?', a: String(n), wrong: wrongNums(rng, n, [], [a * c, a * b, 2 * b, n + 1, n - 1]), why: `${a} + ${c} = ${n} groups of ${b}.` });
      },
    },
    split: {
      w: 2, lane: true,
      make(rng) {
        const { a, b, c, n } = splitFact(rng);
        return choice({ show: `${times(n, b)} = ${times(a, b)} + ? × ${b}`, q: 'What is the missing number?', a: String(c), wrong: wrongNums(rng, c, [], [n, a, c + 1, c - 1, b]), why: `${a} + ${c} = ${n} groups of ${b}.` });
      },
    },
    combine: {
      w: 2, lane: true,
      make(rng, lane) {
        const { a, b, c, n } = splitFact(rng);
        const show = `${times(a, b)} = ${a * b}${lane ? ',' : ' and'} ${times(c, b)} = ${c * b}`;
        return choice({ show, q: `So what is ${times(n, b)}?`, a: fmt(n * b), wrong: wrongNums(rng, n * b, [], [(n - 1) * b, (n + 1) * b, a * b + c, c * b + a]), why: `Add the parts: ${a * b} + ${c * b} = ${n * b}.` });
      },
    },
    which: {
      w: 2,
      make(rng) {
        const { a, b, c, n } = splitFact(rng, 2);
        const right = `${times(a, b)} + ${times(c, b)}`;
        const wrong = wrongExprs(rng, n * b, [right, `${times(c, b)} + ${times(a, b)}`], [
          `${times(a, b)} + ${times(c + 1, b)}`, `${times(a, b)} + ${times(c - 1, b)}`, `${times(a, b)} + ${times(c, b + 1)}`,
          `${times(a, b)} + ${c}`, `${times(a, b + 1)} + ${times(c, b - 1)}`, `${times(a - 1, b)} + ${times(c, b)}`,
        ]);
        return choice({ q: `Which is the same as ${times(n, b)}?`, a: right, wrong, why: `${a} + ${c} = ${n} groups of ${b}.` });
      },
    },
    build: {
      w: 2,
      make(rng) {
        let p;
        do p = splitFact(rng); while (p.a === p.c);
        const { a, b, c, n } = p;
        const show = `${times(n, b)} = ${times(a, b)} + ${times(c, b)}`, q = `Add the parts to find ${times(n, b)}.`;
        return build(rng, { show, q, say: sayIt(show, q), why: `${a * b} + ${c * b} = ${n * b}.` },
          [null, '+', null, '=', String(n * b)], [[String(a * b), String(c * b)], [String(c * b), String(a * b)]],
          [(a + 1) * b, (a - 1) * b, (c + 1) * b, (c - 1) * b, a * c, a + b, c + b, a * b + 1, c * b - 1]);
      },
    },
  },
};

// ---------- 9. Zero and one ----------

// Usually a small number, sometimes a big one, since the rules work for any number.
const anyNum = rng => (chance(rng, 0.3) ? pick(rng, [12, 15, 20, 25, 50, 99, 100, 250, 1000]) : int(rng, 2, 10));

const zeroOne = {
  title: 'Zero and One',
  variants: {
    fact: {
      w: 4, lane: true,
      make(rng, lane) {
        const n = anyNum(rng), N = fmt(n);
        const [expr, ans, mistakes, why] = pick(rng, [
          [`${N} × 0`, 0, [n, 1, n * 10], 'Any number times 0 is 0.'],
          [`0 × ${N}`, 0, [n, 1, n * 10], '0 times any number is 0.'],
          [`${N} × 1`, n, [1, 0, n + 1], 'Any number times 1 is itself.'],
          [`1 × ${N}`, n, [1, 0, n + 1], '1 times any number is itself.'],
          [`0 ÷ ${N}`, 0, [n, 1], '0 split into groups is 0 each.'],
          [`${N} ÷ ${N}`, 1, [n, 0, 2 * n], 'A number ÷ itself is 1.'],
          [`${N} ÷ 1`, n, [1, 0, n + 1], 'A number ÷ 1 is itself.'],
        ]);
        const wrong = wrongNums(rng, ans, mistakes, [], { min: 0, count: mistakes.length });
        // Many kids think 0 can't be divided at all.
        if (mistakes.length === 2 && !lane) wrong.push('No answer');
        const q = expr.includes('×') ? 'What is the product?' : 'What is the quotient?';
        return choice({ show: `${expr} = ?`, q, a: fmt(ans), wrong, why });
      },
    },
    rule: {
      w: 2, lane: true,
      make(rng, lane) {
        const same = lane ? 'Itself' : 'The same number';
        return term(rng, [
          { q: 'Any number times 1 is what?', a: same, wrong: ['1', '0', 'Double it'], why: 'Times 1 keeps the number the same.' },
          { q: 'Any number times 0 is what?', a: '0', wrong: [same, '1', '10'], why: 'Zero groups of anything is 0.' },
          { q: 'Any number divided by 1 is what?', a: same, wrong: ['1', '0', 'Half of it'], why: 'All of it goes in 1 group.' },
          { q: 'A number divided by itself is what?', a: '1', wrong: ['0', same, '2'], why: 'Like 8 ÷ 8 = 1.' },
          { q: '0 divided by any number is what?', a: '0', wrong: ['No answer', '1', lane ? 'Divisor' : 'The divisor'], why: 'Nothing to share, so each gets 0.' },
          { show: '? × 0 = 0', q: 'Which numbers make this true?', a: 'Any number', wrong: ['Only 0', 'Only 1', 'No number'], why: 'Any number times 0 is 0.' },
        ], lane);
      },
    },
    trueFalse: {
      w: 2,
      make(rng) {
        const forms = [
          n => [`${n} × 0 = 0`, 0, 'Any number × 0 is 0.'],
          n => [`${n} × 0 = ${n}`, 1, `${n} × 0 is 0, not ${n}.`],
          n => [`0 × ${n} = 0`, 0, '0 times a number is 0.'],
          n => [`${n} × 1 = ${n}`, 0, `Times 1 keeps it ${n}.`],
          n => [`${n} × 1 = 1`, 1, `${n} × 1 is ${n}, not 1.`],
          n => [`0 ÷ ${n} = 0`, 0, '0 split up is still 0.'],
          n => [`0 ÷ ${n} = ${n}`, 1, `0 ÷ ${n} is 0, not ${n}.`],
          n => [`${n} ÷ ${n} = 1`, 0, 'A number ÷ itself is 1.'],
          n => [`${n} ÷ ${n} = 0`, 1, `${n} ÷ ${n} is 1, not 0.`],
          n => [`${n} ÷ 1 = ${n}`, 0, `÷ 1 keeps it ${n}.`],
          n => [`${n} ÷ 1 = 1`, 1, `${n} ÷ 1 is ${n}, not 1.`],
          n => [`${n} × 0 = 1`, 1, `${n} × 0 is 0, not 1.`],
        ];
        const items = sample(rng, forms, int(rng, 4, 6)).map(f => {
          const [label, bin, why] = f(fmt(anyNum(rng)));
          return { label, bin, why };
        });
        return sort(rng, { q: 'Is each one true or false?', why: 'Times 0 makes 0. Times 1 keeps it.' }, ['True', 'False'], items);
      },
    },
    sameAnswer: {
      w: 2,
      make(rng) {
        const target = pick(rng, ['0', '1', 'n']);
        const opts = (list, k) => {
          const out = [];
          while (out.length < k) {
            const e = pick(rng, list)(int(rng, 2, 10));
            if (!out.includes(e)) out.push(e);
          }
          return out;
        };
        let good, bad, why;
        if (target === '0') {
          good = opts([m => `${m} × 0`, m => `0 × ${m}`, m => `0 ÷ ${m}`], int(rng, 2, 3));
          bad = opts([m => `${m} × 1`, m => `${m} ÷ ${m}`, m => `${m} ÷ 1`, m => `1 × ${m}`], 2);
          why = 'Times 0, or 0 ÷ a number, is 0.';
        } else if (target === '1') {
          good = opts([m => `${m} ÷ ${m}`], 2);
          bad = opts([m => `${m} × 0`, m => `0 ÷ ${m}`, m => `${m} × 1`, m => `${m} ÷ 1`], int(rng, 2, 3));
          why = 'A number ÷ itself is 1.';
        } else {
          const n = int(rng, 2, 10);
          good = sample(rng, [`${n} × 1`, `1 × ${n}`, `${n} ÷ 1`], int(rng, 2, 3));
          bad = sample(rng, [`${n} × 0`, `${n} ÷ ${n}`, `0 ÷ ${n}`, `0 × ${n}`], 2);
          why = 'Times 1 or ÷ 1 keeps it the same.';
          return multi(rng, { q: `Tap the ${good.length} that equal ${n}.`, why }, good, bad);
        }
        return multi(rng, { q: `Tap the ${good.length} that equal ${target}.`, why }, good, bad);
      },
    },
  },
};

// ---------- 10. Missing signs ----------

const SIGNS = ['×', '÷', '+', '−'];

// 'X __ Y = Z' where only one of × ÷ + − makes it true, like 27 __ 3 = 9.
function signFact(rng, op = pick(rng, ['×', '÷'])) {
  for (;;) {
    const a = int(rng, 2, 10), b = int(rng, 2, 10);
    const [x, y, z] = op === '×' ? [a, b, a * b] : [a * b, b, a];
    if (SIGNS.filter(s => isTrue([String(x), s, String(y), '=', String(z)])).length === 1) {
      return { x, y, z, op, blank: `${x} __ ${y} = ${z}`, full: `${x} ${op} ${y} = ${z}` };
    }
  }
}
const signWord = op => (op === '×' ? 'times' : 'divide');

const signs = {
  title: 'Missing Signs',
  variants: {
    // Like test question 6: '27 __ 3 = 9'.
    choose: {
      w: 3, lane: true,
      make(rng) {
        const f = signFact(rng);
        return choice({ show: f.blank, q: 'Which sign makes it true?', a: f.op, wrong: SIGNS.filter(s => s !== f.op), why: `${f.full}, so use ${f.op}.` });
      },
    },
    build: {
      w: 2,
      make(rng) {
        const f = signFact(rng), q = 'Tap the sign that makes it true.';
        return build(rng, { q, say: sayIt(f.blank, q), why: `${f.full}, so use ${f.op}.` }, [String(f.x), null, String(f.y), '=', String(f.z)], [[f.op]], SIGNS);
      },
    },
    multi: {
      w: 2,
      make(rng) {
        const op = pick(rng, ['×', '÷']), other = op === '×' ? '÷' : '×';
        const good = [], bad = [], size = int(rng, 4, 5);
        while (good.length < 2 || bad.length < size - 2) {
          const f = signFact(rng, good.length < 2 ? op : other);
          if (![...good, ...bad].some(g => g.blank === f.blank)) (f.op === op ? good : bad).push(f);
        }
        const q = `Tap the 2 that need ${op}.`;
        return multi(rng, { q, say: `Tap the 2 that need the ${signWord(op)} sign.`, why: `${good[0].full} and ${good[1].full}.` }, good.map(f => f.blank), bad.map(f => f.blank));
      },
    },
    sort: {
      w: 2,
      make(rng) {
        const items = [];
        for (let n = int(rng, 4, 6); items.length < n;) {
          const f = signFact(rng, items.length < 2 ? ['×', '÷'][items.length] : undefined);
          if (!items.some(i => i.label === f.blank)) items.push({ label: f.blank, bin: f.op === '×' ? 0 : 1, why: f.full });
        }
        return sort(rng, { q: 'Does each one need × or ÷?', say: 'Does each one need the times sign or the divide sign?', why: 'Bigger answer: ×. Smaller answer: ÷.' }, ['×', '÷'], items);
      },
    },
  },
};

// ---------- 11. Fact families ----------

const factFamily = {
  title: 'Fact Families',
  variants: {
    // Both division facts match, so the other one is never a wrong answer.
    matchDiv: {
      w: 3,
      make(rng) {
        const [a, b] = twoDiff(rng, 2, 10), p = a * b;
        const right = [`${divBy(p, a)} = ${b}`, `${divBy(p, b)} = ${a}`];
        const wrong = sample(rng, [`${divBy(a, b)} = ${p}`, `${divBy(b, a)} = ${p}`, `${divBy(p, a)} = ${b + 1}`, `${divBy(p, b)} = ${a - 1}`].filter(e => !holds(e)), 3);
        return choice({ show: `${times(a, b)} = ${p}`, q: 'Which division fact matches?', a: pick(rng, right), wrong, why: `${right[0]} and ${right[1]}.` });
      },
    },
    matchMult: {
      w: 2,
      make(rng) {
        const [a, b] = twoDiff(rng, 2, 10), p = a * b;
        const right = [`${times(a, b)} = ${p}`, `${times(b, a)} = ${p}`];
        const wrong = sample(rng, [`${times(p, a)} = ${b}`, `${times(a, p)} = ${b}`, `${times(a, b)} = ${p + a}`, `${times(a, b + 1)} = ${p}`, `${a} + ${b} = ${p}`].filter(e => !holds(e)), 3);
        return choice({ show: `${divBy(p, a)} = ${b}`, q: 'Which multiplication fact matches?', a: pick(rng, right), wrong, why: `${times(a, b)} = ${p}, so ${divBy(p, a)} = ${b}.` });
      },
    },
    // '42 ÷ 7 = __' from 6 × 7 = 42, or '42 ÷ __ = __' (both ways count).
    build: {
      w: 3,
      make(rng) {
        const [a, b] = twoDiff(rng, 2, 10), p = a * b, show = `${times(a, b)} = ${p}`;
        if (chance(rng, 0.5)) {
          const [d, q] = chance(rng, 0.5) ? [a, b] : [b, a];
          return build(rng, { show, q: 'Use the fact to finish the division.', why: `${times(a, b)} = ${p}, so ${divBy(p, d)} = ${q}.` },
            [String(p), '÷', String(d), '=', null], [[String(q)]], [d, q + 1, q - 1, p - d, d + q, q + 2]);
        }
        return build(rng, { show, q: 'Build a division fact that matches.', why: `${divBy(p, a)} = ${b} and ${divBy(p, b)} = ${a}.` },
          [String(p), '÷', null, '=', null], [[String(a), String(b)], [String(b), String(a)]], [a + 1, b + 1, a - 1, b - 1, p - a, a + b, 2 * a]);
      },
    },
    family: {
      w: 2,
      make(rng) {
        const [a, b] = twoDiff(rng, 2, 10), p = a * b;
        const good = sample(rng, [`${times(b, a)} = ${p}`, `${divBy(p, a)} = ${b}`, `${divBy(p, b)} = ${a}`], int(rng, 2, 3));
        const bad = sample(rng, [`${divBy(a, b)} = ${p}`, `${times(p, a)} = ${b}`, `${divBy(b, p)} = ${a}`, `${divBy(p, a)} = ${a}`, `${times(a, p)} = ${b}`].filter(e => !holds(e)), int(rng, 2, 3));
        return multi(rng, { show: `${times(a, b)} = ${p}`, q: `Tap the ${good.length} facts in this family.`, why: `True facts with ${a}, ${b} and ${p}.` }, good, bad);
      },
    },
    missing: {
      w: 3, lane: true,
      make(rng) {
        const [a, b] = twoDiff(rng, 2, 10), p = a * b;
        if (chance(rng, 0.6)) {
          const [d, q] = chance(rng, 0.5) ? [a, b] : [b, a];
          return choice({ show: `${times(a, b)} = ${p}`, q: `So what is ${divBy(p, d)}?`, a: String(q), wrong: wrongNums(rng, q, [d], [q + 1, q - 1, p - d]), why: `${times(d, q)} = ${p}, so ${divBy(p, d)} = ${q}.` });
        }
        return choice({ show: `${divBy(p, a)} = ${b}`, q: `So what is ${times(a, b)}?`, a: String(p), wrong: wrongNums(rng, p, [], [p + a, p - a, p + b, p - b, a + b]), why: `${divBy(p, a)} = ${b}, so ${times(a, b)} = ${p}.` });
      },
    },
  },
};

// ---------- 12. Remainders ----------

// c ÷ b = q R r with divisors 2-9, quotients up to 10 and dividends up to 60.
function remDiv(rng, hasR = chance(rng, 0.85)) {
  for (;;) {
    const b = int(rng, 2, 9), q = chance(rng, 0.1) ? 1 : int(rng, 2, 10), r = hasR ? int(rng, 1, b - 1) : 0, c = b * q + r;
    if (c <= 60 && (q > 1 || hasR)) return { c, b, q, r, expr: divBy(c, b), ans: withR(q, r) };
  }
}

// Wrong text answers: every `must` one, then random `maybe` ones. Never the answer, never twice.
function wrongStrs(rng, answer, must = [], maybe = [], count = 3) {
  const seen = new Set([answer.toLowerCase()]);
  const out = [];
  for (const s of [...must, ...shuffle(rng, maybe)]) {
    if (s && out.length < count && !seen.has(s.toLowerCase())) {
      seen.add(s.toLowerCase());
      out.push(s);
    }
  }
  return out;
}

const remainders = {
  title: 'Remainders',
  variants: {
    solve: {
      w: 4, lane: true,
      make(rng) {
        const { c, b, q, r, expr, ans } = remDiv(rng);
        const wrong = r
          ? wrongStrs(rng, ans, [fmt(q)], [withR(q + 1, r), q > 1 && withR(q - 1, r + b), fmt(q + 1), r + 1 < b && withR(q, r + 1), q > 1 && withR(q - 1, r)])
          : wrongStrs(rng, ans, [withR(q, 1)], [withR(q - 1, b), fmt(q + 1), fmt(q - 1), withR(q, b - 1)]);
        const why = r ? `${times(b, q)} = ${b * q}, ${r} left over.` : `${times(b, q)} = ${c}, none left over.`;
        return choice({ show: `${expr} = ?`, q: r ? pick(rng, ['What is the answer?', 'What is the quotient and remainder?']) : 'What is the answer?', a: ans, wrong, why });
      },
    },
    // Like test question 7: '15 ÷ 2 is __ with a remainder of __'.
    remainder: {
      w: 3, lane: true,
      make(rng, lane) {
        const { c, b, q, r, expr } = remDiv(rng, true);
        const why = `${times(b, q)} = ${b * q}. ${c} − ${b * q} = ${r}.`;
        const roll = lane ? 0 : rng();
        if (roll < 0.5) return choice({ show: expr, q: 'What is the remainder?', a: String(r), wrong: wrongNums(rng, r, [q], [r + 1, r - 1, b, b - r], { min: 0 }), why });
        if (roll < 0.75) return choice({ show: `${expr} is ${q} with a remainder of __`, q: 'What number goes in the blank?', a: String(r), wrong: wrongNums(rng, r, [q], [r + 1, b, b - r]), why });
        return choice({ show: `${expr} is __ with a remainder of ${r}`, q: 'What number goes in the blank?', a: String(q), wrong: wrongNums(rng, q, [q + 1], [q - 1, r, b]), why: `${times(b, q)} = ${b * q}, ${r} left over.` });
      },
    },
    // Like test question 9: 'Which has a remainder of 1? 11 ÷ 3, 9 ÷ 3, 11 ÷ 5'.
    which: {
      w: 3, lane: true,
      make(rng) {
        const t = pick(rng, [1, 1, 2, 0]);
        let right;
        do right = remDiv(rng, t > 0); while (right.r !== t);
        const ok = ([c, b]) => c <= 60 && Math.floor(c / b) >= 1 && Math.floor(c / b) <= 10 && c % b !== t;
        const sameC = [], sameB = [];
        for (let b = 2; b <= 9; b++) if (b !== right.b) sameC.push([right.c, b]);
        for (const d of [-2, -1, 1, 2]) sameB.push([right.c + d, right.b]);
        const k = int(rng, 1, 2);
        const picks = [...sample(rng, sameC.filter(ok), k), ...sample(rng, sameB.filter(ok), 3 - k)];
        const wrong = shuffle(rng, picks).map(([c, b]) => ({ expr: divBy(c, b), ans: withR(Math.floor(c / b), c % b) }));
        const q = t ? `Which one has a remainder of ${t}?` : 'Which one has no remainder?';
        return choice({ q, a: right.expr, wrong: wrong.map(w => w.expr), why: `${right.expr} = ${right.ans}. ${wrong[0].expr} = ${wrong[0].ans}.` });
      },
    },
    multi: {
      w: 2,
      make(rng) {
        const mode = pick(rng, ['some', 'none', 'one']);
        const isGood = d => (mode === 'some' ? d.r > 0 : mode === 'none' ? d.r === 0 : d.r === 1);
        const good = [], bad = [], size = int(rng, 4, 5);
        while (good.length < 2 || bad.length < size - 2) {
          const d = remDiv(rng, chance(rng, 0.55));
          if ([...good, ...bad].some(x => x.expr === d.expr)) continue;
          if (isGood(d)) { if (good.length < 2) good.push(d); } else if (bad.length < size - 2) bad.push(d);
        }
        const q = { some: 'Tap the 2 with a remainder.', none: 'Tap the 2 with no remainder.', one: 'Tap the 2 with a remainder of 1.' }[mode];
        return multi(rng, { q, why: `${good[0].expr} = ${good[0].ans}. ${good[1].expr} = ${good[1].ans}.` }, good.map(d => d.expr), bad.map(d => d.expr));
      },
    },
    sort: {
      w: 2,
      make(rng) {
        const items = [];
        for (let n = int(rng, 4, 6); items.length < n;) {
          const d = remDiv(rng, items.length < 2 ? items.length === 0 : chance(rng, 0.6));
          if (!items.some(i => i.label === d.expr)) items.push({ label: d.expr, bin: d.r ? 0 : 1, why: `${d.expr} = ${d.ans}` });
        }
        return sort(rng, { q: 'Does each one have a remainder?', why: 'Divide, then check what is left.' }, ['Remainder', 'No remainder'], items);
      },
    },
    tapParts: {
      w: 2,
      make(rng) {
        let d;
        do d = remDiv(rng, true); while (unique([d.c, d.b, d.q, d.r]).length < 4);
        const role = pick(rng, ['remainder', 'quotient', 'divisor', 'dividend']);
        const why = {
          remainder: `${d.r} is left over: the remainder.`, quotient: `The quotient is ${d.q}, with ${d.r} left.`,
          divisor: `We divide by ${d.b}: the divisor.`, dividend: `${d.c} gets divided: the dividend.`,
        }[role];
        const q = `Tap the ${role}.`;
        return tap({ q, say: `${d.c} divided by ${d.b} equals ${d.q} remainder ${d.r}. ${q}`, why }, [d.c, '÷', d.b, '=', d.q, 'R', d.r], [{ dividend: 0, divisor: 2, quotient: 4, remainder: 6 }[role]]);
      },
    },
    biggest: {
      w: 1, lane: true,
      make(rng, lane) {
        const b = int(rng, 2, 9);
        const q = lane ? `Biggest remainder when dividing by ${b}?` : `When you divide by ${b}, what is the biggest remainder?`;
        return choice({ q, a: String(b - 1), wrong: wrongNums(rng, b - 1, [b, b + 1, b - 2], [], { min: 0 }), why: `It must be less than ${b}: ${b - 1}.` });
      },
    },
  },
};

// ---------- 13. Remainder stories ----------

// Every one needs a spot, so a remainder means one more box (test question 13).
const upStory = (one, many, box, boxes, show, pic) => ({ one, many, box, boxes, show, pic });
const ROUND_UP = [
  upStory('book', 'books', 'box', 'boxes', (n, c, b) => `A box can hold ${b} books. ${n} has ${c} books.`, 'book'),
  upStory('kid', 'kids', 'van', 'vans', (n, c, b) => `A van holds ${b} kids. ${c} kids go on a trip.`, 'car'),
  upStory('kid', 'kids', 'table', 'tables', (n, c, b) => `Each table seats ${b} kids. ${c} kids come to lunch.`, 'people'),
  upStory('kid', 'kids', 'boat', 'boats', (n, c, b) => `Each boat holds ${b} kids. ${c} kids want a ride.`, 'boat'),
  upStory('kid', 'kids', 'tent', 'tents', (n, c, b) => `Each tent sleeps ${b} kids. ${c} kids go camping.`, 'tent'),
  upStory('cupcake', 'cupcakes', 'tray', 'trays', (n, c, b) => `A tray holds ${b} cupcakes. ${n} bakes ${c} cupcakes.`),
  upStory('sticker', 'stickers', 'page', 'pages', (n, c, b) => `A page holds ${b} stickers. ${n} has ${c} stickers.`, 'star'),
  upStory('marble', 'marbles', 'jar', 'jars', (n, c, b) => `A jar holds ${b} marbles. ${n} has ${c} marbles.`),
  upStory('seed', 'seeds', 'pot', 'pots', (n, c, b) => `A pot holds ${b} seeds. ${n} has ${c} seeds to plant.`, 'sprout'),
  upStory('shell', 'shells', 'bucket', 'buckets', (n, c, b) => `A bucket holds ${b} shells. ${n} finds ${c} shells.`, 'beach'),
];

// Only full groups count, so the remainder is left out (test question 15).
// unit: what a full group is called, for the 'Tap the 2 that are true' variant ('4 full bags', '1 full bag').
const dropStory = (many, show, lane, asks, full, pic, unit) => ({ many, show, lane, asks, full, pic, unit });
const DROP = [
  dropStory('stickers', (n, c, b) => `${n} has ${c} stickers and wants exactly ${b} on each notebook.`, (c, b) => `${c} stickers, ${b} on each`,
    [(n, b) => `How many notebooks get exactly ${b}?`, n => `How many notebooks does ${n} need?`], (q, b) => `Only ${q} get exactly ${b}.`, 'star'),
  dropStory('beads', (n, c, b) => `Each bracelet needs ${b} beads. ${n} has ${c} beads.`, (c, b) => `${c} beads, ${b} per bracelet`,
    [() => 'How many bracelets can be made?'], q => `Only ${q} bracelets can be made.`),
  dropStory('marbles', (n, c, b) => `${n} has ${c} marbles and fills bags of ${b}.`, (c, b) => `${c} marbles, bags of ${b}`,
    [() => 'How many bags are full?', () => 'How many full bags are there?'], q => `Only ${q} bags are full.`, undefined, ['bag', 'bags']),
  dropStory('cupcakes', (n, c, b) => `${n} packs ${c} cupcakes in boxes of ${b}.`, (c, b) => `${c} cupcakes, boxes of ${b}`,
    [() => 'How many boxes can be filled?', () => 'How many full boxes are there?'], q => `Only ${q} boxes are full.`, undefined, ['box', 'boxes']),
  dropStory('kids', (n, c, b) => `${c} kids make teams of ${b}.`, (c, b) => `${c} kids, teams of ${b}`,
    [() => 'How many full teams are there?'], q => `Only ${q} teams are full.`, 'people', ['team', 'teams']),
  dropStory('eggs', (n, c, b) => `A cake needs ${b} eggs. ${n} has ${c} eggs.`, (c, b) => `${c} eggs, ${b} per cake`,
    [() => 'How many cakes can be made?'], q => `Only ${q} cakes can be made.`, 'chicken'),
  dropStory('cookies', (n, c, b) => `${n} has ${c} cookies and puts exactly ${b} on each plate.`, (c, b) => `${c} cookies, ${b} per plate`,
    [(n, b) => `How many plates get exactly ${b}?`], (q, b) => `Only ${q} plates get exactly ${b}.`),
  dropStory('cards', (n, c, b) => `${n} makes packs of ${b} from ${c} cards.`, (c, b) => `${c} cards, packs of ${b}`,
    [() => 'How many full packs can be made?'], q => `Only ${q} packs are full.`, undefined, ['pack', 'packs']),
];

// A story division that always has a remainder, with an answer of 10 or less after rounding up.
function storyDiv(rng) {
  for (;;) {
    const b = int(rng, 2, 9), q = int(rng, 2, 9), r = int(rng, 1, b - 1), c = b * q + r;
    if (c <= 60) return { b, q, r, c };
  }
}

const remainderStory = {
  title: 'Remainder Stories',
  variants: {
    roundUp: {
      w: 3, lane: true,
      make(rng, lane) {
        const s = pick(rng, ROUND_UP), { b, q, r, c } = storyDiv(rng);
        const show = lane ? `${c} ${s.many}, ${b} per ${s.box}` : s.show(pick(rng, NAMES), c, b);
        const ask = lane ? `How many ${s.boxes} for all the ${s.many}?` : pick(rng, [`How many ${s.boxes} are needed for all the ${s.many}?`, `What is the fewest number of ${s.boxes} needed?`]);
        return choice({ show, q: ask, pic: s.pic, a: fmt(q + 1), wrong: wrongStrs(rng, fmt(q + 1), [fmt(q)], [withR(q, r), fmt(q + 2), fmt(r)]), why: `${q} R${r}. ${r} left ${r === 1 ? 'needs' : 'need'} a ${s.box}: ${q + 1}.` });
      },
    },
    drop: {
      w: 3, lane: true,
      make(rng, lane) {
        const s = pick(rng, DROP), { b, q, r, c } = storyDiv(rng), n = pick(rng, NAMES);
        const show = lane ? s.lane(c, b) : s.show(n, c, b);
        const ask = lane ? s.asks[0](n, b) : pick(rng, s.asks)(n, b);
        return choice({ show, q: ask, pic: s.pic, a: fmt(q), wrong: wrongStrs(rng, fmt(q), [fmt(q + 1)], [withR(q, r), fmt(r), fmt(q - 1)]), why: `${q} R${r}. ${s.full(q, b)}` });
      },
    },
    leftover: {
      w: 2, lane: true,
      make(rng, lane) {
        const s = pick(rng, DROP), { b, q, r, c } = storyDiv(rng);
        const show = lane ? s.lane(c, b) : s.show(pick(rng, NAMES), c, b);
        return choice({ show, q: `How many ${s.many} are left over?`, pic: s.pic, a: String(r), wrong: wrongNums(rng, r, [q], [b - r, r + 1, b]), why: `${times(b, q)} = ${b * q}. ${c} − ${b * q} = ${r} left.` });
      },
    },
    // The big idea: 'for all' means round up, 'full' or 'exactly' means drop the remainder.
    sort: {
      w: 2,
      make(rng) {
        const k = () => int(rng, 3, 8);
        const up = [
          ['Boxes for all the books', 'Every book needs a box.'], ['Vans so every kid rides', 'Every kid needs a seat.'],
          ['Tables so all the kids sit', 'Every kid needs a seat.'], ['Trays for all the cupcakes', 'Every cupcake needs a tray.'],
          ['Tents for every camper', 'Every camper needs a tent.'], ['Pages for all the stickers', 'Every sticker needs a page.'],
          ['Boats so everyone gets a ride', 'Everyone needs a seat.'], ['Jars for all the marbles', 'Every marble needs a jar.'],
        ].map(([label, why]) => ({ label, bin: 0, why }));
        const drop = [
          [`Notebooks with exactly ${k()} each`, 'Only exact ones count.'], [`Bracelets with ${k()} beads each`, 'Only whole bracelets count.'],
          ['Full bags of marbles', 'Only full bags count.'], [`Full teams of ${k()} kids`, 'Only full teams count.'],
          [`Cakes that need ${k()} eggs each`, 'Only whole cakes count.'], ['Full boxes of cupcakes', 'Only full boxes count.'],
          [`Plates with exactly ${k()} cookies`, 'Only exact ones count.'], ['Full packs of cards', 'Only full packs count.'],
        ].map(([label, why]) => ({ label, bin: 1, why }));
        const n = int(rng, 4, 6), u = int(rng, 1, n - 1);
        return sort(rng, { q: 'Round up, or drop the remainder?', why: 'For all: round up. Only full: drop it.' }, ['Round up', 'Drop it'], [...sample(rng, up, u), ...sample(rng, drop, n - u)]);
      },
    },
    // Two true facts about one story: how many full groups, and how many are left over.
    pair: {
      w: 1,
      make(rng) {
        const s = pick(rng, DROP.filter(d => d.unit)), { b, q, r, c } = storyDiv(rng);
        const full = n => `${n} full ${s.unit[n === 1 ? 0 : 1]}`;
        const good = [full(q), `${r} left over`];
        const bad = sample(rng, unique([full(q + 1), full(q - 1), `${b - r} left over`, `${r + 1} left over`, `${q} left over`]).filter(o => !good.includes(o)), int(rng, 2, 3));
        return multi(rng, { show: s.show(pick(rng, NAMES), c, b), q: 'Tap the 2 that are true.', pic: s.pic, why: `${divBy(c, b)} = ${q} R${r}: ${q} full, ${r} left.` }, good, bad);
      },
    },
    // 'Show your work with an equation.'
    equation: {
      w: 1,
      make(rng) {
        const { b, c } = storyDiv(rng);
        const up = chance(rng, 0.5);
        const s = up ? pick(rng, ROUND_UP) : pick(rng, DROP);
        const show = s.show(pick(rng, NAMES), c, b);
        return choice({ show, q: 'Which equation helps solve it?', pic: s.pic, a: divBy(c, b), wrong: sample(rng, [times(c, b), `${c} − ${b}`, `${c} + ${b}`], 3), why: `Split ${c} into groups of ${b}: ${divBy(c, b)}.` });
      },
    },
  },
};

// ---------- 14. Even and odd ----------

// A number from 1 digit up to the 10,000s with the given parity. Some are the round ones he likes (1,000 and 999).
function parityNum(rng, odd) {
  if (chance(rng, 0.15)) return pick(rng, odd ? [9, 99, 999, 9999, 11, 101, 1001, 10001] : [10, 100, 1000, 10000, 20, 200, 2000, 1010]);
  const [lo, hi] = pick(rng, [[1, 9], [10, 99], [10, 99], [100, 999], [1000, 9999], [10000, 99999]]);
  const n = int(rng, lo, hi);
  return n % 2 === (odd ? 1 : 0) ? n : n < hi ? n + 1 : n - 1;
}
function parityNums(rng, odd, k, taken = []) {
  const out = [];
  while (out.length < k) {
    const n = parityNum(rng, odd);
    if (!out.includes(n) && !taken.includes(n)) out.push(n);
  }
  return out;
}
const parity = n => (n % 2 ? 'odd' : 'even');

const evenOdd = {
  title: 'Even and Odd',
  variants: {
    define: {
      w: 2,
      make: rng => term(rng, [
        { q: 'An even number divided by 2 has what remainder?', a: 'No remainder', wrong: ['A remainder of 1', 'A remainder of 2', 'It depends'], why: 'Even numbers split into 2 with none left.' },
        { q: 'An odd number divided by 2 has what remainder?', a: 'A remainder of 1', wrong: ['No remainder', 'A remainder of 2', 'It depends'], why: 'Odd numbers have 1 left over.' },
        { show: 'Divided by 2, it has no remainder.', q: 'What kind of number is it?', a: 'Even', wrong: ['Odd', 'A quotient', 'A remainder'], why: 'No remainder when divided by 2: even.' },
        { show: 'Divided by 2, it has a remainder of 1.', q: 'What kind of number is it?', a: 'Odd', wrong: ['Even', 'A quotient', 'A remainder'], why: 'Remainder 1 when divided by 2: odd.' },
      ]),
    },
    // Like test question 4: 'Which one is not an even number? 16, 19, 6, 48'.
    notEven: {
      w: 4, lane: true,
      make(rng) {
        const [q, odd] = pick(rng, [['Which one is not an even number?', true], ['Which one is not an odd number?', false], ['Which number is even?', false], ['Which number is odd?', true]]);
        const a = parityNum(rng, odd);
        return choice({ q, a: fmt(a), wrong: parityNums(rng, !odd, 3, [a]).map(fmt), why: `${fmt(a)} ends in ${a % 10}, so it is ${parity(a)}.` });
      },
    },
    sort: {
      w: 2,
      make(rng) {
        const n = int(rng, 4, 6), k = int(rng, 1, n - 1);
        const evens = parityNums(rng, false, k), odds = parityNums(rng, true, n - k);
        const item = x => ({ label: fmt(x), bin: x % 2, why: `Ends in ${x % 10}, so it is ${parity(x)}.` });
        return sort(rng, { q: 'Is each number even or odd?', why: 'Only the last digit matters.' }, ['Even', 'Odd'], [...evens, ...odds].map(item));
      },
    },
    multi: {
      w: 2,
      make(rng) {
        const odd = chance(rng, 0.5), k = int(rng, 2, 3);
        const good = parityNums(rng, odd, k).map(fmt), bad = parityNums(rng, !odd, int(rng, 2, 3)).map(fmt);
        const list = k === 2 ? good.join(' and ') : `${good[0]}, ${good[1]} and ${good[2]}`;
        return multi(rng, { q: `Tap the ${k} ${odd ? 'odd' : 'even'} numbers.`, why: `${list} end in ${odd ? 'odd' : 'even'} digits.` }, good, bad);
      },
    },
    lastDigit: {
      w: 2, lane: true,
      make(rng, lane) {
        let n;
        do n = int(rng, 1000, 99999); while (unique(String(n)).length < String(n).length);
        const digits = [...String(n)], last = digits[digits.length - 1];
        const ask = lane ? { show: fmt(n), q: 'Which digit tells if it is even or odd?' } : { q: `Which digit tells if ${fmt(n)} is even or odd?` };
        return choice({ ...ask, a: last, wrong: sample(rng, digits.slice(0, -1), 3), why: `The last digit, ${last}, makes it ${parity(n)}.` });
      },
    },
    defineSort: {
      w: 1,
      make(rng) {
        const [e1, e2] = parityNums(rng, false, 2).map(fmt), [o1, o2] = parityNums(rng, true, 2).map(fmt);
        const even = [
          ['No remainder when divided by 2', 'Even: nothing is left over.'], ['Splits into 2 equal groups', 'Even: 2 equal groups.'],
          ['Every one has a partner', 'Even: they all make pairs.'], [`Like ${e1} and ${e2}`, 'They end in even digits.'],
        ];
        const odd = [
          ['Remainder 1 when divided by 2', 'Odd: 1 is left over.'], ['One is left without a partner', 'Odd: one has no pair.'],
          [`Like ${o1} and ${o2}`, 'They end in odd digits.'],
        ];
        const k = int(rng, 2, 3);
        const items = [...sample(rng, even, k).map(([label, why]) => ({ label, bin: 0, why })), ...sample(rng, odd, int(rng, 2, 3)).map(([label, why]) => ({ label, bin: 1, why }))];
        return sort(rng, { q: 'Is each one about even or odd numbers?', why: 'Even: no remainder. Odd: 1 left over.' }, ['Even', 'Odd'], items);
      },
    },
  },
};

// ---------- 15. Odd or even answers ----------

// A × or ÷ fact with an odd or even answer: { expr, v, near } (near = answers off by a group, for wrong choices).
function parityFact(rng, odd) {
  for (;;) {
    let f;
    if (chance(rng, 0.6)) {
      const a = int(rng, 2, 10), b = int(rng, 2, 10), v = a * b;
      f = { expr: times(a, b), v, near: [v + a, v - a, v + b, v - b] };
    } else {
      const b = int(rng, 2, 10), q = int(rng, 1, 10);
      f = { expr: divBy(b * q, b), v: q, near: [q + 1, q - 1, q + 2] };
    }
    if (f.v % 2 === (odd ? 1 : 0)) return f;
  }
}
function parityFacts(rng, odd, k, taken = []) {
  const out = [];
  while (out.length < k) {
    const f = parityFact(rng, odd);
    if (![...out, ...taken].some(x => x.expr === f.expr)) out.push(f);
  }
  return out;
}

const oddEvenProducts = {
  title: 'Odd or Even Answers',
  variants: {
    // Like test question 10: 'Circle the expressions that give odd numbers: 5 × 9, 4 × 3, 25 ÷ 5'.
    multi: {
      w: 3,
      make(rng) {
        const odd = chance(rng, 0.5), k = int(rng, 2, 3), word = odd ? 'odd' : 'even';
        const good = parityFacts(rng, odd, k), bad = parityFacts(rng, !odd, int(rng, 2, 3));
        const why = k === 2 ? `${good[0].expr} = ${good[0].v} and ${good[1].expr} = ${good[1].v}.` : `${good[0].v}, ${good[1].v} and ${good[2].v} are ${word}.`;
        const q = pick(rng, [`Tap the ${k} that give ${word} numbers.`, `Tap the ${k} with ${word} answers.`]);
        return multi(rng, { q, why }, good.map(f => f.expr), bad.map(f => f.expr));
      },
    },
    sort: {
      w: 2,
      make(rng) {
        const n = int(rng, 4, 6), k = int(rng, 1, n - 1);
        const facts = [...parityFacts(rng, false, k), ...parityFacts(rng, true, n - k)];
        const items = facts.map(f => ({ label: f.expr, bin: f.v % 2, why: `${f.expr} = ${f.v}` }));
        return sort(rng, { q: 'Is each answer even or odd?', why: 'Find each answer, then check its last digit.' }, ['Even answer', 'Odd answer'], items);
      },
    },
    pick: {
      w: 3, lane: true,
      make(rng) {
        const odd = chance(rng, 0.5), right = parityFact(rng, odd), word = odd ? 'odd' : 'even';
        return choice({ q: `Which one has an ${word} answer?`, a: right.expr, wrong: parityFacts(rng, !odd, 3, [right]).map(f => f.expr), why: `${right.expr} = ${right.v}, an ${word} number.` });
      },
    },
    compute: {
      w: 2, lane: true,
      make(rng) {
        const f = parityFact(rng, chance(rng, 0.5)), say = v => `${v}, ${parity(v)}`;
        const wrong = [`${f.v}, ${parity(f.v + 1)}`, ...sample(rng, f.near.filter(v => v > 0), 2).map(say)];
        return choice({ show: `${f.expr} = ?`, q: 'Find the answer. Is it even or odd?', a: say(f.v), wrong, why: `${f.expr} = ${f.v}. It ends in ${f.v % 10}: ${parity(f.v)}.` });
      },
    },
  },
};

// ---------- 16. Expressions for stories ----------

const expressions = {
  title: 'Story Expressions',
  variants: {
    // Like test question 3: 'Each box has 2 pencils. Which expression gives the pencils in 3 boxes?'
    groups: {
      w: 4, lane: true,
      make(rng, lane) {
        const { it, at } = stuff(rng), [n, e] = twoDiff(rng, 2, 10);
        const show = lane ? `${n} ${at.many}, ${e} ${it.many} each` : pick(rng, [`Each ${at.one} has ${e} ${it.many}.`, `There are ${e} ${it.many} ${at.at} each ${at.one}.`]);
        const q = lane ? `Which shows all the ${it.many}?` : pick(rng, [`Which shows the ${it.many} ${at.at} ${n} ${at.many}?`, `Which expression gives the ${it.many} ${at.at} ${n} ${at.many}?`]);
        const right = [times(n, e), times(e, n)];
        const wrong = wrongExprs(rng, n * e, right, [`${n} + ${e}`, times(n, n), times(e, e), `${e} + ${e}`, `${n} + ${n}`]);
        return choice({ show, q, pic: it.pic, a: pick(rng, right), wrong, why: `${n} groups of ${e}: ${times(n, e)} = ${n * e}.` });
      },
    },
    share: {
      w: 3, lane: true,
      make(rng, lane) {
        const { it, at } = stuff(rng), b = int(rng, 2, 10), q = int(rng, 2, 10), c = b * q, right = divBy(c, b);
        const wrong = wrongExprs(rng, q, [right], [times(c, b), `${c} − ${b}`, `${c} + ${b}`]);
        if (chance(rng, 0.5)) {
          const show = lane ? `${c} ${it.many}, ${b} kids` : `${c} ${it.many} are shared equally by ${b} kids.`;
          return choice({ show, q: 'Which shows how many each kid gets?', pic: it.pic, a: right, wrong, why: `Share ${c} into ${b} equal groups: ${right}.` });
        }
        const show = lane ? `${c} ${it.many}, ${b} per ${at.one}` : `${pick(rng, NAMES)} puts ${c} ${it.many} ${at.at} ${at.many}, ${b} ${at.at} each.`;
        return choice({ show, q: `Which shows how many ${at.many}?`, pic: it.pic, a: right, wrong, why: `${c} in groups of ${b} is ${right}.` });
      },
    },
    build: {
      w: 2,
      make(rng) {
        const { it, at } = stuff(rng);
        if (chance(rng, 0.5)) {
          const [n, e] = twoDiff(rng, 2, 10), p = n * e;
          return build(rng, { show: `Each ${at.one} has ${e} ${it.many}. There are ${n} ${at.many}.`, q: `Write an equation for all the ${it.many}.`, pic: it.pic, why: `${n} groups of ${e}: ${times(n, e)} = ${p}.` },
            [null, '×', null, '=', null], [[String(n), String(e), String(p)], [String(e), String(n), String(p)]], [n + e, n + 1, e + 1, (n - 1) * e, n * (e + 1), n - 1, e - 1]);
        }
        const [b, q] = twoDiff(rng, 2, 10), c = b * q;
        return build(rng, { show: `${c} ${it.many} are shared equally by ${b} kids.`, q: "Write an equation for each kid's share.", pic: it.pic, why: `${divBy(c, b)} = ${q} for each kid.` },
          [null, '÷', String(b), '=', null], [[String(c), String(q)]], [c - b, c + b, q + 1, q - 1, c - 1, b + q]);
      },
    },
    multi: {
      w: 2,
      make(rng) {
        const { it, at } = stuff(rng), n = int(rng, 2, 5);
        let e;
        do e = int(rng, 2, 9); while (e === n);
        const add = k => Array(k).fill(e).join(' + ');
        const good = [times(n, e), times(e, n), ...(add(n).length <= 16 ? [add(n)] : [])];
        const bad = wrongExprs(rng, n * e, good, [`${n} + ${e}`, times(n, n), times(e, e), times(n, e + 1), ...(n > 2 ? [add(n - 1)] : []), ...(add(n + 1).length <= 16 ? [add(n + 1)] : [])], int(rng, 2, 3));
        return multi(rng, { show: `There are ${n} ${at.many} with ${e} ${it.many} ${at.at} each.`, q: `Tap the ${good.length} that show all the ${it.many}.`, pic: it.pic, why: `${n} groups of ${e}: ${times(n, e)} = ${n * e}.` }, good, bad);
      },
    },
  },
};

// ---------- 17. Word problems ----------

const ANIMALS = [['spiders', 8, 'spider'], ['ants', 6, 'ant'], ['cows', 4, 'cow'], ['chickens', 2, 'chicken'], ['horses', 4, 'horse'], ['bees', 6, 'bee'], ['birds', 2, 'bird']];

// Two kinds of things in each group, like test question 14: 'Each vase has 4 roses and 2 daisies.'
const mix = (a, b, all, one, many, at, pic) => ({ a, b, all, one, many, at, pic });
const MIXES = [
  mix('roses', 'daisies', 'flowers', 'vase', 'vases', 'in', 'flower'),
  mix('red apples', 'green apples', 'apples', 'basket', 'baskets', 'in', 'apple'),
  mix('red beads', 'blue beads', 'beads', 'bracelet', 'bracelets', 'on'),
  mix('cookies', 'cupcakes', 'treats', 'plate', 'plates', 'on'),
  mix('big shells', 'small shells', 'shells', 'bucket', 'buckets', 'in', 'beach'),
  mix('toy cars', 'toy trucks', 'toys', 'box', 'boxes', 'in', 'car'),
  mix('red crayons', 'blue crayons', 'crayons', 'box', 'boxes', 'in', 'pencil'),
];
const COLORS = [['red', 'blue'], ['green', 'yellow'], ['pink', 'purple'], ['red', 'white']];
const COLORED = [['markers', 'pencil'], ['crayons', 'pencil'], ['beads'], ['marbles'], ['stickers', 'star'], ['pencils', 'pencil']];

const wordProblems = {
  title: 'Word Problems',
  variants: {
    multiply: {
      w: 3, lane: true,
      make(rng, lane) {
        if (chance(rng, 0.3)) {
          const [many, legs, pic] = pick(rng, ANIMALS), n = int(rng, 2, 10);
          const show = lane ? `${n} ${many}, ${legs} legs each` : `There are ${n} ${many}. Each one has ${legs} legs.`;
          return choice({ show, q: lane ? 'How many legs in all?' : 'How many legs are there in all?', pic, a: fmt(n * legs), wrong: wrongNums(rng, n * legs, [n + legs], [(n - 1) * legs, (n + 1) * legs, n * (legs - 1)]), why: `${n} groups of ${legs}: ${times(n, legs)} = ${n * legs}.` });
        }
        const { it, at } = stuff(rng), who = pick(rng, NAMES), n = int(rng, 2, 10), e = int(rng, 2, 10);
        const show = lane ? `${n} ${at.many}, ${e} ${it.many} each` : `${who} has ${n} ${at.many}. Each ${at.one} has ${e} ${it.many}.`;
        const q = lane ? `How many ${it.many} in all?` : `How many ${it.many} does ${who} have in all?`;
        return choice({ show, q, pic: it.pic, a: fmt(n * e), wrong: wrongNums(rng, n * e, [n + e], [(n - 1) * e, (n + 1) * e, n * (e - 1)]), why: `${n} groups of ${e}: ${times(n, e)} = ${n * e}.` });
      },
    },
    divide: {
      w: 3, lane: true,
      make(rng, lane) {
        const { it, at } = stuff(rng), who = pick(rng, NAMES), b = int(rng, 2, 10), q = int(rng, 2, 10), c = b * q;
        const wrong = wrongNums(rng, q, [], [c - b, q + 1, q - 1, b]);
        if (chance(rng, 0.5)) {
          const show = lane ? `${c} ${it.many}, ${b} friends` : `${who} gives ${c} ${it.many} equally to ${b} friends.`;
          return choice({ show, q: lane ? 'How many does each friend get?' : `How many ${it.many} does each friend get?`, pic: it.pic, a: String(q), wrong, why: `${divBy(c, b)} = ${q} ${it.many} each.` });
        }
        const show = lane ? `${c} ${it.many}, ${b} per ${at.one}` : `${who} puts ${c} ${it.many} ${at.at} ${at.many}, ${b} ${at.at} each.`;
        return choice({ show, q: lane ? `How many ${at.many}?` : `How many ${at.many} does ${who} use?`, pic: it.pic, a: String(q), wrong, why: `${divBy(c, b)} = ${q} ${at.many}.` });
      },
    },
    // Like test question 14: (4 + 2) × 4 = 24.
    twoStepAdd: {
      w: 3,
      make(rng) {
        const m = pick(rng, MIXES), x = int(rng, 2, 8), y = int(rng, 2, 10 - x), n = int(rng, 2, 10), t = (x + y) * n;
        return choice({
          show: `Each ${m.one} has ${x} ${m.a} and ${y} ${m.b}.`, q: `How many ${m.all} are ${m.at} ${n} ${m.many}?`, pic: m.pic,
          a: fmt(t), wrong: wrongNums(rng, t, [x * n + y], [x * n, x + y + n, (x + y) * (n - 1), y * n + x]), why: `${x} + ${y} = ${x + y} in each. ${times(x + y, n)} = ${t}.`,
        });
      },
    },
    // Like test question 17: subtract to find the blue ones, then share them.
    twoStepSub: {
      w: 3,
      make(rng) {
        const [c1, c2] = pick(rng, COLORS), [items, pic] = pick(rng, COLORED), b = int(rng, 2, 9), q = int(rng, 2, 10), blue = b * q;
        let red;
        do red = int(rng, 10, 90); while (red + blue > 120);
        const total = red + blue;
        return choice({
          show: `${pick(rng, [...TEACHERS, ...NAMES])} has ${total} ${c1} and ${c2} ${items}. ${red} are ${c1}.`, q: `${b} kids share the ${c2} ones equally. How many each?`, pic,
          a: String(q), wrong: wrongNums(rng, q, [blue], [red % b ? 0 : red / b, total % b ? 0 : total / b, q + 1, q - 1]), why: `${total} − ${red} = ${blue} ${c2}. ${divBy(blue, b)} = ${q}.`,
        });
      },
    },
    // Like test question 16: '4 times as many', then how many in all.
    compare: {
      w: 3,
      make(rng) {
        const s = timesAsMany(rng, chance(rng, 0.6));
        return choice({ show: s.show, q: s.q, pic: s.pic, model: chance(rng, 0.5) ? s.model : undefined, a: fmt(s.a), wrong: s.wrong, why: s.why });
      },
    },
    // Write the equation: Mia's '4 times as many', or test question 14's 'add first, then multiply'.
    build: {
      w: 2,
      make(rng) {
        if (chance(rng, 0.5)) {
          const [n1, n2] = sample(rng, NAMES, 2), it = pick(rng, ITEMS), u = int(rng, 2, 10), k = int(rng, 2, 9);
          return build(rng, { show: `${n1} has ${u} ${it.many}. ${n2} has ${k} times as many.`, q: `Write an equation for ${n2}'s ${it.many}.`, pic: it.pic, why: `${k} times as many: ${times(u, k)} = ${k * u}.` },
            [String(u), '×', null, '=', null], [[String(k), String(k * u)]], [k + 1, (k + 1) * u, u + k, k - 1, (k - 1) * u, k * u + u, k * u - 1]);
        }
        const m = pick(rng, MIXES), x = int(rng, 2, 8), y = int(rng, 2, 10 - x), s = x + y;
        let n;
        do n = int(rng, 2, 10); while (n === s);
        const t = s * n;
        return build(rng, { show: `Each ${m.one} has ${x} ${m.a} and ${y} ${m.b}.`, q: `Write an equation for the ${m.all} ${m.at} ${n} ${m.many}.`, pic: m.pic, why: `${x} + ${y} = ${s} in each. ${times(s, n)} = ${t}.` },
          [null, '×', null, '=', null], [[String(s), String(n), String(t)], [String(n), String(s), String(t)]], [x, y, x * n, y * n, x + y + n, t - n, n + 1, s + 1]);
      },
    },
  },
};

// ---------- Skills ----------

function makeSkill(id, { title, variants }) {
  const names = Object.keys(variants);
  const laneNames = names.filter(n => variants[n].lane);
  const choose = (rng, list) => {
    let t = rng() * list.reduce((s, n) => s + (variants[n].w ?? 1), 0);
    return list.find(n => (t -= variants[n].w ?? 1) < 0) ?? list[list.length - 1];
  };
  return {
    title,
    lane: laneNames.length > 0,
    variants: names,
    laneVariants: laneNames,
    gen(rng = Math.random, opts = {}) {
      const lane = Boolean(opts.lane);
      if (lane && !laneNames.length) throw new Error(`Math skill "${id}" has no lane questions`);
      let name = opts.variant;
      if (name != null && !names.includes(name)) throw new Error(`Math skill "${id}" has no variant "${name}"`);
      // A re-asked variant that can't be painted on rings is swapped for one that can.
      if (name == null || (lane && !laneNames.includes(name))) name = choose(rng, lane ? laneNames : names);
      let q;
      for (let i = 0; i < 60; i++) {
        q = finish(id, name, variants[name].make(rng, lane));
        if (fits(q, lane)) break;
      }
      return q;
    },
  };
}

const DEFS = {
  multWords, divWords, groups, bars, multFacts, divFacts, oneMore, breakApart, zeroOne,
  signs, factFamily, remainders, remainderStory, evenOdd, oddEvenProducts, expressions, wordProblems,
};

// { id: { title, lane, variants, laneVariants, gen(rng, { lane, variant }) } }
export const SKILLS = Object.fromEntries(Object.entries(DEFS).map(([id, def]) => [id, makeSkill(id, def)]));
// { id: [variant ids] }
export const VARIANTS = Object.fromEntries(Object.entries(SKILLS).map(([id, s]) => [id, s.variants]));

// entry: { gen: 'skillId', variant?, lane? }
export function makeQuestion(entry, rng = Math.random) {
  const { gen, ...opts } = entry || {};
  if (!Object.prototype.hasOwnProperty.call(SKILLS, gen)) throw new Error(`Unknown math skill "${gen}"`);
  return SKILLS[gen].gen(rng, opts);
}

// ---------- Grab rules ----------

// Facts that make a number, and near misses that don't.
function makesTotal(total) {
  const good = [], bad = [];
  for (let a = 1; a <= 10; a++) {
    for (let b = 1; b <= 10; b++) {
      if (a * b === total) good.push(times(a, b));
      else if (Math.abs(a * b - total) <= Math.max(a, b) && a > 1 && b > 1) bad.push(times(a, b));
    }
  }
  if (total <= 10) {
    for (let d = 2; d <= 10; d++) {
      good.push(divBy(total * d, d));
      bad.push(divBy((total + 1) * d, d));
      if (total > 1) bad.push(divBy((total - 1) * d, d));
    }
  }
  return { good, bad };
}

// A "collect the right ones" rule: next() hands out items, and about half of them are good.
export function grabRule(rng = Math.random, kind) {
  if (kind === 'even' || kind === 'odd') {
    const odd = kind === 'odd';
    return {
      kind, title: `${kind.toUpperCase()} numbers`, say: `Grab the ${kind} numbers!`,
      next(r = rng) {
        const good = chance(r, 0.5), n = parityNum(r, good === odd);
        return { label: fmt(n), good, why: `${fmt(n)} is ${parity(n)}` };
      },
    };
  }
  if (kind === 'times') {
    const k = int(rng, 2, 10);
    return {
      kind, title: `Numbers in the ${k}s`, say: `Grab the numbers in the ${k} times table!`,
      next(r = rng) {
        if (chance(r, 0.5)) {
          const m = int(r, 1, 10);
          return { label: String(k * m), good: true, why: `${times(k, m)} = ${k * m}` };
        }
        let n;
        do n = int(r, 2, k * 10); while (n % k === 0);
        return { label: String(n), good: false, why: `${n} is not in the ${k}s` };
      },
    };
  }
  if (kind === 'equals') {
    const total = pick(rng, [6, 8, 9, 10, 12, 16, 18, 20, 24, 30, 36, 40]);
    const { good, bad } = makesTotal(total);
    return {
      kind, title: `Facts that make ${total}`, say: `Grab the facts that make ${total}!`,
      next(r = rng) {
        const ok = chance(r, 0.5), label = pick(r, ok ? good : bad);
        return { label, good: ok, why: `${label} = ${value(label)}` };
      },
    };
  }
  if (kind === 'oddAnswer' || kind === 'evenAnswer') {
    const odd = kind === 'oddAnswer';
    return {
      kind, title: odd ? 'ODD answers' : 'EVEN answers', say: `Grab the facts with ${odd ? 'odd' : 'even'} answers!`,
      next(r = rng) {
        const good = chance(r, 0.5), f = parityFact(r, good === odd);
        return { label: f.expr, good, why: `${f.expr} = ${f.v}` };
      },
    };
  }
  throw new Error(`Unknown grab rule "${kind}"`);
}
