// Prints sample math questions from js/mathgen.js for a person to read over.
// Run from the repo root:
//   node critter-run/tools/mathgen-samples.mjs                 3 of each skill
//   node critter-run/tools/mathgen-samples.mjs remainders 10   10 remainder questions
//   node critter-run/tools/mathgen-samples.mjs all 5 --lane    5 lane (ring) questions per skill
// Options: --lane, --variant <id>, --seed <number> (the same seed prints the same questions).
import { SKILLS, makeQuestion, rngFrom } from '../js/mathgen.js';

const args = process.argv.slice(2);
const flag = name => {
  const i = args.indexOf(name);
  if (i < 0) return undefined;
  const [, v] = args.splice(i, 2);
  return v;
};
const lane = args.includes('--lane') && Boolean(args.splice(args.indexOf('--lane'), 1));
const variant = flag('--variant');
const seed = flag('--seed');
const [which = 'all', count = '3'] = args;

const ids = which === 'all' ? Object.keys(SKILLS) : [which];
for (const id of ids) {
  if (!SKILLS[id]) {
    console.error(`Unknown skill "${id}". Skills: ${Object.keys(SKILLS).join(', ')}`);
    process.exit(1);
  }
}
const rng = seed === undefined ? Math.random : rngFrom(Number(seed));

function model(m) {
  if (m.kind === 'groups') return `${m.groups} circles with ${m.each} dots each`;
  if (m.kind === 'array') return `${m.rows} rows of ${m.cols} dots`;
  const extra = [m.unit && `unit "${m.unit}"`, m.total && `total "${m.total}"`, m.names && `names ${m.names.join(' / ')}`].filter(Boolean);
  return `bars [${m.bars.join(', ')}] ${extra.join(', ')}`;
}

function answer(q) {
  switch (q.type) {
    case 'choice': return [`a:     ${q.a}`, `wrong: ${q.wrong.join(' | ')}`];
    case 'tap': return [`tap:   ${q.parts.map((p, i) => (q.answer.includes(i) ? `[${p}]` : p)).join(' ')}`];
    case 'multi': return [`tap:   ${q.options.map((o, i) => (q.correct.includes(i) ? `*${o}*` : o)).join(' | ')}`];
    case 'build': return [
      `fill:  ${q.slots.map(s => s ?? '__').join(' ')}`,
      `tiles: ${q.tiles.join('  ')}`,
      `right: ${q.solutions.map(s => s.join(' ')).join('  or  ')}`,
    ];
    case 'sort': return [`bins:  ${q.bins.join(' | ')}`, ...q.items.map(i => `  ${q.bins[i.bin].padEnd(12)} ${i.label}${i.why ? `   (${i.why})` : ''}`)];
  }
  return [];
}

for (const id of ids) {
  const s = SKILLS[id];
  console.log(`\n== ${id}: ${s.title}${lane ? ' (lane)' : ''}  [${(lane ? s.laneVariants : s.variants).join(', ') || 'no lane variants'}]`);
  if (lane && !s.lane) continue;
  for (let i = 0; i < Number(count); i++) {
    const q = makeQuestion({ gen: id, lane, variant }, rng);
    const lines = [
      q.show && `show:  ${q.show}`,
      `q:     ${q.q}`,
      ...answer(q),
      `why:   ${q.why}`,
      q.model && `model: ${model(q.model)}`,
      q.pic && `pic:   ${q.pic}`,
      q.say && `say:   ${q.say}`,
    ].filter(Boolean);
    console.log(`\n  ${q.variant} (${q.type})`);
    for (const line of lines) console.log(`    ${line}`);
  }
}
