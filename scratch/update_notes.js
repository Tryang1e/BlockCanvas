const fs = require('fs');
const path = 'c:/Github/BlockCanvas/dev_notes.md';

try {
  let content = fs.readFileSync(path, 'utf8');
  
  // 첫 줄 타이틀 중복/깨짐이 있을 경우 이를 깔끔하게 복구
  if (content.startsWith('# 개발 노트 (dev_n')) {
    const firstNewLine = content.indexOf('\n');
    if (firstNewLine !== -1) {
      content = '# 개발 노트 (dev_notes)' + content.substring(firstNewLine);
    }
  }

  const newLog = `## [2026-05-23] 게시글(프로젝트) 클릭 시 페이지 최상단 점프 스크롤 버그 패치
- **Scroll Jump 원인 규명 및 영구 격리**:
  - **원인**: 프로젝트 모달(\`ProjectModal.tsx\`)이 켜질 때 부모 body의 overflow를 강제 hidden으로 변경하면서 브라우저 레이아웃 리플로우 및 Lenis 스크롤 충돌로 인해 브라우저의 물리 스크롤 탑 포지션이 0으로 리셋되는 도약 현상 발견.
  - **패치**: \`ProjectModal.tsx\` 내 마운트 시의 \`document.body.style.overflow = 'hidden'\` 설정을 완벽하게 제거. 모달 컴포넌트 자체가 이미 전체화면 고정(\`fixed inset-0\`)이고 \`data-lenis-prevent\` 및 \`overflow-y-auto\`가 적용되어 있어, 부모의 스크롤바 리플로우 충돌을 일으키지 않고도 모달 내부만의 부드러운 스크롤 동작이 100% 무결하게 성립되도록 해결 완료.
`;

  // '# 개발 노트 (dev_notes)' 바로 아래에 덧붙이기
  const targetHeader = '# 개발 노트 (dev_notes)';
  const insertIndex = content.indexOf(targetHeader);
  
  if (insertIndex !== -1) {
    const splitPos = insertIndex + targetHeader.length;
    const updated = content.substring(0, splitPos) + '\n\n' + newLog.trim() + content.substring(splitPos);
    fs.writeFileSync(path, updated, 'utf8');
    console.log('Successfully inserted latest logs to dev_notes.md!');
  } else {
    // 헤더가 없을 경우 최상단에 추가
    fs.writeFileSync(path, '# 개발 노트 (dev_notes)\n\n' + newLog.trim() + '\n\n' + content, 'utf8');
    console.log('Created header and inserted latest logs to dev_notes.md!');
  }
} catch (e) {
  console.error('Error updating dev_notes.md:', e);
}
