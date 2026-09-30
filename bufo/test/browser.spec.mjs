import { once } from 'node:events';
import { setTimeout as delay } from 'node:timers/promises';
import { test as base, expect } from '@playwright/test';
import { createBufoServer } from '../server.mjs';
import { answerRequest, catalog, emoji, TEST_KEY } from './fixtures.mjs';

const names = ['happy', 'coffee', 'thinking', 'party', 'sleep', 'love', 'coding', 'cry', 'dance', 'cool', 'popcorn', 'wave', 'relieved', 'thankful', 'facepalm', 'panic', 'embarrassed'];
const test = base.extend({
  app: async ({}, use) => {
    const state = { requests: [], failStatus: 0, delayMs: 0, aborted: 0, weak: false };
    const value = { ...catalog(), emojis: names.map((name, index) => emoji(index, `bufo-${name}`)) };
    const server = await createBufoServer({
      env: { TYPESAFE_API_KEY: TEST_KEY },
      minInterval: 0,
      catalogStore: {
        get: async () => value,
        image: async () => ({
          bytes: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aB9sAAAAASUVORK5CYII=', 'base64'),
          type: 'image/png'
        })
      },
      fetchImpl: async (_url, options) => {
        const body = JSON.parse(options.body);
        state.requests.push(body);
        if (state.delayMs) {
          try {
            await delay(state.delayMs, null, { signal: options.signal });
          } catch (error) {
            if (options.signal.aborted) state.aborted += 1;
            throw error;
          }
        }
        if (state.failStatus) return new Response('', { status: state.failStatus });
        return Response.json(answerRequest(body, filename => {
          if (state.weak) return 0.1;
          if (body.state.message.includes('sleep')) return filename.includes('sleep') ? 0.98 : 0.1;
          if (body.state.message === 'oops') return filename.includes('facepalm') ? 0.98 : 0.3;
          if (body.state.message === 'payments are broken') return filename.includes('panic') ? 0.97 : 0.3;
          return filename.includes('happy') ? 0.94 : 0.6;
        }));
      }
    });
    server.listen(0, '127.0.0.1');
    await once(server, 'listening');
    const url = `http://127.0.0.1:${server.address().port}`;
    try {
      await use({ url, state });
    } finally {
      server.closeAllConnections();
      await new Promise(resolve => server.close(resolve));
    }
  }
});

async function open(page, app) {
  await page.goto(app.url);
  await expect(page.locator('#message')).toBeEnabled();
  await expect(page.locator('.emoji')).toHaveCount(0);
}

async function pauseClock(page) {
  await page.clock.install({ time: new Date('2026-09-30T12:00:00Z') });
  await page.clock.pauseAt(new Date('2026-09-30T12:01:00Z'));
}

async function suggest(page, text = 'Good day') {
  await page.locator('#message').fill(text);
  await expect(page.locator('.emoji')).toHaveCount(12);
}

test('fresh viewers get automatic suggestions without keys, settings, or an opt-in step', async ({ page, app }) => {
  await open(page, app);
  await expect(page.locator('input[type="password"], select, dialog, input[type="checkbox"]')).toHaveCount(0);
  expect(app.state.requests).toHaveLength(0);
  await suggest(page);
  await expect(page.locator('.emoji').first()).toContainText(':bufo-happy:');
  expect(await page.evaluate(() => localStorage.length)).toBe(0);
  expect(await page.content()).not.toContain(TEST_KEY);
});

test('debounces, scores every filename, caches repeats, and clears stale results', async ({ page, app }) => {
  await open(page, app);
  await pauseClock(page);
  await page.locator('#message').fill('Good');
  await page.clock.runFor(400);
  await page.locator('#message').fill('Good day');
  await page.clock.runFor(699);
  expect(app.state.requests).toHaveLength(0);
  await page.clock.runFor(1);
  await expect(page.locator('.emoji').first()).toContainText(':bufo-happy:');
  await expect(page.locator('.emoji').first()).not.toContainText('%');
  const count = app.state.requests.length;
  const scoring = app.state.requests.filter(body => body.state.message === 'Good day');
  expect(scoring.flatMap(body => Object.values(body.questions))).toHaveLength(names.length);
  await page.locator('#message').fill('');
  await expect(page.locator('.emoji')).toHaveCount(0);
  await page.locator('#message').fill('Good day');
  await page.clock.runFor(700);
  await expect(page.locator('.emoji')).toHaveCount(12);
  expect(app.state.requests).toHaveLength(count);
});

test('input composition is not sent until the user finishes', async ({ page, app }) => {
  await open(page, app);
  await pauseClock(page);
  await page.locator('#message').dispatchEvent('compositionstart');
  await page.locator('#message').fill('Still composing');
  await page.clock.runFor(1500);
  expect(app.state.requests).toHaveLength(0);
  await page.locator('#message').dispatchEvent('compositionend');
  await page.clock.runFor(700);
  await expect(page.locator('.emoji')).toHaveCount(12);
});

