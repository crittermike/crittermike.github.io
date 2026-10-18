// Data and pure functions. Loaded by index.html and by tests (node:vm).
const VC = (() => {
  const MAX_COMPARE = 3;
  const FE = (id) => ({ label: 'fueleconomy.gov (EPA)', url: 'https://www.fueleconomy.gov/feg/Find.do?action=sbs&id=' + id });
  const INTERIOR = {
  "odyssey": [
    {
      "src": "images/interior/odyssey-dash.jpg",
      "caption": "2025 Odyssey dashboard: 9-inch touchscreen and 7-inch TFT meter (same on every 2025 trim, incl. EX-L)",
      "credit": "American Honda Motor Co. (press photo)",
      "page": "https://hondanews.com/en-US/honda-automobiles/releases/release-410d07897fdd63d8043cb72750000f73-the-odyssey-continues-2025-honda-odyssey-gets-enhanced-styling-and-technology-upgrades-for-the-whole-family/photos/7"
    },
    {
      "src": "images/interior/odyssey-rear.jpg",
      "caption": "2025 Odyssey 2nd- and 3rd-row seating (press photo; trim not stated, likely a higher trim)",
      "credit": "American Honda Motor Co. (press photo)",
      "page": "https://hondanews.com/en-US/honda-automobiles/releases/release-410d07897fdd63d8043cb72750000f73-the-odyssey-continues-2025-honda-odyssey-gets-enhanced-styling-and-technology-upgrades-for-the-whole-family/photos/5"
    },
    {
      "src": "images/interior/odyssey-feature-flat-cargo-floor.jpg",
      "caption": "With 2nd-row seats removed and 3rd row stowed, the Odyssey's flat floor takes a sheet of plywood",
      "credit": "American Honda Motor Co. (press photo)",
      "page": "https://hondanews.com/en-US/honda-automobiles/releases/release-410d07897fdd63d8043cb72750000f73-the-odyssey-continues-2025-honda-odyssey-gets-enhanced-styling-and-technology-upgrades-for-the-whole-family/photos/15"
    }
  ],
  "sienna": [
    {
      "src": "images/interior/sienna-dash.jpg",
      "caption": "2025 Sienna dashboard with 12.3-inch touchscreen and 12.3-inch digital gauge cluster (Platinum shown; Limited has the same screens)",
      "credit": "Toyota Motor North America (press photo, via pressroom.toyota.com)",
      "page": "https://toyota-cms-media.s3.amazonaws.com/wp-content/uploads/2024/09/Toyota_2025-Sienna_Platinum_0006-1500x1029.jpg"
    },
    {
      "src": "images/interior/sienna-rear.jpg",
      "caption": "2nd-row leather captain's chairs with ottomans and super-long slide (Platinum shown; ottomans are also standard on Limited)",
      "credit": "Toyota Motor North America (press photo)",
      "page": "https://toyota-cms-media.s3.amazonaws.com/wp-content/uploads/2024/09/Toyota_2025-Sienna_Platinum_0004-1500x1000.jpg"
    },
    {
      "src": "images/interior/sienna-feature-fridgebox.jpg",
      "caption": "FridgeBox built into the front center console (optional on Limited, standard on Platinum)",
      "credit": "Toyota Motor North America (press photo)",
      "page": "https://toyota-cms-media.s3.amazonaws.com/wp-content/uploads/2024/09/Toyota_2025-Sienna_Platinum_0008-1500x1000.jpg"
    },
    {
      "src": "images/interior/sienna-feature-vacuum.jpg",
      "caption": "Built-in cabin vacuum, sold with the FridgeBox (optional on Limited, standard on Platinum)",
      "credit": "Toyota Motor North America (press photo)",
      "page": "https://toyota-cms-media.s3.amazonaws.com/wp-content/uploads/2024/09/Toyota_2025-Sienna_Platinum_0009-1500x1000.jpg"
    }
  ],
  "carnival": [
    {
      "src": "images/interior/carnival-dash.jpg",
      "caption": "2025 Carnival Hybrid dashboard: 12.3\" center touchscreen with the cabin-camera view on screen. The panoramic dual-12.3\" layout shown may be the SX/SX Prestige setup; EX cluster spec is conflicting (see features).",
      "credit": "Kia America",
      "page": "https://www.kiamedia.com/us/en/models/carnival-hev/2025/photos"
    },
    {
      "src": "images/interior/carnival-rear.jpg",
      "caption": "2025 Carnival 8-passenger 2nd-row Slide-Flex seating (upper-trim terracotta interior with sunroof shown; EX has no sunroof).",
      "credit": "Kia America",
      "page": "https://www.kiamedia.com/us/en/models/carnival/2025/photos"
    },
    {
      "src": "images/interior/carnival-feature-cabin-camera.jpg",
      "caption": "Rear-cabin camera view and Passenger Talk intercom on the center screen (standard on EX).",
      "credit": "Kia America",
      "page": "https://www.kiamedia.com/us/en/models/carnival-hev/2025/photos"
    }
  ],
  "grand-highlander": [
    {
      "src": "images/interior/grand-highlander-dash.jpg",
      "caption": "2024 Grand Highlander dashboard: 12.3\" touchscreen + 12.3\" digital cluster (same as Limited). Photo is a Platinum/Hybrid MAX black interior.",
      "credit": "Toyota Motor North America",
      "page": "https://pressroom.toyota.com/vehicle/2024-toyota-grand-highlander/"
    },
    {
      "src": "images/interior/grand-highlander-rear.jpg",
      "caption": "2nd-row captain's chair folded for access to the adult-sized 3rd row (Platinum Portobello interior shown).",
      "credit": "Toyota Motor North America",
      "page": "https://pressroom.toyota.com/vehicle/2024-toyota-grand-highlander/"
    },
    {
      "src": "images/interior/grand-highlander-feature-cargo.jpg",
      "caption": "Cargo area behind the 3rd row: 20.6 cu ft, fits ~7 carry-on suitcases.",
      "credit": "Toyota Motor North America",
      "page": "https://pressroom.toyota.com/vehicle/2024-toyota-grand-highlander/"
    }
  ],
  "ev9": [
    {
      "src": "images/interior/ev9-dash.jpg",
      "caption": "2024 Kia EV9 (US-spec Land trim shown) dashboard: 12.3-in. cluster + 5-in. climate display + 12.3-in. touchscreen under one panoramic glass panel. Wind has the same screens and layout.",
      "credit": "Charles from Port Chester, NY (Flickr) via Wikimedia Commons, CC BY 2.0",
      "page": "https://commons.wikimedia.org/wiki/File:Kia_EV9_Land_AWD_(2024)_(53623799537).jpg"
    },
    {
      "src": "images/interior/ev9-rear.jpg",
      "caption": "EV9 2nd-row captain's chair with power leg rest, under the dual sunroof. This is a Korean-spec 6-seat car; the Wind 7-seat has a 60/40 sliding bench instead, and the US relaxation chairs are a Land/GT-Line option.",
      "credit": "Damian B Oh via Wikimedia Commons, CC BY-SA 4.0",
      "page": "https://commons.wikimedia.org/wiki/File:Kia_EV9_MV1_Dark_Gray_Black_Interior_(18).jpg"
    },
    {
      "src": "images/interior/ev9-feature-triple-screens.jpg",
      "caption": "EV9 panoramic display strip (12.3 + 5 + 12.3 in.), standard on every trim (Korean-spec car shown)",
      "credit": "Damian B Oh via Wikimedia Commons, CC BY-SA 4.0",
      "page": "https://commons.wikimedia.org/wiki/File:Kia_EV9_MV1_Dark_Gray_Black_Interior_(14).jpg"
    }
  ],
  "ex90": [
    {
      "src": "images/interior/ex90-dash.jpg",
      "caption": "Volvo EX90 dashboard: 14.5-in. portrait center screen with Google built-in and a slim 9-in. driver display; the HUD is standard. Korean-market Ultra shown; Plus has the same screens.",
      "credit": "Damian B Oh via Wikimedia Commons, CC BY-SA 4.0",
      "page": "https://commons.wikimedia.org/wiki/File:Volvo_EX90_Ultra_SPA2_Dawn_(2).jpg"
    },
    {
      "src": "images/interior/ex90-rear.jpg",
      "caption": "EX90 2nd row under the standard fixed panoramic glass roof (Korean-market Ultra shown)",
      "credit": "Damian B Oh via Wikimedia Commons, CC BY-SA 4.0",
      "page": "https://commons.wikimedia.org/wiki/File:Volvo_EX90_Ultra_SPA2_Dawn_(13).jpg"
    },
    {
      "src": "images/interior/ex90-feature-rear-climate.jpg",
      "caption": "EX90 rear climate panel with seat-heat buttons (part of the 4-zone climate system)",
      "credit": "Damian B Oh via Wikimedia Commons, CC BY-SA 4.0",
      "page": "https://commons.wikimedia.org/wiki/File:Volvo_EX90_Ultra_SPA2_Dawn_(15).jpg"
    }
  ]
};

  // Feature rows. Status codes: s standard, o option, u higher trim only, n not offered, q unverified. Text rows use `t`.
  const FEATURE_GROUPS = [
    { name: 'Seats & comfort', rows: [
      ['heatFront', 'Heated front seats'], ['ventFront', 'Ventilated front seats'], ['heatWheel', 'Heated steering wheel'],
      ['heat2', 'Heated 2nd row'], ['vent2', 'Ventilated 2nd row'], ['slide2', 'Sliding 2nd row'],
      ['captains', "Captain's chairs"], ['ottoman', '2nd-row leg rests'], ['remove2', 'Removable 2nd row'],
      ['power3', 'Power-fold 3rd row'], ['moonroof', 'Sunroof'], ['climate', 'Climate zones', 'text']
    ] },
    { name: 'Kids & family', rows: [
      ['fridge', 'Fridge'], ['vacuum', 'Vacuum'], ['cabinCam', 'Rear-seat camera'], ['intercom', 'Intercom'],
      ['seatReminder', 'Rear-seat reminder'], ['slidingDoors', 'Power sliding doors'], ['liftgate', 'Hands-free liftgate'],
      ['rse', 'Rear entertainment'], ['shades', 'Rear sunshades'], ['booster', 'Built-in booster']
    ] },
    { name: 'Tech', rows: [
      ['screens', 'Screens', 'text'], ['wirelessCP', 'Wireless CarPlay/AA'], ['phoneKey', 'Phone as key'],
      ['remoteStart', 'Remote start'], ['audio', 'Premium audio'], ['usbc', 'USB ports', 'text']
    ] },
    { name: 'Driving & safety', rows: [
      ['assist', 'Driver assist', 'text'], ['hud', 'Head-up display'], ['cam360', '360° camera'], ['bsCam', 'Blind-spot camera'],
      ['digitalMirror', 'Camera mirror'], ['parkSensors', 'Parking sensors'], ['onePedal', 'One-pedal driving']
    ] },
    { name: 'Power', rows: [
      ['outlet', '120V cabin outlet'], ['v2l', 'Power out (V2L/V2H)']
    ] }
  ];

  const VEHICLES = [
    {
      id: 'odyssey', short: 'Odyssey', year: 2025, make: 'Honda', model: 'Odyssey', trim: 'EX-L', type: 'van', power: 'gas', seats: 8,
      mpg: 22, kwhPer100: null, range: null, tank: 19.5, efficiencySource: FE(48254),
      drivetrain: 'FWD, 3.5L V6, 10-speed automatic',
      price: { typical: 42220, dest: 1450, note: 'EX-L MSRP excludes $1,450 destination.', asOf: '2026-10-18',
        sources: [{ label: 'Honda 2025 pricing and EPA ratings', url: 'https://www.hondanews.com/en-US/releases/release-d73d9911716c8277bb60a27897025927-2025-honda-odyssey-pricing-and-epa-ratings-2025' }, { label: 'Honda build and price', url: 'https://automobiles.honda.com/tools/build-and-price-trimwalk?modelseries=odyssey' }, FE(48254)] },
      space: { leg2: 40.9, leg3: 38.1, head3: 38.3, cargo3: 32.8, cargo2: 86.6, cargo1: 140.7, length: 205.2, tow: 3500, weight: 4526 },
      iihs: null, charging: null,
      pros: ['Lowest price here', '2nd-row seats slide sideways and come out: wide center aisle or a flat floor that takes plywood (140.7 cu ft)', 'Roomy 3rd row (38.1 in legroom), seats 8', 'CabinTalk intercom standard'],
      cons: ['Worst fuel economy: 22 mpg, the only non-hybrid', 'No ventilated seats, heated wheel or parking sensors on EX-L; no 360 camera on any trim', 'Oldest design here (2018); small 9-in screen', 'IIHS updated moderate overlap: Poor'],
      f: {
        heatFront: 's', ventFront: ['u', 'Elite'], heatWheel: ['u', 'Elite'], heat2: 'n', vent2: 'n',
        slide2: ['s', 'Fore/aft and side to side (Magic Slide)'], captains: ['n', '8-seat layout'], ottoman: 'n', remove2: ['s', 'All three; center back folds into a table'],
        power3: ['n', 'Manual, folds into floor'], moonroof: ['s', 'Single'], climate: '3-zone',
        fridge: 'n', vacuum: ['n', 'HondaVAC dropped'], cabinCam: ['u', 'CabinWatch, Touring/Elite'], intercom: ['s', 'CabinTalk'],
        seatReminder: ['s', 'Door-logic only'], slidingDoors: ['s', 'Power, not hands-free'], liftgate: ['u', 'Elite'],
        rse: ['u', '12.8 in, Touring/Elite'], shades: ['s', '2nd row'], booster: 'n',
        screens: '9 in touch + 7 in gauges', wirelessCP: 's', phoneKey: 'n', remoteStart: ['s', 'Key fob'], audio: ['n', '7 speakers'], usbc: '3 USB-C + 1 USB-A',
        assist: 'Adaptive cruise + lane keeping', hud: 'n', cam360: ['n', 'Not on any trim'], bsCam: 'n', digitalMirror: 'n', parkSensors: ['u', 'Touring/Elite'], onePedal: 'n',
        outlet: ['u', '150W, Touring/Elite'], v2l: 'n'
      },
      photo: { src: 'images/odyssey.jpg', alt: 'Honda Odyssey minivan of the RL6 generation photographed in the Washington DC area', credit: 'OWS Photography', license: 'CC BY 4.0', licenseUrl: 'https://creativecommons.org/licenses/by/4.0', page: 'https://commons.wikimedia.org/wiki/File:Honda_Odyssey_(RL6)_Washington_DC_Metro_Area,_USA.jpg', note: 'Same generation; trim and year may differ.' }
    },
    {
      id: 'sienna', short: 'Sienna', year: 2025, make: 'Toyota', model: 'Sienna', trim: 'Limited FWD', type: 'van', power: 'hybrid', seats: 7,
      mpg: 36, kwhPer100: null, range: null, tank: 18, efficiencySource: FE(48904),
      drivetrain: 'FWD, 2.5L hybrid, CVT',
      price: { typical: 50500, dest: 1450, note: 'Cars.com MSRP for Limited FWD. Toyota’s 3/28/2025 sheet lists $50,200 + $1,450 destination.', asOf: '2026-10-18',
        sources: [{ label: 'Cars.com 2025 Sienna Limited FWD specs', url: 'https://www.cars.com/research/toyota-sienna-2025/specs/461558' }, { label: 'Toyota 2025 Sienna announcement', url: 'https://pressroom.toyota.com/toyota-sienna-adds-new-seat-reminder-tech-and-interior-updates-for-2025/' }] },
      space: { leg2: 39.9, leg3: 38.7, head3: 37.4, cargo3: 33.5, cargo2: 75.2, cargo1: 101.0, length: 203.7, tow: 3500, weight: 4725 },
      iihs: null, charging: null,
      pros: ['Only one with a fridge and vacuum (one package on Limited)', 'Best mpg here (36) and about 650 miles per tank', "Captain's chairs with ottomans and a very long slide", 'Radar rear-seat reminder honks and alerts your phone', 'Hands-free sliding doors, 4-zone climate, JBL audio, 2nd- and 3rd-row shades'],
      cons: ['2nd-row seats don’t come out: max cargo 101 cu ft vs 141 to 145 in the other vans', 'Engine drones under hard acceleration', 'Heated wheel, heated 2nd row, HUD and 360 camera are Platinum-only', 'IIHS updated moderate overlap: Marginal'],
      f: {
        heatFront: 's', ventFront: 's', heatWheel: ['u', 'Platinum'], heat2: ['u', 'Platinum'], vent2: 'n',
        slide2: ['s', 'Super-long slide'], captains: ['s', '7-seat'], ottoman: ['s', 'Ottomans'], remove2: 'n',
        power3: ['n', 'Manual, folds into floor'], moonroof: ['s', 'Single'], climate: '4-zone',
        fridge: ['o', 'FridgeBox package'], vacuum: ['o', 'Same package as fridge'], cabinCam: 'n', intercom: ['q', 'Not listed for 2025'],
        seatReminder: ['s', 'Radar; honks + app alert'], slidingDoors: ['s', 'Hands-free'], liftgate: 'o',
        rse: ['o', '11.6 in package'], shades: ['s', '2nd and 3rd row'], booster: 'n',
        screens: '12.3 in touch + 12.3 in gauges', wirelessCP: 's', phoneKey: ['q', 'Not listed'], remoteStart: ['s', 'App, subscription'], audio: ['s', 'JBL, 12 speakers'], usbc: '6 charge + 1 media',
        assist: 'Full-speed adaptive cruise + lane centering', hud: ['u', 'Platinum'], cam360: ['u', 'Platinum'], bsCam: 'n', digitalMirror: 'o', parkSensors: ['s', 'With auto braking'], onePedal: 'n',
        outlet: ['o', '1500W'], v2l: 'n'
      },
      photo: { src: 'images/sienna.jpg', alt: 'Toyota Sienna minivan of the current XL40 generation parked in Stuttgart-Vaihingen', credit: 'Alexander Migl', license: 'CC BY-SA 4.0', licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0', page: 'https://commons.wikimedia.org/wiki/File:Toyota_Sienna_(XL40)_DSC_2921.jpg', note: 'Same generation; trim may differ.' }
    },
    {
      id: 'carnival', short: 'Carnival', year: 2025, make: 'Kia', model: 'Carnival Hybrid', trim: 'EX FWD', type: 'van', power: 'hybrid', seats: 8,
      mpg: 33, kwhPer100: null, range: null, tank: 19, efficiencySource: FE(48054),
      drivetrain: 'FWD, 1.6L turbo hybrid, 6-speed automatic',
      price: { typical: 43000, dest: 1435, note: 'EX MSRP excludes $1,435 destination.', asOf: '2026-10-18',
        sources: [{ label: 'Kia 2025 Carnival pricing and powertrain', url: 'https://www.kiamedia.com/us/en/media/pressreleases/22264/kia-adds-hybrid-powertrain-to-the-carnival-mpv-lineup-and-announces-2025-pricing' }, { label: 'Kia Media 2025 Carnival HEV pricing', url: 'https://www.kiamedia.com/us/en/models/carnival-hev/2025/pricing' }] },
      space: { leg2: 40.5, leg3: 35.6, head3: 38.6, cargo3: 40.2, cargo2: 86.9, cargo1: 145.1, length: 203.0, tow: 2500, weight: 4852 },
      iihs: null, charging: null,
      pros: ['Cheapest hybrid here', 'Most cargo: 40.2 cu ft behind the 3rd row, 145.1 max', 'Rear-seat camera and intercom standard on EX', 'Hands-free sliding doors and liftgate', 'Outboard 2nd-row seats come out; center seat becomes a table'],
      cons: ['FWD only', 'EX has no sunroof, ventilated seats, heated wheel or 360 camera', 'Tows 2,500 lb, the least here', 'IIHS updated moderate overlap: Marginal'],
      f: {
        heatFront: 's', ventFront: ['u', 'SX'], heatWheel: ['u', 'SX Prestige'], heat2: ['u', 'SX Prestige lounge seats'], vent2: ['u', 'SX Prestige lounge seats'],
        slide2: ['s', 'Center seat slides far forward'], captains: ['u', 'SX Prestige 7-seat'], ottoman: ['u', 'SX Prestige'], remove2: ['s', 'Outboard seats; center folds to a table'],
        power3: ['n', 'Manual, folds into floor'], moonroof: ['u', 'Dual, SX+'], climate: '3-zone',
        fridge: 'n', vacuum: 'n', cabinCam: ['s', 'On center screen'], intercom: ['s', 'Passenger Talk + Quiet Mode'],
        seatReminder: ['s', 'Rear Occupant Alert'], slidingDoors: ['s', 'Hands-free'], liftgate: 's',
        rse: ['u', 'Dual screens, SX+'], shades: ['s', '2nd and 3rd row'], booster: 'n',
        screens: '12.3 in touch + gauges (size varies by source)', wirelessCP: 's', phoneKey: ['u', 'Digital Key 2, higher trims'], remoteStart: ['q', 'Kia Connect app'], audio: ['u', 'Bose, SX Prestige'], usbc: '6 USB-C',
        assist: 'Highway Driving Assist (hands-on)', hud: ['u', 'SX Prestige'], cam360: ['u', 'SX'], bsCam: ['u', 'SX'], digitalMirror: ['u', 'SX Prestige'], parkSensors: 'q', onePedal: 'n',
        outlet: ['u', '115V, SX+'], v2l: 'n'
      },
      photo: { src: 'images/carnival.jpg', alt: 'Kia Carnival Hybrid minivan, facelifted KA4 generation with the 1.6 hybrid powertrain', credit: 'Avante2025', license: 'CC BY 4.0', licenseUrl: 'https://creativecommons.org/licenses/by/4.0', page: 'https://commons.wikimedia.org/wiki/File:Kia_Carnival_Hybrid_KA4_PE_1.6_HEV.jpg', note: 'May be a non-US market version.' }
    },
    {
      id: 'grand-highlander', short: 'Grand Highlander', year: 2024, make: 'Toyota', model: 'Grand Highlander Hybrid', trim: 'Limited AWD', type: 'suv', power: 'hybrid', seats: 7,
      mpg: 34, kwhPer100: null, range: null, tank: 17.2, efficiencySource: FE(46753),
      drivetrain: 'AWD, 2.5L hybrid, CVT',
      price: { typical: 51410, dest: 1395, note: 'Base MSRP. Toyota lists delivery separately; $1,395 is assumed.', asOf: '2026-10-18',
        sources: [{ label: 'Toyota 2024 Grand Highlander Hybrid', url: 'https://www.buyatoyota.com/home/vehicles/grandhighlanderhybrid/2024/' }, { label: 'Toyota 2024 Grand Highlander brochure', url: 'https://www.toyota.com/content/dam/toyota/brochures/pdf/2024/grand_highlander_ebrochure.pdf' }] },
      space: { leg2: 39.5, leg3: 33.5, head3: 37.2, cargo3: 20.6, cargo2: 57.9, cargo1: 97.5, length: 201.4, tow: 3500, weight: 4620 },
      iihs: null, charging: null,
      pros: ['Only non-EV with AWD, at 34 mpg', 'Every seat-comfort feature standard: heated and ventilated fronts, heated 2nd row, heated wheel', '1500W outlets standard', '7 USB-C ports, JBL audio, phone key', 'Adult-usable 3rd row in a shorter body than the vans'],
      cons: ['Half the cargo of the vans behind the 3rd row (20.6 cu ft)', 'Hinged rear doors', 'No rear-seat camera or intercom; sunroof optional', '2024 side-curtain airbag recall: check the VIN'],
      f: {
        heatFront: 's', ventFront: 's', heatWheel: 's', heat2: ['s', 'Outboard'], vent2: ['u', 'Platinum'],
        slide2: ['s', 'Slide and recline'], captains: ['s', 'Or 8-seat bench'], ottoman: 'n', remove2: 'n',
        power3: ['q', 'Manual'], moonroof: ['o', 'Panoramic'], climate: '3-zone',
        fridge: 'n', vacuum: 'n', cabinCam: 'n', intercom: 'n',
        seatReminder: 's', slidingDoors: ['n', 'Hinged doors'], liftgate: 's',
        rse: 'n', shades: ['s', '2nd row'], booster: 'n',
        screens: '12.3 in touch + 12.3 in gauges', wirelessCP: 's', phoneKey: ['s', 'App, subscription'], remoteStart: ['s', 'App, subscription'], audio: ['s', 'JBL, 11 speakers'], usbc: '7 USB-C, all rows',
        assist: 'Full-speed adaptive cruise + lane centering', hud: ['u', 'Platinum'], cam360: ['u', 'Platinum'], bsCam: 'n', digitalMirror: ['u', 'Platinum'], parkSensors: 'q', onePedal: 'n',
        outlet: ['s', '1500W'], v2l: 'n'
      },
      photo: { src: 'images/grand-highlander.jpg', alt: 'Toyota Grand Highlander Limited SUV at a dealership in Mesa, Arizona', credit: 'HJUdall', license: 'CC0', licenseUrl: 'http://creativecommons.org/publicdomain/zero/1.0/deed.en', page: 'https://commons.wikimedia.org/wiki/File:24_Toyota_Grand_Highlander_Limited.jpg', note: 'A 2024 Limited; powertrain not confirmed.' }
    },
    {
      id: 'ev9', short: 'EV9', year: 2024, make: 'Kia', model: 'EV9', trim: 'Wind AWD', type: 'suv', power: 'ev', seats: 7,
      mpg: null, kwhPer100: 41, range: 280, tank: null, efficiencySource: FE(47452),
      drivetrain: 'AWD, dual motor, long-range battery',
      price: { typical: 63900, dest: 1495, note: 'Wind AWD MSRP excludes $1,495 destination.', asOf: '2026-10-18',
        sources: [{ label: 'Kia Media 2024 EV9 pricing', url: 'https://www.kiamedia.com/us/en/models/ev9/2024/pricing' }] },
      space: { leg2: 42.8, leg3: 30.8, head3: 39.5, cargo3: 20.2, cargo2: 43.5, cargo1: 81.7, length: 197.2, tow: 3500, weight: 5700 },
      iihs: 'TSP', charging: '800V: 10 to 80% in about 24 min. 10.9 kW at home. Tesla Supercharger access with adapter.',
      pros: ['Lowest energy cost here', 'Most 2nd-row legroom (42.8 in) and a flat floor', 'Dual sunroof, heated wheel, ventilated seats standard', 'Phone key plus fingerprint start', 'Fastest charging here (800V)'],
      cons: ['Wired-only CarPlay on 2024', 'Tight 3rd row (30.8 in legroom)', 'ICCU (12V charger) failures reported: check recalls', 'Range drops in winter and at highway speed'],
      f: {
        heatFront: 's', ventFront: 's', heatWheel: 's', heat2: ['u', 'Land'], vent2: ['u', 'Land/GT-Line'],
        slide2: ['s', 'Bench slides and tilts'], captains: ['u', 'Land/GT-Line'], ottoman: ['u', 'Relaxation seats, Land/GT-Line'], remove2: 'n',
        power3: ['n', 'Manual 50/50'], moonroof: ['s', 'Dual: front opens, rear fixed'], climate: '3-zone, roof vents',
        fridge: 'n', vacuum: 'n', cabinCam: 'n', intercom: ['s', 'Cabin Talk'],
        seatReminder: ['s', 'Ultrasonic sensor'], slidingDoors: 'n', liftgate: 's',
        rse: ['n', 'Mounts only'], shades: ['u', 'Land'], booster: 'n',
        screens: 'Two 12.3 in + 5 in climate', wirelessCP: ['n', 'Wired only on 2024'], phoneKey: ['s', 'Plus fingerprint start'], remoteStart: ['s', 'App, with climate'], audio: ['u', 'Meridian, Land'], usbc: '6, 2 per row',
        assist: 'Highway Driving Assist 2 with lane changes (hands-on)', hud: ['u', 'GT-Line'], cam360: ['u', 'Land'], bsCam: ['u', 'Land'], digitalMirror: ['u', 'Land'], parkSensors: 'q', onePedal: ['s', 'i-PEDAL'],
        outlet: ['q', 'Unverified on Wind'], v2l: ['u', 'Exterior V2L on higher trims (Land+)']
      },
      photo: { src: 'images/ev9.jpg', alt: 'Kia EV9 electric SUV with boxy styling photographed in Stuttgart', credit: 'Alexander-93', license: 'CC BY-SA 4.0', licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0', page: 'https://commons.wikimedia.org/wiki/File:Kia_EV9_1X7A2472.jpg', note: 'May be a non-US trim.' }
    },
    {
      id: 'ex90', short: 'EX90', year: 2025, make: 'Volvo', model: 'EX90', trim: 'Plus Twin Motor AWD', type: 'suv', power: 'ev', seats: 7,
      mpg: null, kwhPer100: 42, range: 300, tank: null, efficiencySource: FE(48777),
      drivetrain: 'AWD, twin motor, 402 hp',
      price: { typical: 81290, dest: 0, note: 'Starting MSRP from Volvo. J.D. Power reports it includes $1,295 destination.', asOf: '2026-10-18',
        sources: [{ label: 'Volvo EX90', url: 'https://www.volvocars.com/us/cars/ex90-electric/' }, { label: 'J.D. Power EX90 review', url: 'https://www.jdpower.com/cars/expert-reviews/2025-volvo-ex90-review-first-drive' }] },
      space: { leg2: 36.5, leg3: 31.9, head3: 35.8, cargo3: 10.9, cargo2: 35.6, cargo1: 67.6, length: 198.3, tow: 4850, weight: 6197 },
      iihs: 'TSP+', charging: '400V, 250 kW: 10 to 80% in about 30 min. 11 kW at home. Tesla Supercharger access with adapter.',
      pros: ['Best IIHS rating here (Top Safety Pick+)', 'HUD, 360 camera and power-fold 3rd row standard', 'Built-in booster seat in the 2nd-row center', 'Interior radar detects kids or pets left behind', 'Longest EV range (300 mi); tows 4,850 lb', 'Google built-in, Bose 14-speaker audio'],
      cons: ['Costs about $36k more than the cheapest van', 'Least cargo (about 11 cu ft behind the 3rd row) and tightest 2nd row', 'Buggy launch software; early cars get a computer upgrade', 'Most controls are in the touchscreen'],
      f: {
        heatFront: 's', ventFront: ['q', 'Reports conflict for Plus'], heatWheel: 's', heat2: ['s', 'Outboard'], vent2: 'n',
        slide2: ['s', 'Manual fore/aft'], captains: ['o', '6-seat'], ottoman: 'n', remove2: 'n',
        power3: 's', moonroof: ['s', 'Fixed glass roof, doesn’t open'], climate: '4-zone',
        fridge: 'n', vacuum: 'n', cabinCam: ['n', 'Radar detects occupants'], intercom: 'q',
        seatReminder: ['s', 'Interior radar'], slidingDoors: 'n', liftgate: 's',
        rse: 'n', shades: ['s', '2nd row'], booster: ['s', '2nd-row center seat'],
        screens: '14.5 in portrait touch + 9 in gauges + HUD', wirelessCP: ['s', 'Plus Google built-in'], phoneKey: 's', remoteStart: ['s', 'App, with climate'], audio: ['s', 'Bose, 14 speakers'], usbc: '6 USB-C, 2 per row',
        assist: 'Pilot Assist with lane changes (hands-on); lidar', hud: 's', cam360: 's', bsCam: 'n', digitalMirror: 'n', parkSensors: 's', onePedal: 's',
        outlet: 's', v2l: ['q', 'Hardware ready; needs Volvo home charger']
      },
      photo: { src: 'images/ex90.jpg', alt: 'Volvo EX90 electric SUV photographed in Stuttgart-Vaihingen', credit: 'Alexander Migl', license: 'CC BY-SA 4.0', licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0', page: 'https://commons.wikimedia.org/wiki/File:Volvo_EX90_DSC_7810.jpg', note: 'May be a non-US trim.' }
    }
  ];
  VEHICLES.forEach(v => { v.interior = INTERIOR[v.id] || []; });

  function valid(n) { return typeof n === 'number' && Number.isFinite(n) && n >= 0; }

  function annualEnergyCost(v, a) {
    if (!v || !a || !valid(a.miles)) return NaN;
    if (v.power === 'ev') {
      if (!valid(a.elec) || !(v.kwhPer100 > 0)) return NaN;
      return a.miles * v.kwhPer100 / 100 * a.elec;
    }
    if (!valid(a.gas) || !(v.mpg > 0)) return NaN;
    return a.miles / v.mpg * a.gas;
  }

  function rangeMiles(v) { return v.power === 'ev' ? v.range : Math.round(v.tank * v.mpg); }

  function ownershipCost(v, a, years) {
    const e = annualEnergyCost(v, a);
    if (!Number.isFinite(e) || !valid(years)) return NaN;
    return v.price.typical + (v.price.dest || 0) + e * years;
  }

  // Normalized status for a feature cell: { s, note } or { text }.
  function feature(v, key) {
    const raw = v.f[key];
    if (raw == null) return { s: 'q', note: '' };
    if (Array.isArray(raw)) return { s: raw[0], note: raw[1] || '' };
    return raw.length === 1 ? { s: raw, note: '' } : { text: raw };
  }

  function featureScore(v) {
    let total = 0;
    FEATURE_GROUPS.forEach(g => g.rows.forEach(([key, , kind]) => {
      if (kind === 'text') return;
      const s = feature(v, key).s;
      total += s === 's' ? 1 : s === 'o' ? 0.3 : 0;
    }));
    return total;
  }

  // Keys where exactly one vehicle in `list` has it standard or optional.
  function uniqueFeatures(list) {
    const out = {};
    FEATURE_GROUPS.forEach(g => g.rows.forEach(([key, , kind]) => {
      if (kind === 'text') return;
      const has = list.filter(v => ['s', 'o'].includes(feature(v, key).s));
      if (has.length === 1 && list.length > 1) out[key] = has[0].id;
    }));
    return out;
  }

  const SAFETY = { 'TSP+': 1, TSP: 0.7 };
  const FACTORS = ['price', 'energy', 'space', 'features', 'safety'];

  function scoreVehicles(list, a, weights) {
    const years = (a && a.years) || 8;
    const raw = list.map(v => ({
      v,
      price: -(v.price.typical + (v.price.dest || 0)),
      energy: -annualEnergyCost(v, a) * years,
      space: null,
      features: featureScore(v),
      safety: SAFETY[v.iihs] || 0.3
    }));
    const spaceKeys = ['leg2', 'leg3', 'cargo3', 'cargo1'];
    const norm = (vals) => {
      const ok = vals.filter(Number.isFinite);
      const lo = Math.min(...ok), hi = Math.max(...ok);
      return vals.map(x => !Number.isFinite(x) ? 0 : hi === lo ? 1 : (x - lo) / (hi - lo));
    };
    const spaceParts = spaceKeys.map(k => norm(raw.map(r => r.v.space[k])));
    raw.forEach((r, i) => { r.space = spaceParts.reduce((s, p) => s + p[i], 0) / spaceKeys.length; });
    const n = {};
    FACTORS.forEach(k => { n[k] = k === 'space' ? raw.map(r => r.space) : norm(raw.map(r => r[k])); });
    const w = FACTORS.map(k => Math.max(0, Number(weights && weights[k]) || 0));
    const wSum = w.reduce((s, x) => s + x, 0) || 1;
    return raw.map((r, i) => {
      const parts = {};
      FACTORS.forEach((k, j) => { parts[k] = n[k][i] * w[j] / wSum * 100; });
      const score = Object.values(parts).reduce((s, x) => s + x, 0);
      return { id: r.v.id, score, parts };
    }).sort((x, y) => y.score - x.score);
  }

  function filterVehicles(list, f) {
    const type = (f && f.type) || 'all', power = (f && f.power) || 'all';
    return list.filter(v => (type === 'all' || v.type === type) && (power === 'all' || v.power === power));
  }

  function toggleCompare(sel, id) {
    if (sel.includes(id)) return sel.filter(x => x !== id);
    if (sel.length >= MAX_COMPARE) return sel.slice();
    return sel.concat(id);
  }

  return { VEHICLES, FEATURE_GROUPS, FACTORS, MAX_COMPARE, annualEnergyCost, rangeMiles, ownershipCost, feature, featureScore, uniqueFeatures, scoreVehicles, filterVehicles, toggleCompare };
})();
if (typeof globalThis !== 'undefined') globalThis.VC = VC;
