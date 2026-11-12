// Everything the game uses that someone else made. CC BY items must stay credited here and in assets/CREDITS.md.
import { ICON_CREDITS } from './icons.js';
const CCBY3 = 'https://creativecommons.org/licenses/by/3.0/';
const CCBY4 = 'https://creativecommons.org/licenses/by/4.0/';
const CC0 = 'https://creativecommons.org/publicdomain/zero/1.0/';
const mac = title => ({ text: `"${title}" by Kevin MacLeod (incompetech.com)`, license: 'CC BY 4.0', url: CCBY4 });
const pp = (title, author, id) => ({ text: `"${title}" by ${author}`, link: `https://poly.pizza/m/${id}`, license: 'CC BY 3.0', url: CCBY3 });

export const CREDITS = [
  { title: 'Music', items: [
    mac('Voxel Revolution'), mac('Hillbilly Swing'), mac('Brightly Fancy'), mac('Enter the Party'), mac('Nano Hoedown'),
    mac('Hustle'), mac('Surf Shimmy'), mac('Call to Adventure'),
    { text: '"Win and lose melodies" by Vircon32, arranged by Sebastian F.', link: 'https://opengameart.org/content/win-and-lose-melodies', license: 'CC BY 4.0', url: CCBY4 },
    { text: 'Jingles by Kenney (kenney.nl) and "Point bell" by HaelDB', license: 'CC0', url: CC0 },
  ] },
  { title: 'Sound effects', items: [
    { text: 'Kenney (kenney.nl), Freesound contributors, and Joseph Sardin (BigSoundBank.com)', license: 'CC0', url: CC0 },
  ] },
  { title: 'Characters', items: [
    { text: 'Runners, wolf and shark by Quaternius (quaternius.com)', license: 'CC0', url: CC0 },
    { text: 'Robot by Tomas Laulhe, modified by Don McCurdy', license: 'CC0', url: CC0 },
    { text: '"Bear" by Nyilonelycompany (modified: new animations)', link: 'https://sketchfab.com/3d-models/bear-ce0d5eb86cf5459bb6bd20244cb44b27', license: 'CC BY 4.0', url: CCBY4 },
    { text: 'Boar and scorpion from the Pixor library by Frakassets', license: 'CC0', url: CC0 },
    { text: 'Blasters from the Blaster Kit by Kenney (kenney.nl)', license: 'CC0', url: CC0 },
  ] },
  { title: 'World', items: [
    { text: 'KayKit packs by Kay Lousberg, kits by Kenney (kenney.nl), and farm, nature and pickup models by Quaternius', license: 'CC0', url: CC0 },
    { text: 'Prickly pear, cacti and lighthouse from poly.pizza (MaverickFX, Isa Lousberg, iPoly3D), hay bales from OpenGameArt (Mish7913, carlosjorgereis)', license: 'CC0', url: CC0 },
    pp('Red/White Beach Umbrella', 'S. Paul Michael', '2li3sdSkmCI'), pp('Blue/White Beach Umbrella', 'S. Paul Michael', '1BLLDjRdxoa'),
    pp('Rainbow Beach Umbrella', 'S. Paul Michael', 'cAna-B5z-45'), pp('beach ball', 'the_ normalgamer', '4IwPTeOmq6c'),
    pp('Beach chair', 'Poly by Google', '9TN4PyhWvz1'), pp('Ice box', 'Poly by Google', 'dvu1_2Wlhc0'), pp('Sand castle', 'Poly by Google', '8PJfF1Q0B7T'),
    pp('Lighthouse', 'jeremy', '0SWQTv1whoA'), pp('Surfboard', 'jeremy', '3js4cQ-O-p2'), pp('House', 'Pixel', 'fdaqERLQCc'),
    pp('Boat', 'Poly by Google', '84-DYhLzxNq'), pp('Seashell', 'Poly by Google', '5ovn4mnRejL'), pp('Starfish', 'Poly by Google', '6H-0K9IEr56'),
    pp('Crab', 'Poly by Google', '1O5Q4pE8X6e'), pp('Thatch palm tree', 'Poly by Google', '74GpKCkUqcn'), pp('Lady palm tree', 'Poly by Google', 'e0AbYA90ux5'),
    pp('Prickly pear cactus', 'Poly by Google', '47Af27jQemx'), pp('Cattail', 'Poly by Google', '9vCk81sIPve'), pp('Orange tree', 'Poly by Google', '8zS7mfHS0i7'),
    pp('Apple Tree', 'Jarlan Perez', 'ds595Kl_cWH'), pp('Farm house', 'Poly by Google', 'bHyQe5jzdiQ'), pp('Factory', 'Poly by Google', '2J7L2oILiwP'),
    pp('Haystack', 'Poly by Google', '6LeCqyw00RK'), pp('Scarecrow', 'Poly by Google', '7qFs_DjjuVp'), pp('Dam', 'NateGazzard', 'R17ff2k5aE'),
    pp('Canoe', 'Poly by Google', '3s6Vn4gWYLI'), pp('Container Ship', 'Alex Safayan', '3AmDGcCu6Ll'), pp('Cabin', 'Poly by Google', '1GpgtI-C05M'),
    { text: 'All poly.pizza models above were resized and recolored for the game.' },
  ] },
  { title: 'Icons', items: [
    { text: `game-icons.net by ${ICON_CREDITS.map(c => c.author).join(', ')} (some edited)`, link: 'https://game-icons.net', license: 'CC BY 3.0', url: CCBY3 },
  ] },
  { title: 'Fonts and code', items: [
    { text: 'Lilita One by Juan Montoreano and Fredoka by Milena Brandao (SIL Open Font License)', link: 'https://fonts.google.com' },
    { text: 'three.js (MIT License)', link: 'https://threejs.org' },
  ] },
];

// Fills an element with the credits as headings and short lines with links.
export function renderCredits(box) {
  box.replaceChildren();
  for (const sec of CREDITS) {
    const h = document.createElement('h4');
    h.textContent = sec.title;
    box.append(h);
    for (const it of sec.items) {
      const p = document.createElement('p');
      p.append(it.text);
      if (it.link) { p.append(' ('); const a = Object.assign(document.createElement('a'), { href: it.link, target: '_blank', rel: 'noopener', textContent: 'source' }); p.append(a, ')'); }
      if (it.license) { p.append(', '); const a = Object.assign(document.createElement('a'), { href: it.url, target: '_blank', rel: 'noopener', textContent: it.license }); p.append(a); }
      box.append(p);
    }
  }
}
