const {createPage}=require('./browser-storage.cjs');
const {chromium}=require('playwright');
const fs=require('node:fs');
const assert=require('node:assert/strict');
const html=fs.readFileSync(new URL('../dist/reviewer.html',`file://${__filename}`),'utf8');
const sidebar=async page=>{if(await page.locator('#sidebar').getAttribute('aria-hidden')==='true')await page.locator('#toggleSidebar').click()};
(async()=>{
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
try{
 const page=await createPage(browser,{viewport:{width:1280,height:900},reducedMotion:'reduce'}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('https://reviewer.test/**',r=>r.fulfill({contentType:'text/html',body:html}));await page.goto('https://reviewer.test/reviewer');
 const image=await page.evaluate(()=>{const c=document.createElement('canvas');c.width=300;c.height=160;const x=c.getContext('2d');x.fillStyle='#cde4fa';x.fillRect(0,0,300,160);x.fillStyle='black';x.font='24px sans-serif';x.fillText('Remote image',30,85);return c.toDataURL()});
 const card={id:'remote-card',term:'Remote question',meaning:'Remote answer',options:['a','b','c','d'],answer:0,image,answerImage:image};
 let raw={sets:[{id:'remote-set',title:'Image source',items:[card]}]},status=200;
 await page.route('https://feed.test/**',r=>r.fulfill({status,contentType:'application/json',body:JSON.stringify(raw)}));
 await page.locator('#addSource').click();await page.locator('#sourceName').fill('Feed');await page.locator('#sourceUrl').fill('https://feed.test/cards.json');await page.locator('#sourceSubmit').click();await page.locator('#sources .set-open').waitFor();
 await page.locator('#sources .set-open').click();await page.locator('#items img').first().waitFor();assert.equal(await page.locator('#items img').count(),2);
 await page.locator('#openCards').click();await page.locator('#flip').click();await page.locator('[data-grade="good"]').click();await page.waitForFunction(()=>document.querySelector('#cardCount').textContent==='0 / 0');await page.locator('#cards [data-detail-back]').click();
 await sidebar(page);await page.locator('#showExport').click();const downloading=page.waitForEvent('download');await page.locator('#backup').click();const backup=JSON.parse(fs.readFileSync(await (await downloading).path(),'utf8'));assert.equal(backup.sets[0].items[0].image,image);await page.locator('#exportDialog .dialog-footer button').click();
 const restored=await createPage(browser,{viewport:{width:390,height:844},reducedMotion:'reduce'});restored.on('pageerror',e=>errors.push(e.message));await restored.route('https://reviewer.test/**',r=>r.fulfill({contentType:'text/html',body:html}));await restored.goto('https://reviewer.test/reviewer');await sidebar(restored);
 await restored.locator('#showImport').click();await restored.locator('#jsonInput').fill(JSON.stringify(backup));await restored.locator('#importJson').click();await restored.locator('#confirmAccept').click();await restored.getByText('1セットを取り込みました',{exact:true}).waitFor();
 const restoredState=await restored.evaluate(async()=>window.readTestState());assert.equal(restoredState.sets.length,1);assert.equal(Object.values(restoredState.progress)[0].attempts,1);assert.equal(Object.values(restoredState.progress)[0].cardAttempts,1);
 await restored.locator('#importDialog .dialog-footer [data-close-dialog]').click();await restored.locator('#setGrid .set-open').click();await restored.locator('#items img').first().waitFor();assert.equal(await restored.locator('#items img').count(),2);await restored.reload();assert.equal(await restored.locator('#items img').count(),2);await restored.close();
 // Bad image data must not replace the last good synced set.
 raw={sets:[{id:'remote-set',title:'Broken',items:[{...card,image:'data:image/svg+xml;base64,PHN2Zz4='}]}]};
 await page.locator('#sources .source-group > details > summary').click();await page.locator('[data-sync]').click();await page.getByText(/同期失敗:/).waitFor();
 assert.equal((await page.evaluate(async()=>window.readTestState())).sets[0].title,'Image source');
 status=500;await page.reload();await page.getByText(/同期失敗: HTTP 500/).waitFor();await page.locator('#sources .set-open').click();assert.equal(await page.locator('#items img').count(),2);
 assert.equal(await page.evaluate(async()=>{const db=await new Promise(resolve=>{const r=indexedDB.open('kntt.reviewer',1);r.onsuccess=()=>resolve(r.result)});return new Promise(resolve=>{const r=db.transaction('images').objectStore('images').count();r.onsuccess=()=>{db.close();resolve(r.result)}})}),1,'duplicate front/back images share one stored blob');
 assert.deepEqual(errors,[]);console.log('PASS image URL sync, deduplication, offline cache, atomic validation and portable backup with history');await page.close();
}finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
