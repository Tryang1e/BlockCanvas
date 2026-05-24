const fs = require('fs');
const path = 'c:/Github/BlockCanvas/dev_notes.md';

try {
  let content = fs.readFileSync(path, 'utf8');

  // 중복 삽입 방지를 위한 내용 정리
  const searchKey = '## [2026-05-23] 프로젝트 모달 오픈';
  const cleanIndex = content.indexOf(searchKey);
  if (cleanIndex !== -1) {
    // 기존에 넣었던 미완성 치료 로그를 도려내고 완전한 최종 통합 치료 명세서로 교체
    content = content.substring(0, cleanIndex) + content.substring(cleanIndex).replace(/## \[2026-05-23\] 프로젝트 모달 오픈[\s\S]*?완료\./, '');
  }

  const newLog = `## [2026-05-23] 프로젝트 모달 오픈 및 닫기(X, 바깥 배경 클릭) 시 스크롤 최상단 강제 점프 완벽 해결
- **Scroll Restoration (0) 강제 도약의 근본적 해결 완비**:
  - **상세 원인**: Next.js의 Intercepted Routes(병렬 라우터 \`@modal\`)와 부드러운 스크롤 라이브러리 \`Lenis\` 간의 연쇄 충돌 현상.
    - 1) **오픈 시**: 카드를 누르면 URL이 \`/project/[id]\`로 라우팅되는데, 이때 \`SmoothScroll.tsx\`가 \`pathname\` 변경을 감지하고 스크롤을 0으로 강제 초기화하여 튕겨 올라가는 버그 발생.
    - 2) **닫기 시 (X 버튼, 바깥쪽배경 클릭)**: 모달이 닫히며 원래의 메인 주소인 \`/creator/[name]\`으로 URL이 롤백되는데, 이때 주소창에서 \`/project/\`가 소멸되므로 \`SmoothScroll\`이 완전히 새로운 별개의 페이지 내비게이션으로 인식해 또다시 스크롤을 0으로 세차게 튕겨 올리는 연속 버그 유발.
  - **통합 해결 패치**: \`SmoothScroll.tsx\` 내부에 \`prevPathnameRef\`(직전 경로 참조 레퍼런스)를 이식.
    - **현재 주소에 \`/project/\`가 포함되어 있는 경우 (오픈하는 순간)** 뿐만 아니라,
    - **직전 주소에 \`/project/\`가 포함되어 있었던 경우 (모달을 닫고 복귀하는 순간)**까지 포함하는 **모달 온/오프 상태 전환 가드 조건식(\`isProjectModalTransition\`)**을 수립하여 스크롤 리셋을 영구 스킵(Skip)하도록 치료 완료.
    - 결과적으로 모달을 열고, X 버튼을 누르고, 바깥 어두운 배경을 클릭해 닫는 모든 과정 속에서 사용자가 보고 있던 원래 스크롤 포지션이 단 1픽셀도 흔들리지 않고 견고하게 박제 유지됨.
`;

  const targetHeader = '# 개발 노트 (dev_notes)';
  const insertIndex = content.indexOf(targetHeader);
  
  if (insertIndex !== -1) {
    const splitPos = insertIndex + targetHeader.length;
    const updated = content.substring(0, splitPos) + '\n\n' + newLog.trim() + '\n' + content.substring(splitPos);
    fs.writeFileSync(path, updated, 'utf8');
    console.log('Successfully completed dev_notes.md updates!');
  } else {
    fs.writeFileSync(path, '# 개발 노트 (dev_notes)\n\n' + newLog.trim() + '\n\n' + content, 'utf8');
    console.log('Successfully created dev_notes.md!');
  }
} catch (e) {
  console.error('Error writing dev_notes.md:', e);
}
