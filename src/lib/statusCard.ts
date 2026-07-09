import sharp from "sharp";
import { ensureCardFonts, FONT_MC } from "./cardFonts";

// 인게임 상태창 카드(웹 목업)를 플레이어 실제 데이터로 렌더 → 4타일(각 256x192, 마크 폰트 256 한계).
// DeluxeMenus 타이틀이 :card_tl::offset_-1::card_tr::offset_-177::card_bl::offset_-1::card_br: 로 재조립.
// 512x408 디자인 → 512x384 리사이즈 → 256x192 타일(정수폭 88px=seam 없음, GUI 176 꽉참).
//
// ── 디자인: 마인크래프트 상자 GUI 룩(ItemsAdder/DeluxeMenus 와 어우러지도록) ──
//   · 픽셀 폰트(영문/숫자 Minecraft + 한글 NeoDunggeunmo), 그림자/볼드 없이 원본 그대로  · 사각 모서리(둥근 모서리 없음)
//   · 패널/버튼 = 돌출 베벨(밝은 좌상 + 어두운 우하)  · 스탯/용량 = 함몰 인벤토리 슬롯
//   · 용량바 = 마크식 초록 게이지  · 아바타 = 사각 플레이어 머리(슬롯 프레임)
//   ※ 좌표(x/y/w/h)는 기존과 동일 — 인게임 아이템 정렬/DeluxeMenus offset 재튜닝 불필요.

export interface StatusCardData {
  name: string; // 마인크래프트 IGN (헤더 "{name} 님의 상태창")
  role: string; // user | pro | creator | admin
  plotCount: number; // 영토
  worldCount: number; // 내 월드(활성)
  worldInvited: number; // 초대됨
  quotaUsed: string; // "158 MB"
  quotaTotal: string; // "5 GB" | "무제한"
  quotaUnlimited: boolean;
  quotaPct: number; // 0~100 (무제한이면 0)
}

// ── 마인크래프트 상자 GUI 팔레트 ──
const C = {
  panel: "#c6c6c6", // 패널 바탕(상자 GUI 회색)
  panelLite: "#ffffff", // 돌출 베벨 — 좌/상 하이라이트
  panelDark: "#545454", // 돌출 베벨 — 우/하 그림자
  outline: "#000000", // 외곽선
  slot: "#8b8b8b", // 함몰 슬롯 바탕
  slotDark: "#373737", // 함몰 베벨 — 좌/상(움푹)
  slotLite: "#ffffff", // 함몰 베벨 — 우/하
  ink: "#262626", // 어두운 라벨(밝은 패널 위 — 타이틀). 진하게 = 대비↑
  inkSub: "#3c3c3c", // 보조 라벨(밝은 패널 위 — 부제). 진하게
  txtLite: "#ffffff", // 밝은 텍스트(어두운 슬롯 위)
  bar: "#5fdc3a", // 용량바 초록
  barLite: "#a6f581", // 용량바 하이라이트
  barDark: "#3a8b22", // 용량바 그림자
  barTrough: "#5a5a5a", // 용량바 트로프(빈 칸)
};

