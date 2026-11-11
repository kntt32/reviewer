import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {webcrypto} from 'node:crypto';
const source=readFileSync(new URL('../src/reviewer.js',import.meta.url),'utf8');
const context={atob,Blob,crypto:webcrypto};vm.createContext(context);
vm.runInContext(source.slice(source.indexOf('const idOK='),source.indexOf('function save()'))+'\nglobalThis.parseCard=item',context);
const png='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jFwoAAAAASUVORK5CYII=';
const card={id:'card',term:'question',meaning:'answer',options:['a','b','c','d'],answer:0};
test('legacy cards remain valid and front/back image data URLs round-trip',()=>{
 const legacy=context.parseCard(card);assert.equal('image' in legacy,false);
 const parsed=context.parseCard({...card,image:png,answerImage:png});assert.equal(parsed.image,png);assert.equal(parsed.answerImage,png);
});
test('images reject active formats, external URLs, invalid signatures and excessive size',()=>{
 for(const image of ['https://example.com/photo.png','javascript:alert(1)','data:image/svg+xml;base64,PHN2Zz4=','data:image/jpeg;base64,'+png.split(',')[1],'data:image/png;base64,####','x'.repeat(5600001)])assert.throws(()=>context.parseCard({...card,image}));
});
