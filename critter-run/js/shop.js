// The coin shop: runners, blasters, power-up upgrades and trails. Tapping a card previews it on the 3D runner;
// the big button underneath buys, equips or upgrades. Words are kept to one per button.
import { SHOP_TABS, POWERS, TIMED_POWERS, MAX_UPGRADE, UPGRADE_COST, powerTime } from './items.js';

const $ = s => document.querySelector(s);
const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
const again = (e, cls) => { e.classList.remove(cls); void e.offsetWidth; e.classList.add(cls); };

export class Shop {
  // preview(tab, id, how) shows the item on the 3D runner. how is 'look', 'buy' or 'use'.
  constructor({ S, save, sound, preview }) {
    Object.assign(this, { S, save, sound, preview });
    this.tab = 'runners';
    this.sel = {};
    this.tabs = $('#sh-tabs');
    this.grid = $('#sh-grid');
    this.act = $('#b-sh-act');
    this.info = $('#sh-info');
    for (const t of SHOP_TABS) {
      const b = el('button', 'sh-tab', t.icon);
      b.dataset.tab = t.id;
      b.setAttribute('aria-label', t.id);
      b.addEventListener('click', () => { if (this.tab !== t.id) { sound.sfx('click'); this.showTab(t.id); } });
      this.tabs.append(b);
    }
    this.act.addEventListener('click', () => this.action());
  }

  open() {
    this.sel = { ...this.S.equip, powers: this.sel.powers || TIMED_POWERS[0] };
    this.showTab(this.tab);
  }

  items(tab = this.tab) {
    if (tab === 'powers') return TIMED_POWERS.map(id => ({ id, ...POWERS[id] }));
    return SHOP_TABS.find(t => t.id === tab).items;
  }

  showTab(tab) {
    this.tab = tab;
    for (const b of this.tabs.children) b.classList.toggle('on', b.dataset.tab === tab);
    this.render();
    this.grid.scrollTop = 0;
    this.select(this.sel[tab] || this.items()[0].id, true);
  }

  owned(tab, id) { return tab === 'powers' || this.S.owned[tab].includes(id); }

  render() {
    const { S, tab } = this;
    $('#sh-coins').textContent = S.coins;
    this.grid.innerHTML = '';
    this.grid.classList.toggle('powers', tab === 'powers');
    for (const it of this.items()) {
      const b = el('button', 'sh-card');
      b.dataset.id = it.id;
      b.style.setProperty('--ic', it.color || '#ffd23f');
      b.append(el('span', 'i', it.icon), el('span', 'n', it.name));
      if (tab === 'powers') {
        const lv = S.upgrades[it.id] || 0;
        const pips = el('span', 'pips');
        for (let k = 0; k < MAX_UPGRADE; k++) pips.append(el('i', k < lv ? 'on' : ''));
        b.append(pips, el('span', 'tm', '⏱️ ' + powerTime(it.id, lv)));
      } else if (!this.owned(tab, it.id)) {
        b.append(el('span', 'p' + (S.coins < it.price ? ' poor' : ''), '🪙 ' + it.price));
        b.classList.add('locked');
      }
      if (tab !== 'powers' && S.equip[tab] === it.id) b.classList.add('eq');
      b.addEventListener('click', () => this.select(it.id));
      this.grid.append(b);
    }
  }

  select(id, quiet) {
    const { tab } = this;
    const changed = this.sel[tab] !== id;
    this.sel[tab] = id;
    for (const c of this.grid.children) c.classList.toggle('sel', c.dataset.id === id);
    this.updateAction();
    if (!quiet || changed || tab !== 'runners') {
      if (!quiet) this.sound.sfx('click');
      this.preview(tab, id, 'look');
    }
  }

  updateAction() {
    const { S, tab, act } = this, id = this.sel[tab];
    const it = this.items().find(x => x.id === id);
    act.className = 'sh-act';
    this.info.textContent = it.name;
    if (tab === 'powers') {
      const lv = S.upgrades[id] || 0;
      if (lv >= MAX_UPGRADE) { act.textContent = '⭐'; act.classList.add('done'); return; }
      act.textContent = '⬆️ 🪙 ' + UPGRADE_COST[lv];
      if (S.coins < UPGRADE_COST[lv]) act.classList.add('poor');
      return;
    }
    if (!this.owned(tab, id)) {
      act.textContent = '🪙 ' + it.price;
      if (S.coins < it.price) act.classList.add('poor');
    } else if (S.equip[tab] !== id) {
      act.textContent = '👍';
      act.classList.add('use');
    } else {
      act.textContent = '✅';
      act.classList.add('done');
    }
  }

  action() {
    const { S, tab, sound } = this, id = this.sel[tab];
    const it = this.items().find(x => x.id === id);
    if (tab === 'powers') {
      const lv = S.upgrades[id] || 0;
      if (lv >= MAX_UPGRADE) return;
      if (!this.pay(UPGRADE_COST[lv])) return;
      S.upgrades[id] = lv + 1;
      this.done('buy');
      return;
    }
    if (!this.owned(tab, id)) {
      if (!this.pay(it.price)) return;
      S.owned[tab].push(id);
      S.equip[tab] = id;
      this.done('buy');
    } else if (S.equip[tab] !== id) {
      S.equip[tab] = id;
      sound.sfx('equip');
      this.done('use');
    }
  }

  pay(price) {
    if (this.S.coins < price) {
      this.sound.sfx('nope');
      again(this.act, 'nope');
      again($('#sh-coins').parentElement, 'nope');
      return false;
    }
    this.S.coins -= price;
    this.sound.sfx('buy');
    return true;
  }

  done(how) {
    this.save();
    this.render();
    for (const c of this.grid.children) c.classList.toggle('sel', c.dataset.id === this.sel[this.tab]);
    const card = [...this.grid.children].find(c => c.dataset.id === this.sel[this.tab]);
    if (card) again(card, 'got');
    again($('#sh-coins').parentElement, 'bump');
    this.updateAction();
    this.preview(this.tab, this.sel[this.tab], how);
  }
}
