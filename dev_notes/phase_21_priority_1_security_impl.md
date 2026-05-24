# Phase 21: Priority 1 (보안 및 코어 기능 구현)

## 1. Broken Access Control (권한 탈취) 취약점 완벽 방어
* **문제점:** 기존 Server Actions(`section.ts`, `project.ts`, `portfolio.ts`, `profile.ts`, `publish.ts`, `auth.ts`)에서 클라이언트가 전달한 `creatorName` 매개변수만 믿고 데이터를 수정하거나 삭제하는 치명적 보안 결함이 존재했습니다. 누군가 악의적으로 다른 사람의 아이디로 요청을 보내면 데이터가 훼손될 수 있었습니다.
* **해결책:**
  * 서버에서 현재 유저의 세션 쿠키를 직접 확인하고 `creator_name`과 대조하는 `requireAuth` 헬퍼 함수(`src/lib/server-auth.ts`)를 신설했습니다.
  * 모든 주요 Server Actions에 `requireAuth` 검증을 최상단에 추가하여, 본인의 세션이 아니면 즉각 `Error`를 던지도록 원천 차단했습니다.
  * DB 업데이트 시 `updateMany`나 `deleteMany`를 활용해 `creator_id`가 일치하는 항목만 조작하도록 이중 안전장치를 마련했습니다.

## 2. 포트폴리오 공개 여부 (Publish Toggle) 제어 구현
* **데이터베이스 확장:** `Portfolio` 모델에 `is_published` (Boolean, 기본값 true) 필드를 추가했습니다.
* **UI 및 액션 연동:**
  * 크리에이터 대시보드의 프로필 설정(`/settings`) 페이지 최상단에 **포트폴리오 공개 여부 토글 스위치** UI를 추가했습니다.
  * 토글 클릭 시 `is_published` 상태를 변경하는 `togglePortfolioPublishAction`을 연결했습니다.
* **라우팅 가드:** 포트폴리오 방문(`/creator/[creator_name]`) 시, 본인이 아닌 일반 방문자는 `is_published`가 false일 경우 "현재 비공개 상태인 포트폴리오입니다"라는 안내 화면만 보이고 접근이 차단되도록 설계했습니다.

## 3. 계정 관리 및 비밀번호 변경 보안 강화
* 대시보드의 `/account` 탭 내 비밀번호 변경 폼이 사용하는 `changePasswordAction`에 세션 검증 로직을 추가하여, 타인이 악의적으로 비밀번호를 변경하지 못하도록 조치했습니다.

## 4. 에러 핸들링 및 스택 트레이스 노출 방어
* **글로벌 에러 바운더리:** `src/app/error.tsx`를 생성하여, 서버 컴포넌트 렌더링 중 발생하는 런타임/DB 에러나 예외 발생 시 Next.js의 기본 에러창 대신 커스텀 에러 화면을 띄우게 만들었습니다. 이를 통해 민감한 스택 트레이스(Stack Trace)가 프로덕션이나 콘솔에 노출되는 것을 방지합니다.
* **커스텀 404 페이지:** `src/app/not-found.tsx`를 디자인하여 404 발생 시 시스템 정보를 노출하지 않도록 조치했습니다.

## 5. SQL Injection 방지 검토
* 코드베이스 전반에 걸쳐 `queryRaw`와 같은 안전하지 않은 원시 SQL 사용이 전혀 없음을 확인했습니다. 모든 쿼리가 Prisma Client의 내장 메서드로 동작하므로, 내부적으로 **파라미터 바인딩(Prepared Statements)**이 완벽히 지원되어 SQL 인젝션 위협으로부터 안전합니다.
