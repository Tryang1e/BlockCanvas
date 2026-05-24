# Phase 2: 포트폴리오 갤러리 & 에디터 UI 개발 지침

## 진행 사항
- Vercel의 Image Gallery (Masonry) 패턴과 Portfolio Blog의 안정성을 기반으로 레이아웃을 구축.
- `/creator/[creator_name]/editor` 라우트를 통한 비핸스 스타일 캔버스 에디터 화면 구축.

## 개발 권고/지침 사항
1. **Masonry Layout 전략**: 최신 Tailwind인 `columns-1 sm:columns-2 lg:columns-3 gap-6` 와 무장애 처리인 `break-inside-avoid`를 활용하여 css column-count 기반 메이슨리를 구현합니다. JS 연산 비용을 줄일 수 있습니다.
2. **에디터 상태 관리**: 차후 위젯 배치 구조가 복잡해지면 (ex: 이미지 -> 텍스트 -> 비디오 순서 변경), React의 상태(State)나 Redux/Zustand 같은 관리 도구를 도입해야 하므로, 우선 모든 렌더링 뷰를 독립된 블록 컴포넌트로 만듭니다.
3. **에셋 모달 지연 로딩**: Publish 모달은 꽤 큰 용량의 폼 요소를 갖기 때문에, 초기 렌더에서는 감춰두고 나중에 로딩되도록 관리합니다.
