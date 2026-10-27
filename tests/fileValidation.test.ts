import test from 'node:test';import assert from 'node:assert/strict';
import {validateImageFile} from '../src/utils/fileValidation';
test('image upload validation accepts real PNG signature and rejects empty/type/header/size violations',async()=>{
 const header=new Uint8Array([137,80,78,71,13,10,26,10]);
 await validateImageFile(new File([header],'test-only.png',{type:'image/png'}));
 for(const file of [new File([],'empty.png',{type:'image/png'}),new File(['bad'],'bad.png',{type:'image/png'}),new File([header],'fake.txt',{type:'text/plain'}),new File([new Uint8Array(10*1024*1024+1)],'large.png',{type:'image/png'})])await assert.rejects(validateImageFile(file));
});
