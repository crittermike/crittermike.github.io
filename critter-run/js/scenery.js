// Real scenery for each region: trees, shrubs, rocks, flowers and landmarks (GLB models in assets/nature, see
// assets/CREDITS.md) scattered on the land beside the trail. Each region's models load once, before its first run.
// A rule places `n` copies per 30 m chunk at a distance x from the trail center (both sides unless `side` is set),
// with a random size and spin; `gap` keeps big things from overlapping.
import { loadModel, instances } from './props.js';
import { PATH_W } from './terrain.js';

const T = 'shared';
// name -> [folder, options for loadModel]
export const MODELS = {
  spruceTall: ['mountains/tree_spruce_tall', { sway: 0.35 }],
  spruce: ['mountains/tree_spruce_medium', { sway: 0.35 }],
  hemlock: ['mountains/tree_hemlock', { sway: 0.4 }],
  whitePine: ['mountains/tree_white_pine', { sway: 0.35 }],
  rhodo: ['mountains/tree_rhododendron', { sway: 0.5 }],
  fern: ['mountains/fern_set', { sway: 0.8 }],
  mossyRocks: ['mountains/rocks_mossy_large_set', {}],
  mossyStones: ['mountains/rocks_mossy_small_set', {}],
  ledge: ['mountains/rock_outcrop_ledge', {}],
  oak: ['foothills/tree_oak_large', { sway: 0.3 }],
  maple: ['foothills/tree_maple_green', { sway: 0.35 }],
  mapleRed: ['foothills/tree_maple_autumn', { sway: 0.35 }],
  peach: ['foothills/tree_peach_tree', { sway: 0.4 }],
  cliffFall: ['foothills/cliff_waterfall_face', {}],
  longleaf: ['sandhills/tree_longleaf_pine', { sway: 0.3 }],
  scrubOak: ['sandhills/tree_scrub_oak', { sway: 0.45 }],
  sandRocks: ['sandhills/rock_cluster_sandstone', {}],
  sandBlock: ['sandhills/rock_sandstone_block', {}],
  sandFlat: ['sandhills/rock_sandstone_flat', {}],
  pole: ['sandhills/power_pole', {}],
  dam: ['sandhills/dam_hydro', {}],
  shadeOak: ['farmland/tree_shade_oak', { sway: 0.3 }],
  barn: ['farmland/barn_red', {}],
  barnOld: ['farmland/barn_old', {}],
  silo: ['farmland/silo', {}],
  tractor: ['farmland/tractor', {}],
  hayRound: ['farmland/hay_bale_round', {}],
  hayRoll: ['farmland/hay_roll', {}],
  haySquare: ['farmland/hay_bale_square', {}],
  hayStack: ['farmland/hay_stack', {}],
  fence: ['farmland/fence_panel', { tint: '#a39a90' }],
  cypress: ['swamp/tree_bald_cypress', { sway: 0.3 }],
  tupelo: ['swamp/tree_tupelo', { sway: 0.35 }],
  snag: ['swamp/tree_dead_snag', {}],
  cattails: ['swamp/cattails', { sway: 0.9 }],
  reeds: ['swamp/reeds', { sway: 0.9 }],
  lily: ['swamp/lily_pad', {}],
  rowboat: ['swamp/rowboat', {}],
  palmTall: ['beach/palm_tall', { sway: 0.25 }],
  palmCoco: ['beach/palm_coconut', { sway: 0.3 }],
  palmetto: ['beach/palmetto_cabbage', { sway: 0.3 }],
  palmettoShrub: ['beach/palmetto_shrub', { sway: 0.5 }],
  umbrella: ['beach/beach_umbrella', {}],
  chair: ['beach/beach_chair', {}],
  ball: ['beach/beach_ball', {}],
  castle: ['beach/sand_castle', {}],
  cooler: ['beach/cooler', {}],
  lifeguard: ['beach/lifeguard_tower', {}],
  beachHouse: ['beach/beach_house', {}],
  lighthouse: ['beach/lighthouse_stone', {}],
  pier: ['beach/pier_dock', {}],
  trawler: ['beach/shrimp_trawler', {}],
  shrimpBoat: ['beach/shrimp_boat_stylized', {}],
  cargo: ['beach/cargo_ship', {}],
  net: ['beach/volleyball_net', {}],
  boulder: [T + '/rock_boulder_granite', {}],
  stump: [T + '/stump_mossy_a', {}],
  stumpB: [T + '/stump_mossy_b', {}],
  logBig: [T + '/log_fallen_scan', {}],
  log: [T + '/log_obstacle', {}],
  logPile: [T + '/log_pile', {}],
  logOver: [T + '/overhead_log_on_rocks', {}],
  banner: [T + '/banner_overhead', {}],
  barrel: [T + '/barrel_wood', {}],
  crate: [T + '/crate_wood', {}],
  flowers: [T + '/flowers_celandine_set', { sway: 0.6 }],
  mossBranch: ['swamp/moss_branch_overhead', { sway: 0.4 }],
  liveOak: ['swamp/tree_live_oak_moss', { sway: 0.3 }],
  cotton: ['farmland/crop_row_cotton', { sway: 0.4 }],
  soybean: ['farmland/crop_row_soybean', { sway: 0.4 }],
  boomModel: ['farmland/irrigation_boom_overhead', {}],
  pipeModel: [T + '/pipe_overhead', {}],
  logStack: [T + '/log_stack_tall', {}],
  textileMill: ['foothills/textile_mill', {}],
};

