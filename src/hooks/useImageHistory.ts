import { useState, useCallback } from 'react';
import type { ImageState } from '@/types/image';
import { APP_CONSTANTS } from '@/utils/constants';

/**
 * 이미지 편집 히스토리 관리 훅
 * - 최대 50개의 히스토리 유지 (메모리 누수 방지)
 * - Undo/Redo 기능 제공
 */
export function useImageHistory() {
  const [history, setHistory] = useState<ImageState[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  /**
   * 히스토리에 새 상태 추가
   * 현재 인덱스 이후의 히스토리는 제거되고, 최대 개수를 초과하면 가장 오래된 항목 제거
   */
  const addToHistory = useCallback(
    (state: ImageState) => {
      setHistory((prev) => {
        // 현재 인덱스 이후의 히스토리 제거
        let newHistory = prev.slice(0, historyIndex + 1);

        // 최대 히스토리 크기 제한 (메모리 누수 방지)
        if (newHistory.length >= APP_CONSTANTS.MAX_HISTORY_SIZE) {
          newHistory.shift(); // 가장 오래된 항목 제거
          setHistoryIndex((prevIndex) => prevIndex); // 인덱스 유지
        } else {
          setHistoryIndex((prevIndex) => prevIndex + 1);
        }

        return [...newHistory, state];
      });
    },
    [historyIndex]
  );

  /**
   * Undo: 이전 상태로 되돌리기
   */
  const undo = useCallback((): ImageState | null => {
    if (historyIndex > 0) {
      setHistoryIndex((prev) => prev - 1);
      return history[historyIndex - 1];
    }
    return null;
  }, [history, historyIndex]);

  /**
   * Redo: 다음 상태로 이동
   */
  const redo = useCallback((): ImageState | null => {
    if (historyIndex < history.length - 1) {
      setHistoryIndex((prev) => prev + 1);
      return history[historyIndex + 1];
    }
    return null;
  }, [history, historyIndex]);

  /**
   * Undo 가능 여부
   */
  const canUndo = historyIndex > 0;

  /**
   * Redo 가능 여부
   */
  const canRedo = historyIndex < history.length - 1;

  /**
   * 히스토리 초기화
   */
  const reset = useCallback(() => {
    setHistory([]);
    setHistoryIndex(-1);
  }, []);

  /**
   * 현재 상태
   */
  const currentState = history[historyIndex] || null;

  return {
    history,
    historyIndex,
    addToHistory,
    undo,
    redo,
    canUndo,
    canRedo,
    reset,
    currentState,
  };
}
