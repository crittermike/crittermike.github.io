// Everything you can collect or buy: power-ups, runners, blasters, trails, and power-up upgrades.
// Names stay to one or two words because the player is just learning to read; icons carry the meaning.
// `icon` is a name from js/icons.js.

export const POWERS = {
  magnet: { icon: 'magnet', name: 'Magnet', color: '#ff4d6d', base: 8 },
  shield: { icon: 'shield', name: 'Shield', color: '#4dabff', base: 8 },
  jetpack: { icon: 'jetpack', name: 'Jetpack', color: '#ff9f1c', base: 6 },
  double: { icon: 'double', name: 'Double', color: '#ffd23f', base: 10 },
  jump: { icon: 'shoe', name: 'Super Jump', color: '#5ddc7a', base: 10 },
  hearts: { icon: 'heart-plus', name: 'Hearts', color: '#ff2d75', instant: true },
};
export const TIMED_POWERS = Object.keys(POWERS).filter(k => !POWERS[k].instant);
export const MAX_UPGRADE = 4;
export const UPGRADE_COST = [60, 150, 300, 500];
export const powerTime = (id, level = 0) => POWERS[id].base + 2 * level;

// Runners are animated models in assets/runners/<id>.glb. They all share one skeleton and the clips in
// assets/runners/anims.glb. The shop card shows a rendered portrait, so `icon` is only a placeholder.
export const RUNNERS = [
  { id: 'ranger', icon: 'run', name: 'Ranger', price: 0 },
  { id: 'ranger_girl', icon: 'run', name: 'Archer', price: 150 },
  { id: 'knight', icon: 'run', name: 'Knight', price: 300 },
  { id: 'wizard', icon: 'run', name: 'Wizard', price: 450 },
  { id: 'shadow', icon: 'run', name: 'Ninja', price: 600 },
  { id: 'prince', icon: 'run', name: 'Prince', price: 800 },
  { id: 'princess', icon: 'run', name: 'Princess', price: 1000 },
  { id: 'sorceress', icon: 'run', name: 'Sorceress', price: 1250 },
  { id: 'knight_girl', icon: 'run', name: 'Lady Knight', price: 1500 },
  { id: 'knight_gold', icon: 'run', name: 'Gold Knight', price: 2000 },
];
// Runners from the first version of the shop and what they cost. Anyone who bought one gets the coins back.
const RETIRED = { kid: 0, ninja: 150, cowboy: 300, pirate: 450, zombie: 600, viking: 1000, pug: 1500, robot: 2000 };

// Blasters fire at the chaser after every right answer. Later ones knock it farther back.
export const WEAPONS = [
  { id: 'zap', icon: 'zap', name: 'Zapper', price: 0, color: '#7ff3ff', knock: 1 },
  { id: 'splash', icon: 'splash', name: 'Splasher', price: 100, color: '#4fc3ff', knock: 1.1 },
  { id: 'fire', icon: 'fire', name: 'Fire', price: 200, color: '#ff7a1a', knock: 1.2 },
  { id: 'freeze', icon: 'freeze', name: 'Freeze', price: 350, color: '#bdf2ff', knock: 1.3 },
  { id: 'fireworks', icon: 'fireworks', name: 'Fireworks', price: 550, color: '#ff4fd8', knock: 1.45 },
  { id: 'rainbow', icon: 'rainbow', name: 'Rainbow', price: 800, color: '#ffffff', knock: 1.6 },
  { id: 'meteor', icon: 'meteor', name: 'Meteor', price: 1200, color: '#ff5a1f', knock: 1.8 },
];

// Trails sparkle behind the runner.
export const TRAILS = [
  { id: 'none', icon: 'none', name: 'None', price: 0, colors: [] },
  { id: 'sparkle', icon: 'sparkles', name: 'Sparkle', price: 80, colors: ['#fff3a0', '#ffd23f', '#ffffff'] },
  { id: 'fire', icon: 'fire', name: 'Fire', price: 150, colors: ['#ff3b1a', '#ff8c1a', '#ffd23f'] },
  { id: 'ice', icon: 'ice', name: 'Ice', price: 150, colors: ['#bdf2ff', '#7fd8ff', '#ffffff'] },
  { id: 'hearts', icon: 'love', name: 'Love', price: 250, colors: ['#ff2d75', '#ff8fb8', '#ffffff'] },
  { id: 'rainbow', icon: 'rainbow', name: 'Rainbow', price: 400, colors: ['#ff3b5c', '#ff8c1a', '#ffd23f', '#3cb44b', '#2f7fe0', '#b06cff'] },
  { id: 'stars', icon: 'stars', name: 'Stars', price: 500, colors: ['#ffe066', '#ffffff', '#7ff3ff'] },
];

export const SHOP_TABS = [
  { id: 'runners', icon: 'run', items: RUNNERS },
  { id: 'weapons', icon: 'blaster', items: WEAPONS },
  { id: 'powers', icon: 'bolt', items: null },
  { id: 'trails', icon: 'sparkles', items: TRAILS },
];

export const byId = (list, id) => list.find(x => x.id === id) || list[0];

// Fills in shop fields on an old save so existing coins carry over.
export function initShopSave(S) {
  S.owned = { runners: [RUNNERS[0].id], weapons: ['zap'], trails: ['none'], ...(S.owned || {}) };
  if (Array.isArray(S.owned.runners)) {
    for (const id of S.owned.runners) if (id in RETIRED) S.coins = (S.coins || 0) + RETIRED[id];
    S.owned.runners = S.owned.runners.filter(id => RUNNERS.some(r => r.id === id));
  }
  if (S.equip && !RUNNERS.some(r => r.id === S.equip.runners)) S.equip.runners = RUNNERS[0].id;
  for (const [tab, list] of [['runners', RUNNERS], ['weapons', WEAPONS], ['trails', TRAILS]]) {
    if (!Array.isArray(S.owned[tab])) S.owned[tab] = [];
    if (!S.owned[tab].includes(list[0].id)) S.owned[tab].unshift(list[0].id);
  }
  S.equip = { runners: RUNNERS[0].id, weapons: 'zap', trails: 'none', ...(S.equip || {}) };
  S.upgrades = { ...Object.fromEntries(TIMED_POWERS.map(k => [k, 0])), ...(S.upgrades || {}) };
  return S;
}
