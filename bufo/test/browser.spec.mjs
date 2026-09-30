import { once } from 'node:events';
import { setTimeout as delay } from 'node:timers/promises';
import { test as base, expect } from '@playwright/test';
import { createBufoServer } from '../server.mjs';
import { answerRequest, catalog, emoji, TEST_KEY } from './fixtures.mjs';

const names = ['happy', 'coffee', 'thinking', 'party', 'sleep', 'love', 'coding', 'cry', 'dance', 'cool', 'popcorn', 'wave', 'relieved', 'thankful', 'facepalm', 'panic', 'embarrassed'];
const test = base.extend({
  app: async ({}, use) => {
    const state = { requests: [], failStatus: 0, delayMs: 0, aborted: 0 };
    const value = { ...catalog(), emojis: names.map((name, index) => emoji(index, `bufo-${name}`)) };
    const server = await createBufoServer({
      env: {},
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
  await expect(page.locator('.emoji-card')).toHaveCount(12);
}

async function connect(page) {
  await page.getByRole('button', { name: 'Connect Jev', exact: true }).click();
  await page.getByLabel('API key', { exact: true }).fill(TEST_KEY);
  await page.locator('#provider-consent').check();
  await page.locator('#connect-submit').click();
  await expect(page.locator('#connection-dialog')).not.toBeVisible();
  await expect(page.locator('#ai-enabled')).toBeChecked();
  await expect(page.locator('#api-key')).toHaveValue('');
}

async function pauseClock(page) {
  await page.clock.install({ time: new Date('2026-09-30T12:00:00Z') });
  await page.clock.pauseAt(new Date('2026-09-30T12:01:00Z'));
}

test('disconnected state never pretends keyword matches are AI suggestions', async ({ page, app }) => {
  await open(page, app);
  await expect(page.locator('#catalog-count')).toHaveText(`${names.length} bufos`);
  await expect(page.locator('#connection-notice')).toBeVisible();
  await expect(page.locator('#ai-enabled')).not.toBeChecked();
  await pauseClock(page);
  await page.locator('#message').fill('coffee');
  await page.clock.runFor(1000);
  await expect(page.locator('#mode-label')).toHaveText('Not connected');
  await expect(page.locator('#empty-description')).toContainText('has not been analyzed');
  await expect(page.locator('.emoji-card')).toHaveCount(0);
  expect(app.state.requests).toHaveLength(0);
  expect(await page.evaluate(() => localStorage.length)).toBe(0);
});

test('debounces, ranks filenames, displays scores, caches repeats, and clears stale results', async ({ page, app }) => {
  await open(page, app);
  await connect(page);
  expect(app.state.requests).toHaveLength(1);
  await pauseClock(page);
  await page.locator('#message').fill('Good');
  await page.clock.runFor(400);
  await page.locator('#message').fill('Good day');
  await page.clock.runFor(699);
  expect(app.state.requests).toHaveLength(1);
  await page.clock.runFor(1);
  await expect(page.locator('#mode-label')).toHaveText('Ranked by Jev');
  await expect(page.locator('.emoji-card').first()).toContainText(':bufo-happy:');
  await expect(page.locator('.emoji-card').first()).toContainText('94% filename fit');
  const count = app.state.requests.length;
  const scoring = app.state.requests.filter(body => body.state.message === 'Good day');
  const scoredNames = scoring.flatMap(body => Object.values(body.questions).map(question => question.instructions.filename));
  expect(scoredNames).toHaveLength(names.length);
  expect(scoredNames).toContain('bufo-sleep.png');
  await expect(page.locator('#ranking-note')).toContainText(`All ${names.length} filenames scored independently`);
  await expect(page.locator('#connection-notice')).not.toBeVisible();
  await page.locator('#clear-message').click();
  await expect(page.locator('#mode-label')).toHaveText('Your frog collection');
  await page.locator('#message').fill('Good day');
  await page.clock.runFor(700);
  await expect(page.locator('#status-text')).toContainText('from this session');
  expect(app.state.requests).toHaveLength(count);
});

test('input composition is not sent until the user finishes', async ({ page, app }) => {
  await open(page, app);
  await connect(page);
  await pauseClock(page);
  await page.locator('#message').dispatchEvent('compositionstart');
  await page.locator('#message').fill('Still composing');
  await page.clock.runFor(1500);
  expect(app.state.requests).toHaveLength(1);
  await page.locator('#message').dispatchEvent('compositionend');
  await page.clock.runFor(700);
  await expect(page.locator('#mode-label')).toHaveText('Ranked by Jev');
});

test('cancels an obsolete request and renders only the newest message', async ({ page, app }) => {
  await open(page, app);
  await connect(page);
  app.state.delayMs = 150;
  await pauseClock(page);
  await page.locator('#message').fill('Good day');
  await page.clock.runFor(700);
  await expect.poll(() => app.state.requests.length).toBeGreaterThan(1);
  await page.locator('#message').fill('I need sleep');
  await expect.poll(() => app.state.aborted).toBeGreaterThan(0);
  await page.clock.runFor(700);
  await expect(page.locator('#mode-label')).toHaveText('Ranked by Jev');
  await expect(page.locator('.emoji-card').first()).toContainText(':bufo-sleep:');
  await expect(page.locator('#request-error')).not.toBeVisible();
});

for (const [text, expected] of [['oops', 'bufo-facepalm'], ['payments are broken', 'bufo-panic']]) {
  test(`"${text}" is sent verbatim and can rank filenames with no shared words`, async ({ page, app }) => {
    await open(page, app);
    await connect(page);
    await pauseClock(page);
    await page.locator('#message').fill(text);
    await page.clock.runFor(700);
    await expect(page.locator('.emoji-card').first()).toContainText(`:${expected}:`);
    const requests = app.state.requests.filter(body => body.state.message === text);
    const questions = requests.flatMap(body => Object.values(body.questions));
    expect(questions).toHaveLength(names.length);
    expect(questions.every(question => question.type === 'noul')).toBe(true);
  });
}

test('billing failure shows no made-up fallback results and never silently retries', async ({ page, app }) => {
  await open(page, app);
  await connect(page);
  app.state.failStatus = 402;
  await pauseClock(page);
  await page.locator('#message').fill('coffee');
  await page.clock.runFor(700);
  await expect(page.locator('#request-error')).toContainText('needs credits or billing');
  await expect(page.locator('#mode-label')).toHaveText('Jev unavailable');
  await expect(page.locator('.emoji-card')).toHaveCount(0);
  await expect(page.locator('#empty-description')).toContainText('no local keyword-matching fallback');
  await expect(page.locator('#ai-enabled')).not.toBeChecked();
  const count = app.state.requests.length;
  await page.clock.runFor(60_000);
  expect(app.state.requests).toHaveLength(count);
});

test('copies the exact Slack shortcode without touching the host clipboard', async ({ page, app }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: async code => { window.testCopiedCode = code; } }
    });
  });
  await open(page, app);
  await page.getByRole('button', { name: 'Copy :bufo-coffee:', exact: true }).click();
  expect(await page.evaluate(() => window.testCopiedCode)).toBe(':bufo-coffee:');
  await expect(page.locator('#copy-status')).toHaveText('Copied :bufo-coffee:');
});

