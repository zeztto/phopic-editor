# Changelog

모든 주요 변경사항이 이 파일에 문서화됩니다.

## [1.0.3] - 2026-10-28

- 다운로드 Dialog의 닫기 button 접근성 이름을 한국어로 제공합니다.

- 초기 이미지 배치와 화면 맞추기의 높이 예산에서 canvas padding을 제외하여 기본 내부 스크롤을 방지했습니다.
- 배율·캔버스/리사이즈 크기·배경색·색상 preset·비율 유지의 접근성 이름과 label 연결을 추가했습니다.
- RGB·pixel filter가 픽셀을 읽기 전부터 모든 편집 Canvas의 첫 context 정책을 같게 하여 필터 전환 후 표시·저장 경로를 일관화했습니다.
- Canvas의 위치가 소수점 CSS 좌표일 때도 native pointer offset으로 영역을 읽어 축소 화면의 크롭·선택 픽셀 이동을 방지했습니다.
- 실제 ImageEditor fit handler·form 이름·RGB 초기화 후 블러 context·전체 영역 픽셀 회귀 test를 추가했습니다.

## [1.0.2] - 2026-10-28

- 표시 배율과 무관하게 native 픽셀에서 크롭·선택 영역을 저장하며 선택 안내선은 제외합니다.
- 필터를 native 해상도에서 적용한 뒤 표시 배율로 조정하여 확대·축소 중에도 내보내기 효과와 일치시켰습니다.
- 새 이미지 선택 이후 이전 크롭·리사이즈·캔버스 변경의 지연 decode 결과를 폐기합니다.
- 7개 조정 slider의 실제 thumb에 접근성 이름을 연결했습니다.
- 실제 ImageEditor handler의 배율·픽셀·비동기 완료 순서·접근성 회귀 test를 추가했습니다.

## [1.0.1] - 2026-10-28

- 표시·다운로드·크롭·캔버스 변경에서 같은 Canvas renderer를 사용하여 filter 결과를 유지합니다.
- 모자이크 처리에서 alpha를 유지하고 표시 배율과 다운로드 해상도를 분리했습니다.
- 연속 업로드에서 마지막 요청만 적용하고 이전 요청의 늦은 오류를 표시하지 않습니다.
- 새 이미지가 열릴 때 이전 선택 영역과 도구 상태를 초기화합니다.
- backup·가상 환경 문서·generic guideline은 공개 edition에서 제외했습니다.
- 현재 구현에 맞춰 README와 과거 기술 설명을 정정하고 원 license를 보존했습니다.
- native Canvas 회귀 test·typecheck·보안 패치·pinned CI를 추가했습니다.

## [1.0.0] - 2024-12-24

### Added
- 🎉 **최초 릴리즈**: PhoPic v1.0.0
- ✨ **완전한 이미지 편집 기능**
  - 크롭, 회전, 좌우/상하 반전
  - 리사이즈, 캔버스 확장
  - 줌 (10% ~ 500%)

- 🎨 **이미지 조정**
  - 밝기/대비/채도 조절 (0% ~ 200%)
  - RGB 채널 개별 조정
  - Hue 색상 회전 (0° ~ 360°)

- 🖼️ **14가지 필터 효과**
  - CSS 필터: 원본, 흑백, 세피아, 반전, 비네팅, 빈티지, 따뜻한, 시원한, 흐리게, 선명하게, 블러
  - 픽셀 조작 필터: 픽셀화, 엠보스, 윤곽선

- 💾 **다중 포맷 다운로드**
  - PNG (무손실 압축)
  - JPG (품질 95%)
  - WebP (고효율)

- 🚀 **히스토리 관리**
  - Undo/Redo 기능 (최대 50단계)
  - 메모리 누수 방지

- 📤 **파일 업로드**
  - 드래그 앤 드롭 지원
  - 지원 형식: JPEG, PNG, GIF, WebP

### Security
- 🔒 **강화된 보안**
  - 파일 헤더 검증 (매직 넘버)
  - MIME 타입 검증
  - 파일 크기 제한 (최대 10MB)
  - Vercel 설정에 X-Content-Type-Options, Referrer-Policy 헤더 선언
  - crypto.randomUUID() 사용 (안전한 ID 생성)

### Changed
- 🏗️ **아키텍처 개선**
  - ImageEditor 컴포넌트와 공통 타입·유틸리티·hook 파일로 구성
  - 타입 안전성 강화 (TypeScript)
  - 커스텀 훅 사용 (useImageHistory)
  - 유틸리티 함수 분리

- ⚡ **성능 최적화**
  - 코드 스플리팅 (react-vendor, ui-vendor, utils)
  - 번들 크기 최적화
  - Canvas 편집 및 파일 내보내기
  - Vite의 esbuild 압축

- 🎨 **UI/UX 개선**
  - 반응형 디자인
  - 실시간 미리보기
  - 직관적인 탭 기반 인터페이스
  - 토스트 알림 (Sonner)

### Fixed
- 🐛 **버그 수정**
  - 오타 수정: "이지가" → "이미지가"
  - Math.random() → crypto.randomUUID() (보안 개선)
  - 하드코딩 제거: "w.store_" → "phopic"
  - 히스토리 메모리 누수 방지

### Technical
- 📦 **기술 스택**
  - React 18.3.1
  - TypeScript (strict 모드)
  - Vite 6.3.5
  - TailwindCSS v4
  - Radix UI + shadcn/ui

- 🛠️ **개발 도구**
  - ESLint
  - TypeScript strict 모드
  - Path alias (@/)
  - Git hooks (선택사항)

- 🌐 **배포**
  - Vercel 정적 hosting 설정 포함
  - vercel.json 설정
  - 실제 배포와 응답 헤더 검증은 이 source edition의 local 검증 범위 밖
  - 정적 자산 캐싱 (1년)

---

## 향후 계획

### v1.1.0 (예정)
- [ ] 텍스트 오버레이 기능
- [ ] 레이어 시스템
- [ ] 추가 필터 (모자이크 크기 조절, 가우시안 블러 등)
- [ ] 단축키 지원
- [ ] 터치 제스처 지원 (모바일)

### v1.2.0 (예정)
- [ ] 배치 처리 (여러 이미지 동시 편집)
- [ ] 프리셋 저장/불러오기
- [ ] localStorage 기반 최근 작업 저장
- [ ] PWA (Progressive Web App) 지원

### v2.0.0 (장기 계획)
- [ ] 사용자 계정 (선택사항)
- [ ] 클라우드 저장소 연동 (Google Drive, Dropbox)
- [ ] 협업 기능
- [ ] 고급 편집 도구 (마스크, 클로닝 등)

---

형식: [버전] - 날짜

버전 번호는 [Semantic Versioning](https://semver.org/lang/ko/)을 따릅니다.
