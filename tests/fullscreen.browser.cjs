const {chromium}=require('playwright');
const fs=require('node:fs');
const assert=require('node:assert/strict');
(async()=>{
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
try{
for(const viewport of [{width:1280,height:800},{width:390,height:640},{width:820,height:360}]){
 const page=await browser.newPage({viewport,reducedMotion:'reduce'}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('https://reviewer.test/**',r=>r.fulfill({contentType:'text/html',body:fs.readFileSync(new URL('../dist/reviewer.html',`file://${__filename}`),'utf8')}));
 await page.goto('https://reviewer.test/reviewer');
 await page.evaluate(()=>localStorage.setItem('kntt.reviewer.v2',JSON.stringify({sets:[{id:'s',title:'English',items:[{id:'c',term:'term',meaning:'meaning',options:['a','b','c','d'],answer:0}]}],progress:{}})));
 await page.reload();const mobile=viewport.width<=760;if(mobile)await page.locator('#toggleSidebar').click();await page.locator('[data-open="s"]').click();
 async function checkStudy(id){
 assert.equal(await page.locator('#sidebar').isVisible(),false);assert.equal(await page.locator('.workspace-header').isVisible(),false);
 assert.equal(await page.locator('#sidebar').evaluate(e=>e.inert),true);assert.equal(await page.locator('.right-pane').evaluate(e=>e.inert),false);
 const box=await page.locator('.right-pane').boundingBox();assert.equal(box.x,0);assert.equal(box.y,0);assert.equal(box.width,viewport.width);assert.equal(box.height,viewport.height);
 assert.ok(await page.locator('#'+id+'.active').isVisible());
 }
 await page.locator('#openCards').click();await checkStudy('cards');await page.locator('#flip').click();
 const grades=await page.locator('#grades').boundingBox();assert.ok(grades.y+grades.height<=viewport.height);
 await page.reload();await checkStudy('cards');assert.match(await page.locator('#flash').innerText(),/meaning/);
 await page.locator('#cards [data-detail-back]').click();assert.equal(await page.locator('.workspace-header').isVisible(),true);assert.equal(await page.locator('#sidebar').isVisible(),!mobile);
 if(!mobile)await page.locator('#toggleSidebar').click();
 await page.locator('#openQuiz').click();await page.locator('#startQuiz').click();await checkStudy('quiz');await page.locator('[data-answer="0"]').click();await page.reload();await checkStudy('quiz');await page.locator('#continue').waitFor();
 await page.keyboard.press('Escape');assert.equal(await page.locator('#list.active').isVisible(),true);assert.equal(await page.locator('#sidebar').isVisible(),false);assert.equal(await page.locator('.workspace-header').isVisible(),true);
 await page.locator('#toggleSidebar').click();assert.equal(await page.locator('#sidebar').isVisible(),true);
 assert.deepEqual(errors,[]);console.log('PASS full-viewport study, reload, visible controls and restored sidebar preferences:',viewport.width,viewport.height);await page.close();
}
}finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
