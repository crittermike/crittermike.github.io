# Critter Run

A 3D runner study game for Thomas (3rd grade), built with Three.js (WebGL). A wild animal chases you through each region. Dodge, jump, and slide past obstacles, grab coins, and answer the question at every gate. A right answer blasts the chaser away. A wrong answer lets it catch up and costs a heart.

Every test adds a new **level**: a trail of stages on the map. Coins, stars, shop items, and missed questions carry over.

Play it at `/critter-run/` (short link: `/run`). To share one test without the other levels, add `?level=<id>`, for example `/critter-run/?level=sc-landforms`.

This is a separate game from [Critter Quest](../critter-quest/). The two don't share code or saves.

**No emoji, anywhere.** Every picture in the game is an SVG icon from `js/icons.js` or a real 3D model. The tests fail if an emoji shows up in the game's files.

## How it plays

- **Controls:** swipe left/right to change lanes, swipe up or tap to jump, and swipe down to slide under bars (or drop fast from a jump). On a keyboard: arrows or WASD, Space to jump, 1–4 to answer, and Esc to pause.
- **Speed:** the run starts fast and speeds up. Jumps are long (about 0.85 s in the air), and a jump that starts too early stretches into a longer leap that still clears the next log or rock.
- **Questions:** 4 big answer buttons. The speaker button reads the question and each answer aloud. Auto-read is off by default; the "read aloud" button on the map or pause screen turns it on.
- **Right answer:** +5 coins, and the runner fires the equipped blaster at the chaser.
- **Wrong answer:** a tip of 5 words or less, with a button to keep running. The question comes back later in the run.
- **Power-up boxes:** running into one asks a quick question from the stage. Only a right answer turns the power on; a wrong one just poofs the box (no heart lost). Powers: magnet, shield, jetpack (fly over everything and grab sky coins), double coins, super jump, and +2 hearts. Badges on the left count down.
- **Hearts:** 5 per run. Obstacles and wrong answers each cost one, and floating hearts give one back. At 0 hearts you're caught.
- **Stars:** 3 for no mistakes, 2 for one or two, 1 otherwise. Each stage unlocks the next.
- **Final stage (`tour`):** one long run through every earlier stage's scenery in order. Each region gets a review question (missed ones show up more often), and the stage's own questions are asked at the end of each region in order. That's handy for "what comes next?" questions.
- **Shop (cart button on the title and map):** spend coins on runners, blasters (each has its own effect and knocks the chaser farther), trails, and longer-lasting power-ups. Tapping an item previews it on the runner.
- **Saving:** progress is kept in `localStorage` under `critter-run-v1`.
- **Quality:** it steps down on slow devices automatically. Add `?q=low`, `?q=mid`, or `?q=high` to force a level.
- **Credits:** the info button on the title screen. Some music, models, and icons are CC BY, so the credits must stay.

## Adding a new test

1. Create `levels/YYYY-MM-short-name.js` from the study guide, using the template below.
2. Add one script tag at the **end** of the level list in `index.html`, just above `js/main.js`:
   ```html
   <script src="levels/2026-12-short-name.js"></script>
   ```
3. Run the checks from the repo root:
   ```sh
   node --test critter-run/*.test.mjs
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
      questions: [              // 3-10 (a tour stage needs at least 1)
        { q: 'Short question?', a: 'Right answer', wrong: ['Nope', 'Nah', 'No way'], why: 'Five words or less.', pic: 'mountain' },
        { show: 'Peaches, waterfalls, foothills', q: 'Which region is this?', a: 'Piedmont', wrong: ['A', 'B', 'C'], why: 'That is the Piedmont.' },
      ],
    },
  ],
});
```

Rules (checked by `levels.test.mjs`):
- `q` and `show` are at most 8 words.
- Answers are at most 4 words.
- `why` is at most 5 words.
- At least 3 wrong answers (3 are picked at random each time).
- `pic` is optional: a picture name from `PICS` in `js/catalog.js` (for example `'mountain'`, `'money'`, `'factory'`, `'wave'`). To add a new one, add the icon to `js/icons.js` and its name to `PICS`.
- `say` is optional: what to read aloud instead of `show` + `q`.
- No emoji in any text.

**Biomes:**
- `mountains`: pine forest, cliffs and waterfalls
- `foothills`: orchards, fences and old mills
- `sandhills`: sand, longleaf pines, cactus and power lines
- `farmland`: crop fields, barns, silos and tractors
- `swamp`: a boardwalk over dark water with cypress trees and Spanish moss
- `beach`: sand, palmettos, boats and the ocean
- `tour`: the final stage only. It runs through the earlier stages' biomes.

**Chasers:** `bear`, `wolf`, `spider` (a tarantula), `panther`, `gator`, `shark`, `hurricane`.

To add a new biome or chaser:
1. Add it to `js/catalog.js` (and give it an icon in `js/icons.js`).
2. Biome: add an entry to `BIOME` in `js/world.js` (sky, ground, trail style, obstacles and scenery). It can use any prop in `assets/world.glb`; new props are added with `tools/build-world.mjs`. Give it a song in `assets/audio/music/` and `js/audio.js`.
3. Chaser: add `assets/chasers/<id>.glb` (an animated, rigged model) and its entry in `CHASERS` in `js/models.js`, plus a sound in `js/audio.js`.

## Files

- `index.html`: screens, HUD, styles, and the level list.
- `js/main.js`: game loop, modes, controls, questions, power-ups, camera, and saving.
- `js/world.js`: the endless track, biomes, obstacles, power-up boxes, coins, gates, sky and backdrop.
- `js/props.js`: loads `assets/world.glb` and hands out its models by name.
- `js/gfx.js`: the curved-world shader, water, and the geometry batcher that merges a chunk of scenery into a few draw calls.
- `js/textures.js`: the painted trail and ground textures.
- `js/models.js`: the animated chasers.
- `js/actors.js`: the animated runners and blasters.
- `js/items.js`: everything you can collect or buy (powers, runners, blasters, trails, and prices).
- `js/shop.js` and `js/thumbs.js`: the shop screen, with pictures rendered from the real models.
- `js/weapons.js`: what each blaster's shot looks like.
- `js/fx.js`: particles, beams, and shock rings.
- `js/post.js`: bloom, color grade, flashes, and the quality tiers.
- `js/audio.js`: music, sound effects, the announcer, and speech.
- `js/icons.js` and `js/ui.js`: the SVG icon set.
- `js/credits.js`: the credits screen.
- `assets/`: models and audio (see `assets/CREDITS.md`). `shop.test.mjs` checks that every shop item has its model.
- `tools/`: rebuilds `assets/world.glb` from the source model packs.
- `vendor/`: Three.js r187 and the addons it needs (glTF loader, meshopt decoder, and post-processing).
