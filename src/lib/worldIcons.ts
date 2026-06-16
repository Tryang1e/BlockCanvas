// 월드 목록 아이콘 프리셋. 관리자가 마인크래프트 블록 이미지를 public/world-icons/<key>.png 로
// 등록하면 사용자가 월드 생성 시 그중에서 선택한다(업로드 아님). 키만 DB(MinecraftWorld.icon)에 저장.
export interface WorldIcon {
  key: string;
  label: string;
  src: string;
}

export const WORLD_ICONS: WorldIcon[] = [
  { key: "grass", label: "잔디", src: "/world-icons/grass.png" },
  { key: "stone", label: "돌", src: "/world-icons/stone.png" },
  { key: "oak", label: "참나무", src: "/world-icons/oak.png" },
  { key: "bricks", label: "벽돌", src: "/world-icons/bricks.png" },
  { key: "sand", label: "사막", src: "/world-icons/sand.png" },
  { key: "water", label: "바다", src: "/world-icons/water.png" },
  { key: "diamond", label: "다이아", src: "/world-icons/diamond.png" },
  { key: "netherrack", label: "네더", src: "/world-icons/netherrack.png" },
];

export const WORLD_ICON_KEYS = WORLD_ICONS.map((i) => i.key);

/** 아이콘 키 → 이미지 경로. 없으면 null(컴포넌트에서 기본 아이콘 폴백). */
export function worldIconSrc(key: string | null | undefined): string | null {
  if (!key) return null;
  const found = WORLD_ICONS.find((i) => i.key === key);
  return found ? found.src : null;
}
