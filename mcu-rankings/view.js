import { selectMovies } from './core.js';

export function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
}
export function poster(movie, eager = false) {
  return `<div class="poster" aria-hidden="true"><span class="poster-fallback"><small>MARVEL</small><strong>${escapeHTML(movie.title)}</strong><small>${movie.year}</small></span><img src="${escapeHTML(movie.poster)}" alt="" loading="${eager ? 'eager' : 'lazy'}" decoding="async" width="96" height="144"></div>`;
}
export function renderProfiles(state) {
  const consensus = state.profiles.find(profile => profile.id === state.consensusProfile);
  const ordered = [consensus, ...state.profiles.filter(profile => profile.id !== state.consensusProfile)];
  const buttons = ordered.map(profile => `<button class="profile-button${profile.id === state.consensusProfile ? ' consensus-profile' : ''}" data-action="profile" data-id="${escapeHTML(profile.id)}" aria-pressed="${profile.id === state.activeProfile}"><span class="avatar" aria-hidden="true">${escapeHTML(profile.name.slice(0, 1))}</span><span class="profile-copy"><strong>${escapeHTML(profile.name)}</strong><small>${profile.id === state.consensusProfile ? 'Family consensus' : 'Personal list'}</small></span></button>`);
  return buttons[0] + `<details class="personal-lists"${state.activeProfile === state.consensusProfile ? '' : ' open'}><summary>Personal lists <span class="subtle">(optional)</span></summary><div class="personal-options">${buttons.slice(1).join('')}<button class="add-profile" data-action="add-profile" aria-label="Add a person">＋</button></div></details>`;
}
export function renderLibrary(state, catalog, query = '', showWatched = false) {
  const term = query.trim().toLocaleLowerCase();
  const movies = catalog.filter(movie => state.watched.includes(movie.id) === showWatched && `${movie.title} ${movie.year}`.toLocaleLowerCase().includes(term));
  return `<ul class="movie-list library-list">${movies.map(movie => `<li class="movie-row">${poster(movie)}<div class="movie-info"><h4>${escapeHTML(movie.title)}</h4><p>${movie.year}</p></div><button data-action="watched-${showWatched ? 'remove' : 'add'}" data-id="${movie.id}" aria-label="${showWatched ? 'Mark as not watched:' : 'Mark as watched:'} ${escapeHTML(movie.title)}">${showWatched ? 'Not seen' : 'Watched ＋'}</button></li>`).join('')}</ul>${movies.length ? '' : `<p class="no-results">${term ? 'No movies match this search.' : showWatched ? 'Your watched library is empty.' : 'You have watched every movie in this collection.'}</p>`}${showWatched ? '' : '<p class="fine-print">Deadpool &amp; Wolverine is not included in this family collection because it is rated R.</p>'}`;
}
export function renderLists(state, catalog, query = '') {
  const { profile, ranked, canDrag } = selectMovies(state, catalog, query);
  return `<section aria-labelledby="ranked-heading" class="ranking-section">
    <div class="section-heading"><h3 id="ranked-heading">The ranking <span class="count">${profile.ranking.length}</span></h3><a class="jump-unwatched" href="#unwatched-heading">Unwatched ↓</a><span class="eyebrow">BEST TO WORST</span></div>
    <p class="starting-note">Every watched movie is already here. New lists use release order as a starting point, not a verdict. Existing choices stay in place; newly watched movies go to the bottom.</p>
    ${profile.ranking.length ? `<p class="list-help">${canDrag ? 'Drag the dotted handle to reorder. Use the arrows or tap Move for an exact position. On a focused handle: arrow keys move one spot; Home / End move to first / last.' : 'Clear search to drag. Move and arrows still use positions in the full ranking.'}</p>
      <ol id="ranked-list" class="movie-list ranked">${ranked.map(movie => `<li value="${movie.position}" class="movie-row" data-movie="${movie.id}">
        <span class="rank-number" aria-label="Position ${movie.position}">${movie.position}</span>${poster(movie)}
        <div class="movie-info"><h4>${escapeHTML(movie.title)}</h4><p>${movie.year}</p></div>
        <div class="reorder-controls">
          <button class="icon-button arrow" data-action="up" data-id="${movie.id}" aria-label="Move ${escapeHTML(movie.title)} up" ${movie.position === 1 ? 'disabled' : ''}>↑</button>
          <button class="icon-button arrow" data-action="down" data-id="${movie.id}" aria-label="Move ${escapeHTML(movie.title)} down" ${movie.position === profile.ranking.length ? 'disabled' : ''}>↓</button>
          <button class="move-button" data-action="move" data-id="${movie.id}" aria-label="Move ${escapeHTML(movie.title)} to position">Move</button>
          <button class="icon-button drag-handle" data-action="drag" data-id="${movie.id}" ${canDrag ? '' : 'disabled'} aria-label="Reorder ${escapeHTML(movie.title)}. Use arrow keys, Home or End, or press Enter to choose a position."><span aria-hidden="true">⠿</span></button>
        </div></li>`).join('')}</ol>
      ${ranked.length ? '' : '<p class="no-results">No movies match in your ranking.</p>'}` : '<div class="empty-ranking"><div><h4>No watched movies yet.</h4><p>Mark a movie watched in the collection and it appears in every list automatically.</p><button data-action="library">Open movie collection</button></div></div>'}
    </section>
    <section id="unwatched-zone" class="unwatched-section" aria-labelledby="unwatched-heading">
      <div class="section-heading"><h3 id="unwatched-heading" tabindex="-1">Unwatched <span class="count">${catalog.length - state.watched.length}</span></h3><a class="quiet" href="#ranked-heading">Back to ranking ↑</a></div>
      <p class="unwatched-help">Drop a movie here to mark it not watched yet. This removes it from Everyone and all personal lists. Undo restores the previous rankings.</p>
      <div class="unwatched-drop-hint" aria-hidden="true">Drop here: not watched yet</div>
      ${renderLibrary(state, catalog, query, false)}
    </section>`;
}