// m: model name or list (picked at random). x: [near, far] distance from the trail center. s: size range.
// side: -1 left only, 1 right only. gap: keep-clear radius for this item. keep(x, z) can veto a spot.
const R = (m, n, x, s, more = {}) => ({ m, n, x, s, ...more });
export const SCENERY = {
  mountains: [
    R(['spruceTall', 'spruce', 'hemlock', 'whitePine'], [6, 9], [8.5, 44], [0.7, 1.05], { gap: 4.5, bias: 1.4 }),
    R(['spruce', 'hemlock'], [2, 4], [44, 90], [0.9, 1.2], { gap: 6 }),
    R('rhodo', [2, 4], [6.2, 16], [0.6, 1.0], { gap: 2.5 }),
    R('fern', [5, 9], [5.0, 13], [1.0, 1.6]),
    R('mossyStones', [1, 3], [5.5, 14], [0.5, 0.9], { gap: 2 }),
    R('mossyRocks', [0, 2], [10, 30], [0.8, 1.6], { gap: 4 }),
    R('ledge', [0, 1], [22, 34], [0.6, 0.9], { gap: 12, chance: 0.35 }),
    R('flowers', [3, 6], [4.6, 9], [1.2, 2.0]),
  ],
  // (Waterfall cliffs are placed by the world itself; see World.addCliffFall.)
  foothills: [
    R(['oak', 'maple', 'mapleRed'], [3, 6], [9, 42], [0.55, 0.85], { gap: 6, bias: 1.3 }),
    R('peach', [0, 4], [7.5, 16], [0.8, 1.05], { gap: 4, orchard: true }),
    R('fence', [17, 17], [5.3, 5.3], [1, 1], { rows: true, chance: 0.55 }),
    R('mossyStones', [0, 2], [5.5, 12], [0.4, 0.7], { gap: 2 }),
    R('flowers', [4, 7], [4.6, 10], [1.2, 2.0]),
    R('textileMill', [1, 1], [46, 54], [0.6, 0.7], { gap: 30, chance: 0.22, face: true }),
  ],
  sandhills: [
    R('longleaf', [4, 7], [8.5, 46], [0.7, 1.0], { gap: 4.5, bias: 1.2 }),
    R('scrubOak', [2, 4], [6.5, 22], [0.6, 1.0], { gap: 3 }),
    R(['sandRocks', 'sandFlat'], [1, 3], [5.5, 16], [0.7, 1.3], { gap: 2.5 }),
    R('sandBlock', [0, 1], [12, 30], [0.8, 1.4], { gap: 4 }),
    R('pole', [1, 1], [11, 11], [1.15, 1.15], { poles: true, chance: 0.5 }),
    R('dam', [1, 1], [60, 70], [0.6, 0.6], { gap: 30, chance: 0.12, face: true }),
  ],
  farmland: [
    // Rows of cotton or soybeans fill the fields on each side, running alongside the trail.
    R(['cotton', 'soybean'], [1, 1], [7, 24], [1, 1], { field: 1.45 }),
    R('shadeOak', [1, 2], [30, 55], [0.6, 0.85], { gap: 10 }),
    R(['barn', 'barnOld'], [1, 1], [30, 36], [0.85, 1], { gap: 14, chance: 0.5, face: true }),
    R('silo', [1, 1], [38, 42], [0.8, 0.9], { gap: 8, chance: 0.4 }),
    R('tractor', [1, 1], [8, 16], [0.75, 0.85], { gap: 5, chance: 0.3 }),
    R(['hayRound', 'hayRoll'], [1, 3], [6.2, 10], [0.7, 0.9], { gap: 2.5 }),
    R('fence', [17, 17], [5.3, 5.3], [1, 1], { rows: true, chance: 0.4 }),
  ],
  swamp: [
    // Cypress and tupelo grow right out of the water.
    R(['cypress', 'cypress', 'tupelo'], [5, 8], [6.5, 40], [0.55, 0.85], { gap: 4.5, bias: 1.3, any: true }),
    R('liveOak', [0, 2], [12, 40], [0.55, 0.75], { gap: 9 }),
    R('snag', [0, 1], [8, 25], [0.6, 0.9], { gap: 4, any: true }),
    R(['cattails', 'reeds'], [4, 8], [4.4, 12], [0.8, 1.2]),
    R('lily', [6, 12], [5, 20], [0.8, 1.6], { water: true }),
    R(['stump', 'stumpB'], [0, 2], [6, 18], [0.6, 1.0], { gap: 2 }),
    R('rowboat', [1, 1], [9, 16], [1, 1], { gap: 4, chance: 0.15, water: true }),
  ],
  beach: [
    R(['palmetto', 'palmTall', 'palmCoco'], [3, 5], [7, 30], [0.65, 1.0], { side: -1, gap: 4 }),
    R('palmettoShrub', [2, 4], [5.5, 14], [0.7, 1.1], { side: -1, gap: 2 }),
    R(['umbrella', 'chair', 'ball', 'cooler', 'castle'], [1, 3], [5.0, 8.5], [0.9, 1.1], { side: -1, gap: 2.2 }),
    R('lifeguard', [1, 1], [8, 10], [0.8, 0.8], { side: -1, gap: 4, chance: 0.2 }),
    R('beachHouse', [1, 1], [24, 32], [0.8, 0.9], { side: -1, gap: 12, chance: 0.4, face: true }),
    R('lighthouse', [1, 1], [26, 30], [0.75, 0.75], { side: -1, gap: 12, chance: 0.08 }),
    R(['trawler', 'shrimpBoat'], [1, 1], [18, 40], [0.8, 1], { side: 1, gap: 12, chance: 0.4, water: true }),
    R('cargo', [1, 1], [120, 160], [0.8, 0.8], { side: 1, gap: 40, chance: 0.25, water: true, face: true }),
    R('pier', [1, 1], [7.5, 7.5], [1, 1], { side: 1, chance: 0.15, face: true }),
  ],
};

