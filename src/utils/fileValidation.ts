import { APP_CONSTANTS } from './constants';

/**
 * 이미지 파일 시그니처 (매직 넘버)
 * 각 이미지 형식의 파일 헤더를 검증하기 위한 바이트 시퀀스
 */
const FILE_SIGNATURES: Record<string, number[]> = {
  'image/jpeg': [0xff, 0xd8, 0xff],
  'image/png': [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
  'image/gif': [0x47, 0x49, 0x46],
  'image/webp': [0x52, 0x49, 0x46, 0x46], // RIFF 헤더
};

/**
 * 이미지 파일 검증 오류
 */
export class FileValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FileValidationError';
  }
}

/**
 * 파일 크기 검증
 */
function validateFileSize(file: File): void {
  if (file.size > APP_CONSTANTS.MAX_FILE_SIZE) {
    const sizeMB = (APP_CONSTANTS.MAX_FILE_SIZE / (1024 * 1024)).toFixed(0);
    throw new FileValidationError(
      `파일 크기는 ${sizeMB}MB를 초과할 수 없습니다.`
    );
  }

  if (file.size === 0) {
    throw new FileValidationError('파일이 비어 있습니다.');
  }
}

/**
 * MIME 타입 검증
 */
function validateMimeType(file: File): void {
  if (!file.type.startsWith('image/')) {
    throw new FileValidationError('이미지 파일만 업로드할 수 있습니다.');
  }

  if (!APP_CONSTANTS.SUPPORTED_FORMATS.includes(file.type as any)) {
    throw new FileValidationError(
      `지원하지 않는 이미지 형식입니다. (지원 형식: JPEG, PNG, GIF, WebP)`
    );
  }
}

/**
 * 파일 헤더(매직 넘버) 검증
 * 파일의 실제 내용이 MIME 타입과 일치하는지 확인
 */
async function validateFileHeader(file: File): Promise<void> {
  const signature = FILE_SIGNATURES[file.type];

  if (!signature) {
    throw new FileValidationError('지원하지 않는 이미지 형식입니다.');
  }

  try {
    // 파일의 첫 바이트들을 읽어옴
    const headerBytes = signature.length;
    const buffer = await file.slice(0, headerBytes).arrayBuffer();
    const bytes = new Uint8Array(buffer);

    // WebP는 특별 처리 (RIFF + WEBP 체크)
    if (file.type === 'image/webp') {
      // RIFF 헤더 체크
      const isRIFF = signature.every((byte, i) => bytes[i] === byte);
      if (!isRIFF) {
        throw new FileValidationError(
          '파일이 손상되었거나 유효하지 않은 이미지입니다.'
        );
      }

      // WEBP 시그니처 체크 (8-11 바이트)
      const webpBuffer = await file.slice(8, 12).arrayBuffer();
      const webpBytes = new Uint8Array(webpBuffer);
      const webpSignature = [0x57, 0x45, 0x42, 0x50]; // "WEBP"
      const isWebP = webpSignature.every((byte, i) => webpBytes[i] === byte);

      if (!isWebP) {
        throw new FileValidationError(
          '파일이 손상되었거나 유효하지 않은 WebP 이미지입니다.'
        );
      }
    } else {
      // 다른 형식들은 시그니처 직접 비교
      const isValid = signature.every((byte, i) => bytes[i] === byte);
      if (!isValid) {
        throw new FileValidationError(
          '파일이 손상되었거나 유효하지 않은 이미지입니다.'
        );
      }
    }
  } catch (error) {
    if (error instanceof FileValidationError) {
      throw error;
    }
    throw new FileValidationError('파일을 읽는 중 오류가 발생했습니다.');
  }
}

/**
 * 이미지 파일 종합 검증
 * 1. 파일 크기 검증 (10MB 제한)
 * 2. MIME 타입 검증
 * 3. 파일 헤더(매직 넘버) 검증
 *
 * @param file 검증할 파일
 * @throws {FileValidationError} 검증 실패 시
 */
export async function validateImageFile(file: File): Promise<void> {
  // 1. 파일 크기 검증
  validateFileSize(file);

  // 2. MIME 타입 검증
  validateMimeType(file);

  // 3. 파일 헤더 검증
  await validateFileHeader(file);
}

/**
 * 이미지 파일인지 간단히 확인 (매직 넘버 검증 없이)
 * 빠른 검증이 필요한 경우 사용
 */
export function isImageFile(file: File): boolean {
  return file.type.startsWith('image/') &&
         APP_CONSTANTS.SUPPORTED_FORMATS.includes(file.type as any);
}
