const {createPage}=require('./browser-storage.cjs');
const {chromium}=require('playwright');
const fs=require('node:fs');
const assert=require('node:assert/strict');
const html=fs.readFileSync(new URL('../dist/reviewer.html',`file://${__filename}`),'utf8');
async function assetCount(page){return page.evaluate(async()=>{const db=await new Promise((resolve,reject)=>{const r=indexedDB.open('kntt.reviewer',1);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)});return new Promise(resolve=>{const r=db.transaction('images').objectStore('images').count();r.onsuccess=()=>{db.close();resolve(r.result)}})})}
async function sidebar(page){if(await page.locator('#sidebar').getAttribute('aria-hidden')==='true')await page.locator('#toggleSidebar').click()}
async function fileData(page,label,color){return page.evaluate(async({label,color})=>{const c=document.createElement('canvas');c.width=3600;c.height=2400;const x=c.getContext('2d'),g=x.createLinearGradient(0,0,c.width,c.height);g.addColorStop(0,color);g.addColorStop(1,'white');x.fillStyle=g;x.fillRect(0,0,c.width,c.height);x.fillStyle='black';x.font='160px sans-serif';x.fillText(label,180,400);return c.toDataURL('image/png')},{label,color})}
(async()=>{
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
try{
for(const viewport of [{width:1280,height:900},{width:390,height:844}]){
 const page=await createPage(browser,{viewport,reducedMotion:'reduce'}),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',async d=>{errors.push('Native dialog');await d.dismiss()});
 await page.addInitScript(()=>{window.imageWrites=0;const put=IDBObjectStore.prototype.put;IDBObjectStore.prototype.put=function(...args){if(this.name==='images')window.imageWrites++;return put.apply(this,args)}});
 await page.route('https://reviewer.test/**',r=>r.fulfill({contentType:'text/html',body:html}));await page.goto('https://reviewer.test/reviewer');
 const front=await fileData(page,'Question image','#b7d6ee'),back=await fileData(page,'Answer image','#c9e7c9');
 await page.evaluate(async()=>localStorage.setItem('kntt.reviewer.v2',JSON.stringify({sets:[{id:'s',title:'Images',items:[{id:'c',term:'Question',meaning:'Answer',options:['a','b','c','d'],answer:0}]}],progress:{'s/c':{attempts:2,correct:1,lapses:1,reps:1}}})));
 await page.reload();assert.equal(await page.evaluate(async()=>localStorage.getItem('kntt.reviewer.v2')),null);assert.equal((await page.evaluate(async()=>window.readTestState())).progress['s/c'].attempts,2);
 await sidebar(page);await page.locator('[data-open="s"]').click();await page.locator('[data-edit="c"]').click();
 await page.locator('#iImage').setInputFiles({name:'front.png',mimeType:'image/png',buffer:Buffer.from(front.split(',')[1],'base64')});
 await page.waitForFunction(()=>document.querySelector('#iImagePreview').getAttribute('src')&&!document.querySelector('#itemForm .primary').disabled);
 await page.locator('#iAnswerImage').setInputFiles({name:'back.png',mimeType:'image/png',buffer:Buffer.from(back.split(',')[1],'base64')});
 await page.waitForFunction(()=>document.querySelector('#iAnswerImagePreview').getAttribute('src')&&!document.querySelector('#itemForm .primary').disabled);
 await page.locator('#itemForm .primary').click();await page.locator('#itemDialog').waitFor({state:'hidden'});assert.equal(await page.locator('#items img').count(),2);assert.equal(await assetCount(page),2);
 const stored=await page.evaluate(async()=>window.readTestState());assert.equal(typeof stored.sets[0].items[0].image.asset,'string');assert.ok(JSON.stringify(stored).length<10000);
 await sidebar(page);await page.locator('[data-set-menu="s"]').click();const downloading=page.waitForEvent('download');await page.locator('#exportSetAction').click();
 const exported=JSON.parse(fs.readFileSync(await (await downloading).path(),'utf8')),card=exported.sets[0].items[0];
 for(const field of ['image','answerImage']){assert.match(card[field],/^data:image\/(webp|jpeg);base64,/);assert.ok(Buffer.from(card[field].split(',')[1],'base64').length<=256*1024)}
 const size=await page.evaluate(async src=>{const image=new Image();image.src=src;await image.decode();return [image.naturalWidth,image.naturalHeight]},card.image);assert.equal(size[0],1600);assert.ok(size[1]<=1600);
 await page.reload();assert.equal(await page.locator('#items img').count(),2);const writes=await page.evaluate(()=>window.imageWrites);
 await page.locator('#openCards').click();await page.locator('#flash img').waitFor();assert.equal(await page.locator('#flash img').count(),1);
 await page.locator('#flip').click();await page.waitForFunction(()=>document.querySelectorAll('#flash img').length===2);await page.locator('[data-grade="good"]').click();await page.waitForFunction(()=>document.querySelector('#cardCount').textContent==='1 / 1');
 await page.locator('#cards [data-detail-back]').click();await page.locator('#openQuiz').click();await page.locator('#startQuiz').click();await page.locator('#feedback img').waitFor();assert.equal(await page.locator('#feedback img').count(),1);
 await page.locator('[data-answer="0"]').click();await page.locator('#continue').waitFor();assert.equal(await page.locator('#feedback img').count(),2);assert.equal(await page.evaluate(()=>window.imageWrites),writes,'study writes metadata without rewriting image blobs');
 await page.reload();await page.locator('#continue').waitFor();assert.equal(await page.locator('#feedback img').count(),2);assert.equal((await page.evaluate(async()=>window.readTestState())).progress['s/c'].attempts,4);
 await page.locator('#quiz [data-detail-back]').click();await page.locator('[data-edit="c"]').click();await page.locator('[data-remove-image="image"]').click();await page.locator('#cancelItem').click();assert.equal(await page.locator('#items img').count(),2,'cancel leaves attachments intact');
 // A stale tab must be able to restore a referenced blob removed by another tab's cleanup.
 await page.evaluate(async()=>{const db=await new Promise(resolve=>{const r=indexedDB.open('kntt.reviewer',1);r.onsuccess=()=>resolve(r.result)});await new Promise(resolve=>{const tx=db.transaction('images','readwrite');tx.objectStore('images').clear();tx.oncomplete=resolve});db.close()});
 await page.locator('[data-edit="c"]').click();await page.locator('#iMeaning').fill('Edited answer');await page.locator('#itemForm .primary').click();await page.locator('#itemDialog').waitFor({state:'hidden'});assert.equal(await assetCount(page),2);
 await page.locator('[data-edit="c"]').click();await page.locator('[data-remove-image="image"]').click();await page.locator('[data-remove-image="answerImage"]').click();await page.locator('#itemForm .primary').click();await page.locator('#itemDialog').waitFor({state:'hidden'});assert.equal(await assetCount(page),0);assert.equal(await page.locator('#items img').count(),0);
 await sidebar(page);await page.locator('#showImport').click();await page.locator('#jsonInput').fill(JSON.stringify(exported));await page.locator('#importJson').click();await page.getByText('1セットを取り込みました',{exact:true}).waitFor();assert.equal(await assetCount(page),2);
 const before=(await page.evaluate(async()=>window.readTestState())).sets.length;
 await page.locator('#jsonInput').fill(JSON.stringify({sets:[{title:'Unsafe',items:[{...card,image:'data:image/svg+xml;base64,PHN2Zz4='}]}]}));await page.locator('#importJson').click();await page.waitForFunction(()=>document.querySelector('#message').textContent.startsWith('エラー:'));assert.equal((await page.evaluate(async()=>window.readTestState())).sets.length,before);
 assert.deepEqual(errors,[]);console.log('PASS image upload/compression, migration, separate blob storage, JSON round-trip, cards/quiz/reload, cancellation, cleanup and unsafe input:',viewport.width);await page.close();
}
}finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