const FAR = 24;
const loaded = new Map();
// Loads every model a region's scenery and obstacles use. Resolves when they're ready (failures are skipped).
const EXTRA = { mountains: ['cliffFall'], foothills: ['cliffFall'] };
export function prepareBiome(biome, extra = []) {
  const names = new Set([...(SCENERY[biome] || []).flatMap(r => [].concat(r.m)), ...(EXTRA[biome] || []), ...extra]);
  return Promise.all([...names].map(n => model(n).catch(() => null)));
}
export function model(name) {
  if (!loaded.has(name)) {
    const [file, opts] = MODELS[name];
    loaded.set(name, loadModel(`./assets/nature/${file}.glb`, opts).then(m => { loaded.set(name, m); return m; }));
  }
  const m = loaded.get(name);
  return m instanceof Promise ? m : Promise.resolve(m);
}
// The model if it has finished loading, else null.
export const ready = name => { const m = loaded.get(name); return m && !(m instanceof Promise) ? m : null; };

// Crop rows on both sides of the trail: each row is a 12 m strip laid end to end along the trail. One crop per side.
function field(rule, z0, chunkLen, r, heightAt, placed) {
  for (const side of [-1, 1]) {
    const names = [].concat(rule.m), name = names[Math.floor(r() * names.length)], m = ready(name);
    if (!m) continue;
    const len = m.size.x;
    for (let x = rule.x[0]; x <= rule.x[1]; x += rule.field) {
      for (let z = z0 - len / 2 - (Math.abs(x) % 3); z > z0 - chunkLen - len / 2; z -= len) {
        if (!placed.has(name)) placed.set(name, []);
        placed.get(name).push({ x: side * x, y: heightAt(side * x, z) - 0.02, z, rot: Math.PI / 2, scale: 1 });
      }
    }
  }
}

