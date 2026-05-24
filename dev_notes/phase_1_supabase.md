# Supabase 연동 및 권고사항

## 진행 사항
- `@supabase/supabase-js`, `@supabase/ssr` 모듈 설치를 진행합니다.
- Next.js 서버 컴포넌트(Server Actions), 클라이언트 컴포넌트 환경에서 각각 쓰일 Supabase 인스턴스 유틸(`src/lib/supabase`)을 생성합니다.

## 개발 권고/지침 사항
1. **서버 컴포넌트 활용 지향**: 가급적 Next.js의 Server Component에서 DB 페칭을 진행하여 초기 렌더링 최적화를 꾀합니다.
2. **쿠키(Cookie) 관리**: `@supabase/ssr` 패키지가 제공하는 쿠키 기반 세션 방식을 사용하여 미들웨어에서 권한 인가(Auth)가 매끄럽게 처리되도록 합니다.
3. **환경 변수**:
   - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`를 필수로 사용합니다.
   - 깃허브에는 절대 커밋되지 않도록 `.env.local`로만 관리합니다.
4. **타입스크립트 활용**: Supabase CLI 등을 통해 생성된 Database Types(`types/supabase.ts`)를 활용하여 타입 안정성을 확보하는 것이 좋습니다.

## Database Schema 기초 (기획 초안)
- `profiles`: id(uuid, PK), role(admin/user), creator_name(커스텀 도메인 식별자, Unique), username, avatar_url, commision_open(boolean)
- `projects`: id(uuid), creator_id(profiles.id FK), title, thumbnail, views, likes, created_at
- `widgets`: id(uuid), project_id(projects.id FK), type(image/slider/embed/text), content(json), order_index(int)
