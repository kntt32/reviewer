const {chromium}=require('playwright');
const fs=require('node:fs');
const assert=require('node:assert/strict');
(async()=>{
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
try{
for(const viewport of [{width:1280,height:800},{width:390,height:640}]){
 const page=await browser.newPage({viewport,reducedMotion:'reduce'}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('dialog',async d=>{errors.push('Native dialog');await d.dismiss()});
 const html=fs.readFileSync(new URL('../dist/reviewer.html',`file://${__filename}`),'utf8');
 await page.route('https://reviewer.test/**',r=>r.fulfill({contentType:'text/html',body:html}));
 const card={id:'c',term:'term',meaning:'meaning',options:['a','b','c','d'],answer:0};
 await page.route('https://feed.test/**',r=>r.fulfill({contentType:'application/json',body:JSON.stringify({sets:[{id:'remote',title:'Remote',items:[card]}]})}));
 await page.goto('https://reviewer.test/reviewer');
 await page.evaluate(card=>localStorage.setItem('kntt.reviewer.v2',JSON.stringify({sets:[{id:'a',title:'Alpha',items:[card]},{id:'b',title:'Beta',items:[card]}],progress:{'a/c':{attempts:1},'b/c':{attempts:2}},sessions:{b:{cards:{ids:['c'],pos:0,reveal:true,scope:'all'}}},sources:[{id:'feed',name:'Feed',url:'https://feed.test/data.json',cardIds:{}}]})),card);
 await page.reload();await page.locator('#sources [data-set-menu]').waitFor({state:'attached'});
 const mobile=viewport.width<=760;
 const openSidebar=async()=>{if(await page.locator('#sidebar').getAttribute('aria-hidden')==='true')await page.locator('#toggleSidebar').click()};
 await openSidebar();await page.locator('[data-open="a"]').click();await openSidebar();
 await page.locator('[data-set-menu="b"]').click();assert.equal(await page.locator('#setTitle').innerText(),'Alpha');
 const downloadPromise=page.waitForEvent('download');await page.locator('#exportSetAction').click();
 const download=await downloadPromise,data=JSON.parse(fs.readFileSync(await download.path(),'utf8'));
 assert.equal(data.sets.length,1);assert.equal(data.sets[0].title,'Beta');assert.equal(data.sets[0].items.length,1);assert.equal('id' in data.sets[0].items[0],false);assert.equal('progress' in data,false);
 await page.locator('[data-set-menu="b"]').click();await page.locator('#renameSetAction').click();await page.locator('#renameInput').fill('Renamed');await page.locator('#renameForm .primary').click();
 assert.equal(await page.locator('[data-open="b"] h3').innerText(),'Renamed');assert.equal(await page.locator('#setTitle').innerText(),'Alpha');
 assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('kntt.reviewer.v2')).progress['b/c'].attempts),2);
 await page.locator('[data-set-menu="b"]').click();await page.locator('#deleteSetAction').click();await page.locator('#confirmCancel').click();assert.equal(await page.locator('[data-open="b"]').count(),1);
 await page.locator('[data-set-menu="b"]').click();await page.locator('#deleteSetAction').click();await page.locator('#confirmAccept').click();await page.waitForFunction(()=>!JSON.parse(localStorage.getItem('kntt.reviewer.v2')).sets.some(s=>s.id==='b'));
 assert.equal(await page.locator('#setTitle').innerText(),'Alpha');assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('kntt.reviewer.v2')).progress['a/c'].attempts),1);assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('kntt.reviewer.v2')).sessions.b),undefined);
 await page.locator('#sources [data-set-menu]').click();await page.locator('#renameSetAction').click();await page.locator('#renameInput').fill('My web set');await page.locator('#renameForm .primary').click();
 await page.reload();await openSidebar();await page.waitForFunction(()=>document.querySelector('#sources .source-meta')?.textContent.includes('最終同期'));
 assert.equal(await page.locator('#sources .set-open h3').innerText(),'My web set');
 await page.locator('#sources [data-set-menu]').click();await page.locator('#deleteSetAction').click();await page.locator('#confirmAccept').click();await page.waitForFunction(()=>!JSON.parse(localStorage.getItem('kntt.reviewer.v2')).sets.some(s=>s.sourceId==='feed'));
 await page.reload();await openSidebar();await page.waitForFunction(()=>document.querySelector('#sources .source-meta')?.textContent.includes('最終同期'));assert.equal(await page.locator('#sources .set-open').count(),0);
 // Deleting the selected set returns to the unselected workspace.
 await page.locator('[data-set-menu="a"]').click();await page.locator('#deleteSetAction').click();await page.locator('#confirmAccept').click();await page.locator('#sets.active').waitFor();
 assert.deepEqual(errors,[]);console.log('PASS set menu: target-only export, rename, cancel/delete, history isolation, remote sync overrides and dismissal:',viewport.width);
 await page.close();
}
}finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
