const {createPage}=require('./browser-storage.cjs');
const {chromium}=require('playwright');
const fs=require('node:fs');
const assert=require('node:assert/strict');
(async()=>{
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
try{
for(const viewport of [{width:1440,height:1000},{width:390,height:844}]){
 const page=await createPage(browser,{viewport,reducedMotion:'reduce'}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('https://reviewer.test/**',r=>r.fulfill({contentType:'text/html',body:fs.readFileSync(new URL('../dist/reviewer.html',`file://${__filename}`),'utf8')}));
 await page.goto('https://reviewer.test/reviewer');
 assert.deepEqual(await page.locator('.dashboard-metric strong').allTextContents(),['0','0','0','0']);assert.equal(await page.locator('.github-link').getAttribute('href'),'https://github.com/kntt32/reviewer');
 await page.evaluate(async()=>{
 const card=id=>({id,term:id,meaning:'meaning',explanation:'Example explanation',options:['a','b','c','d'],answer:0});
 localStorage.setItem('kntt.reviewer.v2',JSON.stringify({sets:[{id:'s',title:'English',items:['c0','c1','c2'].map(card)},{id:'new',title:'New subject',items:[card('new')]}],progress:{'s/c0':{attempts:2,correct:1,lapses:1,quizAttempts:1,cardAttempts:1,due:1000},'s/c1':{attempts:3,correct:3,lapses:0,due:Date.now()+86400000}},sessions:{s:{quiz:{current:'c0',queue:['c1','c2'],order:[0,1,2,3],answered:null,total:3,seen:['c0'],wrong:[],right:0,scope:'all'}}}}));
 });
 await page.reload();assert.deepEqual(await page.locator('.dashboard-metric strong').allTextContents(),['5','1','1','2']);assert.equal(await page.locator('#dashboardHistoryNote').count(),0);
 assert.equal(await page.locator('.dashboard-recommendation h3').first().innerText(),'English');assert.equal(await page.locator('.dashboard-weak-card').count(),1);
 assert.equal(await page.evaluate(async()=>document.documentElement.scrollWidth>innerWidth),false);
 await page.locator('[data-dashboard-open="s"]').click();await page.locator('#quiz.active').waitFor();await page.locator('[data-answer="0"]').click();
 await page.locator('#quiz [data-detail-back]').click();
 const sidebar=async()=>{if(await page.locator('#sidebar').getAttribute('aria-hidden')==='true')await page.locator('#toggleSidebar').click()};
 await sidebar();await page.locator('#homeLink').click();assert.deepEqual(await page.locator('.dashboard-metric strong').allTextContents(),['6','2','1','2']);
 if(viewport.width<=760)await page.locator('#toggleSidebar').click();
 await page.locator('[data-dashboard-card="c0"]').click();await page.locator('#list.active').waitFor();assert.equal(await page.locator('[data-card-id="c0"] h3').innerText(),'c0');assert.equal(await page.locator('dialog[open]').count(),0);
 await page.locator('#openCards').click();await page.locator('#flip').click();await page.locator('[data-grade="good"]').click();await page.locator('#cards [data-detail-back]').click();
 await sidebar();await page.locator('#homeLink').click();assert.deepEqual(await page.locator('.dashboard-metric strong').allTextContents(),['7','2','2','2']);
 await page.locator('#showExport').click();await page.locator('#reset').click();await page.locator('#confirmAccept').click();await page.locator('#exportDialog .dialog-footer button').click();
 assert.deepEqual(await page.locator('.dashboard-metric strong').allTextContents(),['0','0','0','0']);assert.equal(await page.locator('#dashboardHistoryNote').count(),0);assert.equal(await page.locator('.dashboard-weak-card').count(),0);
 await page.reload();assert.deepEqual(await page.locator('.dashboard-metric strong').allTextContents(),['0','0','0','0']);assert.deepEqual(errors,[]);
 console.log('PASS dashboard totals, legacy history, resume recommendation, weak-card navigation, grading counters and reset:',viewport.width);await page.close();
}
}finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
