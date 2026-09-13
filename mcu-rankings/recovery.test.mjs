import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import * as core from './core.js';
import * as view from './view.js';

const catalog = JSON.parse(await readFile(new URL('./catalog.json', import.meta.url)));
// Execute the real action handlers and persistence path; only DOM/download plumbing is stubbed.
const source = (await readFile(new URL('./app.js', import.meta.url), 'utf8'))
  .replace(/^import .*;\n/gm, '')
  .replace(/^boot\(\)\.catch.*;$/m, '');
function setup(initialRaw = '{broken') {
  let stored = initialRaw;
  const writes = [], downloads = [], nodes = new Map();
  const node = selector => {
    if (!nodes.has(selector)) nodes.set(selector, {
      open: false, hidden: true, textContent: '', innerHTML: '', value: '',
      classList: { add() {}, remove() {} }, addEventListener() {}, focus() {}, select() {},
      querySelector() { return null; }, showModal() { this.open = true; }, close() { this.open = false; }
    });
    return nodes.get(selector);
  };
  const storage = {
    getItem() { return stored; },
    setItem(key, value) { writes.push(value); stored = value; }
  };
  const context = vm.createContext({
    core, ...view, esc: view.escapeHTML, testCatalog: catalog, testStorage: storage,
    document: { querySelector: node, activeElement: null, body: node('body'),
      createElement() { return { click() {} }; } },
    Blob, URL: { createObjectURL(blob) { downloads.push(blob); return 'blob:test'; }, revokeObjectURL() {} },
    setTimeout() {}, clearTimeout() {}, cancelAnimationFrame() {}
  });
  vm.runInContext(source, context, { filename: 'app.js' });
  vm.runInContext('catalog = testCatalog; storage = testStorage; const loaded = core.loadSaved(storage, catalog); session = { state: loaded.state, previous: null }; raw = loaded.raw; blocked = loaded.blocked;', context);
  return { node, writes, downloads, storage,
    setStored(value) { stored = value; }, getStored() { return stored; },
    action(name, id) { return vm.runInContext(`action({ dataset: { action: ${JSON.stringify(name)}, id: ${JSON.stringify(id)} } })`, context); },
    read(expression) { return vm.runInContext(expression, context); },
    confirm() { node('#confirm-action').onclick(); }
  };
}
const newerRaw = () => JSON.stringify(core.rankMovie(core.createState(catalog), 'nancy', 'thor', 1));

test('dropping into Unwatched removes globally and Undo restores all personal positions', async () => {
  const initial = core.rankMovie(core.createState(catalog), 'nancy', 'thor', 1);
  const app = setup(JSON.stringify(initial));
  app.read('drag = {id:"thor",pointer:1,moved:true,unwatched:true,position:1,row:$("#test-row"),handle:{hasPointerCapture(){return false}}};endDrag()');
  const saved=JSON.parse(app.getStored());
  assert.ok(!saved.watched.includes('thor'));
  assert.ok(saved.profiles.every(p=>!p.ranking.includes('thor')));
  await app.action('undo');
  assert.deepEqual(JSON.parse(app.getStored()),initial);
});
test('cancelled unwatched drag does not change watched status or write storage', () => {
  const app=setup(null);
  app.read('drag = {id:"thor",pointer:1,moved:true,unwatched:true,position:1,row:$("#test-row"),handle:{hasPointerCapture(){return false}}};endDrag(true)');
  assert.equal(app.writes.length,0);
  assert.ok(app.read('session.state.watched.includes("thor")'));
});
test('Move dialog offers a non-drag not-watched action', async () => {
  const app=setup(null);await app.action('move','thor');
  assert.ok(app.node('#modal-content').innerHTML.includes('data-action="watched-remove"'));
  assert.ok(app.node('#modal-content').innerHTML.includes('Not watched yet'));
});

for (const initialRaw of ['{broken', JSON.stringify(core.createState(catalog)), null]) {
  test(`recovery rejects another tab's update after confirmation opens (baseline ${initialRaw === null ? 'empty' : initialRaw === '{broken' ? 'invalid' : 'valid'})`, async () => {
    const app = setup(initialRaw);
    await app.action('recover');
    const latest = newerRaw();
    app.setStored(latest);
    await app.action('original');
    app.confirm();
    assert.equal(app.getStored(), latest, 'Nancy’s newer ranking must survive recovery');
    assert.equal(app.writes.length, 0);
    assert.equal(app.read('raw'), initialRaw);
    assert.equal(app.read('blocked'), true);
    assert.equal(app.node('#modal').open, true);
    assert.equal(app.node('#modal-error').hidden, false);
    assert.match(app.node('#modal-error').textContent, /another tab/i);
    assert.match(app.node('#modal-error').textContent, /export.*reload/i);
    assert.match(app.node('#save-status').textContent, /temporary/i);
    app.confirm();
    assert.equal(app.writes.length, 0, 'retry cannot accept a new baseline');
  });
}