test('cancels obsolete work and renders only the newest message', async ({ page, app }) => {
  await open(page, app);
  app.state.delayMs = 150;
  await pauseClock(page);
  await page.locator('#message').fill('Good day');
  await page.clock.runFor(700);
  await expect.poll(() => app.state.requests.length).toBe(1);
  await page.locator('#message').fill('I need sleep');
  await expect.poll(() => app.state.aborted).toBeGreaterThan(0);
  await page.clock.runFor(700);
  await expect(page.locator('.emoji').first()).toContainText(':bufo-sleep:');
  await expect(page.locator('#status')).not.toHaveClass('error');
});

for (const [text, expected] of [['oops', 'bufo-facepalm'], ['payments are broken', 'bufo-panic']]) {
  test(`"${text}" ranks filenames without keyword overlap`, async ({ page, app }) => {
    await open(page, app);
    await suggest(page, text);
    await expect(page.locator('.emoji').first()).toContainText(`:${expected}:`);
    const requests = app.state.requests.filter(body => body.state.message === text);
    const questions = requests.flatMap(body => Object.values(body.questions));
    expect(questions).toHaveLength(names.length);
    expect(questions.every(question => question.type === 'noul')).toBe(true);
  });
}

test('billing failure names the owner action without asking viewers for keys or silently retrying', async ({ page, app }) => {
  await open(page, app);
  app.state.failStatus = 402;
  await pauseClock(page);
  await page.locator('#message').fill('coffee');
  await page.clock.runFor(700);
  await expect(page.locator('#status')).toContainText('app owner needs to update billing');
  await expect(page.locator('#message')).toBeDisabled();
  await expect(page.locator('.emoji')).toHaveCount(0);
  const count = app.state.requests.length;
  await page.clock.runFor(60_000);
  expect(app.state.requests).toHaveLength(count);
});

test('retry recovers a transient provider failure without a setup step', async ({ page, app }) => {
  await open(page, app);
  app.state.failStatus = 500;
  await page.locator('#message').fill('Good day');
  await expect(page.locator('#retry')).toBeVisible();
  await expect(page.locator('.emoji')).toHaveCount(0);
  app.state.failStatus = 0;
  await page.locator('#retry').click();
  await expect(page.locator('.emoji')).toHaveCount(12);
  await expect(page.locator('#retry')).toBeHidden();
});

test('weak matches are explicit rather than an empty results screen', async ({ page, app }) => {
  app.state.weak = true;
  await open(page, app);
  await suggest(page);
  await expect(page.locator('#status')).toContainText('No strong match');
});

test('copies the exact Slack code without touching the host clipboard', async ({ page, app }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: async code => { window.testCopiedCode = code; } }
    });
  });
  await open(page, app);
  await suggest(page);
  await page.getByRole('button', { name: 'Copy :bufo-happy:', exact: true }).click();
  expect(await page.evaluate(() => window.testCopiedCode)).toBe(':bufo-happy:');
  await expect(page.locator('#copy-status')).toHaveText('Copied :bufo-happy:');
});

test('clipboard and image failures are visible with a manual copy fallback', async ({ page, app }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: async () => { throw new Error('Denied'); } }
    });
  });
  await page.route('**/api/emoji/*', route => route.fulfill({ status: 503, body: 'unavailable' }));
  await open(page, app);
  await suggest(page);
  await expect(page.locator('#status')).toContainText('Some previews failed');
  await page.getByRole('button', { name: 'Copy :bufo-happy:', exact: true }).click();
  await expect(page.locator('#manual-copy')).toBeVisible();
  await expect(page.locator('#copy-code')).toHaveValue(':bufo-happy:');
  await expect(page.locator('#copy-code')).toBeFocused();
});

test('desktop and mobile stay light even with dark OS settings or old theme links', async ({ page, app }) => {
  await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' });
  await open(page, app);
  await suggest(page);
  for (const width of [1280, 375, 320]) {
    await page.setViewportSize({ width, height: 812 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect(await page.evaluate(() => getComputedStyle(document.documentElement).colorScheme)).toBe('light');
    expect(await page.evaluate(() => getComputedStyle(document.body).backgroundColor)).toBe('rgb(255, 238, 0)');
  }
  await page.goto(`${app.url}/?clawpilotTheme=dark`);
  expect(await page.evaluate(() => getComputedStyle(document.documentElement).colorScheme)).toBe('light');
  await page.emulateMedia({ colorScheme: 'light' });
  expect(await page.evaluate(() => getComputedStyle(document.body).backgroundColor)).toBe('rgb(255, 238, 0)');
});

test('missing central credentials show an owner setup error, never a viewer key prompt', async ({ page, app }) => {
  await page.route('**/api/status', route => route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify({ ready: false, error: 'The app owner needs to finish the Jev connection.' })
  }));
  await page.goto(app.url);
  await expect(page.locator('#status')).toContainText('app owner');
  await expect(page.locator('#message')).toBeDisabled();
  await expect(page.locator('input[type="password"]')).toHaveCount(0);
  expect(app.state.requests).toHaveLength(0);
});

test('static hosting and expired sessions fail explicitly instead of accepting credentials', async ({ page, app }) => {
  await page.route('**/api/status', route => route.fulfill({ status: 404, contentType: 'text/html', body: '<h1>Not found</h1>' }));
  await page.goto(app.url);
  await expect(page.locator('#status')).toContainText('Reload to check your access');
  await expect(page.locator('#message')).toBeDisabled();
  expect(app.state.requests).toHaveLength(0);
});
