import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { promises as fs } from "fs";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { verifySessionFull } from "@/lib/session";
import { rateLimit } from "@/lib/rate-limit";
import { mainSiteUrl } from "@/lib/publicUrl";
import { canUseBuildDashboard } from "@/lib/roles";
import { normalizeGalleryExt, shareGateError } from "@/lib/blueprintGallery";
import { resolveSchemAbs, safeRelFile } from "@/lib/schematics";
import { createBlueprintPost, GalleryValidationError } from "@/lib/blueprintPublish";

export const runtime = "nodejs";

const MAX_COVER_BYTES = 8 * 1024 * 1024; // 표지 이미지 8MB

// 갤러리 공유 업로드 — 파일 업로드(source=upload) 또는 내 스키매틱 클라우드에서 선택(source=cloud).
// 필드: title, description?, tags?(comma), source, file?(upload), cloudPath?(cloud), cover?(이미지; .schem 필수)
export async function POST(request: NextRequest) {
  try {
    const full = verifySessionFull((await cookies()).get("session")?.value);
    if (!full) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
    if (!rateLimit("gallery-upload:" + full.name, 20, 60 * 1000)) {
      return NextResponse.json({ error: "요청이 너무 많습니다. 잠시 후 다시 시도해 주세요." }, { status: 429 });
    }
    const profile = await prisma.profile.findUnique({ where: { creator_name: full.name.toLowerCase() } });
    if (!profile) return NextResponse.json({ error: "프로필을 찾을 수 없습니다." }, { status: 403 });
    // 세션 무효화 대조 — 비밀번호 변경/재설정으로 무효화된 구 세션 거부(무효화된 쿠키로 게시 방지).
    if (profile.token_version !== full.version) return NextResponse.json({ error: "만료된 세션입니다. 다시 로그인해주세요." }, { status: 401 });
    if (!canUseBuildDashboard(profile)) {
      return NextResponse.json({ error: "갤러리는 인증을 완료한 유저만 이용할 수 있습니다." }, { status: 403 });
    }
    const gate = shareGateError(profile);
    if (gate) return NextResponse.json({ error: gate }, { status: 403 });

    const form = await request.formData();
    const title = String(form.get("title") || "");
    const description = String(form.get("description") || "");
    const tags = String(form.get("tags") || "")
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
    const source = String(form.get("source") || "upload");
    const price = Math.max(0, Math.floor(Number(form.get("price")) || 0)); // 판매가(코인). 0=무료. 상한은 createBlueprintPost 에서 검증.

    // 표지(선택/필수) — 이미지 버퍼.
    const coverFile = form.get("cover") as File | null;
    if (coverFile && coverFile.size > MAX_COVER_BYTES) {
      return NextResponse.json({ error: "표지 이미지가 너무 큽니다. (최대 8MB)" }, { status: 400 });
    }
    const coverBuf = coverFile && coverFile.size > 0 ? Buffer.from(await coverFile.arrayBuffer()) : null;

    let ext: ".bp" | ".schem";
    let fileBuf: Buffer;

    if (source === "cloud") {
      // 내 스키매틱 클라우드(FAWE per-player 폴더)에서 파일을 읽어 스냅샷으로 게시.
      if (!profile.minecraft_uuid) {
        return NextResponse.json({ error: "마인크래프트 계정 연동이 필요합니다." }, { status: 400 });
      }
      const rel = safeRelFile(String(form.get("cloudPath") || ""));
      if (!rel) return NextResponse.json({ error: "잘못된 클라우드 파일 경로입니다." }, { status: 400 });
      const e = normalizeGalleryExt(rel);
      if (!e) return NextResponse.json({ error: "갤러리는 .bp / .schem 파일만 공유할 수 있습니다." }, { status: 400 });
      const abs = resolveSchemAbs(profile.minecraft_uuid, rel);
      if (!abs) return NextResponse.json({ error: "잘못된 경로입니다." }, { status: 400 });
      try {
        fileBuf = await fs.readFile(/* turbopackIgnore: true */ abs);
      } catch {
        return NextResponse.json({ error: "클라우드에서 파일을 찾을 수 없습니다." }, { status: 404 });
      }
      ext = e;
    } else {
      const file = form.get("file") as File | null;
      if (!file) return NextResponse.json({ error: "파일이 없습니다." }, { status: 400 });
      const e = normalizeGalleryExt(file.name);
      if (!e) return NextResponse.json({ error: "갤러리는 .bp / .schem 파일만 올릴 수 있습니다." }, { status: 400 });
      fileBuf = Buffer.from(await file.arrayBuffer());
      ext = e;
    }

    const result = await createBlueprintPost({
      author: {
        id: profile.id,
        creator_name: profile.creator_name,
        display_name: profile.display_name,
        minecraft_uuid: profile.minecraft_uuid,
        minecraft_username: profile.minecraft_username,
        avatar_url: profile.avatar_url,
      },
      ext,
      fileBuf,
      coverBuf,
      title,
      description,
      tags,
      price,
      origin: mainSiteUrl(request, ""), // 루트 도메인(craftopia.work) — Discord 링크 canonical
    });

    return NextResponse.json({ success: true, id: result.id });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    // 입력 검증 실패는 유저에게 그대로 보여줄 예상된 메시지 → 서버 콘솔 소음을 만들지 않는다.
    // 예기치 못한 오류(파일 저장 실패 등)만 기록한다.
    if (!(error instanceof GalleryValidationError)) {
      console.error("Blueprint gallery upload error:", msg);
    }
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
