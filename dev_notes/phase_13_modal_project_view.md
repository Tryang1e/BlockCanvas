# Phase 13: 프로젝트 모달 뷰어 (Intercepting Routes)

## 상황 및 배경
- 사용자가 포트폴리오 페이지(`/creator/[creator_name]`)에서 프로젝트 썸네일을 클릭했을 때, 화면이 완전히 넘어가는 대신 **Behance와 유사하게** 기존 화면 위에 모달로 프로젝트 내용이 띄워지기를 원했습니다.
- Next.js App Router의 강력한 라우팅 기능인 **Intercepting Routes(가로채기)** 와 **Parallel Routes(병렬 라우트)** 를 사용하여 이 기능을 구현했습니다.

## 주요 작업 내역
1. **공용 뷰어 컴포넌트 추출**
   - 기존의 `project/[project_id]/page.tsx`에 하드코딩 되어있던 상세 페이지 UI를 `ProjectDetailsViewer.tsx` 컴포넌트로 분리했습니다.
   - 이렇게 분리하여 모달 안에서도 쓰고, 새로고침 시 나타나는 전체 화면에서도 재사용할 수 있도록 만들었습니다.

2. **Parallel Routes (`@modal`) 적용**
   - `src/app/creator/[creator_name]/layout.tsx`를 생성하여 기존 `children`과 함께 `modal` 슬롯을 렌더링하도록 설정했습니다.
   - 평소(모달이 필요 없을 때)에는 빈 화면을 반환하는 `@modal/default.tsx`를 생성했습니다.

3. **Intercepting Routes 적용**
   - `@modal/(.)project/[project_id]/page.tsx` 라우트를 생성했습니다.
   - `(.)`의 의미는 "같은 레벨의 라우트를 가로챈다"는 뜻입니다. 즉, 포트폴리오 페이지에서 `project/[id]`로 가는 `<Link>` 클릭을 감지하면, 일반 페이지 이동을 막고 이 `@modal` 슬롯에 해당 컴포넌트를 띄워줍니다.

4. **클라이언트 모달 구현 (`ProjectModal.tsx`)**
   - 검은색 반투명 배경(Backdrop)과 중앙의 백색 스크롤 영역을 구현했습니다.
   - 배경을 클릭하거나 `ESC` 키, 우측 상단 `X` 버튼을 누르면 `router.back()`을 호출하여 부드럽게 닫히도록 했습니다.
   - 모달이 열린 상태에서는 부모 윈도우(배경)가 스크롤되지 않도록 `document.body.style.overflow = 'hidden'` 처리를 추가했습니다.

## 결과 및 장점
- 페이지를 뒤로 가기(`router.back()`) 하더라도 상태를 잃지 않고 자연스럽게 이전 스크롤 위치로 돌아갑니다.
- 클릭 시 모달이 뜨더라도 URL은 정상적으로 `/project/[id]`로 바뀝니다. 따라서 링크 공유가 가능합니다.
- 모달 상태에서 새로고침을 하거나 주소창에 직접 링크를 쳐서 들어오면(가로채기 조건 불충족 시), 자연스럽게 전체 화면 전용 뷰가 나타납니다.
