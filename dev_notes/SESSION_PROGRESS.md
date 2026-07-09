# 작업 진행 상태 (보안 하드닝 + 애니메이션) — 핸드오프 노트

> 이 파일은 긴 세션의 컨텍스트를 `/compact` 하기 전에 핵심만 보존하기 위한 메모입니다.
> 전체 보안 분석은 `Security.md` 참고.

## ⚙️ 운영/적용 (중요)
- 사이트: `next start`로 `localhost:3000` 서빙 + **Cloudflare 터널**(craftopia.work, 터널 ID `b9eb2254`로 교체 완료).
- **변경 적용 = `Ctrl+C` → `npm run build` → `npm run start`.** (빌드 GREEN 상태)
- **`SESSION_SECRET`은 `.env`에 필수**(64자). 재시작 시 **전 사용자 1회 재로그인**(의도된 동작).
- 워킹트리에 **사용자 병행작업이 대량 섞임**(MC_SER/, explore/, inquiries/, privacy/, dashboards 등) → **무작정 커밋 금지.**
- `.gitignore`에 `prisma/dev.db`(+SQLite), `/scratch/`, `/CloudflaredTunnel/` 추가됨. `MC_SER`은 tsconfig `exclude`로 빌드 제외.
- ⚠️ Cloudflare 터널 **자격증명 재발급**은 사용자가 직접(옛 터널 aa0a/f61f 삭제됨). git 히스토리엔 옛 자격증명 잔존 가능.

## ✅ 보안 (#1~#20 전부 완료)
세션키(SESSION_SECRET 필수화) / 프로필 비번해시·2FA시크릿 클라이언트 유출 차단(safeProfile+omit, 4곳) / metadata SSRF 방어 / debug-proxy·test-route 백도어 삭제 / 아바타·배너 IDOR(requireAuth) / 문의함 IDOR + 입력검증·IP레이트리밋 / 업로드 인증 / 파일삭제 경로탐색 / 쿼리로깅 운영 OFF / 터널 자격증명 git 제외 / iframe XSS 허용목록(sanitize-html.ts) / uploads 서빙 경로탐색 / signup 게이트(ENABLE_SIGNUP) / 대리로그인 정리(서버액션 사용, API라우트 삭제) / CSP 최소(object-src/base-uri/frame-ancestors) / 비공개 프로젝트 노출 차단 / 조회수 중복방지 / 무차별대입 레이트리밋(login·2FA) + 2FA epochTolerance 60s + 000000 마스터코드 제거.
- 남은 설계/낮음 항목(세션 만료·폐기, 이메일 검증, SQLite→DB 등)은 Security.md에 있음.

