import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyInboundSignature } from "@/lib/minecraft";

export const runtime = "nodejs";

const EXPLORE_SHARE_MAX = 9; // 유저당 탐방 공유 가능 월드 수 (web/actions/worlds.ts 와 일치)

// 인게임 /월드 공유(share=true) · /월드 공유취소(share=false) — 서 있는 자기 월드(folder=mv_world)의 탐방 공유를 켜고 끈다.
//   POST { uuid, folder, share? } → { success, shared, name, unchanged? }  (HMAC). share 없으면 토글(구버전 호환).
//   소유자 검증 + 9개 제한 + 관리자 정지(켜기만 차단) 존중.
export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    if (!verifyInboundSignature(rawBody, req.headers.get("X-Timestamp"), req.headers.get("X-Signature"))) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }
    const { uuid, folder, share } = JSON.parse(rawBody) ?? {};
    if (!uuid || !folder) {
      return NextResponse.json({ success: false, error: "Missing uuid or folder" }, { status: 400 });
    }

    const profile = await prisma.profile.findUnique({ where: { minecraft_uuid: String(uuid) } });
    if (!profile) {
      return NextResponse.json({ success: false, linked: false });
    }

    // 현재 서 있는 월드(folder=mv_world)가 본인 소유 월드인지 확인.
    const world = await prisma.minecraftWorld.findFirst({ where: { mv_world: String(folder), owner_id: profile.id } });
    if (!world) {
      return NextResponse.json({ success: false, error: "내 개인 월드 안에서만 공유할 수 있습니다. (탐방하려면 /탐방)" });
    }

    // share 가 boolean 이면 명시적 설정(/월드 공유=on, /월드 공유취소=off), 없으면(구버전 플러그인) 기존 토글.
    const next = typeof share === "boolean" ? share : !world.explore_shared;

    // 정지된 월드는 "켜기" 요청만 막는다(끄기는 항상 허용). 이미 켜져 있어도 정지 사실을 알린다.
    if (next && world.explore_suspended) {
      return NextResponse.json({ success: false, error: "관리자가 이 월드의 탐방 공유를 정지했습니다." });
    }

    // 이미 원하는 상태면 DB 변경 없이 멱등 응답(인게임이 "이미 ~" 안내를 띄운다).
    if (next === world.explore_shared) {
      return NextResponse.json({ success: true, shared: world.explore_shared, name: world.name, unchanged: true });
    }

    if (next) {
      const sharedCount = await prisma.minecraftWorld.count({ where: { owner_id: profile.id, explore_shared: true } });
      if (sharedCount >= EXPLORE_SHARE_MAX) {
        return NextResponse.json({ success: false, error: `탐방 공유는 최대 ${EXPLORE_SHARE_MAX}개까지 가능합니다.` });
      }
    }

    await prisma.minecraftWorld.update({ where: { id: world.id }, data: { explore_shared: next } });
    await prisma.creatorLog.create({
      data: { creator_name: profile.creator_name, action: "WORLD_EXPLORE_SHARE", details: `탐방 공유 ${next ? "ON" : "OFF"}(인게임): ${world.name}` },
    }).catch(() => {});

    return NextResponse.json({ success: true, shared: next, name: world.name });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
