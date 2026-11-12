# Credits

The game shows these credits from the info button on the title screen (`js/credits.js`). Keep both lists in step.

**CC BY items must stay credited.** Everything else here is CC0 (public domain): no credit required, but given anyway.

## Music (CC BY 4.0)

Licensed under Creative Commons: By Attribution 4.0 License, https://creativecommons.org/licenses/by/4.0/

| File | Title | Author |
|---|---|---|
| `audio/music/menu.mp3` | "Voxel Revolution" | Kevin MacLeod (incompetech.com) |
| `audio/music/mountains.mp3` | "Hillbilly Swing" | Kevin MacLeod (incompetech.com) |
| `audio/music/foothills.mp3` | "Brightly Fancy" | Kevin MacLeod (incompetech.com) |
| `audio/music/sandhills.mp3` | "Enter the Party" | Kevin MacLeod (incompetech.com) |
| `audio/music/farmland.mp3` | "Nano Hoedown" | Kevin MacLeod (incompetech.com) |
| `audio/music/swamp.mp3` | "Hustle" | Kevin MacLeod (incompetech.com) |
| `audio/music/beach.mp3` | "Surf Shimmy" | Kevin MacLeod (incompetech.com) |
| `audio/music/tour.mp3` | "Call to Adventure" | Kevin MacLeod (incompetech.com) |
| `audio/sfx/win.mp3`, `audio/sfx/lose.mp3` | "Win and lose melodies" (arranged) | Vircon32, arranged by Sebastian F. (@fraynvgm), https://opengameart.org/content/win-and-lose-melodies |

The music was loudness-normalized and re-encoded.

## Sound effects (CC0)

Kenney (kenney.nl: Impact, Interface, Sci-Fi and Voiceover packs, Music Jingles), Freesound contributors (CC0 sounds only), Joseph Sardin (BigSoundBank.com), and HaelDB ("Point bell", OpenGameArt). Trimmed, normalized and re-encoded.

## Characters

**CC0:**

