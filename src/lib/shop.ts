// 상점 카탈로그 — 단일 소스. 현재 판매 품목 없음(칭호 판매 폐지).
//  - 새 품목 추가: 아래 SHOP_ITEMS 배열에 한 줄. 가격은 env(SHOP_<KEY>_PRICE)로 조정 가능.
//  - kind: Purchase.kind 에 기록(소유 식별용, 예: 'nick', 'plot_ticket').
//  - 영구 해금형은 unique[profile,item_key] 로 중복 구매 차단. 소모성/기간제는 추후 별도 설계.

export interface ShopItem {
  key: string;
  label: string; // 상점 표시명
  description: string; // 설명(웹 카드/인게임 lore)
  price: number; // 코인
  kind: string; // Purchase.kind 기록값
}

export function envPrice(key: string, fallback: number): number {
  const raw = process.env[`SHOP_${key.toUpperCase()}_PRICE`];
  if (raw == null || raw === "") return fallback;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

// 일반 카탈로그(영구 해금형, 현재 비어 있음). 예시:
//   { key: "foo", label: "...", description: "...", price: envPrice("foo", 5000), kind: "foo" }
export const SHOP_ITEMS: ShopItem[] = [];

export function findShopItem(key: string): ShopItem | undefined {
  return SHOP_ITEMS.find((i) => i.key === key);
}

// 특별 상품(소모성/누적형 — 일반 카탈로그와 별도 액션으로 처리). 가격은 env 로 조정.
//  - 닉네임 변경권: 구매 즉시 입력한 닉으로 1회 변경(소모성, 재구매로 또 변경). SHOP_NICK_PRICE
//  (플롯 확장권은 2026-06-26 폐지 — 플롯은 사재기 방지로 역할 기본값 고정)
export const NICK_PRICE = envPrice("nick", 10000);
