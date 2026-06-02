const fs = require('fs');

const filePath = 'C:\\Users\\Tryangle_Personal\\.gemini\\antigravity-ide\\brain\\694c2c51-d9b9-40e5-932d-6683d44544f3\\walkthrough.md';

try {
  let content = fs.readFileSync(filePath, 'utf8');
  
  let addition = "\n" +
"## 30. 이미지 업로드 크기 한계선 대대적 개방 (15MB -> 50MB) 및 상세 오류 리포팅\n\n" +
"크리에이터들이 초고화질/무손실 셰이더 스크린샷이나 4K 그래픽 이미지 등의 고용량 미디어를 마찰 없이 올릴 수 있도록 업로드 한계 용량을 대폭 늘리고 사용자 오류 피드백 환경을 완전히 개편하였습니다.\n\n" +
"### 1️⃣ 이미지 크기 한계 용량 상향 조정\n" +
"* **원인**:\n" +
"  - 기존 이미지 업로드 크기 한계선이 15MB로 보수적으로 지정되어 있어, 4K 무손실 스크린샷이나 셰이더를 장착한 Minecraft 고화질 전경 사진 등이 용량 초과로 업로드 실패하는 결함이 발생했습니다.\n" +
"* **해결 방안**:\n" +
"  - [`src/lib/upload-validator.ts`](file:///c:/Github/BlockCanvas/src/lib/upload-validator.ts) 내 이미지 크기 제한 필터를 **50MB**(`50 * 1024 * 1024` 바이트)로 대폭 상향하여 대형 그래픽 미디어도 막힘없이 업로드되도록 개선했습니다.\n\n" +
"### 2️⃣ 에디터 및 버튼 이미지 업로드 정밀 오류 리포팅 탑재\n" +
"* **원인**:\n" +
"  - 이전에는 업로드가 실패했을 경우(용량 초과, 비허용 확장자 등) 사용자에게 무조건 `이미지 업로드에 실패했습니다`라는 모호한 경고창만 띄워주어, 정작 무슨 문제 때문에 업로드가 거부되었는지 파악하기 어려웠습니다.\n" +
"* **해결 방안**:\n" +
"  - [`RichTextEditor.tsx`](file:///c:/Github/BlockCanvas/src/components/editor/RichTextEditor.tsx), [`EditorCanvas.tsx`](file:///c:/Github/BlockCanvas/src/components/editor/EditorCanvas.tsx), [`BannerUploadButton.tsx`](file:///c:/Github/BlockCanvas/src/components/creator/BannerUploadButton.tsx), [`AvatarUploadButton.tsx`](file:///c:/Github/BlockCanvas/src/components/creator/AvatarUploadButton.tsx)의 파일 업로드 catch 블록을 수정하여, 고정 알림창 대신 서버 액션이 리턴한 실제 정밀 원인 메시지(`error.message` 또는 `err.message`)를 동적으로 노출해 주도록 교정하였습니다.\n" +
"  - 이로 인해 용량이 초과하면 `이미지 파일은 최대 50MB까지 업로드 가능합니다.`라는 친화적인 전용 안내 문구가 제공됩니다.\n\n" +
"### 3️⃣ TypeScript 컴파일 무결성 검증 완료\n" +
"* **해결 방안**:\n" +
"  - `npx tsc --noEmit` 검증을 완벽하게 통과하여 프로젝트 전체의 구문 컴파일 안정성을 입증하였습니다.\n";

  fs.writeFileSync(filePath, content.trim() + '\n' + addition, 'utf8');
  console.log('walkthrough.md successfully updated with Chapter 30!');
} catch (error) {
  console.error('Failed to update walkthrough.md:', error);
}
