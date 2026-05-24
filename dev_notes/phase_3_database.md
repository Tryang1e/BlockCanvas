# Phase 3: 데이터베이스 정규화 및 테스트 데이터 (Supabase SQL)

새로운 Supabase 프로젝트를 생성하신 후, 좌측 메뉴의 **[SQL Editor]**에 들어가서 아래 쿼리들을 복사하여 붙여넣기(Run) 하시면 BlockCanvas의 완벽한 DB 구조가 셋업됩니다.
해당 스키마는 **최대 정규화 효율성**을 고려하여 프로필, 포트폴리오, 프로젝트, 위젯, 태그 및 카테고리가 완벽히 분리되어 동작하도록 설계했습니다.

---

## 1. 테이블 생성 (Schema DDL)

```sql
-- 1. 카테고리 (분류)
CREATE TABLE public.categories (
    id SERIAL PRIMARY KEY,
    name TEXT UNIQUE NOT NULL
);

-- 2. 태그 (검색 특화)
CREATE TABLE public.tags (
    id SERIAL PRIMARY KEY,
    name TEXT UNIQUE NOT NULL
);

-- 3. 프로필 (유저 확장 테이블 - Supabase auth.users 연동 대비)
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(), -- 추후 auth.uid()와 일치시킴
    role TEXT NOT NULL CHECK (role IN ('admin', 'creator')),
    creator_name TEXT UNIQUE NOT NULL, -- url 서브도메인용: tryangle
    display_name TEXT NOT NULL,       -- 화면 출력용: Tryangle
    email TEXT,
    avatar_url TEXT,
    commission_open BOOLEAN DEFAULT false,
    discord_id TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. 포트폴리오 메인 정보 (1:1 with Profiles)
CREATE TABLE public.portfolios (
    creator_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
    headline TEXT,
    about_text TEXT,
    contact_email TEXT,
    youtube_url TEXT
);

-- 5. 개별 프로젝트 (포트폴리오의 각 작품)
CREATE TABLE public.projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    creator_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    category_id INTEGER REFERENCES public.categories(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    description TEXT,
    thumbnail_url TEXT,
    views_count INTEGER DEFAULT 0,
    likes_count INTEGER DEFAULT 0,
    is_published BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 6. 프로젝트 태그 연결 (Many-to-Many Junction Table)
CREATE TABLE public.project_tags (
    project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
    tag_id INTEGER REFERENCES public.tags(id) ON DELETE CASCADE,
    PRIMARY KEY (project_id, tag_id)
);

-- 7. 프로젝트 에디터 위젯 (Drag & Drop 블록들)
CREATE TABLE public.project_widgets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
    widget_type TEXT NOT NULL CHECK (widget_type IN ('image', 'text', 'grid', 'video', 'embed', '3d')),
    content JSONB NOT NULL DEFAULT '{}'::jsonb, -- 텍스트 html이나 이미지 url 배열 등을 JSONB로 유동성있게 저장
    sort_order INTEGER NOT NULL, -- 드래그앤 드롭 순서
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);
```

---

## 2. 테스트 데이터 시드 (Dummy Seed)

```sql
-- 기본 카테고리 삽입
INSERT INTO categories (name) VALUES 
('Architecture'), ('Redstone'), ('Organic'), ('Survival'), ('Mod/Plugin');

-- 기본 태그 삽입
INSERT INTO tags (name) VALUES 
('Cyberpunk'), ('Medieval'), ('Fantasy'), ('Modern'), ('MegaBuild');

-- 테스트 관리자(Admin) & 크리에이터(Creator) 생성
INSERT INTO profiles (id, role, creator_name, display_name, email, commission_open, discord_id) VALUES 
('11111111-1111-1111-1111-111111111111', 'admin', 'admin', '운영자', 'admin@craftopia.work', false, 'admin#0000'),
('22222222-2222-2222-2222-222222222222', 'creator', 'tryangle', 'Tryangle', 'tryangle@craftopia.work', true, 'tryangle#1234'),
('33333333-3333-3333-3333-333333333333', 'creator', 'redstone_master', '레드스톤 깎는 노인', 'red@craftopia.work', false, 'redstone#9999');

-- 크리에이터 포트폴리오 세팅
INSERT INTO portfolios (creator_id, headline, about_text, contact_email, youtube_url) VALUES 
('22222222-2222-2222-2222-222222222222', 'Minecraft Level Designers', '중세건축 및 텍스쳐 디자인 전문입니다.', 'yeong@gmail.com', 'https://youtube.com'),
('33333333-3333-3333-3333-333333333333', 'Redstone Architecture Logic', '회로의 모든 것. 자동화 농장 설계 가능', 'red@craftopia.work', NULL);

-- 테스트용 프로젝트 삽입
INSERT INTO projects (id, creator_id, category_id, title, description, is_published, views_count, likes_count) VALUES 
('aaaa1111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', 1, 'Ancient Temple Remastered', '중세 신전 리마스터', true, 4500, 1200),
('bbbb2222-2222-2222-2222-222222222222', '33333333-3333-3333-3333-333333333333', 2, '16-bit Redstone ALU', '레드스톤 계산기', true, 2100, 850);

-- 프로젝트 태그 연결
INSERT INTO project_tags (project_id, tag_id) VALUES 
('aaaa1111-1111-1111-1111-111111111111', 2), -- Medieval
('aaaa1111-1111-1111-1111-111111111111', 5); -- MegaBuild

-- 테스트 위젯 삽입 (에디터에 저장된 블록 데이터)
INSERT INTO project_widgets (project_id, widget_type, content, sort_order) VALUES 
('aaaa1111-1111-1111-1111-111111111111', 'text', '{"text": "<h2>메인 홀 건축 과정</h2><p>처음에는 블록 위주로 잡았습니다.</p>"}', 0),
('aaaa1111-1111-1111-1111-111111111111', 'image', '{"url": "https://example.com/build1.jpg", "caption": "정면 뷰"}', 1),
('bbbb2222-2222-2222-2222-222222222222', 'video', '{"embed_url": "https://youtube.com/embed/..."}', 0);
```
