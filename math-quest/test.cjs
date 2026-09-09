const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
function load() {
  const file = path.join(__dirname, 'index.html');
  assert.ok(fs.existsSync(file), 'standalone game must exist');
  const html = fs.readFileSync(file, 'utf8');
  const sandbox = { module: { exports: {} }, console };
  const scripts = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)];
  assert.ok(scripts.length, 'game exposes inline engine');
  scripts.forEach(s => vm.runInNewContext(s[1], sandbox));
  return sandbox.module.exports;
}
const plain = x => JSON.parse(JSON.stringify(x));
function seeded(seed) { return () => { seed = (Math.imul(seed,1664525)+1013904223)>>>0; return seed/4294967296; }; }
function oracle(q) {
  const d=q.data;
  const rounded=(n,p)=>{ const low=n-n%p; return n-low>=p/2?low+p:low; };
  switch(q.concept) {
    case 'units': return d.n/d.unit;
    case 'composed': case 'expanded': return d.terms.reduce((a,b)=>a+b,0);
    case 'subtract100': return d.n-100;
    case 'add100': return d.n+100;
    case 'digitValue': return Number(String(d.n).padStart(4,'0')[3-d.position])*10**d.position;
    case 'digitPlace': return ['ones','tens','hundreds','thousands'][d.position];
    case 'wordsToNumber': return d.n;
    case 'numberToWords': return q.answer; // exact word examples checked separately
    case 'compare': return d.left>d.right?'>':d.left<d.right?'<':'=';
    case 'patternDown': case 'patternUp': return d.start+d.step*d.missing;
    case 'order': return [...d.values].sort((a,b)=>a-b);
    case 'roundMulti': return d.values.filter(n=>rounded(n,d.place)===d.target);
    case 'lineInterval': return (d.line.end-d.line.start)/d.line.ticks;
    case 'lineMidpoint': return d.mid*2-d.left;
    case 'lineLocate': return d.markers.find(m=>m.value===d.target).label;
    case 'round10': case 'round100': case 'round1000': case 'context': return rounded(d.n,d.place);
    case 'roundPlace': return ['ten','hundred','thousand'][[10,100,1000].findIndex(p=>rounded(d.n,p)===d.target)];
    default: assert.fail('Unknown concept '+q.concept);
  }
}
test('balanced varied rounds have valid unique choices and independently computed answers', () => {
  const E=load();
  assert.equal(typeof E.buildRound,'function');
  const seen=new Set();
  for(let seed=1;seed<=80;seed++) {
    const round=E.buildRound(seeded(seed));
    assert.equal(round.length,22);
    assert.equal(new Set(round.map(q=>q.concept)).size,22);
    assert.equal(new Set(round.map(q=>q.id)).size,22);
    assert.deepEqual([...new Set(round.map(q=>q.type))].sort(),['mcq','multi','number','order']);
    for(const q of round) {
      seen.add(q.prompt);
      assert.ok(q.strategy.length>15,q.id);
      assert.deepEqual(plain(q.answer),plain(oracle(q)),q.id);
      if(q.choices) {
        assert.equal(new Set(q.choices).size,q.choices.length,q.id);
        for(const a of Array.isArray(q.answer)?q.answer:[q.answer]) assert.ok(q.choices.includes(a),q.id);
      }
    }
  }
  assert.ok(seen.size>200,'ample practice variety');
  const input=[900,1000,90,9999,10000];
  const shuffled=E.shuffle(input,seeded(55));
  assert.deepEqual(input,[900,1000,90,9999,10000]);
  assert.deepEqual([...shuffled].sort((a,b)=>a-b),[90,900,1000,9999,10000]);
});
test('verified guide examples are mathematically correct, including boundary and zero cases', () => {
  const E=load();
  assert.equal(typeof E.buildBank,'function');
  const bank=E.buildBank(seeded(12));
  const cases={
    'units-4300':430,'units-210':2100,'composed-5164':5164,'subtract-9006':8906,
    'value-4':4,'value-6':60,'value-1':100,'value-5':5000,'value-7543':40,'place-6912':'thousands',
    'expanded-3214':3214,'expanded-8206':8206,'words-5005':5005,
    'compare-equal':'=','compare-regroup':'<',
    'down-2':3009,'down-3':2009,'down-5':9,'up-2':4574,'up-3':4674,'up-5':4874,
    'order-guide':[1234,2341,2413,3412,3421],'multi-80':[82,79,75],
    'line-interval':100,'line-midpoint':2500,'line-locate':'D',
    'word-4348':'four thousand, three hundred forty-eight','round-4348':4300,
    'tacos-1995':2000,'round-place-3100':'thousand','round-4683':4680,'round-4521':5000
  };
  for(const [id,answer] of Object.entries(cases)) {
    const q=bank.find(q=>q.id===id);
    assert.ok(q,id);
    assert.deepEqual(plain(q.answer),answer,id);
    assert.deepEqual(plain(q.answer),plain(oracle(q)),id);
  }
  const boundary=bank.find(q=>q.id==='add-995');
  assert.equal(boundary.answer,1095);
  const tricky=E.makeQuestion({id:'tricky',concept:'order',values:[900,1000,90,9999,10000]},seeded(7));
  assert.deepEqual(plain(tricky.answer),[90,900,1000,9999,10000]);
});
test('sixth-page fixtures preserve printed operands, not handwritten answers', () => {
  const bank=load().buildBank(seeded(6));
  const expected=[
    ['round-place-3100',{n:3100,target:3000},'thousand','3,100'],
    ['value-7543',{n:7543,position:1},40,'7,543'],
    ['round-4683',{n:4683,place:10},4680,'4,683'],
    ['round-4521',{n:4521,place:1000},5000,'4,521']
  ];
  for(const [id,data,answer,promptNumber] of expected) {
    const q=bank.find(q=>q.id===id);
    assert.ok(q,id);
    for(const [key,value] of Object.entries(data)) assert.equal(q.data[key],value,id+' '+key);
    assert.equal(q.answer,answer,id);
    assert.ok(q.prompt.includes(promptNumber),id+' prompt');
  }
  assert.equal(bank.some(q=>q.id==='round-place-3103'),false);
});

