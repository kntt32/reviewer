const {createPage}=require('./browser-storage.cjs');
const {chromium}=require('playwright');
const fs=require('node:fs');
const assert=require('node:assert/strict');
(async()=>{const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});try{
for(const viewport of [{width:1280,height:900},{width:390,height:844}]){
 const page=await createPage(browser,{viewport,reducedMotion:'reduce'}),errors=[],external=[];page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(!r.url().startsWith('https://reviewer.test/'))external.push(r.url())});
 await page.route('https://reviewer.test/**',r=>r.fulfill({contentType:'text/html',body:fs.readFileSync(new URL('../dist/reviewer.html',`file://${__filename}`),'utf8')}));await page.goto('https://reviewer.test/reviewer');
 const term=String.raw`面積 $S=\pi r^2$`,meaning=String.raw`$$x=\frac{-b\pm\sqrt{b^2-4ac}}{2a}$$`;
 await page.evaluate(({term,meaning})=>localStorage.setItem('kntt.reviewer.v2',JSON.stringify({sets:[{id:'s',title:'Math',items:[{id:'c',term,meaning,question:String.raw`\(x^2=4\) を解け`,explanation:String.raw`\[x=\pm2\]`,options:['$x=2$','$x=-2$',String.raw`$x=\pm2$`,'$x=0$'],answer:2}]}],progress:{'s/c':{attempts:2,correct:1,lapses:1}}})),{term,meaning});await page.reload();await page.locator('#dashboardWeakCards math').first().waitFor();
 await page.locator('[data-dashboard-card="c"]').click();await page.locator('#items math').first().waitFor();assert.equal(await page.locator('#items math[display="block"]').count(),1);
 await page.locator('[data-explanation="c"]').click();await page.locator('#explanationDialog math').first().waitFor();await page.locator('[data-close-dialog="explanationDialog"]').click();
 await page.locator('#openCards').click();await page.locator('#flash math').first().waitFor();await page.locator('#flip').click();await page.locator('#flash math[display="block"]').first().waitFor();await page.locator('#cards [data-detail-back]').click();
 await page.locator('#openQuiz').click();await page.locator('#startQuiz').click();await page.locator('#feedback math').waitFor();assert.equal(await page.locator('#quizAnswers math').count(),4);await page.locator('[data-answer="2"]').click();await page.locator('#continue').waitFor();await page.locator('#feedback math[display="block"]').first().waitFor();
 await page.locator('#quiz [data-detail-back]').click();await page.locator('[data-edit="c"]').click();assert.equal(await page.locator('#iTerm').inputValue(),term);await page.locator('#iResponseMode').selectOption('free');await page.locator('#iAnswerText').fill(String.raw`\[x=\pm2\]`);await page.locator('#iExplanation').fill(String.raw`$\includegraphics{https://blocked.test/image.png}$ <img src=x onerror=alert(1)>`);await page.locator('#itemForm .primary').click();await page.locator('#itemDialog').waitFor({state:'hidden'});
 await page.locator('#openQuiz').click();await page.locator('#startQuiz').click();await page.locator('#freeAnswer').fill('$x=2$');await page.locator('#revealFreeAnswer').click();await page.locator('[data-self-grade]').first().waitFor();await page.locator('#feedback math[display="block"]').first().waitFor();assert.equal(await page.locator('#feedback img').count(),0);assert.equal(await page.locator('#freeAnswer .katex').count(),0);
 if(viewport.width===1280)await page.screenshot({path:'/workspace/work/math-preview.png'});
 assert.deepEqual(errors,[]);assert.deepEqual(external,[]);console.log('PASS inline/display math in dashboard, cards, choices, explanations and free responses with no external resources or HTML execution:',viewport.width);await page.close();
}
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1});
