import test from 'node:test';
import 'sonner';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { create, act, type ReactTestInstance } from 'react-test-renderer';
import { createCanvas, Image as NativeImage, type Canvas } from '@napi-rs/canvas';
// Radix chooses its layout-effect adapter once at import time. Enable it for the mounted tree.
const bootstrapDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');
Object.defineProperty(globalThis, 'document', { configurable: true, writable: true, value: {} });
const { ImageEditor } = await import('../src/app/components/ImageEditor');
if (bootstrapDocument) Object.defineProperty(globalThis, 'document', bootstrapDocument);
else Reflect.deleteProperty(globalThis, 'document');

type PendingDecode = { image: NativeImage; finish: () => void };
const tick = () => new Promise<void>((resolve) => setImmediate(resolve));

// Mount the real component and call its actual input/mouse/button handlers.
// Only platform APIs are adapted: native Canvas pixels and manually completed Image decodes.
function editor(viewportHeight = 900) {
  const pending: PendingDecode[] = [];
  const downloaded: Canvas[] = [];
  const origin = { left: 0, top: 0 };
  const firstContexts: (CanvasRenderingContext2DSettings | undefined)[] = [];
  const originals = new Map<string, PropertyDescriptor | undefined>();
  function replace(name: string, value: unknown) {
    originals.set(name, Object.getOwnPropertyDescriptor(globalThis, name));
    Object.defineProperty(globalThis, name, { configurable: true, writable: true, value });
  }
  function canvas() {
    const result = createCanvas(1, 1);
    const nativeGetContext = result.getContext.bind(result);
    let requested = false;
    Object.assign(result, {
      getContext(type: '2d', options?: CanvasRenderingContext2DSettings) {
        if (!requested) { requested = true; firstContexts.push(options); }
        // Native Canvas has a fixed backend; record the browser's first-context policy separately.
        return nativeGetContext(type);
      },
      getBoundingClientRect: () => ({ left: origin.left, top: origin.top, width: result.width, height: result.height }),
      toBlob(callback: (blob: Blob) => void) {
        const copy = createCanvas(result.width, result.height);
        copy.getContext('2d').drawImage(result, 0, 0);
        downloaded.push(copy);
        callback(new Blob([new Uint8Array(result.toBuffer('image/png'))], { type: 'image/png' }));
      },
    });
    return result;
  }
  const preview = canvas();
  const element = { ownerDocument: { defaultView: globalThis }, style: {}, getBoundingClientRect: () => ({ width: 1000, height: 700, left: 0, top: 0 }), addEventListener() {}, removeEventListener() {}, focus() {}, closest() { return null; }, querySelectorAll() { return []; }, dispatchEvent() {}, scrollLeft: 0, scrollTop: 0 };
  replace('window', { HTMLInputElement: class { set value(_value: string) {} }, innerHeight: viewportHeight, addEventListener() {}, removeEventListener() {}, getComputedStyle: () => ({ animationName: 'none', animationDuration: '0s' }) });
  replace('getComputedStyle', () => ({ animationName: 'none', animationDuration: '0s' }));
  replace('document', { createElement: (name: string) => name === 'canvas' ? canvas() : { click() {} }, addEventListener() {}, removeEventListener() {} });
  replace('requestAnimationFrame', (callback: () => void) => { callback(); return 0; });
  replace('cancelAnimationFrame', () => {});
  replace('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
  replace('FileReader', class {
    onload: ((event: { target: { result: string } }) => void) | null = null;
    readAsDataURL(file: File) {
      void file.arrayBuffer().then((bytes) => this.onload?.({ target: { result: `data:${file.type};base64,${Buffer.from(bytes).toString('base64')}` } }));
    }
  });
  replace('Image', class {
    constructor() {
      const image = new NativeImage();
      const descriptor = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(image), 'src')!;
      let loaded: (() => void) | null = null;
      Object.defineProperty(image, 'onload', { get: () => null, set: (callback) => { loaded = callback; } });
      Object.defineProperty(image, 'src', { get: () => descriptor.get!.call(image), set: (value) => {
        descriptor.set!.call(image, value);
        pending.push({ image, finish: () => loaded?.() });
      } });
      return image;
    }
  });
  const nodes = new Map<string, typeof element>();
  let view: ReturnType<typeof create>;
  act(() => { view = create(createElement(ImageEditor), { createNodeMock: (node) => { if (node.type === 'canvas') return preview; const key = node.props.id ?? `${node.type}-${node.props['data-slot']}-${node.props.role}`; if (!nodes.has(key)) nodes.set(key, { ...element }); return nodes.get(key); } }); });
  const root = () => view!.root;
  const button = (label: string) => root().findAllByType('button').find((node) => node.props['aria-label'] === label) ?? root().findAllByType('button').reverse().find((node) => node.children.join('') === label && typeof node.props.onClick === 'function')!;
  async function selectFile(width = 96, height = 64) {
    const source = createCanvas(width, height); const ctx = source.getContext('2d');
    ctx.fillStyle = '#ff0000'; ctx.fillRect(0, 0, width / 2, height / 2);
    ctx.fillStyle = '#00ff00'; ctx.fillRect(width / 2, 0, width / 2, height / 2);
    ctx.fillStyle = '#0000ff'; ctx.fillRect(0, height / 2, width / 2, height / 2);
    ctx.fillStyle = 'rgba(255,255,255,.5)'; ctx.fillRect(width / 2, height / 2, width / 2, height / 2);
    const file = new File([new Uint8Array(source.toBuffer('image/png'))], 'own-test.png', { type: 'image/png' });
    const before = pending.length;
    await act(async () => { root().findByProps({ 'aria-label': '이미지 파일 선택' }).props.onChange({ target: { files: [file], value: '' } }); await tick(); });
    assert.equal(pending.length, before + 1);
    return pending[before];
  }
  async function finish(decode: PendingDecode) { await act(async () => { await decode.image.decode(); decode.finish(); await tick(); }); }
  function click(label: string) { act(() => button(label).props.onClick()); }
  function zoom(scale: number) {
    const input = () => root().findAllByType('input').find((node) => node.props.placeholder === '100')!;
    act(() => input().props.onChange({ target: { value: String(scale * 100) } }));
    act(() => input().props.onBlur());
  }
  function drag(mode: '크롭' | '영역선택', scale: number) {
    click(mode);
    const node = () => root().findByType('canvas');
    act(() => node().props.onMouseDown({ clientX: Math.floor(origin.left + 8 * scale), clientY: Math.floor(origin.top + 8 * scale), nativeEvent: { offsetX: 8 * scale, offsetY: 8 * scale } }));
    act(() => node().props.onMouseMove({ clientX: Math.floor(origin.left + 56 * scale), clientY: Math.floor(origin.top + 40 * scale), nativeEvent: { offsetX: 56 * scale, offsetY: 40 * scale } }));
    act(() => node().props.onMouseUp());
  }
  function textInputInTab(value: string, index: number): ReactTestInstance {
    const tab = root().findAllByType('div').filter((node) => node.props.role === 'tabpanel').find((node) => node.props.id?.endsWith(`content-${value}`))!;
    return tab.findAllByType('input').filter((node) => node.props.type === 'text')[index];
  }
  function tab(value: 'canvas' | 'resize' | 'adjust' | 'filter') {
    const node = root().findAllByType('button').filter((node) => node.props.role === 'tab').find((entry) => entry.props['aria-controls']?.endsWith(`content-${value}`))!;
    act(() => node.props.onMouseDown({ button: 0, ctrlKey: false, preventDefault() {} }));
  }
  return { origin, firstContexts, adjustment: (label: string) => root().findAll((node) => node.props['aria-label'] === label && typeof node.props.onValueChange === 'function')[0], inputs: () => root().findAllByType('input'), presets: () => root().findAllByType('button').filter((node) => node.props.style?.backgroundColor), sliders: () => root().findAllByType('span').filter((node) => node.props.role === 'slider'), pending, downloaded, preview, selectFile, finish, click, zoom, drag, tab, textInputInTab, button,
    close() { act(() => view!.unmount()); for (const [name, descriptor] of originals) { if (descriptor) Object.defineProperty(globalThis, name, descriptor); else Reflect.deleteProperty(globalThis, name); } },
  };
}

