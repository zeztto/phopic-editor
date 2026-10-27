import type { FilterType } from '@/types/image';

/**
 * RGB 채널 조정
 *
 * @param ctx Canvas 2D 컨텍스트
 * @param canvas Canvas 요소
 * @param red 빨강 채널 (0-200, 기본 100)
 * @param green 초록 채널 (0-200, 기본 100)
 * @param blue 파랑 채널 (0-200, 기본 100)
 */
export function applyRGBAdjustment(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  red: number,
  green: number,
  blue: number
): void {
  // 모두 기본값이면 스킵
  if (red === 100 && green === 100 && blue === 100) {
    return;
  }

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;
  const length = data.length;

  // 성능 최적화: 비율을 미리 계산
  const rRatio = red / 100;
  const gRatio = green / 100;
  const bRatio = blue / 100;

  for (let i = 0; i < length; i += 4) {
    data[i] = Math.min(255, Math.max(0, data[i] * rRatio)); // R
    data[i + 1] = Math.min(255, Math.max(0, data[i + 1] * gRatio)); // G
    data[i + 2] = Math.min(255, Math.max(0, data[i + 2] * bRatio)); // B
    // data[i + 3]는 알파 채널 (수정하지 않음)
  }

  ctx.putImageData(imageData, 0, 0);
}

/**
 * 픽셀화 필터
 *
 * @param ctx Canvas 2D 컨텍스트
 * @param canvas Canvas 요소
 * @param pixelSize 픽셀 블록 크기 (기본 8)
 */
export function applyPixelateFilter(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  pixelSize: number = 8
): void {
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;

  for (let y = 0; y < canvas.height; y += pixelSize) {
    for (let x = 0; x < canvas.width; x += pixelSize) {
      // 블록의 첫 픽셀 색상 가져오기
      const pixelIndex = (y * canvas.width + x) * 4;
      const r = data[pixelIndex];
      const g = data[pixelIndex + 1];
      const b = data[pixelIndex + 2];
      const a = data[pixelIndex + 3];

      // 블록 전체를 같은 색상으로 채우기
      for (let dy = 0; dy < pixelSize && y + dy < canvas.height; dy++) {
        for (let dx = 0; dx < pixelSize && x + dx < canvas.width; dx++) {
          const index = ((y + dy) * canvas.width + (x + dx)) * 4;
          data[index] = r;
          data[index + 1] = g;
          data[index + 2] = b;
          data[index + 3] = a;
        }
      }
    }
  }

  ctx.putImageData(imageData, 0, 0);
}

/**
 * 엠보스 필터 (3x3 커널 컨볼루션)
 *
 * @param ctx Canvas 2D 컨텍스트
 * @param canvas Canvas 요소
 */
export function applyEmbossFilter(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement
): void {
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;
  const width = canvas.width;
  const height = canvas.height;

  // 엠보스 커널
  const kernel = [-2, -1, 0, -1, 1, 1, 0, 1, 2];

  const output = new Uint8ClampedArray(data.length);

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      let r = 0,
        g = 0,
        b = 0;

      for (let ky = -1; ky <= 1; ky++) {
        for (let kx = -1; kx <= 1; kx++) {
          const idx = ((y + ky) * width + (x + kx)) * 4;
          const weight = kernel[(ky + 1) * 3 + (kx + 1)];

          r += data[idx] * weight;
          g += data[idx + 1] * weight;
          b += data[idx + 2] * weight;
        }
      }

      const idx = (y * width + x) * 4;
      output[idx] = Math.min(255, Math.max(0, r + 128));
      output[idx + 1] = Math.min(255, Math.max(0, g + 128));
      output[idx + 2] = Math.min(255, Math.max(0, b + 128));
      output[idx + 3] = data[idx + 3]; // 알파 채널 유지
    }
  }

  for (let i = 0; i < data.length; i++) {
    data[i] = output[i];
  }

  ctx.putImageData(imageData, 0, 0);
}

/**
 * 엣지 검출 필터 (8방향)
 *
 * @param ctx Canvas 2D 컨텍스트
 * @param canvas Canvas 요소
 */
