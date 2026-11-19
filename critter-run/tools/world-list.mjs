// Props baked into assets/world.glb by build-world.mjs. key: [source file relative to the packs folder, options]
// s: uniform or [x,y,z] scale applied at bake time (pack native units -> meters).
// ry: Y rotation (radians) applied at bake time. tint: { materialName: '#hex' } recolors before baking.
// ds: duplicate faces back-to-back (thin double-sided parts like banners and sails).
// tex: force keeping the texture (detail that vertex colors can't carry). bake: force baking even if lossy.
const K = 'kaykit-forest-nature/';
const HX = 'kaykit-medieval-hexagon/';
const RB = 'kaykit-resource-bits/';
const PF = 'kaykit-platformer/';
const QP = 'quaternius-polypizza/';
const CB = 'polypizza-cc-by/';
const C0 = 'polypizza-cc0/';
const KN = 'kenney-nature-kit/';
const PI = 'kenney-pirate-kit/';
const WC = 'kenney-watercraft-kit/';
const FT = 'kenney-fantasy-town-kit/';
const SV = 'kenney-survival-kit/';
const HW = 'kaykit-halloween-bits/';

// Kenney Nature Kit uses a teal/orange palette; these make it read as natural.
const PINE = { leafsDark: '#2f6b3a', leafsGreen: '#3f8f45', woodBarkDark: '#6b4a32', woodBark: '#7a5534', wood: '#8a6440' };
const CROPS = { grass: '#5aa83f', leafsGreen: '#4f9e3a', leafsDark: '#3f8a35', corn: '#f2c84b', woodInner: '#c9a04a', _defaultMat: '#ecc965', dirt: '#7a5232', dirtDark: '#5e3f27' };

