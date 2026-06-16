import { NextResponse } from "next/server";
import { createReadStream } from "fs";
import { promises as fs } from "fs";
import { Readable } from "stream";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { verifySession } from "@/lib/session";
import { backupWorld } from "@/app/actions/worlds";

export const runtime = "nodejs";

// 월드 다운로드: 먼저 서버에서 백업(zip)을 만든 뒤 그 zip 을 그대로 스트리밍한다.
//   → 압축본을 보내 outbound 용량을 줄이고, 라이브 월드 폴더를 직접 노출하지 않는다(소유자 전용).
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = verifySession((await cookies()).get("session")?.value);
  if (!session) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });

  const profile = await prisma.profile.findUnique({ where: { creator_name: session.toLowerCase() } });
  if (!profile) return NextResponse.json({ error: "프로필을 찾을 수 없습니다." }, { status: 403 });

  const world = await prisma.minecraftWorld.findUnique({ where: { id } });
  if (!world || world.owner_id !== profile.id) {
    return NextResponse.json({ error: "월드를 찾을 수 없습니다." }, { status: 404 });
  }

  // 활성 월드: 새 백업 후 스트리밍. 비활성(아카이브) 월드: 기존 백업 zip 을 그대로 스트리밍(잠금 중에도 다운로드 가능).
  let zipPath: string;
  if (world.status === "archived" && world.backup_path) {
    zipPath = world.backup_path;
  } else {
    const backup = await backupWorld(id, { force: true }); // force=잠금 중에도 허용
    if (!backup.success) {
      return NextResponse.json({ error: backup.error || "백업/다운로드에 실패했습니다." }, { status: 502 });
    }
    if (!backup.backupPath) {
      return NextResponse.json({ error: "백업 경로를 받지 못했습니다." }, { status: 502 });
    }
    zipPath = backup.backupPath;
  }

  let size = 0;
  try {
    const st = await fs.stat(zipPath);
    size = st.size;
  } catch {
    return NextResponse.json({ error: "백업 파일을 찾을 수 없습니다." }, { status: 502 });
  }

  const safeName = (world.name || "world").replace(/[^\w가-힣 .-]/g, "_");
  const filename = `${safeName}.zip`;
  const nodeStream = createReadStream(zipPath);
  const webStream = Readable.toWeb(nodeStream) as unknown as ReadableStream<Uint8Array>;

  return new NextResponse(webStream, {
    status: 200,
    headers: {
      "Content-Type": "application/zip",
      "Content-Length": String(size),
      "Content-Disposition": `attachment; filename="world.zip"; filename*=UTF-8''${encodeURIComponent(filename)}`,
      "Cache-Control": "no-store",
    },
  });
}
