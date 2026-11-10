import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {webcrypto} from 'node:crypto';
const html=readFileSync(new URL('../src/reviewer.html',import.meta.url),'utf8');
const script=html.match(/<script>([\s\S]*)<\/script>/)[1];
function harness(){
 const start=script.indexOf('function remoteInputs'),end=script.indexOf('async function syncSource');
 const core=script.slice(script.indexOf('const idOK='),script.indexOf('function save()'));
 const context={crypto:webcrypto,state:{sets:[],progress:{}},DAY:86400000};
 vm.createContext(context);
 vm.runInContext(core+'\n'+script.slice(start,end)+'\nglobalThis.reconcile=reconcile;',context);
 return context;
}
const card={term:'hello',meaning:'こんにちは',options:['a','b','c','d'],answer:0};
test('remote update preserves identities and progress; invalid update is atomic',()=>{
 const c=harness(),source={id:'remote',cardIds:{}};
 c.state.sets=[{id:'local',items:[]}];
 c.reconcile(source,{sets:[{title:'English',items:[card]}]});
 const before=c.state.sets[1],id=before.items[0].id;
 c.state.progress[before.id+'/'+id]={attempts:3};
 c.reconcile(source,{sets:[{title:'English',items:[{...card,meaning:'更新'}]}]});
 assert.equal(c.state.sets[1].id,before.id);assert.equal(c.state.sets[1].items[0].id,id);
 assert.equal(c.state.progress[before.id+'/'+id].attempts,3);
 assert.throws(()=>c.reconcile(source,{sets:[{title:'English',items:[{...card,options:[]}]}]}));
 assert.equal(c.state.sets[1].items[0].meaning,'更新');assert.equal(c.state.sets[0].id,'local');
});
test('duplicate names rejected and explicit IDs support renamed content',()=>{
 const c=harness(),source={id:'remote',cardIds:{}};
 c.reconcile(source,{sets:[{id:'s',title:'A',items:[{...card,id:'c'}]}]});
 const old=c.state.sets[0];
 c.reconcile(source,{sets:[{id:'s',title:'B',items:[{...card,id:'c',term:'renamed'}]}]});
 assert.equal(c.state.sets[0].id,old.id);assert.equal(c.state.sets[0].items[0].id,old.items[0].id);
 assert.throws(()=>c.reconcile(source,{sets:[{title:'A',items:[]},{title:'A',items:[]}]}));
});