for (const scale of [0.5, 1, 2]) {
  test(`actual crop handler maps ${scale * 100}% preview coordinates to native pixels`, async () => {
    const app = editor();
    try {
      await app.finish(await app.selectFile()); app.zoom(scale);
      app.drag('크롭', scale);
      const crop = app.pending[app.pending.length - 1]; await crop.image.decode();
      assert.deepEqual([crop.image.width, crop.image.height], [48, 32]);
      const pixels = createCanvas(48, 32); pixels.getContext('2d').drawImage(crop.image, 0, 0);
      assert.deepEqual([...pixels.getContext('2d').getImageData(0, 0, 1, 1).data], [255, 0, 0, 255]);
      await app.finish(crop); assert.equal(app.button('실행 취소').props.disabled, false);
    } finally { app.close(); }
  });
  test(`actual selection handler exports clean native pixels at ${scale * 100}% without green overlay`, async () => {
    const app = editor();
    try {
      await app.finish(await app.selectFile()); app.zoom(scale); app.drag('영역선택', scale);
      assert.equal(app.downloaded.length, 1); const output = app.downloaded[0];
      assert.deepEqual([output.width, output.height], [48, 32]);
      // At the selection's top-left, the live preview contains the green stroke/fill.
      assert.deepEqual([...output.getContext('2d').getImageData(0, 0, 1, 1).data], [255, 0, 0, 255]);
      assert.deepEqual([...output.getContext('2d').getImageData(47, 31, 1, 1).data], [255, 255, 255, 128]);
    } finally { app.close(); }
  });
}
for (const operation of ['crop', 'resize', 'expand'] as const) {
  for (const completion of ['before-upload-decodes', 'after-upload-decodes'] as const) {
    test(`actual ${operation} handler discards late edit ${completion} after a new file is selected`, async () => {
      const app = editor();
      try {
        await app.finish(await app.selectFile()); app.zoom(1);
        if (operation === 'crop') app.drag('크롭', 1);
        else {
          app.tab(operation === 'expand' ? 'canvas' : 'resize');
          act(() => app.textInputInTab(operation === 'expand' ? 'canvas' : 'resize', 0).props.onChange({ target: { value: operation === 'resize' ? '48' : '120' } }));
          app.click(operation === 'resize' ? '조정' : '확장');
        }
        const oldEdit = app.pending[app.pending.length - 1];
        const upload = await app.selectFile(32, 96);
        if (completion === 'before-upload-decodes') {
          await app.finish(oldEdit); app.tab('canvas');
          assert.equal(app.button('실행 취소').props.disabled, false);
          assert.equal(app.preview.width, 96);
          await app.finish(upload);
        } else { await app.finish(upload); await app.finish(oldEdit); }
        assert.equal(app.button('실행 취소').props.disabled, true);
        app.tab('canvas');
        assert.deepEqual([app.textInputInTab('canvas', 0).props.value, app.textInputInTab('canvas', 1).props.value], ['32', '96']);
      } finally { app.close(); }
    });
  }
}


