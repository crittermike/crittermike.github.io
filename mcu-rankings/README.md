# MCU Ranked

Mobile-first family movie rankings, hosted at https://crittermike.github.io/mcu-rankings/.

## Use

Choose a person. Rank individual watched movies, or explicitly start in release order and rearrange. Drag the dotted handles on touch or desktop; Move chooses an exact position. Focus a handle for arrow/Home/End keyboard moves. Undo reverses the last change during the current visit.

The collection starts with 26 watched films and 11 remaining films. Watched status is shared among profiles on this device; rankings are independent. Deadpool & Wolverine is excluded because it is rated R. There are no prefilled preference scores.

Lists are saved to this browser's localStorage, not a server. Data & sharing exports a full JSON backup, restores with confirmation, and creates/imports individual ranking snapshots using URL fragments. Shared links do not automatically synchronize updates. Clearing browser data removes saved lists unless backed up.

## Develop

Static files, no build and no runtime dependencies. Serve this directory with any static HTTP server; opening index.html as a file will not load JavaScript modules or catalog.json.

```sh
node --test *.test.mjs
```

- `catalog.json`: eligible films in release order, watched defaults, relative poster paths.
- `core.js`: immutable ranking, validation, share encoding, persistence and undo logic.
- `view.js`: escaped list rendering.
- `app.js`: browser interactions and dialogs.
- `poster-sources.json`: title/year evidence and source URLs for poster thumbnails.

The `mcu-family-rankings:v1` storage key is specific to this app. Existing browser data is validated and never silently overwritten if invalid or changed by another tab. Future seed-catalog changes do not overwrite people's saved rankings or watched selections; use the collection manager for additions on existing devices.

## Verification

Node unit tests cover core behavior and rendered-list invariants. Actual Mac Chrome UI testing covers desktop and touch dragging, keyboard moves, profiles, search, adding movies, share preview/import, backup restore/undo, persistence, and mobile layouts. Do not substitute invented or demo family rankings for testing; use an isolated preview origin and leave live storage untouched.
