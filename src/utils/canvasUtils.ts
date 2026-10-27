import { CRYPTO_UTILS, APP_CONSTANTS } from './constants';
import type { DownloadFormat } from '@/types/image';

/**
 * 안전한 파일명 생성
 * Math.random() 대신 crypto.randomUUID() 사용
 *
 * @param format 다운로드 형식 (png, jpg, webp)
 * @returns 생성된 파일명
 */
export function generateFileName(format: DownloadFormat): string {
  const secureId = CRYPTO_UTILS.generateSecureId();
  const now = new Date();

  // 타임스탬프 생성 (YYYYMMDDHHMMSS)
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  const timestamp = `${year}${month}${day}${hours}${minutes}${seconds}`;

  // UUID의 앞 8자만 사용
  const shortId = secureId.slice(0, 8);

  return `${APP_CONSTANTS.FILE_NAME_PREFIX}_${shortId}_${timestamp}.${format}`;
}

/**
 * Canvas를 Blob으로 변환
 *
 * @param canvas Canvas 요소
 * @param format 다운로드 형식
 * @returns Blob 객체
 */
export async function canvasToBlob(
  canvas: HTMLCanvasElement,
  format: DownloadFormat
): Promise<Blob> {
  const mimeType = format === 'jpg' ? 'image/jpeg' : `image/${format}`;
  const quality = format === 'jpg' ? 0.95 : undefined;

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error('Canvas를 Blob으로 변환하는데 실패했습니다.'));
        }
      },
      mimeType,
      quality
    );
  });
}

/**
 * Canvas 메모리 정리
 * 임시 canvas의 메모리를 해제하여 메모리 누수 방지
 *
 * @param canvas 정리할 Canvas 요소
 */
export function cleanupCanvas(canvas: HTMLCanvasElement | null): void {
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }

  // Canvas 크기를 0으로 설정하여 메모리 해제
  canvas.width = 0;
  canvas.height = 0;
}

/**
 * 이미지 다운로드
 *
 * @param canvas Canvas 요소
 * @param format 다운로드 형식
 */
export async function downloadImage(
  canvas: HTMLCanvasElement,
  format: DownloadFormat
): Promise<void> {
  try {
    const blob = await canvasToBlob(canvas, format);
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = generateFileName(format);
    link.click();

    // 메모리 정리
    setTimeout(() => {
      URL.revokeObjectURL(url);
    }, 100);
  } catch (error) {
    throw new Error(
      '이미지 다운로드에 실패했습니다: ' +
        (error instanceof Error ? error.message : '알 수 없는 오류')
    );
  }
}

/**
 * 이미지 로드
 *
 * @param file 이미지 파일
 * @returns HTMLImageElement
 */
export function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      const img = new Image();

      img.onload = () => {
        resolve(img);
      };

      img.onerror = () => {
        reject(new Error('이미지 로드에 실패했습니다.'));
      };

      if (e.target?.result) {
        img.src = e.target.result as string;
      } else {
        reject(new Error('파일을 읽는데 실패했습니다.'));
      }
    };

    reader.onerror = () => {
      reject(new Error('파일을 읽는데 실패했습니다.'));
    };

    reader.readAsDataURL(file);
  });
}

/**
 * 화면에 맞춰 자동 스케일 계산
 *
 * @param imageWidth 이미지 너비
 * @param imageHeight 이미지 높이
 * @param maxWidth 최대 너비
 * @param maxHeight 최대 높이
 * @returns 계산된 스케일
 */
export function calculateFitScale(
  imageWidth: number,
  imageHeight: number,
  maxWidth: number,
  maxHeight: number
): number {
  const scaleX = maxWidth / imageWidth;
  const scaleY = maxHeight / imageHeight;
  return Math.min(scaleX, scaleY, 1); // 최대 1(100%)까지만
}

/**
 * 회전 각도에 따른 Canvas 크기 계산
 *
 * @param width 원본 너비
 * @param height 원본 높이
 * @param rotation 회전 각도 (도)
 * @returns 계산된 Canvas 크기
 */
export function calculateRotatedSize(
  width: number,
  height: number,
  rotation: number
): { width: number; height: number } {
  const rad = (rotation * Math.PI) / 180;
  const cos = Math.abs(Math.cos(rad));
  const sin = Math.abs(Math.sin(rad));

  return {
    width: Math.ceil(width * cos + height * sin),
    height: Math.ceil(width * sin + height * cos),
  };
}
