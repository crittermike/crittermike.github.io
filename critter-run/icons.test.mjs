// Icon and emoji checks. Emoji are banned in the game: every picture is an SVG icon from js/icons.js.
// Run: node --test critter-run/*.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ICONS, ICON_CREDITS } from './js/icons.js';
import { POWERS, RUNNERS, WEAPONS, TRAILS, SHOP_TABS } from './js/items.js';
import { CHASERS, PICS } from './js/catalog.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const read = f => fs.readFileSync(path.join(here, f), 'utf8');
const gameFiles = ['index.html', ...fs.readdirSync(path.join(here, 'js')).map(f => `js/${f}`), ...fs.readdirSync(path.join(here, 'levels')).map(f => `levels/${f}`)];

test('every icon the game uses exists', () => {
  const names = new Set([
    ...Object.values(POWERS).map(p => p.icon), ...[...RUNNERS, ...WEAPONS, ...TRAILS, ...SHOP_TABS].map(x => x.icon),
    ...CHASERS, ...PICS,
  ]);
  for (const f of gameFiles) {
    for (const m of read(f).matchAll(/\bicon(?:Texture)?\('([a-z0-9-]+)'/g)) names.add(m[1]);
    for (const m of read(f).matchAll(/href="#i-([a-z0-9-]+)"/g)) names.add(m[1]);
  }
  const missing = [...names].filter(n => !Object.prototype.hasOwnProperty.call(ICONS, n));
  assert.deepEqual(missing, [], 'add these to js/icons.js');
});

test('every icon author is credited', () => {
  // Each ICONS entry ends with a comment naming its game-icons.net source, like "// lorc/magnet".
  const credited = new Set(ICON_CREDITS.map(c => c.author.toLowerCase().replace(/\s+/g, '-')));
  const notes = [...read('js/icons.js').matchAll(/^ {2}['a-z0-9-]+: .*\/\/ (.+)$/gm)].map(m => m[1]);
  const authors = new Set(notes.flatMap(n => [...n.matchAll(/([a-z0-9-]+)\/[a-z0-9-]+/g)].map(m => m[1])));
  for (const a of authors) assert.ok(credited.has(a), `icons by ${a} need an ICON_CREDITS entry`);
});

test('no emoji anywhere in the game', () => {
  for (const f of gameFiles) {
    const found = read(f).match(/\p{Extended_Pictographic}|\uFE0F/u);
    assert.equal(found, null, `${f} has an emoji (${found}); use an icon from js/icons.js`);
  }
});
