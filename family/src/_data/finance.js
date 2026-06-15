/**
 * Finance data for the family dashboard. Pulled live from YNAB at build time.
 *
 * Reads /root/.hermes/secrets/ynab.env for YNAB_PAT + YNAB_BUDGET_ID.
 * NEVER falls back to mock data — returns null if YNAB is unreachable so the
 * dashboard tile can render a "no data" state instead of lying.
 *
 * Shape:
 *   {
 *     month: "June 2026",
 *     dayPct: 50.0,                 // fraction of month elapsed
 *     totalSpend, totalBudget,
 *     categories: [{name, group, budgeted, spent, balance, pct}, ...]  // sorted by spend desc
 *     liquidCash, creditDebt, netLiquid,
 *     updatedAt: ISO string
 *   }
 */

const fs = require('fs');
const https = require('https');

const ENV_PATH = '/root/.hermes/secrets/ynab.env';
const API_BASE = 'https://api.ynab.com/v1';
const SKIP_GROUPS = new Set(['Internal Master Category', 'Hidden Categories', 'Credit Card Payments']);

function loadEnv() {
  try {
    const out = {};
    const txt = fs.readFileSync(ENV_PATH, 'utf8');
    for (const line of txt.split('\n')) {
      const t = line.trim();
      if (!t || t.startsWith('#')) continue;
      const i = t.indexOf('=');
      if (i < 0) continue;
      let v = t.slice(i + 1).trim();
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
        v = v.slice(1, -1);
      }
      out[t.slice(0, i).trim()] = v;
    }
    return out;
  } catch (e) {
    return null;
  }
}

function ynabGet(path, token) {
  return new Promise((resolve, reject) => {
    const req = https.request(`${API_BASE}${path}`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` },
      timeout: 15000,
    }, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        try {
          if (res.statusCode >= 400) return reject(new Error(`YNAB ${path} ${res.statusCode}`));
          resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')).data);
        } catch (e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(new Error('YNAB timeout')); });
    req.end();
  });
}

const milli = (n) => Math.round((n || 0) / 10) / 100;

module.exports = async function () {
  const env = loadEnv();
  if (!env || !env.YNAB_PAT || !env.YNAB_BUDGET_ID) {
    console.warn('[finance] no YNAB env — returning null');
    return null;
  }

  try {
    const [cats, accts] = await Promise.all([
      ynabGet(`/budgets/${env.YNAB_BUDGET_ID}/categories`, env.YNAB_PAT),
      ynabGet(`/budgets/${env.YNAB_BUDGET_ID}/accounts`, env.YNAB_PAT),
    ]);

    const rows = [];
    for (const grp of cats.category_groups || []) {
      if (grp.deleted || grp.hidden) continue;
      if (SKIP_GROUPS.has(grp.name)) continue;
      if (grp.name === 'Savings') continue;
      for (const c of grp.categories || []) {
        if (c.deleted || c.hidden) continue;
        const budgeted = milli(c.budgeted);
        const spent = -milli(c.activity); // YNAB activity is negative for outflow
        if (budgeted === 0 && spent === 0) continue;
        const balance = milli(c.balance);
        rows.push({
          name: c.name,
          group: grp.name,
          budgeted,
          spent,
          balance,
          pct: budgeted > 0 ? Math.round((spent / budgeted) * 1000) / 10 : 0,
        });
      }
    }
    rows.sort((a, b) => b.spent - a.spent);

    let liquidCash = 0, creditDebt = 0;
    for (const a of accts.accounts || []) {
      if (a.deleted || a.closed) continue;
      const bal = milli(a.balance);
      if (a.type === 'checking' || a.type === 'savings' || a.type === 'cash') liquidCash += bal;
      if (a.type === 'creditCard') creditDebt += bal;
    }

    const now = new Date();
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const dayPct = Math.round((now.getDate() / daysInMonth) * 1000) / 10;

    const totalSpend = rows.reduce((s, r) => s + (r.spent > 0 ? r.spent : 0), 0);
    const totalBudget = rows.reduce((s, r) => s + r.budgeted, 0);

    return {
      month: now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
      dayPct,
      totalSpend: Math.round(totalSpend * 100) / 100,
      totalBudget: Math.round(totalBudget * 100) / 100,
      categories: rows,
      liquidCash: Math.round(liquidCash * 100) / 100,
      creditDebt: Math.round(creditDebt * 100) / 100,
      netLiquid: Math.round((liquidCash + creditDebt) * 100) / 100,
      source: 'ynab',
      updatedAt: now.toISOString(),
    };
  } catch (e) {
    console.warn(`[finance] YNAB fetch failed: ${e.message}`);
    return null;
  }
};
