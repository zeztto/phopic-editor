import test from 'node:test';
import assert from 'node:assert/strict';
import { createCanvas, loadImage } from '@napi-rs/canvas';
import { renderEditedCanvas, renderImageForExport, type RenderState } from '../src/utils/renderCanvas';

async function fixture(filter='none'):Promise<RenderState>{
 const source=createCanvas(16,16);const ctx=source.getContext('2d');
 ctx.fillStyle='#cc2244';ctx.fillRect(0,0,8,8);ctx.fillStyle='#33cc66';ctx.fillRect(8,0,8,8);ctx.fillStyle='#2244cc';ctx.fillRect(0,8,8,8);ctx.fillStyle='rgba(255,255,255,0.5)';ctx.fillRect(8,8,8,8);
 const image=await loadImage(source.toBuffer('image/png'));
 return {image:image as unknown as HTMLImageElement,rotation:0,brightness:100,contrast:100,saturation:100,red:100,green:100,blue:100,hue:0,flipH:false,flipV:false,filter,scale:1,cropArea:null};
}
const formats=['none','grayscale','sepia','invert','vignette','vintage','warm','cool','fade','sharpen','blur','pixelate','emboss','edge'];
for(const filter of formats)test(`native Canvas export matches preview pixels for ${filter}`,async()=>{
 const state=await fixture(filter);const preview=createCanvas(1,1);const output=createCanvas(1,1);
 renderEditedCanvas(preview as unknown as HTMLCanvasElement,state,1);renderImageForExport(output as unknown as HTMLCanvasElement,state);
 assert.deepEqual([...output.getContext('2d').getImageData(0,0,16,16).data],[...preview.getContext('2d').getImageData(0,0,16,16).data]);
});
test('pixelation preserves alpha and export preserves original resolution while preview zooms',async()=>{
 const state=await fixture('pixelate');const preview=createCanvas(1,1);const output=createCanvas(1,1);
 renderEditedCanvas(preview as unknown as HTMLCanvasElement,state,0.5,()=>createCanvas(1,1) as unknown as HTMLCanvasElement);renderImageForExport(output as unknown as HTMLCanvasElement,state);
 assert.deepEqual([preview.width,preview.height],[8,8]);assert.deepEqual([output.width,output.height],[16,16]);
 assert.equal(output.getContext('2d').getImageData(12,12,1,1).data[3],128);
});

for (const scale of [0.5, 2]) for (const filter of ['pixelate', 'blur', 'emboss', 'edge', 'vignette']) {
 test(`zoom ${scale * 100}% displays native ${filter} effect with display-only resampling`, async () => {
  const state = await fixture(filter); state.scale = scale;
  const native = createCanvas(1, 1); renderImageForExport(native as unknown as HTMLCanvasElement, state);
  const expected = createCanvas(16 * scale, 16 * scale);
  expected.getContext('2d').drawImage(native, 0, 0, expected.width, expected.height);
  const preview = createCanvas(1, 1);
  renderEditedCanvas(preview as unknown as HTMLCanvasElement, state, scale, () => createCanvas(1, 1) as unknown as HTMLCanvasElement);
  assert.deepEqual([...preview.getContext('2d').getImageData(0, 0, preview.width, preview.height).data], [...expected.getContext('2d').getImageData(0, 0, expected.width, expected.height).data]);
 });
}
