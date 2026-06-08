🔍 BlockCanvas 보안·설계 종합 분석
코드는 일절 수정하지 않았고, 정적 분석만 수행했습니다. 운영 중인 사이트인 만큼 🔴 치명적 항목부터 먼저 봐주세요.

🔴 치명적 (Critical) — 즉시 조치 권장
1. 세션 서명 키가 하드코딩 폴백 + 토큰이 위조 가능
위치: session.ts:4, .env/.env.local (확인 결과 SESSION_SECRET 미정의)
문제:
SESSION_SECRET이 환경변수에 없으면 소스에 박힌 'blockcanvas-fallback-...'를 사용합니다. 런타임에 따로 주입하지 않는 한 서명 키가 공개된 상수입니다.
세션 토큰 구조가 creator_name.HMAC(creator_name) 뿐입니다. 키를 알면 누구나 signSession('admin') 또는 임의 크리에이터 토큰을 만들어 자격증명 없이 관리자/임의 계정으로 로그인할 수 있습니다.
토큰에 만료시각·발급자·버전이 없어서 세션 폐기 불가, 비밀번호 변경해도 기존 세션 유효, 토큰 1개만 유출돼도 영구 사용됩니다.
영향: 인증 시스템 전체 우회 → 전체 계정/관리자 탈취.
권장: (1) 강력한 무작위 SESSION_SECRET을 환경에 주입하고 코드의 폴백 제거(없으면 부팅 실패하도록), (2) 토큰에 profile.id+발급시각+서명 포함 및 만료 적용, (3) 비밀번호/2FA 변경 시 무효화할 수 있는 세션 버전 컬럼 도입.
2. 비밀번호 해시 + 2FA 시크릿이 공개 포트폴리오로 유출
위치: page.tsx:139-146, 493 → BusinessCardContact.tsx:1,27
문제: 공개 포트폴리오 페이지가 select 없이 프로필 전체(password 해시, two_factor_secret, email 포함)를 조회한 뒤, 'use client' 컴포넌트인 BusinessCardContact에 profile 객체 전체를 props로 전달합니다. Next.js App Router에서 클라이언트 컴포넌트 props는 RSC 페이로드로 직렬화되어 브라우저에 전송됩니다 → 방문자가 페이지 소스에서 비밀번호 해시와 2FA 시크릿을 그대로 볼 수 있습니다.
추가로 page.tsx:144-146에서 매 요청마다 비밀번호 포함 프로필 전체를 서버 콘솔에 로깅합니다.
영향: 2FA 시크릿 노출 → 공격자가 직접 유효 OTP 생성(2FA 무력화). 해시 노출 → 오프라인 크래킹.
권장: 클라이언트로 넘기기 전에 필요한 필드만 추린 DTO를 만들어 전달. DB 조회 시 select로 민감 필드 제외. 디버그 console.log 제거.
3. 인증 없는 서버 액션 getProfileForPreviewAction — 동일한 민감정보 노출
위치: profile.ts:274-283
문제: 'use server' 액션이 creatorName만 받아 비밀번호/2FA 시크릿 포함 전체 프로필을 반환합니다. 권한 검사가 전혀 없어 임의 크리에이터 대상 호출 가능.
권장: select로 공개 필드만 반환하거나, 호출자 본인 확인 추가.
4. SSRF — /api/metadata가 임의 URL을 서버에서 fetch
위치: route.ts:4-58
문제: 인증 없이 ?url= 파라미터를 받아 호스트/IP 검증 없이 fetch하고 결과(title/description/image)를 반환합니다. http://127.0.0.1, http://169.254.169.254/...(클라우드 메타데이터), 내부망 주소를 찔러 내부 서비스 스캔·정보 탈취가 가능합니다.
권장: 프로토콜 https 제한, 사설/링크로컬 IP 차단(DNS 리졸브 후 검증), 호스트 allowlist, 리다이렉트 횟수 제한, 응답 크기 제한.
5. 디버그 엔드포인트가 헤더·쿠키 전체를 노출
위치: route.ts:9-16
문제: 인증 없이 요청 헤더 전체와 **모든 쿠키(세션 토큰 포함)**를 JSON으로 반환합니다. 운영 환경에 남아 있을 이유가 없는 진단용 엔드포인트입니다.
권장: 운영에서 제거(또는 관리자 전용 + 민감값 마스킹).
🟠 높음 (High)
6. 권한 검사 없는 IDOR — 아바타/배너 변조 (사이트 디페이스)
위치: avatar.ts:6-21, banner.ts:6-22
문제: creatorName + 임의 URL만 받아 인증·소유권 확인 없이 해당 크리에이터의 avatar_url/banner_url을 갱신합니다. 누구나 임의 크리에이터의 아바타·배너를 외부 URL로 바꿀 수 있습니다(URL 검증도 없음).
권장: 다른 액션들처럼 requireAuth(creatorName) 적용 + 내부 업로드 경로만 허용.
7. 문의함 IDOR — 비공개 메시지 열람/조작
위치: contact.ts — getContactMessages(79), markMessageAsRead(100), markReplyAsRead(413)
문제: getContactMessages(creator_name)이 인증 없이 해당 크리에이터의 **모든 문의(이름·이메일·메시지 본문)**를 반환합니다. 읽음 처리 액션들도 ID만 알면 누구나 호출 가능.
권장: 세션 소유자/관리자 확인 추가. (참고로 deleteContactMessage·replyToContactMessage는 권한 검사가 잘 되어 있습니다.)
8. 인증 없는 파일 업로드 + 1GB 본문 한도 → 디스크 고갈 DoS
위치: upload.ts:7, api/upload/route.ts:6, next.config.ts:15,31
문제: 업로드 경로 두 곳 모두 인증 검사가 없고, 서버 액션 본문 한도가 1GB입니다. 익명 사용자가 대용량 파일을 반복 업로드해 디스크를 채울 수 있습니다. 레이트리밋도 없습니다.
권장: 업로드에 requireAuth 적용, 본문 한도 현실화(이미지/영상 분리), 사용자별 용량 쿼터·레이트리밋.
9. 경로 탐색을 통한 임의 파일 삭제
위치: file-delete.ts:69-77, 92
문제: scanForUploadUrls의 정규식 \/uploads\/[a-zA-Z0-9.\-_/]+이 .과 /를 허용해 /uploads/../../dev.db 같은 문자열을 매칭합니다. 이 값이 path.join(cwd,'public', ...)로 합쳐져 fs.unlink됩니다. 크리에이터가 자기 프로젝트 콘텐츠에 이런 경로를 심은 뒤 계정 삭제(또는 관리자가 그 계정 삭제) 시 — path.join이 정규화하여 — dev.db(운영 DB) 등 임의 파일을 삭제할 수 있습니다.
권장: 삭제 전 path.resolve 후 업로드 디렉터리 하위인지 startsWith로 검증, 정규식에서 .. 차단.
10. 로그인 무차별 대입 방어 부재 + 약한 2FA 검증창
위치: auth.ts:31-77, totp.ts:33-37, auth.ts:406
문제:
로그인·2FA 검증에 레이트리밋/계정 잠금이 없습니다 → 비밀번호·OTP 무차별 대입 가능.
verifyTotpToken의 epochTolerance: 300(±5분)은 동시에 유효한 OTP 창을 ~20개로 넓혀 6자리 OTP 추측 확률을 크게 높입니다.
isDev && code === '000000' 마스터 코드(auth.ts:406)는 NODE_ENV가 production이 아니면 2FA를 무조건 통과시키는 백도어입니다. 운영 환경변수 설정에 의존하므로 위험합니다.
권장: IP/계정별 시도 제한·점증 지연, epochTolerance를 30~60초로 축소, 마스터 코드 제거.
11. 운영 환경에서 모든 SQL 쿼리 로깅(민감정보 포함)
위치: prisma.ts:16 — log: ['query']
문제: 운영에서도 모든 쿼리(매개변수 값 포함 — 이메일, 해시 비교 대상 등)가 로그에 남습니다. 성능 저하 + 로그에 민감정보 축적.
권장: 개발에서만 쿼리 로깅, 운영은 ['error','warn'].
12. Cloudflare 터널 자격증명이 git에 커밋됨
위치: CloudflaredTunnel/.cloudflared/*.json, config.yml (git에 추적 중)
문제: 터널 인증 JSON(시크릿 포함)과 설정이 저장소에 있습니다. 저장소 접근자/유출 시 터널 탈취 위험. cloudflared.exe 바이너리도 추적되어 잦은 diff 발생.
권장: 자격증명 회수·재발급, git 추적 제거 후 .gitignore 등록, 히스토리 정리 검토.
🟡 중간 (Medium)
#	항목	위치	요지
13	iframe 허용 XSS/임베드	HTMLRenderer.tsx:146, ProjectDetailsViewer.tsx:231,241, EditorCanvas.tsx:586	DOMPurify에 ADD_TAGS:['iframe']만 주고 src allowlist/sandbox가 없어 크리에이터가 임의 iframe(피싱/클릭재킹)을 방문자에게 노출 가능
14	uploads 서빙 경로 탐색 미차단	route.ts:17-22	path.join(cwd,'public','uploads',...path)에 상위 디렉터리 봉쇄 검사 없음(인코딩 우회 여지). image/svg+xml 서빙도 주의
15	회원가입 액션 우회 가능	auth.ts:79, login/page.tsx:48	UI에선 "준비중"으로 비활성화했지만 signup 서버 액션은 직접 호출 가능 → 원치 않는 계정 생성
16	대리 로그인(impersonate) 설계	admin.ts:282, api/admin/impersonate/route.ts	구현이 중복(서버 액션+API 라우트), API 버전은 쿠키 domain 누락(서브도메인 공유 깨짐). 관리자 세션을 대상 사용자로 덮어써 원복 경로가 없음, 이후 대상 계정으로 한 행동이 관리자에게 귀속 추적 안 됨
17	CSP 부재	next.config.ts:33-61	기본 보안 헤더는 양호하나 Content-Security-Policy가 없어 iframe/인라인 스크립트 위험에 대한 심층 방어 부족. X-XSS-Protection은 레거시
18	비공개 프로젝트 콘텐츠 노출	projectClientActions.ts:7, editor/page.tsx:42-54	fetchProjectDetails는 is_published/소유권 무관하게 ID로 조회 가능, 에디터도 project 로드 시 소유권 미확인(드래프트 열람 가능). UUID라 난이도는 높음
19	문의함 가득참 악용	contact.ts:48-58	미읽음 50개 한도를, 공격자가 서로 다른 이메일로 채워 크리에이터의 문의 수신을 차단할 수 있음. 입력 길이·이메일 형식 검증 없음
20	조회수 조작	project.ts:5	incrementProjectViewCount에 중복/레이트 제한 없어 무한 증가 가능(경미)
🔵 설계·기능 개선 (낮음 / 운영 관점)
운영 DB가 로컬 SQLite 파일 (prisma.ts:5-7): 동시 쓰기 경합, 수평 확장 불가, 백업/복구 전략 부재. 위 #9 경로탐색과 결합 시 단일 파일 손실 위험. → 트래픽이 늘면 Postgres/Turso(libSQL 원격) 등으로 이전 검토.
비밀번호 재설정 셀프서비스 부재: 사용자가 비밀번호를 잊으면 관리자가 수동 초기화(auth.ts:224)해야 함. 이메일 인증/재설정 플로우 없음, 이메일 검증 자체가 없음(email에 @unique도 없음 — 중복 이메일 가능, schema.prisma:16).
관리자 비밀번호 초기화/2FA 리셋 후 알림·세션 무효화 없음: 피해 계정이 인지 못 함(#1의 세션 무효화 부재와 연결).
하드코딩된 도메인/서브도메인: craftopia.work와 특정 크리에이터(sian17, tryangle, owlhouse)가 next.config.ts:21-24, 도메인이 middleware.ts:15·여러 액션에 상수로 박혀 있음 → 환경변수화 권장.
저장소 정리: temp_animate_ui/, temp_output.html, MyIdea.md, Community_Architect_Analysis.md, logo/Thumbs.db, prisma/dev.db(미추적이나 존재) 등 산재. 빌드/보안 표면과 무관한 자료는 정리.
로깅 잡음: middleware.ts:36 등 다수 console.log가 운영에서 호스트/경로/세션 관련 정보를 남김.
입력 검증 일반화: 대부분 액션이 길이/형식 검증 없이 문자열을 저장(헤드라인, about, 문의 등) — 저장형 데이터 크기 폭증 방지 및 일관된 sanitize 정책 필요.
✅ 잘 되어 있는 점 (균형 평가)
콘텐츠 액션 대부분(projects/publish/section/wip/portfolio/profile)이 requireAuth + creator_id 스코프로 IDOR를 일관되게 방지합니다. (projects.ts, section.ts, wip.ts)
비밀번호 해싱이 PBKDF2(10만회)+bcrypt 이중 적용 (hash.ts), 세션 검증에 timingSafeEqual 사용.
업로드에 매직바이트 기반 MIME 스니핑으로 확장자 스푸핑 방어 (upload-validator.ts), 파일명도 정규화.
쿠키 플래그(httpOnly, sameSite:lax, 운영 secure)와 기본 보안 헤더(HSTS, X-Frame-Options DENY, nosniff) 적용.
공개 렌더링 경로는 대체로 DOMPurify를 거치고, 문의 폼에 다층 레이트리밋이 있음.
권장 조치 우선순위
#1 SESSION_SECRET 주입 + 폴백 제거 (가장 시급 — 인증 전체가 걸려 있음)
#2, #3 프로필 민감필드 클라이언트 유출 차단 (select DTO화)
#4 metadata SSRF 차단 / #5 debug-proxy 제거
#6 아바타·배너 / #7 문의함 권한 검사 추가
#9 파일삭제 경로 봉쇄, #8 업로드 인증·한도, #11 쿼리 로깅 끄기, #12 터널 자격증명 회수
원하시면 이 중 특정 항목 하나를 골라 정확한 수정 방안(어디를 어떻게 바꾸는지)을 코드 패치 형태로 제안드릴 수 있습니다. 다만 운영 사이트이므로 말씀하신 대로 지금은 어떤 파일도 수정하지 않았습니다. 어떤 것부터 깊게 볼지 알려주세요. 개인적으로는 #1(세션 키) → #2/#3(민감정보 유출) 순서를 강력히 권합니다.