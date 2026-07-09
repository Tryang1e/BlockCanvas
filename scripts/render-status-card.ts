// 상태창(bc_status) 카드 타일 생성기 — 단일 행 + 픽셀 퍼펙트(ItemsAdder 가이드 방식).
//   buildCardSvg(512x408) → viewBox 로 512x372 크롭 + 352x256 직접 렌더(다운스케일 없음)
//   + shape-rendering=crispEdges(도형 crisp; 글자는 둥근모 가독 위해 AA 유지)
//   → iaGuiGen.buildGui(G2) → card_0/card_1.png(176x256) + status_panel.yml + 타이틀.
//
// 실행: npx tsx scripts/render-status-card.ts
//   · 픽셀퍼펙트: scale_ratio = 256 ÷ 2 = 128. G2=1:1, G4=2배 nearest(둘 다 다운스케일 0).
//   · 단일 행이라 세로 복귀 오프셋/이음새 없음. y_position/anchor 는 인게임에서 미세조정(가이드 §9).

import sharp from "sharp";
import path from "path";
import { promises as fs } from "fs";
import { buildCardSvg, type StatusCardData } from "../src/lib/statusCard";
import { ensureCardFonts } from "../src/lib/cardFonts";
import { buildGui } from "../src/lib/iaGuiGen";

const CONTENT = path.join(process.cwd(), "MC_SER/Server/plugins/ItemsAdder/contents/blockcanvas");
const FONT_DIR = path.join(CONTENT, "textures/font");

const sample: StatusCardData = {
  name: "Try_angle", role: "admin", plotCount: 2, worldCount: 1, worldInvited: 0,
  quotaUsed: "0.4", quotaTotal: "5 GB", quotaUnlimited: false, quotaPct: 8,
};
const FACE_UUID = "edde6296-2b6c-4f96-8c52-9c1b1dc4ff47"; // Try_ang1e (UUID 기준)

async function loadFace(): Promise<Buffer | null> {
  const nodash = FACE_UUID.replace(/-/g, "");
  for (const u of [
    // mc-heads 가 가끔 전체 스티브로 다운되므로 minotar 우선.
    `https://minotar.net/avatar/${nodash}/64.png`,
    `https://mc-heads.net/avatar/${FACE_UUID}/64`,
  ]) {
    try { const r = await fetch(u); if (r.ok) return Buffer.from(await r.arrayBuffer()); } catch { /* next */ }
  }
  return null;
}

async function main(): Promise<void> {
  ensureCardFonts();
  // 512x408 → viewBox 로 512x372 크롭(하단 패딩 제거) → 352x256 직접 렌더.
  // 고해상도 2배: 512x408 → viewBox 512x372 크롭 → 704x512 직접 렌더(= G4 화면해상도, 한글 풀 선명).
  const svg = buildCardSvg(sample).replace(
    '<svg xmlns="http://www.w3.org/2000/svg" width="512" height="408">',
    '<svg xmlns="http://www.w3.org/2000/svg" width="704" height="512" viewBox="0 0 512 372" shape-rendering="crispEdges">',
  );
  let src = await sharp(Buffer.from(svg)).png().toBuffer();
  const face = await loadFace();
  if (face) {
    const f = await sharp(face).resize(88, 88, { kernel: "nearest" }).png().toBuffer(); // 디자인(26,20,64)→×1.375
    src = await sharp(src).composite([{ input: f, left: 36, top: 28 }]).png().toBuffer();
  }

  const res = await buildGui(src, {
    namespace: "blockcanvas", id: "card", targetGuiScale: 4, tileSize: 256, anchorOffset: -8, seamCorrection: -1,
    rowReturnCorrection: 1, // 인게임 확정: 생성기 -177 → 아래 행 1px 우측 → -176
    // 704x512 → 256 한계로 3열×2행 그리드. scale_ratio = 256÷4 = 64. G4 에서 1:1(다운스케일 0 = 한글 선명).
    // y_position: 최상단 행 14(구 값=헤더 위치). 하단 행은 생성기가 14-64=-50 자동 스택. 인게임서 ±조정.
    yPosition: 14,
  }, FONT_DIR);

  // status_panel.yml(= font_images) 자동 작성.
  await fs.writeFile(path.join(CONTENT, "status_panel.yml"), res.yaml, "utf8");

  console.log(`타일: ${res.tiles.map((t) => t.fileName).join(", ")} (face: ${face ? "ok" : "none"})`);
  console.log(`scale_ratio=${res.scaleRatio} topY=${res.topYPosition} ${res.rows}행×${res.cols}열 표시폭(GUI)=${res.displayWidth}`);
  console.log(`bc_status.yml menu_title: '${res.titleString}'`);
}

main().catch((e) => { console.error(e); process.exit(1); });
