import sharp from "sharp";
import zlib from "node:zlib";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { buildCardSvg, buildUnlinkedCardSvg, type StatusCardData } from "./statusCard";
import { ensureCardFonts } from "./cardFonts";
import { sliceImageGridBuffers, type GuiDesignSpec } from "./iaGuiGen";
import type { MinecraftStatus } from "./minecraftStatus";
import { MC_SERVER_DIR } from "./mcServerDir";

// 플레이어별 상태창 카드를 개인 리소스팩으로 굽는다.
//   buildCardSvg → viewBox 512x372 크롭 → 704x512 직접 렌더(G4 픽셀퍼펙트) → 얼굴 합성 → 6타일 버퍼
//   → pack.mcmeta + assets/blockcanvas/textures/font/card_R_C.png ×6 의 STORED zip.
//   ItemsAdder 팩(allow_other_plugins_resourcepacks:true) 뒤에 보내 card_* 텍스처만 오버라이드.
// ※ 정적 베이크 스크립트(scripts/render-status-card.ts)와 동일 스펙 — 디자인 바뀌면 양쪽 자동 반영.

const CARD_SPEC: GuiDesignSpec = {
  namespace: "blockcanvas", id: "card", targetGuiScale: 4, tileSize: 256,
  anchorOffset: -8, seamCorrection: -1, rowReturnCorrection: 1, yPosition: 14,
};

const FONT_DIR = "assets/blockcanvas/textures/font"; // generated.zip 내부 경로(오버라이드 대상)

export interface CardTileBuf { name: string; buffer: Buffer }
export interface PackEntry { path: string; data: Buffer }

// SVG(512x408) → 704x512 crisp 소스 → 얼굴 합성 → 6타일 버퍼.
async function svgToTileBuffers(svg512: string, faceBuf?: Buffer | null): Promise<CardTileBuf[]> {
  ensureCardFonts();
  const svg = svg512.replace(
    '<svg xmlns="http://www.w3.org/2000/svg" width="512" height="408">',
    '<svg xmlns="http://www.w3.org/2000/svg" width="704" height="512" viewBox="0 0 512 372" shape-rendering="crispEdges">',
  );
  let src = await sharp(Buffer.from(svg)).png().toBuffer();
  if (faceBuf) {
    const f = await sharp(faceBuf).resize(88, 88, { kernel: "nearest" }).png().toBuffer();
    src = await sharp(src).composite([{ input: f, left: 36, top: 28 }]).png().toBuffer(); // 디자인(26,20,64)×1.375
  }
  const tiles = await sliceImageGridBuffers(src, CARD_SPEC);
  return tiles.map((t) => ({ name: t.tile.name, buffer: t.buffer }));
}

export function statusToCardData(name: string, s: MinecraftStatus): StatusCardData {
  return {
    name,
    role: s.role ?? "user",
    plotCount: s.plot_count ?? 0,
    worldCount: s.world_count ?? 0,
    worldInvited: s.world_invited ?? 0,
    quotaUsed: s.quota_used ?? "0", // formatBytes 결과 그대로(예 "158 MB") — 총량과 단위 다를 수 있어 각자 표기
    quotaTotal: s.quota_total ?? "-",
    quotaUnlimited: !!s.quota_unlimited,
    quotaPct: s.quota_pct ?? 0,
  };
}

export function renderLinkedTiles(d: StatusCardData, faceBuf?: Buffer | null): Promise<CardTileBuf[]> {
  return svgToTileBuffers(buildCardSvg(d), faceBuf);
}

export function renderUnlinkedTiles(name: string): Promise<CardTileBuf[]> {
  return svgToTileBuffers(buildUnlinkedCardSvg(name), null);
}

// pack.mcmeta + 6 PNG (+ 폰트 정의/오프셋 글리프) → STORED(무압축) zip 버퍼. (PNG는 이미 압축 → STORED 무손실)
//   extra = loadIaFontAssets() 가 준 자급자족용 폰트 자산(default.json + char/black.png). 없으면 빈 배열.
export function buildResourcePackZip(tiles: CardTileBuf[], extra: PackEntry[] = [], packFormat = 75, description = "BlockCanvas Status"): Buffer {
  const entries: PackEntry[] = [
    { path: "pack.mcmeta", data: Buffer.from(JSON.stringify({ pack: { pack_format: packFormat, description } }), "utf8") },
    ...tiles.map((t) => ({ path: `${FONT_DIR}/${t.name}.png`, data: t.buffer })),
    ...extra,
  ];
  return storedZip(entries);
}

