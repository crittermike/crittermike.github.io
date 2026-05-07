# 🎡 Crittenden Family Chore Wheel

A mobile-first PWA that lives on the family fridge tablet and randomly assigns weekend chores to the four Crittenden kids using a tappable spinner wheel.

**Live:** https://crittermike.github.io/family/chore-wheel/

## What it does

- **Spin the wheel** for each kid individually, or hit "Spin for everyone" to cycle through all four (Charlie, Henry, William, Thomas).
- The wheel **physically lands on the chosen slice** — no fake reveals.
- Each kid gets one chore per week, and **no chore is double-assigned**.
- **No-repeat memory:** when a spin runs, it tries to avoid giving a kid the same chore they had last week (falls back gracefully if the chore pool is too small).
- **Lock in this week** snapshots the current assignments to history and rolls last-week memory forward.
- The current week auto-rolls every Monday based on the device's clock.
- **History view** shows the last 4 locked-in weeks per kid.

## How no-repeat works

State lives in `localStorage` under `crittenden-chore-wheel-v1`:

```json
{
  "chores": ["Vacuum living room", ...],
  "currentWeek": "2026-05-04",
  "assignments": { "charlie": "...", "henry": "...", ... },
  "history": [{ "weekKey": "...", "label": "...", "assignments": { ... } }]
}
```

When picking a chore for a kid:
1. Build the candidate pool: all chores **not already assigned to another kid this week**.
2. If `history[0]` (last locked-in week) gave that kid a chore, **filter it out of the pool** if at least one other choice remains.
3. Pick uniformly at random from what's left.

Locking a week pushes `assignments` to the front of `history`, trims to 4 entries, and resets `assignments`.

## Install as a PWA

Open the URL on the fridge tablet, then in the browser menu choose **Add to Home Screen** / **Install app**. It runs offline thanks to a tiny service worker (`sw.js`) that pre-caches the shell.

## Files

| File              | Purpose                                          |
|-------------------|--------------------------------------------------|
| `index.html`      | Single-page shell                                |
| `app.js`          | All app logic (vanilla ES module, no build step) |
| `styles.css`      | Modern dark gradient theme, mobile-first         |
| `manifest.json`   | PWA manifest                                     |
| `sw.js`           | Service worker for offline + cache               |
| `icons/`          | App icons (SVG + 192/512 PNGs)                   |

## Tech

Vanilla HTML/CSS/JS. No npm install, no build step, no framework. Just open `index.html`.

## Honest notes

- No sound effect on landing — silent confetti only. (Auto-play sound is finicky on iPad anyway.)
- "Lock in this week" advances `currentWeek` to the next Monday but does not enforce a real-time gate — useful if Mike spins on Saturday and wants to lock immediately.
- Edits to the chore list don't auto-rebalance current assignments; spin again to refresh.
