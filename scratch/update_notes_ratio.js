const fs = require('fs');
const path = 'c:/Github/BlockCanvas/dev_notes.md';

try {
  let content = fs.readFileSync(path, 'utf8');

  if (content.includes('## [2026-05-23] 모든 프로젝트 카드 이미지 16:9 고정')) {
    console.log('dev_notes.md is already up to date!');
    process.exit(0);
  }

  const newLog = `## [2026-05-23] 모든 프로젝트 카드 이미지 16:9 비율(aspect-video) 엄격 박제 및 세로 저널 레이아웃 대개조
- **크리에이터 썸네일 비율 왜곡 방지 패치**:
  - **요구사항**: 카드 크기가 세로로 아무리 길어지거나 가변화되더라도, 그 안에 들어간 실제 썸네일 이미지 및 동영상 렌더링 영역은 언제나 명격 정비율인 **16:9 (aspect-video)**를 철저히 고수할 것.
  - **대조적 레이아웃 설계 및 구현**:
    1) **미디어 영역의 16:9 엄격 고정**: \`ProjectCard.tsx\` 내부의 이미지/동영상 래퍼 컨테이너에 \`w-full aspect-video shrink-0\` 를 강제 지정하여, 카드가 세로로 길어져도 이미지가 위아래로 길어지거나 찢어지지 않고 칼같이 16:9 비율로 상단에 박제되도록 차단.
    2) **하이브리드 프리미엄 저널 정보 영역 결합**:
       - **1x1 격자 카드**: 16:9 이미지 영역이 카드 크기를 100% 가득 채우며 기존의 심플하고 깔끔한 이미지 카드 형태 유지.
       - **1x2 / 1x3 세로 카드**: 윗부분은 16:9 왜곡 없는 썸네일 이미지가 온전히 렌더링되고, 아랫부분의 남는 넉넉한 셰이프 공간에는 고품격 잡지/저널 스타일의 흰색(다크모드 블랙) 패널이 노출되며 **작품 제목(Title), 크리에이터 카테고리 태그(CREATOR WORK PIECE), 등록 연월일(Date), 작품 탐색 링크(VIEW WORK)**가 명품 폰트와 구분선으로 고급스럽게 상시 노출되도록 디자인 대개조.
- **결과**: 창작물 원형의 16:9 시각적 감상을 100% 보존함과 동시에, 세로 레이아웃 활용 시 전율을 주는 럭셔리 포트폴리오 카드 갤러리를 연출할 수 있도록 비주얼을 하이엔드로 도약 완료.
`;

  const targetHeader = '# 개발 노트 (dev_notes)';
  const insertIndex = content.indexOf(targetHeader);
  
  if (insertIndex !== -1) {
    const splitPos = insertIndex + targetHeader.length;
    const updated = content.substring(0, splitPos) + '\n\n' + newLog.trim() + '\n' + content.substring(splitPos);
    fs.writeFileSync(path, updated, 'utf8');
    console.log('Successfully completed dev_notes.md updates for 16:9 aspect ratio fix!');
  }
} catch (e) {
  console.error('Error writing dev_notes.md:', e);
}
