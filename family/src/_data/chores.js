// Static chore checklist data for the family dashboard.
// Renders all 4 monthly weekend rotations; the dashboard uses JS at runtime
// to flip body[data-weekend="1"] and body[data-w-of-m="N"], so a stale build
// still shows the correct day's chores after midnight rollover.

function slugify(s) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);
}
function tag(arr, prefix) {
  return arr.map(t => ({ id: prefix + '-' + slugify(t), label: t }));
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

const MONTHLY = [
  // weekend 1
  {
    n: 1,
    sat: { title: 'Kitchen', items: ['Clean microwave and cabinets', 'Organize the pantry', 'Clean out the fridge', 'Mop kitchen floor', 'Clean the oven'] },
    sun: { title: 'Cars', items: ['Wash', 'Vacuum'] },
  },
  // weekend 2
  {
    n: 2,
    sat: { title: 'Bathroom', items: ['Clean toilets, tubs, showers', 'Wash bathmats', 'Restock toiletries'] },
    sun: { title: 'Bedrooms', items: ['Change linens', 'Rotate mattresses (every 3rd mo)', 'Clean/vacuum under beds'] },
  },
  // weekend 3
  {
    n: 3,
    sat: { title: 'Living areas', items: ['Wash cushion covers', 'Clean windows and glass doors', 'Mop hard floors'] },
    sun: { title: 'Outdoor/Garage', items: ['Clean up backyard/patio', 'Blow leaves on front porch', 'Tidy and sweep garage', 'Seasonal plant care/weeds'] },
  },
  // weekend 4
  {
    n: 4,
    sat: { title: 'Maintenance', items: ['Check HVAC filters', 'Clean cycle on washer', 'Clean cycle on oven'] },
    sun: { title: 'Catch up', items: ['Catch up on deferred tasks', 'Organize something (closet, bookshelf, etc.)'] },
  },
];

module.exports = () => {
  return {
    quick: { title: 'Quick clean', items: tag(QUICK_CLEAN, 'qc') },
    laundry: { title: 'Laundry / Trash', items: tag(LAUNDRY_TRASH, 'lt') },
    monthly: MONTHLY.map(m => ({
      n: m.n,
      sat: { title: m.sat.title, items: tag(m.sat.items, 'w' + m.n + '-sat') },
      sun: { title: m.sun.title, items: tag(m.sun.items, 'w' + m.n + '-sun') },
    })),
  };
};