// ── ItemsAdder 팩에서 카드 폰트 정의를 가져와 개인 팩을 자급자족화한다(tofu 해결) ──
// 개인 팩이 ItemsAdder 팩 위에 스택/대체될 때 카드 글리프(card_R_C)와 :offset_N: 글리프의 폰트 정의가
// 사라지면 카드가 전부 □(tofu)가 된다. 따라서 IA가 생성한 default.json 에서 **카드에 필요한 provider만**
// (blockcanvas:font/card_* = 카드 6타일, char/black.png = :offset_N: 음수폭 글리프) 추려 개인 팩에 동봉한다.
//   · _iainternal:* provider 는 제외 — 그 텍스처는 개인 팩에 없어서, IA 팩과 공존(merge)할 때 IA 의
//     정상 이모지/GUI 글리프를 우리 빈 정의가 가릴 위험이 있다(회귀 방지). 카드 타이틀엔 안 쓰임.
//   · char/black.png 텍스처도 동봉 — IA 팩이 내려간 시나리오에서도 오프셋이 정상 동작하도록.
// 폰트 provider 리스트는 마크가 팩들 + 바닐라 기본을 merge 하므로, 카드 외 일반 텍스트는 영향 없음.

const IA_DEFAULT_FONT = "assets/minecraft/font/default.json";
const IA_BLACK_TEXTURE = "assets/minecraft/textures/char/black.png";

function iaPackPath(): string {
  return (
    process.env.ITEMSADDER_PACK_PATH ||
    path.join(MC_SERVER_DIR, "plugins", "ItemsAdder", "output", "generated.zip")
  );
}

interface FontAssetCache { mtimeMs: number; entries: PackEntry[] }
let fontAssetCache: FontAssetCache | null = null;

// IA generated.zip 에서 카드 폰트 자산을 읽어 개인 팩에 동봉할 엔트리 배열로 반환(generated.zip mtime 캐싱).
// 실패(팩 없음/파싱 오류) 시 [] 반환 — 자급자족 없이 동작(기존 동작=tofu 위험)하되 절대 throw 하지 않는다.
export function loadIaFontAssets(): PackEntry[] {
  try {
    const file = iaPackPath();
    // turbopackIgnore: 동적 경로(env/cwd)라 번들러가 매칭 파일을 정적 추적해 과대번들/경고를 내는 것을 막는다.
    const st = fs.statSync(/* turbopackIgnore: true */ file);
    if (fontAssetCache && fontAssetCache.mtimeMs === st.mtimeMs) return fontAssetCache.entries;

    const zip = fs.readFileSync(/* turbopackIgnore: true */ file);
    const want = new Map<string, Buffer | null>([[IA_DEFAULT_FONT, null], [IA_BLACK_TEXTURE, null]]);
    readZipEntries(zip, want);

    const defJson = want.get(IA_DEFAULT_FONT);
    const black = want.get(IA_BLACK_TEXTURE);
    const entries: PackEntry[] = [];
    if (defJson) {
      const filtered = filterCardFontProviders(defJson);
      if (filtered) entries.push({ path: IA_DEFAULT_FONT, data: filtered });
    }
    if (black) entries.push({ path: IA_BLACK_TEXTURE, data: black });

    fontAssetCache = { mtimeMs: st.mtimeMs, entries };
    return entries;
  } catch {
    return []; // generated.zip 미생성 등 — 폴백(베이크 카드)에 맡긴다.
  }
}

// default.json(providers 배열) → 카드에 필요한 provider 만 남긴 default.json 버퍼.
//   keep = blockcanvas:font/card_* (카드 타일) | char/black.png (오프셋 음수폭 글리프).
function filterCardFontProviders(defJson: Buffer): Buffer | null {
  try {
    const parsed = JSON.parse(defJson.toString("utf8")) as { providers?: Array<{ file?: string }> };
    if (!Array.isArray(parsed.providers)) return null;
    const providers = parsed.providers.filter((p) => {
      const f = p.file ?? "";
      // 카드 6타일 + 오프셋(char/black.png)만. 다른 blockcanvas 폰트는 텍스처를 동봉하지 않으므로 제외.
      return f.startsWith("blockcanvas:font/card_") || f === "char/black.png";
    });
    if (providers.length === 0) return null;
    return Buffer.from(JSON.stringify({ providers }), "utf8");
  } catch {
    return null;
  }
}

