import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import * as core from './core.js';
import * as view from './view.js';
const catalog = JSON.parse(await readFile(new URL('./catalog.json', import.meta.url)));

test('initial view is one numbered full leaderboard with immediate moves and real poster fallbacks', () => {
  const state = core.createState(catalog);
  const html = view.renderLists(state, catalog);
  assert.equal((html.match(/<ol /g) || []).length, 1);
  assert.equal((html.match(/data-action="drag"/g) || []).length, 26);
  assert.equal((html.match(/data-action="move"/g) || []).length, 26);
  assert.equal((html.match(/class="rank-number"/g) || []).length, 26);
  for (let position = 1; position <= 26; position++) assert.ok(html.includes(`value="${position}"`));
  assert.match(html, /release order.*starting point/i);
  assert.doesNotMatch(html, /Unranked|data-action="seed"|data-action="unrank"|data-action="rank"|Top pick|Choose your first/i);
  assert.ok(html.includes('posters/thor-ragnarok.jpg'));
  assert.ok(html.includes('poster-fallback'));
  assert.ok(!html.slice(0, html.indexOf('id="unwatched-zone"')).includes('eternals.jpg'));
  assert.ok(html.slice(html.indexOf('id="unwatched-zone"')).includes('eternals.jpg'));
});

test('ranked views expose accessible stable-ID moves and never renumber filtered results', () => {
  let state = core.rankMovie(core.createState(catalog), 'mike', 'iron-man', 1);
  state = { ...core.rankMovie(state, 'mike', 'thor', 2), activeProfile: 'mike' };
  const html = view.renderLists(state, catalog);
  assert.ok(html.includes('data-action="drag"'));
  assert.ok(html.includes('Move Thor to position'));
  assert.ok(html.includes('data-action="up"'));
  assert.match(html, /Home.*End/);
  const filtered = view.renderLists(state, catalog, 'thor');
  assert.match(filtered, /value="2"/);
  assert.match(filtered, /data-action="drag"[^>]*disabled/);
  assert.ok(filtered.includes('Clear search to drag'));
  assert.ok(view.renderLists(state, catalog, 'no-match-xyz').includes('No movies match'));
});

test('Everyone is clearly distinguished from optional personal lists even with identical legacy names', () => {
  const state = core.validateState({ version: 1, watched: ['thor'], profiles: [{ id: 'everyone', name: 'Everyone', ranking: ['thor'] }], activeProfile: 'everyone' }, catalog);
  const profiles = view.renderProfiles(state);
  assert.match(profiles, /Everyone<\/strong><small>Family consensus/);
  assert.match(profiles, /Everyone<\/strong><small>Personal list/);
  assert.match(profiles, /data-id="everyone-2" aria-pressed="true"/);
});

test('profile and library markup escapes names and labels watched changes explicitly', () => {
  const state = core.editProfile(core.createState(catalog), 'guest', '<img src=x onerror=alert(1)>');
  const profiles = view.renderProfiles(state);
  assert.ok(profiles.includes('&lt;img'));
  assert.ok(!profiles.includes('<img src=x'));
  assert.equal((profiles.match(/data-action="profile"/g) || []).length, 8);
  assert.ok(profiles.includes('aria-pressed="true"'));
  const library = view.renderLibrary(state, catalog, '', false);
  assert.equal((library.match(/data-action="watched-add"/g) || []).length, 11);
  assert.ok(library.includes('Deadpool'));
  const watched = view.renderLibrary(state, catalog, '', true);
  assert.equal((watched.match(/data-action="watched-remove"/g) || []).length, 26);
  assert.ok(view.renderLibrary(state, catalog, 'xyz-no-movie', false).includes('No movies match'));
  assert.equal(view.escapeHTML(`<&"'>`), '&lt;&amp;&quot;&#39;&gt;');
});

test('an empty watched library directs to the collection, never to an unranked shelf', () => {
  let state = core.createState(catalog);
  for (const id of state.watched) state = core.setWatched(state, id, false, catalog);
  const html = view.renderLists(state, catalog);
  assert.match(html, /No watched movies yet/);
  assert.match(html, /data-action="library"/);
  assert.doesNotMatch(html, /unranked|seed|data-action="rank"/i);
});