test('unchanged invalid original remains downloadable and can be explicitly recovered', async () => {
  const app = setup();
  await app.action('original');
  assert.equal(await app.downloads[0].text(), '{broken');
  await app.action('recover');
  app.confirm();
  assert.deepEqual(JSON.parse(app.getStored()), core.createState(catalog));
  assert.equal(app.read('blocked'), false);
  assert.equal(app.node('#modal').open, false);
  assert.match(app.node('#save-status').textContent, /^Saved on this device/);
});

test('failed recovery write keeps the dialog open and storage protection enabled', async () => {
  const app = setup();
  app.storage.setItem = () => { throw new Error('quota'); };
  await app.action('recover');
  app.confirm();
  assert.equal(app.getStored(), '{broken');
  assert.equal(app.node('#modal').open, true);
  assert.equal(app.read('blocked'), true);
  assert.equal(app.node('#modal-error').hidden, false);
  assert.match(app.node('#modal-error').textContent, /could not save.*export/i);
  assert.match(app.node('#save-status').textContent, /temporary/i);
});

test('Download original remains available when another tab populated initially empty storage', async () => {
  const app = setup(null);
  app.setStored(newerRaw());
  app.read('blocked = true');
  await app.action('data');
  const button = app.node('#modal-content').innerHTML.match(/<button data-action="original"[^>]*>/)[0];
  assert.doesNotMatch(button, /disabled/);
  await app.action('original');
  assert.equal(await app.downloads[0].text(), app.getStored());
});

test('Download original reports removed storage instead of silently exporting stale data', async () => {
  const app = setup();
  app.setStored(null);
  await assert.rejects(app.action('original'), /no saved data.*export.*reload/i);
  assert.equal(app.downloads.length, 0);
  assert.equal(app.read('raw'), '{broken');
});

test('Download original exports the latest other-tab ranking without changing the recovery baseline', async () => {
  const app = setup();
  const latest = newerRaw();
  app.setStored(latest);
  await app.action('original');
  assert.equal(await app.downloads[0].text(), latest);
  assert.equal(app.read('raw'), '{broken');
  assert.equal(app.getStored(), latest);
  assert.equal(app.writes.length, 0);
});

test('Everyone heading explains manual consensus and hides rename without hiding personal options', async () => {
  const app = setup(null);
  app.read('render()');
  assert.equal(app.node('#person-heading').textContent, 'Everyone’s list');
  assert.equal(app.node('#list-kind').textContent, 'FAMILY CONSENSUS');
  assert.match(app.node('#list-description').textContent, /agree.*not an average/i);
  assert.equal(app.node('#rename-profile').hidden, true);
  await app.action('profile', 'mike');
  assert.equal(app.node('#list-kind').textContent, 'PERSONAL LIST');
  assert.equal(app.node('#rename-profile').hidden, false);
  assert.match(app.node('#list-description').textContent, /Everyone.*unchanged/);
});

test('Move opens an exact full-list position dialog without add or remove chores and Undo restores it', async () => {
  const app = setup(null);
  await app.action('move', 'thor');
  assert.equal(app.node('#modal').open, true);
  const html = app.node('#modal-content').innerHTML;
  assert.match(html, /max="26"/);
  assert.match(html, /Save position/);
  assert.doesNotMatch(html, /unrank|Add to ranking/i);
  app.node('#position').value = '26';
  app.node('#rank-form').onsubmit({ preventDefault() {} });
  assert.equal(JSON.parse(app.getStored()).profiles[0].ranking.at(-1), 'thor');
  assert.equal(app.node('#modal').open, false);
  await app.action('undo');
  assert.deepEqual(JSON.parse(app.getStored()), core.createState(catalog));
});

test('watched action appends every list immediately and Undo restores the whole library', async () => {
  const app = setup(null);
  await app.action('watched-add', 'eternals');
  assert.ok(JSON.parse(app.getStored()).profiles.every(p => p.ranking.at(-1) === 'eternals'));
  assert.match(app.node('#toast').textContent, /every list/i);
  await app.action('undo');
  assert.deepEqual(JSON.parse(app.getStored()), core.createState(catalog));
});

test('share preview discloses all completion effects before importing, never replaces Everyone', () => {
  const app = setup(null);
  const fragment = '#ranking=' + encodeURIComponent(JSON.stringify({ version: 1, name: 'Everyone', ranking: ['eternals'] }));
  app.read(`importPreview(${JSON.stringify(fragment)})`);
  const html = app.node('#modal-content').innerHTML;
  assert.match(html, /new personal list/i);
  assert.match(html, /missing watched movies.*release order/i);
  assert.match(html, /newly watched movies.*every existing list/i);
  assert.match(html, /Everyone.*not replaced/i);
  assert.match(html, /Everyone \(shared\)/);
  assert.equal(app.writes.length, 0);
});
