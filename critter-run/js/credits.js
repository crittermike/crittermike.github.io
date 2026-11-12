// Who made the music, models, pictures and fonts. Shown on the credits screen (the "i" button on the title).
// Keep this in step with assets/CREDITS.md.
const MACLEOD = ['Monkeys Spinning Monkeys', 'Carefree', 'Fiddles McGinty', 'Meatball Parade', 'Hyperfun', 'Hillbilly Swing', 'DarxieLand', 'Island Meet and Greet', 'Adventures in Adventureland'];

export const CREDITS = [
  {
    title: 'Music',
    lines: [
      ...MACLEOD.map(t => `"${t}" Kevin MacLeod (incompetech.com). Licensed under Creative Commons: By Attribution 4.0 License, http://creativecommons.org/licenses/by/4.0/`),
      'Music was trimmed, looped and leveled for the game.',
    ],
  },
  {
    title: 'Sounds',
    lines: [
      '"Won! (Orchestral winning jingle)" by spuispuin (opengameart.org/content/won-orchestral-winning-jingle), CC BY 4.0.',
      'Cash register by Lucish_ (freesound.org/s/554841), CC BY 3.0.',
      'Bear growl by tbsounddesigns (freesound.org/people/tbsounddesigns/sounds/416861), CC BY 3.0.',
      'Wolf growl by newagesoup (freesound.org/people/newagesoup/sounds/338674), CC BY 3.0.',
      'Wolf howl by y89312 (freesound.org/people/y89312/sounds/139901), CC BY 3.0.',
      'Announcer voice and many other sounds by Kenney (kenney.nl), plus rubberduck, wobbleboxx, Ogrebane, AntumDeluge, newagesoup and other generous CC0 artists, and the U.S. Fish and Wildlife Service (public domain). Thank you!',
    ],
  },
  {
    title: 'Runners',
    lines: [
      'Characters by Quaternius (quaternius.com): Universal Base Characters and Modular Character Outfits - Fantasy, CC0.',
      'Animations from the Quaternius Universal Animation Library 1 and 2 (CC0), plus Mesh2Motion (CC0).',
    ],
  },
  {
    title: 'Blasters',
    lines: [
      '"Basic Ray Gun [Wander A Nebula]" by Memorie (sketchfab.com/3d-models/basic-ray-gun-wander-a-nebula-a23487f257d24fc6b717e822db63136a), CC BY 4.0. Modified: recolored, resized, optimized.',
      '"Water gun sketch" by Yratz (sketchfab.com/3d-models/water-gun-sketch-183248090e3b48a880baedeb9aa2e2f6), CC BY 4.0. Modified: recolored blue, simplified, optimized.',
      '"SciFi Gun" by Feche Pedroza (sketchfab.com/3d-models/scifi-gun-04a9f3ccb5b14dc38a28b27c1916e18e), CC BY 4.0. Modified: recolored, optimized.',
      '"SciFi Pistol" by Jakub Badin (sketchfab.com/models/9f76c4acd5ec4f3f95754c1cb9a8aba2), CC BY 4.0. Modified: recolored, display and animation removed, optimized.',
      '"Bubble Gun" by SuperMopsek (sketchfab.com/3d-models/bubble-gun-1a5b0bda94ff414c960cb995a91511a8), CC BY 4.0. Modified: recolored, optimized.',
      '"Water Gun" by Zainal Abd. Kahar (sketchfab.com/3d-models/water-gun-b1d620ff625b4a03aac49d17cbb1778b), CC BY 4.0. Modified: decals removed, recolored, optimized.',
      '"Multy-Purpose Raygun" by Yuri Kruglov (sketchfab.com/models/ca58587e09c94b7cb55ec4f0c1b5461f), CC BY 4.0. Modified: recolored, simplified, optimized.',
    ],
  },
  {
    title: 'Animals',
    lines: [
      '"Bear" by Nyilonelycompany (sketchfab.com/3d-models/bear-ce0d5eb86cf5459bb6bd20244cb44b27), CC BY 4.0. Modified: new run, attack, roar, hit and death animations; optimized.',
      '"Stylized Wolf" by ESO (sketchfab.com/3d-models/stylized-wolf-2b369cacbd3a4d19b39353f6cf60b8a9), CC BY 4.0. Modified: new animations; optimized.',
      '"King Baboon Tarantula" by Auckland Museum (sketchfab.com/3d-models/king-baboon-tarantula-92c84c9dac9043ee81e87173e2ee0381), CC BY 4.0; rig by Morphazoid (MIT). Modified: simplified, new animations.',
      '"Pig" by BojanBabic (sketchfab.com/3d-models/pig-6d78fe9cec03483ba6d3e4ff30dc6265), CC BY 4.0. Modified: recolored as a wild hog with tusks; new animations.',
      '"fantasy crocodile animation" by hino (sketchfab.com/3d-models/fantasy-crocodile-animation-0226417fd07e491a9d5464074f86104b), CC BY 4.0. Modified: rescaled, optimized.',
      '"Animated Swimming Great White Shark Loop" by LasquetiSpice (sketchfab.com/3d-models/animated-swimming-great-white-shark-loop-297ed35c6a5f43749b0ae189d991a3f1), CC BY 4.0. Modified: simplified, optimized.',
    ],
  },
  {
    title: 'Scenery',
    lines: [
      'Trees made with EZ-Tree by Daniel Greenheck (MIT License), with bark from ambientCG (CC0).',
      'Rocks, cliffs, ferns, stumps, logs, crates and ground textures from Poly Haven (polyhaven.com) and ambientCG (ambientcg.com), CC0.',
      'These models are CC BY 4.0 (sketchfab.com), optimized for the game: "American Old Barn" by andrewriddle; "Farm Barn" by Jeff Harper Games (re-textured); "Fences Pack" by Agustin Honnun; "Hay Bales" by FrodoUndead; "Farm Haystack" by BytesCrafter; "Grain Silo" by Gobby; "Tractor 01" and "Cargo Ship 04" by gogiart; "Gravity Dam" by USACE Sacramento District; "Cattails" by AlkaliDragon; "Low Poly Lily Pad" by Logan S.; "Simple Reed Bush" by rangordin; "Fishing boat" by Pabooklas; "Beach Ball" by MaggaModels; "Beach Chair" and "Beach Umbrella" by stealth86; "Wooden house" by Helindu; "Cooler Coleman" by liebherr996litronic; "Lighthouse" by KarlDufresne; "Realistic Palm Tree 4" and "Realistic Palm Tree 10" by Next Spring; "Plant Series - Palm Tree" by Spazio Silvestre; "Livistona Chinensis - Fan Palm" by AllQuad; "Old pier" by PT34; "Fishing Boat (asset)" by Luc Smits; "Fishing boat" by Aurelien Duval; "Large tree log" by Julian Malik; "Log Pile" by Meerschaum Digital.',
      'Full list with links: critter-run/assets/CREDITS.md.',
    ],
  },
  {
    title: 'Pictures',
    lines: [
      'Game icons by Lorc, Delapouite, Carl Olsen, Sbed, Skoll, Zeromancer, Rihlsul and Caro Asercion from game-icons.net, licensed under CC BY 3.0.',
      'Button icons from Phosphor Icons (MIT License).',
    ],
  },
  {
    title: 'Fonts',
    lines: [
      'Fredoka by the Fredoka Project Authors, and Lilita One by Juan Montoreano. SIL Open Font License 1.1.',
    ],
  },
  {
    title: 'Code',
    lines: [
      'Made with three.js (MIT License). Mesh decoding by meshoptimizer (MIT License).',
    ],
  },
];
