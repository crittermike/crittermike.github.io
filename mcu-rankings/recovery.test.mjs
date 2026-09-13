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
      classList: { add() {}, remove() {} }, addEventListener() {}, focus() {},
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
    document: { querySelector: node, activeElement: null,
      createElement() { return { click() {} }; } },
    Blob, URL: { createObjectURL(blob) { downloads.push(blob); return 'blob:test'; }, revokeObjectURL() {} },
    setTimeout() {}, clearTimeout() {}
  });
  vm.runInContext(source, context, { filename: 'app.js' });
  vm.runInContext('catalog = testCatalog; storage = testStorage; const loaded = core.loadSaved(storage, catalog); session = { state: loaded.state, previous: null }; raw = loaded.raw; blocked = loaded.blocked;', context);
  return { node, writes, downloads, storage,
    setStored(value) { stored = value; }, getStored() { return stored; },
    action(name) { return vm.runInContext(`action({ dataset: { action: ${JSON.stringify(name)} } })`, context); },
    read(expression) { return vm.runInContext(expression, context); },
    confirm() { node('#confirm-action').onclick(); }
  };
}
const newerRaw = () => JSON.stringify(core.rankMovie(core.createState(catalog), 'nancy', 'thor', 1));

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