function readWords(words) {
  const names='zero one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen'.split(' ');
  const values=Object.fromEntries(names.map((name,i)=>[name,i]));
  for(const [name,value] of Object.entries({twenty:20,thirty:30,forty:40,fifty:50,sixty:60,seventy:70,eighty:80,ninety:90})) values[name]=value;
  let total=0,group=0;
  for(const word of words.replace(/[,\-]/g,' ').split(/\s+/)) {
    if(word==='hundred') group*=100;
    else if(word==='thousand') {total+=group*1000;group=0;}
    else {assert.ok(Object.hasOwn(values,word),'recognized spelling: '+word);group+=values[word];}
  }
  return total+group;
}

test('every generated family has correct mathematics and unambiguous prompts across full banks', () => {
  const E=load(), seen=new Set();
  const quantity=text=>text.split(' + ').reduce((sum,part)=>{
    const match=part.match(/^(\d+) (ones|tens|hundreds|thousands)$/);
    assert.ok(match,'quantity phrase: '+part);
    return sum+Number(match[1])*({ones:1,tens:10,hundreds:100,thousands:1000}[match[2]]);
  },0);
  for(let seed=1;seed<=25;seed++) {
    const bank=E.buildBank(seeded(seed));
    assert.equal(bank.length,431);
    assert.equal(new Set(bank.map(q=>q.id)).size,bank.length);
    for(const q of bank) {
      seen.add(q.concept);
      const d=q.data;
      assert.deepEqual(plain(q.answer),plain(oracle(q)),q.id);
      if(q.choices) {
        assert.equal(new Set(q.choices).size,q.choices.length,q.id);
        for(const answer of Array.isArray(q.answer)?q.answer:[q.answer]) assert.ok(q.choices.includes(answer),q.id);
      }
      for(const value of Array.isArray(q.answer)?q.answer:[q.answer]) if(typeof value==='number') assert.ok(Number.isInteger(value)&&value>=0&&value<=10000,q.id);
      if(q.concept==='numberToWords') {
        assert.equal(readWords(q.answer),d.n,q.id);
        assert.equal(q.choices.filter(words=>readWords(words)===d.n).length,1,q.id);
      }
      if(q.concept==='wordsToNumber') assert.equal(readWords(q.prompt.slice('Write in digits: '.length,-1)),d.n,q.id);
      if(q.concept==='compare') {
        assert.equal(quantity(d.leftText),d.left,q.id);
        assert.equal(quantity(d.rightText),d.right,q.id);
      }
      if(q.concept==='composed') assert.equal(quantity(q.prompt.slice('Write as one number: '.length,-1)),q.answer,q.id);
      if(q.concept==='digitPlace') {
        const digit=String(d.n)[3-d.position];
        assert.equal([...String(d.n)].filter(v=>v===digit).length,1,q.id+' unique named digit');
      }
      if(q.concept==='roundPlace') {
        const matches=[10,100,1000].filter(p=>Math.round(d.n/p)*p===d.target);
        assert.equal(matches.length,1,q.id+' one possible rounding place');
      }
      if(q.sequence) for(let i=0;i<6;i++) {
        const value=d.start+d.step*i;
        assert.ok(value>=0&&value<=10000,q.id+' pattern bounds');
        assert.equal(q.sequence[i],i===d.missing?'___':value.toLocaleString('en-US'),q.id);
      }
      if(q.line) {
        const line=q.line,step=(line.end-line.start)/line.ticks;
        assert.ok(step>0&&Number.isInteger(step),q.id+' equal integer intervals');
        for(const point of [...line.labels,...(line.markers||[])]) {
          assert.ok(point.value>=line.start&&point.value<=line.end,q.id+' bounds');
          assert.equal((point.value-line.start)%step,0,q.id+' on tick');
        }
      }
    }
  }
  assert.deepEqual([...seen].sort(),[...E.concepts].sort());
  for(let n=0;n<=10000;n++) assert.equal(readWords(E.toWords(n)),n,'word form '+n);
});

