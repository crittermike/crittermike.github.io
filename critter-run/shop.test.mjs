// Shop items must match their model files: a missing file or misspelled material silently breaks a purchase.
// Run: node --test critter-run/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { RUNNERS, WEAPONS } from './js/items.js';

const here = path.dirname(fileURLToPath(import.meta.url));

// Reads the JSON chunk of a .glb. Node names are cleaned up the way three.js's loader does ("Fist.R" -> "FistR").
function glb(file) {
  const b = fs.readFileSync(path.join(here, 'assets', file));
  assert.equal(b.toString('utf8', 0, 4), 'glTF', `${file} is not a .glb`);
  const json = JSON.parse(b.toString('utf8', 20, 20 + b.readUInt32LE(12)));
  const nodes = new Set((json.nodes || []).map(n => (n.name || '').replace(/\s/g, '_').replace(/[[\].:/]/g, '')));
  return { json, nodes };
}

test('every runner has a model with the materials it recolors', () => {
  for (const r of RUNNERS) {
    const { json } = glb(`runners/${r.id}.glb`);
    const mats = new Set((json.materials || []).map(m => m.name));
    for (const name of Object.keys(r.tint || {})) assert.ok(mats.has(name), `${r.id}.glb has no material named ${name}`);
  }
});

test('every blaster is in blasters.glb', () => {
  const { nodes } = glb('blasters.glb');
  for (const w of WEAPONS) assert.ok(nodes.has(w.id), `blasters.glb has no node named ${w.id}`);
});
