// Math Ch. 4: Multiply and Divide (3rd grade math test, November 2026).
// Most questions are { gen: 'skill' } entries: each one makes a new question with new numbers every time it comes up
// (see js/mathgen.js), so runs don't repeat. The study guide's own questions are written out too, since the test
// looks like them.
CritterRun.addLevel({
  id: 'math-ch4',
  name: 'Math Blast',
  topic: 'Math: Multiply and Divide',
  date: '2026-11-20',
  stages: [
    { name: 'Factor Forest', biome: 'mountains', chaser: 'bear', color: '#2f8cff', music: 'breakdown', count: 9, questions: [
      { gen: 'multWords' }, { gen: 'groups' }, { gen: 'multFacts' }, { gen: 'expressions' }, { gen: 'groups' },
      { show: 'Each box has 2 pencils.', q: 'Which shows the pencils in 3 boxes?', a: '2 × 3', wrong: ['3 ÷ 3', '2 + 3', '3 × 3', '2 + 2'], why: 'Multiply: 2 pencils × 3 boxes.', pic: 'pencil' },
      { q: 'What are equal groups called?', a: 'Units', wrong: ['Factors', 'Products', 'Quotients'], why: 'Equal groups are units.' },
      { q: 'How many equal groups are there?', model: { kind: 'groups', groups: 5, each: 3 }, a: '5', wrong: ['3', '15', '8'], why: 'Count the circles: 5.' },
      { q: 'How many units are on this bar?', model: { kind: 'bars', bars: [6] }, a: '6', wrong: ['5', '7', '12'], why: 'Count the boxes: 6 units.' },
    ] },
    { name: 'Times Tricks', biome: 'foothills', chaser: 'wolf', color: '#ff8c1a', music: 'jamboree', count: 9, questions: [
      { gen: 'oneMore' }, { gen: 'breakApart' }, { gen: 'zeroOne' }, { gen: 'multFacts' }, { gen: 'oneMore' }, { gen: 'zeroOne' },
      { show: '8 × 4 is __ more than 7 × 4', q: 'What number goes in the blank?', say: '8 times 4 is how much more than 7 times 4?', a: '4', wrong: ['1', '9', '8'], why: 'One more group of 4.' },
      { show: '3 × 5 + 6 × 5 = __ × 5', q: 'What number goes in the blank?', say: 'The sum of 3 times 5 and 6 times 5 is what times 5?', a: '9', wrong: ['10', '18', '15'], why: '3 + 6 = 9 fives.' },
    ] },
    { name: 'Divide Dunes', biome: 'sandhills', chaser: 'spider', color: '#e8a100', music: 'western', count: 9, questions: [
      { gen: 'divWords' }, { gen: 'divFacts' }, { gen: 'factFamily' }, { gen: 'signs' }, { gen: 'divWords' },
      { show: '8 divided into 8 groups', q: 'How many are in each group?', a: '1', wrong: ['8', '0', '16'], why: '8 ÷ 8 = 1.' },
      { show: '0 ÷ 5 = ?', q: 'What is the answer?', a: '0', wrong: ['5', '1', '50'], why: 'Zero shared is still 0.' },
      { show: '27 __ 3 = 9', q: 'Which sign makes it true?', a: '÷', wrong: ['×', '+', '−'], why: '27 ÷ 3 = 9.' },
      { show: '9 __ 3 = 27', q: 'Which sign makes it true?', a: '×', wrong: ['÷', '+', '−'], why: '9 × 3 = 27.' },
    ] },
    { name: 'Even or Odd', biome: 'beach', chaser: 'shark', color: '#a052ff', music: 'surfing', count: 8, questions: [
      { gen: 'evenOdd' }, { gen: 'oddEvenProducts' }, { gen: 'evenOdd' }, { gen: 'oddEvenProducts' }, { gen: 'evenOdd' },
      { q: 'Which one is not an even number?', a: '19', wrong: ['16', '6', '48'], why: '19 ends in 9: odd.' },
      { q: 'Which one gives an odd number?', a: '5 × 9', wrong: ['4 × 3', '6 × 2', '8 ÷ 2'], why: '5 × 9 = 45, odd.' },
    ] },
    { name: 'Remainder Swamp', biome: 'swamp', chaser: 'gator', color: '#14b8a6', music: 'pickin', count: 10, questions: [
      { gen: 'remainders' }, { gen: 'remainderStory' }, { gen: 'remainders' }, { gen: 'remainderStory' },
      { show: '15 ÷ 2 = ?', q: 'What is the answer?', a: '7 R1', wrong: ['7', '8 R1', '6 R3', '8'], why: '2 × 7 = 14, 1 left.' },
      { q: 'Which has a remainder of 1?', a: '11 ÷ 5', wrong: ['11 ÷ 3', '9 ÷ 3', '12 ÷ 4'], why: '11 ÷ 5 = 2 R1.' },
      { show: '28 books. A box holds 3.', q: 'Fewest boxes for all the books?', a: '10', wrong: ['9', '8', '1'], why: '9 full + 1 more box.', pic: 'book' },
      { show: '23 stickers. Exactly 5 per notebook.', q: 'How many notebooks get 5?', a: '4', wrong: ['5', '3', '18'], why: '4 × 5 = 20, 3 left.' },
      { show: '23 stickers. Exactly 5 per notebook.', q: 'How many stickers are left over?', a: '3', wrong: ['4', '5', '2'], why: '23 − 20 = 3 left.' },
    ] },
    { name: 'Bar Model Farm', biome: 'farmland', chaser: 'panther', color: '#3cb44b', music: 'bama', count: 10, questions: [
      { gen: 'bars' }, { gen: 'wordProblems' }, { gen: 'bars' }, { gen: 'wordProblems' }, { gen: 'breakApart' },
      { q: 'Which equation finds 1 unit?', model: { kind: 'bars', bars: [3, 1], unit: '?', total: '40' }, a: '40 ÷ 4 = 10', wrong: ['40 − 4 = 36', '40 × 4 = 160', '40 + 4 = 44'], why: '4 units make 40.' },
      { q: 'Which equation finds the total?', model: { kind: 'bars', bars: [5, 1], unit: '6', total: '?' }, a: '6 × 6 = 36', wrong: ['6 × 5 = 30', '6 + 6 = 12', '6 + 1 = 7'], why: '6 units of 6 = 36.' },
      { show: 'Each vase has 4 roses and 2 daisies.', q: 'How many flowers in 4 vases?', a: '24', wrong: ['10', '16', '8', '18'], why: '(4 + 2) × 4 = 24.', pic: 'flower' },
      { show: '8 holy cards. 4 times as many stickers.', q: 'How many cards and stickers in all?', model: { kind: 'bars', bars: [1, 4], unit: '8', total: '?', names: ['Cards', 'Stickers'] }, a: '40', wrong: ['32', '12', '36'], why: '5 units of 8 = 40.' },
      { show: '105 red and blue markers. 75 are red.', q: '5 kids share the blue ones. Each gets?', say: 'There are 105 red and blue markers. 75 are red. 5 kids share the blue markers equally. How many does each kid get?', a: '6', wrong: ['30', '15', '21'], why: '30 blue ÷ 5 = 6.' },
    ] },
    { name: 'Big Math Review', biome: 'tour', chaser: 'hurricane', color: '#ff4081', music: 'heroic', questions: [
      { gen: 'wordProblems' }, { gen: 'remainderStory' }, { gen: 'bars' }, { gen: 'multFacts' },
      { gen: 'divFacts' }, { gen: 'factFamily' }, { gen: 'oddEvenProducts' }, { gen: 'remainders' },
    ] },
  ],
});