export function applyEdgeDetectionFilter(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement
): void {
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;
  const width = canvas.width;
  const height = canvas.height;

  // 엣지 검출 커널
  const kernel = [-1, -1, -1, -1, 8, -1, -1, -1, -1];

  const output = new Uint8ClampedArray(data.length);

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      let r = 0,
        g = 0,
        b = 0;

      for (let ky = -1; ky <= 1; ky++) {
        for (let kx = -1; kx <= 1; kx++) {
          const idx = ((y + ky) * width + (x + kx)) * 4;
          const weight = kernel[(ky + 1) * 3 + (kx + 1)];

          r += data[idx] * weight;
          g += data[idx + 1] * weight;
          b += data[idx + 2] * weight;
        }
      }

      const idx = (y * width + x) * 4;
      output[idx] = Math.min(255, Math.max(0, r));
      output[idx + 1] = Math.min(255, Math.max(0, g));
      output[idx + 2] = Math.min(255, Math.max(0, b));
      output[idx + 3] = data[idx + 3];
    }
  }

  for (let i = 0; i < data.length; i++) {
    data[i] = output[i];
  }

  ctx.putImageData(imageData, 0, 0);
}

/**
 * 비네팅 효과
 *
 * @param ctx Canvas 2D 컨텍스트
 * @param canvas Canvas 요소
 */
export function applyVignetteFilter(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement
): void {
  const gradient = ctx.createRadialGradient(
    canvas.width / 2,
    canvas.height / 2,
    0,
    canvas.width / 2,
    canvas.height / 2,
    Math.sqrt(
      (canvas.width / 2) * (canvas.width / 2) +
        (canvas.height / 2) * (canvas.height / 2)
    )
  );

  gradient.addColorStop(0, 'rgba(0,0,0,0)');
  gradient.addColorStop(0.5, 'rgba(0,0,0,0)');
  gradient.addColorStop(1, 'rgba(0,0,0,0.8)');

  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
}

/**
 * CSS 필터 문자열 생성
 *
 * @param filter 필터 타입
 * @param brightness 밝기
 * @param contrast 대비
 * @param saturation 채도
 * @param hue 색상 회전
 * @returns CSS 필터 문자열
 */
export function buildCSSFilterString(
  filter: FilterType,
  brightness: number,
  contrast: number,
  saturation: number,
  hue: number
): string {
  let filterString = `brightness(${brightness}%) contrast(${contrast}%) saturate(${saturation}%)`;

  if (hue !== 0) {
    filterString += ` hue-rotate(${hue}deg)`;
  }

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
      // 비네팅은 별도 처리 필요
      break;
    case 'vintage':
      filterString += ' sepia(40%) contrast(110%) brightness(105%)';
      break;
    case 'warm':
      filterString += ' sepia(30%) saturate(140%) brightness(105%)';
      break;
    case 'cool':
      filterString += ' hue-rotate(180deg) saturate(110%)';
      break;
    case 'fade':
      filterString += ' brightness(110%) contrast(90%) saturate(80%)';
      break;
    case 'sharpen':
      filterString += ' contrast(120%)';
      break;
    case 'blur':
      filterString += ' blur(2px)';
      break;
    // pixelate, emboss, edge는 픽셀 조작 필터이므로 CSS 필터 아님
    case 'none':
    default:
      break;
  }

  return filterString;
}

/**
 * 픽셀 조작이 필요한 필터인지 확인
 *
 * @param filter 필터 타입
 * @returns true면 픽셀 조작 필터
 */
export function isPixelManipulationFilter(filter: FilterType): boolean {
  return ['pixelate', 'emboss', 'edge'].includes(filter);
}

/**
 * 픽셀 조작 필터 적용
 *
 * @param ctx Canvas 2D 컨텍스트
 * @param canvas Canvas 요소
 * @param filter 필터 타입
 */
export function applyPixelManipulationFilter(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  filter: FilterType
): void {
  switch (filter) {
    case 'pixelate':
      applyPixelateFilter(ctx, canvas);
      break;
    case 'emboss':
      applyEmbossFilter(ctx, canvas);
      break;
    case 'edge':
      applyEdgeDetectionFilter(ctx, canvas);
      break;
    default:
      break;
  }
}
