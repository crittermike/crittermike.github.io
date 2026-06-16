/**
 * Bible verse-of-the-day data layer for the kitchen dashboard.
 *
 * Primary source: New American Bible, Revised Edition (NABRE). Verse text is
 * pulled at build time from the open `nirmalben/bible-nabre-json-dataset`
 * (pinned to a commit SHA). We keep only a curated list of verse *references*
 * in this repo — no bulk scripture text — and emit a single verse per day in
 * the built HTML, chosen deterministically from the Eastern-time calendar date.
 *
 * Fallback chain (only if every NABRE fetch fails): OurManna VOTD, then
 * labs.bible.org. If all sources fail, returns null and the tile shows a
 * friendly empty state. Build-time only.
 */

const https = require('https');

const NABRE_SHA = '768abdb913345b56bfc2e1a963634c9723d06719';
const NABRE_CDNS = [
  (book) => `https://cdn.jsdelivr.net/gh/nirmalben/bible-nabre-json-dataset@${NABRE_SHA}/generated_data/books/${book}.json`,
  (book) => `https://raw.githubusercontent.com/nirmalben/bible-nabre-json-dataset/${NABRE_SHA}/generated_data/books/${book}.json`,
];

const PRIMARY = 'https://beta.ourmanna.com/api/v1/get/?format=json';
const FALLBACK = 'https://labs.bible.org/api/?passage=votd&type=json';

// Curated, family-appropriate verses. `book` is the dataset's file name (no
// spaces); `ref` is the human label. Verified to render cleanly after cleanup.
const VERSES = [
  { book: 'John', c: 3, v: 16, ref: 'John 3:16' },
  { book: 'Philippians', c: 4, v: 13, ref: 'Philippians 4:13' },
  { book: 'Philippians', c: 4, v: 6, ref: 'Philippians 4:6' },
  { book: 'Philippians', c: 4, v: 7, ref: 'Philippians 4:7' },
  { book: 'Jeremiah', c: 29, v: 11, ref: 'Jeremiah 29:11' },
  { book: 'Proverbs', c: 3, v: 5, ref: 'Proverbs 3:5' },
  { book: 'Proverbs', c: 3, v: 6, ref: 'Proverbs 3:6' },
  { book: 'Proverbs', c: 17, v: 17, ref: 'Proverbs 17:17' },
  { book: 'Proverbs', c: 16, v: 3, ref: 'Proverbs 16:3' },
  { book: 'Psalms', c: 118, v: 24, ref: 'Psalm 118:24' },
  { book: 'Psalms', c: 121, v: 2, ref: 'Psalm 121:2' },
  { book: 'Isaiah', c: 40, v: 31, ref: 'Isaiah 40:31' },
  { book: 'Isaiah', c: 41, v: 10, ref: 'Isaiah 41:10' },
  { book: 'Joshua', c: 1, v: 9, ref: 'Joshua 1:9' },
  { book: 'Romans', c: 8, v: 28, ref: 'Romans 8:28' },
  { book: 'Romans', c: 12, v: 12, ref: 'Romans 12:12' },
  { book: '1Corinthians', c: 13, v: 13, ref: '1 Corinthians 13:13' },
  { book: '2Corinthians', c: 5, v: 7, ref: '2 Corinthians 5:7' },
  { book: 'Galatians', c: 5, v: 22, ref: 'Galatians 5:22' },
  { book: 'Ephesians', c: 4, v: 32, ref: 'Ephesians 4:32' },
  { book: 'Colossians', c: 3, v: 23, ref: 'Colossians 3:23' },
  { book: 'Colossians', c: 3, v: 12, ref: 'Colossians 3:12' },
  { book: 'Matthew', c: 5, v: 9, ref: 'Matthew 5:9' },
  { book: 'Matthew', c: 6, v: 34, ref: 'Matthew 6:34' },
  { book: 'Matthew', c: 11, v: 28, ref: 'Matthew 11:28' },
  { book: 'Matthew', c: 19, v: 26, ref: 'Matthew 19:26' },
  { book: 'Micah', c: 6, v: 8, ref: 'Micah 6:8' },
  { book: 'Hebrews', c: 11, v: 1, ref: 'Hebrews 11:1' },
  { book: 'James', c: 1, v: 5, ref: 'James 1:5' },
  { book: '1John', c: 4, v: 19, ref: '1 John 4:19' },
  { book: 'Deuteronomy', c: 31, v: 6, ref: 'Deuteronomy 31:6' },
  { book: 'Nehemiah', c: 8, v: 10, ref: 'Nehemiah 8:10' },
  { book: 'Zephaniah', c: 3, v: 17, ref: 'Zephaniah 3:17' },
  { book: '1Peter', c: 5, v: 7, ref: '1 Peter 5:7' },
];

function fetchJson(url, timeoutMs = 5000, redirects = 3) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location && redirects > 0) {
        res.resume();
        const next = new URL(res.headers.location, url).toString();
        return resolve(fetchJson(next, timeoutMs, redirects - 1));
      }
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

// Strip the section headings the dataset prepends to some verses, plus the
// bracketed text-critical markers NABRE uses, without harming clean verses.
function cleanVerse(t) {
  if (!t) return t;
  let s = String(t).replace(/\s+/g, ' ').trim();
  s = s.replace(/^[IVXLCDM]+\.\s.*?Chapter\s+\d+\s*-\s*[^.]*\.\s+/, '');
  s = s.replace(/^Chapter\s+\d+\s*-\s*[^.]*\.\s+/, '');
  s = s.replace(/^([A-Z][\w’']*(?:\s+[\w’'(),]+){0,6}?)\.\s+(?=[“"A-Z])/, '');
  s = s.replace(/[\[\]]/g, '');
  s = s.replace(/^[“"']\s*/, '');
  return s.trim();
}

// Deterministic pick: Eastern-time calendar date → stable index.
function pickVerse() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date());
  const ymd = Number(parts.filter((p) => /\d/.test(p.value)).map((p) => p.value).join(''));
  const idx = (Number.isFinite(ymd) ? ymd : 0) % VERSES.length;
  return VERSES[idx];
}

async function fromNabre() {
  const pick = pickVerse();
  let book = null;
  let lastErr = null;
  for (const cdn of NABRE_CDNS) {
    try { book = await fetchJson(cdn(pick.book)); break; } catch (e) { lastErr = e; }
  }
  if (!book) throw lastErr || new Error('no NABRE source');
  const chapter = (book.chapters || []).find((x) => x.chapter === pick.c);
  const verse = chapter && (chapter.verses || []).find((x) => x.verse === pick.v);
  const text = verse && cleanVerse(verse.text);
  if (!text) throw new Error(`verse not found: ${pick.ref}`);
  return { text, reference: pick.ref, version: 'NABRE' };
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
    return await fromNabre();
  } catch (e0) {
    console.warn(`[bible] NABRE failed: ${e0.message} — trying OurManna`);
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
  }
};
