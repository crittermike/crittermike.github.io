# Crittenden family dashboard — AGENTS.md

## TL;DR for agents
This is an 11ty (Eleventy v3) static site that builds **in place** to `family/`. GitHub Pages serves it from there. Source templates live in `src/`. Local data sources are 11ty `_data/*.js` modules that pull from Mike's wider system (calendar caches, kid balances, weather, meals).

## Dev loop

### Fast iteration with eleventy's built-in server
```
cd /root/crittermike.github.io/family
npm run dev          # eleventy --serve, hot-reload, default port 8080
```
Then visit:
- `http://localhost:8080/dashboard/` — production dashboard
- `http://localhost:8080/dashboard-edit/` — GridStack drag/resize spike
- `http://localhost:8080/_ipad-preview.html` — iframe harness sized for iPad 7 landscape (1080×810)

### Plain http.server (when you already have a build and just want to serve)
```
cd /root/crittermike.github.io/family
python3 -m http.server 8899
```
Note: `_site` is **not** used — output goes straight to `family/`. So the http.server root IS the built site.

### One-shot build
```
npm run build        # eleventy, ~5s (calendar.js eats 70%)
npm run clean        # rm -rf _site (vestigial — output isn't there anymore)
```

## Layout
- `src/dashboard.njk` — production dashboard. ~2400 lines. Hand-tuned CSS grid layout.
- `src/dashboard-edit.njk` — drag/resize/rearrange spike using GridStack. Same data, different shell.
- `src/_data/` — runs at build time, gives templates live data:
  - `kids.js` — sugar + allowance balances
  - `calendar.js` — **SLOW (3.7s, 70% of build)**. Pulls from cached iCloud feed.
  - `chores.js` — current weekend's chore rotation
  - `weather.js` — ~440ms, OpenWeather
  - `mealweek.js` — week's meal plan
  - `dinner.js` — tonight's dinner
- `src/_includes/shared.css` — copied to output as `/shared.css`
- `_ipad-preview.html` — iframe harness. Default src is `/dashboard/`; switch via `document.getElementById('dash').src = '/dashboard-edit/'`.

## dashboard-edit spike specifics
- Uses GridStack from CDN. Drag/resize/add/remove tiles, layout persisted to `localStorage` key `crittercrew.dashedit.layout.v1`.
- Tiles defined in `tileCatalog` JSON near top of script section; default positions in `defaultLayout`.
- Hidden HTML templates (`<div data-tpl="tileid">…</div>`) get cloned into the grid on demand.
- Live JS hydration happens in `hydrateTile(id)` for tiles needing runtime data (countdowns, budget, chores pill, calendar bucketing).
- Toolbar:
  - **+ Add tile** — picker for tiles not currently on the dashboard
  - **🔒 Unlock / 🔓 Lock** — toggle edit mode (amber shell when armed)
  - **Reset** — clears localStorage, reloads with default layout
  - **Dump JSON** — opens a `prompt()` with the current layout as JSON `[{id, x, y, w, h}, …]` so you can copy it back into `defaultLayout` to promote it.
- `/dashboard-edit/data.json` is also generated — endpoint dump of all `_data/` for local dev.

## Pitfalls — read before editing
1. **GridStack wraps `content` in its own `.grid-stack-item-content`.** Do NOT wrap your tile HTML in another one or you get a double border + double padding. Just return `'<button class="tile-rm">…</button>' + body` from `tileHTML()`.
2. **Eleventy templateFormats** must include `"11ty.js"` in `.eleventy.js` for any JS-based templates to compile.
3. **Calendar data passes through Nunjucks dump filter:** `const EVENTS = {{ calendar | dump | safe }};` — emits a JS literal at build time.
4. **Don't use `toISOString()` for "today"** — it's UTC and rolls to tomorrow after ~8pm ET. Build the local date string by hand (see `_todayStr` in dashboard-edit.njk).
5. **Vision tools lie about this dashboard.** They flag Fraunces serif as a "font mismatch" — it's intentional, used for display numbers + chore-day headers. Verify layout with `browser_console` + `getBoundingClientRect()`, not screenshots.
6. **Budget tile + countdowns are hardcoded** in both `dashboard.njk` and `dashboard-edit.njk` — there's no `_data/budget.js` or `_data/countdowns.js`. Update both files if these need to change.
7. **iPad preview harness viewport** is fixed 1280×577 in Browserbase. The harness scales the 1080×810 iframe to 68% to fit. Real iPad 7 is bigger; visual density on real device is roughly what you see in the harness.

## Design tokens (used in both dashboards)
- Fraunces serif (opsz 9..144, weights 500/600/700) for display numbers + chore-day headers
- `--accent-orange` for countdown numbers + today highlights
- `--accent-teal` for "today" countdown
- `.card-h` style = bold label + small uppercase sub
- `.cal-bucket-h` = uppercase tracking-1.2px header with row count pill, separates Today / Tomorrow / This week / Next week / Later

## Deploy
GitHub Pages auto-deploys from the `crittermike.github.io` repo's main branch. Just commit + push the changed files in `family/` (both source `src/*.njk` AND built `*/index.html` since output isn't in `_site`).

## When agents should regenerate vs hand-edit
- Layout/component changes → edit `src/*.njk` then `npm run build`
- New data source → add `src/_data/foo.js` (returns a value or async function), reference as `{{ foo }}` in templates
- Quick CSS tweak → edit the `<style>` block at the top of the dashboard njk file (CSS is inline, not in `shared.css`)
- Promoting the edit spike → don't yet. Still a sandbox.
