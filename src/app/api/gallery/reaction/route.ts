import { NextRequest, NextResponse } from "next/server";
import { verifyInboundSignature } from "@/lib/minecraft";
import { DISCORD_API_SECRET } from "@/lib/discordApiSecret";
import { recordReactionAndReward } from "@/lib/blueprintPublish";
import { recordForumReactionAndReward } from "@/lib/forumReaction";

export const runtime = "nodejs";

/**
 * POST /api/gallery/reaction — 디스코드 봇이 갤러리 포럼 글의 👍 반응 add/remove 를 전달.
 * body: { message_id, user_id, added }. HMAC(DISCORD_API_SECRET) 서명 검증.
 * 매핑: message_id == 게시물의 discord_message_id(포럼은 스레드 시작 메시지 id). 실제 카운트/보상/게이트는 recordReactionAndReward.
 */
export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    if (!verifyInboundSignature(rawBody, req.headers.get("X-Timestamp"), req.headers.get("X-Signature"), DISCORD_API_SECRET)) {
      return NextResponse.json({ error: "Unauthorized: Invalid signature or expired timestamp." }, { status: 401 });
    }
    const { message_id, user_id, added, message_author_id, channel_id, parent_id } = JSON.parse(rawBody) ?? {};
    if (!message_id || !user_id) {
      return NextResponse.json({ error: "Bad Request: missing message_id or user_id." }, { status: 400 });
    }
    // 블루프린트 갤러리 반응(기존) + 일반 포럼(전시관 등) 반응 보상 — 둘 다 시도(해당 없으면 각자 no-op).
    await Promise.allSettled([
      recordReactionAndReward(String(message_id), String(user_id), !!added),
      recordForumReactionAndReward({
        messageId: String(message_id),
        channelId: channel_id ? String(channel_id) : null,
        parentId: parent_id ? String(parent_id) : null,
        reactorDiscordId: String(user_id),
        authorDiscordId: message_author_id ? String(message_author_id) : null,
        added: !!added,
      }),
    ]);
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("Gallery reaction error:", msg);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
