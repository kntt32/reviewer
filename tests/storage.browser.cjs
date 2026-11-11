const {createPage}=require('./browser-storage.cjs');
const {chromium}=require('playwright');
const fs=require('node:fs');
const assert=require('node:assert/strict');
const html=fs.readFileSync(new URL('../dist/reviewer.html',`file://${__filename}`),'utf8');
(async()=>{
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
try{
 const page=await createPage(browser,{viewport:{width:1280,height:900},reducedMotion:'reduce'}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{window.failWrites=localStorage.getItem('simulateFailure')==='yes';const put=IDBObjectStore.prototype.put;IDBObjectStore.prototype.put=function(...args){if(window.failWrites&&this.name==='state')throw new DOMException('Full','QuotaExceededError');return put.apply(this,args)}});
 await page.route('https://reviewer.test/**',r=>r.fulfill({contentType:'text/html',body:html}));await page.goto('https://reviewer.test/reviewer');
 const legacy=await page.evaluate(async()=>{const c=document.createElement('canvas');c.width=16;c.height=16;c.getContext('2d').fillRect(0,0,16,16);return {sets:[{id:'s',title:'Legacy',items:[{id:'c',term:'old',meaning:'meaning',options:['a','b','c','d'],answer:0,image:c.toDataURL()}]}],progress:{'s/c':{attempts:3,correct:2,lapses:1}}}});
 await page.evaluate(async value=>{localStorage.setItem('kntt.reviewer.v2',JSON.stringify(value));localStorage.setItem('simulateFailure','yes')},legacy);await page.reload();
 assert.equal(await page.locator('#storageStatus').isVisible(),true);assert.deepEqual(await page.evaluate(async()=>JSON.parse(localStorage.getItem('kntt.reviewer.v2'))),legacy,'failed migration keeps original localStorage data');
 assert.equal((await page.evaluate(async()=>window.readTestState())).sets.length,0);
 assert.equal(await page.evaluate(async()=>{const db=await new Promise(resolve=>{const r=indexedDB.open('kntt.reviewer',1);r.onsuccess=()=>resolve(r.result)});return new Promise(resolve=>{const r=db.transaction('images').objectStore('images').count();r.onsuccess=()=>{db.close();resolve(r.result)}})}),0,'failed transaction commits neither metadata nor blobs');
 await page.evaluate(async()=>localStorage.removeItem('simulateFailure'));await page.reload();assert.equal(await page.locator('#storageStatus').isVisible(),false);assert.equal(await page.evaluate(async()=>localStorage.getItem('kntt.reviewer.v2')),null);assert.equal((await page.evaluate(async()=>window.readTestState())).progress['s/c'].attempts,3);
 await page.evaluate(()=>window.failWrites=true);await page.locator('#newSet').click();await page.locator('#createTitle').fill('Unsaved set');await page.locator('#createForm .primary').click();await page.locator('#storageStatus').waitFor();
 assert.equal((await page.evaluate(async()=>window.readTestState())).sets.length,1,'failed write retains the last committed state');
 const downloading=page.waitForEvent('download');await page.locator('#storageBackup').click();const backup=JSON.parse(fs.readFileSync(await (await downloading).path(),'utf8'));assert.equal(backup.sets.length,2,'backup recovers current in-memory changes');assert.match(backup.sets[0].items[0].image,/^data:image\/png;base64,/);
 await page.evaluate(()=>window.failWrites=false);await page.locator('#storageRetry').click();await page.locator('#storageStatus').waitFor({state:'hidden'});assert.equal((await page.evaluate(async()=>window.readTestState())).sets.length,2);
 await page.reload();assert.equal((await page.evaluate(async()=>window.readTestState())).sets.length,2);assert.deepEqual(errors,[]);console.log('PASS atomic legacy migration, original-data retention on quota failure, in-memory backup and retry recovery');await page.close();
}finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
