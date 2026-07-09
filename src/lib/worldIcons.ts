// 월드 목록 아이콘 프리셋. 관리자가 마인크래프트 블록 이미지를 public/world-icons/<key>.png 로
// 등록하면 사용자가 월드 생성 시 그중에서 선택한다(업로드 아님). 키만 DB(MinecraftWorld.icon)에 저장.
export interface WorldIcon {
  key: string;
  label: string;
  src: string;
}

export const WORLD_ICONS: WorldIcon[] = [
  { key: "grass", label: "잔디", src: "/world-icons/Grass_Block.png" },
  { key: "dirt", label: "흙", src: "/world-icons/Dirt.png" },
  { key: "stone", label: "돌", src: "/world-icons/Stone.png" },
  { key: "deepslate", label: "심층암", src: "/world-icons/Deepslate.png" },
  { key: "oak", label: "참나무", src: "/world-icons/Oak_Log.png" },
  { key: "oak_leaves", label: "참나무 잎", src: "/world-icons/Oak_Leaves.png" },
  { key: "bricks", label: "벽돌", src: "/world-icons/Bricks.png" },
  { key: "glass", label: "유리", src: "/world-icons/Glass.png" },
  { key: "blue_ice", label: "푸른 얼음", src: "/world-icons/Blue_Ice.png" },
  { key: "gold", label: "금", src: "/world-icons/Gold_Block.png" },
  { key: "iron", label: "철", src: "/world-icons/Iron_Block.png" },
  { key: "diamond", label: "다이아", src: "/world-icons/Diamond_Block.png" },
  { key: "emerald", label: "에메랄드", src: "/world-icons/Emerald_Block.png" },
  { key: "redstone", label: "레드스톤", src: "/world-icons/Redstone_Block.png" },
  { key: "netherite", label: "네더라이트", src: "/world-icons/Netherite_Block.png" },
  { key: "tnt", label: "TNT", src: "/world-icons/Tnt.png" },
];

export const WORLD_ICON_KEYS = WORLD_ICONS.map((i) => i.key);

/** 아이콘 키 → 이미지 경로. 없으면 null(컴포넌트에서 기본 아이콘 폴백). */
export function worldIconSrc(key: string | null | undefined): string | null {
  if (!key) return null;
  const found = WORLD_ICONS.find((i) => i.key === key);
  return found ? found.src : null;
}
