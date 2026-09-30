import { once } from 'node:events';
import { setTimeout as delay } from 'node:timers/promises';
import { test as base, expect } from '@playwright/test';
import { createBufoServer } from '../server.mjs';
import { answerRequest, catalog, deferred, emoji, TEST_KEY } from './fixtures.mjs';

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
        if (state.beforeResponse) await state.beforeResponse(body);
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
          if (state.score) return state.score(filename);
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
      await use({ url, state, catalog: value });
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
  await expect(page.getByRole('progressbar')).toBeHidden();
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

function addMosaic(app) {
  const tiles = [
    emoji(103, 'bufo-test-mosaic_1_1'), emoji(102, 'bufo-test-mosaic_1_0'),
    emoji(101, 'bufo-test-mosaic_0_1'), emoji(100, 'bufo-test-mosaic_0_0')
  ];
  app.catalog.emojis.push(...tiles, emoji(104, 'bufo-test-mosaic'));
  app.state.score = filename => filename.startsWith('bufo-test-mosaic_') ? 0.98 : 0.7;
  return tiles;
}

const mosaicCode = ':bufo-test-mosaic_0_0::bufo-test-mosaic_1_0:\n:bufo-test-mosaic_0_1::bufo-test-mosaic_1_1:';

test('renders a gapless mosaic as one result and copies every tile in row-major order', async ({ page, app }) => {
  addMosaic(app);
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: async code => { window.testCopiedCode = code; } } });
  });
  await open(page, app);
  await suggest(page);
  const button = page.getByRole('button', { name: 'Copy bufo-test-mosaic (2 by 2 tiles)', exact: true });
  await expect(button).toBeVisible();
  await expect(button).toBeEnabled();
  await expect(page.locator('.emoji-mosaic')).toHaveCount(1);
  await expect(button.locator('img')).toHaveCount(4);
  await expect(button.locator('.emoji-size')).toHaveText('BIG: 4 emojis');
  await expect(page.getByRole('button', { name: /^Copy :bufo-test-mosaic_\d_\d:$/ })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Copy :bufo-test-mosaic:', exact: true })).toBeVisible();
  for (const width of [1280, 375, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    const boxes = await button.locator('img').evaluateAll(images => images.map(image => {
      const { x, y, width, height } = image.getBoundingClientRect();
      return { x, y, width, height };
    }));
    expect(boxes[0].width).toBeGreaterThan(0);
    expect(boxes[1].x).toBeCloseTo(boxes[0].x + boxes[0].width, 1);
    expect(boxes[1].y).toBeCloseTo(boxes[0].y, 1);
    expect(boxes[2].x).toBeCloseTo(boxes[0].x, 1);
    expect(boxes[2].y).toBeCloseTo(boxes[0].y + boxes[0].height, 1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
  await button.focus();
  await page.keyboard.press('Enter');
  expect(await page.evaluate(() => window.testCopiedCode)).toBe(mosaicCode);
  await expect(page.locator('#copy-status')).toHaveText('Copied bufo-test-mosaic');
  expect(app.state.requests.flatMap(body => Object.keys(body.questions))).toHaveLength(app.catalog.emojis.length);
});

test('manual copying preserves the complete multiline mosaic when clipboard access fails', async ({ page, app }) => {
  addMosaic(app);
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: async () => { throw new Error('Denied'); } } });
  });
  await open(page, app);
  await suggest(page);
  await page.getByRole('button', { name: 'Copy bufo-test-mosaic (2 by 2 tiles)', exact: true }).click();
  await expect(page.locator('textarea#copy-code')).toHaveValue(mosaicCode);
  await expect(page.locator('#copy-code')).toBeFocused();
  expect(await page.locator('#copy-code').evaluate(field => field.selectionEnd - field.selectionStart)).toBe(mosaicCode.length);
});

test('a wide bigbufo uses column-first coordinates and clearly identifies the multi-emoji copy', async ({ page, app }) => {
  const tiles = Array.from({ length: 6 }, (_, index) => emoji(200 + index, `bigbufo_${index % 3}_${Math.floor(index / 3)}`));
  app.catalog.emojis.push(...tiles.toReversed());
  app.state.score = filename => filename.startsWith('bigbufo_') ? 0.99 : 0.6;
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: async text => { window.testCopiedText = text; } } });
  });
  await open(page, app);
  await suggest(page);
  const button = page.getByRole('button', { name: 'Copy bigbufo (2 by 3 tiles)', exact: true });
  await expect(button.locator('.emoji-size')).toHaveText('BIG: 6 emojis');
  await button.click();
  expect(await page.evaluate(() => window.testCopiedText)).toBe(
    ':bigbufo_0_0::bigbufo_1_0::bigbufo_2_0:\n:bigbufo_0_1::bigbufo_1_1::bigbufo_2_1:'
  );
  const ids = await button.locator('img').evaluateAll(images => images.map(image => image.src.split('/').at(-1)));
  expect(ids).toEqual(tiles.map(tile => tile.id));
  const box = await button.locator('.emoji-mosaic').boundingBox();
  expect(box.width / box.height).toBeCloseTo(3 / 2, 1);
});

