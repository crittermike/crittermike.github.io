// Optional browser QA. Runtime game itself has no dependencies.
// NODE_PATH=/tmp/math-quest-qa/node_modules node math-quest/browser-test.cjs
const { chromium } = require('playwright-core');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
(async () => {
  const browser = await chromium.launch({headless:true,timeout:15000,executablePath:process.env.CHROMIUM_PATH || '/root/.cache/ms-playwright/chromium_headless_shell-1228/chrome-headless-shell-linux64/chrome-headless-shell',args:['--no-sandbox']});
  const page = await browser.newPage({viewport:{width:375,height:812},reducedMotion:'reduce'});
  page.setDefaultTimeout(15000);
  const url=process.env.GAME_URL || 'file://'+path.join(__dirname,'index.html');
  const errors=[],network=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('request',r=>{if(/^https?:/.test(r.url()))network.push(r.url());});
  try {
    await page.goto(url);
    assert.equal(await page.locator('#start').count(),1,'working game has a start button');
    await page.locator('#start').click();
    assert.equal(await page.locator('#check').isVisible(),true);
    assert.equal(await page.locator('#next').isVisible(),false);
    await page.locator('#check').click();
    assert.equal(await page.evaluate(()=>MathQuest.ui.getGame().locked),false,'blank check does not consume question');
    assert.ok((await page.locator('#feedback').textContent()).length>0);
    const noOverflow = async () => assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'no mobile horizontal overflow');
    async function answer(q,wrong=false) {
      if(q.type==='number') await page.locator('#number').fill(wrong?'999999':Number(q.answer).toLocaleString('en-US'));
      else {
        const values=wrong?[q.choices.find(v=>Array.isArray(q.answer)?!q.answer.includes(v):v!==q.answer)]:Array.isArray(q.answer)?q.answer:[q.answer];
        for(const v of values) await page.locator('#choices button').filter({hasText:new RegExp('^'+String(typeof v==='number'?v.toLocaleString('en-US'):v).replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'$')}).click();
      }
      await page.locator('#check').click();
      assert.equal(await page.locator('#check').isDisabled(),true);
      assert.equal(await page.locator('#next').isVisible(),true);
      await noOverflow();
    }
    // Exercise fresh generated questions across every taught concept.
    await page.evaluate(()=>MathQuest.ui.start(MathQuest.buildRound()));
    const fixtureIds=await page.evaluate(()=>MathQuest.ui.getGame().questions.map(q=>q.id));
    assert.equal(fixtureIds.length,22);
    assert.ok(fixtureIds.every(id=>id.includes('-practice-')));
    let count=0,numberLines=0;
    while(!await page.evaluate(()=>MathQuest.ui.getGame().done)) {
      const q=await page.evaluate(()=>MathQuest.ui.getGame().current);
      if(q.line) {
        numberLines++;
        assert.equal(await page.locator('#visual svg').count(),1);
        assert.ok(await page.locator('#visual svg line').count()>10);
      }
      if(q.type==='order') {
        await page.locator('#choices button').first().click();
        await page.locator('#undo').click();
        assert.equal(await page.locator('#ordered li').count(),0);
        await page.locator('#choices button').first().click();
        await page.locator('#clear').click();
        assert.equal(await page.locator('#ordered li').count(),0);
      }
      await answer(q);
      assert.equal(await page.evaluate(()=>MathQuest.ui.getGame().correct),++count,q.id);
      // A second CHECK dispatch cannot award again or advance.
      const lockedScore=await page.evaluate(()=>MathQuest.ui.getGame().score);
      await page.locator('#check').dispatchEvent('click');
      assert.equal(await page.evaluate(()=>MathQuest.ui.getGame().correct),count);
      assert.equal(await page.evaluate(()=>MathQuest.ui.getGame().score),lockedScore);
      assert.equal(await page.evaluate(()=>MathQuest.ui.getGame().index),count-1);
      await page.locator('#next').click();
    }
    assert.ok(numberLines>=3);
    assert.equal(await page.locator('#finish').isVisible(),true);
    assert.ok((await page.locator('#finalAccuracy').textContent()).includes(`${count} / ${count}`));
    assert.equal(await page.locator('#review').isVisible(),false);
    await page.locator('#again').click();
    assert.equal(await page.evaluate(()=>MathQuest.ui.getGame().questions.length),22);
    // A normal balanced round with one miss; finish, review only that miss, replay.
    let originalId, expected=0,streak=0;
    for(let i=0;i<22;i++) {
      const q=await page.evaluate(()=>MathQuest.ui.getGame().current);
      const wrong=q.type==='number'&&!originalId;
      if(wrong) {originalId=q.id;streak=0;} else {streak++; expected+=10+(streak>=7?15:streak>=5?10:streak>=3?5:0);}
      await answer(q,wrong);
      assert.equal(await page.evaluate(()=>MathQuest.ui.getGame().streak),streak);
      assert.ok((await page.locator('#score').textContent()).includes(`${expected} points`));
      assert.ok((await page.locator('#streak').textContent()).endsWith(String(streak)));
      if(wrong) { assert.ok((await page.locator('#feedback').textContent()).includes('Correct answer:')); }
      await page.locator('#next').click();
    }
    assert.equal(await page.evaluate(()=>MathQuest.ui.getGame().correct),21);
    assert.equal(await page.evaluate(()=>MathQuest.ui.getGame().score),expected);
    await page.locator('#review').click();
    assert.deepEqual(await page.evaluate(()=>MathQuest.ui.getGame().questions.map(q=>q.id)),[originalId]);
    const reviewQ=await page.evaluate(()=>MathQuest.ui.getGame().current);
    await answer(reviewQ);
    assert.equal(await page.evaluate(()=>MathQuest.ui.getGame().score),0);
    await page.locator('#next').click();
    assert.equal(await page.locator('#review').isVisible(),false);
    await page.locator('#again').click();
    assert.equal(await page.evaluate(()=>MathQuest.ui.getGame().correct),0);
    assert.deepEqual(await page.evaluate(()=>{
      const g=MathQuest.ui.getGame();return {score:g.score,streak:g.streak,index:g.index,missed:g.missed.length,locked:g.locked,review:g.isReview};
    }),{score:0,streak:0,index:0,missed:0,locked:false,review:false});
    assert.equal(await page.locator('#feedback').textContent(),'');
    assert.equal(await page.locator('#next').isVisible(),false);
    // Native keyboard controls and explicit CHECK then NEXT.
    await page.evaluate(()=>MathQuest.ui.start([MathQuest.buildBank().find(q=>q.concept==='wordsToNumber')]));
    for(const raw of ['', ' ', '5,00', '1e3', '-1', '5.5']) {
      await page.locator('#number').fill(raw);
      await page.locator('#check').click();
      assert.equal(await page.evaluate(()=>MathQuest.ui.getGame().locked),false,raw);
      assert.equal(await page.evaluate(()=>MathQuest.ui.getGame().score),0,raw);
      assert.equal(await page.locator('#number').getAttribute('aria-invalid'),'true');
    }
    await page.locator('#number').fill('');
    await page.locator('#number').focus();
    await page.keyboard.type(await page.evaluate(()=>String(MathQuest.ui.getGame().current.answer)));
    await page.keyboard.press('Enter');
    assert.equal(await page.evaluate(()=>MathQuest.ui.getGame().correct),1);
    await page.locator('#next').focus(); await page.keyboard.press('Enter');
    assert.equal(await page.locator('#finish').isVisible(),true);
    await noOverflow();
    // Representative line screenshot for human inspection, outside the repository.
    await page.evaluate(()=>MathQuest.ui.start([MathQuest.buildBank().find(q=>q.concept==='lineLocate')]));
    await page.screenshot({path:process.env.SCREENSHOT_PATH||'/tmp/number-quest-mobile.png',fullPage:true});
    await page.setViewportSize({width:1280,height:900});
    await noOverflow();
    await page.screenshot({path:process.env.DESKTOP_SCREENSHOT_PATH||'/tmp/number-quest-desktop.png',fullPage:true});
    assert.deepEqual(errors,[]); assert.deepEqual(network,/^https?:/.test(url)?[url]:[]);
    // Storage getter itself may throw in privacy-restricted browsers.
    const denied=await browser.newPage();
    denied.setDefaultTimeout(15000);
    denied.on('pageerror',e=>errors.push(e.message));
    await denied.addInitScript(()=>Object.defineProperty(window,'localStorage',{get(){throw Error('denied');}}));
    await denied.goto(url);
    await denied.locator('#start').click();
    assert.equal(await denied.locator('#check').isVisible(),true);
    await denied.evaluate(()=>MathQuest.ui.start([MathQuest.buildBank().find(q=>q.concept==='round10')]));
    await denied.locator('#number').fill(await denied.evaluate(()=>String(MathQuest.ui.getGame().current.answer)));
    await denied.locator('#check').click();
    await denied.locator('#next').click();
    assert.equal(await denied.locator('#finish').isVisible(),true);
    assert.equal(await denied.locator('#best').textContent(),'Best quest: 10 points');
    await denied.locator('#again').click();
    assert.equal(await denied.locator('#best').textContent(),'Best quest: 10 points');
    assert.equal(await denied.evaluate(()=>MathQuest.ui.getGame().score),0);
    assert.deepEqual(errors,[]);
    await denied.close();
    console.log(JSON.stringify({result:'PASS',url,generatedFlows:count,balancedRoundQuestions:22,numberLines,viewports:['375x812','1280x900'],review:true,keyboard:true,reset:true,invalidInput:true,storageDenied:true,pageErrors:errors.length,networkRequests:network.length}));
  } catch(e) {
    console.error('BROWSER STATE',await page.evaluate(()=>({game:MathQuest.ui.getGame(),nextHidden:document.getElementById('nextActions').hidden,feedback:document.getElementById('feedback').textContent})),errors);
    await page.screenshot({path:'/tmp/number-quest-failure.png',fullPage:true});
    throw e;
  } finally { await browser.close(); }
})().catch(e=>{console.error(e);process.exitCode=1;});
