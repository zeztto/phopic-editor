import test from 'node:test';import assert from 'node:assert/strict';
import {createLatestImageLoader} from '../src/utils/latestImageLoader';
test('later upload wins when an earlier image finishes decoding after it',async()=>{
 const pending:{resolve:(image:HTMLImageElement)=>void,reject:(error:Error)=>void}[]=[];
 const load=createLatestImageLoader(()=>new Promise((resolve,reject)=>pending.push({resolve,reject})));
 const applied:HTMLImageElement[]=[];const errors:unknown[]=[];
 const first=load(new File(['a'],'a.png'),img=>applied.push(img),err=>errors.push(err));
 const second=load(new File(['b'],'b.png'),img=>applied.push(img),err=>errors.push(err));
 const newer={width:32,height:96} as HTMLImageElement;pending[1].resolve(newer);await second;
 pending[0].resolve({width:96,height:64} as HTMLImageElement);await first;
 assert.deepEqual(applied,[newer]);assert.deepEqual(errors,[]);
});
test('a superseded failed upload cannot report a stale error over a later successful image',async()=>{
 const pending:{resolve:(image:HTMLImageElement)=>void,reject:(error:Error)=>void}[]=[];
 const load=createLatestImageLoader(()=>new Promise((resolve,reject)=>pending.push({resolve,reject})));
 const applied:HTMLImageElement[]=[];const errors:unknown[]=[];
 const first=load(new File(['a'],'a.png'),img=>applied.push(img),err=>errors.push(err));
 const second=load(new File(['b'],'b.png'),img=>applied.push(img),err=>errors.push(err));
 pending[1].resolve({width:32,height:96} as HTMLImageElement);await second;pending[0].reject(new Error('old error'));await first;
 assert.equal(applied.length,1);assert.deepEqual(errors,[]);
});
