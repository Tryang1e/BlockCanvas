import { NextRequest, NextResponse } from "next/server";
import { verifyCardUrlSignature } from "@/lib/minecraft";
import { getMinecraftStatus } from "@/lib/minecraftStatus";
import {
  statusToCardData, renderLinkedTiles, renderUnlinkedTiles, buildResourcePackZip, sha1Hex, loadIaFontAssets,
} from "@/lib/statusCardPack";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// 플레이어별 상태창 카드를 개인 리소스팩(zip)으로 렌더해 반환한다.
// ★ 클라이언트(플레이어 MC)가 setResourcePack 으로 직접 받는 GET URL — 본문 HMAC 대신 단기 서명 토큰 인증.
//   플러그인이 ?uuid&name&exp&sig (sig=HMAC(secret,"uuid:name:exp")) 서명 URL 생성 → 클라가 다운로드.
//   ItemsAdder 팩(allow_other_plugins_resourcepacks:true) 뒤에 적용되어 card_R_C 텍스처만 오버라이드.
//   응답 헤더 X-Pack-Sha1 = 팩 SHA1(플러그인이 setResourcePack 해시로 사용 → 변경 없으면 클라 캐시).
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  // ign(name)·ttl(exp): 마크 색상코드 글자로 시작하면 팩 URL에서 &n/&e 가 잘려서 안전한 파라미터명 사용.
  const uuid = sp.get("uuid") ?? "";
  const name = sp.get("ign") ?? "";
  if (!uuid || !name || !verifyCardUrlSignature(uuid, name, sp.get("ttl"), sp.get("sig"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const status = await getMinecraftStatus(uuid);
    const tiles = status.linked
      ? await renderLinkedTiles(statusToCardData(name, status), await fetchFace(uuid))
      : await renderUnlinkedTiles(name);
    // IA 팩에서 카드 폰트 정의(default.json 카드 provider + char/black.png)를 동봉해 자급자족화(tofu 방지).
    const zip = buildResourcePackZip(tiles, loadIaFontAssets());
    return new NextResponse(new Uint8Array(zip), {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": 'inline; filename="bc_status.zip"',
        "X-Pack-Sha1": sha1Hex(zip),
        "Cache-Control": "no-store",
      },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: "Render failed", detail: msg }, { status: 500 });
  }
}

// 플레이어 얼굴(사각 머리). 네트워크 실패 시 null → 슬롯 프레임만.
async function fetchFace(uuid: string): Promise<Buffer | null> {
  const nodash = uuid.replace(/-/g, "");
  // ⚠ mc-heads 는 가끔 전체를 기본 스티브로 내려보내는 장애가 있어 minotar 를 우선 시도한다.
  for (const u of [`https://minotar.net/avatar/${nodash}/64.png`, `https://mc-heads.net/avatar/${uuid}/64`]) {
    try {
      const r = await fetch(u, { signal: AbortSignal.timeout(4000) });
      if (r.ok) return Buffer.from(await r.arrayBuffer());
    } catch {
      /* 다음 소스 */
    }
  }
  return null;
}
