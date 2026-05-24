const fs = require('fs');
const path = 'c:/Github/BlockCanvas/dev_notes.md';

try {
  let content = fs.readFileSync(path, 'utf8');

  // 중복 삽입 방지를 위한 내용 정리
  if (content.includes('## [2026-05-23] 포트폴리오 커스텀 툴바')) {
    console.log('dev_notes.md is already up to date!');
    process.exit(0);
  }

  const newLog = `## [2026-05-23] 포트폴리오 커스텀 설정 툴바 시인성(가독성) 대폭 개선 패치
- **시인성 취약점 개선 및 프리미엄 비주얼화**:
  - **기존 문제**: 포트폴리오 커스텀 툴바(\`ThemeColorEditor.tsx\`)와 배경 효과 셀렉터(\`ThemeEffectEditor.tsx\`)의 대비가 낮고 글꼴 및 아이콘 크기가 극단적으로 미니멀(text-[9px], size=10)하여 복잡한 배너 스크린샷 위에서 텍스트가 극심하게 묻히고 조작이 불편했던 애로사항 발생.
  - **비주얼 격상 패치 적용**:
    1) **다크 글래스모피즘 패널화**: 기존의 칙칙한 패널 배경을 \`bg-black/85\`로 투과 다크닝을 강화하고, \`backdrop-blur-2xl\` 초고성능 백드롭 필터로 뒷배경을 우아하게 지워 대비 확보.
    2) **경계 글로우 및 시인성 선명화**: 테두리를 \`border-2 border-white/20 hover:border-white/30\` 로 화사하게 보강하고 패딩을 넉넉히 주어 툴바의 볼륨감 확보.
    3) **구분선 및 글꼴/아이콘 스케일 업**: 흐리멍텅한 구분선을 화사한 \`bg-white/20\` 명도로 교체하고, 아이콘 크기를 \`size=13\`으로, 텍스트 크기를 \`text-[11px]\` 에 최고 굵기인 \`font-black(font-extrabold)\`로 통일 확장하여 멀리서도 툴바의 라운드 코너 조작 텍스트가 직관적으로 확인되도록 완치 완료.
`;

  const targetHeader = '# 개발 노트 (dev_notes)';
  const insertIndex = content.indexOf(targetHeader);
  
  if (insertIndex !== -1) {
    const splitPos = insertIndex + targetHeader.length;
    const updated = content.substring(0, splitPos) + '\n\n' + newLog.trim() + '\n' + content.substring(splitPos);
    fs.writeFileSync(path, updated, 'utf8');
    console.log('Successfully completed dev_notes.md updates for Customizer Toolbar!');
  } else {
    fs.writeFileSync(path, '# 개발 노트 (dev_notes)\n\n' + newLog.trim() + '\n\n' + content, 'utf8');
    console.log('Successfully created dev_notes.md for Customizer Toolbar!');
  }
} catch (e) {
  console.error('Error writing dev_notes.md:', e);
}
