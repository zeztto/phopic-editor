# 포픽

브라우저 Canvas에서 이미지를 편집하는 한국어 웹 도구입니다. 파일은 브라우저 메모리에서 처리하며 서버 업로드나 브라우저 저장소를 사용하지 않습니다.

## 실행

Node.js 22.12 이상과 npm이 필요합니다. CI는 Node.js 24를 사용합니다.

```sh
npm ci
npm run typecheck
npm test
npm run build
npm run dev
```

빌드 결과는 `dist/`에 생성됩니다. `npm run preview`로 확인하거나 정적 hosting에 `dist/`를 배포할 수 있습니다. 환경 변수는 필요하지 않습니다.

## 지원 범위

- JPEG·PNG·GIF·WebP 파일 읽기, 최대 10MB, MIME·file signature 검증
- 회전·좌우/상하 반전, 마우스·트랙패드 기반 영역 선택과 크롭, 크기 변경과 캔버스 확장
- 밝기·대비·채도·RGB 채널·색상 회전 조정
- 원본·흑백·세피아·반전·비네팅·빈티지·따뜻한·시원한·흐리게·선명하게·블러·모자이크·엠보스·윤곽선
- 최대 50개 편집 상태의 실행 취소/다시 실행
- PNG·JPG·WebP 다운로드

필터는 native 해상도에서 적용한 뒤 표시 배율로 그립니다. 표시 배율은 전체 이미지·선택 영역 다운로드와 크롭의 해상도를 변경하지 않습니다. 선택 안내선은 다운로드 이미지에 포함하지 않습니다. 크롭·크기 변경·캔버스 변경으로 만들어진 현재 이미지의 픽셀 크기로 저장합니다. `선명하게`는 대비를 높이는 효과입니다. GIF의 애니메이션 출력은 지원하지 않습니다. 영역 드래그 도구는 마우스나 트랙패드로 조작합니다.

새 이미지를 열면 작업과 실행 내역이 새 이미지로 교체됩니다. 새로고침하면 편집 상태가 사라지므로 필요한 결과는 파일로 내려받으세요. 연속 업로드에서는 마지막에 선택한 파일만 적용합니다. 새 파일을 선택하면 이전 이미지에서 대기 중인 크롭·크기 변경·캔버스 변경 결과는 폐기합니다.

## 검증

```sh
npm run typecheck
npm test
npm run build
npm audit --audit-level=high
```

회귀 test는 Node의 native Canvas에서 14개 filter의 표시/내보내기 pixel parity와 alpha를 확인합니다. 실제 ImageEditor를 mount하여 50%·100%·200% 배율의 crop/selection 다운로드, 새 upload 전후의 지연 편집 완료 순서, 화면 맞추기의 padding 예산과 form 접근성 이름을 검사합니다. 소수점 위치의 canvas에서는 실제 상대 pointer offset과 전체 선택 영역 RGBA를 확인합니다. 브라우저 Image decode와 DOM API는 test adapter로 대체하므로 pointer·file dialog·다운로드 동작의 실제 브라우저 검증을 대신하지 않습니다. Canvas filter 계산은 브라우저 구현을 따릅니다. native Canvas test adapter는 브라우저의 GPU/CPU 경로 전환을 재현하지 않으므로, 실제 RGB 조정 후 초기화·블러의 표시/저장 PNG 비교와 파일 선택·pointer 조작·다운로드는 브라우저 QA 범위입니다.

## License와 출처

원본 [MIT License](LICENSE)와 [ATTRIBUTIONS.md](ATTRIBUTIONS.md)를 유지합니다. 포함된 shadcn/ui 코드의 원 MIT 전문은 [THIRD_PARTY_LICENSES/shadcn-ui.txt](THIRD_PARTY_LICENSES/shadcn-ui.txt)에 있습니다. 외부 사진은 번들하지 않으며 test fixture는 공개 사용자 이미지나 포트폴리오 자료로 사용하지 않습니다.
