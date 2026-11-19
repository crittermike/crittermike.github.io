// Content rules for Critter Run levels. Run from the repo root: node --test critter-run/*.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { BIOMES, CHASERS, PICS, MUSIC } from './js/catalog.js';
import { SKILLS, VARIANTS, makeQuestion, rngFrom, grabRule } from './js/mathgen.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const dir = path.join(here, 'levels');
const files = fs.readdirSync(dir).filter(f => f.endsWith('.js')).sort();
const html = fs.readFileSync(path.join(here, 'index.html'), 'utf8');

function loadLevel(file) {
  const found = [];
  vm.runInNewContext(fs.readFileSync(path.join(dir, file), 'utf8'), {
    CritterRun: { addLevel: level => found.push(level) },
  }, { filename: file });
  assert.equal(found.length, 1, `${file} must call CritterRun.addLevel exactly once`);
  return found[0];
}
const levels = files.map(file => ({ file, level: loadLevel(file) }));

// Emoji are banned in the game. Pictures come from the icon set instead (pic: 'name').
const EMOJI = /\p{Extended_Pictographic}|\uFE0F|[\u{1F1E6}-\u{1F1FF}]/u;
const strings = v => (typeof v === 'string' ? [v] : Array.isArray(v) ? v.flatMap(strings) : v && typeof v === 'object' ? Object.values(v).flatMap(strings) : []);
const words = s => s.trim().split(/\s+/).filter(w => /[\p{L}\p{N}]/u.test(w)).length;
const text = s => typeof s === 'string' && s.trim().length > 0;

// A picture on a question card (js/figures.js).
function checkModel(m, where) {
  const int = (v, lo, hi) => Number.isInteger(v) && v >= lo && v <= hi;
  if (m.kind === 'groups') assert.ok(int(m.groups, 1, 8) && int(m.each, 1, 9), `${where}: groups needs 1-8 groups of 1-9`);
  else if (m.kind === 'array') assert.ok(int(m.rows, 1, 6) && int(m.cols, 1, 10), `${where}: array needs 1-6 rows of 1-10`);
  else if (m.kind === 'bars') {
    assert.ok(Array.isArray(m.bars) && m.bars.length >= 1 && m.bars.length <= 3 && m.bars.every(n => int(n, 1, 10)), `${where}: bars needs 1-3 bars of 1-10 units`);
    for (const k of ['unit', 'total']) if (m[k] !== undefined) assert.ok(text(m[k]) && m[k].length <= 4, `${where}: bars ${k} must be 1-4 characters`);
    if (m.names !== undefined) assert.ok(m.names.length === m.bars.length && m.names.every(n => text(n) && n.length <= 10), `${where}: one name (10 characters or less) per bar`);
  } else assert.fail(`${where}: model kind must be groups, array or bars`);
}

function checkKeys(obj, allowed, where) {
  const extra = Object.keys(obj).filter(k => !allowed.includes(k));
  assert.deepEqual(extra, [], `${where}: unknown keys ${extra.join(', ')}`);
}
function checkShort(value, maxWords, maxChars, where) {
  assert.ok(text(value), `${where}: must be non-empty text`);
  assert.ok(words(value) <= maxWords, `${where}: "${value}" has more than ${maxWords} words`);
  assert.ok(value.length <= maxChars, `${where}: "${value}" is longer than ${maxChars} characters`);
}

test('every level file is loaded by index.html, oldest test first', () => {
  const tags = [...html.matchAll(/<script src="levels\/([^"]+)"><\/script>/g)].map(m => m[1]);
  assert.deepEqual([...tags].sort(), files, 'each levels/*.js file needs exactly one <script> tag');
  assert.equal(new Set(tags).size, tags.length, 'no duplicate level script tags');
  const dates = tags.map(t => levels.find(l => l.file === t).level.date);
  assert.deepEqual(dates, [...dates].sort(), 'level script tags must be in date order (new tests go last)');
  assert.ok(html.indexOf('addLevel(level)') < html.indexOf('src="levels/'), 'registry loads before levels');
  assert.ok(html.lastIndexOf('src="levels/') < html.indexOf('src="js/main.js"'), 'game loads after levels');
});

test('level ids are unique', () => {
  const ids = levels.map(l => l.level.id);
  assert.equal(new Set(ids).size, ids.length);
});