// Scatters one chunk's scenery. Returns the meshes to add to the scene.
export function scatter(biome, z0, chunkLen, r, heightAt, isWater) {
  const placed = new Map(), taken = [];
  const free = (x, z, gap) => taken.every(([tx, tz, tg]) => (tx - x) ** 2 + (tz - z) ** 2 > Math.max(gap, tg) ** 2);
  for (const rule of SCENERY[biome] || []) {
    if (rule.chance != null && r() > rule.chance) continue;
    if (rule.field) { field(rule, z0, chunkLen, r, heightAt, placed); continue; }
    const n = Math.round(rule.n[0] + r() * (rule.n[1] - rule.n[0]));
    const side = rule.side || (r() < 0.5 ? -1 : 1);
    for (let i = 0; i < n; i++) {
      const names = [].concat(rule.m), name = names[Math.floor(r() * names.length)];
      const m = ready(name);
      if (!m) continue;
      const s = rule.side ? rule.side : rule.rows || rule.poles || rule.orchard ? side : (r() < 0.5 ? -1 : 1);
      let x, z;
      if (rule.rows || rule.poles) { x = s * rule.x[0]; z = z0 - (i + 0.5) * (chunkLen / n); }
      else if (rule.orchard) { x = s * (rule.x[0] + (i % 2) * 4.5); z = z0 - 4 - Math.floor(i / 2) * 7.5 - r(); }
      else {
        const t = Math.pow(r(), rule.bias || 1);
        x = s * (rule.x[0] + t * (rule.x[1] - rule.x[0]));
        z = z0 - r() * chunkLen;
      }
      if (Math.abs(x) < PATH_W + 0.6) continue;
      const gap = rule.gap || 0;
      if (gap && !free(x, z, gap)) continue;
      const wet = isWater(x, z);
      if (!rule.any && (rule.water ? !wet : wet && !rule.rows)) continue;
      const scale = rule.s[0] + r() * (rule.s[1] - rule.s[0]);
      // Things with a front (barns, houses, ships) turn to face the trail; everything else spins at random.
      const rot = rule.face ? (s < 0 ? Math.PI / 2 : -Math.PI / 2) + (r() - 0.5) * 0.3 : rule.rows ? Math.PI / 2 : r() * Math.PI * 2;
      const y = rule.water ? -0.04 : heightAt(x, z) - 0.05;
      if (gap) taken.push([x, z, gap]);
      if (!placed.has(name)) placed.set(name, []);
      placed.get(name).push({ x, y, z, rot, scale });
    }
  }
  // Things well away from the trail use the light version of their model and skip casting shadows
  // (the sun's shadow map only covers the trail and its edges anyway).
  const meshes = [];
  for (const [name, list] of placed) {
    const m = ready(name);
    const near = list.filter(p => Math.abs(p.x) < FAR), far = list.filter(p => Math.abs(p.x) >= FAR);
    meshes.push(...instances(m, near, { cast: m.height > 1, receive: true, lod: 0 }));
    meshes.push(...instances(m, far, { cast: false, receive: true, lod: 1 }));
  }
  return meshes;
}
