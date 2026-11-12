# Critter Run

A 3D runner study game for Thomas (3rd grade), built with WebGL (Three.js). A dangerous animal chases you through each region. Dodge, jump and slide past obstacles, grab coins, and answer the question at every gate. A right answer blasts the chaser away. A wrong answer lets it catch up and costs a heart.

Every test adds a new **level**: a trail of stages on the map. Coins, stars, shop items and missed questions carry over.

Play it at `/critter-run/` (short link: `/run`). To share one test without the other levels, add `?level=<id>`, for example `/critter-run/?level=sc-landforms`.

This is a separate game from [Critter Quest](../critter-quest/). The two don't share code or saves.

The game uses no emoji anywhere. Every picture is an SVG icon from `js/icons.js` (checked by the tests).

## How it plays

- **Controls:** swipe left/right to change lanes, swipe up or tap to jump, and swipe down to slide under bars (or drop fast from a jump). On a keyboard: arrows or WASD, Space to jump, 1-4 to answer, and Esc to pause.
- **Jumps are forgiving:** a jump carries you about 9 m. Clipping the top of a low obstacle with your feet smashes it instead of hurting you, and a jump pressed just before landing still happens.
- **Questions:** 4 big answer buttons. The speaker button reads the question and each answer aloud. Auto-read is off by default; the "read aloud" toggle on the map or pause screen turns it on.
- **Right answer:** +5 coins, and the runner turns and fires the equipped blaster at the chaser.
- **Wrong answer:** a tip of at most 5 words with an arrow button to keep running. The question comes back later in the run.
- **Power-up bubbles:** running into one asks a quick question from the stage. Only a right answer turns the power on; a wrong one just pops it (no heart lost). Powers: magnet, shield, jetpack (fly over everything and grab sky coins), double coins, super jump, and +2 hearts. Badges on the left count down.
- **Hearts:** 5 per run. Obstacles and wrong answers each cost one, and floating hearts give one back. At 0 hearts you're caught.
- **Stars:** 3 for no mistakes, 2 for one or two, 1 otherwise. Each stage unlocks the next.
- **Final stage (`tour`):** one long run through every earlier stage's scenery in order. Each region gets a review question (missed ones show up more often), and the stage's own questions are asked at the end of each region in order. That's handy for "what comes next?" questions.
- **Shop (cart button on the title and map):** spend coins on runners, blasters (each has its own effect and knocks the chaser farther), trails, and longer-lasting power-ups. Tapping an item previews it on the runner.
- **Saving:** progress is kept in `localStorage` under `critter-run-v1`. Coins for runners from the first version of the shop were refunded when the roster changed.
- **Quality:** it steps down on slow devices automatically. Add `?q=low`, `?q=mid`, or `?q=high` to force a level.

## Adding a new test

1. Create `levels/YYYY-MM-short-name.js` from the study guide, using the template below.
2. Add one script tag at the **end** of the level list in `index.html`, just above `js/main.js`:
   ```html
   <script src="levels/2026-12-short-name.js"></script>
   ```
3. Run the checks:
   ```sh
   node --test critter-run/
   ```

### Template

```js
// Level Name: what the test covers (Month Year)
CritterRun.addLevel({
  id: 'kebab-case-id',          // unique, never change it (saves use it)
  name: 'Level Name',           // 1-3 words
  topic: 'Subject: Unit name',  // grown-up label, max 40 characters
  date: '2026-12-01',           // test date, orders the levels
  stages: [
    {
      name: 'Stage Name',       // 1-3 words, shown on the map and on signs
      biome: 'mountains',       // see the list below
      chaser: 'bear',           // see the list below
      color: '#c0392b',
      icons: ['mountains', 'waterfall'],  // 1-4 icon names from js/icons.js for the intro card
      questions: [              // 3-10 (a tour stage needs at least 1)
        { q: 'Short question?', a: 'Right answer', wrong: ['Nope', 'Nah', 'No way'], why: 'Five words or less.', pic: 'mountains' },
        { show: 'Peaches, waterfalls, foothills', pic: ['peach', 'waterfall', 'hills'], q: 'Which region is this?', a: 'Piedmont', wrong: ['A', 'B', 'C'], why: 'That is the Piedmont.' },
      ],
    },
  ],
});
```

