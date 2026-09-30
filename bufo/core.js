export const MAX_TEXT_LENGTH = 2000;
export const DEBOUNCE_MS = 700;

export function words(value) {
  return value.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').match(/[a-z0-9]+/g) ?? [];
}

export function indexCatalog(emojis) {
  return emojis.map(emoji => ({
    ...emoji,
    tokens: words(emoji.name).filter(word => !['bufo', 'frog', 'froge'].includes(word))
  }));
}

export function starterEmojis(index, limit = 12) {
  const chosen = [];
  const seen = new Set();
  for (const term of ['happy', 'wave', 'coffee', 'thinking', 'party', 'sleep', 'love', 'coding', 'cry', 'dance', 'cool', 'popcorn']) {
    const candidate = index.filter(emoji => emoji.tokens.includes(term))
      .sort((a, b) => a.name.length - b.name.length || a.name.localeCompare(b.name))
      .find(emoji => !seen.has(emoji.fingerprint || emoji.id));
    if (!candidate) continue;
    chosen.push({ ...candidate, reason: 'Click to copy' });
    seen.add(candidate.fingerprint || candidate.id);
    if (chosen.length === limit) return chosen;
  }
  for (const emoji of index) {
    if (seen.has(emoji.fingerprint || emoji.id)) continue;
    chosen.push({ ...emoji, reason: 'Click to copy' });
    seen.add(emoji.fingerprint || emoji.id);
    if (chosen.length === limit) break;
  }
  return chosen;
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
