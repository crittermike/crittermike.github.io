export const MAX_TEXT_LENGTH = 2000;
export const DEBOUNCE_MS = 700;

export async function readSuggestionStream(body, { onProgress, signal } = {}) {
  const invalid = () => new Error('Jev returned an invalid progress stream. Try again.');
  if (!body) throw invalid();
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let result;
  let scoredCount = -1;
  let totalCount;
  const consume = line => {
    if (!line.trim()) return;
    if (line.length > 65_536 || result) throw invalid();
    let event;
    try { event = JSON.parse(line); } catch { throw invalid(); }
    if (event?.type === 'progress') {
      if (!Number.isSafeInteger(event.scoredCount) || !Number.isSafeInteger(event.totalCount) ||
          event.totalCount < 1 || event.totalCount > 5000 || event.scoredCount < 0 ||
          event.scoredCount < scoredCount || event.scoredCount > event.totalCount ||
          (totalCount !== undefined && event.totalCount !== totalCount)) throw invalid();
      if (event.ranking !== undefined && (!event.ranking || typeof event.ranking !== 'object' ||
          Array.isArray(event.ranking) || event.ranking.evaluatedCount !== event.scoredCount)) throw invalid();
      scoredCount = event.scoredCount;
      totalCount = event.totalCount;
      onProgress?.(event);
    } else if (event?.type === 'result' && event.ranking && typeof event.ranking === 'object' && !Array.isArray(event.ranking)) {
      if (totalCount !== undefined && (scoredCount !== totalCount || event.ranking.evaluatedCount !== totalCount)) throw invalid();
      result = event.ranking;
    } else if (event?.type === 'error' && typeof event.error === 'string') {
      throw Object.assign(new Error(event.error), { code: event.code, retryAfter: event.retryAfter || 0 });
    } else throw invalid();
  };
  try {
    while (true) {
      let chunk;
      try { chunk = await reader.read(); } catch {
        if (signal?.aborted) throw signal.reason;
        throw new Error('The connection to Jev was interrupted before scoring finished. Try again.');
      }
      if (chunk.done) break;
      buffer += decoder.decode(chunk.value, { stream: true });
      let newline;
      while ((newline = buffer.indexOf('\n')) !== -1) {
        consume(buffer.slice(0, newline));
        buffer = buffer.slice(newline + 1);
      }
      if (buffer.length > 65_536) throw invalid();
    }
    consume(buffer + decoder.decode());
    if (!result) throw new Error('The connection to Jev ended before scoring finished. Try again.');
    return result;
  } finally {
    reader.releaseLock();
  }
}

export function groupEmojis(emojis) {
  const entries = [];
  const groups = new Map();
  for (const emoji of emojis) {
    const match = /^(.+)_(\d+)_(\d+)$/.exec(emoji.name);
    if (!match) {
      entries.push({
        id: emoji.id, name: emoji.name, tiles: [emoji], rows: [[emoji]],
        composite: false, complete: true, copyText: `:${emoji.name}:`
      });
      continue;
    }
    if (!groups.has(match[1])) groups.set(match[1], []);
    groups.get(match[1]).push({ emoji, column: BigInt(match[2]), row: BigInt(match[3]) });
  }
  const compare = (a, b) => a < b ? -1 : a > b ? 1 : 0;
  for (const [name, parts] of groups) {
    parts.sort((a, b) => compare(a.row, b.row) || compare(a.column, b.column) || a.emoji.name.localeCompare(b.emoji.name));
    const columns = parts.map(part => part.column).sort(compare);
    const height = parts.at(-1).row - parts[0].row + 1n;
    const width = columns.at(-1) - columns[0] + 1n;
    const unique = new Set(parts.map(part => `${part.row},${part.column}`));
    // Check the rectangle before allocating: suffix numbers can be arbitrarily large.
    const complete = height * width === BigInt(parts.length) && unique.size === parts.length;
    const tiles = parts.map(part => part.emoji);
    const rows = complete
      ? Array.from({ length: Number(height) }, (_, row) => tiles.slice(row * Number(width), (row + 1) * Number(width)))
      : [];
    entries.push({
      id: tiles[0].id, name, tiles, rows, composite: true, complete,
      copyText: complete ? rows.map(row => row.map(tile => `:${tile.name}:`).join('')).join('\n') : null
    });
  }
  return entries;
}

export function createDebouncedSearch({ search, onResult, onError, delay = DEBOUNCE_MS }) {
  let timer;
  let controller;
  let revision = 0;
  const cancel = () => {
    revision += 1;
    clearTimeout(timer);
    controller?.abort();
  };
  return {
    cancel,
    schedule(text) {
      cancel();
      const current = revision;
      timer = setTimeout(async () => {
        controller = new AbortController();
        try {
          const result = await search(text, controller.signal);
          if (current === revision) onResult(result, text);
        } catch (error) {
          if (current === revision && error.name !== 'AbortError') onError(error);
        }
      }, delay);
    }
  };
}
