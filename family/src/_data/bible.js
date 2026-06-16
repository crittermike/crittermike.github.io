/**
 * Bible verse-of-the-day data layer for the kitchen dashboard.
 *
 * Primary source: OurManna VOTD (no auth, no key) — returns a genuine daily
 * "Verse of the Day". Fallback: labs.bible.org votd. Both are SFW by nature.
 *
 * Build-time only. If both sources fail, returns null and the tile shows a
 * friendly empty state.
 */

const https = require('https');

const PRIMARY = 'https://beta.ourmanna.com/api/v1/get/?format=json';
const FALLBACK = 'https://labs.bible.org/api/?passage=votd&type=json';

function fetchJson(url, timeoutMs = 4000) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, (res) => {
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

async function fromPrimary() {
  const data = await fetchJson(PRIMARY);
  const d = data && data.verse && data.verse.details;
  if (!d || !d.text) return null;
  return {
    text: String(d.text).trim(),
    reference: d.reference || '',
    version: d.version || '',
  };
}

async function fromFallback() {
  const data = await fetchJson(FALLBACK);
  const v = Array.isArray(data) && data[0];
  if (!v || !v.text) return null;
  const ref = [v.bookname, [v.chapter, v.verse].filter(Boolean).join(':')]
    .filter(Boolean).join(' ');
  return { text: String(v.text).trim(), reference: ref, version: 'NET' };
}

module.exports = async function () {
  try {
    return await fromPrimary();
  } catch (e1) {
    console.warn(`[bible] primary failed: ${e1.message} — trying fallback`);
    try {
      return await fromFallback();
    } catch (e2) {
      console.warn(`[bible] fallback failed: ${e2.message} — tile will show empty state`);
      return null;
    }
  }
};
