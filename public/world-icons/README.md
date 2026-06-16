# 월드 아이콘 (프리셋)

월드 생성 시 사용자가 **고르는** 마인크래프트 블록 아이콘들입니다.
여기에 아래 파일명으로 이미지를 넣으면 자동으로 선택지에 노출됩니다.
(목록/키는 `src/lib/worldIcons.ts` 에서 관리 — 파일 추가 시 거기에도 항목 추가)

권장: 정사각형 PNG, 64×64 (픽셀 아트라 `image-rendering: pixelated` 적용됨).

| 파일 | 키 | 라벨 |
|---|---|---|
| grass.png | grass | 잔디 |
| stone.png | stone | 돌 |
| oak.png | oak | 참나무 |
| bricks.png | bricks | 벽돌 |
| sand.png | sand | 사막 |
| water.png | water | 바다 |
| diamond.png | diamond | 다이아 |
| netherrack.png | netherrack | 네더 |

이미지가 없으면 컴포넌트가 기본 아이콘(블록 모양)으로 폴백합니다.
