# 목표

## Behance와 같은 마인크래프트 포트폴리오 사이트

### 툴 사용

- Next.js
- Tailwind CSS
- TypeScript
- Supabase
- Vercel


### 구조

- Main 홈페이지['main']
    - 크리에이터 포트폴리오['creator'] 
        - 크리에이터 포트폴리오 내 위젯 생성,수정,삭제등 크리에이터 관리 페이지(유저 로그인 필요) "example1.png", "example2.png"
        - 크리에이터 포트폴리오 페이지(유저 로그인 필요) "example3.png", "example4.png"
    - 연혁['history']
    - 소개['about']
    - 크리에이터 소개['creator_about']


- 관리자 페이지['adminpage']
    - 크리에이터 관리 (회원 삭제 및 크리에이터 포트폴리오 사이트 생성 및 삭제, 수정 )
    - 사이트 관리
        - 사이트 생성,수정,삭제등 사이트 관리 페이지(관리자 로그인 필요)
        - 사이트 페이지(관리자 로그인 필요)

//['example'] : 명칭
['main']
http://craftopia.work/

['history']
http://craftopia.work/history

['about']
http://craftopia.work/about

['creator_about']
http://craftopia.work/creator_about

['creator']
http://craftopia.work/creator/{creator_name}/
(= https://{creator_name}.craftopia.work/)

['adminpage']
http://craftopia.work/adminpage

### 권한
- 관리자
    - 사이트 관리 ( 사이트 수정, 삭제, 생성 권한 )
    - 크리에이터 관리 ( 크리에이터 수정, 삭제, 생성 권한 )

- 크리에이터(유저)
    - 크리에이터 대시보드
        - 인사이트 포트폴리오 페이지 생성 여부
        - 크리에이터 본인의 마인크래프트 계정과 건축서버 연동 ** 미정 **
        - 포트폴리오 페이지 조회수 및 통계 등 노출
        - 포트폴리오 페이지 게시글 관리
        - 크리에이터 개인정보 관리( 로그인/비밀번호, 이메일 등)
        - 프로필 정보 페이지 수정 ( 닉네임, 프로필사진, 소셜링크 등 )
    - 크리에이터 포트폴리오 페이지 ( 포트폴리오 내 위젯 수정, 삭제, 생성 권한 )
        - 위젯 : 사이트, 이미지, 소개, 등

### 목표

1. 마인크래프트 포트폴리오 기능을 하게끔 페이지를 운영
    - 대표적인 사이트 : https://www.behance.net/try_ang1e/

2. 각 크리에이터가 자신의 포트폴리오를 관리할 수 있게끔 한다.
    - 향후 목표 : https://{creator_name}.craftopia.work/ 로 접속하면 해당 크리에이터의 포트폴리오를 볼 수 있게 한다. 

3. 메인 페이지 제작전, 크리에이터 포트폴리오 페이지와 관리자 페이지를 먼저 제작한다. (핵심)

### 세부 목표 - [ 포트폴리오 페이지 ]

1. **포트폴리오 기능 강화 (마인크래프트 특화 기능)**
    - 작품 업로드 시 이미지 전후(Before/After) 슬라이더, 동영상 임베드, 다운로드(월드맵/모드) 링크 위젯 지원.
    - 외주 (Commission) 가능 여부 지원 및 연락처 (Discord, 이메일) 및 외부사이트 명시.
    - 글 작성 및 삭제기능 추가
    - 위젯 배치 변경 가능 ("example1.png")

2. **포트폴리오 페이지**
    - 글 작성 후
        - ``https://www.behance.net/gallery/162425003/Ancient-Temple`` 다음과 페이지처럼 소개
    - 글 작성 시
        - ``example5.png``와 같은 이미지
    - 글의 대표이미지
        - ``example6.png``와 같은 이미지
    - 
### 세부목표 - [ 메인 페이지 ]
    - 아직 보류

### 새부목표 - [ 관리자 페이지 ]
    - 관리자 로그인 페이지
        - 관리자로써 사이트 관리 및 크리에이터 관리 페이지
            - 사이트 관리 
                - 사이트 생성,수정,삭제등 사이트 관리 페이지(관리자 로그인 필요)
                - 사이트 페이지(관리자 로그인 필요)
            - 크리에이터 관리
                - 크리에이터 수정, 삭제, 생성 권한

## 🛠️ 개발 로드맵 (Milestones)

- **Phase 1 (MVP - 핵심 타겟 우선 개발)**
    - 관리자(Admin) 페이지 개발: 크리에이터 계정 관리, 포트폴리오 관리.
    - 크리에이터 포트폴리오 페이지 개발: 프로필 설정, 포트폴리오 생성/위젯 관리 기능(CRUD).
    - 데이터베이스(Supabase) 기본 스키마 설계 및 연동.
- **Phase 2 (탐색 및 개인화 지원)**
// - Main 홈페이지 개발: 크리에이터 찾기, 탐색(Explore) 피드 추가. **아직보류**
    - 커스텀 서브도메인 라우팅 구현 (`https://{creator_name}.craftopia.work`).
- **Phase 3 (소셜 & 기능 고도화)**
//    - 크리에이터 대시보드(조회수, 방문자 통계 분석) 제공.
보류

## 🗄️ 데이터베이스 스키마 구상 (Supabase)
*본격적인 개발 전 변경될 수 있음*

- **`Profiles` (유저 정보)**: UUID, 역할(Admin/User), 닉네임, 프로필 사진, 소셜 링크, 외주 가능 여부.
- **`Portfolios` (포트폴리오 대시보드)**: 소개글, 커스텀 주소 식별자(`creator_name`).
- **`Projects` (개별 작품)**: 프로젝트 제목, 썸네일, 카테고리(건축/레드스톤 등), 태그 정보, 조회수, 좋아요 수 등.
- **`Widgets` (페이지 구성 블록)**: 프로젝트 뷰 안에 포함될 각 요소(텍스트, 이미지 슬라이더, 영상 링크 등)의 타입과 정렬 순서값.

## 🚀 시작하기 (Getting Started)

1. **패키지 설치**
    ```bash
    npm install
    ```
2. **환경 변수 설정 (`.env.local`)**
    ```env
    NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
    NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
    ```
3. **로컬 개발 서버 실행**
    ```bash
    npm run dev
    ```
