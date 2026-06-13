// Weekend chore data for the family dashboard.
// Returns today's chore lists (Sat + Sun for the current weekend), plus
// the rotating "Nth weekend of month" monthly section. Only meaningful
// to the template when isWeekend=true.

function etParts() {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    year: 'numeric', month: 'numeric', day: 'numeric', weekday: 'short',
  }).formatToParts(new Date());
  const map = {};
  fmt.forEach(p => { if (p.type !== 'literal') map[p.type] = p.value; });
  return {
    year: parseInt(map.year, 10),
    month: parseInt(map.month, 10),
    day: parseInt(map.day, 10),
    dow: map.weekday, // 'Sat', 'Sun', etc.
  };
}

// Which weekend of the month is this? (1..5)
// Anchored on Saturday: if today is Sun, look back one day to its Saturday.
function weekendOfMonth(year, month, day, dow) {
  // Compute the Saturday's day-of-month for this weekend.
  let satDay = day;
  if (dow === 'Sun') satDay = day - 1;
  if (satDay < 1) {
    // Sunday of a weekend whose Saturday was in the previous month.
    // Treat as week 5 of the previous month's last weekend; for our purposes
    // we don't care about cross-month rollovers in the rotation, so default to 1.
    return 1;
  }
  return Math.ceil(satDay / 7);
}

const QUICK_CLEAN = [
  'Pick up entire house',
  'Wipe kitchen counter/stovetop',
  'Vacuum all carpet',
  'Sweep all hard floors',
  'Bathroom mirrors/counters',
];

const LAUNDRY_TRASH = [
  'Empty all trash cans',
  'Take out trash and recycling',
  'Laundry (wash, put away)',
];

const MONTHLY = {
  1: {
    sat: { title: 'Kitchen', items: ['Clean microwave and cabinets', 'Organize the pantry', 'Clean out the fridge', 'Mop kitchen floor', 'Clean the oven'] },
    sun: { title: 'Cars', items: ['Wash', 'Vacuum'] },
  },
  2: {
    sat: { title: 'Bathroom', items: ['Clean toilets, tubs, showers', 'Wash bathmats', 'Restock toiletries'] },
    sun: { title: 'Bedrooms', items: ['Change linens', 'Rotate mattresses (every 3rd mo)', 'Clean/vacuum under beds'] },
  },
  3: {
    sat: { title: 'Living areas', items: ['Wash cushion covers', 'Clean windows and glass doors', 'Mop hard floors'] },
    sun: { title: 'Outdoor/Garage', items: ['Clean up backyard/patio', 'Blow leaves on front porch', 'Tidy and sweep garage', 'Seasonal plant care/weeds'] },
  },
  4: {
    sat: { title: 'Maintenance', items: ['Check HVAC filters', 'Clean cycle on washer', 'Clean cycle on oven'] },
    sun: { title: 'Catch up', items: ['Catch up on deferred tasks', 'Organize something (closet, bookshelf, etc.)'] },
  },
  5: { sat: null, sun: null }, // bonus 5th weekend: only quick-clean + laundry
};

function slugify(s) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 50);
}

function tagItems(arr, prefix) {
  return arr.map(t => ({ id: prefix + '-' + slugify(t), label: t }));
}

module.exports = () => {
  const et = etParts();
  const weekend = et.dow === 'Sat' || et.dow === 'Sun';
  const w = weekendOfMonth(et.year, et.month, et.day, et.dow);
  const satDay = et.dow === 'Sun' ? et.day - 1 : et.day;
  const weekendKey = et.year + '-' +
    String(et.month).padStart(2, '0') + '-' +
    String(Math.max(satDay, 1)).padStart(2, '0');

  const monthly = MONTHLY[w] || { sat: null, sun: null };

  return {
    isWeekend: weekend,
    dow: et.dow, // 'Sat', 'Sun' (or other) — useful for which day to spotlight
    weekOfMonth: w,
    weekendKey, // localStorage key shared across the whole weekend
    saturday: {
      title: 'Saturday',
      quick: { title: 'Quick clean', items: tagItems(QUICK_CLEAN, 'sat-quick') },
      monthly: monthly.sat
        ? { title: monthly.sat.title, items: tagItems(monthly.sat.items, 'sat-w' + w) }
        : null,
    },
    sunday: {
      title: 'Sunday',
      laundry: { title: 'Laundry / Trash', items: tagItems(LAUNDRY_TRASH, 'sun-laundry') },
      monthly: monthly.sun
        ? { title: monthly.sun.title, items: tagItems(monthly.sun.items, 'sun-w' + w) }
        : null,
    },
  };
};