Rules (checked by `levels.test.mjs`):
- No emoji anywhere. Pictures are icon names.
- `q` and `show` are at most 8 words.
- Answers are at most 4 words.
- `why` is at most 5 words.
- At least 3 wrong answers (3 are picked at random each time).
- `pic` is one icon name, or a list of up to 3.
- `say` is optional: what to read aloud instead of `show` + `q`.

**Pictures:** the level pictures in `js/icons.js` include mountains, waterfall, hiking, boot, ant, money, elephant, house, factory, peach, hills, desert, falling-rocks, lightning, dam, water-drop, tractor, peanut, sun, sprout, alligator, pine-tree, wheat, log, palm-tree, island, shrimp, ship, wave, ruler, treasure-map, canoe, barn, swamp, sand-castle, cotton, corn, cow, crab, fish, windmill, rain, water-mill, volcano, tornado and snowflake. To add one, copy the path from [game-icons.net](https://github.com/game-icons/icons) (CC BY 3.0) as described at the top of `js/icons.js`, and add the artist to `js/credits.js` and `assets/CREDITS.md` if they're new.

**Biomes:**
- `mountains`
- `foothills`
- `sandhills`
- `farmland`
- `swamp`
- `beach`
- `tour`: the final stage only. It runs through the earlier stages' biomes.

**Chasers:**
- `bear`
- `wolf`
- `spider`
- `boar`
- `gator`
- `shark`
- `hurricane`

To add a new biome or chaser:
1. Add it to `js/catalog.js`.
2. For a biome: its ground and hills in `js/terrain.js`, grass in `js/grass.js`, scenery models in `js/scenery.js`, obstacles in `js/obstacles.js`, and sky and backdrop in `js/world.js` (`BIOME`). Give it a song in `assets/music/music.json`.
3. For a chaser: an animated model in `assets/chasers/<name>.glb` (it needs a run or swim clip), an entry in `CHASER_DEFS` in `js/chasers.js`, an icon with the same name in `js/icons.js`, and optionally a `roar-<name>` sound in `assets/sfx/sfx.json`.

## Files

- `index.html`: screens, HUD, styles, and the level list.
- `js/main.js`: game loop, modes, controls, questions, power-ups, camera, and saving.
- `js/world.js`: the endless track: chunks, obstacles, coins, gates, region signs and waterfalls.
- `js/terrain.js`: the textured ground with the trail painted in, and the hills.
- `js/grass.js`: instanced grass that sways in the wind.
- `js/water.js`: the sea and the swamp water.
- `js/sky.js`: sky, clouds and distant ridges.
- `js/scenery.js`: which trees, rocks and landmarks grow in each region.
- `js/obstacles.js`: obstacles built from the scenery models, with hit boxes measured from the models.
- `js/props.js`: loads scenery models and draws many copies of each.
- `js/pickups.js`: coins, hearts, power-up bubbles, gates, arches and the finish line.
- `js/chasers.js`: the animal chasers and the hurricane.
- `js/actors.js`: the runners and blasters.
- `js/items.js`: everything you can collect or buy (powers, runners, blasters, trails, and prices).
- `js/shop.js` and `js/portrait.js`: the shop screen and the rendered character and blaster cards.
- `js/weapons.js`: what each blaster's shot looks like.
- `js/icons.js`: every picture in the game (SVG icons).
- `js/credits.js`: the credits screen (the "i" button on the title).
- `js/fx.js`: particles, beams and shock rings.
- `js/post.js`: bloom, color grade, flashes and the quality tiers.
- `js/audio.js`: music, sound effects and speech.
- `js/models.js`: simple stand-ins used only if a model can't load.
- `js/gfx.js`: the curved-world shader and helpers.
- `assets/`: models, textures, music, sounds and fonts (see `assets/CREDITS.md`). `shop.test.mjs` checks that every shop item and chaser has its model.
- `vendor/`: Three.js r187 and the addons it needs (glTF and HDR loaders, SVG loader, skeleton utilities and post-processing).
