import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const core = await import('./core.js').catch(() => ({}));
const catalog = JSON.parse(await readFile(new URL('./catalog.json', import.meta.url)));

test('a new library has the exact watched catalog and six independent empty rankings', () => {
  assert.equal(typeof core.createState, 'function');
  const state = core.createState(catalog);
  assert.equal(catalog.length, 37);
  assert.equal(state.watched.length, 26);
  assert.ok(state.watched.includes('thor-ragnarok'));
  assert.ok(state.watched.includes('doctor-strange-in-the-multiverse-of-madness'));
  assert.ok(!catalog.some(movie => movie.id === 'deadpool-and-wolverine'));
  assert.deepEqual(state.profiles.map(p => p.name), ['Mike', 'Nancy', 'Charlie', 'Henry', 'William', 'Thomas']);
  assert.ok(state.profiles.every(p => p.ranking.length === 0));
  assert.notEqual(state.profiles[0].ranking, state.profiles[1].ranking);
  assert.equal(state.version, 1);
  assert.equal(state.activeProfile, 'mike');
});

test('ranking at an explicit position is immutable, duplicate-free and profile-specific', () => {
  assert.equal(typeof core.rankMovie, 'function');
  const initial = core.createState(catalog);
  const first = core.rankMovie(initial, 'mike', 'iron-man', 1);
  const second = core.rankMovie(first, 'mike', 'thor', 1);
  assert.deepEqual(second.profiles[0].ranking, ['thor', 'iron-man']);
  assert.deepEqual(second.profiles[1].ranking, []);
  assert.deepEqual(initial.profiles[0].ranking, []);
  const moved = core.rankMovie(second, 'mike', 'iron-man', 1);
  assert.deepEqual(moved.profiles[0].ranking, ['iron-man', 'thor']);
  assert.throws(() => core.rankMovie(second, 'mike', 'eternals', 1));
  assert.throws(() => core.rankMovie(second, 'missing', 'thor', 1));
  for (const position of [0, 3, 1.5, '1', NaN]) {
    assert.throws(() => core.rankMovie(second, 'mike', 'thor', position));
  }
});


test('release-order start appends unranked watched films without replacing personal choices', () => {
  assert.equal(typeof core.seedReleaseOrder, 'function');
  const state = core.rankMovie(core.createState(catalog), 'mike', 'thor', 1);
  const seeded = core.seedReleaseOrder(state, 'mike', catalog);
  assert.equal(seeded.profiles[0].ranking.length, 26);
  assert.deepEqual(seeded.profiles[0].ranking.slice(0, 3), ['thor', 'iron-man', 'iron-man-2']);
  assert.deepEqual(seeded.profiles[1].ranking, []);
  assert.deepEqual(core.seedReleaseOrder(seeded, 'mike', catalog), seeded);
});

test('unranking one movie keeps it watched and does not affect another person', () => {
  assert.equal(typeof core.unrankMovie, 'function');
  let state = core.rankMovie(core.createState(catalog), 'mike', 'thor', 1);
  state = core.rankMovie(state, 'nancy', 'thor', 1);
  const result = core.unrankMovie(state, 'mike', 'thor');
  assert.deepEqual(result.profiles[0].ranking, []);
  assert.deepEqual(result.profiles[1].ranking, ['thor']);
  assert.ok(result.watched.includes('thor'));
  assert.deepEqual(state.profiles[0].ranking, ['thor']);
});

test('the shared watched library adds real catalog films and safely removes them from every ranking', () => {
  assert.equal(typeof core.setWatched, 'function');
  const original = core.createState(catalog);
  let state = core.setWatched(original, 'eternals', true, catalog);
  state = core.setWatched(state, 'eternals', true, catalog);
  assert.equal(state.watched.length, 27);
  assert.ok(state.profiles.every(p => p.ranking.length === 0));
  state = core.rankMovie(state, 'mike', 'eternals', 1);
  state = core.rankMovie(state, 'nancy', 'eternals', 1);
  const result = core.setWatched(state, 'eternals', false, catalog);
  assert.equal(result.watched.length, 26);
  assert.ok(result.profiles.every(p => p.ranking.length === 0));
  assert.deepEqual(original, core.createState(catalog));
  assert.throws(() => core.setWatched(state, 'not-a-film', true, catalog));
  assert.throws(() => core.setWatched(state, 'thor', 'false', catalog));
});

