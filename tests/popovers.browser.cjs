const {createPage}=require('./browser-storage.cjs');
const {chromium}=require('playwright');
const fs=require('node:fs');
const assert=require('node:assert/strict');
(async()=>{
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
try{
for(const viewport of [{width:1280,height:800},{width:390,height:640},{width:820,height:360}]){
 const page=await createPage(browser,{viewport,reducedMotion:'reduce'}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('https://reviewer.test/**',r=>r.fulfill({contentType:'text/html',body:fs.readFileSync(new URL('../dist/reviewer.html',`file://${__filename}`),'utf8')}));
 await page.goto('https://reviewer.test/reviewer');await page.evaluate(async()=>localStorage.setItem('kntt.reviewer.v2',JSON.stringify({sets:[{id:'s',title:'English',items:[]}],progress:{}})));await page.reload();
 if(viewport.width<=760)await page.locator('#toggleSidebar').click();
 async function checkMenu(id){
 const box=await page.locator('#'+id).boundingBox();assert.ok(box.width<=240);assert.ok(box.x>=0&&box.x+box.width<=viewport.width&&box.y>=0&&box.y+box.height<=viewport.height+1);
 assert.equal(await page.locator('dialog[open]').count(),0);
 }
 await page.locator('[data-sort="setSort"]').click();await checkMenu('sortPopover');
 assert.equal(await page.locator('[data-sort="setSort"]').getAttribute('aria-expanded'),'true');
 await page.keyboard.press('ArrowDown');assert.ok(await page.locator('#sortPopover button').evaluateAll(bs=>bs.some(b=>b===document.activeElement)));
 await page.keyboard.press('Escape');assert.equal(await page.locator('#sortPopover').isVisible(),false);assert.equal(await page.locator('#sidebar').isVisible(),true);
 await page.locator('[data-sort="setSort"]').click();await page.locator('#homeLink').click();assert.equal(await page.locator('#sortPopover').isVisible(),false);
 await page.locator('[data-sort="setSort"]').click();await page.locator('[data-sort="setSort"]').click();assert.equal(await page.locator('#sortPopover').isVisible(),false);
 await page.locator('[data-set-menu="s"]').click();await checkMenu('setActionsPopover');
 if(viewport.width===1280)await page.screenshot({path:'/workspace/work/anchored-menu.png'});
 await page.locator('#renameSetAction').click();await page.locator('#renameDialog[open]').waitFor();assert.equal(await page.locator('#setActionsPopover').isVisible(),false);await page.locator('[data-close-dialog="renameDialog"]').click();
 assert.deepEqual(errors,[]);console.log('PASS anchored popover bounds, non-modal menus, dismissal, keyboard and modal rename:',viewport.width,viewport.height);await page.close();
}
}finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
