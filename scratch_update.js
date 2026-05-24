const fs = require('fs');
const content = `\n- **외부 네트워크(HTTP) 접속 시 로그인 해제 문제 수정:**\n  - \`NODE_ENV=production\` 환경에서 기본적으로 \`secure: true\`가 적용되어 HTTP(예: 로컬 네트워크 IP 접속) 환경에서 세션 쿠키가 저장되지 않는 문제를 해결.\n  - \`process.env.SECURE_COOKIE === 'true'\`인 경우에만 secure 쿠키를 사용하도록 변경.\n  - 브라우저 종료 시에도 로그인이 유지되도록 쿠키 만료 기한(\`maxAge\`)을 30일로 설정하여 세션 유지 기능 강화.\n`;
fs.appendFileSync('dev_notes.md', content, 'utf8');
