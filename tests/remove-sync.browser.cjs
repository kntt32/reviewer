const {createPage}=require('./browser-storage.cjs');
const {chromium}=require('playwright');
const fs=require('node:fs'),assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
 try{
 const page=await createPage(browser),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('https://reviewer.test/**',r=>r.fulfill({contentType:'text/html',body:fs.readFileSync('dist/reviewer.html','utf8')}));
 await page.goto('https://reviewer.test/');
 await page.evaluate(async()=>{
 const card={id:'c',term:'Q',meaning:'A',options:['a','b','c','d'],answer:0};
 const db=await new Promise(resolve=>{const r=indexedDB.open('kntt.reviewer',1);r.onsuccess=()=>resolve(r.result)});
 await new Promise((resolve,reject)=>{const tx=db.transaction(['state','images'],'readwrite');tx.objectStore('images').put(new Blob(['old']),'orphan');tx.objectStore('state').put({sets:[{id:'local',title:'Local',items:[card]},{id:'remote',sourceId:'feed',title:'Remote',items:[{...card,image:{asset:'missing'}}]}],sources:[{id:'feed',url:'https://feed.test/'}],progress:{'local/c':{attempts:2},'remote/c':{attempts:4}},sessions:{local:{},remote:{}},view:{setId:'remote',screen:'quiz'}},'kntt.reviewer.v2');tx.oncomplete=resolve;tx.onabort=()=>reject(tx.error)});db.close();
 });
 await page.reload();
 const state=await page.evaluate(()=>window.readTestState());
 assert.deepEqual(state.sets.map(s=>s.id),['local']);assert.equal(state.progress['local/c'].attempts,2);assert.equal(state.progress['remote/c'],undefined);assert.equal(state.sessions.remote,undefined);assert.equal(state.sources,undefined);assert.equal(state.view,null);
 const assets=await page.evaluate(async()=>{const db=await new Promise(resolve=>{const r=indexedDB.open('kntt.reviewer',1);r.onsuccess=()=>resolve(r.result)});return new Promise(resolve=>{const r=db.transaction('images').objectStore('images').count();r.onsuccess=()=>{db.close();resolve(r.result)}})});assert.equal(assets,0);
 assert.equal(await page.locator('#webSection,#sourceDialog,#addSource').count(),0);
 assert.equal(await page.locator('#storageStatus').isVisible(),false);
 await page.reload();assert.equal((await page.evaluate(()=>window.readTestState())).sets.length,1);assert.deepEqual(errors,[]);
 console.log('PASS persisted sync cleanup before image hydration; local data retained');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
