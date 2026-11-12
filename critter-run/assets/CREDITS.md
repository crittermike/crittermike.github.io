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

## Characters (CC0)

| File | Source | Author |
|---|---|---|
| `runners/kid.glb`, `ninja.glb`, `cowboy.glb`, `pirate.glb`, `zombie.glb`, `knight.glb`, `viking.glb`, `wizard.glb`, `pug.glb` | Ultimate Animated Character Pack | [Quaternius](https://quaternius.com) |
| `runners/robot.glb` | RobotExpressive (from the three.js examples) | Tomás Laulhé ([Quaternius](https://quaternius.com)), modified by Don McCurdy |
| `chasers/wolf.glb` | Ultimate Animated Animal Pack | [Quaternius](https://quaternius.com) |
| `chasers/shark.glb` | Pirate Kit | [Quaternius](https://quaternius.com) |
| `chasers/bear.glb`, `boar.glb`, `scorpion.glb` | Pixor library ([pixor.art/library](https://pixor.art/library/)), with extra run and attack animations added for this game | Frakassets |
| `chasers/gator.glb`, `hurricane.glb` | Made for this game | Critter Run |
| `blasters.glb` | Blaster Kit | [Kenney](https://kenney.nl) |

The runner files were trimmed (unused animations removed, meshes quantized) and the seven blasters merged into one file with each weapon as a node named after its id in `js/items.js`. The chasers were compressed.

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
