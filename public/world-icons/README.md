# 월드 아이콘 (프리셋)

월드 생성 시 사용자가 **고르는** 마인크래프트 블록 아이콘들입니다.
목록/키/파일경로(src)는 `src/lib/worldIcons.ts` 에서 명시적으로 관리합니다.
파일을 추가하면 거기에 항목(key·label·src)을 추가해야 선택지에 노출됩니다.

권장: 정사각형 PNG (픽셀 아트라 `image-rendering: pixelated` 적용됨).

| 파일 | 키 | 라벨 |
|---|---|---|
| Grass_Block.png | grass | 잔디 |
| Dirt.png | dirt | 흙 |
| Stone.png | stone | 돌 |
| Deepslate.png | deepslate | 심층암 |
| Oak_Log.png | oak | 참나무 |
| Oak_Leaves.png | oak_leaves | 참나무 잎 |
| Bricks.png | bricks | 벽돌 |
| Glass.png | glass | 유리 |
| Blue_Ice.png | blue_ice | 푸른 얼음 |
| Gold_Block.png | gold | 금 |
| Iron_Block.png | iron | 철 |
| Diamond_Block.png | diamond | 다이아 |
| Emerald_Block.png | emerald | 에메랄드 |
| Redstone_Block.png | redstone | 레드스톤 |
| Netherite_Block.png | netherite | 네더라이트 |
| Tnt.png | tnt | TNT |

이미지가 없으면 컴포넌트가 기본 아이콘(블록 모양)으로 폴백합니다.
