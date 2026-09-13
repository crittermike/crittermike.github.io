import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import * as core from './core.js';
const view = await import('./view.js').catch(() => ({}));
const catalog = JSON.parse(await readFile(new URL('./catalog.json', import.meta.url)));

test('initial movie view shows all 26 watched films as explicitly unranked with real poster fallbacks', () => {
  assert.equal(typeof view.renderLists, 'function');
  const html = view.renderLists(core.createState(catalog), catalog, '');
  assert.equal((html.match(/data-action="rank"/g) || []).length, 26);
  assert.ok(html.includes('Unranked'));
  assert.ok(html.includes('Your top spot is waiting'));
  assert.ok(html.includes('Start in release order'));
  assert.ok(html.includes('posters/thor-ragnarok.jpg'));
  assert.ok(html.includes('poster-fallback'));
  assert.ok(!html.includes('data-action="drag"'));
  assert.ok(!html.includes('eternals.jpg'));
});


test('ranked views expose accessible stable-ID moves and never renumber filtered results', () => {
  let state = core.rankMovie(core.createState(catalog), 'mike', 'iron-man', 1);
  state = core.rankMovie(state, 'mike', 'thor', 2);
  const html = view.renderLists(state, catalog, '');
  assert.ok(html.includes('data-action="drag"'));
  assert.ok(html.includes('Move Thor to position'));
  assert.ok(html.includes('data-action="up"'));
  assert.ok(!html.includes('Your top spot is waiting'));
  const filtered = view.renderLists(state, catalog, 'thor');
  assert.match(filtered, /value="2"/);
  assert.match(filtered, /data-action="drag"[^>]*disabled/);
  assert.ok(filtered.includes('Clear search to drag'));
  const empty = view.renderLists(state, catalog, 'no-match-xyz');
  assert.ok(empty.includes('No movies match'));
  assert.ok(!empty.includes('Your top spot is waiting'));
});

test('profile and library markup escapes names and labels watched changes explicitly', () => {
  assert.equal(typeof view.renderProfiles, 'function');
  assert.equal(typeof view.renderLibrary, 'function');
  const state = core.editProfile(core.createState(catalog), 'guest', '<img src=x onerror=alert(1)>');
  const profiles = view.renderProfiles(state);
  assert.ok(profiles.includes('&lt;img'));
  assert.ok(!profiles.includes('<img src=x'));
  assert.equal((profiles.match(/data-action="profile"/g) || []).length, 7);
  assert.ok(profiles.includes('aria-pressed="true"'));
  const library = view.renderLibrary(state, catalog, '', false);
  assert.equal((library.match(/data-action="watched-add"/g) || []).length, 11);
  assert.ok(library.includes('Deadpool'));
  const watched = view.renderLibrary(state, catalog, '', true);
  assert.equal((watched.match(/data-action="watched-remove"/g) || []).length, 26);
  assert.ok(view.renderLibrary(state, catalog, 'xyz-no-movie', false).includes('No movies match'));
  assert.equal(view.escapeHTML(`<&"'>`), '&lt;&amp;&quot;&#39;&gt;');
});

test('unranked shelf distinguishes a completed ranking from a search with no results', () => {
  const state = core.seedReleaseOrder(core.createState(catalog), 'mike', catalog);
  assert.ok(view.renderLists(state, catalog).includes('All caught up'));
  assert.ok(view.renderLists(core.createState(catalog), catalog, 'xyznomovie').includes('No movies match on the watched shelf'));
});