for (const { file, level } of levels) {
  test(`${file} follows the level rules`, () => {
    checkKeys(level, ['id', 'name', 'topic', 'date', 'stages'], file);
    assert.match(level.id, /^[a-z0-9]+(-[a-z0-9]+)*$/, `${file}: id must be kebab-case`);
    checkShort(level.name, 3, 20, `${file} name`);
    checkShort(level.topic, 6, 40, `${file} topic`);
    assert.match(level.date, /^\d{4}-\d{2}-\d{2}$/, `${file}: date must be YYYY-MM-DD`);
    assert.ok(!Number.isNaN(Date.parse(level.date)), `${file}: date must be real`);
    assert.ok(Array.isArray(level.stages) && level.stages.length >= 1 && level.stages.length <= 8, `${file}: needs 1-8 stages`);

    const seen = new Set();
    level.stages.forEach((stage, si) => {
      const where = `${file} stage ${si + 1}`;
      checkKeys(stage, ['name', 'biome', 'chaser', 'color', 'questions', 'count', 'music', 'mode', 'rules'], where);
      const mode = stage.mode ?? 'run';
      assert.ok(['run', 'sky', 'grab', 'shoot', 'boss'].includes(mode), `${where}: mode must be run, sky, grab, shoot or boss`);
      assert.ok(mode === 'run' || stage.biome !== 'tour', `${where}: a tour stage is a run`);
      // The catch stage needs its rules (rounds), one kind of number to grab per round.
      if (mode === 'grab') {
        assert.ok(Array.isArray(stage.rules) && stage.rules.length >= 1 && stage.rules.length <= 6, `${where}: a grab stage needs 1-6 rules`);
        for (const kind of stage.rules) assert.doesNotThrow(() => grabRule(rngFrom(1), kind), `${where}: unknown rule "${kind}"`);
      } else assert.equal(stage.rules, undefined, `${where}: rules are only for grab stages`);
      checkShort(stage.name, 3, 20, `${where} name`);
      assert.ok(BIOMES.includes(stage.biome), `${where}: biome must be one of ${BIOMES.join(', ')}`);
      assert.ok(CHASERS.includes(stage.chaser), `${where}: chaser must be one of ${CHASERS.join(', ')}`);
      assert.match(stage.color, /^#[0-9a-f]{6}$/i, `${where}: color must be #rrggbb`);
      if (stage.biome === 'tour') {
        // The final run passes through every earlier stage's scenery and reuses their questions.
        assert.equal(si, level.stages.length - 1, `${where}: the tour must be the last stage`);
        assert.ok(si >= 1, `${where}: the tour needs earlier stages to tour through`);
      }
      if (stage.music !== undefined) {
        assert.ok(MUSIC.includes(stage.music), `${where}: music must be one of ${MUSIC.join(', ')}`);
        assert.ok(fs.existsSync(path.join(here, 'assets/audio/music', stage.music + '.mp3')), `${where}: assets/audio/music/${stage.music}.mp3 is missing`);
      }
      assert.ok(Array.isArray(stage.questions) && stage.questions.length >= 1 && stage.questions.length <= 10, `${where}: needs 1-10 questions`);
      // Made questions ({ gen }) can be asked more than once, so a stage with them can set how many it asks.
      const made = stage.questions.some(q => q.gen);
      if (stage.count !== undefined) {
        assert.ok(made && stage.biome !== 'tour', `${where}: count is only for non-tour stages with { gen } questions`);
        assert.ok(Number.isInteger(stage.count) && stage.count >= stage.questions.length && stage.count <= 12, `${where}: count must be a whole number from the number of questions up to 12`);
      }
      const asked = stage.count || stage.questions.length;
      if (stage.biome !== 'tour') assert.ok(asked >= 3, `${where}: needs at least 3 questions`);
      stage.questions.forEach((q, qi) => {
        const at = `${where} question ${qi + 1}`;
        if (q.gen !== undefined) {
          checkKeys(q, ['gen', 'variant'], at);
          assert.ok(SKILLS[q.gen], `${at}: gen "${q.gen}" must be a skill in js/mathgen.js (${Object.keys(SKILLS).join(', ')})`);
          // Sky answers are painted on hoops, so sky skills need their short-answer (lane) form.
          if (mode === 'sky' || mode === 'shoot') assert.ok(SKILLS[q.gen].lane, `${at}: "${q.gen}" can't make short answers for a ${mode} stage`);
          if (q.variant !== undefined) assert.ok(VARIANTS[q.gen].includes(q.variant), `${at}: variant must be one of ${VARIANTS[q.gen].join(', ')}`);
          for (let seed = 1; seed <= 25; seed++) {
            const mq = makeQuestion(q, rngFrom(seed));
            for (const str of strings(mq)) assert.ok(!EMOJI.test(str), `${at}: made "${str}", which has an emoji`);
          }
          return;
        }
        checkKeys(q, ['q', 'a', 'wrong', 'why', 'pic', 'show', 'say', 'model'], at);
        if (mode === 'sky' || mode === 'shoot') for (const ans of [q.a, ...q.wrong]) assert.ok(ans.length <= 8, `${at}: ${mode} answers are painted on signs, so "${ans}" must be 8 characters or less`);
        if (q.model !== undefined) checkModel(q.model, at);
        checkShort(q.q, 8, 48, `${at} q`);
        if (q.show !== undefined) checkShort(q.show, 8, 40, `${at} show`);
        if (q.say !== undefined) assert.ok(text(q.say) && q.say.length <= 140, `${at}: say must be short text`);
        if (q.pic !== undefined) assert.ok(PICS.includes(q.pic), `${at}: pic "${q.pic}" must be one of the PICS names in js/catalog.js`);
        assert.ok(Array.isArray(q.wrong) && q.wrong.length >= 3, `${at}: needs at least 3 wrong answers`);
        [q.a, ...q.wrong].forEach(ans => checkShort(ans, 4, 24, `${at} answer`));
        const all = [q.a, ...q.wrong].map(s => s.trim().toLowerCase());
        assert.equal(new Set(all).size, all.length, `${at}: answers must all be different`);
        checkShort(q.why, 5, 40, `${at} why`);
        const key = `${q.show || ''}|${q.q}`.toLowerCase();
        assert.ok(!seen.has(key), `${at}: duplicate question`);
        seen.add(key);
      });
    });
    assert.ok(level.stages.filter(s => s.biome === 'tour').length <= 1, `${file}: at most one tour stage`);
    for (const str of strings(level)) assert.ok(!EMOJI.test(str), `${file}: "${str}" has an emoji; use pic: 'name' for pictures`);
  });
}
