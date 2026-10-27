import { useState, useRef, useCallback, useEffect } from 'react';
import { Button } from './ui/button';
import { Slider } from './ui/slider';
import { Label } from './ui/label';
import { Input } from './ui/input';
import { Card } from './ui/card';
import { Separator } from './ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import { toast } from 'sonner';
import {
  Upload,
  Download,
  RotateCw,
  Crop,
  Undo,
  Redo,
  FlipHorizontal,
  FlipVertical,
  Palette,
  ZoomIn,
  ZoomOut,
  Image as ImageIcon,
  RotateCcw,
  Maximize2,
  Scale,
  Hand,
  Frame,
} from 'lucide-react';
import { renderEditedCanvas, renderImageForExport, renderNativeRegion, getEditingContext } from '@/utils/renderCanvas';
import { createLatestImageLoader } from '@/utils/latestImageLoader';
import { CRYPTO_UTILS, APP_CONSTANTS } from '@/utils/constants';

const CANVAS_PADDING = 20;

interface ImageState {
  image: HTMLImageElement;
  rotation: number;
  brightness: number;
  contrast: number;
  saturation: number;
  red: number;
  green: number;
  blue: number;
  hue: number;
  flipH: boolean;
  flipV: boolean;
  filter: string;
  scale: number;
  cropArea: { x: number; y: number; width: number; height: number } | null;
}

