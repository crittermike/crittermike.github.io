# Critter Quest

One continuous study game for Thomas (3rd grade). Every test becomes a new **island** on the map. Each island has 2–8 monster battles and a boss. Coins, heroes, pets, the monster book, and the review arena carry over from island to island.

Play it at `/critter-quest/`.

To share one test without the other islands, add its `id`, for example `/critter-quest/?island=sc-landforms`. The map, monster book, and arena then show only that island.

## How it plays

- **Battles:** every right answer fires your attack at the monster. A wrong answer costs a heart, shows a ≤5-word tip, and brings the question back two turns later.
- **Stars:** 3 stars for no mistakes, 2 for one or two mistakes, 1 otherwise.
- **Boss:** opens after all of an island's battles are won. It mixes 8 questions from the whole island and favors the ones Thomas has missed.
- **Arena (🏟️):** endless review of every battle already won, across all islands. It also favors missed questions.
- **Coins:** buy heroes, attacks (💨 is a fart), and pets in the shop. Combos multiply coins.
- **Reading support:** the 🔊 button reads the question and each answer aloud. 🗣️ turns auto-read on or off; 🔔 toggles sound effects.
- **Saving:** progress is saved in the browser (`localStorage` key `critter-quest-v1`). Adding a new island keeps all old progress.

## Adding a new test (new island)

1. Create `levels/YYYY-MM-short-name.js` from the study guide, using the template below.
2. Add one script tag for it at the **end** of the level list in `index.html`, just above `game.js`:
   ```html
   <script src="levels/2026-11-short-name.js"></script>
   ```
3. Run the checks:
   ```sh
   node --test critter-quest/
   ```
4. Open the page. The new island shows a **NEW!** badge, and the hero marker starts there.

### Template

```js
// Island Name: what the test covers (Month Year)
CritterQuest.addLevel({
  id: 'kebab-case-id',          // unique and never changed later (progress is saved under it)
  name: 'Island Name',          // 1-3 words
  topic: 'Subject: Unit name',  // small grown-up label, max 40 characters
  date: '2026-11-20',           // test date, used to order islands
  emoji: '🏝️',                  // island icon
  color: '#5cc96b',             // island ground color
  decor: ['🌴', '🐚', '🦀'],    // 1-4 decoration emoji
  boss: '🐲',
  stages: [
    { monster: '🐙', questions: [
      { q: 'What do plants need?', a: 'Sunlight', wrong: ['Rocks', 'Sand', 'Candy'], why: 'Plants make food from light.' },
      { show: '3 + 4', q: 'What is the answer?', a: '7', wrong: ['6', '8', '34'], why: '3 plus 4 is 7.' },
      // ...3 to 6 questions per stage
    ] },
    // ...2 to 8 stages; each monster must be different
  ],
});
```

### Question fields

| Field | Required | What it does |
|---|---|---|
| `q` | yes | The question. Max 8 words. |
| `a` | yes | The right answer. Max 4 words. |
| `wrong` | yes | 3 or more wrong answers. Each game shows 3 at random, so extras add variety. |
| `why` | yes | Tip shown after a wrong answer. Max 5 words. |
| `show` | no | Big highlighted card above the question, such as a sentence, number, or pattern. Max 8 words. |
| `say` | no | What the 🔊 button reads instead of `show` + `q`. Use it when symbols read badly, e.g. `→` patterns. |
| `pic` | no | One emoji shown before the question. |

### Writing rules (for people and AI)

- Thomas is 8. Use short, plain words, and keep reading to an absolute minimum.
- Every question is multiple choice with one clearly right answer. Wrong answers should be believable, not silly.
- Make `why` say the fact, not "Wrong!" For example, write "Jupiter is the biggest." instead of "Try again!"
- Cover every item on the study guide, and group related questions into the same stage.
- Use 4 or 5 stages of 4–5 questions for a typical test. Each island needs at least 8 questions in total.
- Pick monsters and a boss that match the topic. Don't reuse emoji within an island.
- `node --test critter-quest/` enforces the word limits, emoji fields, unique answers, and script-tag order.
