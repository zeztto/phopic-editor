import { applyPixelateFilter } from './imageProcessing';
import type { ImageState } from '../types/image';
export type RenderState = Omit<ImageState, 'filter'> & { filter: string };

// Keep the first context request consistent for preview and exported/derived canvases.
// RGB/pixel filters read pixels during normal editing, so opt into that policy from creation.
export function getEditingContext(canvas: HTMLCanvasElement): CanvasRenderingContext2D | null {
  return canvas.getContext('2d', { willReadFrequently: true });
}

function renderNativeCanvas(canvas: HTMLCanvasElement, state: RenderState): void {
  const ctx = getEditingContext(canvas);
  if (!ctx) throw new Error('Canvas를 사용할 수 없습니다.');
  const currentState = { ...state, scale: 1 };
    const { image, rotation, brightness, contrast, saturation, red, green, blue, hue, flipH, flipV, filter, scale } = currentState;

    // 회전에 따른 이미지 크기 계산
    const rotRad = (rotation * Math.PI) / 180;
    const isRotated90or270 = rotation % 180 !== 0;
    
    // 실제 이미지 크기 (스케일 적용)
    const scaledWidth = image.width * scale;
    const scaledHeight = image.height * scale;
    
    // 회전 고려한 캔버스 크기
    const imgWidth = isRotated90or270 ? scaledHeight : scaledWidth;
    const imgHeight = isRotated90or270 ? scaledWidth : scaledHeight;

    canvas.width = imgWidth;
    canvas.height = imgHeight;

    // 캔버스 클리어
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 변환 적용
    ctx.save();
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate(rotRad);
    ctx.scale(flipH ? -1 : 1, flipV ? -1 : 1);

    // 필터 적용
    let filterString = `brightness(${brightness}%) contrast(${contrast}%) saturate(${saturation}%)`;
    
    switch (filter) {
      case 'grayscale':
        filterString += ' grayscale(100%)';
        break;
      case 'sepia':
        filterString += ' sepia(100%)';
        break;
      case 'invert':
        filterString += ' invert(100%)';
        break;
      case 'vignette':
        filterString += ' brightness(100%) contrast(100%) saturate(100%)';
        break;
      case 'vintage':
        filterString += ' sepia(50%) contrast(120%) brightness(90%)';
        break;
      case 'warm':
        filterString += ' sepia(30%) saturate(140%) brightness(105%)';
        break;
      case 'cool':
        filterString += ' hue-rotate(180deg) saturate(110%)';
        break;
      case 'fade':
        filterString += ' brightness(110%) contrast(80%) saturate(80%)';
        break;
      case 'sharpen':
        filterString += ' contrast(130%) brightness(102%)';
        break;
      case 'blur':
        filterString += ' blur(5px)';
        break;
    }
    
    // Hue 조정 추가
    if (hue !== 0) {
      filterString += ` hue-rotate(${hue}deg)`;
    }
    
    ctx.filter = filterString;

    // 이미지 그리기 (스케일 적용)
    ctx.drawImage(
      image,
      -scaledWidth / 2,
      -scaledHeight / 2,
      scaledWidth,
      scaledHeight
    );

    ctx.restore();
    
    // RGB 조정 적용 (픽셀 조작 필요)
    if (red !== 100 || green !== 100 || blue !== 100) {
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;
      
      for (let i = 0; i < data.length; i += 4) {
        data[i] = Math.min(255, Math.max(0, data[i] * (red / 100))); // Red
        data[i + 1] = Math.min(255, Math.max(0, data[i + 1] * (green / 100))); // Green
        data[i + 2] = Math.min(255, Math.max(0, data[i + 2] * (blue / 100))); // Blue
      }
      
      ctx.putImageData(imageData, 0, 0);
    }
    
    // 픽셀 기반 필터 적용
    if (filter === 'pixelate') {
      applyPixelateFilter(ctx, canvas);
    } else if (filter === 'emboss') {
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;
      const width = canvas.width;
      const output = new Uint8ClampedArray(data);
      
      for (let y = 1; y < canvas.height - 1; y++) {
        for (let x = 1; x < canvas.width - 1; x++) {
          const idx = (y * width + x) * 4;
          const topLeft = ((y - 1) * width + (x - 1)) * 4;
          const bottomRight = ((y + 1) * width + (x + 1)) * 4;
          
          for (let i = 0; i < 3; i++) {
            output[idx + i] = 128 + data[topLeft + i] - data[bottomRight + i];
          }
        }
      }
      
      for (let i = 0; i < data.length; i++) {
        data[i] = output[i];
      }
      
      ctx.putImageData(imageData, 0, 0);
    } else if (filter === 'edge') {
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;
      const width = canvas.width;
      const output = new Uint8ClampedArray(data);
      
      const kernel = [
        -1, -1, -1,
        -1,  8, -1,
        -1, -1, -1
      ];
      
      for (let y = 1; y < canvas.height - 1; y++) {
        for (let x = 1; x < canvas.width - 1; x++) {
          for (let c = 0; c < 3; c++) {
            let sum = 0;
            for (let ky = -1; ky <= 1; ky++) {
              for (let kx = -1; kx <= 1; kx++) {
                const idx = ((y + ky) * width + (x + kx)) * 4 + c;
                const k = kernel[(ky + 1) * 3 + (kx + 1)];
                sum += data[idx] * k;
              }
            }
            output[(y * width + x) * 4 + c] = Math.abs(sum);
          }
        }
      }
      
      for (let i = 0; i < data.length; i++) {
        data[i] = output[i];
      }
      
      ctx.putImageData(imageData, 0, 0);
    }

    // 비네팅 효과 적용
    if (filter === 'vignette') {
      ctx.save();
      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;
      const radius = Math.sqrt(centerX * centerX + centerY * centerY);
      
      const gradient = ctx.createRadialGradient(centerX, centerY, radius * 0.3, centerX, centerY, radius);
      gradient.addColorStop(0, 'rgba(0, 0, 0, 0)');
      gradient.addColorStop(0.7, 'rgba(0, 0, 0, 0.3)');
      gradient.addColorStop(1, 'rgba(0, 0, 0, 0.7)');
      
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.restore();
    }

}