test('scoring locks each answer, follows the streak ladder, and resets on mistakes', () => {
  const E=load();
  assert.equal(typeof E.Game,'function');
  const bank=E.buildBank(seeded(11));
  const q=bank.find(q=>q.id==='subtract-9006');
  const g=new E.Game(Array.from({length:10},(_,i)=>({...q,id:'q'+i})));
  assert.equal(g.next(),false);
  for(const raw of ['', ' ', '8,90']) assert.equal(g.check(raw).status,'incomplete');
  assert.equal(g.correct,0); assert.equal(g.score,0); assert.equal(g.locked,false);
  let total=0;
  for(const points of [10,10,15,15,20,20,25,25]) {
    const out=g.check('8,906'); total+=points;
    assert.equal(out.right,true); assert.equal(out.points,points);
    assert.equal(g.check('1').status,'locked');
    assert.equal(g.score,total);
    assert.equal(g.next(),true); assert.equal(g.next(),false);
  }
  assert.equal(g.correct,8);
  const wrong=g.check('9006');
  assert.equal(wrong.right,false); assert.equal(wrong.answer,'8,906');
  assert.ok(wrong.strategy.includes('hundred'));
  assert.equal(g.streak,0); assert.equal(g.correct,8);
  g.next(); assert.equal(g.check('8906').points,10); g.next();
  assert.equal(g.done,true); assert.equal(g.check('8906').status,'finished');
  assert.equal(g.correct,9); assert.equal(g.missed.length,1);
  const review=g.review();
  assert.deepEqual(plain(review.questions.map(q=>q.id)),['q8']);
  assert.equal(review.isReview,true); assert.equal(review.check('8906').points,0);
  review.next(); assert.equal(review.review().questions.length,0);
  assert.equal(g.correct,9,'review must not rewrite original accuracy');
});
test('all answer modes require deliberate complete valid input and grade the actual game', () => {
  const E=load();
  assert.equal(typeof E.Game,'function');
  const bank=E.buildBank(seeded(2));
  for(const q of bank) {
    const g=new E.Game([q]);
    assert.equal(g.check(q.type==='multi'||q.type==='order'?[]:null).status,'incomplete',q.id);
    const answer=q.type==='number'?String(q.answer):q.answer;
    assert.equal(g.check(answer).right,true,q.id);
    assert.equal(g.correct,1); g.next(); assert.equal(g.done,true);
  }
  const multi=bank.find(q=>q.id==='multi-80');
  assert.equal(new E.Game([multi]).check([75,82,79]).right,true);
  assert.equal(new E.Game([multi]).check([75,82]).right,false);
  assert.equal(new E.Game([multi]).check([75,82,79,85]).right,false);
  assert.equal(new E.Game([multi]).check([75,75,75]).status,'incomplete');
  const order=bank.find(q=>q.id==='order-guide');
  assert.equal(new E.Game([order]).check([1234]).status,'incomplete');
  assert.equal(new E.Game([order]).check([...order.answer].reverse()).right,false);
  const mcq=bank.find(q=>q.id==='compare-equal');
  assert.equal(new E.Game([mcq]).check('bogus').status,'incomplete');
});
test('best score is scoped and survives unavailable or corrupt storage', () => {
  const E=load();
  assert.equal(typeof E.createBestStore,'function');
  const values=new Map();
  const store=E.createBestStore({getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v)});
  assert.equal(store.get(),0); assert.equal(store.save(100),100); assert.equal(store.save(50),100);
  assert.deepEqual([...values.keys()],['number-quest:v1:best']);
  assert.equal(E.createBestStore({getItem:()=>'-9'}).get(),0);
  assert.equal(E.createBestStore({getItem:()=>'NaN'}).get(),0);
  const denied=E.createBestStore({getItem(){throw Error('denied');},setItem(){throw Error('denied');}});
  assert.equal(denied.get(),0); assert.equal(denied.save(40),40); assert.equal(denied.get(),40);
  assert.equal(E.createBestStore(null).save(25),25);
});
test('numeric input, rounding and word forms handle zero placeholders and ties', () => {
  const E = load();
  for (const [raw, expected] of [['4,348',4348],[' 9,006 ',9006],['10000',10000],['0',0]]) assert.equal(E.parseNumber(raw),expected);
  for (const raw of ['', ' ', '1,99', '1,,000', '4 348', '1e3', '3.5', '-2', 'cat']) assert.equal(E.parseNumber(raw),null,raw);
  for (const [n,p,a] of [[1995,10,2000],[4348,100,4300],[3103,1000,3000],[85,10,90],[75,10,80],[9999,1000,10000]]) assert.equal(E.roundTo(n,p),a);
  assert.equal(E.toWords(4348),'four thousand, three hundred forty-eight');
  assert.equal(E.toWords(5005),'five thousand, five');
  assert.equal(E.toWords(10000),'ten thousand');
  assert.equal(E.toWords(40),'forty');
  assert.equal(E.toWords(0),'zero');
});