| File | Source | Author |
|---|---|---|
| `runners/*.glb` (all but `anims.glb`) | Universal Base Characters and Modular Character Outfits - Fantasy, combined onto one skeleton per character | [Quaternius](https://quaternius.com) |
| `runners/anims.glb` | Universal Animation Library 1 and 2, plus "Victory", "Dab" and "Power Up" from [Mesh2Motion](https://github.com/Mesh2Motion/mesh2motion-assets), retargeted to the same skeleton | [Quaternius](https://quaternius.com), Mesh2Motion |
| `chasers/boar.glb` | Pixor library ([pixor.art/library](https://pixor.art/library/)), with extra run and attack animations added for this game | Frakassets |
| `chasers/hurricane.glb` | Made for this game | Critter Run |
| `blasters.glb` | Blaster Kit | [Kenney](https://kenney.nl) |

**CC BY 4.0** (https://creativecommons.org/licenses/by/4.0/):

| File | Model | Author | Source |
|---|---|---|---|
| `chasers/bear.glb` | "Bear" | Nyilonelycompany | https://sketchfab.com/3d-models/bear-ce0d5eb86cf5459bb6bd20244cb44b27 |
| `chasers/wolf.glb` | "Stylized Wolf" | ESO | https://sketchfab.com/3d-models/stylized-wolf-2b369cacbd3a4d19b39353f6cf60b8a9 |
| `chasers/spider.glb` | "King Baboon Tarantula" | Auckland Museum | https://sketchfab.com/3d-models/king-baboon-tarantula-92c84c9dac9043ee81e87173e2ee0381 |
| `chasers/gator.glb` | "fantasy crocodile animation" | blam (Blam577895) | https://sketchfab.com/3d-models/fantasy-crocodile-animation-0226417fd07e491a9d5464074f86104b |
| `chasers/shark.glb` | "Animated Swimming Great White Shark Loop" | LasquetiSpice | https://sketchfab.com/3d-models/animated-swimming-great-white-shark-loop-297ed35c6a5f43749b0ae189d991a3f1 |

All five were modified: new or trimmed animations (run, attack, roar or howl, idle), simplified meshes, and compressed. The tarantula is a museum scan, rigged with the skeleton from [Morphazoid](https://github.com/blechdom/morphazoid) by Kristin Galvin (MIT License, see `chasers/LICENSE-morphazoid-MIT.txt`).

The runners were compressed (WebP textures, quantized meshes), and the seven blasters merged into one file with each weapon as a node named after its id in `js/items.js`.

## World (`world.glb`)

The scenery, obstacles and pickups are baked into one file by `tools/build-world.mjs` from the props in `tools/world-list.mjs` (resized, recolored, and texture colors baked into vertex colors).

**CC0:**
- KayKit Forest Nature, Platformer, Resource Bits, Prototype Bits, Medieval Hexagon, Halloween Bits and City Builder Bits by [Kay Lousberg](https://kaylousberg.com)
- Nature, Pirate, Watercraft, Survival, Platformer, Car, Fantasy Town and City (Industrial) kits by [Kenney](https://kenney.nl)
- Farm buildings, nature and pickup models by [Quaternius](https://quaternius.com) (via poly.pizza)
- Prickly pear and cactus by Isa Lousberg, lighthouse by MaverickFX, transmission tower by iPoly3D (poly.pizza)
- Hay bales by Mish7913 and carlosjorgereis (OpenGameArt)

**CC BY 3.0** (https://creativecommons.org/licenses/by/3.0/), all from poly.pizza and modified (resized, recolored):

| Model | Author | Source |
|---|---|---|
| "Red/White Beach Umbrella", "Blue/White Beach Umbrella", "Rainbow Beach Umbrella" | S. Paul Michael | https://poly.pizza/m/2li3sdSkmCI, https://poly.pizza/m/1BLLDjRdxoa, https://poly.pizza/m/cAna-B5z-45 |
| "beach ball" | the_ normalgamer | https://poly.pizza/m/4IwPTeOmq6c |
| "Beach chair" | Poly by Google | https://poly.pizza/m/9TN4PyhWvz1 |
| "Ice box" | Poly by Google | https://poly.pizza/m/dvu1_2Wlhc0 |
| "Sand castle" | Poly by Google | https://poly.pizza/m/8PJfF1Q0B7T |
| "Lighthouse" | jeremy | https://poly.pizza/m/0SWQTv1whoA |
| "Surfboard" | jeremy | https://poly.pizza/m/3js4cQ-O-p2 |
| "House" | Pixel | https://poly.pizza/m/fdaqERLQCc |
| "Boat" | Poly by Google | https://poly.pizza/m/84-DYhLzxNq |
| "Seashell" | Poly by Google | https://poly.pizza/m/5ovn4mnRejL |
| "Starfish" | Poly by Google | https://poly.pizza/m/6H-0K9IEr56 |
| "Crab" | Poly by Google | https://poly.pizza/m/1O5Q4pE8X6e |
| "Thatch palm tree" | Poly by Google | https://poly.pizza/m/74GpKCkUqcn |
| "Lady palm tree" | Poly by Google | https://poly.pizza/m/e0AbYA90ux5 |
| "Prickly pear cactus" | Poly by Google | https://poly.pizza/m/47Af27jQemx |
| "Cattail" | Poly by Google | https://poly.pizza/m/9vCk81sIPve |
| "Orange tree" | Poly by Google | https://poly.pizza/m/8zS7mfHS0i7 |
| "Apple Tree" | Jarlan Perez | https://poly.pizza/m/ds595Kl_cWH |
| "Farm house" | Poly by Google | https://poly.pizza/m/bHyQe5jzdiQ |
| "Factory" | Poly by Google | https://poly.pizza/m/2J7L2oILiwP |
| "Haystack" | Poly by Google | https://poly.pizza/m/6LeCqyw00RK |
| "Scarecrow" | Poly by Google | https://poly.pizza/m/7qFs_DjjuVp |
| "Dam" (simplified) | NateGazzard | https://poly.pizza/m/R17ff2k5aE |
| "Canoe" | Poly by Google | https://poly.pizza/m/3s6Vn4gWYLI |
| "Container Ship" | Alex Safayan | https://poly.pizza/m/3AmDGcCu6Ll |
| "Cabin" | Poly by Google | https://poly.pizza/m/1GpgtI-C05M |

## Icons (CC BY 3.0)

`js/icons.js`: icons from [game-icons.net](https://game-icons.net) by Delapouite, Lorc, Skoll, Caro Asercion, Sbed, Guard13007, Sparker, Zeromancer, Carl Olsen, DarkZaitzev, Lord Berandas, Rihlsul and PriorBlue, licensed CC BY 3.0 (https://creativecommons.org/licenses/by/3.0/). Some were edited or combined; each icon's source file is noted next to it.

## Fonts

Lilita One (Juan Montoreano) and Fredoka (Milena Brandão), SIL Open Font License, loaded from Google Fonts.