// ── 최소 zip 리더(중앙 디렉터리 기반) ──
// ItemsAdder 의 generated.zip 은 로컬 헤더의 파일명·CRC·크기가 깨져 있고(1337 더미) 중앙 디렉터리만 정상.
// 따라서 중앙 디렉터리에서 엔트리를 찾고, 로컬 헤더 오프셋으로 데이터 시작점만 계산한 뒤
// DEFLATE 스트림을 자가종료(inflateRaw)로 풀어 더미 크기 필드를 무시한다(unzip 동작과 동일).
function readZipEntries(zip: Buffer, want: Map<string, Buffer | null>): void {
  // EOCD 탐색(주석 없는 일반 케이스 — 끝에서 역방향)
  let eo = -1;
  for (let i = zip.length - 22; i >= 0; i--) {
    if (zip.readUInt32LE(i) === 0x06054b50) { eo = i; break; }
  }
  if (eo < 0) return;
  const count = zip.readUInt16LE(eo + 10);
  let p = zip.readUInt32LE(eo + 16); // 중앙 디렉터리 시작 오프셋
  let remaining = want.size;
  for (let i = 0; i < count && remaining > 0; i++) {
    if (zip.readUInt32LE(p) !== 0x02014b50) return; // 중앙 헤더 시그니처 깨짐
    const method = zip.readUInt16LE(p + 10);
    const nameLen = zip.readUInt16LE(p + 28);
    const extraLen = zip.readUInt16LE(p + 30);
    const commLen = zip.readUInt16LE(p + 32);
    const lho = zip.readUInt32LE(p + 42);
    const name = zip.toString("utf8", p + 46, p + 46 + nameLen);
    if (want.has(name) && want.get(name) == null) {
      // 로컬 헤더의 name/extra 길이만 신뢰(내용은 더미) → 데이터 시작점 계산.
      const lNameLen = zip.readUInt16LE(lho + 26);
      const lExtraLen = zip.readUInt16LE(lho + 28);
      const dataStart = lho + 30 + lNameLen + lExtraLen;
      try {
        const data = method === 0 ? zip.subarray(dataStart) : zlib.inflateRawSync(zip.subarray(dataStart));
        want.set(name, data);
        remaining--;
      } catch {
        /* 이 엔트리 스킵 */
      }
    }
    p += 46 + nameLen + extraLen + commLen;
  }
}

export function sha1Hex(buf: Buffer): string {
  return crypto.createHash("sha1").update(buf).digest("hex");
}

// 순수 STORED zip(외부 라이브러리 없이). zlib.crc32(Node 22+).
function storedZip(entries: PackEntry[]): Buffer {
  const locals: Buffer[] = [];
  const centrals: Buffer[] = [];
  let offset = 0;
  for (const e of entries) {
    const name = Buffer.from(e.path, "utf8");
    const crc = zlib.crc32(e.data) >>> 0;
    const size = e.data.length;
    const lh = Buffer.alloc(30);
    lh.writeUInt32LE(0x04034b50, 0); lh.writeUInt16LE(20, 4); lh.writeUInt16LE(0, 6);
    lh.writeUInt16LE(0, 8); lh.writeUInt16LE(0, 10); lh.writeUInt16LE(0x21, 12);
    lh.writeUInt32LE(crc, 14); lh.writeUInt32LE(size, 18); lh.writeUInt32LE(size, 22);
    lh.writeUInt16LE(name.length, 26); lh.writeUInt16LE(0, 28);
    locals.push(lh, name, e.data);
    const ch = Buffer.alloc(46);
    ch.writeUInt32LE(0x02014b50, 0); ch.writeUInt16LE(20, 4); ch.writeUInt16LE(20, 6);
    ch.writeUInt16LE(0, 8); ch.writeUInt16LE(0, 10); ch.writeUInt16LE(0, 12); ch.writeUInt16LE(0x21, 14);
    ch.writeUInt32LE(crc, 16); ch.writeUInt32LE(size, 20); ch.writeUInt32LE(size, 24);
    ch.writeUInt16LE(name.length, 28); ch.writeUInt16LE(0, 30); ch.writeUInt16LE(0, 32);
    ch.writeUInt16LE(0, 34); ch.writeUInt16LE(0, 36); ch.writeUInt32LE(0, 38); ch.writeUInt32LE(offset, 42);
    centrals.push(ch, name);
    offset += lh.length + name.length + size;
  }
  const localBuf = Buffer.concat(locals);
  const centralBuf = Buffer.concat(centrals);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0); eocd.writeUInt16LE(0, 4); eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(entries.length, 8); eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(centralBuf.length, 12); eocd.writeUInt32LE(localBuf.length, 16); eocd.writeUInt16LE(0, 20);
  return Buffer.concat([localBuf, centralBuf, eocd]);
}