export const PROPS = {
  // ---------- shared nature (KayKit Forest) ----------
  treeRoundA: [K + 'Tree_1_A.glb'], treeRoundB: [K + 'Tree_1_B.glb'], treeRoundC: [K + 'Tree_1_C.glb'],
  treeUmbrellaA: [K + 'Tree_3_A.glb'], treeUmbrellaB: [K + 'Tree_3_B.glb'],
  pineA: [K + 'Tree_4_A.glb'], pineB: [K + 'Tree_4_B.glb'], pineC: [K + 'Tree_4_C.glb'],
  bareA: [K + 'Tree_Bare_1_A.glb'], bareB: [K + 'Tree_Bare_1_B.glb'],   bushC: [K + 'Bush_1_C.glb'], bushE: [K + 'Bush_1_E.glb'],
  bushLow: [K + 'Bush_3_B.glb'], scrubA: [K + 'Bush_4_B.glb'], scrubB: [K + 'Bush_4_D.glb'],
  grassA: [K + 'Grass_1_A.glb'], grassC: [K + 'Grass_1_C.glb'], grassTallA: [K + 'Grass_2_A.glb'], grassTallC: [K + 'Grass_2_C.glb'],
  rockSlab: [K + 'Rock_1_D.glb'], rockTallG: [K + 'Rock_1_G.glb'], cliffJ: [K + 'Rock_1_J.glb'], cliffK: [K + 'Rock_1_K.glb'], spireN: [K + 'Rock_1_N.glb'],
  boulderE: [K + 'Rock_2_E.glb'], rockA: [K + 'Rock_3_A.glb'], rockC: [K + 'Rock_3_C.glb'],
  rockE: [K + 'Rock_3_E.glb'], boulderH: [K + 'Rock_3_H.glb'], boulderK: [K + 'Rock_3_K.glb'],
  pineOrange: [HW + 'tree_pine_orange_large.glb'], pineYellow: [HW + 'tree_pine_yellow_medium.glb'], deadTree: [HW + 'tree_dead_large.glb'],
  pumpkin: [HW + 'pumpkin_orange.glb'],

  // ---------- KayKit medieval hexagon (x4) ----------
  lilyA: [HX + 'waterlily_A.glb', { s: 4 }], lilyB: [HX + 'waterlily_B.glb', { s: 4 }],
  reedsA: [HX + 'waterplant_A.glb', { s: 4 }], reedsB: [HX + 'waterplant_B.glb', { s: 4 }], cattails: [HX + 'waterplant_C.glb', { s: 4 }],
  cloudBig: [HX + 'cloud_big.glb', { s: 4 }], cloudSmall: [HX + 'cloud_small.glb', { s: 4 }],
  crate: [HX + 'crate_A_big.glb', { s: 4 }], crateOpen: [HX + 'crate_open.glb', { s: 4 }], barrel: [HX + 'barrel.glb', { s: 4 }],
  wheelbarrow: [HX + 'wheelbarrow.glb', { s: 4 }],
  pineClump: [HX + 'trees_B_large.glb', { s: 4 }],   
  // ---------- KayKit resource bits ----------
  logA: [RB + 'Wood_Log_A.glb'], logB: [RB + 'Wood_Log_B.glb'], logStack: [RB + 'Wood_Log_Stack.glb'],
  textiles: [RB + 'Textiles_Stack_Large_Colored.glb'], textilesB: [RB + 'Textiles_Stack_Large.glb'],   fuelBarrel: [RB + 'Fuel_A_Barrel.glb'],

  // ---------- Dino Island (Kenney Nature Kit, recolored per biome) ----------
  // Jungle: broad leafy plants, tall palms and canopy trees.
  jBush: [KN + 'plant_bushLarge.glb', { s: 3, tint: { grass: '#3f8f2e' } }], jBushBig: [KN + 'plant_bushDetailed.glb', { s: 3, tint: { grass: '#2f7a2a' } }],
  jFlat: [KN + 'plant_flatTall.glb', { s: 3.4, tint: { leafsGreen: '#4a9a35' } }], jLeafs: [KN + 'grass_leafsLarge.glb', { s: 3, tint: { grass: '#3c8a30' } }],
  jPalm: [KN + 'tree_palmDetailedTall.glb', { s: 3, tint: { woodBark: '#6b5038', leafsGreen: '#3d9a3a' } }],
  jCanopy: [KN + 'tree_plateau.glb', { s: 3, tint: { woodBark: '#5e4632', leafsGreen: '#2f7f35' } }],
  jTall: [KN + 'tree_tall.glb', { s: 3, tint: { woodBark: '#5e4632', leafsGreen: '#2a6b30' } }],
  // Canyon: red sandstone towers, boulders and cliffs.
  cTallA: [KN + 'rock_tallA.glb', { s: 3, tint: { dirt: '#c66a3e', grass: '#d8a463' } }], cTallB: [KN + 'rock_tallB.glb', { s: 3, tint: { dirt: '#b95c34', grass: '#d8a463' } }],
  cTallC: [KN + 'rock_tallC.glb', { s: 3, tint: { dirt: '#c97446', grass: '#dcae70' } }], cTallE: [KN + 'rock_tallE.glb', { s: 3, tint: { dirt: '#bf6439', grass: '#d8a463' } }],
  cLargeA: [KN + 'rock_largeA.glb', { s: 3, tint: { dirt: '#c46b40', grass: '#d8a463' } }], cLargeC: [KN + 'rock_largeC.glb', { s: 3, tint: { dirt: '#b85f38', grass: '#d8a463' } }],
  cCliff: [KN + 'cliff_large_rock.glb', { s: 3, tint: { dirt: '#b65a33' } }], cCliffTop: [KN + 'cliff_top_rock.glb', { s: 3, tint: { dirt: '#b65a33', grass: '#d39a5a' } }],
  // Ice age: pale blue ice and dark round pines (snow is added in the game).
  iceTallA: [KN + 'stone_tallA.glb', { s: 3, tint: { stone: '#cdeeff' } }], iceTallB: [KN + 'stone_tallB.glb', { s: 3, tint: { stone: '#bfe6fb' } }],
  iceLargeA: [KN + 'stone_largeA.glb', { s: 3, tint: { stone: '#d2f0ff' } }], iceLargeB: [KN + 'stone_largeB.glb', { s: 3, tint: { stone: '#c4e9fd' } }],
  iceSmall: [KN + 'stone_smallA.glb', { s: 3, tint: { stone: '#d8f2ff' } }],
  roundPineA: [KN + 'tree_pineRoundA.glb', { s: 3, tint: { leafsDark: '#2c5c4c', woodBarkDark: '#5a3f2e' } }],
  roundPineC: [KN + 'tree_pineRoundC.glb', { s: 3, tint: { leafsDark: '#2f6250', woodBarkDark: '#5a3f2e' } }],
  roundPineE: [KN + 'tree_pineRoundE.glb', { s: 3, tint: { leafsDark: '#285646', woodBarkDark: '#5a3f2e' } }],
  // Volcano: black lava rock.
  vTallA: [KN + 'rock_tallA.glb', { s: 3, tint: { dirt: '#3a3433', grass: '#4d2a20' } }], vTallB: [KN + 'rock_tallB.glb', { s: 3, tint: { dirt: '#34302f', grass: '#4d2a20' } }],
  vTallC: [KN + 'rock_tallC.glb', { s: 3, tint: { dirt: '#3d3634', grass: '#55301f' } }], vLargeA: [KN + 'rock_largeA.glb', { s: 3, tint: { dirt: '#383231', grass: '#4d2a20' } }],
  vLargeC: [KN + 'rock_largeC.glb', { s: 3, tint: { dirt: '#332e2d', grass: '#4d2a20' } }], vCliff: [KN + 'cliff_large_rock.glb', { s: 3, tint: { dirt: '#2f2a29' } }],
  logBig: [KN + 'log_large.glb', { s: 3, tint: { woodBark: '#6d5038', woodInner: '#c9a271' } }],

  // ---------- KayKit platformer (pickups, gates, pipes) ----------
  // Sky stage hoops and bombs, and the gems that carry numbers in the catch stage.
  hoopBlue: [PF + 'hoop_blue.glb'], hoopRed: [PF + 'hoop_red.glb'], hoopYellow: [PF + 'hoop_yellow.glb'],
  gemBlue: [PF + 'diamond_blue.glb'], gemGreen: [PF + 'diamond_green.glb'], gemRed: [PF + 'diamond_red.glb'], gemYellow: [PF + 'diamond_yellow.glb'],
  bomb: [PF + 'bomb.glb'],
  heart: [PF + 'heart_red.glb'], arch: [PF + 'arch_wide_yellow.glb'],   finish: [PF + 'signage_finish_wide.glb'], pipeYellow: [PF + 'pipe_straight_A_yellow.glb'], pipeRed: [PF + 'pipe_straight_A_red.glb'],
  strut: [PF + 'strut_vertical.glb'],   flagRed: [PF + 'flag_A_red.glb'], flagBlue: [PF + 'flag_A_blue.glb'],     coin: ['kaykit-prototype-bits/Coin_A.glb'],

  // ---------- Quaternius (farm, swamp, pickups) ----------
  barn: [QP + 'Barn.glb'], barnSmall: [QP + 'SmallBarn.glb'], barnOpen: [QP + 'OpenBarn.glb'], silo: [QP + 'Silo.glb'], siloHouse: [QP + 'SiloHouse.glb'],
  windmill: [QP + 'Windmill.glb'], waterTower: [QP + 'WaterTower.glb'], chickenCoop: [QP + 'ChickenCoop.glb'],
  fence: [QP + 'Fence.glb'], fenceRail: [QP + 'Fence_Rail.glb'], haySheaf: [QP + 'HaySheaf.glb'],
  corn: [QP + 'Corn.glb'], wheat: [QP + 'Wheat.glb'], willow: [QP + 'Willow.glb'], stumpMoss: [QP + 'TreeStump_Moss.glb'],
  logLong: [QP + 'WoodLog.glb'], logMoss: [QP + 'WoodLog_Moss.glb'], logPile: [QP + 'LogPile.glb'], lilyFlower: [QP + 'Lilypad.glb'],
  dockLong: [QP + 'Dock_Long.glb'], guardTower: [QP + 'GuardTower.glb'], mystery: [QP + 'MysteryBox.glb'],
  cactusTall: [QP + 'Cactus_Tall.glb'], treeAutumn: [QP + 'Tree_Autumn.glb'],
  treeColumn: [QP + 'Tree_Column.glb'], palm1: [QP + 'PalmTree_1.glb'], palm2: [QP + 'PalmTree_2.glb'], palm3: [QP + 'PalmTree_3.glb'],
  cart: [QP + 'Cart.glb'],

  // ---------- poly.pizza CC BY 3.0 (credited in assets/CREDITS.md) ----------
  umbrellaRed: [CB + 'BeachUmbrella_RedWhite.glb'], umbrellaBlue: [CB + 'BeachUmbrella_BlueWhite.glb'], umbrellaRainbow: [CB + 'BeachUmbrella_Rainbow.glb'],
  beachBall: [CB + 'BeachBall.glb'], beachChair: [CB + 'BeachChair.glb'], cooler: [CB + 'Cooler_Blue.glb'],
  sandcastle: [CB + 'Sandcastle_Blocky.glb'], lighthouse: [CB + 'Lighthouse_WithHouse.glb'],
  stiltHouse: [CB + 'StiltHouse.glb'], shrimpBoat: [CB + 'ShrimpBoat_Green.glb'], seashells: [CB + 'Seashells.glb'], starfish: [CB + 'Starfish.glb'],
  crab: [CB + 'Crab.glb'], surfboard: [CB + 'Surfboard.glb'], palmetto: [CB + 'Palmetto_Thatch.glb'], palmettoLady: [CB + 'Palmetto_Lady.glb'],
  pricklyFlower: [CB + 'PricklyPear_Flower.glb'], cattailTall: [CB + 'Cattail_B.glb'], peachTree: [CB + 'FruitTree_Orange.glb'],
  appleTree: [CB + 'FruitTree_Apple_Chunky.glb'], farmhouse: [CB + 'Farmhouse.glb'], mill: [CB + 'Mill_LongChimneys.glb'],
  haystack: [CB + 'Haystack.glb'], scarecrow: [CB + 'Scarecrow.glb'], dam: [CB + 'Dam.glb'],
  canoe: [CB + 'Canoe_Loaded.glb'], containerShip: [CB + 'ContainerShip.glb'], cabinPiers: [CB + 'Cabin_OnPiers.glb'],

  // ---------- poly.pizza CC0 ----------
  lighthouseRW: [C0 + 'Lighthouse_RedWhite.glb'], pricklyPear: [C0 + 'PricklyPear_Paddle.glb'], cactusRound: [C0 + 'Cactus_Round.glb'],
  tower: [C0 + 'TransmissionTower_A.glb'],
  hayRound: ['opengameart-hay-bales/HayBale_Round.glb'], haySquare: ['opengameart-hay-bales/HayBale_Square.glb'],

  // ---------- Kenney ----------
  cornRow: [KN + 'crops_cornStageD.glb', { s: 3, tint: CROPS }], wheatRow: [KN + 'crops_wheatStageB.glb', { s: 3, tint: CROPS }],
  soyRow: [KN + 'crops_leafsStageB.glb', { s: 3, tint: CROPS }], dirtRows: [KN + 'crops_dirtDoubleRow.glb', { s: 3, tint: CROPS }],
  moss: [KN + 'hanging_moss.glb', { s: 3, tint: { grass: '#9aa88a' }, ds: true }],
  longleafA: [KN + 'tree_pineTallA.glb', { s: 3, tint: PINE }], longleafB: [KN + 'tree_pineTallB.glb', { s: 3, tint: PINE }],
  longleafC: [KN + 'tree_pineTallC.glb', { s: 3, tint: PINE }],
  mushrooms: [KN + 'mushroom_redGroup.glb', { s: 3 }], stumpTall: [KN + 'stump_oldTall.glb', { s: 3, tint: { woodBark: '#6a5440', woodBarkDark: '#5a4632', wood: '#8a6c48' } }],
  palmK: [PI + 'palm-straight.glb', { ds: true }], palmBendK: [PI + 'palm-bend.glb', { ds: true }],   rocksSand: [PI + 'rocks-sand-a.glb'], dockPlatform: [PI + 'structure-platform-dock.glb'],
  rowboat: [PI + 'boat-row-small.glb'],   sailA: [WC + 'boat-sail-a.glb', { s: 2, ds: true }], sailB: [WC + 'boat-sail-b.glb', { s: 2, ds: true }], cargoShip: [WC + 'ship-cargo-a.glb', { s: 2 }],
  fishingBoat: [WC + 'boat-fishing-small.glb', { s: 2 }], buoy: [WC + 'buoy-flag.glb', { s: 2, ds: true }],
  tractor: ['kenney-car-kit/tractor.glb', { s: 1.5 }],
  cartHigh: [FT + 'cart-high.glb', { s: 2.5 }], bannerRed: [FT + 'banner-red.glb', { s: 2.5, ds: true }],   poles: [FT + 'poles-horizontal.glb', { s: 2.5 }],   rockSandA: [SV + 'rock-sand-a.glb', { s: 3 }], rockSandB: [SV + 'rock-sand-b.glb', { s: 3 }], signpost: [SV + 'signpost.glb', { s: 3 }],
  flowersTall: ['kenney-platformer-kit/flowers-tall.glb', { s: 2 }], flowers: ['kenney-platformer-kit/flowers.glb', { s: 2 }],
    brickA: ['kaykit-city-builder-bits/building_C_withoutBase.glb', { s: 6 }], brickB: ['kaykit-city-builder-bits/building_B_withoutBase.glb', { s: 6 }],
};
