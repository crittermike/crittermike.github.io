// Palmetto Trail: Social Studies "SC Landform Regions" test (November 2026)
// One stage per region (mountains to ocean), then a stage on the order of the regions.
CritterQuest.addLevel({
  id: 'sc-landforms',
  name: 'Palmetto Trail',
  topic: 'Social Studies: SC Landforms',
  date: '2026-11-12',
  emoji: '🏞️',
  color: '#ff8a65',
  decor: ['🌴', '⛰️', '🌊'],
  boss: '🦈',
  stages: [
    // Blue Ridge
    { monster: '🐻', questions: [
      { q: 'Which region has mountains?', a: 'Blue Ridge', wrong: ['Piedmont', 'Sandhills', 'Coastal Zone', 'Inner Coastal Plain'], why: 'Only Blue Ridge has mountains.', pic: '⛰️' },
      { q: 'Which region is the smallest?', a: 'Blue Ridge', wrong: ['Piedmont', 'Sandhills', 'Coastal Zone', 'Outer Coastal Plain'], why: 'Blue Ridge is the smallest.', pic: '🐜' },
      { q: 'Blue Ridge Mountains are part of the…?', a: 'Appalachian Mountains', wrong: ['Rocky Mountains', 'Sandhills', 'Barrier islands'], why: 'Part of the Appalachians.' },
      { q: 'How does Blue Ridge make money?', a: 'Tourism', wrong: ['Shrimping', 'Logging', 'Growing rice'], why: 'Tourists hike and see waterfalls.', pic: '💰' },
      { q: 'What does economy mean?', a: 'How places make money', wrong: ['How land is shaped', 'How rivers flow', 'How plants grow'], why: 'Economy is about money.', pic: '💵' },
      { q: 'Table Rock and Paris Mountain are…?', a: 'Monadnocks', wrong: ['Barrier islands', 'Marshes', 'Fall lines', 'Beaches'], why: 'Monadnocks are great for hiking.', pic: '🥾' },
    ] },
    // Piedmont
    { monster: '🦌', questions: [
      { q: 'Which region is the largest?', a: 'Piedmont', wrong: ['Blue Ridge', 'Sandhills', 'Coastal Zone', 'Outer Coastal Plain'], why: 'Piedmont is the biggest.', pic: '🐘' },
      { q: 'What does Piedmont mean?', a: 'Foothills', wrong: ['Mountains', 'Sandy hills', 'Beaches', 'Swamps'], why: 'Piedmont means foothills.' },
      { q: 'Which region do we live in?', a: 'Piedmont', wrong: ['Blue Ridge', 'Sandhills', 'Coastal Zone', 'Inner Coastal Plain'], why: 'We live in the Piedmont.', pic: '🏡' },
      { q: 'How does Piedmont make money?', a: 'Manufacturing', wrong: ['Shrimping', 'Logging', 'Rice farming'], why: 'Piedmont has lots of factories.', pic: '💰' },
      { q: 'Cloth made in factories is called…?', a: 'Textiles', wrong: ['Timber', 'Indigo', 'Granite'], why: 'Textiles are cloth.', pic: '🏭' },
      { show: '🍑 Peaches 💦 Waterfalls 🦶 Foothills', q: 'Which region is this?', a: 'Piedmont', wrong: ['Sandhills', 'Coastal Zone', 'Inner Coastal Plain', 'Outer Coastal Plain'], why: 'That is the Piedmont.' },
    ] },
    // Sandhills
    { monster: '🦎', questions: [
      { q: 'What do the Sandhills have lots of?', a: 'Sandy hills', wrong: ['Tall mountains', 'Swamps', 'Beaches'], why: 'Sandhills means sandy hills.' },
      { q: 'What is the fall line?', a: 'Where the land drops', wrong: ['A row of mountains', 'Where the ocean ends', 'A line of beaches'], why: 'The land drops down there.', pic: '📉' },
      { q: 'Which region has the fall line?', a: 'Sandhills', wrong: ['Blue Ridge', 'Coastal Zone', 'Outer Coastal Plain'], why: 'Fall line is in Sandhills.' },
      { q: 'What is hydroelectricity?', a: 'Power from water', wrong: ['Power from wind', 'Power from the sun', 'Power from coal'], why: 'Hydro means water.', pic: '⚡' },
      { q: 'Where does rushing water make power?', a: 'At the fall line', wrong: ['At the beach', 'In the swamps', 'On barrier islands'], why: 'Falling water makes power.', pic: '💦' },
      { q: 'Why is farming hard in the Sandhills?', a: 'Dry, sandy soil', wrong: ['Too many mountains', 'Too much rain', 'Salty ocean water'], why: 'Sandy soil is too dry.', pic: '🌱' },
    ] },
    // Inner Coastal Plain
    { monster: '🐛', questions: [
      { q: 'Which region is best for farming?', a: 'Inner Coastal Plain', wrong: ['Sandhills', 'Blue Ridge', 'Coastal Zone', 'Outer Coastal Plain'], why: 'It is the farming heart.', pic: '🚜' },
      { show: 'Inner Coastal Plain', q: 'What is the land like?', a: 'Mostly flat', wrong: ['Tall mountains', 'Sandy hills', 'Swamps and marshes'], why: 'The land is mostly flat.' },
      { show: 'Inner Coastal Plain', q: 'Why do crops grow well there?', a: 'Rich, dark soil', wrong: ['Dry, sandy soil', 'Salty ocean water', 'Rocky mountain soil'], why: 'Rich soil that drains well.' },
      { show: 'Inner Coastal Plain', q: 'Which crops grow there?', a: 'Peanuts and soybeans', wrong: ['Rice and indigo', 'Bananas and coconuts', 'Pineapples and mangoes'], why: 'Peanuts and soybeans grow there.' },
      { show: 'Inner Coastal Plain', q: 'Its growing season is…?', a: 'Long', wrong: ['Short', 'Only in winter', 'Just one week'], why: 'Long season, lots of crops.', pic: '☀️' },
      { q: 'What does agriculture mean?', a: 'Farming', wrong: ['Fishing', 'Logging', 'Building'], why: 'Agriculture means farming.' },
    ] },
    // Outer Coastal Plain
    { monster: '🦟', questions: [
      { q: 'Which region has swamps and marshes?', a: 'Outer Coastal Plain', wrong: ['Blue Ridge', 'Sandhills', 'Piedmont', 'Inner Coastal Plain'], why: 'Outer Coastal Plain is swampy.', pic: '🐊' },
      { show: 'Outer Coastal Plain', q: 'What is the soil like?', a: 'Does not drain well', wrong: ['Dry and sandy', 'Drains really well', 'Hard and rocky'], why: 'Water stays in the soil.' },
      { show: 'Outer Coastal Plain', q: 'Which crops can grow there?', a: 'Rice and indigo', wrong: ['Peanuts and soybeans', 'Peaches and apples', 'Bananas and coconuts'], why: 'Rice likes wet soil.' },
      { q: 'How does Outer Coastal Plain make money?', a: 'Logging', wrong: ['Shrimping', 'Peach farming', 'Hydroelectricity', 'Textiles'], why: 'Its forests have many trees.', pic: '🌲' },
      { q: 'Wood from trees is called…?', a: 'Timber', wrong: ['Granite', 'Indigo', 'Textiles'], why: 'Timber is wood from trees.', pic: '🪵' },
      { q: 'Water and timber are natural…?', a: 'Resources', wrong: ['Landforms', 'Regions', 'Economies'], why: 'Nature gives us resources.', pic: '💧' },
    ] },
    // Coastal Zone
    { monster: '🦐', questions: [
      { q: 'Which region has beaches and barrier islands?', a: 'Coastal Zone', wrong: ['Sandhills', 'Piedmont', 'Blue Ridge', 'Inner Coastal Plain'], why: 'They line the coast.', pic: '🏖️' },
      { q: 'Which ocean does SC touch?', a: 'Atlantic Ocean', wrong: ['Pacific Ocean', 'Indian Ocean', 'Arctic Ocean'], why: 'SC touches the Atlantic.', pic: '🌊' },
      { q: 'How wide is the Coastal Zone?', a: 'About 10 miles', wrong: ['About 1 mile', 'About 100 miles', 'About 500 miles'], why: 'It is 10 miles wide.', pic: '📏' },
      { q: 'How does the Coastal Zone make money?', a: 'Tourism and shrimping', wrong: ['Logging and rice', 'Peanut farming', 'Factories', 'Hydroelectricity'], why: 'Tourists and shrimp boats!', pic: '💰' },
      { show: '🚢 Goods come in and go out', q: 'What is that called?', a: 'Imports and exports', wrong: ['Logging and timber', 'Tourism', 'Recreation'], why: 'Imports in, exports out.' },
      { q: 'Swimming and boating are called…?', a: 'Recreation', wrong: ['Agriculture', 'Economy', 'Manufacturing'], why: 'Recreation means fun activities.', pic: '🚣' },
    ] },
    // Order of the regions, mountains to ocean
    { monster: '🦅', questions: [
      { q: 'How many landform regions does SC have?', a: '6', wrong: ['3', '4', '5', '8'], why: 'SC has six regions.', pic: '🗺️' },
      { show: 'Blue Ridge → ?', q: 'Which region comes next?', say: 'Going toward the ocean. Blue Ridge, then which region comes next?', a: 'Piedmont', wrong: ['Sandhills', 'Coastal Zone', 'Inner Coastal Plain', 'Outer Coastal Plain'], why: 'Blue Ridge, then Piedmont.' },
      { show: 'Piedmont → ?', q: 'Which region comes next?', say: 'Going toward the ocean. Piedmont, then which region comes next?', a: 'Sandhills', wrong: ['Blue Ridge', 'Coastal Zone', 'Inner Coastal Plain', 'Outer Coastal Plain'], why: 'Piedmont, then Sandhills.' },
      { show: 'Sandhills → ?', q: 'Which region comes next?', say: 'Going toward the ocean. Sandhills, then which region comes next?', a: 'Inner Coastal Plain', wrong: ['Outer Coastal Plain', 'Piedmont', 'Coastal Zone', 'Blue Ridge'], why: 'Sandhills, then Inner Coastal Plain.' },
      { show: 'Inner Coastal Plain → ?', q: 'Which region comes next?', say: 'Going toward the ocean. Inner Coastal Plain, then which region comes next?', a: 'Outer Coastal Plain', wrong: ['Coastal Zone', 'Sandhills', 'Piedmont', 'Blue Ridge'], why: 'Inner, then Outer.' },
      { q: 'Which region is last, by the ocean?', a: 'Coastal Zone', wrong: ['Outer Coastal Plain', 'Inner Coastal Plain', 'Sandhills', 'Blue Ridge'], why: 'Coastal Zone touches the ocean.', pic: '🌊' },
    ] },
  ],
});