test('backup validation accepts a clean schema but rejects malformed or inconsistent data', () => {
  assert.equal(typeof core.validateState, 'function');
  const good = core.createState(catalog);
  assert.deepEqual(core.validateState(good, catalog), good);
  assert.notEqual(core.validateState(good, catalog), good);
  const variants = [null, {}, { ...good, version: 2 }, { ...good, watched: ['unknown'] },
    { ...good, watched: ['thor', 'thor'] }, { ...good, activeProfile: 'missing' },
    { ...good, profiles: [] }, { ...good, profiles: [...good.profiles, good.profiles[0]] },
    { ...good, profiles: [{ id: 'mike', name: '', ranking: [] }] },
    { ...good, profiles: [{ id: '../bad', name: 'Mike', ranking: [] }] },
    { ...good, profiles: [{ id: 'mike', name: 'Mike', ranking: ['eternals'] }] },
    { ...good, profiles: [{ id: 'mike', name: 'Mike', ranking: ['thor', 'thor'] }] },
    { ...good, profiles: [{ id: 'mike', name: 'x'.repeat(41), ranking: [] }] }];
  for (const bad of variants) assert.throws(() => core.validateState(bad, catalog));
  assert.deepEqual(core.validateState({ ...good, injected: true }, catalog), good);
  assert.equal(typeof core.parseBackup, 'function');
  assert.deepEqual(core.parseBackup(JSON.stringify(good), catalog), good);
  assert.throws(() => core.parseBackup('{bad json', catalog));
  assert.throws(() => core.parseBackup(' '.repeat(200001), catalog));
});

test('adding or renaming a person preserves everyone else and validates names', () => {
  assert.equal(typeof core.editProfile, 'function');
  const state = core.createState(catalog);
  const added = core.editProfile(state, 'guest-1', '  Guest  ');
  assert.equal(added.profiles.length, 7);
  assert.equal(added.activeProfile, 'guest-1');
  assert.deepEqual(added.profiles[6], { id: 'guest-1', name: 'Guest', ranking: [] });
  const renamed = core.editProfile(core.rankMovie(added, 'guest-1', 'thor', 1), 'guest-1', 'Visitor');
  assert.deepEqual(renamed.profiles[6], { id: 'guest-1', name: 'Visitor', ranking: ['thor'] });
  assert.deepEqual(state, core.createState(catalog));
  assert.throws(() => core.editProfile(state, 'guest', ' '));
  assert.throws(() => core.editProfile(state, 'guest', 'Mike'));
  assert.throws(() => core.editProfile(state, '../bad', 'Guest'));
});

test('local persistence round-trips, preserves corrupt originals and reports write or conflict failures', () => {
  assert.equal(typeof core.loadSaved, 'function');
  assert.equal(typeof core.saveState, 'function');
  const records = new Map();
  const storage = { getItem: key => records.get(key) ?? null, setItem: (key, value) => records.set(key, value) };
  const empty = core.loadSaved(storage, catalog);
  assert.equal(empty.blocked, false);
  assert.equal(empty.raw, null);
  const saved = core.saveState(storage, empty.state, catalog, null);
  assert.equal(saved.ok, true);
  assert.deepEqual(core.loadSaved(storage, catalog).state, empty.state);
  assert.equal(core.saveState(storage, empty.state, catalog, null).ok, false);
  storage.setItem(core.STORAGE_KEY, '{broken');
  const broken = core.loadSaved(storage, catalog);
  assert.equal(broken.blocked, true);
  assert.equal(broken.raw, '{broken');
  assert.equal(storage.getItem(core.STORAGE_KEY), '{broken');
  assert.equal(core.saveState(storage, empty.state, catalog, '{broken', true).ok, false);
  assert.equal(storage.getItem(core.STORAGE_KEY), '{broken');
  const unavailable = { getItem() { throw new Error('denied'); }, setItem() { throw new Error('full'); } };
  assert.equal(core.loadSaved(unavailable, catalog).blocked, true);
  assert.equal(core.saveState(unavailable, empty.state, catalog, null).ok, false);
  const full = { getItem: () => null, setItem() { throw new Error('full'); } };
  assert.equal(core.saveState(full, empty.state, catalog, null).ok, false);
  const silent = { getItem: () => null, setItem() {} };
  assert.equal(core.saveState(silent, empty.state, catalog, null).ok, false);
});

