const fs = require('fs');
const path = 'c:/Github/BlockCanvas/dev_notes.md';

try {
  let content = fs.readFileSync(path, 'utf8');

  // 중복 기록 방지
  if (content.includes('## [2026-05-23] 툴바 return 중복')) {
    console.log('dev_notes.md is already updated!');
    process.exit(0);
  }

  const newLog = `## [2026-05-23] 툴바 컴포넌트 return 구문 중복 오타 핫픽스
- **빌드 오류 조치**:
  - **증상**: \`ThemeColorEditor.tsx\` 툴바 시인성 개편 도중 \`return (\` 코드가 중복 병렬 삽입되어 \`Expression expected\` Syntax Error로 인해 Next.js 빌드가 깨지는 빌드 에러가 즉시 검출됨.
  - **조치**: 중복 구문을 지우고 한 줄의 온전한 \`return (\`으로 정리하여 빌드 에러를 즉각 진압하고, \`npx tsc --noEmit\` 무결성 검증을 완벽하게 통과시켜 정상 복구 완료.
`;

  const targetHeader = '# 개발 노트 (dev_notes)';
  const insertIndex = content.indexOf(targetHeader);
  
  if (insertIndex !== -1) {
    const splitPos = insertIndex + targetHeader.length;
    const updated = content.substring(0, splitPos) + '\n\n' + newLog.trim() + '\n' + content.substring(splitPos);
    fs.writeFileSync(path, updated, 'utf8');
    console.log('Successfully written return fix to dev_notes.md!');
  }
} catch (e) {
  console.error('Error writing dev_notes.md:', e);
}
