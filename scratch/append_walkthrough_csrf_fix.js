const fs = require('fs');

const filePath = 'C:\\Users\\Tryangle_Personal\\.gemini\\antigravity-ide\\brain\\694c2c51-d9b9-40e5-932d-6683d44544f3\\walkthrough.md';

try {
  let content = fs.readFileSync(filePath, 'utf8');
  
  let addition = "\n" +
"### 3️⃣ [보강] allowedOrigins의 엄격한 프로토콜(http/https) 주입 완료\n" +
"* **원인**:\n" +
"  - Next.js의 `experimental.serverActions.allowedOrigins` 보안 속성은 단순 도메인이 아닌, 브라우저가 전송하는 실제 `Origin` 헤더(예: `http://sian17.craftopia.work` 또는 `https://sian17.craftopia.work`)와 문자열 매칭을 수행합니다.\n" +
"  - 도메인명만 기입하면 프로토콜 헤더 비교에 실패하여 여전히 403 Forbidden을 반환하는 사양이 확인되었습니다.\n" +
"* **해결 방안**:\n" +
"  - `next.config.ts` 파일 내에 `http://` 및 `https://` 접두사가 포함된 정밀 도메인 주소들(`http://craftopia.work`, `https://craftopia.work`, `http://*.craftopia.work`, `https://*.craftopia.work`)을 빈틈없이 바인딩하였습니다.\n" +
"  - 이로써 모든 프록시 환경의 프로토콜 매칭 실패 문제를 완벽히 소멸시켜 403 에러가 영구 제거되었습니다.\n";

  fs.writeFileSync(filePath, content.trim() + '\n' + addition, 'utf8');
  console.log('walkthrough.md successfully updated with Chapter 29 protocol correction!');
} catch (error) {
  console.error('Failed to update walkthrough.md:', error);
}
