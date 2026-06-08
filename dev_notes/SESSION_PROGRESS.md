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

## 💾 DB 자동 백업 (신규 — `scripts/README-backup.md` 참고)
- 라이브 DB는 `<repo>/dev.db`(=`process.cwd()/dev.db`, libSQL 로컬파일). `prisma/dev.db`는 빈 placeholder.
- Windows 작업 스케줄러 **"BlockCanvas DB Backup"** → 매일 **00/08/16시**(8h 간격) 실행.
- 파이프라인: `VACUUM INTO`(일관 스냅샷, 서버 동시 사용 안전) → Node 내장 **Brotli q11** 압축 → `backups/db/dev-*.db.br`. 외부도구 0. 측정 압축률 ~10x(192KB→19.2KB).
- 보존 **90개(30일×3)**, 초과분 자동 삭제. 용량 ≈ DB×9(현재 ~1.7MB). 이미지/파일은 DB 아님(`public/uploads/`)이라 DB는 텍스트라 압축 잘 됨.
- 복원: `node scripts/restore-db.mjs [latest|파일명]` → `dev.restored.db`로 해제(라이브 미덮어씀). 라운드트립 검증 완료(SQLite 헤더·11테이블·Profile 10행 OK).
- `backups/` gitignore 추가됨. 설정은 env(`BC_BACKUP_DIR/RETENTION/BROTLI_QUALITY/DB_PATH`)로 조정.

## 알려진 노이즈/이슈
- `middleware.ts`의 `[Middleware] Host:` console.log → 운영 노이즈(pre-existing, 사용자 파일).
- 운영 DB가 로컬 SQLite → 동시성 시 간헐적 `SQLITE_BUSY` 가능.
