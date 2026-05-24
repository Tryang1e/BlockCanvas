const fs = require('fs');
const path = 'c:/Github/BlockCanvas/dev_notes.md';

try {
  let content = fs.readFileSync(path, 'utf8');

  // 중복 생성 방지를 위한 클린 가드
  if (content.includes('SmoothScroll.tsx 내의 Lenis')) {
    console.log('dev_notes.md is already up to date!');
    process.exit(0);
  }

  const newLog = `## [2026-05-23] 프로젝트 모달 오픈 시 부모 창 스크롤 0(Top) 리셋 튕김 버그 완전 치료
- **Scroll restoration (0) 강제 도약의 진짜 원인 발견 및 진압**:
  - **진짜 주범**: 포트폴리오 사이트가 Next.js Intercepted Routes(병렬 라우터 \`@modal\`) 구조로 설계되어 있어, 프로젝트 카드를 클릭할 때 브라우저 주소창(Pathname)이 \`/creator/[name]\`에서 \`/creator/[name]/project/[id]\`로 실제 라우팅 변경이 일어납니다.
  - **버그 연쇄 작용**: 이때 전역 부드러운 스크롤 컴포넌트인 \`SmoothScroll.tsx\`가 \`pathname\` 의존성 배열에 반응하여 \`lenis.scrollTo(0, { immediate: true })\`를 사정없이 트리거하여 부모 창 스크롤을 무조건 0으로 튕겨 올리고 있었습니다.
  - **치료 패치 완비**: \`SmoothScroll.tsx\` 내부에 프로젝트 모달 상세 팝업 경로(\`/project/\`)로의 내비게이션 감지 시에는 **최상단 스크롤 복원 동작을 철저히 스킵(Skip)하도록 가드 조건식(\`!pathname.includes('/project/')\`)**을 완벽 수립. 이로써 모달이 켜지더라도 부모 포트폴리오 화면은 사용자가 보고 있던 원래 스크롤 위치에 단 1픽셀의 오차도 없이 견고하게 고정 보존됩니다.
`;

  // '# 개발 노트 (dev_notes)' 바로 아래에 덧붙이기
  const targetHeader = '# 개발 노트 (dev_notes)';
  const insertIndex = content.indexOf(targetHeader);
  
  if (insertIndex !== -1) {
    const splitPos = insertIndex + targetHeader.length;
    const updated = content.substring(0, splitPos) + '\n\n' + newLog.trim() + content.substring(splitPos);
    fs.writeFileSync(path, updated, 'utf8');
    console.log('Successfully updated dev_notes.md with Lenis guard!');
  } else {
    fs.writeFileSync(path, '# 개발 노트 (dev_notes)\n\n' + newLog.trim() + '\n\n' + content, 'utf8');
    console.log('Successfully created dev_notes.md with Lenis guard!');
  }
} catch (e) {
  console.error('Error updating dev_notes.md:', e);
}
