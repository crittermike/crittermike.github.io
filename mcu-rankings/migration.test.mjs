import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import * as core from './core.js';
const catalog = JSON.parse(await readFile(new URL('./catalog.json', import.meta.url)));
const legacy = () => ({ version: 1, watched: ['thor', 'iron-man', 'eternals'], profiles: [
  { id: 'mike', name: 'Mike', ranking: ['eternals', 'thor'] },
  { id: 'everyone', name: 'Everyone', ranking: ['thor'] },
  { id: 'everyone-2', name: 'Everyone', ranking: [] }
], activeProfile: 'mike' });

test('v1 migration preserves every personal identity and prefix despite Everyone collisions', () => {
  const original = legacy(), before = structuredClone(original);
  const migrated = core.parseBackup(JSON.stringify(original), catalog);
  assert.equal(migrated.version, 2);
  assert.equal(migrated.consensusProfile, 'everyone-3');
  assert.equal(migrated.activeProfile, migrated.consensusProfile);
  assert.deepEqual(migrated.watched, ['iron-man', 'thor', 'eternals']);
  assert.deepEqual(migrated.profiles[0], { id: 'everyone-3', name: 'Everyone', ranking: migrated.watched });
  for (const old of original.profiles) {
    const result = migrated.profiles.find(p => p.id === old.id);
    assert.equal(result.name, old.name);
    assert.deepEqual(result.ranking, [...old.ranking, ...migrated.watched.filter(id => !old.ranking.includes(id))]);
  }
  assert.deepEqual(original, before);
  assert.deepEqual(core.parseBackup(JSON.stringify(migrated), catalog), migrated, 'migration is idempotent');
  const personalSelected = { ...migrated, activeProfile: 'everyone' };
  assert.deepEqual(core.validateState(personalSelected, catalog), personalSelected, 'v2 remembers optional personal selection');
});

test('migration retains all 30 legacy people and never seeds catalog watched defaults over saved choices', () => {
  const original = { version: 1, watched: [], profiles: Array.from({ length: 30 }, (_, i) => ({ id: `person-${i}`, name: `Person ${i}`, ranking: [] })), activeProfile: 'person-29' };
  const state = core.validateState(original, catalog);
  assert.equal(state.profiles.length, 31);
  assert.deepEqual(state.profiles.slice(1), original.profiles);
  assert.deepEqual(state.watched, []);
  assert.throws(() => core.editProfile(state, 'extra', 'Extra'), /30/);
  assert.deepEqual(core.parseBackup(JSON.stringify(state), catalog), state);
});

test('legacy migration validates the entire source before filling missing movies', () => {
  const original = legacy();
  const bad = [
    { ...original, watched: ['unknown'] }, { ...original, activeProfile: 'unknown' },
    { ...original, profiles: [...original.profiles, original.profiles[0]] },
    { ...original, profiles: [{ id: 'bad', name: 'Bad', ranking: ['thor', 'thor'] }] },
    { ...original, profiles: [{ id: 'bad', name: 'Bad', ranking: ['iron-man-2'] }], activeProfile: 'bad' },
    { ...original, version: 99 }
  ];
  for (const state of bad) assert.throws(() => core.validateState(state, catalog));
});

test('v2 rejects invalid consensus metadata and partial lists instead of discarding data', () => {
  const good = core.createState(catalog);
  assert.deepEqual(core.validateState(good, catalog), good);
  for (const state of [
    { ...good, consensusProfile: undefined }, { ...good, consensusProfile: 'missing' },
    { ...good, consensusProfile: 'mike' },
    { ...good, profiles: good.profiles.map((p, i) => i ? p : { ...p, ranking: [] }) }
  ]) assert.throws(() => core.validateState(state, catalog));
});

test('loading legacy data keeps original bytes as the stale-write baseline until a guarded save', () => {
  let stored = JSON.stringify(legacy());
  const originalRaw = stored;
  const storage = { getItem: () => stored, setItem: (_, value) => { stored = value; } };
  const loaded = core.loadSaved(storage, catalog);
  assert.equal(loaded.blocked, false);
  assert.equal(loaded.raw, originalRaw);
  assert.equal(stored, originalRaw, 'load never writes');
  assert.equal(loaded.state.version, 2);
  stored = 'another tab';
  assert.equal(core.saveState(storage, loaded.state, catalog, loaded.raw).conflict, true);
  assert.equal(stored, 'another tab');
  stored = originalRaw;
  const saved = core.saveState(storage, loaded.state, catalog, loaded.raw);
  assert.equal(saved.ok, true);
  assert.deepEqual(core.loadSaved(storage, catalog).state, loaded.state);
});
