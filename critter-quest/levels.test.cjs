'use strict';
// Content rules for Critter Quest levels. Run: node --test critter-quest/
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const dir = path.join(__dirname, 'levels');
const files = fs.readdirSync(dir).filter(f => f.endsWith('.js')).sort();
const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');

function loadLevel(file) {
  const found = [];
  vm.runInNewContext(fs.readFileSync(path.join(dir, file), 'utf8'), {
    CritterQuest: { addLevel: level => found.push(level) },
  }, { filename: file });
  assert.equal(found.length, 1, `${file} must call CritterQuest.addLevel exactly once`);
  return found[0];
}
const levels = files.map(file => ({ file, level: loadLevel(file) }));

const segmenter = new Intl.Segmenter('en', { granularity: 'grapheme' });
const isOneEmoji = s => typeof s === 'string' && [...segmenter.segment(s)].length === 1
  && /\p{Extended_Pictographic}/u.test(s) && !/[\p{L}\p{N}]/u.test(s);
const words = s => s.trim().split(/\s+/).filter(w => /[\p{L}\p{N}]/u.test(w)).length;
const text = s => typeof s === 'string' && s.trim().length > 0;

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
  assert.ok(html.lastIndexOf('src="levels/') < html.indexOf('src="game.js"'), 'game loads after levels');
});

test('level ids are unique', () => {
  const ids = levels.map(l => l.level.id);
  assert.equal(new Set(ids).size, ids.length);
});

for (const { file, level } of levels) {
  test(`${file} follows the level rules`, () => {
    checkKeys(level, ['id', 'name', 'topic', 'date', 'emoji', 'color', 'decor', 'boss', 'stages'], file);
    assert.match(level.id, /^[a-z0-9]+(-[a-z0-9]+)*$/, `${file}: id must be kebab-case`);
    checkShort(level.name, 3, 20, `${file} name`);
    checkShort(level.topic, 6, 40, `${file} topic`);
    assert.match(level.date, /^\d{4}-\d{2}-\d{2}$/, `${file}: date must be YYYY-MM-DD`);
    assert.ok(!Number.isNaN(Date.parse(level.date)), `${file}: date must be real`);
    assert.match(level.color, /^#[0-9a-f]{6}$/i, `${file}: color must be #rrggbb`);
    assert.ok(isOneEmoji(level.emoji), `${file}: emoji must be one emoji`);
    assert.ok(isOneEmoji(level.boss), `${file}: boss must be one emoji`);
    assert.ok(Array.isArray(level.decor) && level.decor.length >= 1 && level.decor.length <= 4, `${file}: decor needs 1-4 emoji`);
    level.decor.forEach(d => assert.ok(isOneEmoji(d), `${file}: decor "${d}" must be one emoji`));

    assert.ok(Array.isArray(level.stages) && level.stages.length >= 2 && level.stages.length <= 8, `${file}: needs 2-8 stages`);
    const monsters = level.stages.map(s => s.monster);
    assert.equal(new Set([...monsters, level.boss]).size, monsters.length + 1, `${file}: monsters and boss must all be different`);

    const seen = new Set();
    let count = 0;
    level.stages.forEach((stage, si) => {
      const where = `${file} stage ${si + 1}`;
      checkKeys(stage, ['monster', 'questions'], where);
      assert.ok(isOneEmoji(stage.monster), `${where}: monster must be one emoji`);
      assert.ok(Array.isArray(stage.questions) && stage.questions.length >= 3 && stage.questions.length <= 6, `${where}: needs 3-6 questions`);
      stage.questions.forEach((q, qi) => {
        const at = `${where} question ${qi + 1}`;
        count++;
        checkKeys(q, ['q', 'a', 'wrong', 'why', 'pic', 'show', 'say'], at);
        checkShort(q.q, 8, 48, `${at} q`);
        if (q.show !== undefined) checkShort(q.show, 8, 40, `${at} show`);
        if (q.say !== undefined) assert.ok(text(q.say) && q.say.length <= 140, `${at}: say must be short text`);
        if (q.pic !== undefined) assert.ok(isOneEmoji(q.pic), `${at}: pic must be one emoji`);
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
    assert.ok(count >= 8, `${file}: needs at least 8 questions (the boss uses 8)`);
  });
}
