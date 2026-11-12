// Gear Island: Simple Machines test (May 2026)
CritterQuest.addLevel({
  id: 'simple-machines',
  name: 'Gear Island',
  topic: 'Simple Machines',
  date: '2026-05-21',
  emoji: '🛠️',
  color: '#ffb347',
  decor: ['⚙️', '🔩', '🌴'],
  boss: '🤖',
  stages: [
    { monster: '🐝', questions: [
      { q: 'What is a ramp?', a: 'Inclined plane', wrong: ['Lever', 'Pulley', 'Screw'], why: 'A ramp is a slope.', pic: '🛝' },
      { q: 'Which machine is a flat slope?', a: 'Inclined plane', wrong: ['Pulley', 'Wheel and axle', 'Screw'], why: 'Slope means inclined plane.', pic: '📐' },
      { q: 'Which machine splits wood?', a: 'Wedge', wrong: ['Screw', 'Pulley', 'Lever'], why: 'A wedge splits things.', pic: '🪓' },
      { q: 'What is a knife blade?', a: 'Wedge', wrong: ['Screw', 'Lever', 'Pulley'], why: 'Blades split things apart.', pic: '🔪' },
    ] },
    { monster: '🦏', questions: [
      { q: 'Which machine twists into wood?', a: 'Screw', wrong: ['Wedge', 'Lever', 'Pulley'], why: 'Screws twist in.', pic: '🔩' },
      { q: 'What is a jar lid?', a: 'Screw', wrong: ['Wedge', 'Pulley', 'Lever'], why: 'Lids twist on. Screw!', pic: '🫙' },
      { q: 'What is a seesaw?', a: 'Lever', wrong: ['Pulley', 'Wedge', 'Screw'], why: 'A seesaw is a lever.' },
      { q: 'What does a lever turn on?', a: 'Fulcrum', wrong: ['Load', 'Effort', 'Axle'], why: 'It turns on the fulcrum.', pic: '🔺' },
    ] },
    { monster: '🦂', questions: [
      { q: 'Which machine lifts with a rope?', a: 'Pulley', wrong: ['Lever', 'Screw', 'Wedge'], why: 'Pulleys use a rope.', pic: '🪢' },
      { q: 'What raises a flag up a pole?', a: 'Pulley', wrong: ['Lever', 'Wedge', 'Screw'], why: 'Flagpoles use a pulley.', pic: '🚩' },
      { q: 'What is a doorknob?', a: 'Wheel and axle', wrong: ['Pulley', 'Screw', 'Wedge'], why: 'It turns on a rod.', pic: '🚪' },
      { q: 'What is a steering wheel?', a: 'Wheel and axle', wrong: ['Pulley', 'Lever', 'Wedge'], why: 'The wheel turns a rod.', pic: '🚗' },
    ] },
    { monster: '🦖', questions: [
      { q: 'What is the load?', a: 'Thing you lift', wrong: ['Your push', 'Turning point', 'The rope'], why: 'Load is what you lift.', pic: '📦' },
      { q: 'What is the effort?', a: 'Your push or pull', wrong: ['Thing you lift', 'Turning point', 'The wheel'], why: 'Effort is your push.', pic: '💪' },
      { q: 'What is a hand truck?', a: 'Lever', wrong: ['Pulley', 'Screw', 'Wedge'], why: 'It tips loads up. Lever!' },
      { q: 'How many simple machines are there?', a: '6', wrong: ['3', '4', '10'], why: 'There are six!' },
      { q: 'What do simple machines do?', a: 'Make work easier', wrong: ['Make noise', 'Make work harder', 'Make food'], why: 'They make work easier.', pic: '🛠️' },
    ] },
  ],
});
