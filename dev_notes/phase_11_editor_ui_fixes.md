# Phase 11: Editor & Portfolio UI Fixes

## 개요
크리에이터 포트폴리오 및 에디터 화면에서 발생했던 UI 안정성 문제와 사용자 경험(UX) 이슈들을 해결한 작업 내역입니다. 모바일 화면 최적화 작업은 추후 진행하기로 결정되었습니다.

## 주요 작업 내역

### 1. 스크롤 애니메이션 떨림 현상 수정 (`SectionContainer.tsx`)
- **원인:** 애니메이션이 적용되어 위치(`translate-y`)가 변경되는 요소에 직접 `IntersectionObserver`를 부착하여 관찰자 피드백 루프가 발생.
- **해결:** 애니메이션이 적용되는 요소를 고정된 부모 `div` (Wrapper)로 감싸고, 해당 부모 `div`에 옵저버를 부착하여 떨림 현상을 완전히 해결했습니다.

### 2. 드래그 앤 드롭 버그 수정 (`SectionContainer.tsx`)
- **원인:** 섹션을 드래그한 후 제자리에 놓았을 때 화면에 보이지 않는 문제. 드래그 완료 후 `useEffect`가 재실행되지 않아 애니메이션 상태값이 초기화되지 않았음. (이 과정에서 발생했던 `isDragging` TDZ 참조 에러 해결 포함)
- **해결:** `useEffect`의 의존성 배열에 `isDragging` 상태를 추가하여, 드래그가 끝날 때마다 컴포넌트가 정상적으로 다시 관찰(observe)되도록 수정했습니다. `useSortable` 훅의 호출 순서도 정상화했습니다.

### 3. 상태(State) 불일치 버그 수정 (`DraggablePortfolio.tsx`)
- **원인:** DB에서 성공적으로 프로젝트가 삭제되었으나, `DraggablePortfolio`의 로컬 `useState`가 초기화되지 않아 화면에서 삭제된 항목이 그대로 남아있던 문제.
- **해결:** `useEffect`를 추가하여 서버 액션 후 `router.refresh()`로 전달되는 새로운 `initialProjects` 및 `initialSections` 데이터가 로컬 상태(State)와 동기화되도록 수정했습니다.

### 4. 삭제 실수 방지 및 모달 개선
- **에디터 캔버스 (`EditorCanvas.tsx`):** 위젯의 휴지통(삭제) 버튼 클릭 시, 바로 삭제되지 않도록 `window.confirm`을 추가하여 안전망을 구축했습니다.
- **포트폴리오 화면 (`ProjectActionButtons.tsx`):** `dnd-kit`의 마우스 이벤트 캡처로 인해 브라우저 기본 `window.confirm` 창이 무시되는 버그를 발견. 이를 해결하기 위해 고급스러운 **커스텀 인라인 확인창(오버레이 모달)** 을 자체적으로 구현하여 `onPointerDown` 이벤트에서도 완벽하게 동작하도록 수정했습니다.

## 보류된 작업 (Deferred)
- **모바일 화면 대응 및 반응형 최적화:** 현재 데스크탑 기반의 사용성 개선에 집중하기 위해 모바일 디바이스(스마트폰 해상도)를 위한 반응형 뷰 작업은 다음 페이즈 혹은 추후 과제로 미뤄두었습니다.
