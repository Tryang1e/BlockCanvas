// 상태창 카드 정렬 캘리브레이션 오버레이.
//   실제 카드 위에 1px 기준선을 얹어 4타일로 굽는다 → 인게임 스샷 한 장으로 오프셋/버튼 위치를 측정.
//   · 마젠타(좌 x=0 / 우 x=509): 카드 좌·우 가장자리 → 인벤토리 패널 가장자리와 비교.
//   · 노랑(x=255): tl|tr, bl|br 가운데 이음새 → 틈/겹침 확인.
//   · 시안(버튼 위 4줄): vanilla 슬롯(col 1·3·5·7) 아이콘 중심 추정선 → 실제 아이템 아이콘과 비교.
//
// 실행:  npx tsx scripts/calibrate-status-card.ts
//   적용: 서버 /iazip + 클라 재접속 → /bc_status 열고 스샷.  측정 후 scripts/render-status-card.ts 로 정상 타일 복구.

import { promises as fs } from "fs";
import path from "path";
import sharp from "sharp";
import { buildCardSvg, type StatusCardData } from "../src/lib/statusCard";
import { ensureCardFonts } from "../src/lib/cardFonts";

const OUT = path.join(
  process.cwd(),
  "MC_SER/Server/plugins/ItemsAdder/contents/blockcanvas/textures/font",
);

const sample: StatusCardData = {
  name: "Try_angle", role: "admin",
  plotCount: 2, worldCount: 1, worldInvited: 0,
  quotaUsed: "0.4 GB", quotaTotal: "5 GB", quotaUnlimited: false, quotaPct: 8,
};

// 슬롯 아이콘 중심(GUI) 17+18·col, col 1·3·5·7 = 35/71/107/143 → design = ×32/11
const iconDesignX = [35, 71, 107, 143].map((g) => Math.round((g * 32) / 11)); // 102/207/311/416

const overlay =
  `<rect x="0" y="0" width="4" height="408" fill="#ff00ff"/>` +
  `<rect x="508" y="0" width="4" height="408" fill="#ff00ff"/>` +
  `<rect x="254" y="0" width="4" height="408" fill="#ffe000"/>` +
  iconDesignX.map((x) => `<rect x="${x - 1}" y="250" width="3" height="112" fill="#00e5ff"/>`).join("");

async function main(): Promise<void> {
  ensureCardFonts();
  let svg = buildCardSvg(sample);
  svg = svg.replace("</svg>", overlay + "</svg>");
  const buf = await sharp(Buffer.from(svg)).png().toBuffer();
  const resized = await sharp(buf).resize(512, 384).png().toBuffer();
  const ex = (l: number, t: number) =>
    sharp(resized).extract({ left: l, top: t, width: 256, height: 192 }).png().toBuffer();
  const [tl, tr, bl, br] = await Promise.all([ex(0, 0), ex(256, 0), ex(0, 192), ex(256, 192)]);
  await Promise.all([
    fs.writeFile(path.join(OUT, "card_tl.png"), tl),
    fs.writeFile(path.join(OUT, "card_tr.png"), tr),
    fs.writeFile(path.join(OUT, "card_bl.png"), bl),
    fs.writeFile(path.join(OUT, "card_br.png"), br),
  ]);
  console.log(`Calibration tiles written. icon target design-x = ${iconDesignX.join(", ")}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
