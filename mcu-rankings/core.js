export const VERSION = 1;
export const STORAGE_KEY = 'mcu-family-rankings:v1';

export function loadSaved(storage, catalog) {
  let raw = null;
  try {
    raw = storage.getItem(STORAGE_KEY);
    return { state: raw === null ? createState(catalog) : parseBackup(raw, catalog), raw, blocked: false, error: '' };
  } catch {
    return { state: createState(catalog), raw, blocked: true, error: raw === null ? 'Device storage is unavailable. Changes will only last for this visit. Export a backup before leaving.' : 'Your saved data could not be read. The original is untouched. Changes are temporary until you choose how to recover.' };
  }
}
export function saveState(storage, state, catalog, expectedRaw, blocked = false) {
  if (blocked) return { ok: false, error: 'Saving is paused to protect your original data. Open Data & sharing to recover it.' };
  try {
    if (storage.getItem(STORAGE_KEY) !== expectedRaw) return { ok: false, conflict: true, error: 'Another tab changed this library. Export your current work, then reload before making more changes.' };
    const raw = JSON.stringify(validateState(state, catalog));
    storage.setItem(STORAGE_KEY, raw);
    if (storage.getItem(STORAGE_KEY) !== raw) throw new Error('Write was not retained.');
    return { ok: true, raw };
  } catch {
    return { ok: false, error: 'Could not save on this device. Your changes are still visible here. Export a backup before leaving.' };
  }
}

function validName(name) {
  return typeof name === 'string' && name.trim().length > 0 && name.length <= 40 && !/[\u0000-\u001f\u007f]/.test(name);
}
function validIds(ids, allowed) {
  return Array.isArray(ids) && ids.length <= allowed.size && new Set(ids).size === ids.length && ids.every(id => typeof id === 'string' && allowed.has(id));
}
export function validateState(value, catalog) {
  const allowed = new Set(catalog.map(movie => movie.id));
  const invalid = () => { throw new Error('This data is not a supported MCU rankings backup. Nothing has been replaced.'); };
  if (!value || value.version !== VERSION || !validIds(value.watched, allowed) || !Array.isArray(value.profiles) || value.profiles.length < 1 || value.profiles.length > 30) invalid();
  const profileIds = new Set();
  const watched = new Set(value.watched);
  const profiles = value.profiles.map(profile => {
    if (!profile || typeof profile.id !== 'string' || !/^[a-z0-9][a-z0-9-]{0,63}$/.test(profile.id) || profileIds.has(profile.id) || !validName(profile.name) || !validIds(profile.ranking, watched)) invalid();
    profileIds.add(profile.id);
    return { id: profile.id, name: profile.name.trim(), ranking: [...profile.ranking] };
  });
  if (!profileIds.has(value.activeProfile)) invalid();
  return { version: VERSION, watched: [...value.watched], profiles, activeProfile: value.activeProfile };
}
export function parseBackup(text, catalog) {
  if (typeof text !== 'string' || text.length > 200000) throw new Error('The backup is too large or is not text.');
  let value;
  try { value = JSON.parse(text); } catch { throw new Error('This file is not valid JSON. Nothing has been replaced.'); }
  return validateState(value, catalog);
}

