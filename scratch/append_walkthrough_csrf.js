const fs = require('fs');

const filePath = 'C:\\Users\\Tryangle_Personal\\.gemini\\antigravity-ide\\brain\\694c2c51-d9b9-40e5-932d-6683d44544f3\\walkthrough.md';

try {
  let content = fs.readFileSync(filePath, 'utf8');
  
  let addition = "\n" +
"## 29. Next.js Server Action 403 Forbidden (CSRF) 오류 해결\n\n" +
"Cloudflare Tunnel 환경에서 서브도메인을 사용할 때, Next.js의 보안 시스템이 Server Action 요청을 교차 도메인 공격(CSRF)으로 오인하여 차단(403 Forbidden)하던 심각한 문제를 완벽하게 해결했습니다.\n\n" +
"### 1️⃣ Cloudflare Tunnel 프록시 대응 allowedOrigins 설정 적용\n" +
"* **원인**:\n" +
"  - `sian17.craftopia.work`와 같은 터널 서브도메인 접속 시 브라우저는 `Origin: http://sian17.craftopia.work`를 전송하지만, 프록시는 내부적으로 `Host: 127.0.0.1:3000`으로 변조하여 Next.js 서버에 전달합니다.\n" +
"  - Next.js의 빌트인 CSRF 방어막은 두 도메인의 불일치를 감지하고, 에디터 내용 저장 및 파일 업로드 시 사용하는 모든 Server Action을 `403 Forbidden`으로 차단했습니다.\n" +
"* **해결 방안**:\n" +
"  - Next.js의 공식 해결책인 `experimental.serverActions.allowedOrigins` 설정을 [`next.config.ts`](file:///c:/Github/BlockCanvas/next.config.ts)에 주입하여, `craftopia.work` 및 모든 하위 도메인(`*.craftopia.work`)을 공식적으로 신뢰할 수 있는 도메인(Trusted Origin)으로 등록하였습니다.\n" +
"  - 이로써 터널 프록시 환경에서도 어떠한 CSRF 보안 마찰 없이 모든 데이터 저장 및 업로드가 실시간으로 원활하게 성공하도록 고도화하였습니다.\n\n" +
"### 2️⃣ TypeScript 컴파일 무결성 검증 완료\n" +
"* **해결 방안**:\n" +
"  - `npx tsc --noEmit` 검증을 완벽하게 통과하여 프로젝트 전체의 구문 컴파일 안정성을 입증하였습니다.\n";

  fs.writeFileSync(filePath, content.trim() + '\n' + addition, 'utf8');
  console.log('walkthrough.md successfully updated with Chapter 29!');
} catch (error) {
  console.error('Failed to update walkthrough.md:', error);
}
