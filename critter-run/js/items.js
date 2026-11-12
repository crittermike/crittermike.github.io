// Everything you can collect or buy: power-ups, runners, blasters, trails, and power-up upgrades.
// Names stay to one or two words because the player is just learning to read; icons (names from icons.js)
// and 3D previews carry the meaning.

export const POWERS = {
  magnet: { icon: 'magnet', name: 'Magnet', color: '#ff4d6d', base: 8 },
  shield: { icon: 'shield', name: 'Shield', color: '#4dabff', base: 8 },
  jetpack: { icon: 'jetpack', name: 'Jetpack', color: '#ff9f1c', base: 6 },
  double: { icon: 'double', name: 'Double', color: '#ffd23f', base: 10 },
  jump: { icon: 'jump', name: 'Super Jump', color: '#5ddc7a', base: 10 },
  hearts: { icon: 'hearts', name: 'Hearts', color: '#ff2d75', instant: true },
};
export const TIMED_POWERS = Object.keys(POWERS).filter(k => !POWERS[k].instant);
export const MAX_UPGRADE = 4;
export const UPGRADE_COST = [60, 150, 300, 500];
export const powerTime = (id, level = 0) => POWERS[id].base + 2 * level;

// Runners are animated models in assets/runners/<id>.glb. tint recolors materials by name (the source files have
// near-black skin). rig 'robot' uses its own clips; every other runner borrows the kid's clips.
const SKIN = { Skin: '#f2c29b', Face: '#1b1b1b' };
export const RUNNERS = [
  { id: 'kid', icon: 'runner', name: 'Runner', price: 0, tint: { ...SKIN, Shirt: '#ff5a36', Pants: '#2f5fd0', Belt: '#3a2a1e', Hair: '#6b3e1f' } },
  { id: 'ninja', icon: 'runner', name: 'Ninja', price: 150, tint: { ...SKIN, Main: '#262636', Details: '#e53935', Grey: '#5a5a66' } },
  { id: 'cowboy', icon: 'runner', name: 'Cowboy', price: 300, tint: { ...SKIN, Scarf: '#e53935' } },
  { id: 'pirate', icon: 'runner', name: 'Pirate', price: 450, tint: { ...SKIN, Red: '#d63a2a', Gold: '#e8b23a', Clothes: '#24315e' } },
  { id: 'zombie', icon: 'runner', name: 'Zombie', price: 600, tint: { Clothes: '#6b55b0' } },
  { id: 'knight', icon: 'runner', name: 'Knight', price: 800, tint: { Skin: SKIN.Skin, Armor: '#e8b83a', Detail: '#8a2333', Red: '#c0392b' } },
  { id: 'viking', icon: 'runner', name: 'Viking', price: 1000, tint: { ...SKIN } },
  { id: 'wizard', icon: 'runner', name: 'Wizard', price: 1250, tint: { ...SKIN, Clothes: '#3b5ccc', Hat: '#2a3f99', Gold: '#e8b23a' } },
  { id: 'pug', icon: 'paw', name: 'Pug', price: 1500, tint: { Skin: '#d8b07a' } },
  { id: 'robot', icon: 'gear', name: 'Robot', price: 2000, rig: 'robot', height: 1.9 },
];

// Blasters fire at the chaser after every right answer. Later ones knock it farther back.
export const WEAPONS = [
  { id: 'zap', icon: 'bolt', name: 'Zapper', price: 0, color: '#7ff3ff', knock: 1 },
  { id: 'splash', icon: 'water', name: 'Splasher', price: 100, color: '#4fc3ff', knock: 1.1 },
  { id: 'fire', icon: 'fire', name: 'Fire', price: 200, color: '#ff7a1a', knock: 1.2 },
  { id: 'freeze', icon: 'ice', name: 'Freeze', price: 350, color: '#bdf2ff', knock: 1.3 },
  { id: 'fireworks', icon: 'sparkles', name: 'Fireworks', price: 550, color: '#ff4fd8', knock: 1.45 },
  { id: 'rainbow', icon: 'rainbow', name: 'Rainbow', price: 800, color: '#ffffff', knock: 1.6 },
  { id: 'meteor', icon: 'planet', name: 'Meteor', price: 1200, color: '#ff5a1f', knock: 1.8 },
];

// Trails sparkle behind the runner.
export const TRAILS = [
  { id: 'none', icon: 'none', name: 'None', price: 0, colors: [] },
  { id: 'sparkle', icon: 'sparkle', name: 'Sparkle', price: 80, colors: ['#fff3a0', '#ffd23f', '#ffffff'] },
  { id: 'fire', icon: 'fire', name: 'Fire', price: 150, colors: ['#ff3b1a', '#ff8c1a', '#ffd23f'] },
  { id: 'ice', icon: 'ice', name: 'Ice', price: 150, colors: ['#bdf2ff', '#7fd8ff', '#ffffff'] },
  { id: 'hearts', icon: 'love', name: 'Love', price: 250, colors: ['#ff2d75', '#ff8fb8', '#ffffff'] },
  { id: 'rainbow', icon: 'rainbow', name: 'Rainbow', price: 400, colors: ['#ff3b5c', '#ff8c1a', '#ffd23f', '#3cb44b', '#2f7fe0', '#b06cff'] },
  { id: 'stars', icon: 'stars', name: 'Stars', price: 500, colors: ['#ffe066', '#ffffff', '#7ff3ff'] },
];

export const SHOP_TABS = [
  { id: 'runners', icon: 'runner', items: RUNNERS },
  { id: 'weapons', icon: 'blaster', items: WEAPONS },
  { id: 'powers', icon: 'bolt', items: null },
  { id: 'trails', icon: 'sparkles', items: TRAILS },
];

export const byId = (list, id) => list.find(x => x.id === id) || list[0];

// Fills in shop fields on an old save so existing coins carry over.
export function initShopSave(S) {
  S.owned = { runners: ['kid'], weapons: ['zap'], trails: ['none'], ...(S.owned || {}) };
  for (const [tab, list] of [['runners', RUNNERS], ['weapons', WEAPONS], ['trails', TRAILS]]) {
    if (!Array.isArray(S.owned[tab])) S.owned[tab] = [];
    if (!S.owned[tab].includes(list[0].id)) S.owned[tab].unshift(list[0].id);
  }
  S.equip = { runners: 'kid', weapons: 'zap', trails: 'none', ...(S.equip || {}) };
  S.upgrades = { ...Object.fromEntries(TIMED_POWERS.map(k => [k, 0])), ...(S.upgrades || {}) };
  return S;
}
