// Test helpers read the real IndexedDB store; the application keeps no state mirror in localStorage.
async function createPage(browser,options){
 const page=await browser.newPage(options);
 await page.addInitScript(()=>{
 window.readTestState=async()=>{
 while(document.body?.dataset.saving==='true')await new Promise(resolve=>setTimeout(resolve,10));
 const db=await new Promise((resolve,reject)=>{const r=indexedDB.open('kntt.reviewer',1);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)});
 return new Promise((resolve,reject)=>{
 const tx=db.transaction('state','readonly'),r=tx.objectStore('state').get('kntt.reviewer.v2');let value;
 r.onsuccess=()=>{value=r.result};tx.oncomplete=()=>{db.close();resolve(value||{sets:[],progress:{}})};tx.onabort=()=>{db.close();reject(tx.error)};
 });
 };
 });
 const goto=page.goto.bind(page),reload=page.reload.bind(page);
 page.goto=async(...args)=>{const result=await goto(...args);await page.waitForFunction(()=>document.body?.dataset.ready==='true');return result};
 page.reload=async(...args)=>{await page.waitForFunction(()=>document.body?.dataset.saving!=='true');const result=await reload(...args);await page.waitForFunction(()=>document.body?.dataset.ready==='true');return result};
 return page;
}
module.exports={createPage};