function profileFor(state, id) {
  const profile = state.profiles.find(item => item.id === id);
  if (!profile) throw new Error('Choose an existing person.');
  return profile;
}
function replaceRanking(state, profileId, ranking) {
  return { ...state, profiles: state.profiles.map(profile => profile.id === profileId ? { ...profile, ranking } : profile) };
}
export function rankMovie(state, profileId, movieId, position) {
  const profile = profileFor(state, profileId);
  if (!state.watched.includes(movieId)) throw new Error('Mark this movie as watched first.');
  const ranking = profile.ranking.filter(id => id !== movieId);
  if (!Number.isInteger(position) || position < 1 || position > ranking.length + 1) throw new Error('Choose a position within the list.');
  ranking.splice(position - 1, 0, movieId);
  return replaceRanking(state, profileId, ranking);
}
export function unrankMovie(state, profileId, movieId) {
  return replaceRanking(state, profileId, profileFor(state, profileId).ranking.filter(id => id !== movieId));
}
export function seedReleaseOrder(state, profileId, catalog) {
  const profile = profileFor(state, profileId);
  const unranked = catalog.filter(movie => state.watched.includes(movie.id) && !profile.ranking.includes(movie.id)).map(movie => movie.id);
  return replaceRanking(state, profileId, [...profile.ranking, ...unranked]);
}
export function setWatched(state, movieId, watched, catalog) {
  if (!catalog.some(movie => movie.id === movieId) || typeof watched !== 'boolean') throw new Error('Choose a valid movie and watched status.');
  const selected = new Set(state.watched);
  if (watched) selected.add(movieId); else selected.delete(movieId);
  return {
    ...state,
    watched: catalog.filter(movie => selected.has(movie.id)).map(movie => movie.id),
    profiles: state.profiles.map(profile => ({ ...profile, ranking: profile.ranking.filter(id => selected.has(id)) }))
  };
}
export function editProfile(state, id, name) {
  if (typeof id !== 'string' || !/^[a-z0-9][a-z0-9-]{0,63}$/.test(id) || !validName(name)) throw new Error('Use a name between 1 and 40 characters.');
  name = name.trim();
  if (state.profiles.some(profile => profile.id !== id && profile.name.toLocaleLowerCase() === name.toLocaleLowerCase())) throw new Error('That name is already in use. Choose a different name.');
  const existing = state.profiles.some(profile => profile.id === id);
  if (!existing && state.profiles.length >= 30) throw new Error('This device supports up to 30 people.');
  const profiles = existing ? state.profiles.map(profile => profile.id === id ? { ...profile, name } : profile) : [...state.profiles, { id, name, ranking: [] }];
  return { ...state, profiles, activeProfile: id };
}
function validateShare(value, catalog) {
  if (!value || value.version !== VERSION || !validName(value.name) || !validIds(value.ranking, new Set(catalog.map(movie => movie.id)))) throw new Error('This ranking link is invalid or uses an unsupported version.');
  return { version: VERSION, name: value.name.trim(), ranking: [...value.ranking] };
}
export function encodeShare(profile, catalog) {
  return '#ranking=' + encodeURIComponent(JSON.stringify(validateShare({ version: VERSION, name: profile.name, ranking: profile.ranking }, catalog)));
}
export function decodeShare(fragment, catalog) {
  if (typeof fragment !== 'string' || !fragment.startsWith('#ranking=') || fragment.length > 16000) throw new Error('This is not a supported ranking link.');
  let value;
  try { value = JSON.parse(decodeURIComponent(fragment.slice(9))); } catch { throw new Error('This ranking link is incomplete or damaged.'); }
  return validateShare(value, catalog);
}
export function importShare(state, value, newId, name, catalog) {
  const incoming = validateShare(value, catalog);
  if (state.profiles.some(profile => profile.id === newId)) throw new Error('A shared ranking must be imported as a new person. Existing rankings will not be overwritten.');
  let result = editProfile(state, newId, name);
  const watched = new Set([...state.watched, ...incoming.ranking]);
  result = { ...result, watched: catalog.filter(movie => watched.has(movie.id)).map(movie => movie.id) };
  return replaceRanking(result, newId, incoming.ranking);
}
export function changeSession(session, nextState) {
  return { state: nextState, previous: session.state };
}
export function undoSession(session) {
  return session.previous ? { state: session.previous, previous: null } : session;
}
export function selectMovies(state, catalog, query = '') {
  const profile = profileFor(state, state.activeProfile);
  const term = query.trim().toLocaleLowerCase();
  const matches = movie => `${movie.title} ${movie.year}`.toLocaleLowerCase().includes(term);
  const byId = new Map(catalog.map(movie => [movie.id, movie]));
  return {
    profile,
    canDrag: term.length === 0,
    ranked: profile.ranking.map((id, index) => ({ ...byId.get(id), position: index + 1 })).filter(matches),
    unranked: catalog.filter(movie => state.watched.includes(movie.id) && !profile.ranking.includes(movie.id) && matches(movie)),
    unwatched: catalog.filter(movie => !state.watched.includes(movie.id) && matches(movie))
  };
}
export function dropPosition(rows, draggedId, pointerY) {
  return 1 + rows.filter(row => row.id !== draggedId && pointerY >= row.top + row.height / 2).length;
}
export function scrollVelocity(pointerY, viewportHeight) {
  const edge = Math.min(96, viewportHeight / 4);
  if (pointerY < edge) return -Math.min(18, Math.ceil((edge - pointerY) / edge * 18));
  if (pointerY > viewportHeight - edge) return Math.min(18, Math.ceil((pointerY - viewportHeight + edge) / edge * 18));
  return 0;
}
export function createState(catalog) {
  return {
    version: VERSION,
    watched: catalog.filter(movie => movie.watched).map(movie => movie.id),
    profiles: ['Mike', 'Nancy', 'Charlie', 'Henry', 'William', 'Thomas'].map(name => ({ id: name.toLowerCase(), name, ranking: [] })),
    activeProfile: 'mike'
  };
}
