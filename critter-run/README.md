# Critter Run

A 3D runner study game for Thomas (3rd grade), built with WebGL (Three.js). A dangerous animal chases you through each region. Dodge and jump over obstacles, grab coins, and answer the question at every ❓ gate. A right answer zaps the chaser away. A wrong answer lets it catch up and costs a heart.

Every test adds a new **level**: a trail of stages on the map. Coins, stars, and missed questions carry over.

Play it at `/critter-run/` (short link: `/run`). To share one test without the other levels, add `?level=<id>`, for example `/critter-run/?level=sc-landforms`.

This is a separate game from [Critter Quest](../critter-quest/). The two don't share code or saves.

## How it plays

- **Controls:** swipe left/right to change lanes, swipe up or tap to jump, swipe down to drop fast. On a keyboard: arrows or WASD, Space to jump, 1–4 to answer, and Esc to pause.
- **Questions:** 4 big answer buttons. The 🔊 button reads the question and each answer aloud. Auto-read is off by default; 🗣️ on the map or pause screen turns it on.
- **Wrong answer:** a ≤5-word tip with ➡️ to keep running. The question comes back later in the run.
- **Hearts:** 5 per run. Obstacles and wrong answers each cost one, and floating ❤️s give one back. At 0 hearts you're caught.
- **Stars:** 3 for no mistakes, 2 for one or two, 1 otherwise. Each stage unlocks the next.
- **Final stage (`tour`):** one long run through every earlier stage's scenery in order. Each region gets a review question (missed ones show up more often), and the stage's own questions are asked at the end of each region in order. That's handy for "what comes next?" questions.
- **Saving:** progress is kept in `localStorage` under `critter-run-v1`.

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
      icons: ['⛰️', '💦'],      // 1-4 emoji for the intro card
      questions: [              // 3-10 (a tour stage needs at least 1)
        { q: 'Short question?', a: 'Right answer', wrong: ['Nope', 'Nah', 'No way'], why: 'Five words or less.', pic: '⛰️' },
        { show: '🍑 Peaches 🦶 Foothills', q: 'Which region is this?', a: 'Piedmont', wrong: ['A', 'B', 'C'], why: 'That is the Piedmont.' },
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
- `pic` is one emoji.
- `say` is optional: what to read aloud instead of `show` + `q`.

**Biomes:**
- `mountains`
- `foothills`
- `sandhills`
- `farmland`
- `swamp`
- `beach`
- `tour`: the final stage only. It runs through the earlier stages' biomes.

**Chasers:**
- `bear` 🐻
- `wolf` 🐺
- `scorpion` 🦂
- `boar` 🐗
- `gator` 🐊
- `shark` 🦈
- `hurricane` 🌀

To add a new biome or chaser:
1. Add it to `js/catalog.js`.
2. Build its scenery in `js/world.js`, or its model in `js/models.js`.
3. Give it a song in `js/audio.js`.

## Files

- `index.html`: screens, HUD, styles, and the level list.
- `js/main.js`: game loop, modes, controls, questions, camera, and saving.
- `js/world.js`: endless track, biomes, obstacles, coins, gates, and sky.
- `js/models.js`: the voxel hero and chasers.
- `js/gfx.js`: curved-world shader and the mesh builder.
- `js/fx.js`: particles.
- `js/audio.js`: procedural music, sound effects, and speech.
- `vendor/three.module.min.js`: Three.js r187.
