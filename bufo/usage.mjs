import { readFile } from 'node:fs/promises';
import { atomicWrite } from './catalog.mjs';
import { AppError } from './jev.mjs';

export function createUsageBudget({ path, tokenLimit, now = Date.now }) {
  if (!Number.isSafeInteger(tokenLimit) || tokenLimit < 1) throw new Error('A positive token budget is required.');
  let tail = Promise.resolve();
  async function update(change) {
    const previous = tail;
    let unlock;
    tail = new Promise(resolve => { unlock = resolve; });
    await previous;
    try {
      const today = new Date(now()).toISOString().slice(0, 10);
      let state;
      try {
        state = JSON.parse(await readFile(path, 'utf8'));
      } catch (error) {
        if (error.code !== 'ENOENT') throw new AppError(503, 'The usage budget is unavailable. The app owner needs to check storage.', 'BUDGET_STORAGE');
        state = { version: 1, day: today, usedTokens: 0 };
      }
      const date = Date.parse(`${state?.day}T00:00:00.000Z`);
      if (state?.version !== 1 || !/^\d{4}-\d{2}-\d{2}$/.test(state.day) || !Number.isFinite(date) ||
          new Date(date).toISOString().slice(0, 10) !== state.day || state.day > today ||
          !Number.isSafeInteger(state.usedTokens) || state.usedTokens < 0) {
        throw new AppError(503, 'The usage budget is invalid. The app owner needs to check storage.', 'BUDGET_STORAGE');
      }
      if (state.day !== today) state = { version: 1, day: today, usedTokens: 0 };
      const result = change(state);
      await atomicWrite(path, `${JSON.stringify(state)}\n`, { durable: true });
      return result;
    } finally { unlock(); }
  }
  return {
    async ready() {
      await update(() => {});
    },
    async reserve(maximumTokens) {
      if (!Number.isSafeInteger(maximumTokens) || maximumTokens < 1) throw new Error('A positive token reservation is required.');
      const day = await update(state => {
        if (maximumTokens > tokenLimit - state.usedTokens) {
          const midnight = Date.parse(`${state.day}T00:00:00.000Z`) + 86_400_000;
          throw new AppError(429, 'Today\'s Jev budget is used up. Try again after midnight UTC.', 'DAILY_BUDGET', Math.max(1, Math.ceil((midnight - now()) / 1000)));
        }
        state.usedTokens += maximumTokens;
        return state.day;
      });
      let settled = false;
      return async actualTokens => {
        // Keep the full reservation when the provider cannot report its usage.
        if (actualTokens === null) return;
        if (!Number.isSafeInteger(actualTokens) || actualTokens < 0 || actualTokens > maximumTokens) {
          throw new AppError(502, 'Jev reported invalid token usage. Try again later.', 'INVALID_RESPONSE');
        }
        if (settled) throw new Error('The usage reservation has already been settled.');
        settled = true;
        await update(state => {
          if (state.day === day) {
            if (state.usedTokens < maximumTokens) throw new AppError(503, 'The usage budget changed unexpectedly.', 'BUDGET_STORAGE');
            state.usedTokens -= maximumTokens - actualTokens;
          }
        });
      };
    }
  };
}
