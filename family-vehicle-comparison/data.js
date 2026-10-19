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
    ],
    "pacifica": [
      {
        "src": "images/interior/pacifica-dash.jpg",
        "caption": "Pacifica dashboard: 10.1-inch Uconnect 5 touchscreen and 7-inch cluster (2022 Touring L shown; same dash as 2025 Select)",
        "credit": "deathpallie325, CC BY-SA 4.0",
        "page": "https://commons.wikimedia.org/wiki/File:2022_Chrysler_Pacifica_interior.jpg"
      },
      {
        "src": "images/interior/pacifica-rear.jpg",
        "caption": "2025 Pacifica 2nd-row Stow 'n Go captain's chair being folded into the floor (press photo, higher trim)",
        "credit": "Stellantis (press photo)",
        "page": "https://media.stellantisnorthamerica.com/newsrelease.do?id=26549&mid=722"
      },
      {
        "src": "images/interior/pacifica-feature-stow-n-go.jpg",
        "caption": "2025 Pacifica with 2nd and 3rd rows stowed in the floor: flat load floor, 140.5 cu ft (press photo)",
        "credit": "Stellantis (press photo)",
        "page": "https://media.stellantisnorthamerica.com/newsrelease.do?id=26549&mid=722"
      }
    ],
    "pacifica-hybrid": [
      {
        "src": "images/interior/pacifica-hybrid-dash.jpg",
        "caption": "2025 Pacifica Plug-in Hybrid dashboard: 10.1-inch Uconnect 5 and 7-inch cluster (Pinnacle shown; Select has the same screens)",
        "credit": "Stellantis (press photo)",
        "page": "https://media.stellantisnorthamerica.com/image-gallery.do?method=view&imageGalleryId=1472"
      },
      {
        "src": "images/interior/pacifica-hybrid-rear.jpg",
        "caption": "2025 Pacifica Plug-in Hybrid removable 2nd-row captain's chairs and 3rd row (Pinnacle shown)",
        "credit": "Stellantis (press photo)",
        "page": "https://media.stellantisnorthamerica.com/image-gallery.do?method=view&imageGalleryId=1472"
      },
      {
        "src": "images/interior/pacifica-hybrid-feature-power-screen.jpg",
        "caption": "Uconnect 5 hybrid power-flow screen showing electric mode and battery use",
        "credit": "Stellantis (press photo)",
        "page": "https://media.stellantisnorthamerica.com/image-gallery.do?method=view&imageGalleryId=1472"
      }
    ],
    "voyager": [
      {
        "src": "images/interior/voyager-dash.jpg",
        "caption": "2025 Voyager dashboard: 10.1-inch Uconnect 5 touchscreen and 7-inch cluster, now standard",
        "credit": "Stellantis (press photo)",
        "page": "https://media.stellantisnorthamerica.com/image-gallery.do?method=view&imageGalleryId=1485"
      },
      {
        "src": "images/interior/voyager-rear.jpg",
        "caption": "2025 Voyager 2nd-row Stow 'n Go captain's chairs and 3rd-row bench",
        "credit": "Stellantis (press photo)",
        "page": "https://media.stellantisnorthamerica.com/image-gallery.do?method=view&imageGalleryId=1485"
      },
      {
        "src": "images/interior/voyager-feature-cargo.jpg",
        "caption": "2025 Voyager cargo well behind the 3rd row (32.3 cu ft)",
        "credit": "Stellantis (press photo)",
        "page": "https://media.stellantisnorthamerica.com/image-gallery.do?method=view&imageGalleryId=1485"
      }
    ],
    "idbuzz": [
      {
        "src": "images/interior/idbuzz-dash.jpg",
        "caption": "2025 ID. Buzz dashboard: 12.9-inch touchscreen and 5.3-inch driver display (standard on every trim)",
        "credit": "MotorWeek",
        "page": "https://www.motorweek.org/reviews/road_tests/2025-volkswagen-id-buzz/"
      },
      {
        "src": "images/interior/idbuzz-rear.jpg",
        "caption": "2nd-row seat with a child seat and the 50/50 3rd-row bench with a booster (3rd-row legroom is 42.4 in)",
        "credit": "MotorWeek",
        "page": "https://www.motorweek.org/reviews/road_tests/2025-volkswagen-id-buzz/"
      },
      {
        "src": "images/interior/idbuzz-feature-cargo.jpg",
        "caption": "3rd row folded flat, level with the Flexboard cargo shelf (Flexboard is Pro S Plus and up)",
        "credit": "MotorWeek",
        "page": "https://www.motorweek.org/reviews/road_tests/2025-volkswagen-id-buzz/"
      }
    ],
    "traverse": [
      {
        "src": "images/interior/traverse-dash.jpg",
        "caption": "Traverse dashboard: 17.7-inch touchscreen and 11-inch digital cluster (2024 RS shown; same screens on 2025 LT)",
        "credit": "General Motors (press photo, via Kelley Blue Book)",
        "page": "https://www.kbb.com/chevrolet/traverse/2024/"
      }
    ],
    "atlas": [
      {
        "src": "images/interior/atlas-dash.jpg",
        "caption": "Atlas dashboard: 12-inch touchscreen and 10.25-inch Digital Cockpit Pro (2025 Peak Edition shown, based on SE with Technology)",
        "credit": "Kelley Blue Book (photo)",
        "page": "https://www.kbb.com/volkswagen/atlas/2025/"
      }
    ],
    "ascent": [
      {
        "src": "images/interior/ascent-dash.jpg",
        "caption": "Ascent dashboard: 11.6-inch touchscreen and analog gauges (2023 Onyx Edition shown; same dash layout on 2025 Limited)",
        "credit": "Subaru of America (press photo)",
        "page": "https://media.subaru.com/image-gallery.do?method=view&imageGalleryId=460"
      },
      {
        "src": "images/interior/ascent-rear.jpg",
        "caption": "Ascent 2nd-row bench in brown leather (2023 Touring shown; 2025 Limited has captain's chairs standard)",
        "credit": "Subaru of America (press photo)",
        "page": "https://media.subaru.com/image-gallery.do?method=view&imageGalleryId=460"
      }
    ],
    "r1s": [
      {
        "src": "images/interior/r1s-dash.jpg",
        "caption": "2025 R1S dashboard: 15.6-inch touchscreen and 12.3-inch driver display (no CarPlay)",
        "credit": "MotorWeek",
        "page": "https://www.motorweek.org/reviews/road_tests/2025-rivian-r1s/"
      },
      {
        "src": "images/interior/r1s-rear.jpg",
        "caption": "2nd-row bench and 3rd row under the panoramic glass roof",
        "credit": "MotorWeek",
        "page": "https://www.motorweek.org/reviews/road_tests/2025-rivian-r1s/"
      },
      {
        "src": "images/interior/r1s-feature-flat-floor.jpg",
        "caption": "2nd and 3rd rows folded: nearly flat load floor (about 3 degrees, per Rivian)",
        "credit": "MotorWeek",
        "page": "https://www.motorweek.org/reviews/road_tests/2025-rivian-r1s/"
      }
    ]
  };

  // Feature rows. Status codes: s standard, o option, u higher trim only, n not offered, q unverified. Text rows use `t`.
  const FEATURE_GROUPS = [
    { name: 'Seats & comfort', rows: [
      ['heatFront', 'Heated front seats'], ['ventFront', 'Ventilated front seats'], ['heatWheel', 'Heated steering wheel'],
      ['heat2', 'Heated 2nd row'], ['vent2', 'Ventilated 2nd row'], ['slide2', 'Sliding 2nd row'],
      ['captains', "Captain's chairs"], ['ottoman', '2nd-row leg rests'], ['remove2', 'Removable 2nd row'],
      ['flat2', '2nd row folds flat'], ['flat3', '3rd row folds flat'], ['power3', 'Power-fold 3rd row'], ['moonroof', 'Sunroof'], ['climate', 'Climate zones', 'text']
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
      pros: ['Cheapest here after the Voyager', '2nd-row seats slide sideways and come out: wide center aisle or a flat floor that takes plywood (140.7 cu ft)', 'Roomy 3rd row (38.1 in legroom), seats 8', 'CabinTalk intercom standard'],
      cons: ['22 mpg', 'No ventilated seats, heated wheel or parking sensors on EX-L; no 360 camera on any trim', 'Oldest design here (2018); small 9-in screen', 'IIHS updated moderate overlap: Poor'],
      f: {
        heatFront: 's', ventFront: ['u', 'Elite'], heatWheel: ['u', 'Elite'], heat2: 'n', vent2: 'n',
        slide2: ['s', 'Fore/aft and side to side (Magic Slide)'], captains: ['n', '8-seat layout'], ottoman: 'n', remove2: ["s", "All three Magic Slide seats come out"],
        flat2: ["n", "Does not fold flat; remove instead"], flat3: ["s", "Magic Seat folds into floor well, manual 60/40"],
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
      pros: ['Only one with a fridge; vacuum in the same package (Limited)', 'Best mpg of the gas and hybrid models (36), about 650 miles per tank', "Captain's chairs with ottomans and a very long slide", 'Radar rear-seat reminder honks and alerts your phone', 'Hands-free sliding doors, 4-zone climate, JBL audio, 2nd- and 3rd-row shades'],
      cons: ['2nd-row seats don’t come out: max cargo 101 cu ft vs 141 to 145 in the other vans', 'Engine drones under hard acceleration', 'Heated wheel, heated 2nd row, HUD and 360 camera are Platinum-only', 'IIHS updated moderate overlap: Marginal'],
      f: {
        heatFront: 's', ventFront: 's', heatWheel: ['u', 'Platinum'], heat2: ['u', 'Platinum'], vent2: 'n',
        slide2: ['s', 'Super-long slide'], captains: ['s', '7-seat'], ottoman: ['s', 'Ottomans'], remove2: ['n', 'Fixed; seats slide but do not come out'],
        flat2: ['n', 'Does not fold flat or come out'], flat3: ['s', 'Folds into floor well, manual 60/40'],
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
      pros: ['Cheapest hybrid here', 'Most cargo behind the 3rd row (40.2 cu ft); 145.1 max', 'Rear-seat camera and intercom standard on EX', 'Hands-free sliding doors and liftgate', 'Outboard 2nd-row seats come out; center seat becomes a table'],
      cons: ['FWD only', 'EX has no sunroof, ventilated seats, heated wheel or 360 camera', 'Tows 2,500 lb', 'IIHS updated moderate overlap: Marginal'],
      f: {
        heatFront: 's', ventFront: ['u', 'SX'], heatWheel: ['u', 'SX Prestige'], heat2: ['u', 'SX Prestige lounge seats'], vent2: ['u', 'SX Prestige lounge seats'],
        slide2: ['s', 'Center seat slides far forward'], captains: ['u', 'SX Prestige 7-seat'], ottoman: ['u', 'SX Prestige'], remove2: ["s", "Outboard seats come out; center folds to a table"],
        flat2: ["n", "Does not fold flat; remove instead"], flat3: ["s", "Sink-N-Stow into floor well, manual"],
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
      id: 'pacifica', short: 'Pacifica', year: 2025, make: 'Chrysler', model: 'Pacifica', trim: 'Select AWD', type: 'van', power: 'gas', seats: 7,
      mpg: 20, kwhPer100: null, range: null, tank: 19, efficiencySource: FE(48255),
      drivetrain: 'AWD, 3.6L V6, 9-speed automatic',
      price: { typical: 45445, dest: 1995, note: "Select AWD MSRP ($42,450 FWD + $2,995 AWD) excludes $1,995 destination. AWD keeps 2nd- and 3rd-row Stow 'n Go; 7 seats only. Max cargo 140.5 cu ft with both rows stowed in the floor, no seat removal.", asOf: '2026-10-18',
        sources: [{ label: 'Stellantis 2025 Pacifica fact sheet', url: 'https://media.stellantisnorthamerica.com/newsrelease.do?id=26107&mid=722' }, { label: "Stellantis: 20 years of Stow 'n Go", url: 'https://media.stellantisnorthamerica.com/newsrelease.do?id=26549&mid=722' }, { label: 'CarBuzz 2025 Pacifica pricing', url: 'https://carbuzz.com/pricing-2025-chrysler-pacifica-increases-base-msrp/' }, { label: 'Stellantis 2025 Pacifica specifications', url: 'https://media.stellantisnorthamerica.com/view-spec.do?id=26104' }, FE(48255)] },
      space: { leg2: 39.0, leg3: 36.5, head3: 38.7, cargo3: 32.3, cargo2: 87.5, cargo1: 140.5, length: 204.3, tow: 3600, weight: 4883 },
      iihs: null, charging: null,
      pros: ["Stow 'n Go: 2nd and 3rd rows fold into the floor, 140.5 cu ft flat floor without lifting a seat out", 'Only minivan here with AWD that keeps fold-into-floor 2nd row', 'Heated wheel, 3-zone auto climate, remote start and 2nd-row shades standard', 'Optional Theater Family Group: dual 10.1 in rear screens, FamCAM, Stow n Vac, 115V outlet, hands-free doors'],
      cons: ['20 mpg with AWD, among the thirstiest here', "Stow 'n Go 2nd-row chairs are thinner and less comfy than Odyssey or Carnival chairs", 'No ventilated seats on Select; no lane centering', 'No IIHS award; updated moderate overlap Marginal'],
      f: {
        heatFront: 's', ventFront: ['u', 'Limited'], heatWheel: 's', heat2: ['o', 'Theater Family Group'], vent2: 'n',
        slide2: ['q', "Stow 'n Go chairs reportedly do not slide"], captains: ['s', '7-seat (AWD)'], ottoman: 'n', remove2: ['n', "Stow 'n Go chairs fold into floor, not meant to be removed"],
        flat2: ['s', "Stow 'n Go: folds into the floor"], flat3: ['s', "Stow 'n Go: folds into floor well, manual"],
        power3: ['u', 'Pinnacle'], moonroof: ['o', 'Dual-pane'], climate: '3-zone',
        fridge: 'n', vacuum: ['o', "Stow 'n Vac, Theater Family Group"], cabinCam: ['o', 'FamCAM, Theater Family Group'], intercom: ['q', 'Not listed'],
        seatReminder: ['q', 'Likely door-logic rear seat reminder'], slidingDoors: ['s', 'Power; hands-free optional'], liftgate: ['o', 'Theater Family Group'],
        rse: ['o', 'Dual 10.1 in Uconnect Theater'], shades: ['s', '2nd row'], booster: 'n',
        screens: '10.1 in touch + 7 in gauges', wirelessCP: 's', phoneKey: 'n', remoteStart: ['s', 'Key fob'], audio: ['o', 'Alpine 13 speakers'], usbc: 'USB-A and USB-C front and rear (count unverified)',
        assist: 'Adaptive cruise with Stop and Go + Lane Departure Warning-Plus (no lane centering)', hud: 'n', cam360: ['o', 'Safety Sphere Group'], bsCam: 'n', digitalMirror: 'n', parkSensors: ['s', 'Rear with auto stop; front optional'], onePedal: 'n',
        outlet: ['o', '115V, Theater Family Group'], v2l: 'n'
      },
      photo: { src: 'images/pacifica.jpg', alt: 'White 2024 Chrysler Pacifica Touring L RoadTripper minivan, front left view', credit: 'Mr.choppers', license: 'CC BY-SA 4.0', licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0', page: 'https://commons.wikimedia.org/wiki/File:2024_Chrysler_Pacifica_Touring_L_RoadTripper_in_Bright_White,_front_left.jpg', note: 'Same generation and styling; 2024 Touring L trim shown.' }
    },
    {
      id: 'pacifica-hybrid', short: 'Pacifica Hybrid', year: 2025, make: 'Chrysler', model: 'Pacifica Plug-in Hybrid', trim: 'Select', type: 'van', power: 'hybrid', seats: 7,
      mpg: 30, kwhPer100: null, range: null, tank: 16.5, efficiencySource: FE(48656),
      drivetrain: 'FWD, 3.6L V6 plug-in hybrid, eFlite EVT',
      price: { typical: 51055, dest: 1995, note: "Hybrid Select MSRP excludes $1,995 destination. No Stow 'n Go 2nd row (battery is under the floor): the captain's chairs are removable, so 140.5 cu ft max cargo assumes you lift them out. FWD only.", asOf: '2026-10-18',
        sources: [{ label: 'Stellantis 2025 Pacifica fact sheet', url: 'https://media.stellantisnorthamerica.com/newsrelease.do?id=26107&mid=722' }, { label: "Stellantis: 20 years of Stow 'n Go (Hybrid seating)", url: 'https://media.stellantisnorthamerica.com/newsrelease.do?id=26549&mid=722' }, { label: 'CarBuzz 2025 Pacifica pricing', url: 'https://carbuzz.com/pricing-2025-chrysler-pacifica-increases-base-msrp/' }, { label: 'Stellantis 2025 Pacifica Hybrid specifications', url: 'https://media.stellantisnorthamerica.com/view-spec.do?id=26105' }, FE(48656)] },
      space: { leg2: 39.0, leg3: 36.5, head3: 38.7, cargo3: 32.3, cargo2: 87.5, cargo1: 140.5, length: 204.3, tow: 0, weight: 5010 },
      iihs: null, charging: null,
      pros: ['Only plug-in hybrid van: 32 miles electric range, 82 MPGe; about 2 h Level 2 charge (16 kWh battery)', '30 mpg on gas, about 520 miles total range', "Removable 2nd-row captain's chairs; 3rd row folds into the floor (Stow 'n Go)", 'Optional Premium Group: vented seats, sunroof, 360 camera, Harman Kardon 20 speakers'],
      cons: ['Max cargo (140.5 cu ft) needs the heavy 2nd-row chairs removed; they do not fold or stow', 'Towing not recommended', 'Pricier than gas Pacifica; FWD only', 'No IIHS award; IIHS has only rated its headlights'],
      f: {
        heatFront: 's', ventFront: ['o', 'Premium Group'], heatWheel: 's', heat2: ['q', 'Not listed on Hybrid Select'], vent2: 'n',
        slide2: ['q', 'Not verified'], captains: ['s', '7-seat'], ottoman: 'n', remove2: ['s', "Captain's chairs lift out"],
        flat2: ['n', 'Does not fold; removable only'], flat3: ['s', "Stow 'n Go: folds into floor well, manual"],
        power3: 'n', moonroof: ['o', 'Dual-pane, Premium Group'], climate: '3-zone',
        fridge: 'n', vacuum: ['n', "Stow 'n Vac is gas only"], cabinCam: ['o', 'FamCAM, Theater group'], intercom: ['q', 'Not listed'],
        seatReminder: ['q', 'Likely door-logic rear seat reminder'], slidingDoors: ['s', 'Power; hands-free optional'], liftgate: 'o',
        rse: ['o', 'Dual 10.1 in Uconnect Theater'], shades: ['s', '2nd row'], booster: 'n',
        screens: '10.1 in touch + 7 in gauges', wirelessCP: 's', phoneKey: 'n', remoteStart: ['s', 'Key fob'], audio: ['o', 'Alpine 13 or Harman Kardon 20 speakers'], usbc: 'USB-A and USB-C front and rear (count unverified)',
        assist: 'Adaptive cruise with Stop and Go + Lane Departure Warning-Plus (no lane centering)', hud: 'n', cam360: ['o', 'Premium Group'], bsCam: 'n', digitalMirror: 'n', parkSensors: ['s', 'Rear with auto stop; front optional'], onePedal: 'n',
        outlet: ['o', '115V, Theater group'], v2l: 'n'
      },
      photo: { src: 'images/pacifica-hybrid.jpg', alt: 'Silver 2024 Chrysler Pacifica Plug-In Hybrid Select minivan, front right view', credit: 'Elise240SX', license: 'CC BY-SA 4.0', licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0', page: 'https://commons.wikimedia.org/wiki/File:2024_Chrysler_Pacifica_Plug-In_Hybrid_Select_in_Silver_Mist,_front_right,_2025-08-24.jpg', note: 'Same generation and trim; 2024 model year shown.' }
    },
    {
      id: 'voyager', short: 'Voyager', year: 2025, make: 'Chrysler', model: 'Voyager', trim: 'LX', type: 'van', power: 'gas', seats: 7,
      mpg: 22, kwhPer100: null, range: null, tank: 19, efficiencySource: FE(48253),
      drivetrain: 'FWD, 3.6L V6, 9-speed automatic',
      price: { typical: 39995, dest: 1995, note: "LX is the only Voyager trim; MSRP excludes $1,995 destination. 2nd and 3rd rows both Stow 'n Go, so 140.5 cu ft max cargo needs no seat removal.", asOf: '2026-10-18',
        sources: [{ label: 'Stellantis: 2025 Chrysler Voyager returns', url: 'https://media.stellantisnorthamerica.com/newsrelease.do?id=26223&mid=1104' }, { label: 'Stellantis 2025 Voyager specifications', url: 'https://media.stellantisnorthamerica.com/view-spec.do?id=26239' }, { label: "Stellantis: 20 years of Stow 'n Go", url: 'https://media.stellantisnorthamerica.com/newsrelease.do?id=26549&mid=722' }, FE(48253)] },
      space: { leg2: 39.0, leg3: 36.5, head3: 38.7, cargo3: 32.3, cargo2: 87.5, cargo1: 140.5, length: 203.8, tow: 3600, weight: 4330 },
      iihs: null, charging: null,
      pros: ['Cheapest vehicle here by a wide margin', "Stow 'n Go 2nd and 3rd rows: 140.5 cu ft flat floor without removing seats", 'Heated seats and wheel, 3-zone auto climate, remote start, power doors and liftgate standard', '22 mpg, lightest van here'],
      cons: ['Halogen headlights rated Poor by IIHS; no award', 'No lane keeping or lane centering; no sunroof, 360 camera, rear screens or vented seats offered', 'Only 6 speakers; leatherette seats; FWD only', 'Single trim, so no way to add options'],
      f: {
        heatFront: 's', ventFront: 'n', heatWheel: 's', heat2: 'n', vent2: 'n',
        slide2: ['q', "Stow 'n Go chairs reportedly do not slide"], captains: ['s', '7-seat only'], ottoman: 'n', remove2: ['n', "Stow 'n Go chairs fold into floor, not meant to be removed"],
        flat2: ['s', "Stow 'n Go: folds into the floor"], flat3: ['s', "Stow 'n Go: folds into floor well, manual"],
        power3: 'n', moonroof: 'n', climate: '3-zone',
        fridge: 'n', vacuum: 'n', cabinCam: 'n', intercom: 'n',
        seatReminder: ['q', 'Likely door-logic rear seat reminder'], slidingDoors: ['s', 'Power, not hands-free'], liftgate: ['n', 'Power, not hands-free'],
        rse: 'n', shades: ['s', '2nd row'], booster: 'n',
        screens: '10.1 in touch + 7 in gauges', wirelessCP: 's', phoneKey: 'n', remoteStart: ['s', 'Key fob'], audio: ['n', '6 speakers'], usbc: 'USB-A and USB-C front and rear (count unverified)',
        assist: 'Adaptive cruise + blind-spot and rear cross path; no lane keeping', hud: 'n', cam360: 'n', bsCam: 'n', digitalMirror: 'n', parkSensors: ['s', 'Rear with auto stop'], onePedal: 'n',
        outlet: 'n', v2l: 'n'
      },
      photo: { src: 'images/voyager.jpg', alt: 'Red 2020 Chrysler Voyager LXi minivan, front right view', credit: 'Cutlass', license: 'CC0', licenseUrl: 'http://creativecommons.org/publicdomain/zero/1.0/deed.en', page: 'https://commons.wikimedia.org/wiki/File:2020_Chrysler_Voyager_LXI_in_Velvet_Red_Pearlcoat,_front_right,_12-31-2021.jpg', note: 'Same body and front styling; 2020 LXi shown.' }
    },
    {
      id: 'idbuzz', short: 'ID. Buzz', year: 2025, make: 'Volkswagen', model: 'ID. Buzz', trim: 'Pro S RWD', type: 'van', power: 'ev', seats: 7,
      mpg: null, kwhPer100: 41, range: 234, tank: null, efficiencySource: FE(48444),
      drivetrain: 'RWD, single motor (282 hp), 86 kWh net battery',
      price: { typical: 59995, dest: 1550, note: 'Pro S RWD MSRP excludes $1,550 destination. Pro S Plus is $63,495 RWD / $67,995 4Motion. Max cargo assumes the 3rd row is removed. Tow rating needs a hitch (standard only on Pro S Plus).', asOf: '2026-10-18',
        sources: [{ label: 'VW Media 2025 ID. Buzz pricing (PDF)', url: 'https://media.vw.com/assets/documents/original/18287-2025IDBuzzPricing.pdf' }, { label: 'VW Media 2025 ID. Buzz tech specs (PDF)', url: 'https://media.vw.com/assets/documents/original/18291-2025IDBuzzTechSpecsFINAL.pdf' }, FE(48444)] },
      space: { leg2: 39.9, leg3: 42.4, head3: 38.7, cargo3: 18.6, cargo2: 75.5, cargo1: 145.5, length: 195.4, tow: 2600, weight: 5968 },
      iihs: null, charging: '200 kW DC: 10 to 80% in about 26 min. 11 kW at home. CCS port; Tesla Supercharger access with an adapter.',
      pros: ['Roomiest 3rd row here (42.4 in legroom) and huge cargo (145.5 cu ft max)', 'Power sliding doors with power sliding windows', 'Heated and ventilated fronts, heated 2nd row and wheel standard', '7 fast USB-C ports (45W), 2 in every rear row', 'Removable 3rd row and Buzz Box console'],
      cons: ['Short range for the price (234 mi) and slower charging than EV9', '2nd row is bolted in; folded floor is not fully level', '2025 stop-sale/recall: 3rd-row bench had 3 seat widths but 2 belts (dealer trim fix)', 'No IIHS award for 2025; HUD, 360 cam, premium audio only on Pro S Plus'],
      f: {
        heatFront: 's', ventFront: 's', heatWheel: 's', heat2: ['s', 'Outboard'], vent2: 'n',
        slide2: ['s', '60/40 bench slides'], captains: ['u', 'Pro S Plus ($695 RWD, std on 4Motion)'], ottoman: 'n', remove2: ['n', 'Bolted in; VW says not customer-removable'],
        power3: ['n', 'Manual 50/50'], moonroof: ['u', 'Electrochromic glass roof: Pro S Plus option, std 1st Edition'], climate: '3-zone',
        fridge: 'n', vacuum: 'n', cabinCam: 'n', intercom: 'n',
        seatReminder: 'q', slidingDoors: ['s', 'Power, both sides'], liftgate: ['u', 'Power std; hands-free Easy Open on Pro S Plus'],
        rse: 'n', shades: 'q', booster: 'n',
        screens: '12.9 in touch + 5.3 in gauges', wirelessCP: 's', phoneKey: 'n', remoteStart: ['s', 'Car-Net app climate'], audio: ['u', 'Harman Kardon, Pro S Plus'], usbc: '7 at 45W (2 front, 1 door, 2 per rear row) + dashcam port',
        assist: 'IQ.DRIVE Travel Assist with lane centering (hands-on)', hud: ['u', 'AR HUD, Pro S Plus'], cam360: ['u', 'Pro S Plus'], bsCam: 'n', digitalMirror: 'n', parkSensors: ['s', 'Front and rear'], onePedal: ['n', 'B mode adds strong regen, not full one-pedal'],
        outlet: ['s', '110V 150W under passenger seat'], v2l: 'n',
        flat2: ['s', 'Seatbacks fold flat (VW); floor not fully level, not removable'], flat3: ['s', 'Folds 50/50 flat; also removable (heavy)']
      },
      photo: { src: 'images/idbuzz.jpg', alt: 'Volkswagen ID. Buzz electric van in two-tone Pomelo Yellow and white at a dealership', credit: 'Elise240SX', license: 'CC BY-SA 4.0', licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0', page: 'https://commons.wikimedia.org/wiki/File:2025_Volkswagen_ID._Buzz_1st_Edition_4MOTION_in_Candy_White_%26_Pomelo_Yellow_Metallic_two-tone,_front_right,_2025-05-18.jpg', note: '2025 US 1st Edition 4Motion shown; Pro S looks the same.' }
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
        slide2: ['s', 'Whole row slides fore/aft'], captains: ['u', 'TrailSport (7-seat)'], ottoman: 'n', remove2: ["s", "Middle seat only; stows under cargo floor"],
        flat2: ["s", "40/20/40, one-touch fold flat"], flat3: ["s", "60/40, manual fold flat"],
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
      pros: ['IIHS Top Safety Pick+ for 2025', '21 cu ft behind the 3rd row', '360 camera, blind-spot camera and Harman Kardon audio standard on SX', '8 seats standard, 5,000 lb towing', 'Dual sunroof and one-touch sliding 2nd row'],
      cons: ['20 mpg, among the thirstiest here', 'Wired-only CarPlay', 'Tight 3rd row (31.4 in legroom), manual fold', 'No heated or ventilated 2nd row, HUD or 120V outlet on SX'],
      f: {
        heatFront: 's', ventFront: 's', heatWheel: 's', heat2: ['u', 'SX-Prestige'], vent2: ['u', 'SX-Prestige'],
        slide2: ['s', 'One-touch slide and fold'], captains: ['o', '$600 package, 7 seats'], ottoman: 'n', remove2: ["n", "Not removable"],
        flat2: ["s", "60/40 bench folds flat"], flat3: ["s", "60/40, manual fold flat"],
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
        slide2: ['s', 'Slide, power fold from cargo area'], captains: ['s', '7-seat; 8-seat bench is a $0 option'], ottoman: 'n', remove2: ["n", "Not removable"],
        flat2: ["s", "Captain's chairs fold flat, one-touch"], flat3: ["s", "Manual on SEL Premium; power on Limited"],
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
        slide2: ['q', "Captain's chairs recline; slide not confirmed"], captains: ['s', '7-seat with walk-through'], ottoman: 'n', remove2: ["n", "Not removable"],
        flat2: ["s", "Captain's chairs fold flat"], flat3: ["s", "50/50, manual fold flat"],
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
        slide2: ['s', 'Slide and recline'], captains: ['s', 'Or 8-seat bench'], ottoman: 'n', remove2: ["n", "Not removable"],
        flat2: ["s", "Captain's chairs fold flat"], flat3: ["s", "60/40, manual fold flat"],
        power3: 'n', moonroof: ['o', 'Panoramic'], climate: '3-zone',
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
        slide2: ['s', 'Slide fore/aft'], captains: ['o', '6-seat option'], ottoman: 'n', remove2: ["n", "Not removable"],
        flat2: ["s", "40/20/40 folds flat"], flat3: ["s", "50/50, manual fold flat"],
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
      pros: ['Lowest energy cost here (tied with ID. Buzz)', 'Most 2nd-row legroom (42.8 in) and a flat floor', 'Dual sunroof, heated wheel, ventilated seats standard', 'Phone key plus fingerprint start', 'Fastest charging here (800V); IIHS Top Safety Pick+ for 2025'],
      cons: ['Wired-only CarPlay, still on 2025', 'Tight 3rd row (30.8 in legroom)', 'Several 2025 recalls (seat bolts, rear motor, airbag sensor): check the VIN', 'Range drops in winter and at highway speed'],
      f: {
        heatFront: 's', ventFront: 's', heatWheel: 's', heat2: ['u', 'Land'], vent2: ['u', 'Land/GT-Line'],
        slide2: ['s', 'Bench slides and tilts'], captains: ['u', 'Land/GT-Line'], ottoman: ['u', 'Relaxation seats, GT-Line only for 2025'], remove2: ["n", "Not removable"],
        flat2: ["s", "60/40 bench folds flat"], flat3: ["s", "50/50, manual on Wind; power on Land and up"],
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
      cons: ['Priciest here: about $39k more than the Voyager', 'Least cargo (about 11 cu ft behind the 3rd row) and tightest 2nd row', 'Buggy launch software; early cars get a computer upgrade', 'Most controls are in the touchscreen'],
      f: {
        heatFront: 's', ventFront: ['q', 'Reports conflict for Plus'], heatWheel: 's', heat2: ['s', 'Outboard'], vent2: 'n',
        slide2: ['s', 'Manual fore/aft'], captains: ['o', '6-seat'], ottoman: 'n', remove2: ["n", "Not removable"],
        flat2: ["s", "40/20/40 folds flat"], flat3: ["s", "50/50, power fold flat"],
        power3: 's', moonroof: ['s', 'Fixed glass roof, doesn’t open'], climate: '4-zone',
        fridge: 'n', vacuum: 'n', cabinCam: ['n', 'Radar detects occupants'], intercom: 'q',
        seatReminder: ['s', 'Interior radar'], slidingDoors: 'n', liftgate: 's',
        rse: 'n', shades: ['s', '2nd row'], booster: ['s', '2nd-row center seat'],
        screens: '14.5 in portrait touch + 9 in gauges + HUD', wirelessCP: ['s', 'Plus Google built-in'], phoneKey: 's', remoteStart: ['s', 'App, with climate'], audio: ['s', 'Bose, 14 speakers'], usbc: '6 USB-C, 2 per row',
        assist: 'Pilot Assist with lane changes (hands-on); lidar', hud: 's', cam360: 's', bsCam: 'n', digitalMirror: 'n', parkSensors: 's', onePedal: 's',
        outlet: 's', v2l: ['q', 'Hardware ready; needs Volvo home charger']
      },
      photo: { src: 'images/ex90.jpg', alt: 'Volvo EX90 electric SUV photographed in Stuttgart-Vaihingen', credit: 'Alexander Migl', license: 'CC BY-SA 4.0', licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0', page: 'https://commons.wikimedia.org/wiki/File:Volvo_EX90_DSC_7810.jpg', note: 'May be a non-US trim.' }
    },
    {
      id: 'traverse', short: 'Traverse', year: 2025, make: 'Chevrolet', model: 'Traverse', trim: 'LT AWD', type: 'suv', power: 'gas', seats: 7,
      mpg: 21, kwhPer100: null, range: null, tank: 21.7, efficiencySource: FE(48117),
      drivetrain: 'AWD, 2.5L turbo 4-cyl (328 hp), 8-speed automatic',
      price: { typical: 42695, dest: 1495, note: "LT AWD MSRP excludes destination ($1,395 at launch, $1,495 later in 2025). No LS for 2025; LT is the base trim. Captain's chairs standard (8-seat bench no cost). Max cargo 97.6 cu ft with 2nd and 3rd rows folded flat; seats are not removable.", asOf: '2026-10-18',
        sources: [{ label: 'Chevrolet build and price, 2025 Traverse LT AWD', url: 'https://chevrolet.cardealerships.com/build-and-price/chevrolet-traverse?year=2025&trim=lt-awd' }, { label: 'KBB 2025 Chevrolet Traverse', url: 'https://www.kbb.com/chevrolet/traverse/2025/' }, { label: 'Chevrolet 2025 Traverse', url: 'https://www.chevrolet.com/suvs/traverse' }, FE(48117)] },
      space: { leg2: 41.5, leg3: 32.1, head3: 38.3, cargo3: 22.9, cargo2: 56.6, cargo1: 97.6, length: 204.5, tow: 5000, weight: 4793 },
      iihs: 'TSP', charging: null,
      pros: ['Most cargo space of the SUVs here: 22.9 cu ft behind 3rd row, 97.6 max', 'Roomy 3rd row and 41.5 in 2nd-row legroom', '17.7 in touchscreen + 11 in digital cluster standard', 'Strong 328 hp turbo, 5,000 lb towing with Trailering package standard', 'Lowest price of the 3-row SUVs here'],
      cons: ['No ventilated or 2nd-row heated seats on LT', '360 camera and 120V outlet need the Driver Confidence package', 'Only 6 speakers standard; no moonroof unless optional package', '21 mpg combined with AWD'],
      f: {
        heatFront: 's', ventFront: ['u', 'High Country'], heatWheel: 's', heat2: ['u', 'High Country'], vent2: 'n',
        slide2: ['s', 'Smart Slide'], captains: ['s', '7-seat; 8-seat bench no cost'], ottoman: 'n', remove2: 'n',
        flat2: ['s', 'Folds flat'], flat3: ['s', '60/40, folds flat (manual)'],
        power3: ['u', 'High Country power-fold'], moonroof: ['o', 'Panoramic, Sun and Wheel package'], climate: '3-zone auto',
        fridge: 'n', vacuum: 'n', cabinCam: 'n', intercom: ['q', 'Not listed'],
        seatReminder: ['s', 'Rear Seat Reminder'], slidingDoors: 'n', liftgate: ['s', 'Hands-free power'],
        rse: 'n', shades: ['q', 'Not listed for LT'], booster: 'n',
        screens: '17.7 in touch + 11 in digital cluster', wirelessCP: 's', phoneKey: ['q', 'Not confirmed for LT'], remoteStart: ['s', 'Key fob and app'], audio: ['o', 'Bose (6 speakers standard)'], usbc: 'USB-C front and rear rows (count unverified)',
        assist: 'Adaptive cruise; Super Cruise hands-free optional (Enhanced Driving package)', hud: ['u', 'High Country'], cam360: ['o', 'HD Surround Vision, Driver Confidence package'], bsCam: 'n', digitalMirror: ['q', 'Not confirmed for LT'], parkSensors: ['s', 'Rear Park Assist'], onePedal: 'n',
        outlet: ['o', '120V, Driver Confidence package'], v2l: 'n'
      },
      photo: { src: 'images/traverse.jpg', alt: 'Blue 2024 Chevrolet Traverse LT at a dealer, front three-quarter view', credit: 'Deathpallie325', license: 'CC BY-SA 4.0', licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0', page: 'https://commons.wikimedia.org/wiki/File:2024_Chevrolet_Traverse_front_view.jpg', note: 'Same generation (redesigned 2024); 2024 model shown.' }
    },
    {
      id: 'atlas', short: 'Atlas', year: 2025, make: 'Volkswagen', model: 'Atlas', trim: 'SE with Technology 4Motion', type: 'suv', power: 'gas', seats: 7,
      mpg: 21, kwhPer100: null, range: null, tank: 18.6, efficiencySource: FE(48547),
      drivetrain: 'AWD (4Motion), 2.0L turbo 4-cyl (269 hp), 8-speed automatic',
      price: { typical: 44205, dest: 1425, note: "SE with Technology 4Motion MSRP excludes $1,425 destination ($45,630 total). Standard is a 7-seat 2nd-row bench; captain's chairs and panoramic sunroof are options. Max cargo 96.8 cu ft with 2nd and 3rd rows folded flat; seats are not removable.", asOf: '2026-10-18',
        sources: [{ label: 'VW 2025 Atlas Order Guide', url: 'https://volkswagenorderguides.com/wp-content/uploads/2024/08/2025_Volkswagen_Atlas_Order_Guide.pdf' }, { label: 'KBB 2025 Volkswagen Atlas', url: 'https://www.kbb.com/volkswagen/atlas/2025/' }, { label: 'VW 2025 Atlas', url: 'https://www.vw.com/en/models/atlas.html' }, FE(48547)] },
      space: { leg2: 37.6, leg3: 33.7, head3: 38.3, cargo3: 20.6, cargo2: 55.5, cargo1: 96.8, length: 200.7, tow: 5000, weight: 4601 },
      iihs: null, charging: null,
      pros: ['Big 3rd row: 33.7 in legroom, among the best of the SUVs here', 'Ventilated front seats, heated wheel and Travel Assist lane centering standard', 'Front and rear parking sensors, hands-free liftgate and 2nd-row sunshades standard', '96.8 cu ft max cargo, 5,000 lb towing with factory hitch'],
      cons: ['2024 TSP carries over; no 2025 award; updated moderate overlap: Marginal', '2nd-row bench standard; captain\'s chairs cost extra', 'No 360 camera, head-up display or premium audio on this trim', 'Only 269 hp 4-cyl; 21 mpg combined'],
      f: {
        heatFront: 's', ventFront: 's', heatWheel: 's', heat2: ['u', 'SEL'], vent2: 'n',
        slide2: ['q', 'Bench tilts for 3rd-row access; slide not confirmed'], captains: ['o', '2nd-row captain\'s chairs package'], ottoman: 'n', remove2: 'n',
        flat2: ['s', '60/40 bench folds flat'], flat3: ['s', '50/50, folds flat (manual)'],
        power3: 'n', moonroof: ['o', 'Panoramic sunroof package'], climate: '3-zone auto, 2nd-row controls',
        fridge: 'n', vacuum: 'n', cabinCam: 'n', intercom: 'n',
        seatReminder: ['q', 'Only seatbelt reminder listed'], slidingDoors: 'n', liftgate: ['s', 'Easy Open and Easy Close'],
        rse: 'n', shades: ['s', '2nd row, manual'], booster: 'n',
        screens: '12 in touch + 10.25 in Digital Cockpit Pro', wirelessCP: 's', phoneKey: ['q', 'Not listed'], remoteStart: ['s', 'Key fob'], audio: ['u', 'Harman Kardon, SEL Premium R-Line'], usbc: 'USB-C all 3 rows, up to 45W',
        assist: 'IQ.DRIVE Travel Assist: adaptive cruise with lane centering', hud: ['u', 'SEL'], cam360: ['u', 'Area View, SEL Premium R-Line'], bsCam: 'n', digitalMirror: 'n', parkSensors: ['s', 'Front and rear'], onePedal: 'n',
        outlet: ['s', '115V, rear of console'], v2l: 'n'
      },
      photo: { src: 'images/atlas.jpg', alt: 'Black 2024 Volkswagen Atlas SE, front left three-quarter view', credit: 'BuickRiviera99', license: 'CC BY-SA 4.0', licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0', page: 'https://commons.wikimedia.org/wiki/File:2024_Volkswagen_Atlas_SE,_front_left,_08-21-2026.jpg', note: 'Same facelifted generation; 2024 SE shown.' }
    },
    {
      id: 'ascent', short: 'Ascent', year: 2025, make: 'Subaru', model: 'Ascent', trim: 'Limited', type: 'suv', power: 'gas', seats: 7,
      mpg: 21, kwhPer100: null, range: null, tank: 19.3, efficiencySource: FE(48574),
      drivetrain: 'AWD, 2.4L turbo boxer 4-cyl (260 hp), CVT',
      price: { typical: 47885, dest: 1420, note: "Limited 7-passenger MSRP excludes $1,420 destination; launched at $45,995 and rose during 2025. Captain's chairs standard (8-seat bench no cost). Max cargo 72.8 cu ft with 2nd and 3rd rows folded (moonroof models); seats are not removable.", asOf: '2026-10-18',
        sources: [{ label: 'Subaru 2025 Ascent trim comparison', url: 'https://www.subaru.com/services/vehicles/pdf/trimComparison/2025/ASC' }, { label: 'Subaru 2025 Ascent pricing release', url: 'https://media.subaru.com/pressrelease/2200/259/subaru-announces-pricing-2025-ascent-3-row-suv' }, { label: 'Subaru 2025 Ascent specifications', url: 'https://media.subaru.com/view-spec.do?bFileId=45352' }, FE(48574)] },
      space: { leg2: 38.6, leg3: 31.7, head3: 36.2, cargo3: 17.6, cargo2: 42.1, cargo1: 72.8, length: 196.8, tow: 5000, weight: 4581 },
      iihs: 'TSP', charging: null,
      pros: ['Standard AWD with 5,000 lb towing', 'Panoramic moonroof, 360 camera and Harman Kardon 14-speaker audio standard', 'Heated 2nd-row seats and 2nd-row sunshades standard', 'Cabin Connect intercom to the 3rd row'],
      cons: ['Small cargo: 17.6 cu ft behind 3rd row, 72.8 max', 'Tight 3rd row: 31.7 in legroom, 36.2 in headroom', 'No ventilated seats on Limited; CVT', 'Analog gauges with small LCD, no digital cluster'],
      f: {
        heatFront: 's', ventFront: ['u', 'Touring'], heatWheel: 's', heat2: ['s', 'Outboard'], vent2: 'n',
        slide2: 's', captains: ['s', '7-seat; 8-seat bench no cost'], ottoman: 'n', remove2: 'n',
        flat2: ['s', 'Folds flat'], flat3: ['s', '60/40, folds flat (manual)'],
        power3: 'n', moonroof: ['s', 'Panoramic'], climate: '3-zone auto, 2nd-row controls',
        fridge: 'n', vacuum: 'n', cabinCam: 'n', intercom: ['s', 'Cabin Connect'],
        seatReminder: ['s', 'Rear Seat Reminder'], slidingDoors: 'n', liftgate: ['q', 'Power with height memory; hands-free not confirmed'],
        rse: 'n', shades: ['s', '2nd row'], booster: 'n',
        screens: '11.6 in touch + analog gauges with LCD', wirelessCP: 's', phoneKey: ['q', 'Not listed'], remoteStart: ['s', 'Key fob'], audio: ['s', 'Harman Kardon 14 speakers'], usbc: 'USB-A and USB-C front and 2nd row, USB-A 3rd row',
        assist: 'EyeSight adaptive cruise with Lane Centering', hud: 'n', cam360: 's', bsCam: 'n', digitalMirror: ['u', 'Touring'], parkSensors: ['s', 'Rear, with reverse auto braking'], onePedal: 'n',
        outlet: ['u', '120V, Touring'], v2l: 'n'
      },
      photo: { src: 'images/ascent.jpg', alt: 'White facelifted Subaru Ascent with roof cargo box at the 2023 New York auto show', credit: 'Kevauto', license: 'CC BY-SA 4.0', licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0', page: 'https://commons.wikimedia.org/wiki/File:2023_Subaru_Ascent,_front_NYIAS_2023.jpg', note: 'Same facelifted generation (2023 to 2025); 2023 model shown.' }
    },
    {
      id: 'r1s', short: 'R1S', year: 2025, make: 'Rivian', model: 'R1S', trim: 'Dual Standard', type: 'suv', power: 'ev', seats: 7,
      mpg: null, kwhPer100: 43, range: 258, tank: null, efficiencySource: FE(48435),
      drivetrain: 'AWD, dual motor (533 hp), Standard battery',
      price: { typical: 75900, dest: 1800, note: 'Dual Standard MSRP excludes $1,800 destination. Dual Large (about 300 mi range) costs more. Cargo2 is with 3rd row folded; cargo1 with 2nd and 3rd folded. Plus a frunk (105.8 cu ft total storage).', asOf: '2026-10-18',
        sources: [{ label: 'Rivian R1S compare page (Mar 2025 archive)', url: 'https://web.archive.org/web/2025/https://rivian.com/r1s' }, { label: 'Rivian support: do the 2nd and 3rd rows fold flat', url: 'https://rivian.com/support' }, { label: 'IIHS 2025 Rivian R1S', url: 'https://www.iihs.org/ratings/vehicle/rivian/r1s-4-door-suv/2025' }, FE(48435)] },
      space: { leg2: 36.6, leg3: 32.8, head3: 38.6, cargo3: 17.6, cargo2: 48.6, cargo1: 90.7, length: 200.8, tow: 7700, weight: 6462 },
      iihs: 'TSP+', charging: 'DC fast charging, 10 to 80% in roughly 30 min (unverified for Standard pack). About 9.5 h on 240V. CCS port on 2025 (built-in NACS from 2026); Tesla Supercharger access with an adapter.',
      pros: ['Highest tow rating here (7,700 lb) and quickest (0 to 60 in about 4.5 s)', 'Frunk for extra storage; 2nd and 3rd rows fold nearly flat', 'IIHS Top Safety Pick+ for 2025', 'Phone key, 360 cameras, glass roof, heated wheel and vented seats standard'],
      cons: ['About $77.7k delivered, 2nd priciest here', 'No CarPlay or Android Auto', 'Tight 3rd row (about 32.8 in legroom)', 'Shorter range on Standard pack (258 mi); 2nd row does not slide'],
      f: {
        heatFront: 's', ventFront: 's', heatWheel: 's', heat2: ['s', 'Outboard'], vent2: 'n',
        slide2: ['n', 'Fixed bench, 40/20/40'], captains: ['o', '2nd-row captain\'s chairs (6 seats)'], ottoman: 'n', remove2: 'n',
        power3: ['q', 'Power fold buttons in cargo area per reviews'], moonroof: ['s', 'Fixed panoramic glass'], climate: '2-zone + rear touchscreen controls',
        fridge: 'n', vacuum: 'n', cabinCam: 'q', intercom: 'n',
        seatReminder: 'q', slidingDoors: 'n', liftgate: ['q', 'Power liftgate; hands-free unverified'],
        rse: ['n', '6.8 in rear screen for climate/media only'], shades: 'q', booster: 'n',
        screens: '15.6 in touch + 12.3 in gauges + 6.8 in rear', wirelessCP: ['n', 'No CarPlay or Android Auto'], phoneKey: ['s', 'Plus key fob/card'], remoteStart: ['s', 'App precondition'], audio: ['o', 'Rivian Premium Audio, $1,750'], usbc: '8 USB-C',
        assist: 'Highway Assist with lane centering and lane changes (hands-on; hands-free with Autonomy+ subscription)', hud: 'n', cam360: ['s', '11 cameras'], bsCam: 'q', digitalMirror: 'n', parkSensors: ['s', 'Front and rear'], onePedal: ['s', 'Selectable regen'],
        outlet: ['s', 'Two 120V'], v2l: 'q',
        flat2: ['s', 'Folds nearly flat (about 3 degrees, per Rivian)'], flat3: ['s', 'Folds nearly flat (about 3 degrees, per Rivian)']
      },
      photo: { src: 'images/r1s.jpg', alt: 'Black Rivian R1S electric SUV parked in a lot, side profile view', credit: 'Sarah Stierch (Missvain)', license: 'CC0', licenseUrl: 'http://creativecommons.org/publicdomain/zero/1.0/deed.en', page: 'https://commons.wikimedia.org/wiki/File:Rivian_R1S_-_June_2025_-_Sarah_Stierch_01.jpg', note: 'Gen 2 R1S photographed June 2025; trim not identified.' }
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

  // Numeric filters: `max` keeps vehicles at or below the limit, `min` at or above.
  const NUM_FILTERS = [
    { key: 'price', label: 'Price', dir: 'max', pre: '$', step: 1000, get: v => v.price.typical + (v.price.dest || 0) },
    { key: 'energy', label: 'Energy per year', dir: 'max', pre: '$', step: 100, get: (v, a) => annualEnergyCost(v, a) },
    { key: 'own', label: 'Total cost', dir: 'max', pre: '$', step: 1000, get: (v, a) => ownershipCost(v, a, a && a.years) },
    { key: 'seats', label: 'Seats', dir: 'min', step: 1, get: v => v.seats },
    { key: 'cargo1', label: 'Max cargo', dir: 'min', unit: 'cu ft', step: 5, get: v => v.space.cargo1 },
    { key: 'cargo3', label: 'Cargo behind 3rd row', dir: 'min', unit: 'cu ft', step: 1, get: v => v.space.cargo3 },
    { key: 'leg2', label: '2nd-row legroom', dir: 'min', unit: 'in', step: 0.5, get: v => v.space.leg2 },
    { key: 'leg3', label: '3rd-row legroom', dir: 'min', unit: 'in', step: 0.5, get: v => v.space.leg3 },
    { key: 'length', label: 'Length', dir: 'max', unit: 'in', step: 1, get: v => v.space.length },
    { key: 'tow', label: 'Towing', dir: 'min', unit: 'lb', step: 500, get: v => v.space.tow },
    { key: 'range', label: 'Range', dir: 'min', unit: 'mi', step: 25, get: v => rangeMiles(v) }
  ];

  // Feature filter levels: which status codes pass.
  const FEAT_LEVELS = { any: null, trim: ['s', 'o', 'u'], avail: ['s', 'o'], std: ['s'] };
  const IIHS_LEVELS = { any: null, tsp: ['TSP', 'TSP+'], tspplus: ['TSP+'] };
  const flatFloor = v => (feature(v, 'remove2').s === 's' || feature(v, 'flat2').s === 's') && feature(v, 'flat3').s === 's';

  function filterVehicles(list, f, a) {
    f = f || {};
    const type = f.type || 'all', power = f.power || 'all';
    const num = f.num || {}, feat = f.feat || {};
    const iihs = IIHS_LEVELS[f.iihs || 'any'];
    return list.filter(v => {
      if (type !== 'all' && v.type !== type) return false;
      if (power !== 'all' && v.power !== power) return false;
      if (iihs && !iihs.includes(v.iihs)) return false;
      if (f.flat && !flatFloor(v)) return false;
      for (const d of NUM_FILTERS) {
        const lim = num[d.key];
        if (typeof lim !== 'number' || !Number.isFinite(lim)) continue;
        const x = d.get(v, a);
        if (!Number.isFinite(x) || (d.dir === 'max' ? x > lim : x < lim)) return false;
      }
      for (const k in feat) {
        const ok = FEAT_LEVELS[feat[k]];
        if (ok && !ok.includes(feature(v, k).s)) return false;
      }
      return true;
    });
  }

  function toggleCompare(sel, id) {
    if (sel.includes(id)) return sel.filter(x => x !== id);
    if (sel.length >= MAX_COMPARE) return sel.slice();
    return sel.concat(id);
  }

  return { VEHICLES, FEATURE_GROUPS, FACTORS, MAX_COMPARE, annualEnergyCost, rangeMiles, ownershipCost, feature, featureScore, uniqueFeatures, scoreVehicles, filterVehicles, toggleCompare, NUM_FILTERS, FEAT_LEVELS, flatFloor };
})();
if (typeof globalThis !== 'undefined') globalThis.VC = VC;
