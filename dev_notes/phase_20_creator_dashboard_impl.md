# Phase 20: 크리에이터 대시보드 구축 및 섹션 프라이버시 기능 구현

## 1. 섹션 가시성(Visibility) 및 프라이버시 제어
* **Prisma Schema 업데이트:** `PortfolioSection` 모델에 `is_visible` Boolean 필드를 추가하여 섹션 비공개 기능을 지원함.
* **UI 제어 추가:** 크리에이터 본인은 `SectionContainer`의 우측 상단 관리 바에서 **공개(지구본) / 비공개(자물쇠)** 토글 버튼을 통해 섹션을 제어할 수 있음.
* **렌더링 필터링:** 비공개 처리된 섹션은 일반 방문자(뷰어)에게 DOM에서 완전히 렌더링 제외되며 우측 네비게이션(ScrollSpy) 점 목록에서도 제거됨. 소유자(Owner)에게는 반투명한 점선 테두리 형태로 표시됨.
* **제목 숨기기 강화:** `showTitle` 옵션을 끌 경우, 뷰어에게는 <h2> 태그 전체가 아예 생성되지 않도록 보안 및 클린 렌더링 강화.
* **연관 게시물 노출 차단:** 방문자가 개별 프로젝트 조회 시 하단에 뜨는 "비슷한 카테고리의 다른 작품"(`otherProjects`) 추천 목록에서도 비공개 섹션의 게시물은 강제로 조회되지 않도록 백엔드(`fetchProjectDetails`) 쿼리 필터 추가.

## 2. 하이드레이션(Hydration) 에러 수정
* `UserSidebar.tsx` 내부에서 발생하는 Next.js 하이드레이션 오류(`<button>` 내부에 `<button>`이 있거나 `<a>` 내부에 `<button>`이 위치하는 문제)를 해결하기 위해 `MenuItem` 컴포넌트를 리팩토링함.
* 링크를 렌더링해야 할 경우 `type="div"`를 받아 안전한 `<div>` 래퍼로 렌더링하고, 폼 제출 시에는 `type="submit"`으로 렌더링되게 변경.

## 3. 크리에이터 대시보드 (Creator Dashboard) 신설
* 기존의 `/creator/[creator_name]/settings` 경로를 폐기하고, 사이드바를 포함한 종합 대시보드 레이아웃(`/creator/[creator_name]/dashboard`)으로 확장 이전함.

**주요 페이지 구성:**
1. **오버뷰(Overview) `/dashboard`:**
   * `recharts` 라이브러리를 도입하여 주간 조회수를 시각적으로 보여주는 Area Chart 구현.
   * 총 게시물 수, 누적 조회수, 좋아요 수, 인사이트 포트폴리오 생성 상태, 외부 연동 상태 패널 구축.
2. **게시물 관리 `/dashboard/projects`:**
   * 데이터베이스에 업로드된 크리에이터 본인의 모든 게시물 목록을 표(Table) 형태로 렌더링.
   * 게시물 종류(비디오/캔버스), 소속 섹션, 생성일 등의 정보를 한눈에 파악하고 캔버스로 바로가기 지원.
3. **프로필 및 설정 `/dashboard/settings`:**
   * 기존에 개발된 `SettingsForm.tsx`를 가져와 대시보드 UI 테마에 맞게 폼 여백과 버튼 등을 소폭 개편.
4. **계정 및 보안 관리 `/dashboard/account`:**
   * 가입/로그인 시 사용하는 마스터 이메일 확인 및 비밀번호 변경 등 핵심 개인 정보 영역 구현.
   * 위험 구역(Danger Zone: 계정 삭제)은 현재 기획상 필요치 않아 UI에서 즉시 제거함.

## 4. 포트폴리오 UI/UX 스크롤 및 렌더링 버그 수정
* **네비게이션 메뉴 추가:** `UserSidebar`의 드롭다운 메뉴 최상단에 '내 포트폴리오로 가기' 버튼을 추가하여 대시보드와 포트폴리오 간 이동 편의성 개선.
* **스크롤 충돌 해결:** `ProjectModal` (프로젝트 팝업) 닫기 시 `document.body.style.overflow = 'auto'` 로 강제 덮어씌워지며 `Lenis Smooth Scroll`과 충돌해 페이지 스크롤이 먹통이 되던 현상을 `overflow = ''` 로 초기화하도록 수정.
* **ScrollTrigger 고무줄 스크롤 현상 해결:** 하단 연락처 명함(`BusinessCardContact`) 섹션 진입 시 GSAP `pin: true` 속성이 부드러운 스크롤 엔진(Lenis)의 높이 계산을 방해해 마우스 휠 스크롤이 특정 위치로 튕겨 돌아가던 버그 수정 (`pin` 속성 제거 및 스크럽 애니메이션으로 대체).
* **텍스트 Fill 애니메이션 렌더링 잘림 현상 해결:** 한글 폰트 특성상 글자 렌더링 박스(Line Height) 아래로 삐져나오는 받침이 GSAP `clipPath` 의 `inset(0 0% 0 0)` 제약과 부모 div의 `relative block` 속성에 의해 강제로 잘려 렌더링 되던 이슈를 `inset(-50% 100% -50% -10%)` 로 자르기 영역을 확장하고 위치를 `absolute top-0 left-0` 으로 독립시켜 완벽히 해결함.
