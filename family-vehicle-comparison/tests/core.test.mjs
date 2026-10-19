// Unit tests for the comparison page's data and pure logic.
// Run: node --test family-vehicle-comparison/tests/*.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const read = (f) => readFileSync(new URL('../' + f, import.meta.url), 'utf8');
const html = read('index.html');
const dataJs = read('data.js');

function loadCore() {
  const ctx = { console };
  vm.createContext(ctx);
  vm.runInContext(dataJs, ctx);
  return ctx.VC;
}

test('vehicle records: unique ids, all 2025, exact trims', () => {
  const { VEHICLES } = loadCore();
  assert.equal(VEHICLES.length, 18);
  const ids = VEHICLES.map(v => v.id);
  assert.equal(new Set(ids).size, 18);
  for (const v of VEHICLES) assert.equal(v.year, 2025, v.id);
  const expect = {
    odyssey: [2025, 'Honda', 'Odyssey', 'EX-L', 'van', 'gas', 8],
    carnival: [2025, 'Kia', 'Carnival Hybrid', 'EX FWD', 'van', 'hybrid', 8],
    'grand-highlander': [2025, 'Toyota', 'Grand Highlander Hybrid', 'Limited AWD', 'suv', 'hybrid', 7],
    ev9: [2025, 'Kia', 'EV9', 'Wind AWD', 'suv', 'ev', 7],
    ex90: [2025, 'Volvo', 'EX90', 'Plus Twin Motor AWD', 'suv', 'ev', 7],
    xc90: [2025, 'Volvo', 'XC90', 'B5 AWD Plus', 'suv', 'gas', 7],
    telluride: [2025, 'Kia', 'Telluride', 'SX AWD', 'suv', 'gas', 8],
    palisade: [2025, 'Hyundai', 'Palisade', 'SEL Premium AWD', 'suv', 'gas', 7],
    pilot: [2025, 'Honda', 'Pilot', 'EX-L AWD', 'suv', 'gas', 8],
    cx90: [2025, 'Mazda', 'CX-90', '3.3 Turbo Premium Plus', 'suv', 'gas', 7],
  };
  for (const [id, [year, make, model, trim, type, power, seats]] of Object.entries(expect)) {
    const v = VEHICLES.find(x => x.id === id);
    assert.ok(v, `missing ${id}`);
    assert.deepEqual([v.year, v.make, v.model, v.trim, v.type, v.power, v.seats],
      [year, make, model, trim, type, power, seats], id);
    assert.ok(v.pros.length >= 2 && v.cons.length >= 2, `${id} needs pros and cons`);
    assert.ok(v.interior.length >= 1 && v.interior.some(p => /dash/.test(p.src)), `${id} needs a dashboard photo`);
    assert.ok(v.price && v.price.typical > 0 && v.price.sources.length >= 1, `${id} needs a sourced price`);
    assert.ok(v.photo && v.photo.src && v.photo.alt.length > 20 && v.photo.credit && v.photo.page, `${id} photo + credit`);
  }
});

test('EPA efficiency figures match fueleconomy.gov', () => {
  const { VEHICLES } = loadCore();
  const by = Object.fromEntries(VEHICLES.map(v => [v.id, v]));
  assert.equal(by.odyssey.mpg, 22);
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
  assert.deepEqual(ids({ type: 'all', power: 'all' }).length, 18);
  assert.deepEqual(ids({ type: 'van', power: 'all' }), ['odyssey', 'carnival', 'pacifica', 'pacifica-hybrid', 'voyager', 'idbuzz']);
  assert.deepEqual(ids({ type: 'suv', power: 'ev' }), ['ev9', 'ex90', 'r1s']);
  assert.deepEqual(ids({ type: 'all', power: 'hybrid' }), ['carnival', 'pacifica-hybrid', 'grand-highlander']);
  assert.deepEqual(ids({ type: 'van', power: 'ev' }), ['idbuzz']);
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
  for (const f of ['index.html', 'styles.css', 'data.js', 'app.js']) assert.equal((read(f).match(/[\u2013\u2014\u2212]/g) || []).length, 0, f);
  assert.equal((html.match(/ - /g) || []).length, 0, 'no spaced-hyphen dash substitutes');
});

test('EV9 Wind is not credited with the exterior V2L outlet', () => {
  const { VEHICLES } = loadCore();
  const ev9 = VEHICLES.find(v => v.id === 'ev9');
  const text = JSON.stringify(ev9).toLowerCase();
  assert.ok(!/exterior v2l/.test(text) || /not on wind|higher trims/.test(text));
});

test('ownershipCost adds destination and energy over the years', () => {
  const { VEHICLES, ownershipCost, annualEnergyCost } = loadCore();
  const a = { miles: 12000, gas: 3.25, elec: 0.15 };
  const ody = VEHICLES.find(v => v.id === 'odyssey');
  assert.equal(ownershipCost(ody, a, 8), 42220 + 1450 + annualEnergyCost(ody, a) * 8);
  assert.ok(Number.isNaN(ownershipCost(ody, { miles: -1, gas: 3 }, 8)));
});

test('scoreVehicles follows the weights', () => {
  const { VEHICLES, scoreVehicles } = loadCore();
  const a = { miles: 12000, gas: 3.25, elec: 0.15, years: 8 };
  const only = (k) => scoreVehicles(VEHICLES, a, { price: 0, energy: 0, space: 0, features: 0, safety: 0, [k]: 1 });
  assert.equal(only('price')[0].id, 'voyager');
  assert.ok(['ev9', 'idbuzz'].includes(only('energy')[0].id));
  assert.equal(VEHICLES.find(v => v.id === only('safety')[0].id).iihs, 'TSP+');
  assert.equal(only('price')[0].score, 100);
});

test('feature table flags single-vehicle features', () => {
  const { VEHICLES, uniqueFeatures } = loadCore();
  const u = uniqueFeatures(VEHICLES);
  assert.equal(u.fridge, undefined);
  assert.equal(u.cabinCam, undefined);
  assert.equal(u.vacuum, 'pacifica');
  assert.equal(u.booster, 'ex90');
});

test('every vehicle can clear the 2nd row and fold the 3rd row flat', () => {
  const { VEHICLES, feature } = loadCore();
  for (const v of VEHICLES) {
    assert.ok(feature(v, 'remove2').s === 's' || feature(v, 'flat2').s === 's', `${v.id} 2nd row`);
    assert.equal(feature(v, 'flat3').s, 's', `${v.id} 3rd row`);
  }
});