/** Apply effects once at native resolution, then resize only the displayed canvas. */
export function renderEditedCanvas(
  canvas: HTMLCanvasElement,
  state: RenderState,
  renderScale = state.scale,
  createCanvas = () => document.createElement('canvas'),
): void {
  renderNativeCanvas(canvas, state);
  if (renderScale === 1) return;
  const native = createCanvas();
  native.width = canvas.width;
  native.height = canvas.height;
  getEditingContext(native)?.drawImage(canvas, 0, 0);
  canvas.width = Math.max(1, Math.round(native.width * renderScale));
  canvas.height = Math.max(1, Math.round(native.height * renderScale));
  getEditingContext(canvas)?.drawImage(native, 0, 0, canvas.width, canvas.height);
}

export function renderImageForExport(canvas: HTMLCanvasElement, state: RenderState): void {
  renderNativeCanvas(canvas, state);
}


/** Render a clean region in native rotated-image pixels, mapping CSS preview coordinates. */
export function renderNativeRegion(
  state: RenderState,
  region: { x: number; y: number; width: number; height: number },
  preview: { width: number; height: number },
): HTMLCanvasElement | null {
  if (preview.width <= 0 || preview.height <= 0) return null;
  const native = document.createElement('canvas');
  renderImageForExport(native, state);
  const clamp = (value: number, max: number) => Math.max(0, Math.min(max, Math.round(value)));
  const x = clamp(region.x * native.width / preview.width, native.width);
  const y = clamp(region.y * native.height / preview.height, native.height);
  const right = clamp((region.x + region.width) * native.width / preview.width, native.width);
  const bottom = clamp((region.y + region.height) * native.height / preview.height, native.height);
  if (right <= x || bottom <= y) return null;
  const output = document.createElement('canvas');
  output.width = right - x;
  output.height = bottom - y;
  getEditingContext(output)?.drawImage(native, x, y, output.width, output.height, 0, 0, output.width, output.height);
  return output;
}
