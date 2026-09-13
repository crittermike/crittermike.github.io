import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createState } from './core.js';
import { renderProfiles } from './view.js';
const html = await readFile(new URL('./index.html', import.meta.url), 'utf8');
const catalog = JSON.parse(await readFile(new URL('./catalog.json', import.meta.url)));
test('real page supplies every consensus-render hook and explains the prefilled list', () => {
  for (const id of ['list-kind', 'list-description', 'rename-profile']) assert.match(html, new RegExp(`id="${id}"`), `missing ${id}`);
  assert.match(html, /Everyone/);
  assert.match(html, /already|ready/i);
  assert.doesNotMatch(html, /Different opinions|critics at home|Add watched movie/);
});
test('personal lists are secondary and expand automatically when one is active', () => {
  const state = createState(catalog);
  assert.match(renderProfiles(state), /<details class="personal-lists">/);
  assert.match(renderProfiles(state), /Personal lists/);
  assert.match(renderProfiles({...state, activeProfile:'mike'}), /<details class="personal-lists" open>/);
});
