// Unit tests for the comparison page's data and pure logic.
// Run: node --test family-vehicle-comparison/tests/*.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const read = (f) => readFileSync(new URL('../' + f, import.meta.url), 'utf8');
const dataJs = read('data.js');

function loadCore() {
  const ctx = { console };
  vm.createContext(ctx);
  vm.runInContext(dataJs, ctx);
  return ctx.VC;
}

test('vehicle records: unique ids, all 2025, exact trims', () => {
  const { VEHICLES } = loadCore();
  assert.equal(VEHICLES.length, 28);
  const ids = VEHICLES.map(v => v.id);
  assert.equal(new Set(ids).size, VEHICLES.length);
  for (const v of VEHICLES) assert.equal(v.year, 2025, v.id);
  const expect = {
    odyssey: [2025, 'Honda', 'Odyssey', 'EX-L', 'van', 'gas', 8],
    sienna: [2025, 'Toyota', 'Sienna', 'Limited FWD', 'van', 'hybrid', 7],
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
    assert.ok(v.used && v.used.low > 0 && v.used.low <= v.used.high && v.used.source.url, `${id} needs a used-price estimate`);
    assert.equal(v.price.typical, Math.round((v.used.low + v.used.high) / 2), `${id} ranks by the used-price midpoint`);
    assert.equal(v.price.dest, 0, `${id} has no new-car destination charge`);
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
  assert.deepEqual(ids({ type: 'all', power: 'all' }).length, 28);
  assert.deepEqual(ids({ type: 'van', power: 'all' }), ['odyssey', 'sienna', 'carnival', 'pacifica', 'pacifica-hybrid', 'voyager', 'idbuzz']);
  assert.deepEqual(ids({ type: 'suv', power: 'ev' }), ['ev9', 'ex90', 'r1s']);
  assert.deepEqual(ids({ type: 'all', power: 'hybrid' }), ['sienna', 'carnival', 'grand-highlander', 'tx500h', 'sequoia']);
  assert.deepEqual(ids({ power: 'phev' }), ['pacifica-hybrid', 'tx550h', 'cx90-phev', 'xc90-t8']);
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

test('EV9 Wind is not credited with the exterior V2L outlet', () => {
  const { VEHICLES } = loadCore();
  const ev9 = VEHICLES.find(v => v.id === 'ev9');
  const text = JSON.stringify(ev9).toLowerCase();
  assert.ok(!/exterior v2l/.test(text) || /not on wind|higher trims/.test(text));
});

test('ownershipCost adds used purchase estimate and energy over the years', () => {
  const { VEHICLES, ownershipCost, annualEnergyCost } = loadCore();
  const a = { miles: 12000, gas: 3.25, elec: 0.15 };
  const ody = VEHICLES.find(v => v.id === 'odyssey');
  assert.equal(ownershipCost(ody, a, 8), ody.price.typical + annualEnergyCost(ody, a) * 8);
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
  assert.equal(u.fridge, 'sienna');
  assert.equal(u.cabinCam, undefined);
  assert.equal(u.vacuum, undefined);
  assert.equal(u.booster, 'ex90');
});

test('flat load floor filter excludes Sienna and Sequoia', () => {
  const { VEHICLES, filterVehicles, flatFloor } = loadCore();
  const out = Array.from(VEHICLES.filter(v => !flatFloor(v)), v => v.id);
  assert.deepEqual(out, ['sienna', 'sequoia']);
  assert.equal(filterVehicles(VEHICLES, { flat: true }).length, 26);
});

test('discovery starts small, searches every group, and preserves other filters', () => {
  const { VEHICLES, discoverVehicles, filterVehicles } = loadCore();
  const ids = (list, state) => Array.from(discoverVehicles(list, state), v => v.id);
  assert.deepEqual(ids(VEHICLES), ['carnival', 'grand-highlander', 'ev9', 'tx500h']);
  assert.deepEqual(ids(VEHICLES, { browse: 'start', query: '  LEXUS ' }), ['tx500h', 'tx550h']);
  assert.deepEqual(ids(VEHICLES, { browse: 'phev' }), ['pacifica-hybrid', 'tx550h', 'cx90-phev', 'xc90-t8']);
  assert.equal(ids(VEHICLES, { browse: 'all' }).length, VEHICLES.length);
  assert.equal(ids(VEHICLES, { query: 'no such vehicle' }).length, 0);
  const vans = filterVehicles(VEHICLES, { type: 'van' });
  assert.deepEqual(ids(vans, { query: 'Lexus' }), []);
});

test('added candidates keep estimates and unknown equipment explicit', () => {
  const { VEHICLES, feature, annualEnergyCost, rangeMiles } = loadCore();
  const addedIds = ['tx500h', 'tx550h', 'cx90-phev', 'xc90-t8', 'x7', 'gls', 'suburban', 'yukon-xl', 'sequoia'];
  const added = VEHICLES.filter(v => addedIds.includes(v.id));
  assert.equal(added.length, 9);
  assert.equal(VEHICLES.filter(v => v.provisional).map(v => v.id).join(), 'xc90-t8,x7,yukon-xl,sequoia');
  for (const v of added) {
    assert.ok(v.price.typical > 0 && v.price.sources.length > 0, v.id);
    assert.ok(v.space.cargo1 > 0 && v.pros.length && v.cons.length, v.id);
    assert.ok(Number.isFinite(annualEnergyCost(v, { miles: 12000, gas: 3.25, elec: 0.15 })), v.id);
    assert.ok(Number.isFinite(rangeMiles(v)), v.id);
    assert.equal(feature(v, 'cabinCam').s, 'q', 'unknown is not silently marked absent');
  }
  assert.equal(VEHICLES.find(v => v.id === 'tx500h').seats, 6);
  assert.equal(VEHICLES.find(v => v.id === 'tx550h').seats, 6);
  assert.equal(VEHICLES.find(v => v.id === 'cx90-phev').space.tow, 3500);
  assert.match(feature(VEHICLES.find(v => v.id === 'yukon-xl'), 'screens').text, /16.8/);
});

test('PHEV costs split miles between electricity and gas using the EPA utility factor', () => {
  const { VEHICLES, annualEnergyCost } = loadCore();
  for (const v of VEHICLES.filter(v => v.power === 'phev')) {
    assert.ok(v.electricShare > 0 && v.electricShare < 1 && v.kwhPer100 > 0, v.id);
  }
  const pac = VEHICLES.find(v => v.id === 'pacifica-hybrid');
  // 39.1% of 12,000 mi at 30 mpg and $4 + 60.9% at 41 kWh/100 mi and $0.15
  assert.equal(Math.round(annualEnergyCost(pac, { miles: 12000, gas: 4, elec: 0.15 })), 1075);
  assert.ok(Number.isNaN(annualEnergyCost(pac, { miles: 12000, gas: 4, elec: NaN })));
});

test('numeric filters apply max and min limits', () => {
  const { VEHICLES, filterVehicles, annualEnergyCost } = loadCore();
  const a = { miles: 12000, gas: 3.25, elec: 0.15, years: 8 };
  const total = (v) => v.price.typical + (v.price.dest || 0);
  const under60 = filterVehicles(VEHICLES, { num: { price: 60000 } }, a);
  assert.ok(under60.length > 0 && under60.every(v => total(v) <= 60000));
  assert.ok(VEHICLES.filter(v => total(v) <= 60000).length === under60.length);
  const cheapRun = filterVehicles(VEHICLES, { num: { energy: 1500 } }, a);
  assert.ok(cheapRun.length > 0 && cheapRun.every(v => annualEnergyCost(v, a) <= 1500));
  assert.ok(filterVehicles(VEHICLES, { num: { cargo1: 140 } }, a).every(v => v.space.cargo1 >= 140));
  assert.equal(filterVehicles(VEHICLES, { num: { price: NaN } }, a).length, VEHICLES.length);
});

test('feature filters: standard, this trim, any trim', () => {
  const { VEHICLES, filterVehicles, feature } = loadCore();
  const ids = (f) => Array.from(filterVehicles(VEHICLES, f), v => v.id);
  assert.deepEqual(ids({ feat: { fridge: 'avail' } }), ['sienna']);
  assert.deepEqual(ids({ feat: { fridge: 'std' } }), []);
  const anyTrim = ids({ feat: { ventFront: 'trim' } });
  assert.ok(anyTrim.includes('odyssey') && !ids({ feat: { ventFront: 'avail' } }).includes('odyssey'));
  assert.ok(ids({ feat: { remove2: 'std', heat2: 'trim' } }).every(id => feature(VEHICLES.find(v => v.id === id), 'remove2').s === 's'));
  assert.equal(ids({ feat: { fridge: 'any' } }).length, VEHICLES.length);
});

test('IIHS filter', () => {
  const { VEHICLES, filterVehicles } = loadCore();
  assert.ok(filterVehicles(VEHICLES, { iihs: 'tspplus' }).every(v => v.iihs === 'TSP+'));
  assert.ok(filterVehicles(VEHICLES, { iihs: 'tsp' }).every(v => ['TSP', 'TSP+'].includes(v.iihs)));
});
