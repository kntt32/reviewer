// Run with NODE_PATH pointing to an installed Playwright package.
const {chromium}=require('playwright');
const fs=require('node:fs');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
 try{
 const page=await browser.newPage({viewport:{width:390,height:844},reducedMotion:'reduce'});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('https://reviewer.test/**',r=>r.fulfill({contentType:'text/html',body:fs.readFileSync(new URL('../dist/reviewer.html',`file://${__filename}`),'utf8')}));
 await page.goto('https://reviewer.test/reviewer.html');
 await page.evaluate(()=>localStorage.setItem('kntt.reviewer.v2',JSON.stringify({sets:[{id:'s',title:'Resume',items:[0,1,2].map(i=>({id:'c'+i,term:'term'+i,meaning:'meaning'+i,options:['a','b','c','d'],answer:0}))}],progress:{}})));
 await page.reload();await page.locator('[data-open="s"]').click();await page.locator('#openCards').click();
 await page.locator('#shuffle').click();await page.locator('#next').click();await page.locator('#flip').click();
 const text=await page.locator('#flash').innerText();await page.reload();
 assert.equal(await page.locator('#flash').innerText(),text);assert.equal(await page.locator('#cardCount').innerText(),'2 / 3');
 await page.locator('[data-grade="good"]').click();await page.reload();assert.equal(await page.locator('#cardCount').innerText(),'2 / 2');
 await page.locator('[data-detail-back]').first().click();await page.locator('#openQuiz').click();await page.locator('#startQuiz').click();
 const question=await page.locator('#feedback').innerText(),order=await page.locator('#quizAnswers').innerText();
 await page.reload();assert.equal(await page.locator('#feedback').innerText(),question);assert.equal(await page.locator('#quizAnswers').innerText(),order);
 await page.locator('[data-answer="1"]').click();
 const attempts=await page.evaluate(()=>Object.values(JSON.parse(localStorage.getItem('kntt.reviewer.v2')).progress).reduce((a,p)=>a+p.attempts,0));
 await page.reload();await page.locator('#continue').waitFor();assert.match(await page.locator('#feedback').innerText(),/不正解/);
 assert.equal(await page.evaluate(()=>Object.values(JSON.parse(localStorage.getItem('kntt.reviewer.v2')).progress).reduce((a,p)=>a+p.attempts,0)),attempts);
 for(let i=0;i<4;i++){
 await page.locator('#continue').click();
 if(await page.locator('#restart').count())break;
 await page.locator('[data-answer="0"]').click();
 }
 await page.locator('#restart').waitFor();await page.reload();await page.locator('#restart').waitFor();
 assert.match(await page.locator('#quizBody').innerText(),/初回正解 2 \/ 3/);assert.deepEqual(errors,[]);
 console.log('PASS: shuffled flashcard position/reveal/remaining deck and quiz question/options/feedback/retries/results survive reload without double grading');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
