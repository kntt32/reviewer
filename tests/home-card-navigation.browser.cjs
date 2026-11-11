const {chromium}=require('playwright');
const fs=require('node:fs');
const assert=require('node:assert/strict');
(async()=>{
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
try{
for(const viewport of [{width:1280,height:800},{width:390,height:844}]){
 const page=await browser.newPage({viewport,reducedMotion:viewport.width===390?'no-preference':'reduce'}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('https://reviewer.test/**',r=>r.fulfill({contentType:'text/html',body:fs.readFileSync(new URL('../dist/reviewer.html',`file://${__filename}`),'utf8')}));
 await page.goto('https://reviewer.test/reviewer');
 await page.evaluate(()=>{
 const cards=Array.from({length:32},(_,i)=>({id:'c'+i,term:'Card '+i,meaning:'Meaning '+i,options:['a','b','c','d'],answer:0}));
 localStorage.setItem('kntt.reviewer.v2',JSON.stringify({sets:[{id:'s',title:'Target set',items:cards},{id:'other',title:'Other set',items:[{...cards[0],id:'other'}]}],progress:{'s/c24':{attempts:3,correct:0,lapses:3}}}));
 });
 await page.reload();
 // Old search/filter state must not hide the destination.
 await page.locator('#search').evaluate(e=>e.value='not matching');await page.locator('#filter').evaluate(e=>e.value='weak');
 assert.equal(await page.locator('.dashboard-weak-actions').count(),0);assert.doesNotMatch(await page.locator('#dashboardWeakCards').innerText(),/つまずき|解説を見る/);
 await page.locator('[data-dashboard-card="c24"]').click();await page.locator('#list.active').waitFor();
 await page.waitForFunction(()=>{
 const item=document.querySelector('[data-card-id="c24"]'),pane=document.getElementById('workspace');if(!item)return false;
 const a=item.getBoundingClientRect(),b=pane.getBoundingClientRect();return a.top>=b.top&&a.bottom<=b.bottom&&pane.scrollTop>100;
 });
 assert.equal(await page.locator('#setTitle').innerText(),'Target set');assert.equal(await page.locator('#search').inputValue(),'');assert.equal(await page.locator('#filter').inputValue(),'all');assert.equal(await page.locator('dialog[open]').count(),0);
 assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('kntt.reviewer.v2')).progress['s/c24'].attempts),3);assert.deepEqual(errors,[]);
 console.log('PASS weak-card row opens its set, clears stale filters and scrolls to an offscreen card without a dialog:',viewport.width);await page.close();
}
}finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
