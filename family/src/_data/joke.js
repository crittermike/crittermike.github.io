/**
 * Joke-of-the-day data layer for the kitchen dashboard.
 *
 * Source: icanhazdadjoke.com (no auth, no key, guaranteed SFW dad jokes).
 * We pull a page of jokes at build time and pick one deterministically by
 * day-of-year so the joke is stable across the day's frequent rebuilds and
 * rotates once per day.
 *
 * Build-time only. If the API is down or the build is offline, returns null
 * and the tile shows a friendly empty state.
 */

const https = require('https');

const URL = 'https://icanhazdadjoke.com/search?limit=30&page=1';
const HEADERS = {
  'Accept': 'application/json',
  // icanhazdadjoke asks API users to identify themselves.
  'User-Agent': 'crittenden-family-dashboard (github.com/crittermike/crittermike.github.io)',
};

function fetchJson(url, timeoutMs = 4000) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: HEADERS }, (res) => {
      if (res.statusCode !== 200) {
        res.resume();
        return reject(new Error(`HTTP ${res.statusCode}`));
      }
      let body = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => {
        try { resolve(JSON.parse(body)); } catch (e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.setTimeout(timeoutMs, () => { req.destroy(new Error('timeout')); });
  });
}

function dayOfYear(d) {
  const start = new Date(d.getFullYear(), 0, 0);
  return Math.floor((d - start) / 86400000);
}

module.exports = async function () {
  try {
    const data = await fetchJson(URL);
    const results = (data && data.results) || [];
    if (!results.length) return null;
    const pick = results[dayOfYear(new Date()) % results.length];
    if (!pick || !pick.joke) return null;
    return { joke: pick.joke };
  } catch (e) {
    console.warn(`[joke] fetch failed: ${e.message} — tile will show empty state`);
    return null;
  }
};
