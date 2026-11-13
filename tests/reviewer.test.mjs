import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const script=readFileSync(new URL('../src/reviewer.js',import.meta.url),'utf8');
const context=vm.createContext({});
vm.runInContext(script.slice(script.indexOf('function removeSyncedData('),script.indexOf('async function load()')),context);
test('removes synced sets, sources, history and sessions while retaining local copies',()=>{
 const local={id:'local',items:[]},copy={id:'copy',items:[]};
 const data={sets:[local,{id:'remote',sourceId:'feed',items:[]},copy],sources:[{id:'feed'}],progress:{'remote/c':{attempts:4},'local/c':{attempts:2}},sessions:{remote:{},local:{}},view:{setId:'remote',screen:'quiz'}};
 assert.equal(context.removeSyncedData(data),true);
 assert.deepEqual(data.sets,[local,copy]);assert.deepEqual(data.progress,{'local/c':{attempts:2}});
 assert.deepEqual(data.sessions,{local:{}});assert.equal(data.view,null);assert.equal('sources' in data,false);
 assert.equal(context.removeSyncedData(data),false);
});
test('source-only registration is removed and local view survives',()=>{
 const data={sets:[{id:'local'}],sources:[],view:{setId:'local',screen:'cards'}};
 assert.equal(context.removeSyncedData(data),true);assert.equal(data.view.screen,'cards');
});