export function ImageEditor() {
  const [originalImage, setOriginalImage] = useState<HTMLImageElement | null>(null);
  const [currentState, setCurrentState] = useState<ImageState | null>(null);
  const [history, setHistory] = useState<ImageState[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [isCropping, setIsCropping] = useState(false);
  const [isPanning, setIsPanning] = useState(false);
  const [isSelecting, setIsSelecting] = useState(false);
  const [cropStart, setCropStart] = useState<{ x: number; y: number } | null>(null);
  const [cropEnd, setCropEnd] = useState<{ x: number; y: number } | null>(null);
  const [panStart, setPanStart] = useState<{ x: number; y: number; scrollX: number; scrollY: number } | null>(null);
  const [selectionStart, setSelectionStart] = useState<{ x: number; y: number } | null>(null);
  const [selectionEnd, setSelectionEnd] = useState<{ x: number; y: number } | null>(null);
  const [savedSelection, setSavedSelection] = useState<{ x: number; y: number; width: number; height: number; scale: number } | null>(null);
  const [scaleInput, setScaleInput] = useState('100');
  const [expandWidth, setExpandWidth] = useState('');
  const [expandHeight, setExpandHeight] = useState('');
  const [expandBgColor, setExpandBgColor] = useState('#ffffff');
  const [expandMode, setExpandMode] = useState<'expand' | 'crop'>('expand');
  const [resizeWidth, setResizeWidth] = useState('');
  const [resizeHeight, setResizeHeight] = useState('');
  const [maintainAspectRatio, setMaintainAspectRatio] = useState(true);
  const [downloadFormat, setDownloadFormat] = useState<'png' | 'jpg' | 'webp'>('png');
  const [showDownloadDialog, setShowDownloadDialog] = useState(false);
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const latestImageLoader = useRef(createLatestImageLoader());
  const imageOperationGeneration = useRef(0);
  const currentStateRef = useRef(currentState);
  currentStateRef.current = currentState;

  // A decoded edit belongs to the exact source state and upload generation that started it.
  const loadDerivedImage = (canvas: HTMLCanvasElement, onLoaded: (image: HTMLImageElement) => void) => {
    const sourceState = currentState;
    const generation = ++imageOperationGeneration.current;
    const image = new Image();
    const isCurrent = () => generation === imageOperationGeneration.current && currentStateRef.current === sourceState;
    image.onload = () => { if (isCurrent()) onLoaded(image); };
    image.onerror = () => { if (isCurrent()) toast.error('편집 결과를 읽지 못했습니다'); };
    image.src = canvas.toDataURL();
  };

  // 기본 이미지 상태 생성 (자동 배율 조정)
  const createDefaultState = (img: HTMLImageElement, autoScale = true): ImageState => {
    let scale = 1;
    
    if (autoScale && containerRef.current) {
      // 화면에 맞추기와 동일한 로직 사용
      const containerRect = containerRef.current.getBoundingClientRect();
      const maxWidth = containerRect.width - 100; // padding과 여유 공간
      const maxHeight = Math.max(1, Math.floor(window.innerHeight * 0.7) - CANVAS_PADDING * 2);
      
      // 이미지가 컨테이너에 맞도록 스케일 계산
      const scaleX = maxWidth / img.width;
      const scaleY = maxHeight / img.height;
      scale = Math.min(scaleX, scaleY); // 1 제한 제거
    }
    
    return {
      image: img,
      rotation: 0,
      brightness: 100,
      contrast: 100,
      saturation: 100,
      red: 100,
      green: 100,
      blue: 100,
      hue: 0,
      flipH: false,
      flipV: false,
      filter: 'none',
      scale: scale,
      cropArea: null,
    };
  };

  // 히스토리에 상태 추가 (최대 50개 제한)
  const addToHistory = useCallback((state: ImageState) => {
    const newHistory = history.slice(0, historyIndex + 1);

    // 메모리 누수 방지: 최대 히스토리 크기 제한
    if (newHistory.length >= APP_CONSTANTS.MAX_HISTORY_SIZE) {
      newHistory.shift(); // 가장 오래된 항목 제거
    } else {
      setHistoryIndex(newHistory.length); // 인덱스 증가
    }

    newHistory.push(state);
    setHistory(newHistory);
    setCurrentState(state);
  }, [history, historyIndex]);

  // 캔버스에 이미지 그리기
  const drawImage = useCallback(() => {
    if (!currentState || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = getEditingContext(canvas);
    if (!ctx) return;

    renderEditedCanvas(canvas, currentState);

    // 크롭 영역 표시
    if (isCropping && cropStart && cropEnd) {
      ctx.strokeStyle = '#3b82f6';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      const x = Math.min(cropStart.x, cropEnd.x);
      const y = Math.min(cropStart.y, cropEnd.y);
      const w = Math.abs(cropEnd.x - cropStart.x);
      const h = Math.abs(cropEnd.y - cropStart.y);
      ctx.strokeRect(x, y, w, h);
      ctx.setLineDash([]);
    }
    
    // 영역선택 표시 (진행 중)
    if (isSelecting && selectionStart && selectionEnd) {
      ctx.strokeStyle = '#10b981';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      const x = Math.min(selectionStart.x, selectionEnd.x);
      const y = Math.min(selectionStart.y, selectionEnd.y);
      const w = Math.abs(selectionEnd.x - selectionStart.x);
      const h = Math.abs(selectionEnd.y - selectionStart.y);
      ctx.strokeRect(x, y, w, h);
      ctx.setLineDash([]);
    }
    
    // 저장된 영역선택 표시 (완료됨)
    if (savedSelection && currentState) {
      // scale 비율 계산하여 선택 영역 조정
      const scaleRatio = currentState.scale / savedSelection.scale;
      const adjustedX = savedSelection.x * scaleRatio;
      const adjustedY = savedSelection.y * scaleRatio;
      const adjustedWidth = savedSelection.width * scaleRatio;
      const adjustedHeight = savedSelection.height * scaleRatio;
      
      ctx.strokeStyle = '#10b981';
      ctx.lineWidth = 3;
      ctx.setLineDash([10, 5]);
      ctx.strokeRect(adjustedX, adjustedY, adjustedWidth, adjustedHeight);
      ctx.setLineDash([]);
      
      // 반투명 배경
      ctx.fillStyle = 'rgba(16, 185, 129, 0.1)';
      ctx.fillRect(adjustedX, adjustedY, adjustedWidth, adjustedHeight);
    }
  }, [currentState, isCropping, cropStart, cropEnd, isSelecting, selectionStart, selectionEnd, savedSelection]);

  useEffect(() => {
    drawImage();
  }, [drawImage]);

  // scale 변경 시 input 업데이트
  useEffect(() => {
    if (currentState) {
      setScaleInput(Math.round(currentState.scale * 100).toString());
    }
  }, [currentState?.scale]);

  // 파일 로드
  const handleFileLoad = async (file: File) => {
    ++imageOperationGeneration.current;
    await latestImageLoader.current(file, (img) => {
      const initialState = createDefaultState(img);
      setOriginalImage(img);
      setCurrentState(initialState);
      setHistory([initialState]);
      setHistoryIndex(0);
      setIsCropping(false); setIsPanning(false); setIsSelecting(false);
      setCropStart(null); setCropEnd(null); setSelectionStart(null); setSelectionEnd(null); setSavedSelection(null);
      toast.success('이미지가 로드되었습니다');
    }, (error) => toast.error(error instanceof Error ? error.message : '파일 로드 실패'));
  };

  // 파일 선택
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFileLoad(file);
    e.target.value = '';
  };

  // 드래그 앤 드롭
  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFileLoad(file);
  };

  // 회전
  const handleRotate = () => {
    if (!currentState) return;
    const newState = { ...currentState, rotation: (currentState.rotation + 90) % 360 };
    addToHistory(newState);
  };

  // 좌우 반전
  const handleFlipH = () => {
    if (!currentState) return;
    const newState = { ...currentState, flipH: !currentState.flipH };
    addToHistory(newState);
  };

  // 상하 반전
  const handleFlipV = () => {
    if (!currentState) return;
    const newState = { ...currentState, flipV: !currentState.flipV };
    addToHistory(newState);
  };

  // 밝기 조정
  const handleBrightnessChange = (value: number[]) => {
    if (!currentState) return;
    setCurrentState({ ...currentState, brightness: value[0] });
  };

  const handleBrightnessCommit = (value: number[]) => {
    if (!currentState) return;
    const newState = { ...currentState, brightness: value[0] };
    addToHistory(newState);
  };

  // 대비 조정
  const handleContrastChange = (value: number[]) => {
    if (!currentState) return;
    setCurrentState({ ...currentState, contrast: value[0] });
  };

  const handleContrastCommit = (value: number[]) => {
    if (!currentState) return;
    const newState = { ...currentState, contrast: value[0] };
    addToHistory(newState);
  };

  // 채도 조정
  const handleSaturationChange = (value: number[]) => {
    if (!currentState) return;
    setCurrentState({ ...currentState, saturation: value[0] });
  };

  const handleSaturationCommit = (value: number[]) => {
    if (!currentState) return;
    const newState = { ...currentState, saturation: value[0] };
    addToHistory(newState);
  };

  // Red 조정
  const handleRedChange = (value: number[]) => {
    if (!currentState) return;
    setCurrentState({ ...currentState, red: value[0] });
  };

  const handleRedCommit = (value: number[]) => {
    if (!currentState) return;
    const newState = { ...currentState, red: value[0] };
    addToHistory(newState);
  };

  // Green 조정
  const handleGreenChange = (value: number[]) => {
    if (!currentState) return;
    setCurrentState({ ...currentState, green: value[0] });
  };

  const handleGreenCommit = (value: number[]) => {
    if (!currentState) return;
    const newState = { ...currentState, green: value[0] };
    addToHistory(newState);
  };

  // Blue 조정
  const handleBlueChange = (value: number[]) => {
    if (!currentState) return;
    setCurrentState({ ...currentState, blue: value[0] });
  };

  const handleBlueCommit = (value: number[]) => {
    if (!currentState) return;
    const newState = { ...currentState, blue: value[0] };
    addToHistory(newState);
  };

  // Hue 조정
  const handleHueChange = (value: number[]) => {
    if (!currentState) return;
    setCurrentState({ ...currentState, hue: value[0] });
  };

  const handleHueCommit = (value: number[]) => {
    if (!currentState) return;
    const newState = { ...currentState, hue: value[0] };
    addToHistory(newState);
  };

  // 필터 변경
  const handleFilterChange = (filter: string) => {
    if (!currentState) return;
    const newState = { ...currentState, filter };
    addToHistory(newState);
  };

  // 줌
  const handleZoomIn = () => {
    if (!currentState) return;
    const newScale = Math.min(currentState.scale + 0.1, 5);
    const newState = { ...currentState, scale: newScale };
    addToHistory(newState);
  };

  const handleZoomOut = () => {
    if (!currentState) return;
    const newScale = Math.max(currentState.scale - 0.1, 0.1);
    const newState = { ...currentState, scale: newScale };
    addToHistory(newState);
  };

  // 배율 입력 변경
  const handleScaleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setScaleInput(e.target.value);
  };

  // 배율 입력 완료
  const handleScaleInputBlur = () => {
    if (!currentState) return;
    const value = parseFloat(scaleInput);
    if (isNaN(value) || value < 10 || value > 500) {
      toast.error('배율은 10%~500% 사이로 입력해주세요');
      setScaleInput(Math.round(currentState.scale * 100).toString());
      return;
    }
    const newScale = value / 100;
    if (Math.abs(newScale - currentState.scale) > 0.001) {
      const newState = { ...currentState, scale: newScale };
      addToHistory(newState);
    }
  };

  // 배율 입력 엔터키
  const handleScaleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleScaleInputBlur();
      (e.target as HTMLInputElement).blur();
    }
  };

  // 100% 배율로 리셋
  // 화면에 맞추기
  const handleFitToScreen = () => {
    if (!currentState || !containerRef.current) return;
    
    const containerRect = containerRef.current.getBoundingClientRect();
    // 뷰포트 높이의 70%를 최대 높이로 사용 (더 안정적)
    const maxWidth = containerRect.width - 100; // padding과 여유 공간
    const maxHeight = Math.max(1, Math.floor(window.innerHeight * 0.7) - CANVAS_PADDING * 2);
    
    const { image, rotation } = currentState;
    const isRotated90or270 = rotation % 180 !== 0;
    const imgWidth = isRotated90or270 ? image.height : image.width;
    const imgHeight = isRotated90or270 ? image.width : image.height;
    
    const scaleX = maxWidth / imgWidth;
    const scaleY = maxHeight / imgHeight;
    const newScale = Math.min(scaleX, scaleY); // 1 제한 제거
    
    const newState = { ...currentState, scale: newScale };
    addToHistory(newState);
    toast.success('화면에 맞춰졌습니다');
  };

  // 크롭 시작
  const handleCropStart = () => {
    setIsCropping(true);
    setIsPanning(false);
    setIsSelecting(false);
    toast.info('이미지를 드래그하여 크롭 영역을 선택하세요');
  };

  // 패닝 시작
  const handlePanStart = () => {
    setIsPanning(!isPanning);
    setIsCropping(false);
    setIsSelecting(false);
    if (!isPanning) {
      toast.info('손 도구가 활성화되었습니다. 이미지를 드래그하여 이동하세요');
    }
  };

  // 영역선택 시작
  const handleSelectionStart = () => {
    if (isSelecting) {
      // 영역선택 해제
      setIsSelecting(false);
      setSavedSelection(null);
      setSelectionStart(null);
      setSelectionEnd(null);
      toast.info('영역 선택이 해제되었습니다');
    } else {
      // 영역선택 시작
      setIsSelecting(true);
      setIsCropping(false);
      setIsPanning(false);
      setSavedSelection(null);
      toast.info('이미지를 드래그하여 영역을 선택하세요');
    }
  };

  // 파일명 생성 함수 (암호학적으로 안전한 ID 사용)
  const generateFileName = (format: string) => {
    const secureId = CRYPTO_UTILS.generateSecureId();
    const hash = secureId.slice(0, 8);
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hour = String(now.getHours()).padStart(2, '0');
    const minute = String(now.getMinutes()).padStart(2, '0');
    const second = String(now.getSeconds()).padStart(2, '0');
    const timestamp = `${year}${month}${day}${hour}${minute}${second}`;
    return `${APP_CONSTANTS.FILE_NAME_PREFIX}_${hash}_${timestamp}.${format}`;
  };

  // 안내 overlay를 제외한 native 해상도 선택 영역 다운로드
  const copySelectionToClipboard = (x: number, y: number, width: number, height: number) => {
    if (!canvasRef.current || !currentState) return;
    const bounds = canvasRef.current.getBoundingClientRect();
    const tempCanvas = renderNativeRegion(currentState, { x, y, width, height }, bounds);
    if (!tempCanvas) return;

    // Blob으로 변환하여 다운로드
    const mimeType = downloadFormat === 'jpg' ? 'image/jpeg' : `image/${downloadFormat}`;
    const quality = downloadFormat === 'jpg' ? 0.95 : undefined;
    
    tempCanvas.toBlob((blob) => {
      if (!blob) return;
      
      // 클립보드 API는 권한 정책으로 차단될 수 있으므로 항상 다운로드 방식 사용
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = generateFileName(downloadFormat);
      link.click();
      URL.revokeObjectURL(url);
      toast.success('선택 영역이 다운로드되었습니다');
    }, mimeType, quality);
  };

  // Browser offset coordinates retain the canvas-relative position at fractional layout bounds.
  const getCanvasPoint = (event: React.MouseEvent<HTMLCanvasElement>) => ({
    x: event.nativeEvent.offsetX,
    y: event.nativeEvent.offsetY,
  });

  // 마우스 이벤트 - 크롭, 패닝, 영역선택
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (isPanning && canvasContainerRef.current) {
      const scrollX = canvasContainerRef.current.scrollLeft;
      const scrollY = canvasContainerRef.current.scrollTop;
      setPanStart({ x: e.clientX, y: e.clientY, scrollX, scrollY });
      return;
    }
    
    if (isSelecting && canvasRef.current) {
      setSelectionStart(getCanvasPoint(e));
      setSelectionEnd(null);
      setSavedSelection(null);
      return;
    }
    
    if (!isCropping || !canvasRef.current) return;
    setCropStart(getCanvasPoint(e));
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (isPanning && panStart && canvasContainerRef.current) {
      const dx = e.clientX - panStart.x;
      const dy = e.clientY - panStart.y;
      canvasContainerRef.current.scrollLeft = panStart.scrollX - dx;
      canvasContainerRef.current.scrollTop = panStart.scrollY - dy;
      return;
    }
    
    if (isSelecting && selectionStart && canvasRef.current) {
      setSelectionEnd(getCanvasPoint(e));
      return;
    }
    
    if (!isCropping || !cropStart || !canvasRef.current) return;
    setCropEnd(getCanvasPoint(e));
  };

  const handleMouseUp = () => {
    if (isPanning) {
      setPanStart(null);
      return;
    }
    
    // 영역선택 완료
    if (isSelecting && selectionStart && selectionEnd && canvasRef.current && currentState) {
      const x = Math.min(selectionStart.x, selectionEnd.x);
      const y = Math.min(selectionStart.y, selectionEnd.y);
      const width = Math.abs(selectionEnd.x - selectionStart.x);
      const height = Math.abs(selectionEnd.y - selectionStart.y);
      
      if (width < 10 || height < 10) {
        toast.error('선택 영역이 너무 작습니다');
        setSelectionStart(null);
        setSelectionEnd(null);
        return;
      }
      
      // 선택 영역 저장 (현재 scale 값과 함께)
      setSavedSelection({ x, y, width, height, scale: currentState.scale });
      setSelectionStart(null);
      setSelectionEnd(null);
      
      // 클립보드에 복사
      copySelectionToClipboard(x, y, width, height);
      return;
    }
    
    if (!isCropping || !cropStart || !cropEnd || !currentState || !canvasRef.current) return;
    
    const canvas = canvasRef.current;
    const ctx = getEditingContext(canvas);
    if (!ctx) return;

    // 크롭 영역 계산
    const x = Math.min(cropStart.x, cropEnd.x);
    const y = Math.min(cropStart.y, cropEnd.y);
    const width = Math.abs(cropEnd.x - cropStart.x);
    const height = Math.abs(cropEnd.y - cropStart.y);

    if (width < 10 || height < 10) {
      toast.error('크롭 영역이 너무 작습니다');
      setIsCropping(false);
      setCropStart(null);
      setCropEnd(null);
      return;
    }

    const bounds = canvas.getBoundingClientRect();
    const croppedCanvas = renderNativeRegion(currentState, { x, y, width, height }, bounds);
    if (!croppedCanvas) return;

    loadDerivedImage(croppedCanvas, (croppedImg) => {
      const newState = createDefaultState(croppedImg);
      addToHistory(newState);
      setSavedSelection(null);
      setIsCropping(false);
      setCropStart(null);
      setCropEnd(null);
      toast.success('이미지가 크롭되었습니다');
    });
  };

  // 캔버스 초기화 (이미지 로드 시)
  useEffect(() => {
    if (currentState) {
      setExpandWidth(currentState.image.width.toString());
      setExpandHeight(currentState.image.height.toString());
      setResizeWidth(currentState.image.width.toString());
      setResizeHeight(currentState.image.height.toString());
    }
  }, [currentState?.image]);

  // 비율 프리셋 적용
  const handleAspectRatioPreset = (ratio: string) => {
    if (!currentState) return;
    
    const imgWidth = currentState.image.width;
    const imgHeight = currentState.image.height;
    const currentRatio = imgWidth / imgHeight;
    
    let newWidth = imgWidth;
    let newHeight = imgHeight;
    let targetRatio = 1;
    
    switch (ratio) {
      case '1:1':
        targetRatio = 1;
        break;
      case '16:9':
        targetRatio = 16/9;
        break;
      case '9:16':
        targetRatio = 9/16;
        break;
      case '4:3':
        targetRatio = 4/3;
        break;
      case '3:2':
        targetRatio = 3/2;
        break;
    }
    
    if (expandMode === 'expand') {
      // 확장 모드: 긴 쪽 기준으로 크기 계산
      if (currentRatio < targetRatio) {
        // 현재 이미지가 더 세로로 긴 경우 -> 너비 확장
        newWidth = Math.round(imgHeight * targetRatio);
        newHeight = imgHeight;
      } else {
        // 현재 이미지가 더 가로로 긴 경우 -> 높이 확장
        newHeight = Math.round(imgWidth / targetRatio);
        newWidth = imgWidth;
      }
    } else {
      // 크롭 모드: 짧은 쪽 기준으로 크기 계산
      if (currentRatio < targetRatio) {
        // 현재 이미지가 더 세로로 긴 경우 -> 높이 크롭
        newHeight = Math.round(imgWidth / targetRatio);
        newWidth = imgWidth;
      } else {
        // 현재 이미지가 더 가로로 긴 경우 -> 너비 크롭
        newWidth = Math.round(imgHeight * targetRatio);
        newHeight = imgHeight;
      }
    }
    
    setExpandWidth(newWidth.toString());
    setExpandHeight(newHeight.toString());
  };

  const handleExpandCanvasConfirm = () => {
    if (!currentState || !canvasRef.current) return;

    const width = parseInt(expandWidth);
    const height = parseInt(expandHeight);

    if (isNaN(width) || isNaN(height) || width < 1 || height < 1) {
      toast.error('유효한 크기를 입력하세요');
      return;
    }
    
    // 현재 캔버스가 아닌 원본 이미지에서 시작
    const tempCanvas = document.createElement('canvas');
    renderImageForExport(tempCanvas, currentState);

    // 새 캔버스 생성
    const newCanvas = document.createElement('canvas');
    newCanvas.width = width;
    newCanvas.height = height;
    const newCtx = getEditingContext(newCanvas);
    if (!newCtx) return;

    if (expandMode === 'expand') {
      // 확장 모드: 배경색으로 채우고 이미지를 중앙에 배치
      newCtx.fillStyle = expandBgColor;
      newCtx.fillRect(0, 0, width, height);

      const offsetX = (width - tempCanvas.width) / 2;
      const offsetY = (height - tempCanvas.height) / 2;
      newCtx.drawImage(tempCanvas, offsetX, offsetY);
      

    } else {
      // 크롭 모드: 중앙을 기준으로 잘라내기
      const offsetX = (tempCanvas.width - width) / 2;
      const offsetY = (tempCanvas.height - height) / 2;
      
      // 이미지가 목표 크기보다 작은 경우 확인
      if (width > tempCanvas.width || height > tempCanvas.height) {
        toast.error('크롭 크기가 현재 이미지보다 큽니다');
        return;
      }
      
      newCtx.drawImage(
        tempCanvas,
        offsetX, offsetY, width, height,  // 소스 영역 (중앙에서 잘라냄)
        0, 0, width, height               // 대상 영역
      );
      
    }

    loadDerivedImage(newCanvas, (newImg) => {
      const newState = createDefaultState(newImg, true);
      addToHistory(newState);
      setSavedSelection(null);
      toast.success(expandMode === 'expand' ? '캔버스가 확장되었습니다' : '이미지가 크롭되었습니다');
    });
  };



  // 최대공약수 계산
  const getGCD = (a: number, b: number): number => {
    return b === 0 ? a : getGCD(b, a % b);
  };

  // 비율 계산
  const getAspectRatio = (width: number, height: number): string => {
    if (isNaN(width) || isNaN(height) || width === 0 || height === 0) {
      return '-';
    }
    const gcd = getGCD(width, height);
    const ratioW = width / gcd;
    const ratioH = height / gcd;
    return `${ratioW}:${ratioH}`;
  };

  // 해상도 프리셋 적용
  const handleResolutionPreset = (width: number, height: number) => {
    setResizeWidth(width.toString());
    setResizeHeight(height.toString());
  };

  const handleResizeWidthChange = (value: string) => {
    setResizeWidth(value);
    if (maintainAspectRatio && currentState) {
      const width = parseInt(value);
      if (!isNaN(width)) {
        const aspectRatio = currentState.image.height / currentState.image.width;
        setResizeHeight(Math.round(width * aspectRatio).toString());
      }
    }
  };

  const handleResizeHeightChange = (value: string) => {
    setResizeHeight(value);
    if (maintainAspectRatio && currentState) {
      const height = parseInt(value);
      if (!isNaN(height)) {
        const aspectRatio = currentState.image.width / currentState.image.height;
        setResizeWidth(Math.round(height * aspectRatio).toString());
      }
    }
  };

  const handleResizeConfirm = () => {
    if (!currentState || !canvasRef.current) return;

    const width = parseInt(resizeWidth);
    const height = parseInt(resizeHeight);

    if (isNaN(width) || isNaN(height) || width < 1 || height < 1) {
      toast.error('유효한 크기를 입력하세요');
      return;
    }

    // 현재 캔버스를 새 크기로 리사이즈
    const newCanvas = document.createElement('canvas');
    newCanvas.width = width;
    newCanvas.height = height;
    const newCtx = getEditingContext(newCanvas);
    if (!newCtx) return;

    // 현재 캔버스를 새 크기로 그리기
    const canvas = document.createElement('canvas');
    renderImageForExport(canvas, currentState);
    newCtx.drawImage(canvas, 0, 0, width, height);

    loadDerivedImage(newCanvas, (newImg) => {
      const newState = createDefaultState(newImg, true);
      addToHistory(newState);
      setSavedSelection(null);
      toast.success('이미지 크기가 변경되었습니다');
    });
  };

  // 실행 취소
  const handleUndo = () => {
    if (historyIndex > 0) {
      setHistoryIndex(historyIndex - 1);
      setCurrentState(history[historyIndex - 1]);
    }
  };

  // 다시 실행
  const handleRedo = () => {
    if (historyIndex < history.length - 1) {
      setHistoryIndex(historyIndex + 1);
      setCurrentState(history[historyIndex + 1]);
    }
  };

  // 다운로드
  const handleDownload = () => {
    setShowDownloadDialog(true);
  };

  // 실제 다운로드 수행
  const executeDownload = () => {
    if (!currentState) return;
    
    // 원본 크기로 이미지를 렌더링할 임시 캔버스 생성
    const tempCanvas = document.createElement('canvas');
    const ctx = getEditingContext(tempCanvas);
    if (!ctx) return;
    
    renderImageForExport(tempCanvas, currentState);

    // 다운로드
    const mimeType = downloadFormat === 'jpg' ? 'image/jpeg' : `image/${downloadFormat}`;
    const quality = downloadFormat === 'jpg' ? 0.95 : undefined;
    
    const link = document.createElement('a');
    link.download = generateFileName(downloadFormat);
    link.href = tempCanvas.toDataURL(mimeType, quality);
    link.click();
    toast.success('이미지가 다운로드되었습니다');
    setShowDownloadDialog(false);
  };

  // 리셋
  const handleReset = () => {
    if (!originalImage) return;
    const initialState = createDefaultState(originalImage);
    addToHistory(initialState);
    toast.info('이미지가 초기 상태로 리셋되었습니다');
  };

  // 조정값 초기화
  const handleResetAdjustments = () => {
    if (!currentState) return;
    const newState = {
      ...currentState,
      brightness: 100,
      contrast: 100,
      saturation: 100,
      red: 100,
      green: 100,
      blue: 100,
      hue: 0,
    };
    addToHistory(newState);
    toast.info('조정값이 초기화되었습니다');
  };

  return (
    <div className="min-h-screen bg-background p-3 sm:p-6">
      <div className="max-w-7xl min-w-0 mx-auto space-y-6">
        {/* 헤더 */}
        <div className="text-center space-y-2">
          <div className="flex items-center justify-center gap-3">
            <ImageIcon className="w-8 h-8" />
            <h1>포픽 (PhoPic)</h1>
          </div>
          <p className="text-muted-foreground">
            브라우저에서 바로 사용하는 무료 온라인 이미지 편집 도구
          </p>
        </div>
        
        <input
          ref={fileInputRef}
          type="file"
          aria-label="이미지 파일 선택"
          accept="image/*"
          onChange={handleFileSelect}
          className="hidden"
        />

        {/* 도구 모음 */}
        {currentState && (
          <Card className="p-4">
            <div className="flex flex-wrap gap-2">
              {/* 파일 */}
              <Button onClick={() => fileInputRef.current?.click()} title="이미지 열기" aria-label="이미지 열기" size="sm">
                <Upload className="w-4 h-4" />
              </Button>
              
              <Separator orientation="vertical" className="h-8" />
              
              {/* 히스토리 */}
              <Button
                variant="outline"
                size="sm"
                onClick={handleUndo}
                disabled={historyIndex <= 0}
                title="실행 취소" aria-label="실행 취소"
              >
                <Undo className="w-4 h-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleRedo}
                disabled={historyIndex >= history.length - 1}
                title="다시 실행" aria-label="다시 실행"
              >
                <Redo className="w-4 h-4" />
              </Button>
              
              <Separator orientation="vertical" className="h-8" />
              
              {/* 변형 */}
              <Button variant="outline" size="sm" onClick={handleRotate} title="회전" aria-label="회전">
                <RotateCw className="w-4 h-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={handleFlipH} title="좌우 반전" aria-label="좌우 반전">
                <FlipHorizontal className="w-4 h-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={handleFlipV} title="상하 반전" aria-label="상하 반전">
                <FlipVertical className="w-4 h-4" />
              </Button>
              
              <Separator orientation="vertical" className="h-8" />
              
              {/* 크기 조정 */}
              <Button
                variant={isPanning ? 'default' : 'outline'}
                size="sm"
                onClick={handlePanStart}
                title="손 도구" aria-label="손 도구"
              >
                <Hand className="w-4 h-4" />
              </Button>
              <Button
                variant={isSelecting ? 'default' : 'outline'}
                size="sm"
                onClick={handleSelectionStart}
                title="영역선택" aria-label="영역선택"
              >
                <Frame className="w-4 h-4" />
              </Button>
              <Button
                variant={isCropping ? 'default' : 'outline'}
                size="sm"
                onClick={handleCropStart}
                title="크롭" aria-label="크롭"
              >
                <Crop className="w-4 h-4" />
              </Button>
              
              <Separator orientation="vertical" className="h-8" />
              
              {/* 파일 */}
              <Button variant="outline" size="sm" onClick={handleReset} title="초기화" aria-label="초기화">
                <RotateCcw className="w-4 h-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={handleDownload} title="다운로드" aria-label="다운로드">
                <Download className="w-4 h-4" />
              </Button>
            </div>
          </Card>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* 캔버스 */}
          <div className="lg:col-span-4" ref={containerRef}>
            {!currentState ? (
              <Card
                className="aspect-video flex items-center justify-center border-2 border-dashed cursor-pointer hover:bg-muted/50 transition-colors"
                role="button"
                tabIndex={0}
                aria-label="이미지 업로드"
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    fileInputRef.current?.click();
                  }
                }}
                onDrop={handleDrop}
                onDragOver={(e) => e.preventDefault()}
                onClick={() => fileInputRef.current?.click()}
              >
                <div className="text-center space-y-4">
                  <Upload className="w-16 h-16 mx-auto text-muted-foreground" />
                  <div>
                    <p className="text-muted-foreground">
                      이미지를 드래그하거나 클릭하여 업로드하세요
                    </p>
                    <p className="text-muted-foreground mt-2">
                      JPG, PNG, GIF, WebP · 최대 10MB
                    </p>
                  </div>
                </div>
              </Card>
            ) : (
              <div 
                ref={canvasContainerRef}
                className="w-full max-h-[70vh] bg-muted/20 overflow-auto"
                style={{ textAlign: 'center', padding: `${CANVAS_PADDING}px` }}
              >
                <canvas
                  ref={canvasRef}
                  onMouseDown={handleMouseDown}
                  onMouseMove={handleMouseMove}
                  onMouseUp={handleMouseUp}
                  className={
                    isCropping 
                      ? 'cursor-crosshair' 
                      : isPanning 
                        ? panStart 
                          ? 'cursor-grabbing' 
                          : 'cursor-grab' 
                        : isSelecting
                          ? 'cursor-crosshair'
                          : 'cursor-default'
                  }
                  style={{ display: 'inline-block' }}
                />
              </div>
            )}
          </div>
          
          {/* 줌 컨트롤 */}
          {currentState && (
            <div className="flex items-center justify-center gap-2 py-4">
              <Button variant="outline" size="sm" onClick={handleZoomOut} title="축소" aria-label="축소">
                <ZoomOut className="w-4 h-4" />
              </Button>
              <div className="relative">
                <Input
                  type="text"
                  aria-label="배율"
                  value={scaleInput}
                  onChange={handleScaleInputChange}
                  onBlur={handleScaleInputBlur}
                  onKeyDown={handleScaleInputKeyDown}
                  className="w-20 h-8 text-center text-sm pr-6"
                  placeholder="100"
                />
                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-sm text-muted-foreground pointer-events-none">%</span>
              </div>
              <Button variant="outline" size="sm" onClick={handleZoomIn} title="확대" aria-label="확대">
                <ZoomIn className="w-4 h-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={handleFitToScreen} title="화면에 맞추기" aria-label="화면에 맞추기">
                <Maximize2 className="w-4 h-4" />
              </Button>
            </div>
          )}
        </div>

        {/* 크기 조정 및 조정/필터 패널 */}
        {currentState && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* 크기 조정 카드 */}
            <Card className="p-4">
              <div className="space-y-4">
                <h3 className="flex items-center gap-2 font-semibold">
                  <Scale className="w-4 h-4" />
                  크기 조정
                </h3>
                
                <Tabs defaultValue="canvas" className="w-full">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="canvas">캔버스</TabsTrigger>
                    <TabsTrigger value="resize">리사이즈</TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="canvas" className="space-y-4 mt-4">
                    {/* 모드 선택 */}
                    <div className="space-y-2">
                      <Label>모드</Label>
                      <div className="grid grid-cols-2 gap-2">
                        <Button
                          type="button"
                          variant={expandMode === 'expand' ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => setExpandMode('expand')}
                        >
                          확장
                        </Button>
                        <Button
                          type="button"
                          variant={expandMode === 'crop' ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => setExpandMode('crop')}
                        >
                          크롭
                        </Button>
                      </div>
                    </div>
                    
                    {/* 비율 프리셋 */}
                    <div className="space-y-2">
                      <Label>비율</Label>
                      <div className="grid grid-cols-2 gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => handleAspectRatioPreset('1:1')}
                        >
                          1:1
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => handleAspectRatioPreset('16:9')}
                        >
                          16:9
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => handleAspectRatioPreset('9:16')}
                        >
                          9:16
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => handleAspectRatioPreset('4:3')}
                        >
                          4:3
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => handleAspectRatioPreset('3:2')}
                        >
                          3:2
                        </Button>
                      </div>
                    </div>

                    {/* 크기 입력 */}
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-2">
                        <Label htmlFor="canvas-width">너비</Label>
                        <Input
                          id="canvas-width"
                          aria-label="캔버스 너비"
                          type="text"
                          value={expandWidth}
                          onChange={(e) => setExpandWidth(e.target.value)}
                          className="w-full"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="canvas-height">높이</Label>
                        <Input
                          id="canvas-height"
                          aria-label="캔버스 높이"
                          type="text"
                          value={expandHeight}
                          onChange={(e) => setExpandHeight(e.target.value)}
                          className="w-full"
                        />
                      </div>
                    </div>
                    
                    {/* 배경색 - 확장 모드일 때만 */}
                    {expandMode === 'expand' && (
                      <div className="space-y-2">
                        <Label htmlFor="canvas-background">배경색</Label>
                        <div className="flex items-center gap-2">
                          <Input
                            id="canvas-background"
                            aria-label="캔버스 배경색"
                            type="color"
                            value={expandBgColor}
                            onChange={(e) => setExpandBgColor(e.target.value)}
                            className="w-12 h-8"
                          />
                          <div className="flex gap-1 flex-wrap">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="w-6 h-6 p-0"
                              aria-label="배경색 흰색"
                              style={{ backgroundColor: '#ffffff' }}
                              onClick={() => setExpandBgColor('#ffffff')}
                            />
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="w-6 h-6 p-0"
                              aria-label="배경색 검정"
                              style={{ backgroundColor: '#000000' }}
                              onClick={() => setExpandBgColor('#000000')}
                            />
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="w-6 h-6 p-0"
                              aria-label="배경색 밝은 회색"
                              style={{ backgroundColor: '#f5f5f5' }}
                              onClick={() => setExpandBgColor('#f5f5f5')}
                            />
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="w-6 h-6 p-0"
                              aria-label="배경색 파랑"
                              style={{ backgroundColor: '#3b82f6' }}
                              onClick={() => setExpandBgColor('#3b82f6')}
                            />
                          </div>
                        </div>
                      </div>
                    )}
                    
                    <Button 
                      type="button" 
                      onClick={handleExpandCanvasConfirm}
                      className="w-full"
                    >
                      {expandMode === 'expand' ? '확장' : '크롭'}
                    </Button>
                  </TabsContent>
                  
                  <TabsContent value="resize" className="space-y-4 mt-4">
                    {/* 해상도 프리셋 */}
                    <div className="space-y-2">
                      <Label>프리셋</Label>
                      <div className="grid grid-cols-2 gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => handleResolutionPreset(1920, 1080)}
                        >
                          Full HD
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => handleResolutionPreset(1280, 720)}
                        >
                          HD
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => handleResolutionPreset(3840, 2160)}
                        >
                          4K
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => handleResolutionPreset(1080, 1080)}
                        >
                          Insta
                        </Button>
                      </div>
                    </div>

                    {/* 크기 입력 */}
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-2">
                        <Label htmlFor="resize-width">너비</Label>
                        <Input
                          id="resize-width"
                          aria-label="리사이즈 너비"
                          type="text"
                          value={resizeWidth}
                          onChange={(e) => handleResizeWidthChange(e.target.value)}
                          className="w-full"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="resize-height">높이</Label>
                        <Input
                          id="resize-height"
                          aria-label="리사이즈 높이"
                          type="text"
                          value={resizeHeight}
                          onChange={(e) => handleResizeHeightChange(e.target.value)}
                          className="w-full"
                        />
                      </div>
                    </div>
                    
                    {/* 비율 표시 */}
                    <div className="text-sm text-muted-foreground">
                      비율: {getAspectRatio(parseInt(resizeWidth), parseInt(resizeHeight))}
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <Input
                        id="resize-aspect-ratio"
                        aria-label="비율 유지"
                        type="checkbox"
                        checked={maintainAspectRatio}
                        onChange={(e) => setMaintainAspectRatio(e.target.checked)}
                        className="h-4 w-4"
                      />
                      <Label htmlFor="resize-aspect-ratio">비율 유지</Label>
                    </div>
                    
                    <Button 
                      type="button" 
                      onClick={handleResizeConfirm}
                      className="w-full"
                    >
                      조정
                    </Button>
                  </TabsContent>
                </Tabs>
              </div>
            </Card>

            {/* 조정 및 필터 카드 */}
            <Card className="p-4">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="flex items-center gap-2 font-semibold">
                    <Palette className="w-4 h-4" />
                    조정 및 필터
                  </h3>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={handleResetAdjustments}
                    title="조정값 초기화" aria-label="조정값 초기화"
                  >
                    <RotateCcw className="w-4 h-4" />
                  </Button>
                </div>
                
                <Tabs defaultValue="adjust" className="w-full">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="adjust">조정</TabsTrigger>
                    <TabsTrigger value="filter">필터</TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="adjust" className="space-y-6 mt-4">
                    {/* 밝기 */}
                    <div className="space-y-2">
                      <Label>밝기: {currentState.brightness}%</Label>
                      <Slider
                        aria-label="밝기"
                        value={[currentState.brightness]}
                        onValueChange={handleBrightnessChange}
                        onValueCommit={handleBrightnessCommit}
                        min={0}
                        max={200}
                        step={1}
                      />
                    </div>

                    {/* 대비 */}
                    <div className="space-y-2">
                      <Label>대비: {currentState.contrast}%</Label>
                      <Slider
                        aria-label="대비"
                        value={[currentState.contrast]}
                        onValueChange={handleContrastChange}
                        onValueCommit={handleContrastCommit}
                        min={0}
                        max={200}
                        step={1}
                      />
                    </div>

                    {/* 채도 */}
                    <div className="space-y-2">
                      <Label>채도: {currentState.saturation}%</Label>
                      <Slider
                        aria-label="채도"
                        value={[currentState.saturation]}
                        onValueChange={handleSaturationChange}
                        onValueCommit={handleSaturationCommit}
                        min={0}
                        max={200}
                        step={1}
                      />
                    </div>

                    {/* Red */}
                    <div className="space-y-2">
                      <Label>Red: {currentState.red}%</Label>
                      <Slider
                        aria-label="빨강 채널"
                        value={[currentState.red]}
                        onValueChange={handleRedChange}
                        onValueCommit={handleRedCommit}
                        min={0}
                        max={200}
                        step={1}
                      />
                    </div>

                    {/* Green */}
                    <div className="space-y-2">
                      <Label>Green: {currentState.green}%</Label>
                      <Slider
                        aria-label="초록 채널"
                        value={[currentState.green]}
                        onValueChange={handleGreenChange}
                        onValueCommit={handleGreenCommit}
                        min={0}
                        max={200}
                        step={1}
                      />
                    </div>

                    {/* Blue */}
                    <div className="space-y-2">
                      <Label>Blue: {currentState.blue}%</Label>
                      <Slider
                        aria-label="파랑 채널"
                        value={[currentState.blue]}
                        onValueChange={handleBlueChange}
                        onValueCommit={handleBlueCommit}
                        min={0}
                        max={200}
                        step={1}
                      />
                    </div>

                    {/* Hue */}
                    <div className="space-y-2">
                      <Label>Hue: {currentState.hue}°</Label>
                      <Slider
                        aria-label="색상 회전"
                        value={[currentState.hue]}
                        onValueChange={handleHueChange}
                        onValueCommit={handleHueCommit}
                        min={0}
                        max={360}
                        step={1}
                      />
                    </div>
                  </TabsContent>
                  
                  <TabsContent value="filter" className="space-y-4 mt-4">
                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        variant={currentState.filter === 'none' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => handleFilterChange('none')}
                      >
                        원본
                      </Button>
                      <Button
                        variant={currentState.filter === 'grayscale' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => handleFilterChange('grayscale')}
                      >
                        흑백
                      </Button>
                      <Button
                        variant={currentState.filter === 'sepia' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => handleFilterChange('sepia')}
                      >
                        세피아
                      </Button>
                      <Button
                        variant={currentState.filter === 'invert' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => handleFilterChange('invert')}
                      >
                        반전
                      </Button>
                      <Button
                        variant={currentState.filter === 'vignette' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => handleFilterChange('vignette')}
                      >
                        비네팅
                      </Button>
                      <Button
                        variant={currentState.filter === 'vintage' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => handleFilterChange('vintage')}
                      >
                        빈티지
                      </Button>
                      <Button
                        variant={currentState.filter === 'warm' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => handleFilterChange('warm')}
                      >
                        따뜻한
                      </Button>
                      <Button
                        variant={currentState.filter === 'cool' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => handleFilterChange('cool')}
                      >
                        시원한
                      </Button>
                      <Button
                        variant={currentState.filter === 'fade' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => handleFilterChange('fade')}
                      >
                        흐리게
                      </Button>
                      <Button
                        variant={currentState.filter === 'sharpen' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => handleFilterChange('sharpen')}
                      >
                        선명하게
                      </Button>
                      <Button
                        variant={currentState.filter === 'blur' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => handleFilterChange('blur')}
                      >
                        블러
                      </Button>
                      <Button
                        variant={currentState.filter === 'pixelate' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => handleFilterChange('pixelate')}
                      >
                        모자이크
                      </Button>
                      <Button
                        variant={currentState.filter === 'emboss' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => handleFilterChange('emboss')}
                      >
                        엠보스
                      </Button>
                      <Button
                        variant={currentState.filter === 'edge' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => handleFilterChange('edge')}
                      >
                        윤곽선
                      </Button>
                    </div>
                  </TabsContent>
                </Tabs>
              </div>
            </Card>
          </div>
        )}
      </div>

      {/* 다운로드 포맷 선택 다이얼로그 */}
      <Dialog open={showDownloadDialog} onOpenChange={setShowDownloadDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>이미지 다운로드</DialogTitle>
            <DialogDescription>
              다운로드할 이미지 포맷을 선택하세요
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>파일 포맷</Label>
              <div className="grid grid-cols-3 gap-2">
                <Button
                  variant={downloadFormat === 'png' ? 'default' : 'outline'}
                  onClick={() => setDownloadFormat('png')}
                >
                  PNG
                </Button>
                <Button
                  variant={downloadFormat === 'jpg' ? 'default' : 'outline'}
                  onClick={() => setDownloadFormat('jpg')}
                >
                  JPG
                </Button>
                <Button
                  variant={downloadFormat === 'webp' ? 'default' : 'outline'}
                  onClick={() => setDownloadFormat('webp')}
                >
                  WEBP
                </Button>
              </div>
            </div>
            
            <div className="text-sm text-muted-foreground">
              <p>• PNG: 무손실 압축, 투명도 지원</p>
              <p>• JPG: 손실 압축, 작은 파일 크기</p>
              <p>• WEBP: 고효율 압축, 최신 포맷</p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDownloadDialog(false)}>
              취소
            </Button>
            <Button onClick={executeDownload}>
              다운로드
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}