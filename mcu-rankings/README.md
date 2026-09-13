# MCU Ranked

Mobile-first family movie rankings at https://crittermike.github.io/mcu-rankings/.

## Use

Everyone is the default, manually agreed family ranking, not an average of individual votes. All watched movies are already in one long numbered list. New lists start in release order as a neutral starting point, not an asserted preference. Drag handles to rearrange, tap Move for an exact position, or use arrows. A focused handle supports arrow keys and Home/End. Undo reverses the last change during the current visit.

Personal lists remain under the optional Personal lists disclosure. Everyone and each person's order are independent. The collection starts with 26 watched films and 11 remaining films. Marking a movie watched appends it to every list; marking it not watched removes it from every list with confirmation and Undo. Deadpool & Wolverine is excluded because it is rated R.

## Watched and unwatched

The Unwatched section sits below the full ranking and shows every not-yet-watched film. Drag a ranked film into this section to mark it not watched on all lists. The drop target highlights before release. Escape or a cancelled touch leaves data unchanged. The existing Undo button restores every person's prior position during this visit. For long lists or keyboard use, tap Move on a film, then Not watched yet and confirm. Mark a film Watched in the bottom section to append it to every ranking. Watched status remains shared; personal ranking order remains independent.

## Data safety

Lists are saved only to this browser's localStorage, not to a server. Data & sharing exports/restores a whole-library JSON backup and shares ranking snapshots in URL fragments. Shared links are not automatic synchronization. Importing a snapshot creates a new personal list without replacing Everyone. Newly watched films in an imported snapshot are appended to all existing lists; other missing watched films are appended to the imported list.

Storage key remains `mcu-family-rankings:v1` for continuity; stored library schema is now version 2. Valid v1 libraries are migrated in memory before any guarded save: preserve every existing personal name/ID and ranked prefix, append missing watched films in release order, add a distinct consensus profile, and select Everyone. Saved watched choices are not overwritten by catalog defaults. A custom old Everyone profile remains personal; a collision-free ID identifies the new consensus list. All 30 old profiles can be retained alongside Everyone. V2 backups require one consensus profile and complete duplicate-free watched lists. Ranking links remain wire version 1 for compatibility.

Invalid originals and changes from other tabs are protected. Migration does not refresh the expected-write baseline or overwrite storage during load. Download original reads current stored bytes without changing that baseline. Clearing browser data removes saved lists unless backed up.

## Develop and verify

Static files, no build or runtime dependencies. Serve through HTTP, not file://.

```sh
node --test *.test.mjs
node --check app.js
node --check core.js
node --check view.js
```

- `catalog.json`, `posters/`, `poster-sources.json`: real release-ordered catalog and image evidence.
- `core.js`: immutable ranking, v1 migration/v2 validation, snapshots, persistence and Undo.
- `view.js`: escaped list rendering.
- `app.js`: browser actions and dialogs.
- Tests: core, migration, view, real-shell hooks and VM action/recovery handlers.

UI testing must use Mike's verified Mac Chrome and a dedicated preview origin for synthetic state. Exercise mouse/touch drag, exact position, keyboard, profiles, search, watched additions/removals, sharing, backup restore, persistence and narrow mobile layout. Live smoke tests must capture and restore only this app's exact storage key; never clear all GitHub Pages storage.