test('clipboard and image failures are visible, with a usable manual copy fallback', async ({ page, app }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: async () => { throw new Error('Denied'); } }
    });
  });
  await page.route('**/api/emoji/*', route => route.fulfill({ status: 503, body: 'unavailable' }));
  await open(page, app);
  await expect(page.locator('#image-notice')).toBeVisible();
  await page.getByRole('button', { name: 'Copy :bufo-coffee:', exact: true }).click();
  await expect(page.locator('#manual-copy')).toBeVisible();
  await expect(page.locator('#copy-code')).toHaveValue(':bufo-coffee:');
  await expect(page.locator('#copy-code')).toBeFocused();
});

test('disconnect turns off AI and forgets the local server key', async ({ page, app }) => {
  await open(page, app);
  await connect(page);
  await page.getByRole('button', { name: 'Jev settings' }).click();
  await page.getByRole('button', { name: 'Disconnect', exact: true }).click();
  await expect(page.locator('#connection-dialog')).not.toBeVisible();
  await expect(page.locator('#ai-enabled')).toBeDisabled();
  const status = await page.request.get(`${app.url}/api/status`);
  expect((await status.json()).connected).toBe(false);
});

test('mobile layout has no horizontal overflow and follows light/dark preferences', async ({ page, app }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' });
  await open(page, app);
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.goto(`${app.url}/?clawpilotTheme=light`);
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await page.getByRole('button', { name: 'Connect Jev', exact: true }).click();
  await expect(page.locator('#connection-dialog')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('static hosting shows local setup instructions and cannot accept an API key', async ({ page, app }) => {
  await page.route('**/api/status', route => route.fulfill({ status: 404, contentType: 'text/html', body: '<h1>Not found</h1>' }));
  await page.goto(app.url);
  await expect(page.locator('#setup')).toBeVisible();
  await expect(page.locator('#setup-message')).toContainText('local Node server');
  await expect(page.locator('#open-settings')).toBeDisabled();
  await expect(page.locator('#message')).toBeDisabled();
  expect(app.state.requests).toHaveLength(0);
});
