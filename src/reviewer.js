
(async()=>{
"use strict";
const $=id=>document.getElementById(id),KEY="kntt.reviewer.v2",OLD="kntt.english-review.v1",SORT_KEY="kntt.reviewer.set-sort",DAY=86400000;
const esc=x=>String(x??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
// Show focus indicators only after an actual keyboard interaction.
const inputRoot=document.documentElement;
inputRoot.dataset.keyboard='false';
function pointerInteraction(){inputRoot.dataset.keyboard='false'}
document.addEventListener('pointerdown',pointerInteraction,true);
document.addEventListener('click',e=>{if(e.detail>0)pointerInteraction()},true);
document.addEventListener('keydown',()=>{inputRoot.dataset.keyboard='true'},true);
let quizCurrent=null,quizOrder=[],quizAnswered=null,freeDraft='',freeRevealed=false;
let state={sets:[],progress:{}},active="",editingSet="",editingItem="",deck=[],pos=0,reveal=false,queue=[],firstSeen=new Set(),wrongOnce=new Set(),firstRight=0,quizTotal=0;
const mathRoots=new Set();let mathPending=false;
function typesetMath(root){
 if(!globalThis.renderMathInElement)return;
 renderMathInElement(root,{
 delimiters:[{left:'$$',right:'$$',display:true},{left:'\\[',right:'\\]',display:true},{left:'\\(',right:'\\)',display:false},{left:'$',right:'$',display:false}],
 output:'mathml',throwOnError:false,trust:false,strict:'ignore',maxExpand:1000,maxSize:20,
 ignoredTags:['script','noscript','style','textarea','pre','code','option','input'],ignoredClasses:['katex'],errorCallback:()=>{}
 });
}
function scheduleMath(root){
 mathRoots.add(root);if(mathPending)return;mathPending=true;
 queueMicrotask(()=>{mathPending=false;const roots=[...mathRoots];mathRoots.clear();for(const root of roots)typesetMath(root)});
}
for(const id of ['items','flash','quizBody','explanationDialog','dashboardWeakCards','dashboardRecommendations']){
 const root=$(id);new MutationObserver(()=>scheduleMath(root)).observe(root,{childList:true,characterData:true,subtree:true});
}
const idOK=x=>typeof x==="string"&&/^[A-Za-z0-9._-]{1,100}$/.test(x);
const IMAGE_FIELDS=['image','answerImage'];
function validateImage(value){
 if(value==null||value==='')return '';
 if(typeof value!=='string'||value.length>5600000)throw Error('画像が大きすぎます');
 const match=/^data:image\/(png|jpeg|webp|gif|avif);base64,([A-Za-z0-9+/]+={0,2})$/i.exec(value);
 if(!match||match[2].length%4)throw Error('画像はBase64のPNG・JPEG・WebP・GIF・AVIF形式にしてください');
 const mime=match[1].toLowerCase(),head=atob(match[2].slice(0,256));
 const valid=mime==='png'?head.startsWith('\x89PNG\r\n\x1a\n'):mime==='jpeg'?head.startsWith('\xff\xd8\xff'):mime==='webp'?head.startsWith('RIFF')&&head.slice(8,12)==='WEBP':mime==='gif'?/^GIF8[79]a/.test(head):head.slice(4,8)==='ftyp'&&/avif|avis/.test(head);
 if(!valid)throw Error('画像データが不正です');
 return 'data:image/'+mime+';base64,'+match[2];
}
function imageMarkup(src,alt,className='card-image'){
 return src?'<img class="'+className+'" src="'+esc(src)+'" alt="'+esc(alt)+'" loading="lazy" decoding="async">':'';
}
function item(x){
 if(!x||!idOK(x.id)||!String(x.term||'').trim()||!String(x.meaning||'').trim())throw Error('カードのid/term/meaningが不正です');
 const free=x.responseMode==='free';
 if(!free&&(!Array.isArray(x.options)||x.options.length!==4||!x.options.every(a=>typeof a==='string'&&a.trim())))throw Error('optionsは4つの文字列です');
 if(!free&&(!Number.isInteger(+x.answer)||+x.answer<0||+x.answer>3))throw Error('answerは0〜3です');
 const image=validateImage(x.image),answerImage=validateImage(x.answerImage);
 const answerText=String(x.answerText??x.meaning).trim();if(free&&!answerText)throw Error('正解例を入力してください');
 return {id:x.id,type:x.type==='grammar'?'grammar':'word',term:String(x.term),meaning:String(x.meaning),explanation:String(x.explanation||''),example:String(x.example||''),translation:String(x.translation||''),question:String(x.question||(free?x.term:x.term+'について正しい説明は？')),...(free?{responseMode:'free',answerText}:{options:x.options.map(a=>a.trim()),answer:+x.answer}),...(image?{image}:{}),...(answerImage?{answerImage}:{})};
}
const timestamp=value=>Number.isFinite(value)&&value>0?value:null;
function set(x){if(!x||!idOK(x.id)||!String(x.title||"").trim()||!Array.isArray(x.items))throw Error("セットにはtitleとitemsが必要です");const a=x.items.map(item);if(new Set(a.map(v=>v.id)).size!==a.length)throw Error("同一セット内に重複IDがあります");return{id:x.id,title:String(x.title),description:String(x.description||""),items:a,
 createdAt:timestamp(x.createdAt),updatedAt:timestamp(x.updatedAt),lastStudiedAt:timestamp(x.lastStudiedAt)}}
function newSet(id,title,description,items=[]){
 const now=Date.now();
 return {id,title,description,items,createdAt:now,updatedAt:now,lastStudiedAt:null};
}
function restoreStudyDate(s,history){
 for(const {id} of s.items){
  const p=history[s.id+"/"+id];
  if(!p?.attempts||!timestamp(p.due)||!timestamp(p.interval))continue;
  const studiedAt=timestamp(p.due-DAY*p.interval);
  if(studiedAt>s.lastStudiedAt)s.lastStudiedAt=studiedAt;
 }
}
function freshSetId(occupied=state.sets){
 let id;
 do {
  id="set-"+crypto.randomUUID();
 } while(occupied.some(s=>s.id===id));
 return id;
}
function freshItemId(occupied=[]){
 let id;
 do {id="card-"+crypto.randomUUID()} while(occupied.some(c=>c.id===id));
 return id;
}
let databasePromise=null,saveQueue=Promise.resolve(true),saveCount=0,storageReadFailed=false,lastAssetKeys=null;
const assetCache=new Map();
function openDatabase(){
 if(databasePromise)return databasePromise;
 databasePromise=new Promise((resolve,reject)=>{
 const request=indexedDB.open('kntt.reviewer',1);
 request.onupgradeneeded=()=>{const db=request.result;for(const name of ['state','images'])if(!db.objectStoreNames.contains(name))db.createObjectStore(name)};
 request.onerror=()=>reject(request.error);
 request.onsuccess=()=>{const db=request.result;db.onversionchange=()=>{db.close();databasePromise=null};db.onclose=()=>{databasePromise=null};resolve(db)};
 }).catch(error=>{databasePromise=null;throw error});
 return databasePromise;
}
async function readStoredState(){
 const db=await openDatabase();
 return new Promise((resolve,reject)=>{
 const tx=db.transaction('state','readonly'),request=tx.objectStore('state').get(KEY);let value;
 request.onsuccess=()=>{value=request.result};tx.oncomplete=()=>resolve(value);tx.onabort=()=>reject(tx.error||Error('読み込みに失敗しました'));
 });
}
function blobDataURL(blob){return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(reader.error);reader.readAsDataURL(blob)})}
function imageBlob(src){
 const [header,base64]=src.split(','),bytes=atob(base64),data=new Uint8Array(bytes.length);
 for(let i=0;i<bytes.length;i++)data[i]=bytes.charCodeAt(i);
 return new Blob([data],{type:header.slice(5,-7)});
}
async function hydrateState(stored){
 const result=stored,ids=new Set();
 for(const set of result.sets||[])for(const card of set.items||[])for(const field of IMAGE_FIELDS)if(card[field]&&typeof card[field]==='object')ids.add(card[field].asset);
 const db=await openDatabase(),blobs=new Map();
 if(ids.size)await new Promise((resolve,reject)=>{
 const tx=db.transaction('images','readonly');
 for(const id of ids){const request=tx.objectStore('images').get(id);request.onsuccess=()=>blobs.set(id,request.result)}
 tx.oncomplete=resolve;tx.onabort=()=>reject(tx.error||Error('画像を読み込めません'));
 });
 const sources=new Map();
 await Promise.all([...ids].map(async id=>{const blob=blobs.get(id);if(!(blob instanceof Blob))throw Error('保存画像が見つかりません');const src=validateImage(await blobDataURL(blob));sources.set(id,src);assetCache.set(src,{id,persisted:true,blob:null})}));
 for(const set of result.sets||[])for(const card of set.items||[])for(const field of IMAGE_FIELDS)if(card[field]&&typeof card[field]==='object')card[field]=sources.get(card[field].asset);
 return result;
}
function snapshotState(){
 const {sets,...metadata}=state;
 return {...structuredClone(metadata),sets:sets.map(set=>({...set,items:set.items.map(card=>({...card}))}))};
}
async function persistState(snapshot){
 const db=await openDatabase(),assets=new Map(),existing=new Map(),used=new Set();
 for(const set of snapshot.sets)for(const card of set.items)for(const field of IMAGE_FIELDS){
 const src=card[field];if(!src)continue;
 let asset=assetCache.get(src);
 if(!asset){
 const blob=imageBlob(src),digest=await crypto.subtle.digest('SHA-256',await blob.arrayBuffer());
 const id=[...new Uint8Array(digest)].map(byte=>byte.toString(16).padStart(2,'0')).join('');
 asset={id,blob,persisted:false};assetCache.set(src,asset);
 }
 if(!asset.persisted){asset.blob||=imageBlob(src);assets.set(asset.id,asset)}else existing.set(asset.id,src);
 used.add(asset.id);card[field]={asset:asset.id};
 }
 const keys=[...used].sort().join(',');
 await new Promise((resolve,reject)=>{
 const tx=db.transaction(['state','images'],'readwrite'),images=tx.objectStore('images');
 try{
 for(const [id,asset]of assets)images.put(asset.blob,id);
 for(const [id,src]of existing){const request=images.getKey(id);request.onsuccess=()=>{if(request.result===undefined)images.put(imageBlob(src),id)}}
 tx.objectStore('state').put(snapshot,KEY);
 if(keys!==lastAssetKeys){const request=images.getAllKeys();request.onsuccess=()=>{for(const id of request.result)if(!used.has(id))images.delete(id)}}
 tx.oncomplete=resolve;tx.onabort=()=>reject(tx.error||Error('保存に失敗しました'));
 }catch(error){tx.abort();reject(error)}
 });
 lastAssetKeys=keys;
 for(const [src,asset]of assetCache){if(!used.has(asset.id))assetCache.delete(src);else{asset.persisted=true;asset.blob=null}}
}
function showStorageError(message){$("storageMessage").textContent=message;$("storageStatus").hidden=false;$("storageBackup").hidden=storageReadFailed}
function save(){
 if(storageReadFailed)return Promise.resolve(false);
 const snapshot=snapshotState();saveCount++;document.body.dataset.saving='true';
 saveQueue=saveQueue.then(()=>persistState(snapshot)).then(()=>{$("storageStatus").hidden=true;return true}).catch(error=>{showStorageError('保存に失敗しました');console.error('保存に失敗しました',error);return false}).finally(()=>{if(--saveCount===0)document.body.dataset.saving='false'});
 return saveQueue;
}
async function load(){
try{
 const stored=await readStoredState();
 const legacyJSON=stored===undefined?localStorage.getItem(KEY):null;
 const d=stored===undefined?(legacyJSON?JSON.parse(legacyJSON):null):await hydrateState(stored);
 if(d&&Array.isArray(d.sets)){
  state={sets:d.sets.map(x=>({...set(x),...(x.sourceId?{sourceId:x.sourceId,remoteKey:x.remoteKey}: {})})),progress:d.progress||{},sessions:d.sessions||{},view:d.view||null,sources:Array.isArray(d.sources)?d.sources:[]};
  for(const s of state.sets)restoreStudyDate(s,state.progress);
  // The first release silently installed this exact seed. Undo it only when untouched.
  const seedIds=["so-that-result","depend-on","relative-which-object","could-hardly-have","not-until-inversion","misleading-v-mistaken","apparently","how-adj-s-v","though-participial","physician","intended-to","provided-that","take-seriously","how-arrived","what-believed","however-adj","by-comparison","themselves-emphasis","no-longer","whose-relative","otherwise","borne-by","very-emphasis","in-some-measure","had-past-perfect-inversion","would-have-provided","far-from-ing","would-have-found","few-visible-traces","questions-which","particular","only-in-part"];
  const legacy=state.sets.find(x=>x.id==="english-translation");
  const untouched=legacy&&legacy.items.length===seedIds.length&&legacy.items.every((v,i)=>v.id===seedIds[i])&&!Object.keys(state.progress).some(k=>k.startsWith("english-translation/"));
  try{if(localStorage.getItem("kntt.reviewer.seed-cleanup.v1")!=="done"){
   if(untouched){state.sets=state.sets.filter(x=>x!==legacy);save();}
   localStorage.setItem("kntt.reviewer.seed-cleanup.v1","done");
  }}catch{}
  if(legacyJSON){if(!await save())throw Error('移行データを保存できません');localStorage.removeItem(KEY)}
  return;
 }
}catch(e){storageReadFailed=true;showStorageError('保存データを読み込めません');console.warn('保存データを読み込めません',e);return}
state={sets:[],progress:{}}
}
const selected=()=>state.sets.find(x=>x.id===active),pkey=(s,id)=>s+"/"+id,progress=(s,id)=>state.progress[pkey(s,id)]||{attempts:0,reps:0,correct:0,lapses:0,due:0},weak=p=>p.lapses>0||(p.attempts>1&&p.correct/p.attempts<.8);
function filter(scope){
 const s=selected();
 if(!s)return [];
 return s.items.filter(x=>scope!=="weak"||weak(progress(s.id,x.id)));
}
function grade(id,result,mode='cards'){let p={...progress(active,id)};p.attempts++;const counter=mode==='quiz'?'quizAttempts':'cardAttempts';p[counter]=(Number.isFinite(p[counter])?p[counter]:0)+1;if(result==="wrong"){p.lapses++;p.reps=0;p.interval=1}else{p.correct++;p.reps=result==="good"?p.reps+1:Math.max(1,p.reps);const days=result==="good"?[1,3,7,14,30,60]:[1,3,7,14];p.interval=days[Math.min(days.length-1,p.reps-1)]}const now=Date.now();selected().lastStudiedAt=now;p.due=now+DAY*p.interval;state.progress[pkey(active,id)]=p;renderSets()}

let navigationVersion=0;
function tab(name,afterRender){
 const version=++navigationVersion;
 if(name!=="sets"&&!selected())name="sets";
 const target=$(name);

 const switchScreen=async()=>{
  if(version!==navigationVersion)return;
  document.querySelectorAll(".screen").forEach(v=>v.classList.toggle("active",v===target));
  document.body.classList.toggle('study-mode',name==='cards'||name==='quiz');
  setSidebar(!document.body.classList.contains('sidebar-hidden'),false);
  if(name==="sets")renderSets();
  if(name==="list")renderList();
  if(name==="cards")await buildCards();
  if(name==="quiz"){$("quizTitle").textContent=selected().title;await restoreQuiz();}
  if(version!==navigationVersion)return;
  if(name!=='sets'&&!selected()){tab('sets');return}
  state.view={setId:active,screen:name};save();
  $("workspaceTitle").textContent=name==="sets"?"Reviewer":selected().title;
  renderSets();$("workspace").scrollTop=0;
  afterRender?.();
 };
 if(document.startViewTransition&&!window.matchMedia("(prefers-reduced-motion: reduce)").matches){
  return document.startViewTransition(switchScreen).updateCallbackDone;
 }else{
  return switchScreen();
 }
}
$("back").onclick=$("homeLink").onclick=()=>tab("sets");
document.querySelectorAll("[data-detail-back]").forEach(b=>b.onclick=()=>tab("list"));
$("openCards").onclick=()=>tab("cards");
$("openQuiz").onclick=()=>tab("quiz");
function open(s,which="list",afterRender){active=s;tab(which,afterRender);if(mobileSidebar.matches)setSidebar(false)}


function dashboardData(sets,history,sessions,now=Date.now()){
 const count=n=>Number.isFinite(n)&&n>0?Math.floor(n):0;
 const totals={attempts:0,quiz:0,cards:0,learned:0,legacy:0};
 for(const p of Object.values(history)){
 if(!p||typeof p!=='object')continue;
 const attempts=count(p.attempts),quiz=Math.min(attempts,count(p.quizAttempts)),cards=Math.min(attempts-quiz,count(p.cardAttempts));
 totals.attempts+=attempts;totals.quiz+=quiz;totals.cards+=cards;totals.legacy+=attempts-quiz-cards;
 if(attempts)totals.learned++;
 }
 const difficult=[],recommendations=[];
 for(const set of sets){
 if(!set.items.length)continue;
 let weakCount=0,due=0,unseen=0;
 const ids=new Set(set.items.map(x=>x.id));
 for(const card of set.items){
 const p=history[set.id+'/'+card.id]||{};
 if(weak(p)){weakCount++;difficult.push({set,card,lapses:count(p.lapses),accuracy:count(p.attempts)?count(p.correct)/count(p.attempts):0})}
 if(!count(p.attempts))unseen++;
 else if(Number.isFinite(p.due)&&p.due>0&&p.due<=now)due++;
 }
 const saved=sessions[set.id]||{};
 const resume=saved.quiz&&(ids.has(saved.quiz.current)||saved.quiz.queue?.some(id=>ids.has(id)))?'quiz':saved.cards?.ids?.some(id=>ids.has(id))?'cards':null;
 const priority=resume?0:weakCount?1:due?2:unseen?3:4;
 const reason=resume?(resume==='quiz'?'途中のクイズがあります':'途中の単語カードがあります'):weakCount?weakCount+'枚の苦手なカードを復習':due?due+'枚が復習のタイミング':unseen?unseen+'枚が未学習':'もう一度振り返ってみましょう';
 recommendations.push({set,resume,priority,reason,weakCount,due,unseen});
 }
 recommendations.sort((a,b)=>a.priority-b.priority||b.weakCount-a.weakCount||b.due-a.due||(a.set.lastStudiedAt||0)-(b.set.lastStudiedAt||0)||a.set.title.localeCompare(b.set.title,'ja'));
 difficult.sort((a,b)=>b.lapses-a.lapses||a.accuracy-b.accuracy||a.card.term.localeCompare(b.card.term,'ja'));
 return {totals,recommendations:recommendations.slice(0,3),difficult:difficult.slice(0,6),weakTotal:difficult.length};
}
function renderDashboard(){
 const {totals,recommendations,difficult}=dashboardData(state.sets,state.progress,state.sessions||{});
 const number=n=>n.toLocaleString('ja-JP');
 const metrics=[['学習回数',totals.attempts,'回答・評価の累計'],['クイズ回答',totals.quiz,'回'],['カード評価',totals.cards,'回'],['学習したカード',totals.learned,'枚']];
 $("dashboardMetrics").innerHTML=metrics.map(([label,value,unit])=>'<div class="dashboard-metric"><span>'+label+'</span><strong>'+number(value)+'</strong><small>'+unit+'</small></div>').join('');
 $("dashboardRecommendations").innerHTML=recommendations.length?recommendations.map(({set,resume,reason})=>'<article class="dashboard-recommendation"><p class="dashboard-reason">'+esc(reason)+'</p><h3>'+esc(set.title)+'</h3><p class="muted small">'+set.items.length+'枚 · '+(set.sourceId?'ウェブ':'ローカル')+'</p><button data-dashboard-open="'+esc(set.id)+'" data-study-mode="'+(resume||'list')+'">'+(resume?'続きから':'セットを開く')+' <span aria-hidden="true">→</span></button></article>').join(''):'<div class="dashboard-empty"><p>まだ学習できるセットがありません。</p></div>';
 $("dashboardWeakCards").innerHTML=difficult.length?difficult.map(({set,card})=>'<button type="button" class="dashboard-weak-card" data-dashboard-card="'+esc(card.id)+'" data-set-id="'+esc(set.id)+'"><span class="dashboard-weak-copy"><span class="muted small">'+esc(set.title)+'</span><strong>'+esc(card.term)+'</strong><span class="dashboard-meaning">'+esc(card.meaning)+'</span></span><span aria-hidden="true">→</span></button>').join(''):'<div class="dashboard-empty"><p>苦手なカードはまだありません。</p></div>';
}
$("sets").addEventListener('click',e=>{
 const start=e.target.closest('[data-dashboard-open]');
 if(start){open(start.dataset.dashboardOpen,start.dataset.studyMode);return}
 const card=e.target.closest('[data-dashboard-card]');
 if(card){
 $("search").value='';$("filter").value='all';
 open(card.dataset.setId,'list',()=>{
 const target=[...$("items").children].find(item=>item.dataset.cardId===card.dataset.dashboardCard);
 target?.scrollIntoView({block:'start',behavior:'auto'});
 });
 }
});

function renderSets(){
 renderDashboard();
 renderSources();
 const q=$("setSearch").value.trim().toLocaleLowerCase();
 const visible=state.sets.filter(s=>!s.sourceId).filter(s=>[s.title,s.description,s.id].some(t=>t.toLocaleLowerCase().includes(q)));
 const sorted=sortSets(visible,$("setSort").value);
 $("setGrid").innerHTML=sorted.length?sorted.map(s=>{
 const d=s.items.filter(x=>weak(progress(s.id,x.id))).length;
 return setButton(s,d);
 }).join(""):'<div class="panel muted">'+(state.sets.length?"一致する学習セットはありません。":"学習セットがありません。「作成」または「インポート」から追加してください。")+'</div>';
}
$("setSearch").oninput=()=>{if($("setSearch").value.trim()){$("localSection").open=true;$("webSection").open=true}renderSets()};
const setSort=$("setSort");
try{
 const savedSort=localStorage.getItem(SORT_KEY);
 if(Array.from(setSort.options).some(option=>option.value===savedSort))setSort.value=savedSort;
}catch(e){console.warn("並び順を読み込めません",e)}
setSort.onchange=()=>{
 try{localStorage.setItem(SORT_KEY,setSort.value)}
 catch(e){console.warn("並び順を保存できません",e)}
 renderSets();
};
$("setGrid").onclick=e=>{
 const menu=e.target.closest('[data-set-menu]');if(menu){showSetActions(menu.dataset.setMenu,menu);return}
 const b=e.target.closest('[data-open]');if(b)open(b.dataset.open);
};

const actionIcons={
 explanation:'<path d="M3 5h7a4 4 0 0 1 4 4v11a4 4 0 0 0-4-4H3zM14 9a4 4 0 0 1 4-4h3v11h-3a4 4 0 0 0-4 4"/>',
 edit:'<path d="M12 20h9M16 4l4 4-11 11-4 1 1-4z"/>',
 remove:'<path d="M4 7h16M10 11v7M14 11v7M6 7l1 14h10l1-14M9 7V4h6v3"/>'
};
function cardAction(action,id,label){
 return '<button type="button" class="icon-btn'+(action==='remove'?' danger':'')+'" data-'+action+'="'+esc(id)+'" aria-label="'+esc(label)+'" title="'+esc(label)+'"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+actionIcons[action]+'</svg></button>';
}
function renderList(){
 const s=selected();if(!s)return;
 for(const id of ["editSet","deleteSet","newItem"])$(id).hidden=!!s.sourceId;
 $("setTitle").textContent=s.title;$("setDesc").textContent=s.description;
 const vals=[["カード",s.items.length],["苦手",s.items.filter(x=>weak(progress(s.id,x.id))).length]];
 $("stats").innerHTML=vals.map(a=>'<div><strong>'+a[1]+'</strong><span>'+a[0]+'</span></div>').join("");
 const q=$("search").value.trim().toLowerCase();
 const cards=filter($("filter").value).filter(x=>[x.term,x.meaning,x.explanation].some(t=>t.toLowerCase().includes(q)));
 $("items").innerHTML=cards.length?cards.map(x=>'<article class="item" data-card-id="'+esc(x.id)+'"><div class="item-copy">'+(weak(progress(s.id,x.id))?'<span class="tag">苦手</span>':'')+'<h3>'+esc(x.term)+'</h3><p>'+esc(x.meaning)+'</p>'+((x.image||x.answerImage)?'<div class="card-thumbnails">'+imageMarkup(x.image,x.term)+imageMarkup(x.answerImage,x.meaning)+'</div>':'')+'</div><div class="item-tools">'+cardAction('explanation',x.id,x.term+'の解説・例を見る')+(s.sourceId?'':cardAction('edit',x.id,x.term+'を編集')+cardAction('remove',x.id,x.term+'を削除'))+'</div></article>').join(''):'<div class="panel muted">該当するカードはありません。</div>';
}
function showExplanation(id){
 const x=selected()?.items.find(x=>x.id===id);if(!x)return;
 $("explanationTitle").textContent=x.term;$("explanationMeaning").textContent=x.meaning;$("explanationImages").innerHTML=imageMarkup(x.image,x.term)+imageMarkup(x.answerImage,x.meaning);
 $("explanationText").textContent=x.explanation;$("explanationTextSection").hidden=!x.explanation;
 $("explanationExample").textContent=x.example;$("explanationTranslation").textContent=x.translation;
 $("explanationExampleSection").hidden=!x.example&&!x.translation;
 $("explanationEmpty").hidden=!!(x.explanation||x.example||x.translation||x.image||x.answerImage);
 $("explanationDialog").showModal();$("explanationDialog").querySelector('.dialog-body').scrollTop=0;
}
$("search").oninput=renderList;$("filter").onchange=renderList;
function session(){return (state.sessions||={})[active]||((state.sessions)[active]={})}
function buildCards(reset=false){
 if(!selected())return;
 $("cardTitle").textContent=selected().title;
 const saved=!reset&&session().cards;
 if(saved){
 $("cardScope").value=saved.scope;
 deck=saved.ids.map(id=>selected().items.find(x=>x.id===id)).filter(Boolean);
 pos=Math.min(saved.pos,Math.max(0,deck.length-1));reveal=!!saved.reveal;
 }else{deck=[...filter($("cardScope").value)];pos=0;reveal=false}
 return renderCard();
}
let cardRenderVersion=0;
async function renderCard(){const version=++cardRenderVersion;for(const button of $("cards").querySelectorAll("button:not([data-detail-back]),select"))button.disabled=true;session().cards={ids:deck.map(x=>x.id),pos,reveal,scope:$("cardScope").value};await save();if(version!==cardRenderVersion)return;for(const button of $("cards").querySelectorAll("button:not([data-detail-back]),select"))button.disabled=false;let x=deck[pos];$("cardCount").textContent=x?(pos+1)+" / "+deck.length:"0 / 0";$("cardBar").style.width=x?(100*(pos+1)/deck.length)+"%":"0%";$("grades").hidden=!x||!reveal;$("prev").disabled=pos===0;$("next").disabled=!x||pos>=deck.length-1;$("flip").disabled=!x;$("flip").textContent=reveal?"答えを隠す":"答えを見る";$("flash").scrollTop=0;$("flash").innerHTML=x?'<strong>'+esc(x.term)+'</strong>'+imageMarkup(x.image,x.term)+(reveal?'<div><b>'+esc(x.meaning)+'</b>'+imageMarkup(x.answerImage,x.meaning)+'<p class="detail">'+esc(x.explanation)+'</p><p class="example">'+esc(x.example)+'\n'+esc(x.translation)+'</p></div>':'<p class="muted">答えを思い出してから表示</p>'):'<p class="muted">対象カードがありません。</p>'}
$("restartCards").onclick=()=>buildCards(true);$("cardScope").onchange=()=>buildCards(true);$("flip").onclick=()=>{reveal=!reveal;renderCard()};$("prev").onclick=()=>{if(pos>0){pos--;reveal=false;renderCard()}};$("next").onclick=()=>{if(pos<deck.length-1){pos++;reveal=false;renderCard()}};$("shuffle").onclick=()=>{deck.sort(()=>Math.random()-.5);pos=0;reveal=false;renderCard()};document.querySelectorAll("[data-grade]").forEach(b=>b.onclick=()=>{if(!deck[pos])return;grade(deck[pos].id,b.dataset.grade);deck.splice(pos,1);pos=Math.min(pos,Math.max(deck.length-1,0));reveal=false;renderCard()});
let quizRenderVersion=0;
function resetQuizView(){
 quizRenderVersion++;$("startQuiz").disabled=false;$("quizScope").disabled=false;
 $("quizCount").textContent="";
 $("quizBar").style.width="0%";
 $("quizBody").innerHTML='<div class="flash muted">範囲を選んで「クイズ開始」を押してください。</div>';
}
function saveQuiz(){
 session().quiz={queue,current:quizCurrent,order:quizOrder,answered:quizAnswered,total:quizTotal,seen:[...firstSeen],wrong:[...wrongOnce],right:firstRight,scope:$("quizScope").value,freeDraft,freeRevealed};return save();
}
function restoreQuiz(){
 quizRenderVersion++;$("startQuiz").disabled=false;$("quizScope").disabled=false;
 const saved=session().quiz;
 if(!saved){resetQuizView();return}
 const ids=new Set(selected().items.map(x=>x.id));
 queue=saved.queue.filter(id=>ids.has(id));quizCurrent=saved.current;
 quizOrder=saved.order;quizAnswered=saved.answered;quizTotal=saved.total;freeDraft=saved.freeDraft||'';freeRevealed=!!saved.freeRevealed;
 firstSeen=new Set(saved.seen);wrongOnce=new Set(saved.wrong);firstRight=saved.right;
 $("quizScope").value=saved.scope;
 if(quizCurrent&&!ids.has(quizCurrent))return nextQuiz();
 if(quizAnswered!==null&&selected().items.find(x=>x.id===quizCurrent)?.responseMode==='free')return nextQuiz();
 renderQuiz();
}
function startQuiz(){
 queue=filter($("quizScope").value).map(x=>x.id).sort(()=>Math.random()-.5);
 quizTotal=queue.length;
 firstSeen.clear();
 wrongOnce.clear();
 firstRight=0;
 nextQuiz();
}
async function nextQuiz(){
 const version=++quizRenderVersion;
 $("quizBody").querySelectorAll("button").forEach(button=>button.disabled=true);
 quizCurrent=queue.shift()||null;quizOrder=[0,1,2,3].sort(()=>Math.random()-.5);quizAnswered=null;freeDraft='';freeRevealed=false;
 if(quizCurrent)firstSeen.add(quizCurrent);
 const setId=active;$("startQuiz").disabled=true;$("quizScope").disabled=true;await saveQuiz();if(version!==quizRenderVersion||active!==setId)return;$("startQuiz").disabled=false;$("quizScope").disabled=false;renderQuiz();
}
function renderQuiz(){
 const id=quizCurrent,x=selected()?.items.find(a=>a.id===id);
 const position=Math.min(quizTotal,firstSeen.size);
 $("quizCount").textContent=position+" / "+quizTotal;
 $("quizBar").style.width=(quizTotal?100*position/quizTotal:0)+"%";
 if(!x){
  if(!quizTotal){
   $("quizBody").innerHTML='<div class="flash muted">出題できるカードがありません。</div>';
   return;
  }
  $("quizBody").innerHTML='<div class="flash"><strong>クイズ完了</strong><span>初回正解 '+firstRight+' / '+firstSeen.size+'</span></div><div class="actions"><button class="primary" id="restart">もう一度</button></div>';
  $("restart").onclick=startQuiz;
  return;
 }
 firstSeen.add(id);
 const order=quizOrder;
 $("quizBody").innerHTML='<div class="flash" id="feedback" aria-live="polite"><strong>'+esc(x.question)+'</strong>'+imageMarkup(x.image,x.term)+'</div><div class="quiz-choices" id="quizAnswers">'+(x.responseMode==='free'?[]:order).map(i=>'<button class="choice" data-answer="'+i+'">'+esc(x.options[i])+'</button>').join("")+'</div>';
 if(x.responseMode==='free'){
 const answers=$("quizAnswers");answers.className='free-answer-form';
 answers.innerHTML='<label for="freeAnswer">回答</label><textarea id="freeAnswer" rows="3" autocapitalize="off" spellcheck="false"></textarea><button id="revealFreeAnswer" class="primary">正解例を見る</button>';
 $("freeAnswer").value=freeDraft;
 $("freeAnswer").oninput=e=>{freeDraft=e.target.value;saveQuiz()};
 $("revealFreeAnswer").onclick=async()=>{const setId=active,current=quizCurrent,version=quizRenderVersion;freeRevealed=true;$("revealFreeAnswer").disabled=true;await saveQuiz();if(active===setId&&quizCurrent===current&&version===quizRenderVersion)renderFreeAnswer(x)};
 if(freeRevealed)renderFreeAnswer(x);
 }else $("quizBody").querySelectorAll('[data-answer]').forEach(button=>button.onclick=()=>answerQuiz(x,+button.dataset.answer===x.answer));
 if(quizAnswered!==null)renderQuizFeedback(x,quizAnswered);
}
function freeAnswerContent(x){
 return (freeDraft?'<p class="detail">回答：'+esc(freeDraft)+'</p>':'')+'<p class="detail">'+esc(x.answerText)+'</p>'+imageMarkup(x.image,x.term)+imageMarkup(x.answerImage,x.meaning)+'<p class="detail">'+esc(x.explanation)+'</p>';
}
function renderFreeAnswer(x){
 $("feedback").innerHTML='<strong>正解例</strong><div>'+freeAnswerContent(x)+'</div>';
 $("quizAnswers").className='actions';$("quizAnswers").innerHTML='<button data-self-grade="wrong">不正解</button><button data-self-grade="good" class="primary">正解</button>';
 $("quizAnswers").querySelectorAll('[data-self-grade]').forEach(button=>button.onclick=()=>answerQuiz(x,button.dataset.selfGrade==='good'));
}
async function answerQuiz(x,ok){
 if(quizAnswered!==null)return;
 const setId=active,current=quizCurrent,version=quizRenderVersion;
 $("quizAnswers").querySelectorAll('button,textarea').forEach(control=>control.disabled=true);
 if(ok&&!wrongOnce.has(x.id))firstRight++;
 if(!ok){wrongOnce.add(x.id);queue.push(x.id)}
 grade(x.id,ok?'good':'wrong','quiz');quizAnswered=ok;
 if(x.responseMode==='free'){await nextQuiz();return}
 await saveQuiz();if(active===setId&&quizCurrent===current&&version===quizRenderVersion)renderQuizFeedback(x,ok);
}
function renderQuizFeedback(x,ok){
  $("feedback").innerHTML='<strong>'+(ok?'正解':'不正解 — 後で再出題')+'</strong><div>'+(x.responseMode==='free'?freeAnswerContent(x):'<p>正解：'+esc(x.options[x.answer])+'</p>'+imageMarkup(x.image,x.term)+imageMarkup(x.answerImage,x.meaning)+'<p class="detail">'+esc(x.explanation)+'</p>')+'</div>';
  $("feedback").scrollTop=0;
  const answers=$("quizAnswers");
  answers.className="actions";
  answers.innerHTML='<button id="continue" class="primary">次へ</button>';
  $("continue").onclick=()=>{
   $("continue").disabled=true;nextQuiz();
   $("quizBody").querySelector("button")?.focus({preventScroll:true});
  };
 }
$("startQuiz").onclick=startQuiz;
$("quizScope").onchange=()=>{delete session().quiz;save();resetQuizView()};
function showSet(id){editingSet=id||"";let s=state.sets.find(x=>x.id===id);$("sTitle").value=s?.title||"";$("sDesc").value=s?.description||"";$("setDialog").showModal()}
let menuSetId='',renamingSetId='';
function showSetActions(id,trigger){
 const s=state.sets.find(s=>s.id===id);if(!s)return;
 menuSetId=id;$("setActionsTitle").textContent=s.title;$("setActionsHint").hidden=!s.sourceId;
 showMenu($("setActionsPopover"),trigger);
}
function updateSetHeading(s){
 if(active!==s.id||state.view?.screen==='sets')return;
 $("workspaceTitle").textContent=s.title;$("setTitle").textContent=s.title;
 $("cardTitle").textContent=s.title;$("quizTitle").textContent=s.title;
}
async function removeSet(id){
 let s=state.sets.find(s=>s.id===id);if(!s)return;
 const note=s.sourceId?' この端末から削除し、同期時にも再表示しません。配信元を登録し直すと再取得できます。':'';
 if(!await askConfirmation('学習セット「'+s.title+'」とその学習履歴を削除しますか？'+note,{accept:'削除',title:'学習セットの削除'}))return;
 s=state.sets.find(s=>s.id===id);if(!s)return;
 const source=(state.sources||[]).find(source=>source.id===s.sourceId);
 if(source)source.dismissedKeys=[...new Set([...(source.dismissedKeys||[]),s.remoteKey])];
 state.sets=state.sets.filter(s=>s.id!==id);
 for(const key of Object.keys(state.progress))if(key.startsWith(id+'/'))delete state.progress[key];
 if(state.sessions)delete state.sessions[id];
 if(active===id){active='';state.view=null;save();tab('sets')}else save();
 renderSets();
}
$("renameSetAction").onclick=()=>{
 const s=state.sets.find(s=>s.id===menuSetId);if(!s)return;
 renamingSetId=s.id;$("renameInput").value=s.title;$("setActionsPopover").hidePopover();
 $("renameDialog").showModal();$("renameInput").focus();$("renameInput").select();
};
$("renameForm").onsubmit=e=>{
 e.preventDefault();const title=$("renameInput").value.trim();if(!title)return;
 const s=state.sets.find(s=>s.id===renamingSetId);if(!s){$("renameDialog").close();return}
 const source=(state.sources||[]).find(source=>source.id===s.sourceId);
 if(source)source.titleOverrides={...source.titleOverrides,[s.remoteKey]:title};
 s.title=title;s.updatedAt=Date.now();save();renderSets();updateSetHeading(s);$("renameDialog").close();
};
$("deleteSetAction").onclick=()=>{const id=menuSetId;$("setActionsPopover").hidePopover();removeSet(id)};
$("exportSetAction").onclick=()=>{
 const s=state.sets.find(s=>s.id===menuSetId);if(!s)return;
 $("setActionsPopover").hidePopover();
 const name=s.title.replace(/[^\p{L}\p{N}._-]+/gu,'-').slice(0,80)||'reviewer-set';
 download(name+'.json',{sets:[{title:s.title,description:s.description,items:s.items.map(({id,...fields})=>fields)}]});
};
$("deleteSet").onclick=()=>removeSet(active);$("newSet").onclick=()=>{$("createDialog").showModal();$("createTitle").focus()};
$("cancelCreate").onclick=()=>{$("createDialog").close()};
$("createForm").onsubmit=e=>{e.preventDefault();const title=$("createTitle").value.trim(),description=$("createDesc").value;if(!title)return;const id=freshSetId();state.sets.push(newSet(id,title,description));save();$("createForm").reset();$("createDialog").close();open(id)};$("editSet").onclick=()=>showSet(active);$("cancelSet").onclick=()=>$("setDialog").close();$("setForm").onsubmit=e=>{e.preventDefault();let title=$("sTitle").value.trim();if(!title)return;if(editingSet){let s=state.sets.find(x=>x.id===editingSet);s.title=title;s.description=$("sDesc").value;s.updatedAt=Date.now()}else{const id=freshSetId();state.sets.push(newSet(id,title,$("sDesc").value));active=id}save();$("setDialog").close();renderSets();if(selected())renderList()};
let editingImages={},imageGeneration=0,imageJobs={};
async function compressImage(file){
 if(file.size>20*1024*1024)throw Error('20MB以下の画像を選択してください');
 if(!['image/png','image/jpeg','image/webp','image/gif','image/avif'].includes(file.type))throw Error('対応していない画像形式です');
 const url=URL.createObjectURL(file),image=new Image();
 try{
 image.src=url;await image.decode();
 if(image.naturalWidth*image.naturalHeight>60000000)throw Error('画像を小さくしてください');
 const scale=Math.min(1,1600/Math.max(image.naturalWidth,image.naturalHeight));
 let width=Math.max(1,Math.round(image.naturalWidth*scale)),height=Math.max(1,Math.round(image.naturalHeight*scale));
 const canvas=document.createElement('canvas'),context=canvas.getContext('2d');
 for(let step=0;step<9;step++){
 canvas.width=width;canvas.height=height;context.drawImage(image,0,0,width,height);
 let blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/webp',Math.max(.6,.82-step*.03)));
 if(!blob||blob.type!=='image/webp'){
 context.fillStyle='#fff';context.fillRect(0,0,width,height);context.drawImage(image,0,0,width,height);
 blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',Math.max(.6,.82-step*.03)));
 }
 if(blob&&blob.size<=256*1024)return validateImage(await blobDataURL(blob));
 width=Math.max(1,Math.round(width*.8));height=Math.max(1,Math.round(height*.8));
 }
 throw Error('画像を小さくしてください');
 }catch(error){if(error.name==='EncodingError')throw Error('画像を読み込めません');throw error}finally{URL.revokeObjectURL(url)}
}
function updateImageEditor(){
 for(const [field,id]of [['image','iImage'],['answerImage','iAnswerImage']]){
 const preview=$(id+'Preview');preview.parentElement.hidden=!editingImages[field];
 if(editingImages[field])preview.src=editingImages[field];else preview.removeAttribute('src');
 $(id).setAttribute('aria-busy',String(!!imageJobs[field]));
 }
 $("itemForm").querySelector('[type="submit"],.dialog-footer .primary').disabled=Object.values(imageJobs).some(Boolean);
}
for(const [field,id]of [['image','iImage'],['answerImage','iAnswerImage']])$(id).onchange=async e=>{
 const file=e.target.files[0];e.target.value='';if(!file)return;
 const generation=imageGeneration,job=Symbol();imageJobs[field]=job;$("itemMessage").hidden=true;updateImageEditor();
 try{const src=await compressImage(file);if(generation===imageGeneration&&imageJobs[field]===job)editingImages[field]=src}
 catch(error){if(generation===imageGeneration&&imageJobs[field]===job){$("itemMessage").textContent=error.message;$("itemMessage").hidden=false;$("itemMessage").scrollIntoView({block:'nearest'})}}
 finally{if(generation===imageGeneration&&imageJobs[field]===job){delete imageJobs[field];updateImageEditor()}}
};
document.querySelectorAll('[data-remove-image]').forEach(button=>button.onclick=()=>{const field=button.dataset.removeImage;delete imageJobs[field];delete editingImages[field];updateImageEditor()});
$("itemDialog").addEventListener('close',()=>{imageGeneration++;imageJobs={};editingImages={}});
function updateResponseFields(){
 const free=$("iResponseMode").value==='free';
 $("choiceOptionsField").hidden=free;$("choiceAnswerField").hidden=free;$("freeAnswerField").hidden=!free;
 $("iOptions").required=!free;$("iOptions").disabled=free;$("iAnswer").disabled=free;$("iAnswerText").required=free;$("iAnswerText").disabled=!free;
}
$("iResponseMode").onchange=updateResponseFields;
function showItem(id){$("itemMessage").hidden=true;editingItem=id||"";let x=selected()?.items.find(v=>v.id===id);imageGeneration++;imageJobs={};editingImages={image:x?.image||"",answerImage:x?.answerImage||""};for(const [field,value]of Object.entries({Term:x?.term||"",Meaning:x?.meaning||"",Explanation:x?.explanation||"",Example:x?.example||"",Translation:x?.translation||"",Question:x?.question||"",ResponseMode:x?.responseMode||"choice",AnswerText:x?.answerText||x?.options?.[x.answer]||x?.meaning||"",Options:x?.options?.join("\n")||"",Answer:String(x?.answer||0)}))$("i"+field).value=value;$("itemDialog").showModal();updateResponseFields();updateImageEditor()}
$("newItem").onclick=()=>showItem("");$("cancelItem").onclick=()=>$("itemDialog").close();$("itemForm").onsubmit=async e=>{e.preventDefault();if(Object.values(imageJobs).some(Boolean))return;const generation=imageGeneration;try{let x=item({id:editingItem||freshItemId(selected().items),type:selected().items.find(v=>v.id===editingItem)?.type||"word",...editingImages,responseMode:$("iResponseMode").value,answerText:$("iAnswerText").value,term:$("iTerm").value,meaning:$("iMeaning").value,explanation:$("iExplanation").value,example:$("iExample").value,translation:$("iTranslation").value,question:$("iQuestion").value,options:$("iOptions").value.trim().split("\n"),answer:$("iAnswer").value});let s=selected();s.items=s.items.filter(a=>a.id!==editingItem);s.items.push(x);s.updatedAt=Date.now();const saved=await save();if(generation!==imageGeneration)return;if(!saved){$("itemMessage").textContent="保存に失敗しました";$("itemMessage").hidden=false;return}$("itemDialog").close();renderList()}catch(e){$("itemMessage").textContent=e.message;$("itemMessage").hidden=false;$("itemMessage").scrollIntoView({block:"nearest"})}};
$("items").onclick=async e=>{
 const b=e.target.closest('button');if(!b)return;
 if(b.dataset.explanation){showExplanation(b.dataset.explanation);return}
 const s=selected();if(!s||s.sourceId)return;
 if(b.dataset.edit)showItem(b.dataset.edit);
 if(b.dataset.remove&&await askConfirmation('このカードと履歴を削除しますか？')){
 s.items=s.items.filter(x=>x.id!==b.dataset.remove);s.updatedAt=Date.now();
 delete state.progress[pkey(s.id,b.dataset.remove)];save();renderList();renderSets();
 }
};
const sample={sets:[{title:"理科の復習",description:"用語と基本概念の学習",items:[{term:"浸透",meaning:"半透膜を介した水の移動",explanation:"水の化学ポテンシャル差により起こる。",example:"細胞と低張液",translation:"細胞内へ水が入りやすい。",question:"浸透の説明は？",options:["半透膜を通る水の移動","固体の昇華","熱だけの移動","気体の凝縮"],answer:0}]}]};
$("example").onclick=()=>$("jsonInput").value=JSON.stringify(sample,null,2);
async function importData(raw){
 const inputs=Array.isArray(raw.sets)?raw.sets:Array.isArray(raw.items)?[{title:"英文和訳の復習",description:"旧形式の教材",items:raw.items}]:Array.isArray(raw)?[{title:"取り込み教材",description:"旧形式の教材",items:raw}]:null;
 if(!inputs)throw Error("setsかitems配列が必要です");
 const includeHistory=raw&&raw.progress&&typeof raw.progress==='object'&&!Array.isArray(raw.progress)&&await askConfirmation('バックアップ内の学習履歴も取り込みますか？',{accept:'取り込む',cancel:'教材のみ',title:'バックアップの取り込み'});
 const next=JSON.parse(JSON.stringify(state)),incoming=[];
 for(const source of inputs){
  if(!source||!Array.isArray(source.items))throw Error("各セットにitems配列が必要です");
  const id=freshSetId(next.sets),assigned=[];
  // Never trust IDs from imported or AI-written content. Map old IDs only for restoring backups.
  const cards=source.items.map(input=>{
   const generated=freshItemId(assigned);
   const parsed=item({...input,id:generated});
   assigned.push(parsed);
   return parsed;
  });
  const loaded=set(newSet(id,source.title,source.description,cards));
  if(idOK(source.id)){
   loaded.createdAt=timestamp(source.createdAt)??loaded.createdAt;
   loaded.updatedAt=timestamp(source.updatedAt)??loaded.updatedAt;
  }
  next.sets.push(loaded);
  incoming.push({source,loaded});
 }
 if(includeHistory){
  for(const {source,loaded} of incoming){
   if(!idOK(source.id))continue;
   source.items.forEach((original,i)=>{
    if(!idOK(original?.id))return;
    const previous=raw.progress[source.id+"/"+original.id];
    if(previous&&typeof previous==="object"&&!Array.isArray(previous)){
     next.progress[loaded.id+"/"+loaded.items[i].id]=previous;
    }
   });
   loaded.lastStudiedAt=timestamp(source.lastStudiedAt);
   restoreStudyDate(loaded,next.progress);
  }
 }
 state=next;if(!await save())throw Error('保存に失敗しました');renderSets();return incoming.length;
}
async function doImport(t){try{$("message").textContent=await importData(JSON.parse(t))+"セットを取り込みました"}catch(e){$("message").textContent="エラー: "+e.message}}
$("importJson").onclick=()=>doImport($("jsonInput").value);$("file").onchange=async e=>{if(e.target.files[0])doImport(await e.target.files[0].text());e.target.value=""};
function download(name,data){let url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:"application/json"})),a=document.createElement("a");a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000)}
$("export").onclick=()=>download("reviewer-sets.json",{sets:state.sets.map(s=>({title:s.title,description:s.description,items:s.items.map(({id,...fields})=>fields)}))});$("backup").onclick=()=>download("reviewer-backup.json",state);
$("reset").onclick=async()=>{if(await askConfirmation("学習履歴を初期化しますか？")){state.progress={};state.sessions={};state.view=null;for(const s of state.sets)s.lastStudiedAt=null;save();renderSets();if(selected())renderList()}};
$("clear").onclick=async()=>{if(await askConfirmation("すべてのセットと履歴を削除しますか？")){state={sets:[],progress:{}};active="";save();tab("sets")}};
const promptFormat=[
"以下の要望に沿ってReviewerアプリに取り込める学習セットのJSONを作成してください。",
"出力するJSONは、開始行を```json、終了行を```とするコードブロックで囲んでください。コードブロック内は厳密なJSONのみとし、コードブロックの前後に説明文を付けないでください。",
'トップレベルは {"sets":[{"title":"セット名","description":"学習セットの説明文","items":[...]}]} としてください。',
"各学習セットはtitle、description、itemsだけを含み、学習セットのIDや識別子は絶対に出力しないでください。セット・カードのIDはアプリが自動生成します。",
"各items内のカードには term（表面）、meaning（裏面）、explanation（解説）、example（例）、translation（例の説明）、question（問題文）を含めてください。選択式はoptions（文字列4個）とanswer（正解の0始まりの番号0〜3）、自由回答はresponseModeをfree、answerTextを正解例として含めてください。数学や記述問題には自由回答を使えます。",
"カードにもIDや識別子を出力しないでください。内容に応じた自然な用語・概念を作り、正解は各問ちょうど1つにしてください。JSONとして構文が正しいことを確認してください。"
].join("\n");
$("copyPrompt").onclick=async()=>{let t=$("topic").value.trim();if(!t){$("copyStatus").textContent="学習セットの内容を入力してください";return}try{const p="学習内容の要望:\n"+t+"\n\n"+promptFormat;if(navigator.clipboard&&window.isSecureContext)await navigator.clipboard.writeText(p);else{let temp=document.createElement("textarea");temp.value=p;document.body.append(temp);temp.select();if(!document.execCommand("copy"))throw Error("copy");temp.remove()}$("copyStatus").textContent="コピーしました"}catch(e){$("copyStatus").textContent="コピーに失敗しました"}};

