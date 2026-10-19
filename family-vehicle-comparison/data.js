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
      "caption": "Grand Highlander dashboard (same design for 2025): 12.3\" touchscreen + 12.3\" digital cluster (same as Limited). Photo is a Platinum/Hybrid MAX black interior.",
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
      "caption": "Kia EV9 (US-spec Land trim shown) dashboard: 12.3-in. cluster + 5-in. climate display + 12.3-in. touchscreen under one panoramic glass panel. Same layout on the 2025 Wind.",
      "credit": "Charles from Port Chester, NY (Flickr) via Wikimedia Commons, CC BY 2.0",
      "page": "https://commons.wikimedia.org/wiki/File:Kia_EV9_Land_AWD_(2024)_(53623799537).jpg"
    },
    {
      "src": "images/interior/ev9-rear.jpg",
      "caption": "EV9 2nd-row captain's chair with power leg rest, under the dual sunroof. This is a Korean-spec 6-seat car; the Wind 7-seat has a 60/40 sliding bench instead, and the US relaxation chairs are a GT-Line option for 2025.",
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
  ],
  "xc90": [
    {
      "src": "images/interior/xc90-dash.jpg",
      "caption": "Refreshed XC90 dashboard: 11.2 in portrait touchscreen and 12.3 in digital cluster, same layout as the 2025.5 Plus. Photo is a non-US T8 with light interior.",
      "credit": "Ethan Llamas via Wikimedia Commons, CC BY-SA 4.0",
      "page": "https://commons.wikimedia.org/wiki/File:Volvo_XC90_II_FL2_T8_AWD_Recharge_PHEV_interior.jpg"
    },
    {
      "src": "images/interior/xc90-rear.jpg",
      "caption": "XC90 2nd-row bench and 3rd row. Photo is an early car; the seat layout is unchanged for 2025.",
      "credit": "Herranderssvensson via Wikimedia Commons, CC BY-SA 3.0",
      "page": "https://commons.wikimedia.org/wiki/File:Volvo_XC90_II_3rd_row_seat.jpg"
    }
  ],
  "telluride": [
    {
      "src": "images/interior/telluride-dash.jpg",
      "caption": "2025 Telluride dashboard: 12.3 in touchscreen and 12.3 in digital gauges in one panel (higher trim shown; SX has the same screens)",
      "credit": "Kia America (press photo)",
      "page": "https://www.kiamedia.com/us/en/media/photos/23381/2025-telluride-41"
    },
    {
      "src": "images/interior/telluride-rear.jpg",
      "caption": "2025 Telluride 3rd-row bench, 31.4 in of legroom (higher trim shown)",
      "credit": "Kia America (press photo)",
      "page": "https://www.kiamedia.com/us/en/media/photos/23376/2025-telluride-36"
    },
    {
      "src": "images/interior/telluride-feature-cargo.jpg",
      "caption": "With the 3rd row folded flat the Telluride has 46 cu ft of cargo space (87 cu ft with both rows down)",
      "credit": "Kia America (press photo)",
      "page": "https://www.kiamedia.com/us/en/media/photos/23377/2025-telluride-37"
    }
  ],
  "palisade": [
    {
      "src": "images/interior/palisade-dash.jpg",
      "caption": "Palisade dashboard: 12.3 in touchscreen and 12.3 in digital gauges (2023 model shown; same layout on 2025)",
      "credit": "deathpallie325 (CC BY-SA 4.0, Wikimedia Commons)",
      "page": "https://commons.wikimedia.org/wiki/File:2023_Hyundai_Palisade_interior.jpg"
    },
    {
      "src": "images/interior/palisade-rear.jpg",
      "caption": "2025 Palisade 2nd-row captain's chairs with 42.4 in of legroom (Calligraphy shown)",
      "credit": "Hyundai Motor America (press photo)",
      "page": "https://www.hyundainews.com/assets/images/original/62047-Large559772024Palisade.jpg"
    },
    {
      "src": "images/interior/palisade-feature-rear-climate.jpg",
      "caption": "2nd-row climate controls, heated and ventilated seat buttons and 115V outlet (all standard on SEL Premium)",
      "credit": "Hyundai Motor America (press photo)",
      "page": "https://www.hyundainews.com/assets/images/original/62063-Large559962024Palisade.jpg"
    }
  ],
  "pilot": [
    {
      "src": "images/interior/pilot-dash.jpg",
      "caption": "Pilot dashboard: 9-inch touchscreen and 7-inch gauge display (2023 Elite shown; 2025 EX-L has the same screens)",
      "credit": "American Honda Motor Co. (press photo)",
      "page": "https://hondanews.com/en-US/honda-automobiles/releases/release-4e58b4e0fcd795affa5685a66a252ccf-2023-honda-pilot-press-kit/photos/32"
    },
    {
      "src": "images/interior/pilot-rear.jpg",
      "caption": "Pilot from the tailgate with 2nd and 3rd rows folded flat (2023 TrailSport shown, with its panoramic roof)",
      "credit": "American Honda Motor Co. (press photo)",
      "page": "https://hondanews.com/en-US/honda-automobiles/releases/release-4e58b4e0fcd795affa5685a66a252ccf-2023-honda-pilot-press-kit/photos/27"
    },
    {
      "src": "images/interior/pilot-feature-removable-middle-seat.jpg",
      "caption": "The removable 2nd-row middle seat stores in the well under the cargo floor, turning 8 seats into 7 with a center aisle",
      "credit": "American Honda Motor Co. (press photo)",
      "page": "https://hondanews.com/en-US/honda-automobiles/releases/release-4e58b4e0fcd795affa5685a66a252ccf-2023-honda-pilot-press-kit/photos/28"
    }
  ],
  "cx90": [
    {
      "src": "images/interior/cx90-dash.jpg",
      "caption": "CX-90 dashboard: 12.3-inch center display and 12.3-inch digital gauges (2024 press photo with white Nappa, likely Turbo S; Premium Plus has the same screens)",
      "credit": "Mazda North American Operations (press photo)",
      "page": "https://news.mazdausa.com/vehicles-2025-cx-90"
    },
    {
      "src": "images/interior/cx90-rear.jpg",
      "caption": "CX-90 2nd-row captain's chairs seen from the 3rd row (2024 press photo; this car has the 6-seat center console, Premium Plus 7-seat has a walk-through instead)",
      "credit": "Mazda North American Operations (press photo)",
      "page": "https://news.mazdausa.com/vehicles-2025-cx-90"
    },
    {
      "src": "images/interior/cx90-feature-rear-climate.jpg",
      "caption": "Rear climate controls, vents and USB-C ports for the 2nd row (2024 press photo)",
      "credit": "Mazda North American Operations (press photo)",
      "page": "https://news.mazdausa.com/vehicles-2025-cx-90"
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
      iihs: 'TSP', charging: null,
      pros: ['Lowest price here', '2nd-row seats slide sideways and come out: wide center aisle or a flat floor that takes plywood (140.7 cu ft)', 'Roomy 3rd row (38.1 in legroom), seats 8', 'CabinTalk intercom standard'],
      cons: ['22 mpg, the worst of the vans', 'No ventilated seats, heated wheel or parking sensors on EX-L; no 360 camera on any trim', 'Oldest design here (2018); small 9-in screen', 'IIHS updated moderate overlap: Poor'],
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
      iihs: 'TSP', charging: null,
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
      id: 'pilot', short: 'Pilot', year: 2025, make: 'Honda', model: 'Pilot', trim: 'EX-L AWD', type: 'suv', power: 'gas', seats: 8,
      mpg: 21, kwhPer100: null, range: null, tank: 18.5, efficiencySource: FE(47753),
      drivetrain: 'AWD, 3.5L V6, 10-speed automatic',
      price: { typical: 45600, dest: 1395, note: 'EX-L AWD MSRP excludes $1,395 destination. Honda raised it from $45,300 in Sept 2024.', asOf: '2026-10-18',
        sources: [{ label: 'Honda 2025 Pilot pricing and EPA ratings', url: 'https://hondanews.com/en-US/releases/release-a7f6e80eb97eda86d5973d3850129eff-2025-honda-pilot-pricing-and-epa-ratings-2' }, { label: 'Honda 2025 Pilot specifications and features', url: 'https://hondanews.com/en-US/releases/release-16f7afa1eda16f08561d54be9a01e83e-2025-honda-pilot-specifications-features' }, FE(47753)] },
      space: { leg2: 40.8, leg3: 32.5, head3: 39.3, cargo3: 18.6, cargo2: 48.5, cargo1: 87.0, length: 199.9, tow: 5000, weight: 4497 },
      iihs: 'TSP', charging: null,
      pros: ['Seats 7 or 8: the 2nd-row middle seat comes out and stows under the cargo floor', 'Roomy 3rd row for an SUV (32.5 in legroom, 39.3 in headroom)', 'Tows 5,000 lb with AWD', 'CabinTalk intercom, front and rear parking sensors and wireless CarPlay standard'],
      cons: ['21 mpg, among the thirstiest here', 'No sunroof, vented seats, heated wheel or 360 camera on EX-L', 'Small 9-in screen', 'IIHS updated moderate overlap: Acceptable (TSP, not TSP+)'],
      f: {
        heatFront: 's', ventFront: ['u', 'Elite'], heatWheel: ['u', 'TrailSport/Elite'], heat2: ['u', 'Elite, outboard'], vent2: 'n',
        slide2: ['s', 'Whole row slides fore/aft'], captains: ['u', 'TrailSport (7-seat)'], ottoman: 'n', remove2: ['s', 'Middle seat stows under cargo floor'],
        power3: ['n', 'Manual 60/40'], moonroof: ['u', 'Panoramic, TrailSport and up'], climate: '3-zone',
        fridge: 'n', vacuum: 'n', cabinCam: 'n', intercom: ['s', 'CabinTalk'],
        seatReminder: ['s', 'Rear Seat Reminder'], slidingDoors: 'n', liftgate: ['u', 'Power on EX-L; hands-free Touring and up'],
        rse: 'n', shades: ['s', '2nd row'], booster: 'n',
        screens: '9 in touch + 7 in gauges', wirelessCP: 's', phoneKey: 'n', remoteStart: ['s', 'Key fob; app on Touring and up'], audio: ['u', '9 speakers; Bose on Touring and up'], usbc: '5 USB-C + 1 USB-A',
        assist: 'Adaptive cruise with low-speed follow + lane keeping with Traffic Jam Assist', hud: ['u', 'Elite'], cam360: ['u', 'TrailSport/Elite'], bsCam: 'n', digitalMirror: 'n', parkSensors: ['s', 'Front and rear'], onePedal: 'n',
        outlet: ['u', '115V, TrailSport/Elite'], v2l: 'n'
      },
      photo: { src: 'images/pilot.jpg', alt: 'Gray Honda Pilot EX-L SUV of the current generation, front left view', credit: 'Elise240SX', license: 'CC BY-SA 4.0', licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0', page: 'https://commons.wikimedia.org/wiki/File:2023_Honda_Pilot_EX-L_in_Modern_Steel_Metallic,_Front_Left,_04-07-2023.jpg', note: 'Same generation and trim (2023 EX-L); year differs.' }
    },
    {
      id: 'telluride', short: 'Telluride', year: 2025, make: 'Kia', model: 'Telluride', trim: 'SX AWD', type: 'suv', power: 'gas', seats: 8,
      mpg: 20, kwhPer100: null, range: null, tank: 18.8, efficiencySource: FE(48534),
      drivetrain: 'AWD, 3.8L V6, 8-speed automatic',
      price: { typical: 48190, dest: 1545, note: 'SX AWD MSRP excludes $1,545 destination. 8 seats standard; captain\'s chairs (7 seats) are a $600 option.', asOf: '2026-10-18',
        sources: [{ label: 'Kia Media 2025 Telluride pricing', url: 'https://www.kiamedia.com/us/en/models/telluride/2025/pricing' }, { label: 'Kia Media 2025 Telluride specifications', url: 'https://www.kiamedia.com/us/en/models/telluride/2025/specifications' }, { label: 'Kia Media 2025 Telluride features', url: 'https://www.kiamedia.com/us/en/models/telluride/2025/features' }] },
      space: { leg2: 42.4, leg3: 31.4, head3: 37.8, cargo3: 21.0, cargo2: 46.0, cargo1: 87.0, length: 196.9, tow: 5000, weight: 4325 },
      iihs: 'TSP+', charging: null,
      pros: ['IIHS Top Safety Pick+ for 2025', 'Most cargo of the gas SUVs here (21 cu ft behind the 3rd row)', '360 camera, blind-spot camera and Harman Kardon audio standard on SX', '8 seats standard, 5,000 lb towing', 'Dual sunroof and one-touch sliding 2nd row'],
      cons: ['20 mpg, among the thirstiest here', 'Wired-only CarPlay', 'Tight 3rd row (31.4 in legroom), manual fold', 'No heated or ventilated 2nd row, HUD or 120V outlet on SX'],
      f: {
        heatFront: 's', ventFront: 's', heatWheel: 's', heat2: ['u', 'SX-Prestige'], vent2: ['u', 'SX-Prestige'],
        slide2: ['s', 'One-touch slide and fold'], captains: ['o', '$600 package, 7 seats'], ottoman: 'n', remove2: 'n',
        power3: ['n', 'Manual fold'], moonroof: ['s', 'Dual sunroof, front opens'], climate: '3-zone (dual front + rear auto)',
        fridge: 'n', vacuum: 'n', cabinCam: 'n', intercom: ['s', 'Driver Talk'],
        seatReminder: ['s', 'Ultrasonic sensor'], slidingDoors: ['n', 'Hinged doors'], liftgate: 's',
        rse: ['o', 'Dealer accessory, about $1,500'], shades: ['s', '2nd row'], booster: 'n',
        screens: '12.3 in touch + 12.3 in gauges', wirelessCP: ['n', 'Wired only'], phoneKey: ['s', 'Digital Key 2 Touch'], remoteStart: ['s', 'Key fob and app'], audio: ['s', 'Harman Kardon, 10 speakers'], usbc: '6 charge ports in all 3 rows + USB-A data port',
        assist: 'Highway Driving Assist 2 + learning adaptive cruise (hands-on)', hud: ['u', 'SX-Prestige'], cam360: 's', bsCam: 's', digitalMirror: ['u', 'SX-Prestige'], parkSensors: ['s', 'Front and rear, with reverse auto braking'], onePedal: 'n',
        outlet: ['u', '110V, SX-Prestige'], v2l: 'n'
      },
      photo: { src: 'images/telluride.jpg', alt: 'Dark brown Kia Telluride SX V6 AWD SUV parked outside a Kia dealership', credit: 'deathpallie325', license: 'CC BY-SA 4.0', licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0', page: 'https://commons.wikimedia.org/wiki/File:2023_Kia_Telluride_front_end_(cropped).jpg', note: 'A 2023 SX V6 AWD; the 2025 looks the same.' }
    },
    {
      id: 'palisade', short: 'Palisade', year: 2025, make: 'Hyundai', model: 'Palisade', trim: 'SEL Premium AWD', type: 'suv', power: 'gas', seats: 7,
      mpg: 21, kwhPer100: null, range: null, tank: 18.8, efficiencySource: FE(47958),
      drivetrain: 'AWD, 3.8L V6, 8-speed automatic',
      price: { typical: 46550, dest: 1495, note: 'SEL Premium AWD MSRP excludes $1,495 freight. 7 seats with captain\'s chairs; an 8-seat bench is a $0 option. 2025 is the last year of the first generation.', asOf: '2026-10-18',
        sources: [{ label: 'Hyundai 2025 Palisade price sheet (June 2025)', url: 'https://www.hyundainews.com/assets/documents/original/66865-2025MYPalisadePriceSheet12Jun2025.pdf' }, { label: 'Hyundai 2025 Palisade specs and features', url: 'https://www.hyundainews.com/assets/documents/original/62617-2025PalisadeSpecsFeatures071224.pdf' }, { label: 'Hyundai News 2025 Palisade', url: 'https://www.hyundainews.com/en-us/models/hyundai-palisade-2025-palisade/specifications' }] },
      space: { leg2: 42.4, leg3: 31.4, head3: 37.2, cargo3: 18.0, cargo2: 45.8, cargo1: 86.4, length: 196.7, tow: 5000, weight: 4389 },
      iihs: null, charging: null,
      pros: ['Strong value: about $46,550 before freight', 'Heated and ventilated 2nd row plus heated wheel standard', '115V outlet, 360 camera and blind-spot camera standard', 'Highway Driving Assist 2 standard', '5,000 lb towing'],
      cons: ['21 mpg', 'IIHS updated moderate overlap: Poor (no 2025 award)', 'Only 18 cu ft behind the 3rd row', 'Intercom, HUD, premium audio and power 3rd row are Limited only'],
      f: {
        heatFront: 's', ventFront: 's', heatWheel: 's', heat2: ['s', 'Outboard'], vent2: ['s', 'Outboard'],
        slide2: ['s', 'Slide, power fold from cargo area'], captains: ['s', '7-seat; 8-seat bench is a $0 option'], ottoman: 'n', remove2: 'n',
        power3: ['u', 'Limited'], moonroof: ['s', 'Single sunroof'], climate: '3-zone (dual front + rear auto), 3rd-row vents',
        fridge: 'n', vacuum: 'n', cabinCam: 'n', intercom: ['u', 'Passenger Talk, Limited'],
        seatReminder: ['s', 'Ultrasonic sensor'], slidingDoors: ['n', 'Hinged doors'], liftgate: 's',
        rse: 'n', shades: ['s', '2nd row'], booster: 'n',
        screens: '12.3 in touch + 12.3 in gauges', wirelessCP: ['q', 'Likely wired only'], phoneKey: ['s', 'Digital Key 2 Touch'], remoteStart: ['s', 'Key fob and app'], audio: ['u', 'Harman Kardon, 12 speakers, Limited'], usbc: '6 USB-C + 1 USB-A, all 3 rows',
        assist: 'Highway Driving Assist 2 + Smart Cruise stop and go (hands-on)', hud: ['u', 'Limited'], cam360: 's', bsCam: 's', digitalMirror: ['u', 'Calligraphy'], parkSensors: ['s', 'Front and rear'], onePedal: 'n',
        outlet: ['s', '115V'], v2l: 'n'
      },
      photo: { src: 'images/palisade.jpg', alt: 'Dark red Hyundai Palisade Limited SUV on a dealer lot in Scottsdale, Arizona', credit: 'HJUdall', license: 'CC0', licenseUrl: 'http://creativecommons.org/publicdomain/zero/1.0/deed.en', page: 'https://commons.wikimedia.org/wiki/File:23_Hyundai_Palisade_Limited.jpg', note: 'A 2023 Limited; the 2025 looks the same.' }
    },
    {
      id: 'cx90', short: 'CX-90', year: 2025, make: 'Mazda', model: 'CX-90', trim: '3.3 Turbo Premium Plus', type: 'suv', power: 'gas', seats: 7,
      mpg: 25, kwhPer100: null, range: null, tank: 18.5, efficiencySource: FE(48568),
      drivetrain: 'AWD, 3.3L turbo inline-6 mild hybrid (280 hp), 8-speed automatic',
      price: { typical: 49600, dest: 1455, note: '3.3 Turbo Premium Plus MSRP excludes $1,455 destination. Runs on regular fuel.', asOf: '2026-10-18',
        sources: [{ label: 'Mazda 2025 CX-90 pricing and packaging', url: 'https://news.mazdausa.com/2024-07-30-2025-Mazda-CX-90-Pricing-and-Packaging' }, { label: 'PR Newswire 2025 CX-90 pricing', url: 'https://www.prnewswire.com/news-releases/2025-mazda-cx-90-pricing-and-packaging-302209271.html' }, { label: 'Mazda 2025 CX-90 spec deck', url: 'https://news.mazdausa.com/download/2025+CX-90+Spec+Deck.pdf' }, FE(48568)] },
      space: { leg2: 39.4, leg3: 30.4, head3: 36.8, cargo3: 14.9, cargo2: 40.0, cargo1: 74.2, length: 200.8, tow: 5000, weight: 4735 },
      iihs: 'TSP+', charging: null,
      pros: ['IIHS Top Safety Pick+', 'Loaded for the price: Nappa leather, heated and vented fronts, heated 2nd row and wheel, 360 camera, HUD, Bose', '25 mpg on regular fuel and 5,000 lb towing', 'Smooth rear-drive-based inline-6 with 280 hp'],
      cons: ['Tightest 3rd row of the SUVs (30.4 in legroom)', 'Small cargo area: 14.9 cu ft behind the 3rd row, 74.2 max', 'Only 7 seats and the 2nd row does not come out', 'Touchscreen works only in CarPlay/Android Auto; otherwise a rotary knob'],
      f: {
        heatFront: 's', ventFront: 's', heatWheel: 's', heat2: 's', vent2: ['u', 'Turbo S Premium Plus'],
        slide2: ['q', "Captain's chairs recline; slide not confirmed"], captains: ['s', '7-seat with walk-through'], ottoman: 'n', remove2: 'n',
        power3: ['n', 'Manual 60/40'], moonroof: ['s', 'Panoramic'], climate: '3-zone',
        fridge: 'n', vacuum: 'n', cabinCam: 'n', intercom: 'n',
        seatReminder: ['s', 'Rear Seat Alert'], slidingDoors: 'n', liftgate: 's',
        rse: 'n', shades: ['s', '2nd row'], booster: 'n',
        screens: '12.3 in center + 12.3 in gauges', wirelessCP: 's', phoneKey: ['q', 'Not listed'], remoteStart: ['s', 'Mazda app'], audio: ['s', 'Bose, 12 speakers'], usbc: '6 USB-C (2 per row)',
        assist: 'Radar cruise with Stop & Go + lane centering (Cruising & Traffic Support)', hud: 's', cam360: ['s', 'With See-Through View'], bsCam: 'n', digitalMirror: 'n', parkSensors: ['s', 'Front and rear'], onePedal: 'n',
        outlet: ['s', '150W, cargo area'], v2l: 'n'
      },
      photo: { src: 'images/cx90.jpg', alt: 'Dark blue Mazda CX-90 3.3 Turbo SUV, front left view in a dealer lot', credit: 'Elise240SX', license: 'CC BY-SA 4.0', licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0', page: 'https://commons.wikimedia.org/wiki/File:2024_Mazda_CX-90_Mild_Hybrid_Inline_6_Turbo_GS-L_AWD_in_Deep_Crystal_Blue_Mica,_Front_Left,_09-10-2023.jpg', note: 'Same generation and engine (2024 Canadian GS-L); trim and year differ.' }
    },
    {
      id: 'grand-highlander', short: 'Grand Highlander', year: 2025, make: 'Toyota', model: 'Grand Highlander Hybrid', trim: 'Limited AWD', type: 'suv', power: 'hybrid', seats: 7,
      mpg: 34, kwhPer100: null, range: null, tank: 17.2, efficiencySource: FE(48972),
      drivetrain: 'AWD, 2.5L hybrid, CVT',
      price: { typical: 51710, dest: 1450, note: 'Base MSRP. Toyota lists delivery separately; $1,450 is assumed for 2025.', asOf: '2026-10-18',
        sources: [{ label: 'Edmunds 2025 Grand Highlander Hybrid features and specs', url: 'https://www.edmunds.com/toyota/grand-highlander-hybrid/2025/features-specs/' }, { label: 'Toyota pressroom: 2025 Grand Highlander changes', url: 'https://pressroom.toyota.com/toyota-grand-highlander-adds-hybrid-nightshade-edition-and-le-grade-for-2025/' }, FE(48972)] },
      space: { leg2: 39.5, leg3: 33.5, head3: 37.2, cargo3: 20.6, cargo2: 57.9, cargo1: 97.5, length: 201.4, tow: 3500, weight: 4620 },
      iihs: null, charging: null,
      pros: ['34 mpg with AWD', 'Every seat-comfort feature standard: heated and ventilated fronts, heated 2nd row, heated wheel', '1500W outlets standard', '7 USB-C ports, JBL audio, phone key', 'Adult-usable 3rd row in a shorter body than the vans'],
      cons: ['Half the cargo of the vans behind the 3rd row (20.6 cu ft)', 'Hinged rear doors', 'No rear-seat camera or intercom; sunroof optional', 'No 2025 IIHS award (small overlap and headlights Acceptable)'],
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
      photo: { src: 'images/grand-highlander.jpg', alt: 'Toyota Grand Highlander Limited SUV at a dealership in Mesa, Arizona', credit: 'HJUdall', license: 'CC0', licenseUrl: 'http://creativecommons.org/publicdomain/zero/1.0/deed.en', page: 'https://commons.wikimedia.org/wiki/File:24_Toyota_Grand_Highlander_Limited.jpg', note: 'A 2024 Limited, same design as 2025; powertrain not confirmed.' }
    },
    {
      id: 'xc90', short: 'XC90', year: 2025, make: 'Volvo', model: 'XC90', trim: 'B5 AWD Plus', type: 'suv', power: 'gas', seats: 7,
      mpg: 26, kwhPer100: null, range: null, tank: 18.8, efficiencySource: FE(48147),
      drivetrain: 'AWD, 2.0L turbo 48V mild hybrid, 8-speed auto, 247 hp',
      price: { typical: 62550, dest: 1295, note: 'Refreshed 2025.5 Plus B5 (11.2 in screen); MSRP from secondary sources, not confirmed on volvocars.com. Early 2025 pre-refresh Plus was $60,700. $1,295 destination extra.', asOf: '2026-10-18',
        sources: [{ label: 'autoevolution: 2025 and 2025.5 XC90 pricing', url: 'https://www.autoevolution.com/news/volvo-announces-2025-model-year-changes-new-xc90-heading-to-dealers-as-20255-model-245848.html' }, { label: 'Volvo US press release', url: 'https://www.volvocars.com/us/media/press-releases/9DB757CF7B2C698C/' }, { label: 'CarsDirect 2025 XC90 trims', url: 'https://www.carsdirect.com/volvo/xc90/2025' }, FE(48147)] },
      space: { leg2: 37.0, leg3: 31.9, head3: 36.3, cargo3: 12.6, cargo2: 35.6, cargo1: 85.7, length: 195.0, tow: 5000, weight: 4589 },
      iihs: 'TSP+', charging: null,
      pros: ['IIHS Top Safety Pick+ for 2025', 'Tows 5,000 lb', '360 camera, heated wheel and heated 2nd row standard on Plus', 'Panoramic sunroof that opens, 4-zone climate', 'Google built-in maps and assistant'],
      cons: ['Small cargo area behind the 3rd row (12.6 cu ft)', 'Tight 2nd row for an SUV this size (37 in legroom)', 'Ventilated seats, HUD and premium audio need the Ultra trim', '26 mpg, below the hybrids; two 2025 rear-camera recalls: check the VIN'],
      f: {
        heatFront: 's', ventFront: ['u', 'Ultra'], heatWheel: 's', heat2: ['s', 'Outboard'], vent2: 'n',
        slide2: ['s', 'Slide fore/aft'], captains: ['o', '6-seat option'], ottoman: 'n', remove2: 'n',
        power3: ['n', 'Manual fold'], moonroof: ['s', 'Panoramic, opens'], climate: '4-zone',
        fridge: 'n', vacuum: 'n', cabinCam: 'n', intercom: 'n',
        seatReminder: 'q', slidingDoors: ['n', 'Hinged doors'], liftgate: ['q', 'Power; hands-free unverified on Plus'],
        rse: 'n', shades: ['u', 'Ultra'], booster: ['q', 'Integrated 2nd-row booster reported on Plus'],
        screens: '11.2 in touch + 12.3 in gauges', wirelessCP: ['q', 'Reports conflict; Google built-in standard'], phoneKey: ['q', 'App lock/unlock'], remoteStart: ['s', 'Volvo Cars app, with climate'], audio: ['u', 'Harman Kardon on Ultra'], usbc: 'USB-C front and 2nd row',
        assist: 'Pilot Assist: adaptive cruise + lane centering (hands-on)', hud: ['u', 'Ultra'], cam360: 's', bsCam: 'n', digitalMirror: 'n', parkSensors: ['s', 'Front and rear'], onePedal: 'n',
        outlet: ['q', 'Not listed'], v2l: 'n'
      },
      photo: { src: 'images/xc90.jpg', alt: 'Refreshed 2025 Volvo XC90 SUV in light gray at a dealership in Glen Cove, New York', credit: 'Kevauto', license: 'CC BY-SA 4.0', licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0', page: 'https://commons.wikimedia.org/wiki/File:2025_Volvo_XC90_(facelift),_front_4.11.25.jpg', note: 'US car; trim and powertrain not confirmed.' }
    },
    {
      id: 'ev9', short: 'EV9', year: 2025, make: 'Kia', model: 'EV9', trim: 'Wind AWD', type: 'suv', power: 'ev', seats: 7,
      mpg: null, kwhPer100: 41, range: 280, tank: null, efficiencySource: FE(48368),
      drivetrain: 'AWD, dual motor, long-range battery',
      price: { typical: 63900, dest: 1495, note: 'Wind AWD MSRP excludes $1,495 destination. Unchanged from 2024.', asOf: '2026-10-18',
        sources: [{ label: 'Kia Media 2025 EV9 pricing', url: 'https://www.kiamedia.com/us/en/models/ev9/2025/pricing' }, { label: 'Kia Media 2025 EV9 features', url: 'https://www.kiamedia.com/us/en/models/ev9/2025/features' }, FE(48368)] },
      space: { leg2: 42.8, leg3: 30.8, head3: 39.5, cargo3: 20.2, cargo2: 43.5, cargo1: 81.7, length: 197.2, tow: 3500, weight: 5688 },
      iihs: 'TSP+', charging: '800V: 10 to 80% in about 24 min. 10.9 kW at home. Tesla Supercharger access with a free Kia NACS adapter (CCS port, no built-in NACS on 2025).',
      pros: ['Lowest energy cost here', 'Most 2nd-row legroom (42.8 in) and a flat floor', 'Dual sunroof, heated wheel, ventilated seats standard', 'Phone key plus fingerprint start', 'Fastest charging here (800V); IIHS Top Safety Pick+ for 2025'],
      cons: ['Wired-only CarPlay, still on 2025', 'Tight 3rd row (30.8 in legroom)', 'Several 2025 recalls (seat bolts, rear motor, airbag sensor): check the VIN', 'Range drops in winter and at highway speed'],
      f: {
        heatFront: 's', ventFront: 's', heatWheel: 's', heat2: ['u', 'Land'], vent2: ['u', 'Land/GT-Line'],
        slide2: ['s', 'Bench slides and tilts'], captains: ['u', 'Land/GT-Line'], ottoman: ['u', 'Relaxation seats, GT-Line only for 2025'], remove2: 'n',
        power3: ['n', 'Manual 50/50'], moonroof: ['s', 'Dual: front opens, rear fixed'], climate: '3-zone, roof vents',
        fridge: 'n', vacuum: 'n', cabinCam: 'n', intercom: ['s', 'Passenger Talk'],
        seatReminder: ['s', 'Rear Occupant Alert'], slidingDoors: 'n', liftgate: 's',
        rse: ['n', 'Mounts only'], shades: ['u', 'Land'], booster: 'n',
        screens: 'Two 12.3 in + 5 in climate', wirelessCP: ['n', 'Wired only, still on 2025'], phoneKey: ['s', 'Plus fingerprint start'], remoteStart: ['s', 'App, with climate'], audio: ['u', 'Meridian, Land'], usbc: '6, 2 per row',
        assist: 'Highway Driving Assist 2 with lane changes (hands-on)', hud: ['q', 'GT-Line, unverified for 2025'], cam360: ['u', 'Land'], bsCam: ['u', 'Land'], digitalMirror: ['u', 'Land'], parkSensors: ['s', 'Front and rear'], onePedal: ['s', 'i-PEDAL'],
        outlet: ['n', '12V only on Wind'], v2l: ['u', 'Exterior V2L on higher trims (Land/GT-Line)']
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
      pros: ['IIHS Top Safety Pick+', 'HUD, 360 camera and power-fold 3rd row standard', 'Built-in booster seat in the 2nd-row center', 'Interior radar detects kids or pets left behind', 'Longest EV range (300 mi); tows 4,850 lb', 'Google built-in, Bose 14-speaker audio'],
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