test('individual share links validate Unicode names and import only after explicit new-profile selection', () => {
  assert.equal(typeof core.encodeShare, 'function');
  assert.equal(typeof core.decodeShare, 'function');
  assert.equal(typeof core.importShare, 'function');
  let state = core.rankMovie(core.createState(catalog), 'mike', 'thor', 1);
  state = core.editProfile(state, 'mike', 'Miké <3');
  const fragment = core.encodeShare(state.profiles[0], catalog);
  assert.ok(fragment.startsWith('#ranking='));
  const preview = core.decodeShare(fragment, catalog);
  assert.deepEqual(preview, { version: 1, name: 'Miké <3', ranking: ['thor'] });
  const imported = core.importShare(state, preview, 'incoming', 'Miké copy', catalog);
  assert.equal(imported.profiles.length, 7);
  assert.deepEqual(imported.profiles.slice(0, 6), state.profiles);
  assert.deepEqual(imported.profiles[6].ranking, ['thor']);
  assert.throws(() => core.importShare(state, preview, 'mike', 'Replacement', catalog));
  const incoming = { version: 1, name: 'Visitor', ranking: ['eternals'] };
  const withMovie = core.importShare(state, incoming, 'visitor', 'Visitor', catalog);
  assert.ok(withMovie.watched.includes('eternals'));
  assert.ok(!state.watched.includes('eternals'));
  const encode = data => '#ranking=' + encodeURIComponent(JSON.stringify(data));
  for (const bad of ['#ranking=%broken', '#other=bad', encode({ ...preview, version: 2 }),
    encode({ ...preview, ranking: ['thor', 'thor'] }), encode({ ...preview, ranking: ['unknown'] }),
    encode({ ...preview, name: '' }), '#ranking=' + 'x'.repeat(16001)]) {
    assert.throws(() => core.decodeShare(bad, catalog));
  }
});

test('undo restores the entire previous library after destructive removal or backup replacement', () => {
  assert.equal(typeof core.changeSession, 'function');
  assert.equal(typeof core.undoSession, 'function');
  const original = core.rankMovie(core.createState(catalog), 'mike', 'thor', 1);
  const session = { state: original, previous: null };
  const removed = core.changeSession(session, core.setWatched(original, 'thor', false, catalog));
  assert.deepEqual(core.undoSession(removed), session);
  const replacement = core.changeSession(session, core.createState(catalog));
  assert.deepEqual(core.undoSession(replacement).state, original);
  assert.deepEqual(core.undoSession(session), session);
});

test('search separates watched shelves, retains absolute rank positions and disables drag while filtered', () => {
  assert.equal(typeof core.selectMovies, 'function');
  let state = core.rankMovie(core.createState(catalog), 'mike', 'iron-man', 1);
  state = core.rankMovie(state, 'mike', 'thor', 2);
  const filtered = core.selectMovies(state, catalog, '  THOR  ');
  assert.equal(filtered.canDrag, false);
  assert.equal(filtered.ranked.length, 1);
  assert.equal(filtered.ranked[0].position, 2);
  assert.deepEqual(filtered.unranked.map(m => m.id), ['thor-ragnarok']);
  const all = core.selectMovies(state, catalog, '');
  assert.equal(all.canDrag, true);
  assert.equal(all.unranked.length, 24);
  assert.equal(all.unwatched.length, 11);
  assert.equal(core.selectMovies(state, catalog, 'no-match-xyz').ranked.length, 0);
  assert.ok(core.selectMovies(state, catalog, '2017').unranked.length > 0);
});

test('pointer drop math uses stable IDs and clamps auto-scroll speed at viewport edges', () => {
  assert.equal(typeof core.dropPosition, 'function');
  assert.equal(typeof core.scrollVelocity, 'function');
  const rows = [{ id: 'a', top: 10, height: 80 }, { id: 'b', top: 90, height: 80 }, { id: 'c', top: 170, height: 80 }];
  assert.equal(core.dropPosition(rows, 'b', 0), 1);
  assert.equal(core.dropPosition(rows, 'b', 250), 3);
  assert.equal(core.dropPosition(rows, 'b', 150), 2);
  assert.equal(core.scrollVelocity(400, 800), 0);
  assert.ok(core.scrollVelocity(10, 800) < 0);
  assert.ok(core.scrollVelocity(790, 800) > 0);
  assert.equal(core.scrollVelocity(-1000, 800), -18);
  assert.equal(core.scrollVelocity(2000, 800), 18);
});
