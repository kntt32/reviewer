import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const source=readFileSync(new URL('../src/reviewer.js',import.meta.url),'utf8'),context={atob,Blob};vm.createContext(context);vm.runInContext(source.slice(source.indexOf('const idOK='),source.indexOf('function save()'))+'\nglobalThis.parse=item;',context);
test('free responses support mathematical answer examples without choice fields',()=>{
 const parsed=context.parse({id:'math',term:'x² = 4 を解く',meaning:'x = ±2',responseMode:'free',answerText:'x = 2 または -2',explanation:'両辺の平方根を考える。'});
 assert.equal(parsed.answerText,'x = 2 または -2');assert.equal(parsed.responseMode,'free');assert.equal('options' in parsed,false);assert.equal('answer' in parsed,false);
 assert.equal(context.parse({id:'m',term:'Q',meaning:'A',responseMode:'free'}).answerText,'A');
 assert.throws(()=>context.parse({id:'m',term:'Q',meaning:'A',responseMode:'free',answerText:' '}));
 assert.throws(()=>context.parse({id:'m',term:'Q',meaning:'A',options:[],answer:0}));
});
