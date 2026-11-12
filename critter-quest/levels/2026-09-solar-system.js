// Space Island: Solar System test (September 2026)
CritterQuest.addLevel({
  id: 'solar-system',
  name: 'Space Island',
  topic: 'Sun, Earth, and Moon',
  date: '2026-09-23',
  emoji: '🪐',
  color: '#7c83ff',
  decor: ['⭐', '🌙', '✨'],
  boss: '🐲',
  stages: [
    { monster: '👽', questions: [
      { q: 'What is the center of our solar system?', a: 'The Sun', wrong: ['The Moon', 'Earth', 'Mars'], why: 'The Sun is the center.', pic: '☀️' },
      { q: 'Is the Sun a star or a planet?', a: 'A star', wrong: ['A planet', 'A moon', 'A comet'], why: 'The Sun is a star!' },
      { q: 'What does the Sun give Earth?', a: 'Light and heat', wrong: ['Air to breathe', 'Moon rocks', 'Rain clouds'], why: 'Sun gives light and heat.', pic: '🌞' },
      { q: 'What is the Sun made of?', a: 'Plasma', wrong: ['Water', 'Rock', 'Ice'], why: 'Super hot plasma!', pic: '🔥' },
      { q: 'What are cooler spots on the Sun?', a: 'Sunspots', wrong: ['Craters', 'Clouds', 'Moons'], why: 'Cooler spots are sunspots.' },
    ] },
    { monster: '🛸', questions: [
      { q: 'What makes day and night?', a: 'Earth spinning', wrong: ["Earth's orbit", 'Moon craters', 'Sun spinning'], why: 'Earth spins: day, then night.', pic: '🌗' },
      { q: 'Imaginary line from pole to pole?', a: 'Axis', wrong: ['Orbit', 'Equator', 'Crater'], why: 'Earth spins on its axis.', pic: '🌍' },
      { q: "What is Earth's path around the Sun?", a: 'Orbit', wrong: ['Axis', 'Crater', 'Sunspot'], why: 'That path is an orbit.', pic: '🌎' },
      { q: 'How long is one trip around the Sun?', a: '365 ¼ days', wrong: ['24 hours', '30 days', '7 days'], why: 'One year: 365 ¼ days.', pic: '📅' },
      { q: 'What causes seasons?', a: 'Tilt and orbit', wrong: ['Distance from Sun', 'Moon craters', 'Sunspots'], why: "Earth's tilt plus its orbit.", pic: '🍂' },
    ] },
    { monster: '👾', questions: [
      { q: 'What are holes on the Moon?', a: 'Craters', wrong: ['Sunspots', 'Lakes', 'Caves'], why: 'Moon holes are craters.', pic: '🌕' },
      { q: 'What side of the Moon faces us?', a: 'Near side', wrong: ['Far side', 'Dark side', 'Inside'], why: 'We see the near side.', pic: '🌝' },
      { q: 'What covers the Moon?', a: 'Rocks and dust', wrong: ['Grass and trees', 'Water', 'Snow'], why: 'Moon has rocks and dust.', pic: '🌑' },
      { q: 'Why do astronauts wear spacesuits?', a: 'Air and protection', wrong: ['To grow taller', 'To fly faster', 'To look cool'], why: 'Suits give air and safety.', pic: '🧑‍🚀' },
    ] },
    { monster: '☄️', questions: [
      { q: 'Who studies space?', a: 'Astronomers', wrong: ['Botanists', 'Meteorologists', 'Doctors'], why: 'Astronomers study space.', pic: '🔭' },
      { q: 'What tool helps us see planets?', a: 'Telescope', wrong: ['Microscope', 'Thermometer', 'Magnet'], why: 'Telescopes see far away.', pic: '🪐' },
      { q: 'North has summer. South has…?', a: 'Winter', wrong: ['Summer', 'Spring', 'Fall'], why: 'Hemispheres have opposite seasons.', pic: '🌎' },
    ] },
  ],
});
