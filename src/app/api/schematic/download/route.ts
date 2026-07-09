import { NextResponse } from "next/server";
import { createReadStream, promises as fs } from "fs";
import path from "path";
import { Readable } from "stream";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { verifySessionFull } from "@/lib/session";
import { resolveSchemAbs, safeRelFile } from "@/lib/schematics";
import { resolveSchemAccess } from "@/lib/schematicShares";
import { openDownloadSession, throttledReadable } from "@/lib/uploadThrottle";
import { transferMultiplier } from "@/lib/transferEta";

export const runtime = "nodejs";

// 스키매틱 다운로드: ?name=<상대경로(폴더 포함)>[&owner=<Profile.id>] → 해당 파일 스트리밍.
// owner 없으면 본인 폴더, 있으면 공유받은 폴더(view 이상이면 다운로드 가능).
export async function GET(request: Request) {
  const full = verifySessionFull((await cookies()).get("session")?.value);
  if (!full) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  const profile = await prisma.profile.findUnique({ where: { creator_name: full.name.toLowerCase() } });
  if (!profile) return NextResponse.json({ error: "프로필을 찾을 수 없습니다." }, { status: 403 });
  if (profile.token_version !== full.version) return NextResponse.json({ error: "세션이 만료되었습니다. 다시 로그인해 주세요." }, { status: 401 });

  const url = new URL(request.url);
  const access = await resolveSchemAccess(profile, url.searchParams.get("owner"));
  if (!access) return NextResponse.json({ error: "이 폴더에 접근할 권한이 없습니다." }, { status: 403 });

  const safe = safeRelFile(url.searchParams.get("name") || "");
  if (!safe) return NextResponse.json({ error: "잘못된 파일명입니다." }, { status: 400 });

  const filePath = resolveSchemAbs(access.uuid, safe);
  if (!filePath) return NextResponse.json({ error: "잘못된 경로입니다." }, { status: 400 });
  const downloadName = path.basename(safe); // 다운로드 파일명은 basename(폴더 경로 제외)
  let size = 0;
  try {
    const st = await fs.stat(/* turbopackIgnore: true */ filePath);
    if (!st.isFile()) throw new Error("not a file");
    size = st.size;
  } catch {
    return NextResponse.json({ error: "파일을 찾을 수 없습니다." }, { status: 404 });
  }

  // 아웃바운드 속도 제한(공평 큐잉) — 다른 다운로드와 동일. 총합 고정, 유저 단위 가중 배분(creator 2배 지분).
  // request.signal 전달 필수 — 클라 이탈 시 세션/fd 정리(throttledReadable 참고).
  const throttle = openDownloadSession(transferMultiplier(profile.role), profile.id);
  const nodeStream = createReadStream(/* turbopackIgnore: true */ filePath);
  const webStream = Readable.toWeb(throttledReadable(nodeStream, throttle, request.signal)) as unknown as ReadableStream<Uint8Array>;
  return new NextResponse(webStream, {
    status: 200,
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Length": String(size),
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(downloadName)}`,
      "Cache-Control": "no-store",
    },
  });
}
