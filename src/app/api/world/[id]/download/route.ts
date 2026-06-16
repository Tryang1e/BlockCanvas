import { NextResponse } from "next/server";
import { createReadStream } from "fs";
import { promises as fs } from "fs";
import { Readable } from "stream";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { verifySession } from "@/lib/session";
import { backupWorld } from "@/app/actions/worlds";
import { parseBackupList } from "@/lib/worldLifecycle";

export const runtime = "nodejs";

// 월드 다운로드(소유자 전용):
//   ?ts=<백업 timestamp> → 백업 리스트의 해당 날짜 zip 을 그대로 스트리밍.
//   ts 없음 + 활성 → 새 백업 후 스트리밍. ts 없음 + 비활성 → 최신 백업 스트리밍.
//   → 압축본을 보내 outbound 용량을 줄이고, 라이브 월드 폴더를 직접 노출하지 않는다.
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

  const backups = parseBackupList(world.backups);
  const tsParam = new URL(request.url).searchParams.get("ts");

  let zipPath: string;
  let chosenTs: number | null = null;
  if (tsParam) {
    // 특정 날짜의 백업 다운로드
    const found = backups.find((b) => String(b.ts) === tsParam);
    if (!found) return NextResponse.json({ error: "해당 백업을 찾을 수 없습니다." }, { status: 404 });
    zipPath = found.path;
    chosenTs = found.ts;
  } else if (world.status === "archived") {
    // 비활성: 최신 백업 그대로(잠금 중에도 가능)
    zipPath = backups[0]?.path || world.backup_path || "";
    chosenTs = backups[0]?.ts ?? null;
    if (!zipPath) return NextResponse.json({ error: "다운로드할 백업이 없습니다." }, { status: 404 });
  } else {
    // 활성 + ts 없음: 새 백업 후 스트리밍
    const backup = await backupWorld(id, { force: true }); // force=잠금 중에도 허용
    if (!backup.success) {
      return NextResponse.json({ error: backup.error || "백업/다운로드에 실패했습니다." }, { status: 502 });
    }
    if (!backup.backupPath) {
      return NextResponse.json({ error: "백업 경로를 받지 못했습니다." }, { status: 502 });
    }
    zipPath = backup.backupPath;
  }

  // zipPath 는 DB 에서 온 동적 절대경로(MC 서버 backups 폴더). Turbopack 의 정적 파일추적이
  // 프로젝트 전체를 번들에 끌어오지 않도록 동적 fs 인자를 추적 제외 처리한다.
  let size = 0;
  try {
    const st = await fs.stat(/* turbopackIgnore: true */ zipPath);
    size = st.size;
  } catch {
    return NextResponse.json({ error: "백업 파일을 찾을 수 없습니다." }, { status: 502 });
  }

  const safeName = (world.name || "world").replace(/[^\w가-힣 .-]/g, "_");
  const dateSuffix = chosenTs ? "_" + new Date(chosenTs).toISOString().slice(0, 10) : "";
  const filename = `${safeName}${dateSuffix}.zip`;
  const nodeStream = createReadStream(/* turbopackIgnore: true */ zipPath);
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