test('incomplete mosaics never copy partial tile messages', async ({ page, app }) => {
  const tiles = addMosaic(app);
  app.catalog.emojis = app.catalog.emojis.filter(entry => entry.id !== tiles[0].id);
  await open(page, app);
  await suggest(page);
  const button = page.getByRole('button', { name: 'bufo-test-mosaic: incomplete tile set', exact: true });
  await expect(button).toBeDisabled();
  await expect(button).toContainText('Missing tiles');
  await expect(page.locator('#status')).toContainText('Incomplete tile sets cannot be copied');
});

test('a changed catalog must reload before grouped copy data can be used', async ({ page, app }) => {
  addMosaic(app);
  await open(page, app);
  app.catalog.syncedAt = '2026-09-30T13:00:00.000Z';
  await page.locator('#message').fill('Good day');
  await expect(page.locator('#status')).toContainText('collection changed');
  await expect(page.locator('.emoji')).toHaveCount(0);
  expect(app.state.requests).toHaveLength(0);
  await page.locator('#retry').click();
  await expect(page.locator('.emoji-mosaic')).toHaveCount(1);
});

test('the UI favors a relevant long name without displaying adjusted scores as model probabilities', async ({ page, app }) => {
  const long = emoji(100, 'bufo-that-feeling-when-everything-finally-goes-according-to-plan');
  app.catalog.emojis.push(long);
  app.state.score = filename => filename === long.filename ? 0.9 : filename === 'bufo-happy.png' ? 0.94 : 0.4;
  await open(page, app);
  await suggest(page);
  await expect(page.locator('.emoji').first()).toContainText(`:${long.name}:`);
  await expect(page.locator('.emoji').first()).not.toContainText('%');
});

test('shows real partial progress and no suggestions until all batches finish', async ({ page, app }) => {
  app.catalog.emojis.push(...Array.from({ length: 100 }, (_, index) => emoji(index + 1000)));
  const gate = deferred();
  app.state.beforeResponse = body => Object.hasOwn(body.questions, 'e0') ? Promise.resolve() : gate.promise;
  await open(page, app);
  await page.locator('#message').fill('Good day');
  const progress = page.getByRole('progressbar', { name: 'Emoji scoring progress' });
  try {
    await expect(progress).toBeVisible();
    await expect.poll(() => progress.evaluate(bar => bar.value)).toBeGreaterThan(0);
    expect(await progress.evaluate(bar => bar.value)).toBeLessThan(app.catalog.emojis.length);
    expect(await progress.evaluate(bar => bar.max)).toBe(app.catalog.emojis.length);
    await expect(page.locator('#status')).toContainText(`of ${app.catalog.emojis.length} scored`);
    await expect(page.locator('.emoji')).toHaveCount(0);
  } finally { gate.resolve(); }
  await expect(page.locator('.emoji')).toHaveCount(12);
  await expect(progress).toBeHidden();
  await expect(page.locator('#status')).toContainText(`${app.catalog.emojis.length} scored in`);
});

test('clearing input hides progress and stale batches cannot bring it back', async ({ page, app }) => {
  const gate = deferred();
  app.state.beforeResponse = () => gate.promise;
  await open(page, app);
  await page.locator('#message').fill('Good day');
  try {
    await expect(page.getByRole('progressbar')).toBeVisible();
    await page.locator('#message').fill('');
    await expect(page.getByRole('progressbar')).toBeHidden();
  } finally { gate.resolve(); }
  await expect(page.locator('.emoji')).toHaveCount(0);
  await expect(page.locator('#status')).toHaveText('');
});

test('an interrupted stream shows an error instead of stopping at partial progress', async ({ page, app }) => {
  await page.route('**/api/suggest', route => route.fulfill({
    contentType: 'application/x-ndjson',
    body: JSON.stringify({ type: 'progress', scoredCount: 5, totalCount: names.length }) + '\n'
  }));
  await open(page, app);
  await page.locator('#message').fill('Good day');
  await expect(page.locator('#status')).toContainText('ended before scoring finished');
  await expect(page.getByRole('progressbar')).toBeHidden();
  await expect(page.locator('.emoji')).toHaveCount(0);
  await expect(page.locator('#retry')).toBeVisible();
});