function prepareDialogs(){
 for(const dialog of document.querySelectorAll('dialog')){
 if(dialog.querySelector('.dialog-layout'))continue;
 const root=dialog.firstElementChild;
 const children=[...root.children],first=children.shift();
 const head=document.createElement('div');head.className='dialog-head';head.append(first);
 let footer=children.at(-1)?.classList.contains('actions')&&dialog.id!=='exportDialog'?children.pop():null;
 if(dialog.id==='importDialog'){
 footer=document.createElement('div');footer.className='actions';footer.append($("importJson"));
 }
 if(!footer){footer=document.createElement('div');footer.className='actions'}
 if(!footer.querySelector('[data-close-dialog],#cancelCreate,#cancelSet,#cancelItem')){
 const close=document.createElement('button');close.type='button';close.textContent='閉じる';close.dataset.closeDialog=dialog.id;footer.prepend(close);
 }
 footer.classList.add('dialog-footer');
 const body=document.createElement('div');body.className='dialog-body';
 for(const child of children)if(child!==$("importJson"))body.append(child);
 root.className='dialog-layout';root.replaceChildren(head,body,footer);
 const heading=head.querySelector('h2');if(heading){heading.id||=dialog.id+'Title';dialog.setAttribute('aria-labelledby',heading.id)}
 }
}
prepareDialogs();
if(window.visualViewport){
 const resizeDialogs=()=>{document.documentElement.style.setProperty('--visual-height',visualViewport.height+'px');document.documentElement.style.setProperty('--dialog-top',(visualViewport.offsetTop+visualViewport.height/2)+'px')};
 visualViewport.addEventListener('resize',resizeDialogs);visualViewport.addEventListener('scroll',resizeDialogs);resizeDialogs();
}
function askConfirmation(message,{title='確認',accept='OK',cancel='キャンセル'}={}){
 const dialog=$("confirmDialog");if(dialog.open)return Promise.resolve(false);
 $("confirmTitle").textContent=title;$("confirmMessage").textContent=message;
 $("confirmAccept").textContent=accept;$("confirmCancel").textContent=cancel;
 dialog.returnValue='';dialog.showModal();
 return new Promise(resolve=>dialog.addEventListener('close',()=>resolve(dialog.returnValue==='accept'),{once:true}));
}
$("confirmAccept").onclick=()=>$("confirmDialog").close('accept');
$("confirmCancel").onclick=()=>$("confirmDialog").close('cancel');
const menuAnchors=new WeakMap();
let pressedMenu=null,pressedMenuTrigger=null;
document.addEventListener('pointerdown',e=>{
 pressedMenu=null;pressedMenuTrigger=null;
 for(const menu of document.querySelectorAll('.floating-menu:popover-open')){
 const trigger=menuAnchors.get(menu);
 if(trigger?.contains(e.target)){pressedMenu=menu;pressedMenuTrigger=trigger;break}
 }
},true);
function placeMenu(menu){
 const trigger=menuAnchors.get(menu);if(!trigger?.isConnected){menu.hidePopover();return}
 menu.style.maxHeight='';
 const rect=trigger.getBoundingClientRect(),width=menu.offsetWidth;
 const belowSpace=innerHeight-rect.bottom-14,aboveSpace=rect.top-14;
 const opensBelow=menu.offsetHeight<=belowSpace||belowSpace>=aboveSpace;
 menu.style.maxHeight=Math.min(innerHeight-16,Math.max(80,opensBelow?belowSpace:aboveSpace))+'px';
 const height=menu.offsetHeight;
 const left=Math.max(8,Math.min(rect.right-width,innerWidth-width-8));
 const below=rect.bottom+6,above=rect.top-height-6;
 const top=Math.max(8,Math.min(opensBelow?below:above,innerHeight-height-8));
 menu.style.left=left+'px';menu.style.top=top+'px';
 menu.style.transformOrigin=(rect.right-left)+'px '+(top>=rect.bottom?'top':'bottom');
}
function showMenu(menu,trigger){
 const toggleOff=(menu.matches(':popover-open')&&menuAnchors.get(menu)===trigger)||(pressedMenu===menu&&pressedMenuTrigger===trigger);
 pressedMenu=null;pressedMenuTrigger=null;
 if(toggleOff){menu.hidePopover();return}
 menuAnchors.set(menu,trigger);menu.showPopover();placeMenu(menu);
 trigger.setAttribute('aria-expanded','true');trigger.setAttribute('aria-controls',menu.id);
 menu.querySelector('[aria-checked="true"],button')?.focus({preventScroll:true});
}
for(const menu of document.querySelectorAll('.floating-menu')){
 menu.addEventListener('beforetoggle',e=>{
 if(e.newState!=='closed')return;
 const trigger=menuAnchors.get(menu);trigger?.setAttribute('aria-expanded','false');
 if(menu.contains(document.activeElement)&&trigger?.isConnected)trigger.focus({preventScroll:true});
 });
 menu.addEventListener('keydown',e=>{
 if(!['ArrowDown','ArrowUp','Home','End'].includes(e.key))return;
 e.preventDefault();const buttons=[...menu.querySelectorAll('button:not(:disabled)')];
 let i=buttons.indexOf(document.activeElement);
 i=e.key==='Home'?0:e.key==='End'?buttons.length-1:(i+(e.key==='ArrowUp'?-1:1)+buttons.length)%buttons.length;
 buttons[i]?.focus();
 });
}
function repositionMenus(){document.querySelectorAll('.floating-menu:popover-open').forEach(placeMenu)}
window.addEventListener('resize',repositionMenus);
document.addEventListener('scroll',e=>{if(!e.target.closest?.('.floating-menu'))repositionMenus()},true);
let sortTarget='';
function updateSortButtons(){
 document.querySelectorAll('[data-sort]').forEach(b=>{
 const select=$(b.dataset.sort);b.title='並び順: '+select.selectedOptions[0].textContent;
 });
}
document.querySelectorAll('[data-sort]').forEach(b=>b.onclick=()=>{
 sortTarget=b.dataset.sort;const select=$(sortTarget);
 $("sortTitle").textContent=(sortTarget==='setSort'?'ローカル':'ウェブ')+'の並び順';
 $("sortChoices").innerHTML=Array.from(select.options).map(o=>'<button type="button" data-sort-value="'+esc(o.value)+'" role="menuitemradio" aria-checked="'+(o.selected?'true':'false')+'" aria-pressed="'+(o.selected?'true':'false')+'"><span>'+esc(o.textContent)+'</span><span aria-hidden="true">'+(o.selected?'✓':'')+'</span></button>').join('');
 showMenu($("sortPopover"),b);$("sortChoices").querySelector('[aria-pressed="true"]')?.focus();
});
$("sortChoices").onclick=e=>{
 const b=e.target.closest('[data-sort-value]');if(!b)return;
 const select=$(sortTarget);select.value=b.dataset.sortValue;select.dispatchEvent(new Event('change'));
 updateSortButtons();$("sortPopover").hidePopover();
};
$("showImport").onclick=()=>{$("importDialog").showModal();$("jsonInput").focus()};
$("showExport").onclick=()=>{$("exportDialog").showModal()};
document.querySelectorAll("[data-close-dialog]").forEach(b=>b.onclick=()=>$(b.dataset.closeDialog).close());
for(const name of ["createDialog","importDialog","exportDialog"]){const d=$(name);d.addEventListener("click",e=>{if(e.target===d)d.close()})}
$("createDialog").addEventListener("close",()=>{$("createForm").reset()});
const UI_KEY='kntt.reviewer.sidebar.v1';
let preferences={};try{preferences=JSON.parse(localStorage.getItem(UI_KEY)||'{}')||{}}catch{}
function savePreferences(){try{localStorage.setItem(UI_KEY,JSON.stringify(preferences))}catch{}}
const mobileSidebar=matchMedia('(max-width:760px)');
function setSidebar(visible,persist=true){
 const studying=document.body.classList.contains('study-mode');
 document.body.classList.toggle('sidebar-hidden',!visible);
 $("sidebar").inert=studying||!visible;
 $("sidebar").setAttribute('aria-hidden',String(studying||!visible));
 $(visible?"sidebarToggleSlot":"workspaceToggleSlot").append($("toggleSidebar"));
 document.querySelector(".right-pane").inert=!studying&&visible&&mobileSidebar.matches;
 $("toggleSidebar").setAttribute('aria-expanded',String(visible&&!studying));
 $("sidebarBackdrop").inert=studying||!visible||!mobileSidebar.matches;
 if(persist&&!mobileSidebar.matches){preferences.hidden=!visible;savePreferences()}
}
$("toggleSidebar").onclick=()=>{setSidebar(document.body.classList.contains('sidebar-hidden'));$("toggleSidebar").focus()};
$("sidebarBackdrop").onclick=()=>{setSidebar(false);$("toggleSidebar").focus()};
function setSearchOpen(open){
 $("sidebarSearch").classList.toggle('open',open);
 $("sidebarSearch").inert=!open;$("sidebarSearch").setAttribute('aria-hidden',String(!open));
 $("toggleSearch").setAttribute('aria-expanded',String(open));
 if(open)$("setSearch").focus();else{$("setSearch").value='';renderSets();$("toggleSearch").focus()}
}
$("toggleSearch").onclick=()=>setSearchOpen(!$("sidebarSearch").classList.contains('open'));
$("browseSets").onclick=()=>{setSidebar(true);$("toggleSearch").focus()};
document.addEventListener('keydown',e=>{
 if(e.key!=='Escape'||document.querySelector('dialog[open],[popover]:popover-open'))return;
 if(document.body.classList.contains('study-mode')){tab('list');return}
 if($("sidebarSearch").classList.contains('open')){setSearchOpen(false);return}
 if(mobileSidebar.matches){setSidebar(false);$("toggleSidebar").focus()}
});
mobileSidebar.addEventListener('change',()=>setSidebar(!mobileSidebar.matches&&!preferences.hidden,false));
setSidebar(!mobileSidebar.matches&&!preferences.hidden,false);
for(const id of ['localSection','webSection']){
 $(id).open=preferences[id]!==false;
 $(id).querySelector(':scope > summary').onclick=e=>{e.preventDefault();$(id).open=!$(id).open;preferences[id]=$(id).open;savePreferences()};
 $(id).addEventListener('toggle',()=>{preferences[id]=$(id).open;savePreferences()});
}
$("webSort").value=preferences.webSort||'createdAt:desc';
$("webSort").onchange=()=>{preferences.webSort=$("webSort").value;savePreferences();renderSources()};
function rememberSourceSection(section){
 const folded=new Set(preferences.folded||[]);
 if(section.open)folded.delete(section.dataset.sourceSection);else folded.add(section.dataset.sourceSection);
 preferences.folded=[...folded];savePreferences();
}
const syncing=new Set();
function sortSets(sets,value){
 const [field,order]=value.split(':');
 const result=[...sets];
 if(field==='createdAt'&&order==='desc')result.reverse();
 return result.sort((a,b)=>{
 const left=a[field],right=b[field];
 if(field==='title')return String(left).localeCompare(String(right),'ja')*(order==='asc'?1:-1);
 if(left===right)return 0;
 if(left==null)return field==='createdAt'&&order==='asc'?-1:1;
 if(right==null)return field==='createdAt'&&order==='asc'?1:-1;
 return order==='asc'?left-right:right-left;
 });
}
function setButton(s,d=null){
 return '<div class="set-row"><button class="set-open" data-open="'+esc(s.id)+'"'+(s.id===active&&state.view?.screen!=='sets'?' aria-current="page"':'')+'><h3>'+esc(s.title)+'</h3><span class="tag">'+s.items.length+' 項目'+(d===null?'':' · '+d+' 苦手')+'</span></button><button type="button" class="set-menu-button icon-btn" data-set-menu="'+esc(s.id)+'" aria-label="'+esc(s.title)+'のメニュー" title="セットの操作" aria-haspopup="menu" aria-expanded="false"><svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true"><circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/></svg></button></div>';
}
function renderSources(){
 const q=$("setSearch").value.trim().toLocaleLowerCase();
 const [field,order]=$("webSort").value.split(':');
 const sources=[...(state.sources||[])];
 sources.sort((a,b)=>{
 if(field==='title')return a.name.localeCompare(b.name,'ja')*(order==='asc'?1:-1);
 const score=source=>Math.max(0,...state.sets.filter(s=>s.sourceId===source.id).map(s=>s[field]||0));
 return (score(a)-score(b))*(order==='asc'?1:-1);
 });
 $("sources").innerHTML=sources.map(source=>{
 const sets=sortSets(state.sets.filter(s=>s.sourceId===source.id&&[s.title,s.description,source.name].some(t=>t.toLocaleLowerCase().includes(q))),$("webSort").value);
 const folded=preferences.folded?.includes(source.id)&&!q;
 return '<details class="source-group" data-source-section="'+esc(source.id)+'" '+(folded?'':'open')+'><summary>'+esc(source.name)+'</summary><div class="set-grid">'+sets.map(s=>setButton(s)).join('')+'</div><div class="source-meta">'+esc(syncing.has(source.id)?'同期中…':source.error||(source.syncedAt?'最終同期: '+new Date(source.syncedAt).toLocaleString():'未同期'))+'</div><details><summary class="source-meta">配信元の操作</summary><p class="source-meta">'+esc(source.url)+'</p><div class="source-tools"><button data-sync="'+esc(source.id)+'" '+(syncing.has(source.id)?'disabled':'')+'>同期</button><button data-copy="'+esc(source.id)+'">ローカルへコピー</button><button data-unsubscribe="'+esc(source.id)+'">登録解除</button></div></details></details>';
 }).join('')||'<p class="muted small">URLを登録して教材を同期できます。</p>';
}
function remoteInputs(raw){
 const inputs=Array.isArray(raw?.sets)?raw.sets:Array.isArray(raw?.items)?[{title:raw.title||"取り込み教材",description:raw.description,items:raw.items}]:Array.isArray(raw)?[{title:"取り込み教材",items:raw}]:null;
 if(!inputs)throw Error("setsかitems配列が必要です");
 return inputs;
}
function remoteKey(x,fallback){return typeof x?.id==='string'&&x.id?x.id:fallback}
function reconcile(source,raw){
 const previous=state.sets.filter(s=>s.sourceId===source.id),seen=new Set();
 const incoming=remoteInputs(raw).map(input=>{
 const key=remoteKey(input,String(input.title||""));
 if(seen.has(key))throw Error("セット名またはIDが重複しています");seen.add(key);
 const old=previous.find(s=>s.remoteKey===key),cardKeys=new Set();
 if(!Array.isArray(input.items))throw Error("items配列が必要です");
 const cards=input.items.map(x=>{
 const key=remoteKey(x,String(x.term||""));
 if(cardKeys.has(key))throw Error("カードのtermまたはIDが重複しています");cardKeys.add(key);
 // A deterministic local ID keeps progress when only explanations/options change.
 // item() permits bounded IDs; use a saved mapping for long or arbitrary source IDs.
 const localId=Object.hasOwn(source.cardIds,key)?source.cardIds[key]:(source.cardIds[key]=freshItemId());
 return item({...x,id:localId});
 });
 return {...set({...newSet(old?.id||freshSetId(),Object.hasOwn(source.titleOverrides||{},key)?source.titleOverrides[key]:input.title,input.description,cards),createdAt:old?.createdAt||Date.now(),lastStudiedAt:old?.lastStudiedAt}),sourceId:source.id,remoteKey:key};
 });
 state.sets=state.sets.filter(s=>s.sourceId!==source.id).concat(incoming.filter(s=>!(source.dismissedKeys||[]).includes(s.remoteKey)));
}
function sameSyncedCard(a,b){
 if(!a||!b)return a===b;
 return ['term','meaning','question','responseMode','answer','answerText','image','answerImage'].every(key=>a[key]===b[key])&&JSON.stringify(a.options)===JSON.stringify(b.options);
}
async function refreshSyncedStudy(previous){
 if(!previous)return;
 const current=state.sets.find(set=>set.id===previous.id);
 if(!current){if(active===previous.id){active='';await tab('sets')}return}
 const saved=state.sessions?.[current.id],ids=new Set(current.items.map(card=>card.id)),oldIds=new Set(previous.items.map(card=>card.id));
 const added=current.items.filter(card=>!oldIds.has(card.id)).map(card=>card.id);
 if(saved?.cards){
 const cardId=saved.cards.ids[saved.cards.pos];
 saved.cards.ids=saved.cards.ids.filter(id=>ids.has(id));
 if(saved.cards.scope==='all')saved.cards.ids.push(...added);
 saved.cards.pos=Math.max(0,saved.cards.ids.indexOf(cardId));
 if(!ids.has(cardId))saved.cards.reveal=false;
 }
 if(saved?.quiz){
 const quiz=saved.quiz;
 quiz.queue=quiz.queue.filter(id=>ids.has(id));quiz.seen=quiz.seen.filter(id=>ids.has(id));quiz.wrong=quiz.wrong.filter(id=>ids.has(id));
 if(quiz.scope==='all')quiz.queue.push(...added.filter(id=>id!==quiz.current&&!quiz.queue.includes(id)));
 if(!quiz.current&&quiz.queue.length){quiz.current=quiz.queue.shift();quiz.answered=null;quiz.freeDraft='';quiz.freeRevealed=false;if(!quiz.seen.includes(quiz.current))quiz.seen.push(quiz.current)}
 const oldCard=previous.items.find(card=>card.id===quiz.current),newCard=current.items.find(card=>card.id===quiz.current);
 if(newCard&&!sameSyncedCard(oldCard,newCard)){
 quiz.answered=null;quiz.freeDraft='';quiz.freeRevealed=false;quiz.wrong=quiz.wrong.filter(id=>id!==quiz.current);quiz.queue=quiz.queue.filter(id=>id!==quiz.current);
 }
 quiz.total=new Set([...quiz.seen,...quiz.queue,...(ids.has(quiz.current)?[quiz.current]:[])]).size;
 quiz.right=quiz.seen.filter(id=>!quiz.wrong.includes(id)&&(id!==quiz.current||quiz.answered===true)).length;
 }
 if(active!==current.id)return;
 updateSetHeading(current);
 if($('list').classList.contains('active'))renderList();
 if($('cards').classList.contains('active'))await buildCards();
 if($('quiz').classList.contains('active'))await restoreQuiz();
}
async function syncSource(source){
 if(syncing.has(source.id))return;
 syncing.add(source.id);renderSources();
 try{
 const response=await fetch(source.url,{cache:'no-store',credentials:'omit',signal:AbortSignal.timeout(20000)});
 if(!response.ok)throw Error('HTTP '+response.status);
 const raw=await response.json();
 if(!(state.sources||[]).includes(source))return;
 // Validate the entire response before replacing cached content or mappings.
 const previous=state.sets.filter(set=>set.sourceId===source.id);
 const draft={...source,cardIds:{...source.cardIds}};
 reconcile(draft,raw);source.cardIds=draft.cardIds;source.syncedAt=Date.now();source.error='';
 for(const set of previous)await refreshSyncedStudy(set);
 }catch(e){source.error='同期失敗: '+e.message+'（保存済みの教材を利用できます）'}
 finally{syncing.delete(source.id);save();renderSets()}
}
$("addSource").onclick=()=>{$("sourceMessage").textContent='';$("sourceDialog").showModal()};
$("sourceForm").onsubmit=async e=>{
 e.preventDefault();
 try{
 const url=new URL($("sourceUrl").value);if(!['https:','http:'].includes(url.protocol)||url.username||url.password)throw Error('HTTP(S)の公開URLを指定してください');
 if((state.sources||[]).some(s=>s.url===url.href))throw Error('登録済みのURLです');
 const source={id:crypto.randomUUID(),name:$("sourceName").value.trim(),url:url.href,cardIds:{}};
 if(!source.name)throw Error('セクション名が必要です');
 (state.sources||= []).push(source);save();$("sourceDialog").close();$("sourceForm").reset();await syncSource(source);
 }catch(e){$("sourceMessage").textContent=e.message}
};
$("sources").onclick=async e=>{
 const menu=e.target.closest('[data-set-menu]');if(menu){showSetActions(menu.dataset.setMenu,menu);return}
 const summary=e.target.closest('[data-source-section] > summary');
 if(summary){e.preventDefault();const section=summary.parentElement;section.open=!section.open;rememberSourceSection(section);return}
 const b=e.target.closest('button');if(!b)return;
 if(b.dataset.open){open(b.dataset.open);return}
 const id=b.dataset.sync||b.dataset.unsubscribe||b.dataset.copy,source=state.sources.find(s=>s.id===id);if(!source)return;
 if(b.dataset.sync)syncSource(source);
 if(b.dataset.copy){await importData({sets:state.sets.filter(s=>s.sourceId===id)});return}
 if(b.dataset.unsubscribe&&!syncing.has(id)&&await askConfirmation('この配信元と教材・学習履歴を削除しますか？')){
 const ids=state.sets.filter(s=>s.sourceId===id).map(s=>s.id);
 state.sets=state.sets.filter(s=>s.sourceId!==id);state.sources=state.sources.filter(s=>s.id!==id);
 for(const k of Object.keys(state.progress))if(ids.some(id=>k.startsWith(id+'/')))delete state.progress[k];save();renderSets();
 }
};
$("storageRetry").onclick=()=>storageReadFailed?location.reload():save();
$("storageBackup").onclick=()=>download('reviewer-backup.json',state);
updateSortButtons();await load();renderSets();
if(state.view&&state.sets.some(s=>s.id===state.view.setId)&&['list','cards','quiz'].includes(state.view.screen)){
 active=state.view.setId;await tab(state.view.screen);
}
document.body.dataset.ready='true';
for(const source of state.sources||[])syncSource(source);

})();