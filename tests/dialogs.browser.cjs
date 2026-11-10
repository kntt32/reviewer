const {chromium}=require('playwright');
const fs=require('node:fs');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
 try{
 for(const viewport of [{width:1280,height:800},{width:390,height:640},{width:820,height:360}]){
 const page=await browser.newPage({viewport,reducedMotion:'reduce'});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',async dialog=>{errors.push('Native dialog: '+dialog.type());await dialog.dismiss()});
 await page.route('https://reviewer.test/**',r=>r.fulfill({contentType:'text/html',body:fs.readFileSync(new URL('../dist/reviewer.html',`file://${__filename}`),'utf8')}));
 await page.goto('https://reviewer.test/reviewer');
 const card={id:'c',term:'provided that',meaning:'〜という条件で',explanation:('条件を表す接続表現。\n').repeat(80),example:'You may leave early, provided that your work is finished.',translation:'仕事が終わっているなら、早く帰ってもよい。',options:['a','b','c','d'],answer:0};
 await page.evaluate(card=>localStorage.setItem('kntt.reviewer.v2',JSON.stringify({sets:[{id:'s',title:'English',items:[card]}],progress:{'s/c':{attempts:2,correct:1,lapses:1,reps:0}}})),card);
 await page.reload();if(viewport.width<=760)await page.locator('#toggleSidebar').click();await page.locator('[data-open="s"]').click();
 async function visibleFooter(id){
 const footer=page.locator('#'+id+' .dialog-footer');
 const box=await footer.boundingBox();assert.ok(box&&box.y>=0&&box.y+box.height<=viewport.height+1,id+' footer within viewport');
 for(const button of await footer.locator('button').all())assert.ok(await button.isVisible());
 }
 const editBox=await page.locator('[data-edit="c"]').boundingBox(),itemBox=await page.locator('#items .item').boundingBox();assert.ok(editBox.x>itemBox.x+itemBox.width/2);
 await page.locator('[data-explanation="c"]').click();await visibleFooter('explanationDialog');
 assert.equal((await page.locator('#explanationText').innerText()).trim(),card.explanation.trim());
 assert.ok(await page.locator('#explanationDialog .dialog-body').evaluate(e=>e.scrollHeight>e.clientHeight));
 await page.locator('#explanationDialog .dialog-body').evaluate(e=>e.scrollTop=e.scrollHeight);await visibleFooter('explanationDialog');await page.locator('[data-close-dialog="explanationDialog"]').click();
 await page.locator('[data-edit="c"]').click();await visibleFooter('itemDialog');
 assert.ok(await page.locator('#itemDialog .dialog-body').evaluate(e=>e.scrollHeight>e.clientHeight));
 if(viewport.width===390)await page.screenshot({path:'/workspace/work/dialog-mobile.png'});
 await page.locator('#iOptions').fill('one');await page.locator('#itemForm .dialog-footer .primary').click();await page.locator('#itemMessage:not([hidden])').waitFor();await visibleFooter('itemDialog');
 await page.locator('#cancelItem').click();
 await page.locator('[data-remove="c"]').click();await visibleFooter('confirmDialog');await page.keyboard.press('Escape');assert.equal(await page.locator('#items .item').count(),1);
 await page.locator('[data-remove="c"]').click();await page.locator('#confirmCancel').click();assert.equal(await page.locator('#items .item').count(),1);
 // Exercise nested confirmation during backup import, including both history choices.
 if(viewport.width<=760)await page.locator('#toggleSidebar').click();await page.locator('#showImport').click();await visibleFooter('importDialog');
 const backup={sets:[{id:'backup',title:'Backup',items:[{...card,explanation:'short'}]}],progress:{'backup/c':{attempts:5,correct:4,lapses:1,reps:1}}};
 await page.locator('#jsonInput').fill(JSON.stringify(backup));await page.locator('#importJson').click();await visibleFooter('confirmDialog');await page.locator('#confirmCancel').click();
 await page.getByText('1セットを取り込みました',{exact:true}).waitFor();
 assert.equal(await page.evaluate(()=>Object.keys(JSON.parse(localStorage.getItem('kntt.reviewer.v2')).progress).length),1);
 await page.locator('#importJson').click();await page.locator('#confirmAccept').click();
 await page.waitForFunction(()=>JSON.parse(localStorage.getItem('kntt.reviewer.v2')).sets.length===3);
 assert.equal(await page.evaluate(()=>Object.keys(JSON.parse(localStorage.getItem('kntt.reviewer.v2')).progress).length),2);
 await page.locator('#importDialog [data-close-dialog]').first().click();
 await page.locator('#showExport').click();await page.locator('#reset').click();await page.locator('#confirmCancel').click();
 assert.equal(await page.evaluate(()=>Object.keys(JSON.parse(localStorage.getItem('kntt.reviewer.v2')).progress).length),2);
 await page.locator('#reset').click();await page.locator('#confirmAccept').click();
 await page.waitForFunction(()=>Object.keys(JSON.parse(localStorage.getItem('kntt.reviewer.v2')).progress).length===0);
 await page.locator('#exportDialog .dialog-footer button').click();
 if(viewport.width<=760)await page.locator('#toggleSidebar').click();
 await page.locator('[data-remove="c"]').click();await page.locator('#confirmAccept').click();await page.waitForFunction(()=>JSON.parse(localStorage.getItem('kntt.reviewer.v2')).sets.find(s=>s.id==='s').items.length===0);
 assert.deepEqual(errors,[]);
 console.log('PASS HTML confirmations, fixed dialog actions, scrollable explanations, right-side icons, inline errors, backup import:',viewport.width,viewport.height);
 await page.close();
 }
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
