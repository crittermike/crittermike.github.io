// Word Woods: Subjects and Predicates test (September 2026)
CritterQuest.addLevel({
  id: 'subjects-predicates',
  name: 'Word Woods',
  topic: 'Subjects and Predicates',
  date: '2026-09-03',
  emoji: '🌲',
  color: '#5cc96b',
  decor: ['🌳', '🍄', '🌲'],
  boss: '🦍',
  stages: [
    { monster: '🐍', questions: [
      { q: 'What does the subject tell?', a: 'Who or what', wrong: ['What it does', 'Where', 'When'], why: 'Subject: who or what.' },
      { q: 'What does the predicate tell?', a: 'What it does', wrong: ['Who or what', 'Where it is', 'How many'], why: 'Predicate: what it does.' },
      { q: 'What is a simple subject?', a: 'The main noun', wrong: ['The action word', 'The whole sentence', 'The last word'], why: 'Just the main noun.' },
      { q: 'What is a simple predicate?', a: 'The main verb', wrong: ['The main noun', 'Every word', 'The first word'], why: 'Just the action verb.' },
    ] },
    { monster: '🐆', questions: [
      { show: 'The busy baker makes fresh bread.', q: 'Which is the simple subject?', a: 'baker', wrong: ['busy', 'makes', 'bread'], why: 'Baker is the main noun.' },
      { show: 'The busy baker makes fresh bread.', q: 'Which is the simple predicate?', a: 'makes', wrong: ['baker', 'fresh', 'bread'], why: 'Makes is the action.' },
      { show: 'A local farmer grows food.', q: 'Which is the simple subject?', a: 'farmer', wrong: ['local', 'grows', 'food'], why: 'Farmer is the main noun.' },
      { show: 'Our mayor leads the city.', q: 'Which is the simple predicate?', a: 'leads', wrong: ['mayor', 'city', 'Our'], why: 'Leads is the action.' },
    ] },
    { monster: '🐻', questions: [
      { show: 'Brave firefighters stop fires.', q: 'Which is the complete subject?', a: 'Brave firefighters', wrong: ['firefighters', 'stop fires', 'Brave firefighters stop'], why: 'Who part, with describing words.' },
      { show: 'The mail carrier delivers letters.', q: 'Which is the complete predicate?', a: 'delivers letters', wrong: ['The mail carrier', 'delivers', 'letters'], why: 'Verb plus the rest.' },
      { show: 'The friendly nurse cares for patients.', q: 'Which is the complete subject?', a: 'The friendly nurse', wrong: ['nurse', 'cares for patients', 'friendly nurse cares'], why: 'Who part, with describing words.' },
      { show: 'A skilled mechanic repairs cars.', q: 'Which is the complete predicate?', a: 'repairs cars', wrong: ['A skilled mechanic', 'mechanic repairs', 'cars'], why: 'Verb plus the rest.' },
    ] },
    { monster: '🐺', questions: [
      { show: 'The town library lends books.', q: 'Which is the simple subject?', a: 'library', wrong: ['town', 'lends', 'books'], why: 'Library is the main noun.' },
      { show: 'A park ranger protects animals.', q: 'Which is the simple predicate?', a: 'protects', wrong: ['ranger', 'animals', 'park'], why: 'Protects is the action.' },
      { show: 'Crossing guards help students.', q: 'Which is the complete subject?', a: 'Crossing guards', wrong: ['guards', 'help students', 'students'], why: 'Who part, with describing words.' },
      { show: 'Our soccer coach teaches teamwork.', q: 'Which is the complete predicate?', a: 'teaches teamwork', wrong: ['Our soccer coach', 'teaches', 'teamwork'], why: 'Verb plus the rest.' },
    ] },
  ],
});
