/**
 * PhoPic 이미지 편집기 타입 정의
 */

/**
 * 필터 타입
 */
export type FilterType =
  | 'none'
  | 'grayscale'
  | 'sepia'
  | 'invert'
  | 'vignette'
  | 'vintage'
  | 'warm'
  | 'cool'
  | 'fade'
  | 'sharpen'
  | 'blur'
  | 'pixelate'
  | 'emboss'
  | 'edge';

/**
 * 크롭 영역
 */
export interface CropArea {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * 포인트 (좌표)
 */
export interface Point {
  x: number;
  y: number;
}

/**
 * 선택 영역
 */
export interface Selection extends CropArea {
  scale: number;
}

/**
 * 다운로드 형식
 */
export type DownloadFormat = 'png' | 'jpg' | 'webp';

/**
 * 이미지 상태
 * 이미지 편집의 모든 상태를 포함
 */
export interface ImageState {
  /** 원본 이미지 객체 */
  image: HTMLImageElement;

  /** 회전 각도 (0, 90, 180, 270) */
  rotation: number;

  /** 밝기 (0-200, 기본 100) */
  brightness: number;

  /** 대비 (0-200, 기본 100) */
  contrast: number;

  /** 채도 (0-200, 기본 100) */
  saturation: number;

  /** 빨강 채널 (0-200, 기본 100) */
  red: number;

  /** 초록 채널 (0-200, 기본 100) */
  green: number;

  /** 파랑 채널 (0-200, 기본 100) */
  blue: number;

  /** 색상 회전 (0-360) */
  hue: number;

  /** 좌우 반전 여부 */
  flipH: boolean;

  /** 상하 반전 여부 */
  flipV: boolean;

  /** 적용된 필터 */
  filter: FilterType;

  /** 확대/축소 배율 */
  scale: number;

  /** 크롭 영역 (null이면 크롭 안함) */
  cropArea: CropArea | null;
}

/**
 * 이미지 에디터 설정
 */
export interface ImageEditorConfig {
  /** 최대 파일 크기 (바이트) */
  maxFileSize: number;

  /** 최대 히스토리 크기 */
  maxHistorySize: number;

  /** 지원하는 파일 형식 */
  supportedFormats: readonly string[];
}

/**
 * 캔버스 크기
 */
export interface CanvasSize {
  width: number;
  height: number;
}

/**
 * 종횡비 프리셋
 */
export type AspectRatioPreset =
  | 'free'
  | '1:1'
  | '16:9'
  | '9:16'
  | '4:3'
  | '3:2'
  | '2:3';

/**
 * 확장/크롭 모드
 */
export type CanvasMode = 'expand' | 'crop';

/**
 * 툴 타입
 */
export type ToolType =
  | 'select'
  | 'crop'
  | 'hand'
  | 'none';
