// Shop items and chasers must match their model files: a missing file or clip silently breaks the game.
// Run: node --test critter-run/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { RUNNERS, WEAPONS } from './js/items.js';
import { CHASERS } from './js/catalog.js';

const here = path.dirname(fileURLToPath(import.meta.url));

// Reads the JSON chunk of a .glb. Node names are cleaned up the way three.js's loader does ("Fist.R" -> "FistR").
function glb(file) {
  const b = fs.readFileSync(path.join(here, 'assets', file));
  assert.equal(b.toString('utf8', 0, 4), 'glTF', `${file} is not a .glb`);
  const json = JSON.parse(b.toString('utf8', 20, 20 + b.readUInt32LE(12)));
  const nodes = new Set((json.nodes || []).map(n => (n.name || '').replace(/\s/g, '_').replace(/[[\].:/]/g, '')));
  return { json, nodes };
}

test('every runner has a model with a right hand to hold the blaster', () => {
  for (const r of RUNNERS) assert.ok(glb(`runners/${r.id}.glb`).nodes.has('hand_r'), `runners/${r.id}.glb has no hand_r bone`);
});

test('the shared animation file has every clip the runners use', () => {
  // Keep in step with CLIPS in js/actors.js.
  const clips = new Set((glb('runners/anims.glb').json.animations || []).map(a => a.name));
  for (const c of ['Sprint_Loop', 'Jump_Loop', 'Slide_Loop', 'Idle_Loop', 'Victory', 'Dance_Loop', 'Pistol_Shoot', 'Death01', 'Hit_Chest']) assert.ok(clips.has(c), `anims.glb has no ${c} clip`);
});

test('every animal chaser has a model with a run cycle', () => {
  for (const c of CHASERS.filter(c => c !== 'hurricane')) {
    const names = (glb(`chasers/${c}.glb`).json.animations || []).map(a => a.name);
    assert.ok(names.some(n => /run|swim/i.test(n)), `chasers/${c}.glb has no run or swim clip`);
  }
});

test('every blaster is in blasters.glb', () => {
  const { nodes } = glb('blasters.glb');
  for (const w of WEAPONS) assert.ok(nodes.has(w.id), `blasters.glb has no node named ${w.id}`);
});