## ✅ 애니메이션 (완료)
- 신규: **이미지 라이트박스**(Lightbox.tsx) / **텍스트 3종**(Scramble·Wave·Neon) / **버튼 2종**(Glow·Shine) / **배경 2종**(Mesh Gradient·Film Grain) / **섹션 진입 프리셋 4**(slide-down·blur-in·pop·rotate-in).
- 개선: TypingText 루프, **reduced-motion 전면 대응**(globals.css + MotionConfig + Lenis + 커서 + Hero + 배경), **배경 lazy-load**, **탭 비활성 시 배경 정지**, **모바일 무거운 배경 자동 비활성**(#18), 커서 터치기기 비활성, 버튼 rel, SmoothScroll 디버그로그 제거.
- 등록 위치(효과 추가 시): animate-ui.tsx(컴포넌트) + HTMLRenderer.tsx(switch) + RichTextEditor.tsx(select·preview·삽입메뉴) / 배경은 DynamicBackground effectMap + ThemeEffectEditor.
- 에디터 수정: **버블메뉴 안정화**(showToolbar 7초 idle 분리 → 선택 시 항상 표시), **lasso 우→좌 드래그**(빈영역 시작 감지) + **영역 안 텍스트만 선택**(posAtCoords).
- 🐛 버블메뉴 **굵게/기울임/밑줄 무동작** 수정 ✅(사용자 확인 완료): `instanceof TextSelection` 가드가 마우스 선택 객체에 false → 토글 미실행. 파일 내 다른 곳과 동일한 덕타이핑(`'node' in selection`)으로 교체(`isTextSelectionActive`).
- ❌ **카드 3D 틸트는 사용자 요청으로 제거됨**(TiltCard 삭제).
- 🐛 조회수 P2025 → `updateMany`로 수정(에디터 미저장 초안 미리보기 시 나던 로그 스팸 제거).

## ⬜ 남은 애니메이션 (전부 큰 작업 — 하나씩 + 사용자 테스트 권장)
- **#9 커서/스크롤바 커스텀** — ✅ 코드 구현 완료(빌드/재시작 후 테스트 대기). tsc --noEmit GREEN.
  - 신규 `CustomScrollbar.tsx`(언마운트 시 클래스 제거로 전역 누수 방지) + globals.css `html.custom-scrollbar` 스타일(라이트/다크 공통 중성 그레이 썸).
  - `sites/[site]/page.tsx`: `custom_cursor !== false`(기본 ON) → `<CustomCursor/>`, `custom_scrollbar === true`(기본 OFF) → `<CustomScrollbar/>` 조건부 렌더. sns_settings에서 읽음.
  - SettingsForm 2곳(dashboard/비dashboard): "인터랙션 효과" 섹션 + iOS형 토글 2개(setSnsValue로 명시적 boolean 저장). 기존 sns_settings JSON 라운드트립으로 자동 저장됨.
  - 범위: 크리에이터 포트폴리오 페이지 한정(랜딩/explore의 커서는 플랫폼 전역이라 그대로 둠).
- **#6 마퀴** — ✅ 코드 구현 완료(빌드/재시작 후 테스트 대기). tsc --noEmit GREEN.
  - 신규 `MarqueeBlock.tsx`(에디터 미리보기 ↔ 발행 결과 공용 — 드리프트 방지). `InfiniteMarquee.tsx`에 `maskFade`(배경색 무관 마스크 페이드) + 인스턴스별 useId 스코프(여러 마퀴 속도 충돌 방지) 추가, 랜딩페이지 기존 사용은 그대로(하위호환).
  - `RichTextEditor.tsx`: `Marquee` Tiptap 노드(atom block) + `MarqueeNodeView`(createPortal 설정 모달 — FaqBlock 패턴). 속성: items(JSON)/speed/reverse/textSize/isBold/fontFamily/textColor/variant(plain·pill). extensions 등록 + 삽입 플로팅메뉴 "마퀴" 버튼 + 커맨드 타입 선언.
  - `HTMLRenderer.tsx`: `data-type="marquee"` → `<MarqueeBlock>` 렌더 분기 + sanitize 허용목록에 data-items/speed/reverse/variant 추가.
  - 설정 모달 백드롭 클릭 시 닫힘 제거(미저장 편집 유실 방지, FaqBlock과 동일).
- **#7 모달 전환** — ✅ 코드 구현 완료(빌드/재시작 후 테스트 대기). tsc --noEmit GREEN.
  - 문제: @modal 병렬 라우트는 닫을 때 `router.back()`으로 슬롯이 즉시 언마운트 → enter(`animate-in`)만 있고 exit가 없어 그냥 사라짐.
  - `ProjectModal.tsx`: 닫기 요청을 가로채 `isClosing` → `animate-out fade-out (+card: zoom-out·slide-out-to-bottom) fill-mode-forwards` 재생 후 EXIT_MS(220ms) 뒤 네비게이션. `isClosingRef`로 재진입 방지, `handleCloseRef`로 Escape stale-closure 방지, 모션 최소화 사용자는 지연 없이 즉시 닫음.
  - 백드롭 fade-out이 그룹 opacity로 닫기버튼/제목/카드까지 함께 페이드. enter는 기존 유지.
- **#17 라이브러리 정리** — 🔎 조사 완료(코드 미변경). **결론: 셋은 중복이 아니라 서로 다른 레이어.**
  - Lenis = 스무스스크롤 엔진(셋업은 `SmoothScroll.tsx` 단일, 나머지는 useLenis stop/start·data-lenis-prevent). GSAP = 스크롤연동·시네마틱 명령형(BusinessCardContact·MainLandingClient 최다, ScrollTrigger/ScrollToPlugin/quickTo). framer = 선언형 컴포넌트 UI(17곳, MotionConfig 전역 reduced-motion 포함).
  - GSAP ScrollTrigger ↔ Lenis는 `gsap.ticker`로 **결합**(중복 아님). GSAP ↔ framer는 도메인 분리(통합=재작성).
  - ✅ 안전 정리 후보: **`@gsap/react` 의존성 제거**(소스 미사용, useGSAP 0건 — package.json/lock에만 잔존) + 파일별 미사용 import 정리.
  - ❌ 비권장: 라이브러리 통째 제거/통합(고위험·런타임 검증 불가). → 별도 시간에 제품 결정 필요.
  - 🅿️ **사용자 결정(방치)**: 지금은 #17 전체 보류 — `@gsap/react` 제거도 하지 않음. 위 조사 결과만 참고용으로 남김.

## 💾 자동 백업 + 미디어/고아 관리 (신규 — `scripts/README-backup.md` 참고)
- 라이브 DB는 `<repo>/dev.db`(=`process.cwd()/dev.db`, libSQL 로컬파일). `prisma/dev.db`는 빈 placeholder.
- **작업 스케줄러 2개**: ①**"BlockCanvas DB Backup"** 매일 00/08/16시(8h) — DB 백업+미디어 미러 ②**"BlockCanvas Uploads Cleanup"** 매일 04:00 — 고아 정리.
- **DB 백업**: `VACUUM INTO`(일관 스냅샷, 동시사용 안전) → Node 내장 **Brotli q11** → `backups/db/dev-*.db.br`. 외부도구 0. ~10x(192KB→19.2KB). 보존 **90개(30일)**. 복원 `node scripts/restore-db.mjs` → `dev.restored.db`(라이브 미덮어씀). 라운드트립 검증 완료.
- **미디어**: 이미지/파일은 DB 아니라 `public/uploads/`에 저장(DB엔 경로 문자열만). 8h 백업 시 `robocopy /MIR`로 `backups/uploads`에 미러(라이브 현재상태 반영=삭제도 반영, 압축X). ⚠️ 같은 디스크라 디스크고장 대비 아님.
- **고아 정리(중요)**: `public/uploads`가 263개/1.56GB였는데 **211개(1.33GB)가 미참조 고아**(삭제된 게시글/영상/테스트). 1회 정리로 **183개/1.19GB 삭제**(28개는 24h 보호). 현재 80개/375MB. 이후 매일 04:00 자동 스윕(24h 초안 보호, `clean-orphan-uploads.mjs --apply`).
- 도구: `audit-uploads.mjs`(감사, --list), `clean-orphan-uploads.mjs`(정리, --apply/--min-age-hours). `backups/` gitignore. env: `BC_BACKUP_DIR/RETENTION/BROTLI_QUALITY/DB_PATH`.

## 🐛 섹션 그룹화 버그 수정 (신규)
- **수정#2 (핵심)**: `PublishSettingsModal.tsx` — section_id hidden 필드를 `sectionId`(URL) 있을 때만 렌더 → **수정(/editor?project_id=…)** 시 sectionId 없어서 저장하면 section_id가 null로 풀림 = 게시글이 섹션에서 이탈("모두 한 곳으로"). `sectionId || initialProject?.section_id`로 폴백해 수정 시 섹션 보존. (생성은 SectionContainer가 `?section_id=`로 정상 전달 — 원래 OK)
- **수정#1**: 관련글 푸터가 category 우선이라 "이 섹션의 다른 게시물"이 섹션별로 안 묶임. **section 우선**(같은 섹션만, 미배정 글만 category 폴백)으로 변경. 3곳 동일: `project/[id]/page.tsx`, `@modal/(.)project/[id]/page.tsx`, `projectClientActions.ts`.
- ⚠️ 기존에 이미 풀려버린(미배정) 게시글은 자동 복구 안 됨 → 드래그앤드롭으로 섹션에 다시 넣어야 함. tsc GREEN. 빌드/재시작 후 적용.
- **수정#3**: `DraggablePortfolio.tsx` 게시글 섹션 간 드래그 이동 버그. 증상: ①섹션 빈영역에 드롭하면 이동 미저장(overProject undefined로 저장블록 스킵), ②중간에 다른 종류 섹션(영상슬라이더/타임라인)을 가로질러 먼 섹션으로 옮기면 실시간 리플로우로 드래그 불가/게시글 사라짐.
  - **해법(드롭-온리 전환)**: `handleDragOver`를 **no-op**으로(드래그 중 실시간 섹션이동·리플로우 제거 → 여러 섹션 가로질러도 안정적). 같은 섹션 내 미리보기는 SortableContext 자동 처리.
  - `handleDragEnd`가 단일 책임: 드롭 대상(over)에서 목표 섹션 도출 → **다른 섹션 이동은 게시글 표시 섹션(image_grid·video_slider)만 허용**(타임라인/텍스트엔 드롭 불가, 같은 섹션 내 순서변경은 종류 무관) → 섹션순 그룹화 재구성 → setProjects + updateProjectOrderAction 저장. 상태객체 복제(직접변형 제거). tsc GREEN.

## 📖 도움말 가이드 리뉴얼 (신규 — 기능과 불일치 수정)
- 에디터 ❓도움말(EditorCanvas `GUIDE_ACCORDIONS`): 텍스트효과 설명 갱신(존재하지 않던 "펄서"→실제 12종), 버튼 설명 갱신(삽입 경로 + 6가지 스타일), **마퀴(흐르는 텍스트) 항목 신규 추가**(id 9, 자체 style 마퀴 미리보기). 1GB 동영상 한도 표기는 실제와 일치 확인.
- 섹션 정렬 가이드(`DraggablePortfolio` 안내박스): 섹션 순서 + **게시글 섹션 간 이동(드롭-온리, image_grid·video_slider만)** 규칙 반영. 렌더 안 되던 리터럴 `**마크다운**`을 `<strong>`으로 교체.
- `OnboardingCarousel.tsx`는 **미사용 데드코드**(어디서도 import 안 됨) — 별도 정리 권장.
- 가이드 애니메이션 자연스럽게: 이징 `ease-in-out`→`cubic-bezier(0.65,0,0.35,1)`(22곳), 블록정렬 커서 텔레포트 수정(제자리 페이드인→grab 누름→드래그), block-a/b 스왑을 커서 타이밍과 동기화. 드로어에 사용법 인트로 한 줄 추가. **"11. 발행 & 공개 설정" 가이드 항목 신규**(자체 style 토글/버튼 미리보기). tsc GREEN. (애니 미세조정은 라이브 확인하며 반복 권장)

## ✨ 신규 기능: 이미지 자동 최적화 (완료)
- `sharp`(0.34.5, Next 기본 external 목록에 있어 config 불필요) 추가. `npm i`는 **`--legacy-peer-deps`** 필수(lenis가 react-dom18 peer 요구, 프로젝트는 react19).
- `lib/image-optimize.ts`: 업로드 이미지를 긴 변 **2048px 리사이즈 + WebP(q82)** 변환. gif(애니)·svg·영상/오디오·애니프레임·변환후 더 큰 경우·에러 시 원본 보존(throw 안 함). `toWebpName`으로 확장자 교체.
- 적용 경로 2곳: `actions/upload.ts`, `api/upload/route.ts`(아바타/배너 포함 모든 업로드가 이 둘을 거침). 실측: 4K PNG 16MB→456KB(**~36x 절감**). tsc GREEN.
- ⚠️ **기존** 업로드 파일은 미적용(신규만). 원하면 기존 참조 이미지(52개/235MB) 일괄 변환 가능하나 DB URL(.png→.webp) 갱신 필요해 별도 위험작업.

## ✨ 발행 시 잉여 이미지 즉시 정리 (완료)
- 문제: 에디터에서 이미지를 올리면 즉시 디스크 저장되는데 본문에서 빼면 고아로 잔존(매일 스윕이 24h 뒤 정리하긴 함).
- 해법(세션 추적): `lib/upload-tracker.ts`(클라 모듈 싱글톤)가 이번 세션 `/api/upload` URL 수집. 업로드 4곳 훅(EditorCanvas×2, RichTextEditor, PublishSettingsModal 커버). PublishSettingsModal이 `session_uploads` hidden 필드로 전송 + 제출 시 clear.
- 서버 `publish.ts`: 저장 후 session_uploads 중 **최종 본문(widgets/썸네일/설명)에 없는 것만** `lib/file-delete.ts`의 신규 `deleteUploadUrls`(경로격리)로 삭제. 세션 업로드는 방금 생성된 고유 파일이라 타 프로젝트 참조 불가 → 안전. 이미지 최적화와 동일 .webp URL 사용해 호환. tsc GREEN.
- 한계: **기존(이전 세션) 이미지를 수정 중 제거**한 경우는 즉시 아니라 매일 스윕이 처리(세션 추적 대상 아님).

## ✨ 아바타/배너 교체 시 잉여 파일 정리 (완료)
- 아바타/배너 크롭은 최종 1장만 업로드(크로퍼는 클라 가공만, 추가 업로드 없음) → 유일한 고아 원천은 **교체/제거 시 이전 파일 미삭제**.
- `actions/avatar.ts`·`actions/banner.ts`: 교체 전 기존 URL 조회 → 업데이트 후 이전 URL이 다르면 `deleteUploadUrls`로 삭제(경로격리·기본이미지 보호). 배너 "제거"(null)도 커버. 고유 파일이라 안전. tsc GREEN.

## ✨ 신규 기능: 방문자 통계 대시보드 (완료)
- 대시보드 홈(`dashboard/page.tsx`, 라벨이 이미 "오버뷰(통계)")을 **실제 조회수 기반** 통계로 리뉴얼.
- 기존 `DashboardViewsChart`는 **가짜 랜덤 주간 데이터**였음 → 삭제. (조회 시각 기록이 없어 진짜 시계열 추이는 불가 — 라이브 DB 스키마 변경 위험 회피 위해 미구현, 안내문 표기)
- 신규 `DashboardStatsCharts.tsx`(recharts 가로막대 `TopWorksChart`). 페이지: 오버뷰 카드 4(총작품/공개/누적조회/평균) + **인기작품 Top10 차트** + **조회수 순위 리스트(썸네일·링크)** + **섹션별 조회수 바** + 포트폴리오 상태. 모두 `Project.view_count` 실데이터. tsc GREEN.
- 사용자 요청으로 **간소화**: 막대차트(`DashboardStatsCharts` 삭제)·섹션별·포트폴리오 카드 제거. **주간 추이 AreaChart(`DashboardViewsChart`)를 메인**으로 두되 높이 축소(h-72→h-56), 컨테이너 max-w-3xl. 상단 간단 수치 4 + 그래프 + **차분한 텍스트 순위(Top5, 뱃지·썸네일 제거)**. 주간 그래프는 여전히 누적 조회수의 요일별 추정 분포(실데이터 아님) — 안내문 유지. 진짜 일자별 추이는 `ProjectView` 로그 테이블 필요(입회 하에 진행 권장).

## 🐛 ScrollSpyNav(섹션 점 내비) 중복 렌더 수정
- `sites/[site]/page.tsx`(line 318, 전체 sections)와 `DraggablePortfolio`(visibleSections, 노출 섹션만) **둘 다** ScrollSpyNav를 렌더 → 둘 다 `fixed right-4 top-1/2`라 겹침. 숨김 섹션이 있으면 두 목록 개수가 달라 점이 어긋나 두 줄로 보이는 버그(방문자 시야). 소유자는 두 목록 동일이라 정확히 포개져 잘 안 보였음.
- 조치: page.tsx의 중복 ScrollSpyNav + 미사용 import 제거. 가시성 반영하는 DraggablePortfolio쪽만 유지. tsc GREEN.

## 🐛 에디터 2건 수정
- **버튼 width/height 입력칸 복구**: `RichTextEditor` ButtonLinkNodeView — editButtonWidth/Height state·handleSave·렌더(styleObj width/height px)·renderHTML(data-button-width/height)·HTMLRenderer 적용은 다 있는데 **입력 UI만 빠져있었음**. 설정 팝업에 "버튼 크기(px) 너비/높이" number 입력 행 추가(빈값=자동).
- **텍스트 블록 인라인 이미지 라이트박스**: `HTMLRenderer`를 'use client'로 + Lightbox 상태 추가. 본문 `<img>` 클릭 시 라이트박스로 크게 보기(`cursor-zoom-in`), 같은 본문 이미지들끼리 좌우 이동. 링크로 감싼 img는 제외. 이미지 그리드(ProjectDetailsViewer Lightbox)와 동일 경험. tsc GREEN.

## 🐛 게시글 공개/비공개 기능 추가 (섹션은 이미 정상)
- **핵심 버그**: `sites/[site]/page.tsx` 프로젝트 쿼리가 `is_published` 필터 없이 전체를 넘겨 **비공개 글이 방문자에게도 노출**. + 크리에이터에게 **게시물 단위 공개/비공개 토글 자체가 없었음**(전체 포트폴리오 토글·관리자용만 존재).
- 조치:
  - `actions/projects.ts` 신규 `toggleProjectPublishAction`(소유권 검증 + CreatorLog).
  - `ProjectActionButtons`: 카드 호버 메뉴에 공개/비공개 토글(Eye/EyeOff, `isPublished` prop) 추가.
  - `ProjectCard`: 소유자에게 비공개 글 **"비공개" 배지 + 흐리게(opacity-55)** 표시. 방문자에겐 안 보임.
  - `page.tsx`: 방문자(`!isOwner`)에겐 `is_published:true`만 조회. 소유자는 전체(관리용).
  - 상세페이지·explore·관련글은 이미 비공개 차단/필터 되어 있어 일관됨.
- **섹션은 이미 정상**: SectionContainer 헤더 Globe/Lock 토글 + 대시보드 Eye/EyeOff + `visibleSections` 방문자 필터 + 소유자 dimming 모두 작동.
- **2차(중요): explore·직접URL 누출 차단**. 1차는 포트폴리오 그리드만 막았고 ①explore에 **숨긴 섹션의 발행글**이 노출, ②상세페이지(full+modal)가 `is_published`·섹션 체크를 **전혀 안 해서 직접 URL로 비공개/숨김글 열람** 가능했음. 공개 정의 = `is_published && 섹션 숨김 아님`:
  - `explore/page.tsx`: 작품피드·크리에이터 콜라주 쿼리에 `AND[{youtube}, {OR section_id null | section.is_visible true}]` 추가.
  - `project/[id]/page.tsx` + `@modal/(.)project/[id]/page.tsx`: getProject에 `section{is_visible}` 포함 + cookies/verifySession으로 isOwner 판정 → 비소유자는 `isPubliclyViewable` 아니면 notFound(메타데이터도 `{}`로 미리보기 차단). 관련글 쿼리도 `section.is_visible: true` 추가.
  - 점검 완료: sitemap=서브도메인만(작품URL 없음), 랜딩=크리에이터만, `getProjectDetailsAction`=미사용 데드코드. tsc GREEN.
- **공개/비공개 토글 위치 3곳**: ①포트폴리오 카드 호버(ProjectActionButtons) ②대시보드 게시물관리 행(SortableProjectRow, 항상보임+"비공개"뱃지) ③에디터 발행모달 footer 토글(처음부터 비공개 발행). publish.ts가 `is_published` 폼값 읽어 create·update 모두 반영(기본 공개, 'false'만 비공개).

## 🧱 메인 랜딩 블록 빌드 인트로 (신규)
- `components/ui/BlockBuildIntro.tsx`: 복셀 블록(5×4, 일부 인디고 accent)이 위에서 rotateX 플립+back ease로 조립 → "BLOCKCANVAS" 워드마크+로딩바 → 페이드 아웃. GSAP 타임라인(~1.8s).
- **첫방문/재방문 분기**(요청): `sessionStorage('bc_intro_seen')`. 첫 방문만 풀 시퀀스, 재방문은 0.25s 페이드, 모션최소화는 즉시 제거. 첫 페인트부터 덮어 콘텐츠 깜빡임 방지(SSR active=true). 스크롤 잠금 후 복원.
- 자체완결형 오버레이(z-100000)라 기존 히어로 인트로/ScrollTrigger 미변경. `MainLandingClient` 최상단에 `<BlockBuildIntro/>` 추가. tsc GREEN. (애니 느낌은 라이브 확인하며 반복 권장)

## 알려진 노이즈/이슈
- `middleware.ts`의 `[Middleware] Host:` console.log → 운영 노이즈(pre-existing, 사용자 파일).
- 운영 DB가 로컬 SQLite → 동시성 시 간헐적 `SQLITE_BUSY` 가능.
