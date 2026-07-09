import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { MC_SERVER_DIR } from "@/lib/mcServerDir";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ItemsAdder external-host 용 — 생성된 리소스팩(output/generated.zip)을 그대로 서빙한다.
// 자체호스팅이라 웹과 MC 서버가 같은 머신 → 디스크에서 직접 읽고, 클라이언트는 craftopia.work(CF 터널)로 받는다.
// simple_self_host(자체 포트/auto 주소)가 터널 환경에서 클라에 안 닿던 문제를 우회한다.
// 경로는 ITEMSADDER_PACK_PATH env 로 덮어쓸 수 있음(기본=프로젝트 루트 기준).
const PACK_PATH =
  process.env.ITEMSADDER_PACK_PATH ||
  path.join(MC_SERVER_DIR, "plugins", "ItemsAdder", "output", "generated.zip");

export async function GET() {
  try {
    const data = await fs.readFile(/* turbopackIgnore: true */ PACK_PATH);
    return new NextResponse(new Uint8Array(data), {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": 'attachment; filename="blockcanvas-pack.zip"',
        "Cache-Control": "no-store",
      },
    });
  } catch {
    return NextResponse.json(
      { error: "ItemsAdder pack not found — 서버에서 /iazip 로 팩을 먼저 생성하세요." },
      { status: 404 }
    );
  }
}
