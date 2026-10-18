// Unit tests for the comparison page's data and pure logic.
// Run: node --test family-vehicle-comparison/tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

function loadCore() {
  const m = html.match(/<script id="vc-core">([\s\S]*?)<\/script>/);
  assert.ok(m, 'index.html must contain <script id="vc-core">');
  const ctx = { console };
  vm.createContext(ctx);
  vm.runInContext(m[1] + '\n;globalThis.VC = VC;', ctx);
  return ctx.VC;
}

test('six vehicle records with unique ids and the exact years and trims', () => {
  const { VEHICLES } = loadCore();
  assert.equal(VEHICLES.length, 6);
  const ids = VEHICLES.map(v => v.id);
  assert.equal(new Set(ids).size, 6);
  const expect = {
    odyssey: [2025, 'Honda', 'Odyssey', 'EX-L', 'van', 'gas', 8],
    sienna: [2025, 'Toyota', 'Sienna', 'Limited FWD', 'van', 'hybrid', 7],
    carnival: [2025, 'Kia', 'Carnival Hybrid', 'EX FWD', 'van', 'hybrid', 8],
    'grand-highlander': [2024, 'Toyota', 'Grand Highlander Hybrid', 'Limited AWD', 'suv', 'hybrid', 7],
    ev9: [2024, 'Kia', 'EV9', 'Wind AWD', 'suv', 'ev', 7],
    ex90: [2025, 'Volvo', 'EX90', 'Plus Twin Motor AWD', 'suv', 'ev', 7],
  };
  for (const [id, [year, make, model, trim, type, power, seats]] of Object.entries(expect)) {
    const v = VEHICLES.find(x => x.id === id);
    assert.ok(v, `missing ${id}`);
    assert.deepEqual([v.year, v.make, v.model, v.trim, v.type, v.power, v.seats],
      [year, make, model, trim, type, power, seats], id);
    assert.ok(v.daily.length >= 2, `${id} needs daily-life differences`);
    assert.ok(v.price && v.price.typical > 0 && v.price.sources.length >= 1, `${id} needs a sourced price`);
    assert.ok(v.photo && v.photo.src && v.photo.alt.length > 20 && v.photo.credit && v.photo.page, `${id} photo + credit`);
  }
});

test('EPA efficiency figures match fueleconomy.gov', () => {
  const { VEHICLES } = loadCore();
  const by = Object.fromEntries(VEHICLES.map(v => [v.id, v]));
  assert.equal(by.odyssey.mpg, 22);
  assert.equal(by.sienna.mpg, 36);
  assert.equal(by.carnival.mpg, 33);
  assert.equal(by['grand-highlander'].mpg, 34);
  assert.equal(by.ev9.kwhPer100, 41);
  assert.equal(by.ev9.range, 280);
  assert.equal(by.ex90.kwhPer100, 42);   // standard 20-inch wheels
  assert.equal(by.ex90.range, 300);
});

test('annual energy cost: gas uses miles / mpg * price', () => {
  const { VEHICLES, annualEnergyCost } = loadCore();
  const ody = VEHICLES.find(v => v.id === 'odyssey');
  const c = annualEnergyCost(ody, { miles: 8000, gas: 3.25, elec: 0.1547 });
  assert.equal(Math.round(c), Math.round(8000 / 22 * 3.25)); // 1182
});

test('annual energy cost: EV uses miles * kWh/100mi / 100 * rate', () => {
  const { VEHICLES, annualEnergyCost } = loadCore();
  const ev9 = VEHICLES.find(v => v.id === 'ev9');
  assert.equal(Math.round(annualEnergyCost(ev9, { miles: 8000, gas: 3.25, elec: 0.1547 })), 507);
  assert.equal(Math.round(annualEnergyCost(ev9, { miles: 8000, gas: 3.25, elec: 0.45 })), 1476);
});

test('annual energy cost rejects bad input by returning NaN', () => {
  const { VEHICLES, annualEnergyCost } = loadCore();
  assert.ok(Number.isNaN(annualEnergyCost(VEHICLES[0], { miles: -1, gas: 3.25, elec: 0.15 })));
  assert.ok(Number.isNaN(annualEnergyCost(VEHICLES[0], { miles: 8000, gas: NaN, elec: 0.15 })));
});

test('filterVehicles by type and powertrain', () => {
  const { VEHICLES, filterVehicles } = loadCore();
  // Spread into a test-realm array: vm-context arrays fail deepStrictEqual on prototype identity.
  // Normalize vm-created arrays into this test module's realm before strict comparison.
  const ids = (f) => Array.from(filterVehicles(VEHICLES, f), v => v.id);
  assert.deepEqual(ids({ type: 'all', power: 'all' }).length, 6);
  assert.deepEqual(ids({ type: 'van', power: 'all' }), ['odyssey', 'sienna', 'carnival']);
  assert.deepEqual(ids({ type: 'suv', power: 'ev' }), ['ev9', 'ex90']);
  assert.deepEqual(ids({ type: 'all', power: 'hybrid' }), ['sienna', 'carnival', 'grand-highlander']);
  assert.deepEqual(ids({ type: 'van', power: 'ev' }), []);
});

test('toggleCompare adds, removes and caps selection', () => {
  const { toggleCompare, MAX_COMPARE } = loadCore();
  let s = [];
  s = toggleCompare(s, 'odyssey');
  s = toggleCompare(s, 'ev9');
  assert.deepEqual(s, ['odyssey', 'ev9']);
  s = toggleCompare(s, 'odyssey');
  assert.deepEqual(s, ['ev9']);
  for (const id of ['a', 'b', 'c', 'd', 'e']) s = toggleCompare(s, id);
  assert.equal(s.length, MAX_COMPARE);
});

test('no em-dash or en-dash characters anywhere in the page', () => {
  assert.equal((html.match(/[\u2013\u2014]/g) || []).length, 0);
  assert.equal((html.match(/ - /g) || []).length, 0, 'no spaced-hyphen dash substitutes');
});

test('EV9 Wind is not credited with the exterior V2L outlet', () => {
  const { VEHICLES } = loadCore();
  const ev9 = VEHICLES.find(v => v.id === 'ev9');
  const text = JSON.stringify(ev9).toLowerCase();
  assert.ok(!/exterior v2l/.test(text) || /not on wind|higher trims/.test(text));
});
