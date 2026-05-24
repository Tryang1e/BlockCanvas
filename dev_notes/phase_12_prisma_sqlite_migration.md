# Phase 12: Migration from Supabase to Prisma (SQLite)

## 상황 및 배경
- 기존에 시도했던 Supabase On-Premise (Docker 기반) 마이그레이션이 윈도우 환경(WSL2/Hyper-V)의 Docker Desktop 응답 없음(Freeze) 문제로 인해 원활하게 진행되지 못함.
- Docker 같은 무거운 외부 의존성을 완전히 제거하고, 파일 기반으로 빠르고 가볍게 구동되는 순수 로컬 데이터베이스(SQLite) 아키텍처로 전면 수정(Pivot)하기로 결정함.

## 주요 작업 내역 (Prisma 도입)
1. **Prisma ORM 세팅 및 스키마 설계**
   - `@prisma/client` 패키지 설치.
   - 기존 Supabase 테이블 구조와 1:1로 매칭되는 `schema.prisma` 작성 완료 (`Profile`, `Portfolio`, `PortfolioSection`, `Project`, `ProjectWidget`).
   - `npx prisma db push`를 통해 로컬 파일 데이터베이스인 `dev.db` 생성 완료.

2. **로컬 미디어 업로드 구조 확인**
   - 위젯 이미지나 비디오 등을 처리하는 `/api/upload` (즉, `src/app/actions/upload.ts`) 로직이 이미 Supabase Storage가 아닌 Node.js 로컬 파일 시스템(`fs`)을 사용하여 `public/uploads/projects` 폴더에 저장하고 있었음을 확인. (수정 불필요)

3. **서버 액션 (Server Actions) 전면 재작성**
   - `@supabase/supabase-js` 기반의 모든 CUD(생성/수정/삭제) 로직을 Prisma 문법으로 전면 교체.
   - `auth.ts`: 로컬 개발용 목업(Mock) 쿠키 기반 세션 인증으로 대체 (실 서비스 배포 전까지는 임시 사용).
   - `profile.ts`, `banner.ts`, `avatar.ts`: 프로필 및 배너 관련 업데이트를 `prisma.upsert()` 로직으로 개선.
   - `publish.ts`, `section.ts`, `projects.ts`: 전체 프로젝트/섹션/위젯 삽입 및 삭제 로직 전환 및 SQLite에서 지원하지 않는 Json 타입 필드 처리를 위해 `JSON.parse` 및 `JSON.stringify` 적용.

4. **서버 컴포넌트 데이터 페칭 재작성**
   - `/adminpage`: 크리에이터 및 전체 프로젝트 개수 통계와 유저 리스트 페칭 로직 교체 (`.findMany()`, `.count()`).
   - `/creator/[creator_name]`: Creator Portfolio 페이지 렌더링 시 사용되던 Supabase `.eq()` 조인을 Prisma의 `include` 조건문으로 깔끔하게 교체.

5. **의존성 클린업 (Cleanup)**
   - 더 이상 사용되지 않는 `@supabase/ssr`, `@supabase/supabase-js` 패키지 삭제.
   - `src/lib/supabase` 폴더 및 유틸리티 함수 전면 삭제.
   - 인증 처리를 담당하던 `src/middleware.ts` 로직을 임시 로컬 쿠키 체크용으로 단순화.
30. **데이터 마이그레이션 (Data Migration)**
    - 기존 Supabase(Postgres)에 있던 데이터를 로컬 SQLite(`dev.db`)로 이전하는 커스텀 마이그레이션 스크립트 작성 및 실행.
    - `profiles`, `portfolios`, `portfolio_sections`, `projects`, `project_widgets` 테이블의 모든 데이터를 REST API를 통해 페칭하여 이전 완료.
    - 마이그레이션 결과: 프로필 4개, 포트폴리오 3개, 섹션 4개, 프로젝트 14개, 위젯 27개 이전 확인. (중간에 멈춤 없이 전체 데이터 이사 완료)

## 결과 및 향후 계획
- 현재 `npm run dev` 실행 시 로컬의 `dev.db`를 물고 정상적으로 개발 서버가 구동됨 (Next.js 16.2 + Prisma 7).
- Supabase 클라우드 의존성 없이 로컬 데이터베이스만으로 모든 기능(CRUD)이 정상 작동하는 것을 확인.
- 데이터 마이그레이션이 성공적으로 완료되어 기존 Supabase에 있던 크리에이터 및 프로젝트 데이터가 로컬 환경으로 모두 이관됨.
- 향후 계획: 모바일 반응형 UI 최적화 및 위젯 에디터 기능 고도화 예정.
- 필요 시 터미널에서 `npx prisma studio`를 입력하여 데이터를 시각적으로 관리 가능.