test('actual seven Radix slider thumbs expose their adjustment names', async () => {
  const app = editor();
  try {
    await app.finish(await app.selectFile());
    assert.deepEqual(app.sliders().map((node) => node.props['aria-label']), ['밝기', '대비', '채도', '빨강 채널', '초록 채널', '파랑 채널', '색상 회전']);
    assert.ok(app.sliders().every((node) => node.props['aria-valuenow'] !== undefined));
  } finally { app.close(); }
});


for (const viewportHeight of [900, 768]) {
  test(`actual initial fit and fit button reserve canvas padding at viewport height ${viewportHeight}`, async () => {
    const app = editor(viewportHeight);
    try {
      await app.finish(await app.selectFile(1200, 1000));
      const maximumImageHeight = Math.floor(viewportHeight * 0.7 - 40);
      assert.ok(app.preview.height <= maximumImageHeight, `initial image height ${app.preview.height} must leave40px canvas padding`);
      app.zoom(1); app.click('화면에 맞추기');
      assert.ok(app.preview.height <= maximumImageHeight, `fit image height ${app.preview.height} must leave40px canvas padding`);
    } finally { app.close(); }
  });
}

test('actual zoom, canvas, resize and aspect controls have explicit accessible names', async () => {
  const app = editor();
  try {
    await app.finish(await app.selectFile());
    const visibleInputs = () => app.inputs().filter((node) => node.props.style?.display !== 'none' && node.props.type !== 'file');
    assert.deepEqual(visibleInputs().map((node) => node.props['aria-label']), ['배율', '캔버스 너비', '캔버스 높이', '캔버스 배경색']);
    assert.deepEqual(app.presets().map((node) => node.props['aria-label']), ['배경색 흰색', '배경색 검정', '배경색 밝은 회색', '배경색 파랑']);
    app.tab('resize');
    assert.deepEqual(visibleInputs().map((node) => node.props['aria-label']), ['배율', '리사이즈 너비', '리사이즈 높이', '비율 유지']);
  } finally { app.close(); }
});


test('actual RGB edit/reset/blur and selection use the same policy on each first Canvas context', async () => {
  const app = editor();
  try {
    await app.finish(await app.selectFile()); app.zoom(1);
    act(() => app.adjustment('빨강 채널').props.onValueChange([92]));
    act(() => app.adjustment('빨강 채널').props.onValueCommit([92]));
    app.click('조정값 초기화'); app.tab('filter'); app.click('블러'); app.drag('영역선택', 1);
    assert.ok(app.firstContexts.length >= 2);
    assert.ok(app.firstContexts.every((options) => options?.willReadFrequently === true), 'all actual preview/region contexts must opt in before their first getContext call');
  } finally { app.close(); }
});


for (const mode of ['영역선택', '크롭'] as const) {
  test(`actual ${mode} uses native relative pointer offsets at fractional canvas bounds and preserves every ROI pixel`, async () => {
    const app = editor();
    try {
      const source = await app.selectFile(); await app.finish(source); app.zoom(0.5);
      app.origin.left = 688.5; app.origin.top = 225.5;
      const expected = createCanvas(48, 32);
      expected.getContext('2d').drawImage(source.image, 8, 8, 48, 32, 0, 0, 48, 32);
      app.drag(mode, 0.5);
      let output: Canvas;
      if (mode === '영역선택') output = app.downloaded[0];
      else {
        const crop = app.pending[app.pending.length - 1]; await crop.image.decode();
        output = createCanvas(crop.image.width, crop.image.height); output.getContext('2d').drawImage(crop.image, 0, 0);
      }
      assert.deepEqual([output.width, output.height], [48, 32]);
      assert.deepEqual([...output.getContext('2d').getImageData(0, 0, 48, 32).data], [...expected.getContext('2d').getImageData(0, 0, 48, 32).data]);
    } finally { app.close(); }
  });
}
