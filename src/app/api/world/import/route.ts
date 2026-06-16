import { NextResponse } from "next/server";
import { Readable } from "stream";
import { createWriteStream } from "fs";
import { promises as fs } from "fs";
import path from "path";
import { randomUUID } from "crypto";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { verifySession } from "@/lib/session";
import { getWorldQuotaBytes } from "@/lib/worldQuota";
import { importWorld } from "@/app/actions/worlds";

export const runtime = "nodejs";

// 절대 상한(쿼터와 별개로 비정상 업로드 차단). 2GB.
const MAX_IMPORT_BYTES = 2 * 1024 * 1024 * 1024;

// 월드 .zip 업로드(월드 삽입). 대용량 대비 multipart 버퍼링 대신 raw body 를 디스크로 스트리밍한다.
//   POST /api/world/import?name=<월드이름>&icon=<아이콘키>   body: zip 바이트
export async function POST(request: Request) {
  let stagingPath: string | null = null;
  try {
    const session = verifySession((await cookies()).get("session")?.value);
    if (!session) return NextResponse.json({ success: false, error: "로그인이 필요합니다." }, { status: 401 });

    const profile = await prisma.profile.findUnique({ where: { creator_name: session.toLowerCase() } });
    if (!profile) return NextResponse.json({ success: false, error: "프로필을 찾을 수 없습니다." }, { status: 403 });
    if (profile.world_quota_state === "locked") {
      return NextResponse.json({ success: false, error: "클라우드 용량 초과로 잠겨 있습니다. 월드를 삭제해 용량을 확보하세요." }, { status: 423 });
    }

    const url = new URL(request.url);
    const name = (url.searchParams.get("name") || "").trim();
    const icon = url.searchParams.get("icon") || undefined;
    if (!name) return NextResponse.json({ success: false, error: "월드 이름이 필요합니다." }, { status: 400 });
    if (!request.body) return NextResponse.json({ success: false, error: "업로드 파일이 없습니다." }, { status: 400 });

    // 남은 쿼터 계산(모든 월드 합계 기준 — 비활성 포함).
    const rows = await prisma.minecraftWorld.findMany({
      where: { owner_id: profile.id },
      select: { size_bytes: true },
    });
    const used = rows.reduce((s, r) => s + Number(r.size_bytes), 0);
    const total = getWorldQuotaBytes(profile.role); // admin = Infinity
    const remaining = Number.isFinite(total) ? Math.max(0, total - used) : Number.POSITIVE_INFINITY;
    const cap = Math.min(MAX_IMPORT_BYTES, remaining);

    const contentLength = Number(request.headers.get("content-length") || 0);
    if (contentLength && contentLength > cap) {
      return NextResponse.json({ success: false, error: "클라우드 용량을 초과합니다." }, { status: 413 });
    }

    // 스테이징 디스크에 스트리밍 저장(상한 초과 시 중단).
    const stagingDir = path.join(process.cwd(), "world-imports");
    await fs.mkdir(stagingDir, { recursive: true });
    stagingPath = path.join(stagingDir, `${randomUUID()}.zip`);

    const nodeStream = Readable.fromWeb(request.body as Parameters<typeof Readable.fromWeb>[0]);
    const ws = createWriteStream(stagingPath);
    let written = 0;
    await new Promise<void>((resolve, reject) => {
      nodeStream.on("data", (chunk: Buffer) => {
        written += chunk.length;
        if (written > cap) {
          nodeStream.destroy();
          ws.destroy();
          reject(new Error("QUOTA"));
          return;
        }
        if (!ws.write(chunk)) {
          nodeStream.pause();
          ws.once("drain", () => nodeStream.resume());
        }
      });
      nodeStream.on("end", () => ws.end(resolve));
      nodeStream.on("error", reject);
      ws.on("error", reject);
    });

    // ZIP 매직바이트(PK) 확인 — 월드맵이 아닌 파일(이미지·문서 등)을 조기 거부. level.dat 최종 검증은 플러그인이 수행.
    let isZip = true;
    try {
      const fh = await fs.open(stagingPath, "r");
      const head = Buffer.alloc(2);
      await fh.read(head, 0, 2, 0);
      await fh.close();
      isZip = head[0] === 0x50 && head[1] === 0x4b; // "PK"
    } catch { /* 검사 실패 시 통과시켜 플러그인이 판단 */ }
    if (!isZip) {
      return NextResponse.json({ success: false, error: "올바른 .zip 파일이 아닙니다. 월드 폴더를 압축한 .zip 을 올려주세요." }, { status: 400 });
    }

    // importWorld 가 스테이징 파일을 정리(성공/실패 무관)하므로 이후 finally 에서 중복 정리 안 함.
    const consumedPath = stagingPath;
    stagingPath = null;
    const res = await importWorld(name, icon, consumedPath, written);
    return NextResponse.json(res, { status: res.success ? 200 : 400 });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg === "QUOTA") {
      return NextResponse.json({ success: false, error: "클라우드 용량을 초과합니다." }, { status: 413 });
    }
    return NextResponse.json({ success: false, error: `업로드 실패: ${msg}` }, { status: 500 });
  } finally {
    if (stagingPath) await fs.unlink(stagingPath).catch(() => {});
  }
}
