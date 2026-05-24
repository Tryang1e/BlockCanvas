# Phase 4: DB Data Fetching & Integration

- `src/app/creator/[creator_name]/page.tsx` 및 `src/app/adminpage/page.tsx`에서 서버 컴포넌트(`await createClient()`)를 활용하여 데이터를 단방향으로 패칭하는 로직을 통합했습니다.
- 보안을 배려하여 `service_role` 등의 마스터 키는 절대 사용되지 않고 프론트엔드용 `ANON_KEY`와 `URL` 만으로 접근합니다.

## 추후 개발 요구사항 (Post-MVP)
1. **포트폴리오 홈 정렬 Drag & Drop**: 크리에이터 홈 화면(갤러리)에 노출되는 프로젝트 작품들은 현재 '최신순(`created_at DESC`)'으로 배치됩니다. 사용자 피드백에 따라, 추후 크리에이터 본인이 직접 갤러리 내의 각 프로젝트 카드 위치를 드래그 앤 드롭으로 변경할 수 있도록 `sort_order` 속성 기입을 통한 정렬 기능이 신규 기능으로 추가되어야 합니다.
