import fs from "fs";
import path from "path";
import sharp from "sharp";
import { ensureCardFonts } from "./cardFonts";

// Discord /내정보 카드 — 사이트(craftopia.work) 디자인 언어로 렌더한 단일 PNG.
// 인게임 상태창 카드(statusCard.ts, 마인크래프트 상자 GUI 룩)와 별개다:
//   · 인게임 카드 = ItemsAdder/DeluxeMenus 리소스팩(타일 4~6장) — 마크 안에서만.
//   · 이 카드    = Discord 첨부용 단일 이미지 — 사이트 룩(크림 캔버스 + 화이트 카드, Uni Sans 헤딩).
// 표시: 플레이어 이름 · 역할 배지 · 영토 수 · 월드 수 · 코인 · 클라우드 사용량 게이지 + MC 플레이어 head.
//
// sharp(librsvg+pango+fontconfig)로 SVG 텍스트를 렌더한다. cardFonts.ts 의 ensureCardFonts() 가
// fonts/ + C:\Windows\Fonts 를 가리키는 fontconfig 를 1회 설정하므로 아래 폰트가 매칭된다:
//   · 디스플레이(이름/큰 숫자) = Uni Sans Heavy(fonts/, 사이트 럭셔리 헤딩) → 폴백 Segoe UI
//   · 본문/한글 라벨          = Segoe UI → 맑은 고딕(한글) → Arial

export interface InfoCardData {
  name: string; // 마인크래프트 IGN
  role: string; // user | creator | official | admin | manager
  plotCount: number; // 영토
  worldCount: number; // 내 월드(활성)
  worldInvited: number; // 초대됨
  quotaUsed: string; // "158 MB"
  quotaTotal: string; // "5 GB" | "무제한"
  quotaUnlimited: boolean;
  quotaPct: number; // 0~100 (무제한이면 0)
  quotaState?: string; // ok | warned | locked
  coins: number | null; // 코인(CMI). 서버 오프라인 등으로 조회 실패 시 null → "—"
}

// ── 캔버스/레이아웃 (px, 1×; 벡터 텍스트라 Discord 축소표시에서도 선명) ──
const W = 960;
const H = 440;
const M = 6; // 바깥 여백(라운드 코너가 잘리지 않도록)
const R = 34; // 카드 라운드
const CL = 50; // 콘텐츠 좌단
const CR = 910; // 콘텐츠 우단
const CW = CR - CL; // 860

// 아바타(플레이어 head)
const AV_X = 50;
const AV_Y = 46;
const AV = 116;
const AV_R = 18;

// ── 사이트 팔레트 ──
const C = {
  cardBg: "#faf9f5", // 시그니처 크림 캔버스
  cardBorder: "#e7e5dc",
  tileBg: "#ffffff", // 화이트 카드(스탯 타일)
  tileBorder: "#ecebe4",
  coinBg: "#fffbeb", // amber-50
  coinBorder: "#f5e6be",
  coinInk: "#b45309", // amber-700
  coinIcon: "#f59e0b", // amber-500
  ink: "#171717", // 본문(near-black)
  muted: "#6b7280", // neutral-500
  faint: "#9ca3af", // neutral-400
  label: "#374151", // neutral-700
  track: "#e5e7eb", // 게이지 트랙
  ok: "#10b981", // emerald-500
  warn: "#f59e0b", // amber-500
  lock: "#ef4444", // rose-500
};

// 폰트 체인(fontconfig 가 family 명으로 매칭 — 앞에서부터 시도, 글리프 단위 폴백).
//   FONT_DISPLAY = 큰 스탯 숫자 전용(브랜드 악센트). fonts/Uni Sans Heavy.otf 의 실제 타이포그래픽
//     family 명은 "Uni Sans"(subfamily "Heavy CAPS") — weight 900 로 Heavy 페이스가 매칭된다.
//     ⚠ 이 폰트는 CAPS 전용(소문자 글리프가 대문자꼴)이라 텍스트(이름)에는 쓰지 않는다 — 숫자만.
//   FONT_BODY = 이름/라벨/한글. 대소문자 보존(Segoe UI = 사이트 Geist 와 유사한 뉴트럴 산세리프).
const FONT_DISPLAY = "'Uni Sans','Segoe UI','Malgun Gothic',sans-serif";
const FONT_BODY = "'Segoe UI','Malgun Gothic','Arial',sans-serif";

