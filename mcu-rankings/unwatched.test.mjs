import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import * as core from './core.js';
import { renderLists } from './view.js';
const catalog=JSON.parse(await readFile(new URL('./catalog.json',import.meta.url)));
test('main page puts every unwatched movie in a separate bottom section with a watched action',()=>{
 const state=core.createState(catalog),html=renderLists(state,catalog);
 assert.match(html,/id="unwatched-zone"/);
 assert.ok(html.indexOf('id="unwatched-zone"')>html.indexOf('</ol>'));
 assert.ok(/id="unwatched-heading"[^>]*>Unwatched/.test(html));
 assert.match(html,/Everyone.*personal lists/);
 const remaining=catalog.filter(m=>!m.watched);
 assert.equal((html.match(/data-action="watched-add"/g)||[]).length,remaining.length);
 for(const movie of remaining)assert.ok(html.includes(`data-id="${movie.id}"`));
});
test('unwatched drop requires pointer inside the section, not just below the ranking',()=>{
 const box={left:20,right:320,top:400,bottom:900};
 assert.equal(core.isUnwatchedDrop(box,100,450),true);
 assert.equal(core.isUnwatchedDrop(box,100,399),false);
 assert.equal(core.isUnwatchedDrop(box,10,450),false);
 assert.equal(core.isUnwatchedDrop(box,100,901),false);
 assert.equal(core.isUnwatchedDrop(null,100,450),false);
});
