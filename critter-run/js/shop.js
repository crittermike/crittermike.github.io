// The coin shop: runners, blasters, power-up upgrades and trails. Tapping a card previews it on the 3D runner;
// the big button underneath buys, equips or upgrades. Runners and blasters show pictures of their real models.
import { SHOP_TABS, POWERS, TIMED_POWERS, MAX_UPGRADE, UPGRADE_COST, powerTime } from './items.js';
import { icon } from './ui.js';
import { thumb, makeThumbs } from './thumbs.js';

const $ = s => document.querySelector(s);
const el = (tag, cls, ...kids) => { const e = document.createElement(tag); if (cls) e.className = cls; e.append(...kids); return e; };
const again = (e, cls) => { e.classList.remove(cls); void e.offsetWidth; e.classList.add(cls); };
const price = (n, poor) => el('span', 'price' + (poor ? ' poor' : ''), icon('coin'), String(n));

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
      const b = el('button', 'btn white sh-tab', icon(t.icon));
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
    makeThumbs((tab, id) => {
      if (tab !== this.tab) return;
      const t = this.grid.querySelector(`[data-id="${id}"] .thumb`);
      if (t) t.replaceChildren(Object.assign(document.createElement('img'), { src: thumb(tab, id), alt: '' }));
    });
  }

  items(tab = this.tab) {
    if (tab === 'powers') return TIMED_POWERS.map(id => ({ id, ...POWERS[id] }));
    return SHOP_TABS.find(t => t.id === tab).items;
  }

  showTab(tab) {
    this.tab = tab;
    for (const b of this.tabs.children) {
      b.classList.toggle('on', b.dataset.tab === tab);
      b.classList.toggle('white', b.dataset.tab !== tab);
    }
    this.render();
    this.grid.scrollTop = 0;
    this.select(this.sel[tab] || this.items()[0].id, true);
  }

  owned(tab, id) { return tab === 'powers' || this.S.owned[tab].includes(id); }

  render() {
    const { S, tab } = this;
    $('#sh-coins').textContent = S.coins;
    this.grid.replaceChildren();
    for (const it of this.items()) {
      const pic = thumb(tab, it.id);
      const t = el('span', 'thumb', pic ? Object.assign(document.createElement('img'), { src: pic, alt: '' }) : icon(it.icon));
      const b = el('button', 'sh-card', t, el('span', 'n', it.name));
      b.dataset.id = it.id;
      b.style.setProperty('--ic', it.color || (tab === 'runners' ? '#7fb8ff' : '#ffd23f'));
      if (tab === 'powers') {
        const lv = S.upgrades[it.id] || 0;
        const pips = el('span', 'pips');
        for (let k = 0; k < MAX_UPGRADE; k++) pips.append(el('i', k < lv ? 'on' : ''));
        b.append(pips, el('span', 'tm', icon('timer'), `${powerTime(it.id, lv)}`));
      } else if (!this.owned(tab, it.id)) {
        b.append(price(it.price, S.coins < it.price));
        b.classList.add('locked');
      }
      if (tab !== 'powers' && S.equip[tab] === it.id) b.append(el('span', 'eq', icon('check')));
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
    act.className = 'btn sh-act';
    this.info.textContent = it.name;
    if (tab === 'powers') {
      const lv = S.upgrades[id] || 0;
      if (lv >= MAX_UPGRADE) { act.replaceChildren(icon('star'), 'MAX'); act.classList.add('done'); return; }
      act.replaceChildren(icon('up'), icon('coin'), String(UPGRADE_COST[lv]));
      act.classList.add(S.coins < UPGRADE_COST[lv] ? 'poor' : 'go');
      return;
    }
    if (!this.owned(tab, id)) {
      act.replaceChildren(icon('coin'), String(it.price));
      act.classList.add(S.coins < it.price ? 'poor' : 'go');
    } else if (S.equip[tab] !== id) {
      act.replaceChildren(icon('check'), 'USE');
      act.classList.add('use');
    } else {
      act.replaceChildren(icon('check'));
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

  pay(cost) {
    if (this.S.coins < cost) {
      this.sound.sfx('nope');
      again(this.act, 'nope');
      again($('#sh-coins').parentElement, 'nope');
      return false;
    }
    this.S.coins -= cost;
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
