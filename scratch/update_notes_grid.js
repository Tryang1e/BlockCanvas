const fs = require('fs');
const path = 'c:/Github/BlockCanvas/dev_notes.md';

try {
  let content = fs.readFileSync(path, 'utf8');

  if (content.includes('## [2026-05-23] CSS Grid 높이 비례 불일치')) {
    console.log('dev_notes.md is already up to date!');
    process.exit(0);
  }

  const newLog = `## [2026-05-23] CSS Grid 다중 행(row-span) 타일 배치 시 하단 정렬선 틈새 불일치 완벽 해결
- **기하학적 버그 원인 분석**:
  - **버그 현상**: 가로 3열 레이아웃에서 \`1x2\`(세로 2칸) 카드와 옆의 두 개의 \`1x1\` 카드가 만나는 하단 정렬선이 약 24px(\`gap\` 크기) 만큼 어긋나고 붕 떠 있는 현상 검출.
  - **근본 원인**: 이전에는 개별 카드 컴포넌트가 각자 단독 \`aspect-ratio: W / H\` 비례식으로만 높이를 자율 계산하여 렌더링됨. 이 경우, 세로 2칸(\`row-span-2\`) 카드에는 두 \`1x1\` 카드 사이에 물리적으로 들어가는 **그리드 간격(grid-gap)의 높이가 누락**되므로, 딱 맞물리지 못하고 gap 크기만큼 높이가 항상 부족하여 불일치가 발생함.
- **수학적 무결성 솔루션 적용**:
  1) **Grid Auto Rows 반응형 공식 도입**: \`SectionContainer.tsx\`에 뷰포트 너비(\`100vw\`) 및 실시간 여백 변수(\`--grid-gap\`)를 대입한 **미디어 쿼리 기반 반응형 행 높이 수식** 탑재.
     - 데스크탑 최대 폭(1280px 이상)일 때: \`calc((1216px - 2 * gap) / 3 * 9 / 16)\`
     - 데스크탑 일반(1024px~1280px)일 때: \`calc((100vw - 64px - 2 * gap) / 3 * 9 / 16)\`
     - 태블릿(640px~1024px, 2열)일 때: \`calc((100vw - 64px - gap) / 2 * 9 / 16)\`
     - 모바일(640px 미만, 1열)일 때: \`calc((100vw - 32px) * 9 / 16)\`
  2) **카드 높이 피팅 설계 개편**: \`ProjectCard.tsx\`에 \`isGridItem\` 프로프를 탑재하여 그리드 내부에서 동작할 때는 개별 aspect-ratio를 스마트하게 소거하고, 부모 Grid 격자 셀의 완벽한 계산 높이를 \`h-full w-full\` 로 100% 흡수 팽창하게 설계 변경.
- **결과**: 가로/세로 모든 비율의 격자 타일이 gap 크기를 내포한 절대 비례 높이로 매핑되어, 소수점 이하 스케일까지 하단 정렬선이 자로 잰 듯 완벽하게 일치함.
`;

  const targetHeader = '# 개발 노트 (dev_notes)';
  const insertIndex = content.indexOf(targetHeader);
  
  if (insertIndex !== -1) {
    const splitPos = insertIndex + targetHeader.length;
    const updated = content.substring(0, splitPos) + '\n\n' + newLog.trim() + '\n' + content.substring(splitPos);
    fs.writeFileSync(path, updated, 'utf8');
    console.log('Successfully completed dev_notes.md updates for CSS Grid bug fix!');
  }
} catch (e) {
  console.error('Error writing dev_notes.md:', e);
}
