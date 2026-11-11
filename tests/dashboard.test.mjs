import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const source=readFileSync(new URL('../src/reviewer.js',import.meta.url),'utf8');
const fn=source.slice(source.indexOf('function dashboardData('),source.indexOf('function renderDashboard('));
function data(sets,history={},sessions={}){
 const context={sets,history,sessions,weak:p=>p.lapses>0||(p.attempts>1&&p.correct/p.attempts<.8)};
 vm.createContext(context);return JSON.parse(JSON.stringify(vm.runInContext(fn+'\ndashboardData(sets,history,sessions,1000)',context)));
}
const set=(id,items=['c'])=>({id,title:id,items:items.map(id=>({id,term:id})),lastStudiedAt:0});
test('dashboard counts evaluations separately while retaining legacy and repeated attempts',()=>{
 const result=data([set('A')],{
 'A/c':{attempts:3,quizAttempts:1,cardAttempts:1},
 'B/c':{attempts:4,quizAttempts:2},
 'C/c':{attempts:3,quizAttempts:1,cardAttempts:2},
 'D/c':{attempts:2},
 'removed/c':{attempts:2,cardAttempts:2}
 });
 assert.deepEqual(result.totals,{attempts:14,quiz:4,cards:5,learned:5,legacy:5});
});
test('recommendations prioritize unfinished study, weak cards and due review; empty sets are excluded',()=>{
 const sets=['A','B','C','D','E'].map(id=>set(id));sets.push(set('empty',[]));
 const history={
 'A/c':{attempts:1,correct:1,lapses:0,due:2000},
 'B/c':{attempts:4,correct:1,lapses:3,due:2000},
 'C/c':{attempts:2,correct:2,lapses:0,due:500},
 'E/c':{attempts:2,correct:2,lapses:0,due:2000}
 };
 const result=data(sets,history,{A:{quiz:{current:'c',queue:[]}},E:{quiz:{current:null,queue:[]},cards:{ids:[]}}});
 assert.deepEqual(result.recommendations.map(r=>r.set.id),['A','B','C']);
 assert.equal(result.recommendations[0].resume,'quiz');assert.equal(result.weakTotal,1);assert.equal(result.difficult[0].set.id,'B');
 const firstStudy=data([set('new')]);assert.equal(firstStudy.recommendations[0].unseen,1);assert.equal(firstStudy.totals.attempts,0);
});
test('deleted cards are excluded from weak recommendations and invalid counts do not poison totals',()=>{
 const result=data([set('A')],{'A/old':{attempts:3,lapses:3},'A/c':{attempts:2,quizAttempts:5,cardAttempts:-1},bad:{attempts:-2}});
 assert.equal(result.weakTotal,0);assert.equal(result.totals.attempts,5);assert.equal(result.totals.quiz,2);assert.equal(result.totals.cards,0);
});
