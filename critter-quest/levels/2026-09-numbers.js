// Number Mountain: Numbers to 10,000 test (September 2026)
CritterQuest.addLevel({
  id: 'numbers-to-10000',
  name: 'Number Mountain',
  topic: 'Numbers to 10,000',
  date: '2026-09-09',
  emoji: '⛰️',
  color: '#b48cff',
  decor: ['🏔️', '🪨', '🌲'],
  boss: '🧌',
  stages: [
    { monster: '🦁', questions: [
      { q: 'What is the value of 5 in 5,164?', a: '5,000', wrong: ['500', '50', '5'], why: 'The 5 means 5,000.' },
      { show: '6,912', q: 'Which digit is in the hundreds place?', a: '9', wrong: ['6', '1', '2'], why: '9 means 9 hundreds.' },
      { q: 'What is the value of 4 in 7,543?', a: '40', wrong: ['4', '400', '4,000'], why: 'The 4 means 4 tens.' },
      { q: 'How many tens are in 4,300?', a: '430', wrong: ['43', '4,300', '4'], why: '430 tens make 4,300.' },
    ] },
    { monster: '🦅', questions: [
      { show: '3,000 + 200 + 10 + 4', q: 'What number is this?', a: '3,214', wrong: ['3,241', '3,204', '3,124'], why: 'Put each place together.' },
      { show: '8,000 + 200 + 6', q: 'What number is this?', a: '8,206', wrong: ['8,260', '8,026', '826'], why: 'Zero holds the tens place.' },
      { show: 'five thousand five', q: 'What number is this?', a: '5,005', wrong: ['5,500', '5,050', '505'], why: '5 thousands and 5 ones.' },
      { q: 'Which number is the greatest?', a: '4,520', wrong: ['4,502', '4,250', '4,052'], why: 'Compare digits left to right.', pic: '🐊' },
      { q: 'Which number is the smallest?', a: '1,234', wrong: ['2,341', '2,413', '3,412'], why: 'Fewest thousands is smallest.' },
    ] },
    { monster: '🐗', questions: [
      { show: '5,009 → 4,009 → 3,009 → ?', q: 'What comes next?', say: '5,009. 4,009. 3,009. What comes next?', a: '2,009', wrong: ['2,900', '3,008', '2,090'], why: 'Take away 1,000 each.' },
      { show: '4,374 → 4,474 → 4,574 → ?', q: 'What comes next?', say: '4,374. 4,474. 4,574. What comes next?', a: '4,674', wrong: ['4,584', '5,574', '4,575'], why: 'Add 100 each time.' },
      { q: 'What is 100 more than 995?', a: '1,095', wrong: ['1,005', '996', '9,095'], why: '995 + 100 = 1,095' },
      { q: 'What is 100 less than 9,006?', a: '8,906', wrong: ['9,005', '8,006', '9,106'], why: '9,006 − 100 = 8,906' },
      { q: 'What is halfway between 1,500 and 2,500?', a: '2,000', wrong: ['1,750', '2,250', '3,000'], why: '2,000 is the middle.', pic: '📏' },
    ] },
    { monster: '🦬', questions: [
      { q: 'Round 4,683 to the nearest ten.', a: '4,680', wrong: ['4,690', '4,700', '5,000'], why: '3 ones rounds down.' },
      { q: 'Round 4,348 to the nearest hundred.', a: '4,300', wrong: ['4,400', '4,350', '4,000'], why: '4 tens rounds down.' },
      { q: 'Round 4,521 to the nearest thousand.', a: '5,000', wrong: ['4,000', '4,500', '4,600'], why: '5 hundreds rounds up.' },
      { q: 'Round 85 to the nearest ten.', a: '90', wrong: ['80', '85', '100'], why: '5 rounds up!' },
      { q: 'Round 9,500 to the nearest thousand.', a: '10,000', wrong: ['9,000', '9,500', '9,600'], why: '5 hundreds rounds up.' },
    ] },
  ],
});