function esc(s: string): string {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// 천단위 콤마(로케일/ICU 의존 없이 안전).
function comma(n: number): string {
  return Math.trunc(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

function txt(
  x: number,
  y: number,
  size: number,
  fill: string,
  text: string,
  opts: { font?: string; weight?: number; anchor?: string; spacing?: number } = {},
): string {
  const { font = FONT_BODY, weight = 400, anchor = "start", spacing } = opts;
  const ls = spacing ? ` letter-spacing="${spacing}"` : "";
  return `<text x="${x}" y="${y}" font-family="${font}" font-size="${size}" font-weight="${weight}" fill="${fill}" text-anchor="${anchor}"${ls}>${text}</text>`;
}

// 역할 → 사이트 배지 색/라벨(영문 대문자, explore 배지 규약과 동일).
//   official=블루 · admin/manager=퍼플 · creator/user=뉴트럴.
function roleBadge(role: string): { bg: string; fg: string; border: string; label: string } {
  switch ((role || "").toLowerCase()) {
    case "official":
      return { bg: "#eff6ff", fg: "#2563eb", border: "#bfdbfe", label: "OFFICIAL" };
    case "admin":
    case "manager":
      return { bg: "#faf5ff", fg: "#9333ea", border: "#e9d5ff", label: "ADMIN" };
    case "creator":
      return { bg: "#f9fafb", fg: "#6b7280", border: "#e5e7eb", label: "CREATOR" };
    default:
      return { bg: "#f9fafb", fg: "#6b7280", border: "#e5e7eb", label: "USER" };
  }
}

// ── lucide 풍 라인 아이콘(스트로크만, currentColor 대신 명시 색) ──
function iconWrap(x: number, y: number, color: string, inner: string): string {
  return `<g transform="translate(${x},${y})" fill="none" stroke="${color}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">${inner}</g>`;
}
// 영토: 2×2 필지 그리드
function iconPlots(x: number, y: number, color: string): string {
  return iconWrap(
    x,
    y,
    color,
    `<rect x="0" y="0" width="11" height="11" rx="2.5"/><rect x="15" y="0" width="11" height="11" rx="2.5"/><rect x="0" y="15" width="11" height="11" rx="2.5"/><rect x="15" y="15" width="11" height="11" rx="2.5"/>`,
  );
}
// 월드: 지구본(원 + 세로 타원 + 적도)
function iconWorld(x: number, y: number, color: string): string {
  return iconWrap(
    x,
    y,
    color,
    `<circle cx="13" cy="13" r="13"/><ellipse cx="13" cy="13" rx="6" ry="13"/><line x1="0" y1="13" x2="26" y2="13"/>`,
  );
}
// 코인: 이중 원
function iconCoin(x: number, y: number, color: string): string {
  return iconWrap(
    x,
    y,
    color,
    `<circle cx="13" cy="13" r="13"/><circle cx="13" cy="13" r="6.5" stroke-width="2"/>`,
  );
}

// 스탯 타일(영토/월드/코인). accent 이면 코인용 앰버 룩.
function tile(
  tx: number,
  w: number,
  label: string,
  value: string,
  icon: (x: number, y: number, color: string) => string,
  accent: boolean,
  caption?: string,
): string {
  const bg = accent ? C.coinBg : C.tileBg;
  const border = accent ? C.coinBorder : C.tileBorder;
  const ink = accent ? C.coinInk : C.ink;
  const iconColor = accent ? C.coinIcon : C.muted;
  const labelColor = accent ? C.coinInk : C.muted;
  const cap = caption
    ? txt(tx + w - 24, TILE_Y + 44, 16, C.faint, esc(caption), { anchor: "end", weight: 500 })
    : "";
  // 큰 값(코인 수백만 등)이 타일 폭을 넘지 않도록 자릿수에 따라 축소.
  const len = value.length;
  const numSize = len <= 7 ? 46 : len <= 9 ? 40 : len <= 12 ? 33 : 28;
  return `<rect x="${tx}" y="${TILE_Y}" width="${w}" height="${TILE_H}" rx="20" fill="${bg}" stroke="${border}" stroke-width="1.5"/>
  ${icon(tx + 26, TILE_Y + 26, iconColor)}
  ${txt(tx + 64, TILE_Y + 46, 21, labelColor, esc(label), { weight: 600 })}
  ${cap}
  ${txt(tx + 26, TILE_Y + 100, numSize, ink, esc(value), { font: FONT_DISPLAY, weight: 900 })}`;
}

const TILE_Y = 182;
const TILE_H = 120;

export function buildInfoCardSvg(d: InfoCardData): string {
  const rb = roleBadge(d.role);

  // 헤더 텍스트
  const TX = AV_X + AV + 28; // 194
  const name = esc(d.name || "플레이어");
  // 역할 배지(사이트식 소형 pill, rx=8, 영문 대문자 letter-spacing)
  const badgeText = rb.label;
  const badgeW = badgeText.length * 10.5 + 28;
  const badge = `<rect x="${TX}" y="120" width="${badgeW}" height="30" rx="8" fill="${rb.bg}" stroke="${rb.border}" stroke-width="1.5"/>
  ${txt(TX + badgeW / 2, 141, 15, rb.fg, badgeText, { weight: 800, anchor: "middle", spacing: 1.2 })}
  ${txt(TX + badgeW + 14, 141, 18, C.faint, "건축 클라우드 계정", { weight: 500 })}`;

  // 스탯 타일 3열
  const gap = 20;
  const tw = Math.floor((CW - 2 * gap) / 3); // 273
  const t0 = CL;
  const t1 = CL + tw + gap;
  const t2 = CL + 2 * (tw + gap);
  const tw2 = CR - t2; // 마지막 타일은 우단에 스냅(반올림 흡수)
  const invitedCap = d.worldInvited > 0 ? `+${d.worldInvited} 초대` : undefined;
  const tiles = `${tile(t0, tw, "영토", comma(d.plotCount), iconPlots, false)}
  ${tile(t1, tw, "월드", comma(d.worldCount), iconWorld, false, invitedCap)}
  ${tile(t2, tw2, "코인", d.coins === null ? "—" : comma(d.coins), iconCoin, true)}`;

  // 클라우드 사용량 게이지
  const U_LABEL_Y = 350;
  const BAR_Y = 366;
  const BAR_H = 14;
  let usage: string;
  if (d.quotaUnlimited) {
    usage = `${txt(CL, U_LABEL_Y, 22, C.label, "클라우드 사용량", { weight: 600 })}
    ${txt(CR, U_LABEL_Y, 21, C.ok, esc(d.quotaUsed) + " · 무제한", { anchor: "end", weight: 700 })}
    <rect x="${CL}" y="${BAR_Y}" width="${CW}" height="${BAR_H}" rx="7" fill="${C.track}"/>
    <rect x="${CL}" y="${BAR_Y}" width="${CW}" height="${BAR_H}" rx="7" fill="${C.ok}" opacity="0.28"/>`;
  } else {
    const pct = Math.min(100, Math.max(0, d.quotaPct));
    const state = d.quotaState || (pct >= 100 ? "locked" : pct >= 90 ? "warned" : "ok");
    const fillColor = state === "locked" ? C.lock : state === "warned" ? C.warn : C.ok;
    const fillW = pct > 0 ? Math.max(10, Math.round((CW * pct) / 100)) : 0;
    const fill =
      fillW > 0 ? `<rect x="${CL}" y="${BAR_Y}" width="${fillW}" height="${BAR_H}" rx="7" fill="${fillColor}"/>` : "";
    usage = `${txt(CL, U_LABEL_Y, 22, C.label, "클라우드 사용량", { weight: 600 })}
    ${txt(CR, U_LABEL_Y, 21, C.muted, esc(d.quotaUsed) + " / " + esc(d.quotaTotal), { anchor: "end", weight: 600 })}
    <rect x="${CL}" y="${BAR_Y}" width="${CW}" height="${BAR_H}" rx="7" fill="${C.track}"/>
    ${fill}`;
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <rect x="${M}" y="${M}" width="${W - 2 * M}" height="${H - 2 * M}" rx="${R}" fill="${C.cardBg}" stroke="${C.cardBorder}" stroke-width="2"/>
  <rect x="${AV_X - 5}" y="${AV_Y - 5}" width="${AV + 10}" height="${AV + 10}" rx="${AV_R + 4}" fill="${C.tileBg}" stroke="${C.tileBorder}" stroke-width="1.5"/>
  <g stroke="#d1d5db" stroke-width="6" fill="none" stroke-linecap="round"><circle cx="${AV_X + AV / 2}" cy="${AV_Y + 42}" r="18"/><path d="M ${AV_X + AV / 2 - 26} ${AV_Y + 96} a 26 22 0 0 1 52 0"/></g>
  ${txt(TX, 100, 44, C.ink, name, { font: FONT_BODY, weight: 700 })}
  ${badge}
  ${txt(CR - 34, 59, 15, C.faint, "BLOCKCANVAS", { anchor: "end", weight: 700, spacing: 1.5 })}
  ${tiles}
  ${usage}
</svg>`;
}

// 사각(라운드) 래스터 — 플레이어 head(픽셀아트)를 nearest 로 리사이즈 후 라운드 마스크.
async function roundedRaster(buf: Buffer, size: number, radius: number): Promise<Buffer> {
  const img = await sharp(buf).resize(size, size, { kernel: "nearest" }).png().toBuffer();
  const mask = Buffer.from(
    `<svg width="${size}" height="${size}"><rect width="${size}" height="${size}" rx="${radius}" ry="${radius}" fill="#fff"/></svg>`,
  );
  return sharp(img).composite([{ input: mask, blend: "dest-in" }]).png().toBuffer();
}

// 우상단 브랜드 로고(public/logo_icon.png). 실패 시 null → 워드마크 텍스트만.
let logoCache: Buffer | null | undefined;
async function loadLogo(size: number): Promise<Buffer | null> {
  try {
    if (logoCache === undefined) {
      const p = path.join(process.cwd(), "public", "logo_icon.png");
      logoCache = fs.existsSync(p) ? fs.readFileSync(p) : null;
    }
    if (!logoCache) return null;
    return await sharp(logoCache)
      .resize(size, size, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toBuffer();
  } catch {
    return null;
  }
}

// 플레이어 얼굴(사각 머리). 네트워크 실패 시 null → 아바타 프레임만.
export async function fetchPlayerFace(uuid: string, size = AV): Promise<Buffer | null> {
  const nodash = uuid.replace(/-/g, "");
  // ⚠ mc-heads 는 가끔 전체를 기본 스티브로 내려보내는 장애가 있어 minotar 를 우선 시도한다.
  for (const u of [`https://minotar.net/avatar/${nodash}/${size}.png`, `https://mc-heads.net/avatar/${uuid}/${size}`]) {
    try {
      const r = await fetch(u, { signal: AbortSignal.timeout(4000) });
      if (r.ok) return Buffer.from(await r.arrayBuffer());
    } catch {
      /* 다음 소스 */
    }
  }
  return null;
}

// InfoCardData → 단일 PNG(960×440). faceBuf(플레이어 head)·로고를 SVG 위에 합성.
export async function renderInfoCardPng(d: InfoCardData, faceBuf?: Buffer | null): Promise<Buffer> {
  ensureCardFonts();
  const svg = buildInfoCardSvg(d);
  const base = await sharp(Buffer.from(svg)).png().toBuffer();

  const composites: sharp.OverlayOptions[] = [];
  if (faceBuf) {
    try {
      composites.push({ input: await roundedRaster(faceBuf, AV, AV_R), left: AV_X, top: AV_Y });
    } catch {
      /* 얼굴 합성 실패 시 프레임만 */
    }
  }
  const LOGO = 26;
  const logo = await loadLogo(LOGO);
  if (logo) composites.push({ input: logo, left: CR - LOGO, top: 40 });

  if (composites.length === 0) return base;
  return sharp(base).composite(composites).png().toBuffer();
}
