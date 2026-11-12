// Content rules for Critter Run levels. Run: node --test critter-run/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { BIOMES, CHASERS } from './js/catalog.js';
import { hasIcon } from './js/icons.js';

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

// Emoji are banned everywhere in the game; pictures are icon names from js/icons.js.
const EMOJI = /[\p{Extended_Pictographic}\u{FE0F}\u{20E3}\u{1F1E6}-\u{1F1FF}]/u;
const isIcon = s => typeof s === 'string' && hasIcon(s);
const noEmoji = (value, where) => assert.ok(!EMOJI.test(value), `${where}: "${value}" has an emoji (use icon names instead)`);
const words = s => s.trim().split(/\s+/).filter(w => /[\p{L}\p{N}]/u.test(w)).length;
const text = s => typeof s === 'string' && s.trim().length > 0;

function checkKeys(obj, allowed, where) {
  const extra = Object.keys(obj).filter(k => !allowed.includes(k));
  assert.deepEqual(extra, [], `${where}: unknown keys ${extra.join(', ')}`);
}
function checkShort(value, maxWords, maxChars, where) {
  assert.ok(text(value), `${where}: must be non-empty text`);
  noEmoji(value, where);
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
      checkKeys(stage, ['name', 'biome', 'chaser', 'color', 'icons', 'questions'], where);
      checkShort(stage.name, 3, 20, `${where} name`);
      assert.ok(BIOMES.includes(stage.biome), `${where}: biome must be one of ${BIOMES.join(', ')}`);
      assert.ok(CHASERS.includes(stage.chaser), `${where}: chaser must be one of ${CHASERS.join(', ')}`);
      assert.match(stage.color, /^#[0-9a-f]{6}$/i, `${where}: color must be #rrggbb`);
      assert.ok(Array.isArray(stage.icons) && stage.icons.length >= 1 && stage.icons.length <= 4, `${where}: icons needs 1-4 icon names`);
      stage.icons.forEach(e => assert.ok(isIcon(e), `${where}: "${e}" is not an icon in js/icons.js`));
      if (stage.biome === 'tour') {
        // The final run passes through every earlier stage's scenery and reuses their questions.
        assert.equal(si, level.stages.length - 1, `${where}: the tour must be the last stage`);
        assert.ok(si >= 1, `${where}: the tour needs earlier stages to tour through`);
      }
      const min = stage.biome === 'tour' ? 1 : 3;
      assert.ok(Array.isArray(stage.questions) && stage.questions.length >= min && stage.questions.length <= 10, `${where}: needs ${min}-10 questions`);
      stage.questions.forEach((q, qi) => {
        const at = `${where} question ${qi + 1}`;
        checkKeys(q, ['q', 'a', 'wrong', 'why', 'pic', 'show', 'say'], at);
        checkShort(q.q, 8, 48, `${at} q`);
        if (q.show !== undefined) checkShort(q.show, 8, 40, `${at} show`);
        if (q.say !== undefined) { assert.ok(text(q.say) && q.say.length <= 140, `${at}: say must be short text`); noEmoji(q.say, at); }
        if (q.pic !== undefined) {
          const pics = [].concat(q.pic);
          assert.ok(pics.length >= 1 && pics.length <= 3, `${at}: pic is one icon name or a list of up to 3`);
          pics.forEach(e => assert.ok(isIcon(e), `${at}: "${e}" is not an icon in js/icons.js`));
        }
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
  });
}

test('no emoji anywhere in the game', () => {
  const skip = new Set(['vendor', 'assets']);
  const walk = d => fs.readdirSync(d, { withFileTypes: true }).flatMap(e => {
    if (e.isDirectory()) return skip.has(e.name) ? [] : walk(path.join(d, e.name));
    return /\.(js|mjs|html|md|css|json)$/.test(e.name) ? [path.join(d, e.name)] : [];
  });
  const files = [...walk(here), path.join(here, 'assets', 'CREDITS.md')].filter(f => fs.existsSync(f));
  for (const f of files) {
    fs.readFileSync(f, 'utf8').split('\n').forEach((line, i) => {
      const m = line.match(EMOJI);
      assert.ok(!m, `${path.relative(here, f)}:${i + 1} has an emoji (${m && m[0]}); use an icon from js/icons.js`);
    });
  }
});
