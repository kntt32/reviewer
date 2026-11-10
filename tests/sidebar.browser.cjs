const {chromium}=require('playwright');
const fs=require('node:fs');
const assert=require('node:assert/strict');
(async()=>{
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
try{
for(const viewport of [{width:1440,height:1000},{width:820,height:1180},{width:390,height:844}]){
 const page=await browser.newPage({viewport,reducedMotion:'reduce',hasTouch:true});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('https://reviewer.test/**',r=>r.fulfill({contentType:'text/html',body:fs.readFileSync(new URL('../dist/reviewer.html',`file://${__filename}`),'utf8')}));
 await page.goto('https://reviewer.test/reviewer.html');
 await page.evaluate(()=>{
 const card=i=>({id:'c'+i,term:'term'+i,meaning:'meaning'+i,options:['a','b','c','d'],answer:0});
 localStorage.setItem('kntt.reviewer.v2',JSON.stringify({sets:[{id:'b',title:'Beta',items:[card(0),card(1)]},{id:'a',title:'Alpha',items:[card(0),card(1)]},{id:'r2',sourceId:'feed',remoteKey:'r2',title:'Another Web set',items:[card(0)]},{id:'r',sourceId:'feed',remoteKey:'r',title:'Web set',items:[card(0)]}],sources:[{id:'feed',name:'英語の復習',url:'https://feed.test/data.json',cardIds:{}}],progress:{}}));
 });
 await page.route('https://feed.test/**',r=>r.fulfill({status:500,body:'offline'}));
 await page.reload();
 const mobile=viewport.width<=760;
 if(mobile){assert.equal(await page.locator('#sidebar').isVisible(),false);await page.locator('#toggleSidebar').click()}
 const side=await page.locator('#sidebar').boundingBox();assert.ok(side.width<=300);assert.ok(side.height>side.width*2);
 const buttons=await page.locator('.home-actions button').all();const boxes=await Promise.all(buttons.map(b=>b.boundingBox()));assert.ok(boxes[0].y<boxes[1].y&&boxes[1].y<boxes[2].y);
 await page.locator('#setSort').selectOption('title:asc');assert.equal(await page.locator('#setGrid h3').first().innerText(),'Alpha');
 await page.locator('#setSort').selectOption('title:desc');assert.equal(await page.locator('#setGrid h3').first().innerText(),'Beta');
 await page.locator('#localSection>summary').click();assert.equal(await page.locator('#setGrid').isVisible(),false);
 await page.reload();if(mobile)await page.locator('#toggleSidebar').click();assert.equal(await page.locator('#setGrid').isVisible(),false);
 await page.locator('#localSection>summary').click();await page.locator('[data-open="a"]').click();
 if(mobile)assert.equal(await page.locator('#sidebar').isVisible(),false);
 assert.equal(await page.locator('#setTitle').innerText(),'Alpha');
 if(mobile)await page.locator('#toggleSidebar').click();await page.locator('[data-open="b"]').click();assert.equal(await page.locator('#setTitle').innerText(),'Beta');
 await page.locator('#openQuiz').click();await page.locator('#startQuiz').click();
 if(viewport.width===820)await page.screenshot({path:'/workspace/work/sidebar-ipad-quiz.png'});
 const pane=await page.locator('.right-pane').boundingBox(),quiz=await page.locator('#quiz').boundingBox();assert.ok(quiz.width>pane.width*.75);assert.ok(quiz.height>pane.height*.75);
 const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth);assert.equal(overflow,false);
 assert.equal(await page.locator('.choice').first().evaluate(el=>getComputedStyle(el).touchAction),'manipulation');
 const choice=await page.locator('.choice').first().boundingBox();assert.ok(choice.y+choice.height<=viewport.height);
 if(mobile)await page.locator('#toggleSidebar').click();
 await page.locator('#setSearch').fill('Alpha');assert.equal(await page.locator('#setGrid h3').count(),1);
 await page.locator('#setSearch').fill('');
 await page.locator('#webSort').selectOption('title:asc');assert.equal(await page.locator('#sources .set-open h3').first().innerText(),'Another Web set');
 await page.locator('#webSort').selectOption('title:desc');assert.equal(await page.locator('#sources .set-open h3').first().innerText(),'Web set');
 await page.locator('#webSection>summary').click();assert.equal(await page.locator('#sources').isVisible(),false);await page.locator('#webSection>summary').click();
 await page.locator('[data-source-section]>summary').click();assert.equal(await page.locator('[data-open="r"]').isVisible(),false);
 await page.reload();if(mobile)await page.locator('#toggleSidebar').click();assert.equal(await page.locator('[data-open="r"]').isVisible(),false);
 await page.locator('[data-source-section]>summary').click();await page.locator('[data-open="r"]').click();assert.equal(await page.locator('#setTitle').innerText(),'Web set');
 if(mobile)await page.locator('#toggleSidebar').click();await page.locator('#closeSidebar').click();assert.equal(await page.locator('#sidebar').isVisible(),false);
 const full=await page.locator('.right-pane').boundingBox();assert.equal(full.width,viewport.width);
 await page.locator('#toggleSidebar').click();assert.equal(await page.locator('#sidebar').isVisible(),true);
 assert.deepEqual(errors,[]);
 if(viewport.width===1440)await page.screenshot({path:'/workspace/work/sidebar-desktop.png'});
 if(mobile){await page.locator('#closeSidebar').click();await page.screenshot({path:'/workspace/work/sidebar-mobile.png'})}
 console.log('PASS sidebar layout, sort, collapse persistence, switching, web, hide/show, study bounds, touch-action:',viewport.width);
 await page.close();
}
}finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
