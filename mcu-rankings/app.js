import * as core from './core.js';
import { escapeHTML as esc, poster, renderProfiles, renderLists, renderLibrary } from './view.js';

const $ = selector => document.querySelector(selector);
const modal = $('#modal');
let catalog, session, raw, blocked, storage, toastTimer, returnFocus;
let libraryTab = false, drag = null, raf = 0, shareDraft = null;
const movieFor = id => catalog.find(movie => movie.id === id);
const current = () => session.state.profiles.find(profile => profile.id === session.state.activeProfile);
const uid = () => 'person-' + crypto.randomUUID();
function announce(message) {
  $('#toast').textContent = message; $('#toast').classList.add('visible');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => $('#toast').classList.remove('visible'), 2600);
}
function showError(error) {
  const target = modal.open ? $('#modal-error') : $('#storage-warning');
  target.hidden = false; target.textContent = error.message || String(error);
}
function persist() {
  const result = core.saveState(storage, session.state, catalog, raw, blocked);
  if (result.ok) { raw = result.raw; $('#storage-warning').hidden = true; $('#save-status').textContent = 'Saved on this device · Share a ranking to move it between devices.'; }
  else { if (result.conflict) blocked = true; $('#save-status').textContent = 'Changes are temporary. Export a backup before leaving.'; showError(result.error); }
  return result;
}
function render() {
  const state = session.state, profile = current();
  $('#profiles').innerHTML = renderProfiles(state);
  $('#person-heading').textContent = profile.name + '’s list';
  const consensus = profile.id === state.consensusProfile;
  $('#list-kind').textContent = consensus ? 'FAMILY CONSENSUS' : 'PERSONAL LIST';
  $('#list-description').textContent = consensus ? 'Decide together, then move the movies into the order you all agree on. Everyone is not an average of personal lists.' : 'Your own order. Changes here leave Everyone and the other personal lists unchanged.';
  $('#rename-profile').hidden = consensus;
  $('#lists').innerHTML = renderLists(state, catalog, $('#search').value);
  $('#watched-count').textContent = state.watched.length;
  $('#people-count').textContent = state.profiles.length;
  $('#undo').disabled = !session.previous;
  $('#clear-search').hidden = !$('#search').value;
}
function commit(state, message) {
  session = core.changeSession(session, state); persist(); render(); if (message) announce(message);
}
function openDialog(title, html) {
  if (!modal.open) returnFocus = document.activeElement;
  $('#modal-title').textContent = title; $('#modal-content').innerHTML = html;
  $('#modal-error').hidden = true; if (!modal.open) modal.showModal();
  const focus = modal.querySelector('[autofocus]') || modal.querySelector('input,select,textarea') || modal.querySelector('button');
  focus?.focus();
}
function closeDialog() { modal.close(); }
modal.addEventListener('close', () => { if (returnFocus?.isConnected) returnFocus.focus(); });
modal.addEventListener('click', event => { if (event.target === modal) { const r = modal.getBoundingClientRect(); if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) closeDialog(); } });
function confirmAction(title, text, label, callback, danger = false) {
  openDialog(title, `<p>${esc(text)}</p><div class="button-row"><button id="confirm-action" class="${danger ? 'danger' : 'primary'}">${esc(label)}</button><button data-action="close">Cancel</button></div>`);
  $('#confirm-action').onclick = () => { try { callback(); closeDialog(); } catch (error) { showError(error); } };
}
function rankDialog(id) {
  const movie = movieFor(id), profile = current(), index = profile.ranking.indexOf(id);
  if (index < 0) throw new Error('Only watched movies can be moved. Use the movie collection to mark it watched first.');
  const max = profile.ranking.length;
  openDialog('Move to a position', `<div class="dialog-film">${poster(movie, true)}<div><h3>${esc(movie.title)}</h3><p>${movie.year} · ${esc(profile.name)}’s ranking</p></div></div><form id="rank-form"><label for="position">Position in the full list</label><input id="position" name="position" type="number" inputmode="numeric" min="1" max="${max}" value="${index + 1}" required autofocus><p class="fine-print">1 is best. ${max} is the last position. Other movies move automatically.</p><div class="button-row"><button type="submit" class="primary">Save position</button><button type="button" data-action="close">Cancel</button></div></form>`);
  $('#rank-form').onsubmit = event => { event.preventDefault(); try { const position = Number($('#position').value); commit(core.rankMovie(session.state, session.state.activeProfile, id, position), `${movie.title} is now #${position}`); closeDialog(); } catch (error) { showError(error); } };
  $('#position').select();
}
function libraryDialog() {
  openDialog('The movie collection', `<p>Watched status is shared by everyone on this device. Rankings stay separate.</p><div class="library-tabs"><button data-action="library-tab" data-tab="next" aria-pressed="${!libraryTab}">Next to watch</button><button data-action="library-tab" data-tab="seen" aria-pressed="${libraryTab}">Already watched</button></div><label class="sr-only" for="library-search">Search the collection</label><input id="library-search" type="search" placeholder="Search all movies…" autocomplete="off"><div id="library-results"></div>`);
  renderLibraryResults(); $('#library-search').addEventListener('input', renderLibraryResults);
}
function renderLibraryResults() { $('#library-results').innerHTML = renderLibrary(session.state, catalog, $('#library-search').value, libraryTab); }
function nameDialog(rename = false) {
  openDialog(rename ? 'Edit name' : 'Add a person', `<form id="name-form"><label for="person-name">Name</label><input id="person-name" required maxlength="40" value="${rename ? esc(current().name) : ''}" autocomplete="off" autofocus><p class="fine-print">Each person gets a separate best-to-worst list.</p><div class="button-row"><button class="primary" type="submit">${rename ? 'Save name' : 'Add person'}</button><button type="button" data-action="close">Cancel</button></div></form>`);
  $('#name-form').onsubmit = event => { event.preventDefault(); try { commit(core.editProfile(session.state, rename ? current().id : uid(), $('#person-name').value), rename ? 'Name updated' : 'Person added'); closeDialog(); } catch (error) { showError(error); } };
}
function download(text, filename, type = 'application/json') {
  const url = URL.createObjectURL(new Blob([text], { type })); const a = document.createElement('a'); a.href = url; a.download = filename; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function dataDialog() {
  openDialog('Data & sharing', `<p>Your lists are saved <strong>in this browser</strong>, not in a cloud account. Use a ranking link for another device, or a backup for the whole collection.</p><section class="data-section"><h3>Share ${esc(current().name)}’s ranking</h3><p>Send a snapshot of this list. The recipient previews it before saving. Shared links do not update automatically.</p><button data-action="share">Create ranking link ↗</button></section><section class="data-section"><h3>Back up everyone</h3><p>Download all rankings and watched movies as one file.</p><button data-action="export">Download backup</button></section><section class="data-section"><h3>Restore a backup</h3><p>Preview and confirm before replacing this device’s library.</p><label for="backup-file">Choose a rankings JSON file</label><input id="backup-file" type="file" accept=".json,application/json"></section><section class="data-section"><h3>Import a ranking link</h3><label for="ranking-link">Paste a shared link</label><textarea id="ranking-link" rows="3" placeholder="https://…/#ranking=…"></textarea><div class="button-row"><button data-action="preview-link">Preview ranking</button></div></section>${blocked ? `<section class="data-section"><h3>Recover device storage</h3><p>Saving is paused. Download the original first, then explicitly replace it with the library currently on screen.</p><div class="button-row"><button data-action="original">Download original</button><button class="danger" data-action="recover">Use current library</button></div></section>` : ''}`);
  $('#backup-file').addEventListener('change', async event => {
    try { const file = event.target.files[0]; if (!file) return; if (file.size > 200000) throw new Error('Choose a backup smaller than 200 KB.'); const incoming = core.parseBackup(await file.text(), catalog); confirmAction('Replace this device’s library?', `This backup contains ${incoming.profiles.length} people and ${incoming.watched.length} watched movies. It replaces your current library. Download a backup first if you want to keep it. You can undo this replacement during this visit.`, 'Replace library', () => commit(incoming, 'Backup restored'), true); } catch (error) { showError(error); }
  });
}
function shareDialog() {
  const profile = current();
  if (!profile.ranking.length) { announce('Rank a movie first, then share your list.'); return; }
  const url = new URL(location.href); url.search = ''; url.hash = core.encodeShare(profile, catalog);
  openDialog(`Share ${profile.name}’s ranking`, `<p>This link contains the ${profile.ranking.length} movies in this ranking. Anyone with the link can view and import this snapshot. It does not sync future changes.</p><label for="share-url">Ranking link</label><textarea id="share-url" readonly rows="4">${esc(url.href)}</textarea><div class="button-row"><button class="primary" data-action="copy-link">Copy link</button>${navigator.share ? '<button data-action="native-share">Share…</button>' : ''}<button data-action="close">Done</button></div>`);
}
function importPreview(fragment) {
  const incoming = core.decodeShare(fragment, catalog); shareDraft = incoming;
  let name = incoming.name, n = 1;
  while (session.state.profiles.some(profile => profile.name.toLocaleLowerCase() === name.toLocaleLowerCase())) { name = incoming.name.slice(0, 26) + (n === 1 ? ' (shared)' : ` (shared ${n})`); n++; }
  openDialog(`${incoming.name}’s shared ranking`, `<p>${incoming.ranking.length} movies in this snapshot. Import as a new personal list. Everyone and your other lists are not replaced.</p><p>The incoming order stays first; missing watched movies are appended in release order. Any newly watched movies from this snapshot are appended to every existing list, preserving its order.</p><ol class="share-preview">${incoming.ranking.map(id => `<li>${esc(movieFor(id).title)}</li>`).join('')}</ol><form id="share-form"><label for="import-name">Save as</label><input id="import-name" maxlength="40" required value="${esc(name)}"><div class="button-row"><button class="primary" type="submit">Import ranking</button><button type="button" data-action="close">Cancel</button></div></form>`);
  $('#share-form').onsubmit = event => { event.preventDefault(); try { commit(core.importShare(session.state, shareDraft, uid(), $('#import-name').value, catalog), 'Shared ranking imported'); history.replaceState(null, '', location.pathname + location.search); closeDialog(); } catch (error) { showError(error); } };
}
function startDrag(event, handle) {
  if (event.button !== undefined && event.button !== 0 || handle.disabled || $('#search').value.trim()) return;
  event.preventDefault(); const row = handle.closest('[data-movie]');
  drag = { id: handle.dataset.id, pointer: event.pointerId, y: event.clientY, startY: event.clientY, moved: false, position: current().ranking.indexOf(handle.dataset.id) + 1, row, handle };
  handle.setPointerCapture(event.pointerId); row.classList.add('dragging'); document.body.classList.add('is-dragging');
  function frame() { if (!drag) return; if (drag.moved) { const speed = core.scrollVelocity(drag.y, innerHeight); if (speed) window.scrollBy(0, speed); updateDrop(); } raf = requestAnimationFrame(frame); } raf = requestAnimationFrame(frame);
}
function updateDrop() {
  if (!drag) return;
  const rows = [...document.querySelectorAll('#ranked-list > [data-movie]')].map(row => ({ id: row.dataset.movie, ...pickRect(row.getBoundingClientRect()) }));
  drag.position = core.dropPosition(rows, drag.id, drag.y);
  const others = rows.filter(row => row.id !== drag.id); const target = others[drag.position - 1]; const last = others.at(-1);
  const rect = $('#ranked-list').getBoundingClientRect(); const line = $('#drop-line');
  line.hidden = !drag.moved; line.style.left = rect.left + 'px'; line.style.width = rect.width + 'px'; line.style.top = (target ? target.top : last ? last.top + last.height : rect.top) + 'px';
}
function pickRect(rect) { return { top: rect.top, height: rect.height }; }
function endDrag(cancel = false) {
  if (!drag) return; const done = drag; drag = null; cancelAnimationFrame(raf); done.row.classList.remove('dragging'); document.body.classList.remove('is-dragging'); $('#drop-line').hidden = true;
  if (done.handle.hasPointerCapture(done.pointer)) done.handle.releasePointerCapture(done.pointer);
  if (!cancel && done.moved) { commit(core.rankMovie(session.state, current().id, done.id, done.position), `${movieFor(done.id).title} moved to #${done.position}`); document.querySelector(`[data-action="drag"][data-id="${done.id}"]`)?.focus({ preventScroll: true }); }
}
async function action(button) {
  const id = button.dataset.id;
  switch (button.dataset.action) {
    case 'profile': session.state = { ...session.state, activeProfile: id }; persist(); render(); document.querySelector(`[data-action="profile"][data-id="${id}"]`)?.focus({ preventScroll: true }); break;
    case 'move': rankDialog(id); break;
    case 'up': case 'down': { const pos = current().ranking.indexOf(id) + (button.dataset.action === 'up' ? 0 : 2); commit(core.rankMovie(session.state, current().id, id, pos), `${movieFor(id).title} moved to #${pos}`); document.querySelector(`[data-action="${button.dataset.action}"][data-id="${id}"]`)?.focus({ preventScroll: true }); break; }

    case 'undo': session = core.undoSession(session); persist(); render(); announce('Last change undone'); break;
    case 'close': closeDialog(); break;
    case 'library': libraryTab = false; libraryDialog(); break;
    case 'library-tab': libraryTab = button.dataset.tab === 'seen'; libraryDialog(); break;
    case 'watched-add': commit(core.setWatched(session.state, id, true, catalog), `${movieFor(id).title} appended to every list`); renderLibraryResults(); break;
    case 'watched-remove': confirmAction('Mark as not watched?', `Remove ${movieFor(id).title} from the watched library and everyone’s rankings? You can undo this.`, 'Mark as not watched', () => commit(core.setWatched(session.state, id, false, catalog), 'Movie removed from watched library'), true); break;
    case 'clear-search': $('#search').value = ''; render(); $('#search').focus(); break;
    case 'add-profile': nameDialog(false); break;
    case 'rename': nameDialog(true); break;
    case 'data': dataDialog(); break;
    case 'share': shareDialog(); break;
    case 'export': download(JSON.stringify(core.validateState(session.state, catalog), null, 2), 'mcu-rankings-backup.json'); announce('Backup download started'); break;
    case 'original': {
      const latestRaw = storage.getItem(core.STORAGE_KEY);
      if (latestRaw === null) throw new Error('No saved data remains on this device. Export your current work, then reload.');
      download(latestRaw, 'mcu-rankings-original.json'); break;
    }
    case 'recover': confirmAction('Replace saved data?', 'This overwrites the original saved data with the library currently on screen. Download the original first if you want to keep it.', 'Replace saved data', () => {
      // Keep the loaded baseline: recovery must not accept another tab’s newer data.
      blocked = false;
      const result = persist();
      if (!result.ok) { blocked = true; throw new Error(result.error); }
    }, true); break;
    case 'preview-link': { const value = $('#ranking-link').value.trim(); const start = value.indexOf('#ranking='); if (start < 0) throw new Error('Paste a complete ranking link.'); importPreview(value.slice(start)); break; }
    case 'copy-link': try { await navigator.clipboard.writeText($('#share-url').value); announce('Ranking link copied'); } catch { $('#share-url').focus(); $('#share-url').select(); showError('Copy is unavailable here. Select and copy the link above.'); } break;
    case 'native-share': try { await navigator.share({ title: `${current().name}’s MCU ranking`, url: $('#share-url').value }); } catch (error) { if (error.name !== 'AbortError') showError(error); } break;
  }
}
async function boot() {
  const response = await fetch('./catalog.json'); if (!response.ok) throw new Error('The movie collection could not load. Please reload.'); catalog = await response.json();
  try { storage = window.localStorage; } catch { storage = { getItem() { throw new Error('Storage unavailable'); } }; }
  const loaded = core.loadSaved(storage, catalog); session = { state: loaded.state, previous: null }; raw = loaded.raw; blocked = loaded.blocked;
  $('#hero-art').innerHTML = ['iron-man', 'avengers-endgame', 'guardians-of-the-galaxy'].map(id => poster(movieFor(id), true)).join('');
  render(); if (loaded.error) { showError(loaded.error); $('#save-status').textContent = 'Changes are temporary. Export a backup before leaving.'; }
  document.body.dataset.ready = 'true';
  if (location.hash.startsWith('#ranking=')) { try { importPreview(location.hash); } catch (error) { showError(error); } }
  window.addEventListener('hashchange', () => { if (location.hash.startsWith('#ranking=')) { try { importPreview(location.hash); } catch (error) { showError(error); } } });
  document.addEventListener('click', event => { const button = event.target.closest('[data-action]'); if (button && !button.disabled && session && button.dataset.action !== 'drag') action(button).catch(showError); });
  $('#search').addEventListener('input', render);
  document.addEventListener('error', event => { if (event.target.tagName === 'IMG') event.target.hidden = true; }, true);
  document.addEventListener('pointerdown', event => { const handle = event.target.closest('[data-action="drag"]'); if (handle) startDrag(event, handle); });
  document.addEventListener('pointermove', event => { if (drag && event.pointerId === drag.pointer) { drag.y = event.clientY; drag.moved ||= Math.abs(drag.y - drag.startY) > 5; } });
  document.addEventListener('pointerup', event => { if (drag && event.pointerId === drag.pointer) endDrag(); });
  document.addEventListener('pointercancel', () => endDrag(true));
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && drag) { event.preventDefault(); endDrag(true); return; }
    const handle = event.target.closest('[data-action="drag"]'); if (!handle || handle.disabled) return;
    if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); rankDialog(handle.dataset.id); }
    if (['ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) {
      event.preventDefault(); const id = handle.dataset.id, length = current().ranking.length; const old = current().ranking.indexOf(id) + 1;
      const pos = event.key === 'Home' ? 1 : event.key === 'End' ? length : Math.max(1, Math.min(length, old + (event.key === 'ArrowUp' ? -1 : 1)));
      commit(core.rankMovie(session.state, current().id, id, pos), `${movieFor(id).title} moved to #${pos}`); document.querySelector(`[data-action="drag"][data-id="${id}"]`)?.focus({ preventScroll: true });
    }
  });
  window.addEventListener('storage', event => { if (event.key === core.STORAGE_KEY && event.newValue !== raw) { blocked = true; $('#save-status').textContent = 'Another tab changed this library. Reload before editing.'; showError('Another tab changed this library. Export unsaved changes before reloading.'); } });
}
boot().catch(error => { $('#lists').innerHTML = '<p class="warning"></p>'; $('#lists .warning').textContent = error.message || 'Could not start. Please reload.'; });
