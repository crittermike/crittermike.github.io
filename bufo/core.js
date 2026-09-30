export const MAX_TEXT_LENGTH = 2000;
export const DEBOUNCE_MS = 700;

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
