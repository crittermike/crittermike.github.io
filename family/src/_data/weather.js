/**
 * Weather data layer for kitchen dashboard.
 *
 * Source: Open-Meteo (no auth, no key). Greenville, SC.
 * Pulled at build time. Returns:
 *   {
 *     now: { temp, hi, lo, icon, code },
 *     days: [{ d: 'Mon', icon, hi, lo, code }, ... ]   // next 5 days after today
 *   }
 *
 * Build-time only. If the API is down or the build is offline, returns null and
 * the template hides the widget.
 */

const https = require('https');

const LAT = 34.8526;
const LON = -82.394;
const URL = `https://api.open-meteo.com/v1/forecast?latitude=${LAT}&longitude=${LON}` +
  `&current=temperature_2m,weather_code` +
  `&daily=temperature_2m_max,temperature_2m_min,weather_code,sunrise,sunset` +
  `&temperature_unit=fahrenheit&timezone=America%2FNew_York&forecast_days=6`;

// WMO weather code → emoji.
// https://open-meteo.com/en/docs (search "WMO Weather interpretation codes")
function codeToIcon(code) {
  if (code == null) return '·';
  if (code === 0) return '☀️';
  if (code === 1 || code === 2) return '🌤';
  if (code === 3) return '⛅';
  if (code >= 45 && code <= 48) return '🌫';
  if (code >= 51 && code <= 57) return '🌦';
  if (code >= 61 && code <= 67) return '🌧';
  if (code >= 71 && code <= 77) return '❄️';
  if (code >= 80 && code <= 82) return '🌦';
  if (code >= 85 && code <= 86) return '🌨';
  if (code >= 95) return '⛈';
  return '·';
}

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

module.exports = async function () {
  try {
    const data = await fetchJson(URL);
    const now = data.current || {};
    const daily = data.daily || {};
    const times = daily.time || [];
    const hi = daily.temperature_2m_max || [];
    const lo = daily.temperature_2m_min || [];
    const codes = daily.weather_code || [];
    const sunrises = daily.sunrise || [];
    const sunsets = daily.sunset || [];

    if (!times.length) return null;

    const dows = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

    // Today is index 0 in `daily`; we want next 5 days (1..5) for the strip.
    const days = [];
    for (let i = 1; i < times.length && days.length < 5; i++) {
      const d = new Date(times[i] + 'T12:00:00');
      days.push({
        d: dows[d.getDay()],
        icon: codeToIcon(codes[i]),
        hi: Math.round(hi[i]),
        lo: Math.round(lo[i]),
        code: codes[i],
      });
    }

    return {
      now: {
        temp: Math.round(now.temperature_2m),
        hi: Math.round(hi[0]),
        lo: Math.round(lo[0]),
        icon: codeToIcon(now.weather_code),
        code: now.weather_code,
      },
      days,
      // Local-naive ISO strings ("YYYY-MM-DDTHH:mm") in America/New_York.
      // 7-day window (today + next 5-6) so the client can pick the right day.
      sun: {
        sunrises: sunrises.slice(0, 7),
        sunsets: sunsets.slice(0, 7),
        timezone: 'America/New_York',
      },
    };
  } catch (e) {
    console.warn(`[weather] fetch failed: ${e.message} — widget will be hidden`);
    return null;
  }
};
