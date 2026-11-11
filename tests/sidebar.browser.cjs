const {createPage}=require('./browser-storage.cjs');
const {chromium}=require('playwright');
const fs=require('node:fs');
const assert=require('node:assert/strict');
(async()=>{
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
try{
for(const viewport of [{width:1440,height:1000},{width:820,height:1180},{width:390,height:844}]){
 const page=await createPage(browser,{viewport,reducedMotion:'reduce',hasTouch:true});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('https://reviewer.test/**',r=>r.fulfill({contentType:'text/html',body:fs.readFileSync(new URL('../dist/reviewer.html',`file://${__filename}`),'utf8')}));
 await page.goto('https://reviewer.test/reviewer.html');
 assert.equal(await page.locator('.github-link').getAttribute('href'),'https://github.com/kntt32/reviewer');
 await page.evaluate(async()=>{
 const card=i=>({id:'c'+i,term:'term'+i,meaning:'meaning'+i,options:['a','b','c','d'],answer:0});
 localStorage.setItem('kntt.reviewer.v2',JSON.stringify({sets:[{id:'b',title:'Beta',items:[card(0),card(1)]},{id:'a',title:'Alpha',items:[card(0),card(1)]},{id:'r2',sourceId:'feed',remoteKey:'r2',title:'Another Web set',items:[card(0)]},{id:'r',sourceId:'feed',remoteKey:'r',title:'Web set',items:[card(0)]}],sources:[{id:'feed',name:'英語の復習',url:'https://feed.test/data.json',cardIds:{}}],progress:{}}));
 });
 await page.route('https://feed.test/**',r=>r.fulfill({status:500,body:'offline'}));
 await page.reload();
 const mobile=viewport.width<=760;
 if(mobile){assert.equal(await page.locator('#sidebar').isVisible(),false);await page.locator('#toggleSidebar').click()}
 assert.equal(await page.locator('#sidebarToggleSlot #toggleSidebar').count(),1);assert.equal(await page.locator('#closeSidebar').count(),0);
 const side=await page.locator('#sidebar').boundingBox();assert.ok(side.width<=300);assert.ok(side.height>side.width*2);
 const buttons=await page.locator('.home-actions button').all();const boxes=await Promise.all(buttons.map(b=>b.boundingBox()));assert.ok(boxes[0].y<boxes[1].y&&boxes[1].y<boxes[2].y);
 await page.locator('[data-sort="setSort"]').click();await page.locator('[data-sort-value="title:asc"]').click();assert.equal(await page.locator('#setGrid h3').first().innerText(),'Alpha');
 await page.locator('[data-sort="setSort"]').click();await page.locator('[data-sort-value="title:desc"]').click();assert.equal(await page.locator('#setGrid h3').first().innerText(),'Beta');
 await page.locator('#localSection>summary').click();assert.equal(await page.locator('#setGrid').isVisible(),false);
 await page.reload();if(mobile)await page.locator('#toggleSidebar').click();assert.equal(await page.locator('#setGrid').isVisible(),false);
 await page.locator('#localSection>summary').click();await page.locator('[data-open="a"]').click();
 if(mobile)assert.equal(await page.locator('#sidebar').isVisible(),false);
 assert.equal(await page.locator('#setTitle').innerText(),'Alpha');
 if(mobile)await page.locator('#toggleSidebar').click();await page.locator('[data-open="b"]').click();assert.equal(await page.locator('#setTitle').innerText(),'Beta');
 await page.locator('#openQuiz').click();await page.locator('#startQuiz').click();
 if(viewport.width===820)await page.screenshot({path:'/workspace/work/sidebar-ipad-quiz.png'});
 const pane=await page.locator('.right-pane').boundingBox(),quiz=await page.locator('#quiz').boundingBox();assert.ok(quiz.width>pane.width*.75);assert.ok(quiz.height>pane.height*.75);
 const overflow=await page.evaluate(async()=>document.documentElement.scrollWidth>innerWidth);assert.equal(overflow,false);
 assert.equal(await page.locator('.choice').first().evaluate(async el=>getComputedStyle(el).touchAction),'manipulation');
 const choice=await page.locator('.choice').first().boundingBox();assert.ok(choice.y+choice.height<=viewport.height);
 await page.locator('#quiz [data-detail-back]').click();
 if(mobile)await page.locator('#toggleSidebar').click();
 assert.equal(await page.locator('#setSearch').isVisible(),false);
 await page.locator('#toggleSearch').click();await page.locator('#setSearch').fill('Alpha');assert.equal(await page.locator('#setGrid h3').count(),1);
 await page.locator('#toggleSearch').click();assert.equal(await page.locator('#setSearch').isVisible(),false);assert.equal(await page.locator('#setGrid h3').count(),2);
 await page.locator('[data-sort="webSort"]').click();await page.locator('[data-sort-value="title:asc"]').click();assert.equal(await page.locator('#sources .set-open h3').first().innerText(),'Another Web set');
 await page.locator('[data-sort="webSort"]').click();await page.locator('[data-sort-value="title:desc"]').click();assert.equal(await page.locator('#sources .set-open h3').first().innerText(),'Web set');
 await page.locator('#webSection>summary').click();assert.equal(await page.locator('#sources').isVisible(),false);await page.locator('#webSection>summary').click();
 await page.locator('[data-source-section]>summary').click();assert.equal(await page.locator('[data-open="r"]').isVisible(),false);
 await page.reload();if(mobile)await page.locator('#toggleSidebar').click();assert.equal(await page.locator('[data-open="r"]').isVisible(),false);
 await page.locator('[data-source-section]>summary').click();await page.locator('[data-open="r"]').click();assert.equal(await page.locator('#setTitle').innerText(),'Web set');
 if(mobile)await page.locator('#toggleSidebar').click();await page.locator('#toggleSidebar').click();assert.equal(await page.locator('#sidebar').isVisible(),false);
 assert.equal(await page.locator('#workspaceToggleSlot #toggleSidebar').count(),1);
 const full=await page.locator('.right-pane').boundingBox();assert.equal(full.width,viewport.width);
 await page.locator('#toggleSidebar').click();assert.equal(await page.locator('#sidebar').isVisible(),true);
 assert.deepEqual(errors,[]);
 if(viewport.width===1440)await page.screenshot({path:'/workspace/work/sidebar-desktop.png'});
 if(mobile){await page.locator('#toggleSidebar').click();await page.screenshot({path:'/workspace/work/sidebar-mobile.png'})}
 console.log('PASS sidebar layout, sort, collapse persistence, switching, web, hide/show, study bounds, touch-action:',viewport.width);
 await page.close();
}
for(const width of [1280,390]){
 const page=await createPage(browser,{viewport:{width,height:900},reducedMotion:'no-preference'});
 await page.route('https://reviewer.test/**',r=>r.fulfill({contentType:'text/html',body:fs.readFileSync(new URL('../dist/reviewer.html',`file://${__filename}`),'utf8')}));
 await page.goto('https://reviewer.test/reviewer.html');
 await page.locator('#toggleSidebar').click();
 const samples=await page.evaluate(async()=>{
 const values=[];for(let i=0;i<24;i++){await new Promise(requestAnimationFrame);const box=document.querySelector('.sidebar-rail').getBoundingClientRect();values.push({width:box.width,x:box.x})}return values;
 });
 if(width===1280)assert.ok(samples.some(x=>x.width>0&&x.width<259),'desktop sidebar width interpolates');
 else assert.ok(samples.some(x=>x.x<0&&x.x>-280),'mobile sidebar slides in');
 assert.equal(await page.locator('#toggleSidebar').count(),1);
 await page.locator('#toggleSidebar').click();
 console.log('PASS animated sidebar and single moving toggle:',width);
 await page.close();
}
}finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