function esc(s: string): string {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// 돌출(raised) 베벨 패널 — 바닐라 GUI 룩. 검은 외곽선 없이 좌/상 밝고(panelLite) 우/하 어둡다(panelDark).
//   (바닐라 상자 패널엔 순흑 테두리가 없다 — 베벨만으로 입체감.)
function raised(x: number, y: number, w: number, h: number, base: string, b: number): string {
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${C.panelDark}"/>
  <rect x="${x}" y="${y}" width="${w - b}" height="${h - b}" fill="${C.panelLite}"/>
  <rect x="${x + b}" y="${y + b}" width="${w - 2 * b}" height="${h - 2 * b}" fill="${base}"/>`;
}

// 함몰(inset) 슬롯 — 인벤토리 칸처럼 움푹. 좌/상 어둡고 우/하 밝다.
function slot(x: number, y: number, w: number, h: number, base: string, b: number): string {
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${C.slotLite}"/>
  <rect x="${x}" y="${y}" width="${w - b}" height="${h - b}" fill="${C.slotDark}"/>
  <rect x="${x + b}" y="${y + b}" width="${w - 2 * b}" height="${h - 2 * b}" fill="${base}"/>`;
}

// 텍스트 — 그림자/볼드 없이 픽셀폰트 그대로(영문/숫자=Minecraft, 한글=NeoDunggeunmo).
//   (픽셀폰트는 합성 볼드/stroke 를 주면 픽셀이 뭉개져서 오히려 가독성이 떨어진다 — 원본 그대로 렌더.)
function txt(x: number, y: number, size: number, fill: string, text: string, anchor = "start"): string {
  return `<text x="${x}" y="${y}" font-family="${FONT_MC}" font-size="${size}" fill="${fill}" text-anchor="${anchor}">${text}</text>`;
}

// 역할 → 칩 색/라벨. admin/manager=관리자(보라)·official=공식(초록)·creator=크리에이터(파랑)·기타=일반(회색).
function rolePill(role: string): { bg: string; label: string } {
  switch (role) {
    case "admin":
    case "manager": return { bg: "#9b4dff", label: "관리자" };
    case "official": return { bg: "#2fae46", label: "공식" };
    case "creator": return { bg: "#3b82f6", label: "크리에이터" };
    default: return { bg: "#7d7d7d", label: "일반" };
  }
}

// 역할 칩 — 돌출 베벨 + 색 바탕 + 밝은 글자(그림자). 우상단(y=26, h=32).
function pill(label: string, bg: string): string {
  const pillW = label.length * 18 + 26;
  const pillX = 486 - pillW;
  return `${raised(pillX, 24, pillW, 32, bg, 3)}
  ${txt(pillX + pillW / 2, 47, 18, C.txtLite, esc(label), "middle")}`;
}

// 패널 좌우 여백 — 카드 가로 구조를 아래 바닐라 인벤토리 기준 4:8:679:8:4(screen, 합 703=카드 전체폭)에 맞춤.
//   환산: 디자인 512 = 카드폭 703 screen → 1 design ≈ 1.373 screen (= 703/512).
//   · 바깥 투명여백  4 screen ≈ 3 design  → PANEL_ML = PANEL_MR = 3 (대칭)
//   · 베벨          8 screen ≈ 6 design  → raised() b=6 이 담당(≈8.2 screen)
//   · 가운데 면     679 screen ≈ 494 design = 512 − 3 − 6 − 6 − 3
//   ※ 내용물(아바타·스탯·버튼)은 고정, 패널 배경만 안쪽으로 → 버튼-아이템 정렬 유지.
//   비율 바꾸려면: 원하는 screen ÷ 1.373 = design.
const PANEL_ML = 3;
const PANEL_MR = 3;

// 공통 헤더(외곽 카드 + 아바타 슬롯 프레임 + 헤더 텍스트). 얼굴은 렌더 단계에서 합성.
function header(name: string, p: { bg: string; label: string }): string {
  return `${raised(PANEL_ML, 0, 512 - PANEL_ML - PANEL_MR, 408, C.panel, 6)}
  ${slot(20, 14, 76, 76, C.slot, 4)}
  ${txt(102, 50, 22, C.ink, esc(name) + " 님의 상태창")}
  ${txt(102, 76, 18, C.inkSub, "건축 클라우드 계정")}
  ${pill(p.label, p.bg)}`;
}

// 스탯 슬롯(영토/내 월드/초대됨) — 함몰 슬롯 + 라벨 + 큰 숫자. 라벨/숫자를 칸(98~180) 세로 중앙에 맞춤.
function statBox(x: number, label: string, value: number | string): string {
  return `${slot(x, 98, 150, 82, C.slot, 4)}
  ${txt(x + 16, 125, 18, C.txtLite, esc(String(label)))}
  ${txt(x + 16, 165, 33, C.txtLite, esc(String(value)))}`;
}

export function buildCardSvg(d: StatusCardData): string {
  const p = rolePill(d.role); // 역할 칩(관리자/공식/크리에이터/일반). 미연동은 buildUnlinkedCardSvg.
  const quota = d.quotaUnlimited
    ? `${txt(42, 216, 18, C.txtLite, "클라우드 용량")}
       ${txt(42, 240, 16, "#dcdcdc", esc(d.quotaUsed) + " 사용 중")}
       ${txt(470, 230, 22, "#a6f581", "무제한", "end")}`
    : (() => {
        const pct = Math.min(100, Math.max(0, d.quotaPct));
        const fullW = 424; // 트로프 내부 폭
        const fillW = Math.max(6, Math.round((fullW * pct) / 100));
        return `${txt(42, 220, 18, C.txtLite, "클라우드 용량")}
       ${txt(470, 220, 18, C.txtLite, esc(d.quotaUsed) + " / " + esc(d.quotaTotal), "end")}
       ${slot(42, 230, 428, 16, C.barTrough, 2)}
       <rect x="44" y="232" width="${fillW}" height="12" fill="${C.barDark}"/>
       <rect x="44" y="232" width="${fillW}" height="6" fill="${C.bar}"/>
       <rect x="44" y="232" width="${fillW}" height="3" fill="${C.barLite}"/>`;
      })();

  // 버튼 x = 슬롯 그리드 정렬: DeluxeMenus 아이템 슬롯 37/39/41/43(col 1·3·5·7) 아이콘 중심
  // (GUI x 35/71/107/143)에 박스 중심을 맞춤. design center = iconGUI ÷ (176/512). 카드 좌단=패널 x=0 기준.
  const btns = [
    { x: 54, label: "월드 입장" },
    { x: 159, label: "영토 홈" },
    { x: 263, label: "웹 대시보드" },
    { x: 368, label: "탐방" },
  ]
    .map(
      (bn) => `${slot(bn.x, 258, 96, 98, C.slot, 4)}
    ${txt(bn.x + 48, 344, 16, C.txtLite, bn.label, "middle")}`
    )
    .join("\n  ");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="408">${header(d.name, p)}
  ${statBox(26, "영토", d.plotCount)}
  ${statBox(183, "내 월드", d.worldCount)}
  ${statBox(340, "초대됨", d.worldInvited)}
  ${slot(26, 192, 460, 54, C.slot, 4)}
  ${quota}
  ${btns}
</svg>`;
}

// 미연동 카드 — 웹 계정을 연동하지 않은 플레이어용.
export function buildUnlinkedCardSvg(name: string): string {
  const p = { bg: "#e0a020", label: "미연동" };
  return `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="408">${header(name, p)}
  ${slot(26, 110, 460, 130, C.slot, 4)}
  ${txt(256, 156, 26, C.txtLite, "웹 계정 연동이 필요합니다", "middle")}
  ${txt(256, 192, 17, "#e8e8e8", "인게임 /웹연동 또는 auth.craftopia.work 에서", "middle")}
  ${txt(256, 216, 17, "#e8e8e8", "마인크래프트 계정을 연동하면 상태창이 표시됩니다.", "middle")}
  ${raised(146, 278, 220, 60, "#e0a020", 4)}
  ${txt(256, 316, 24, C.txtLite, "/웹연동", "middle")}
</svg>`;
}

export interface CardTiles {
  card_tl: Buffer;
  card_tr: Buffer;
  card_bl: Buffer;
  card_br: Buffer;
}

// SVG(512x408) → 얼굴 합성(있으면, 아바타 슬롯 내부 26,20,64 사각) → 512x384 리사이즈 → 256x192 4타일(no-resize extract).
async function svgToTiles(svg: string, faceBuf?: Buffer | null): Promise<CardTiles> {
  ensureCardFonts();
  let cardBuf = await sharp(Buffer.from(svg)).png().toBuffer();
  if (faceBuf) {
    // 사각 플레이어 머리(마크 스킨 얼굴) — 둥근 마스크 없이 슬롯 프레임 안쪽(26,20)에 그대로 얹는다.
    const face = await sharp(faceBuf).resize(64, 64, { kernel: "nearest" }).png().toBuffer();
    cardBuf = await sharp(cardBuf).composite([{ input: face, left: 26, top: 20 }]).png().toBuffer();
  }
  const resized = await sharp(cardBuf).resize(512, 384).png().toBuffer();
  const ex = (left: number, top: number) =>
    sharp(resized).extract({ left, top, width: 256, height: 192 }).png().toBuffer();
  const [card_tl, card_tr, card_bl, card_br] = await Promise.all([ex(0, 0), ex(256, 0), ex(0, 192), ex(256, 192)]);
  return { card_tl, card_tr, card_bl, card_br };
}

export function renderCardTiles(d: StatusCardData, faceBuf?: Buffer | null): Promise<CardTiles> {
  return svgToTiles(buildCardSvg(d), faceBuf);
}

export function renderUnlinkedTiles(name: string): Promise<CardTiles> {
  return svgToTiles(buildUnlinkedCardSvg(name), null);
}
