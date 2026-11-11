const {createPage}=require('./browser-storage.cjs');
const {chromium}=require('playwright');
const fs=require('node:fs');
const assert=require('node:assert/strict');
(async()=>{
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
try{
for(const mode of ['mouse','touch','hybrid']){
 const mobile=mode==='touch',touch=mode!=='mouse';
 const page=await createPage(browser,{viewport:{width:mobile?390:1280,height:800},isMobile:mobile,hasTouch:touch,reducedMotion:'reduce'}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('https://reviewer.test/**',r=>r.fulfill({contentType:'text/html',body:fs.readFileSync(new URL('../dist/reviewer.html',`file://${__filename}`),'utf8')}));
 await page.goto('https://reviewer.test/reviewer');
 await page.evaluate(async()=>localStorage.setItem('kntt.reviewer.v2',JSON.stringify({sets:[{id:'s',title:'English',items:[{id:'c',term:'term',meaning:'meaning',options:['a','b','c','d'],answer:0}]}],progress:{}})));await page.reload();
 const activate=async selector=>touch?await page.locator(selector).tap():await page.locator(selector).click();
 const sidebar=async()=>{if(await page.locator('#sidebar').getAttribute('aria-hidden')==='true')await activate('#toggleSidebar')};
 async function clean(selector){
 await page.waitForTimeout(180);
 assert.equal(await page.evaluate(async()=>document.documentElement.dataset.keyboard),'false');
 const style=await page.locator(selector).evaluate(async e=>{const s=getComputedStyle(e);return {outline:s.outlineStyle,opacity:s.opacity,bg:s.backgroundColor}});
 assert.equal(style.outline,'none',selector+' retains no pointer focus outline');assert.equal(style.opacity,'1',selector+' retains no hover opacity');return style;
 }
 assert.equal(await page.evaluate(async()=>document.documentElement.dataset.keyboard),'false','initial page does not assume keyboard selection');
 await sidebar();
 for(const [button,dialog] of [['#newSet','createDialog'],['#showImport','importDialog'],['#showExport','exportDialog']]){
 const initial=await page.locator(button).evaluate(async e=>getComputedStyle(e).backgroundColor);
 await page.locator(button).hover();await page.waitForTimeout(180);
 assert.equal(await page.locator(button).evaluate(async e=>getComputedStyle(e).backgroundColor),initial,button+' does not look selected before activation');
 await activate(button);
 const close=dialog==='createDialog'?'#cancelCreate':'#'+dialog+' .dialog-footer [data-close-dialog]';await activate(close);
 assert.equal((await clean(button)).bg,'rgba(0, 0, 0, 0)',button+' clears hover fill');
 }
 await activate('#toggleSearch');await activate('#toggleSearch');await clean('#toggleSearch');
 await activate('[data-sort="setSort"]');await page.keyboard.press('Escape');
 // A pointer activation after keyboard use must reset the visual modality everywhere.
 await activate('[data-sort="setSort"]');await activate('[data-sort-value="title:asc"]');await clean('[data-sort="setSort"]');
 await activate('[data-set-menu="s"]');
 assert.equal((await clean('#renameSetAction')).bg,'rgba(0, 0, 0, 0)','pointer-opened menu does not paint a selected first action');
 await activate('#renameSetAction');await activate('[data-close-dialog="renameDialog"]');await clean('[data-set-menu="s"]');
 await activate('[data-open="s"]');await activate('[data-edit="c"]');await activate('#cancelItem');await clean('[data-edit="c"]');
 await activate('[data-remove="c"]');await activate('#confirmCancel');await clean('[data-remove="c"]');
 await activate('#openCards');await activate('#shuffle');assert.equal((await clean('#shuffle')).bg,'rgb(255, 255, 255)');
 await activate('#cards [data-detail-back]');await activate('#openQuiz');await activate('#startQuiz');await activate('[data-answer="0"]');await clean('#continue');
 await activate('#quiz [data-detail-back]');await sidebar();
 await activate('#toggleSidebar');await clean('#toggleSidebar');
 await page.keyboard.press('Tab');assert.equal(await page.evaluate(async()=>document.documentElement.dataset.keyboard),'true');
 assert.equal(await page.evaluate(async()=>getComputedStyle(document.activeElement).outlineStyle),'solid','keyboard focus indicator remains available');
 if(mode==='hybrid'){
 await page.locator('#toggleSidebar').click();await clean('#toggleSidebar');await page.locator('#toggleSidebar').tap();await clean('#toggleSidebar');
 }
 assert.deepEqual(errors,[]);console.log('PASS pointer feedback across home actions, search, sort, menus, editing, sidebar and study; keyboard focus preserved:',mode);await page.close();
}
}finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
