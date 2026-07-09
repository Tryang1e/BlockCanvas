import { NextResponse } from "next/server";
import { createReadStream, promises as fs } from "fs";
import { Readable } from "stream";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { verifySessionFull } from "@/lib/session";
import { canUseBuildDashboard } from "@/lib/roles";
import { galleryFileAbs } from "@/lib/blueprintGallery";
import { recordDownloadAndReward } from "@/lib/blueprintPublish";
import { canAccessBlueprint } from "@/lib/blueprintPurchase";
import { getModerationState } from "@/lib/moderation";
import { openDownloadSession, throttledReadable } from "@/lib/uploadThrottle";
import { transferMultiplier } from "@/lib/transferEta";

export const runtime = "nodejs";

// 갤러리 파일 다운로드: ?id=<postId> → 원본 .bp/.schem 첨부 스트리밍. 인증 완료 유저 전용 + 고유 다운로드 기록.
export async function GET(request: Request) {
  const full = verifySessionFull((await cookies()).get("session")?.value);
  if (!full) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  const profile = await prisma.profile.findUnique({
    where: { creator_name: full.name.toLowerCase() },
    select: { id: true, role: true, discord_id: true, discord_in_guild: true, minecraft_uuid: true, email: true, password: true, status: true, suspended_until: true, muted_until: true, moderation_reason: true, token_version: true },
  });
  if (!profile) return NextResponse.json({ error: "프로필을 찾을 수 없습니다." }, { status: 403 });
  // 세션 무효화 대조 — 비밀번호 변경/재설정으로 token_version 이 오른 구(舊) 세션(도난 쿠키 등)은 거부.
  if (profile.token_version !== full.version) return NextResponse.json({ error: "만료된 세션입니다. 다시 로그인해주세요." }, { status: 401 });
  if (!canUseBuildDashboard(profile)) {
    return NextResponse.json({ error: "갤러리는 인증을 완료한 유저만 이용할 수 있습니다." }, { status: 403 });
  }
  if (getModerationState(profile).isBlocked) {
    return NextResponse.json({ error: "현재 계정이 이용정지/차단 상태입니다." }, { status: 403 });
  }

  const id = new URL(request.url).searchParams.get("id") || "";
  const post = await prisma.blueprintPost.findUnique({
    where: { id },
    select: { id: true, ext: true, title: true, status: true, price: true, author_id: true },
  });
  if (!post) {
    return NextResponse.json({ error: "게시물을 찾을 수 없습니다." }, { status: 404 });
  }
  // 공개(published)가 아닌 게시물(hidden=신고 검토 중 / removed)은 작성자·스태프만 다운로드(격리 콘텐츠 유출 방지).
  const isStaff = profile.role === "admin" || profile.role === "manager";
  if (post.status !== "published" && post.author_id !== profile.id && !isStaff) {
    return NextResponse.json({ error: "게시물을 찾을 수 없습니다." }, { status: 404 });
  }
  // 유료 블루프린트는 구매(또는 작성자/스태프)여야 다운로드 가능.
  if (!(await canAccessBlueprint(post, profile))) {
    return NextResponse.json({ error: "유료 블루프린트입니다. 먼저 구매해주세요." }, { status: 402 });
  }

  const abs = galleryFileAbs(post.id, post.ext);
  if (!abs) return NextResponse.json({ error: "잘못된 경로입니다." }, { status: 400 });
  let size = 0;
  try {
    const st = await fs.stat(/* turbopackIgnore: true */ abs);
    if (!st.isFile()) throw new Error("not a file");
    size = st.size;
  } catch {
    return NextResponse.json({ error: "파일을 찾을 수 없습니다." }, { status: 404 });
  }

  // 고유 다운로드 기록 + 마일스톤 보상(best-effort — 스트리밍 전). 무료글만: 유료글은 판매수익이 보상이라 마일스톤 미지급.
  if (post.price <= 0) {
    try {
      await recordDownloadAndReward(post.id, profile.id);
    } catch {
      /* ignore */
    }
  }

  const safeTitle = (post.title || "blueprint").replace(/[^\w가-힣 .()\-]/g, "_").slice(0, 60) || "blueprint";
  const downloadName = `${safeTitle}${post.ext}`;
  // 아웃바운드 속도 제한(공평 큐잉) — 총합은 env 값으로 고정, 유저 단위 가중 배분(creator 이상 2배 지분).
  // request.signal 전달 필수 — 클라 이탈 시 세션/fd 정리(throttledReadable 참고).
  const throttle = openDownloadSession(transferMultiplier(profile.role), profile.id);
  const nodeStream = createReadStream(/* turbopackIgnore: true */ abs);
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
