/**
 * PhoPic 애플리케이션 상수
 */

export const APP_CONSTANTS = {
  // 파일 크기 제한 (10MB)
  MAX_FILE_SIZE: 10 * 1024 * 1024,

  // 히스토리 최대 개수 (메모리 누수 방지)
  MAX_HISTORY_SIZE: 50,

  // 지원하는 이미지 형식
  SUPPORTED_FORMATS: [
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
  ] as const,

  // 파일명 접두사
  FILE_NAME_PREFIX: 'w.store_phopic',
} as const;

/**
 * 암호학적으로 안전한 유틸리티 함수
 */
export const CRYPTO_UTILS = {
  /**
   * 암호학적으로 안전한 고유 ID 생성
   * Math.random() 대신 crypto.randomUUID() 또는 crypto.getRandomValues() 사용
   */
  generateSecureId: (): string => {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    // Fallback for older browsers
    const array = new Uint8Array(16);
    crypto.getRandomValues(array);
    return Array.from(array, (byte) => byte.toString(16).padStart(2, '0')).join(
      ''
    );
  },
} as const;

/**
 * 기본 이미지 설정
 */
export const IMAGE_DEFAULTS = {
  BRIGHTNESS: 100,
  CONTRAST: 100,
  SATURATION: 100,
  RED: 100,
  GREEN: 100,
  BLUE: 100,
  HUE: 0,
  SCALE: 1,
  ROTATION: 0,
} as const;

/**
 * 슬라이더 범위 설정
 */
export const SLIDER_RANGES = {
  BRIGHTNESS: { min: 0, max: 200, step: 1 },
  CONTRAST: { min: 0, max: 200, step: 1 },
  SATURATION: { min: 0, max: 200, step: 1 },
  RGB: { min: 0, max: 200, step: 1 },
  HUE: { min: 0, max: 360, step: 1 },
  ZOOM: { min: 0.1, max: 5, step: 0.1 },
} as const;
