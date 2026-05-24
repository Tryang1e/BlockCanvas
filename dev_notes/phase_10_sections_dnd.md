# Phase 10: Section Grouping & Drag-and-Drop Reordering

## Overview
기존 최신순(created_at)으로 단순 나열되던 포트폴리오 프로젝트들을 **섹션(Section)** 단위로 묶어서 관리하고, 사용자가 직접 마우스 드래그 앤 드롭으로 **순서를 변경(Reordering)** 할 수 있도록 고도화합니다. 또한, 메이슨리(Masonry) 레이아웃의 우측 빈 공간 문제를 해결하기 위해 완벽한 **CSS Grid**로 전환합니다.

## 진행 사항 (Completed & In Progress)
- [x] **DB 구조 변경 (Supabase)**
  - `portfolio_sections` 테이블 생성 (`id`, `creator_id`, `name`, `sort_order`).
  - `projects` 테이블에 `section_id`, `sort_order` 컬럼 추가.
- [x] **라이브러리 설치**
  - React 공식 권장 라이브러리 `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities` 설치.
- [ ] **레이아웃 전환 (CSS Grid)**
  - `columns-1 sm:columns-2 ...` 를 `grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4` 형태로 변경.
- [ ] **UI 컴포넌트 구현**
  - `DraggablePortfolio.tsx`: 전체 섹션과 프로젝트 상태를 관리하고 Drag & Drop Context를 제공하는 클라이언트 컴포넌트.
  - "프로젝트 제작" 전용 고정 더미 카드 구현 (에디터 링크 연결).
- [ ] **서버 액션 (Server Actions) 구현**
  - 섹션 추가, 프로젝트 순서 변경, 섹션 순서 변경을 데이터베이스에 반영하는 로직 구현.

## 구현 지침 (Technical Guidelines)
1. **DND Kit 적용**: 다중 컨테이너(Multiple Containers) 드래그 앤 드롭을 지원해야 하므로, `SortableContext`를 섹션별로 분리하고, 부모 컴포넌트에서 `DndContext`를 최상위로 감싸서 관리합니다.
2. **Optimistic UI**: 드래그 앤 드롭 시나리오에서는 네트워크 지연을 방지하기 위해 프론트엔드 상태를 먼저 업데이트하고, 백그라운드에서 Server Action으로 DB를 업데이트합니다.
3. **기본 섹션(Default Section)**: 프로젝트 생성 시 특정 섹션을 지정하지 않으면 시스템이 자동으로 부여한 "기본 섹션"에 할당되도록 처리합니다.

## 이후 계획 (Next Steps)
- 실제 인증(Auth) 시스템이 도입되면, 자신의 포트폴리오 페이지를 조회할 때만 드래그 앤 드롭이 가능하도록 **편집자 모드**와 **뷰어 모드**를 분리해야 합니다. 현재는 개발 목적으로 드래그 핸들과 섹션 추가 기능이 항상 노출됩니다.
