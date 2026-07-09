import "dotenv/config";
import {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  AttachmentBuilder,
  Events,
  MessageFlags,
  AuditLogEvent,
  Partials,
  type ChatInputCommandInteraction,
  type MessageReaction,
  type PartialMessageReaction,
  type User,
  type PartialUser,
} from "discord.js";
import crypto from "node:crypto";

const TOKEN = process.env.DISCORD_BOT_TOKEN ?? "";
const WEB_API_URL = (process.env.WEB_API_URL ?? "http://localhost:3000").replace(/\/$/, "");
const GUILD_ID = process.env.DISCORD_GUILD_ID ?? ""; // 멤버 이탈/재가입 감지 대상 길드(설정 시 그 길드만 처리)
const DEFAULT_SECRET = "blockcanvas-discord-secret";
const SECRET = process.env.DISCORD_API_SECRET ?? DEFAULT_SECRET;

if (!TOKEN) {
  console.error("DISCORD_BOT_TOKEN 이 설정되지 않았습니다. bot/.env 를 확인하세요.");
  process.exit(1);
}

// 기본(공개) 시크릿/너무 짧은 키로는 웹이 위조를 막을 수 없다 — 봇도 fail-closed 로 기동을 거부한다
// (웹 lib/discordApiSecret.ts 와 동일 규약). 개발(NODE_ENV!=='production')에서는 경고만.
if (SECRET === DEFAULT_SECRET || SECRET.length < 16) {
  if (process.env.NODE_ENV === "production") {
    console.error(
      "DISCORD_API_SECRET 이 미설정/기본값/너무 짧습니다 — 운영에서는 강력한 무작위 키(>=16자)가 필수입니다(웹 DISCORD_API_SECRET 과 동일값). bot/.env 를 확인하세요."
    );
    process.exit(1);
  }
  console.warn("[bot] DISCORD_API_SECRET 이 기본값/미설정/짧음입니다 — 개발 전용. 운영에선 강력한 무작위 키(>=16자) 필수.");
}

/** 웹 인바운드 API 와 동일한 HMAC 서명: HMAC-SHA256(`${timestamp}.${body}`). */
function sign(timestamp: string, body: string): string {
  return crypto.createHmac("sha256", SECRET).update(`${timestamp}.${body}`).digest("hex");
}

interface WebResponse {
  status: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: any;
}

async function postToWeb(path: string, payload: unknown): Promise<WebResponse> {
  const body = JSON.stringify(payload);
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const res = await fetch(`${WEB_API_URL}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Timestamp": timestamp,
      "X-Signature": sign(timestamp, body),
    },
    body,
  });
  let data: unknown = null;
  try {
    data = await res.json();
  } catch {
    /* 비 JSON 응답 */
  }
  return { status: res.status, data };
}

type ImageResult = { ok: true; buffer: Buffer } | { ok: false; status: number; message?: string };

/** 이미지(PNG) 응답 전용 — 서명 POST 후 image/* 면 버퍼, 아니면 JSON 에러(message/error)를 돌려준다. */
async function postToWebImage(path: string, payload: unknown): Promise<ImageResult> {
  const body = JSON.stringify(payload);
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const res = await fetch(`${WEB_API_URL}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Timestamp": timestamp,
      "X-Signature": sign(timestamp, body),
    },
    body,
    // 웹/터널이 응답을 멈춰도 봇이 무한 대기(요청 적체)하지 않도록 상한. abort 는 상위 catch 가 처리.
    signal: AbortSignal.timeout(15000),
  });
  const contentType = res.headers.get("content-type") ?? "";
  if (res.ok && contentType.includes("image/")) {
    return { ok: true, buffer: Buffer.from(await res.arrayBuffer()) };
  }
  let message: string | undefined;
  try {
    const j = (await res.json()) as { message?: string; error?: string } | null;
    message = j?.message ?? j?.error;
  } catch {
    /* 비 JSON 응답 */
  }
  return { ok: false, status: res.status, message };
}

// Discord 역할 ID → 웹 role 매핑(.env 에서 지정, 미설정 항목은 무시).
// 우선순위: 배열 앞쪽(official)이 높음 — 멤버가 여러 역할을 가지면 가장 높은 것을 적용.
// ⚠️ admin 은 의도적으로 제외(웹 관리자 권한은 어드민 패널에서만 — 권한 상승 차단).
const ROLE_MAP: { roleId: string; web: string }[] = [
  { roleId: process.env.DISCORD_ROLE_OFFICIAL ?? "", web: "official" },
  { roleId: process.env.DISCORD_ROLE_CREATOR ?? "", web: "creator" },
].filter((r) => r.roleId);

/** 멤버의 현재 역할 집합에서 가장 높은 웹 role 을 도출(매칭 없으면 'user'). */
function resolveWebRole(roleIds: Set<string>): string {
  for (const { roleId, web } of ROLE_MAP) {
    if (roleIds.has(roleId)) return web;
  }
  return "user";
}

const client = new Client({
  // GuildMembers 는 **PRIVILEGED** intent — 개발자 포털에서 활성화해야 한다. 멤버 이탈/재가입
  //   (GuildMemberRemove/Add)을 실시간 감지해 건축 권한을 자동 회수/복구하는 데 필요하다.
  // GuildModeration 은 비-privileged. 역할 변경은 감사 로그 이벤트로 감지한다(봇에 "감사 로그 보기" 권한 필요).
  // GuildMessageReactions: 갤러리 포럼 글 👍 반응 카운트용(비-privileged).
  // Partials: 캐시되지 않은 포럼 시작 메시지/반응에도 이벤트가 전달되도록.
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildModeration,
    GatewayIntentBits.GuildMessageReactions,
  ],
  partials: [Partials.Message, Partials.Channel, Partials.Reaction, Partials.User],
});

client.once(Events.ClientReady, (c) => {
  console.log(`BlockCanvas 봇 준비 완료: ${c.user.tag}`);
  if (ROLE_MAP.length === 0) {
    console.warn("DISCORD_ROLE_* 매핑이 비어 역할 자동 동기화가 비활성화됩니다. bot/.env 를 확인하세요.");
  }
});

// 3중 역할 동기화 1티어: **감사 로그**로 역할 변경(MEMBER_ROLE_UPDATE)을 감지 →
// 대상 멤버를 단건 REST 조회해 현재 역할을 도출 → 웹에 알림(웹이 다시 마크 서버로 전파).
// privileged 인텐트 불필요. 봇은 미연동 계정이면 웹에서 조용히 no-op.
client.on(Events.GuildAuditLogEntryCreate, async (entry, guild) => {
  if (ROLE_MAP.length === 0) return;
  if (entry.action !== AuditLogEvent.MemberRoleUpdate) return;
  const targetId = entry.targetId;
  if (!targetId) return;

  try {
    // 단건 멤버 조회는 REST 라 privileged(GuildMembers) 인텐트가 필요 없다(전체 fetch 와 다름).
    const member = await guild.members.fetch(targetId);
    const role = resolveWebRole(new Set(member.roles.cache.keys()));
    const { status } = await postToWeb("/api/discord/role", { discord_id: targetId, role });
    if (status === 200) {
      console.log(`역할 동기화: ${member.user.tag} → ${role}`);
    } else {
      console.warn(`역할 동기화 실패(${status}): ${targetId} → ${role}`);
    }
  } catch (e) {
    console.error("역할 동기화 오류:", e);
  }
});

// 길드 멤버 이탈/재가입 → 웹에 통지해 인게임 건축권한(builder) + 웹 건축 대시보드 접근을 자동 회수/복구.
//   - GuildMemberRemove: 자발적 이탈·추방(kick)·차단(ban) 모두 공통 발화 → in_guild=false(강등).
//   - GuildMemberAdd: 재가입 → in_guild=true(3종 인증 충족 시 자동 복구).
//   둘 다 PRIVILEGED GuildMembers 인텐트가 있어야 전달된다. 웹은 미연동 계정이면 조용히 no-op.
//   봇 오프라인 중 놓친 이탈은 웹의 정기 재조정 스윕(discordGuildSweep)이 최종 정리한다.
async function reportGuildMembership(userId: string, guildId: string, inGuild: boolean) {
  if (GUILD_ID && guildId !== GUILD_ID) return; // 대상 길드만(멀티 길드 봇 보호)
  try {
    const { status } = await postToWeb("/api/discord/membership", { discord_id: userId, in_guild: inGuild });
    if (status === 200) {
      console.log(`멤버십 동기화: ${userId} in_guild=${inGuild}`);
    } else {
      console.warn(`멤버십 동기화 실패(${status}): ${userId} in_guild=${inGuild}`);
    }
  } catch (e) {
    console.error("멤버십 동기화 오류:", e);
  }
}
client.on(Events.GuildMemberRemove, (member) => {
  void reportGuildMembership(member.id, member.guild.id, false);
});
client.on(Events.GuildMemberAdd, (member) => {
  void reportGuildMembership(member.id, member.guild.id, true);
});

// 갤러리 포럼 글의 👍 반응 → 웹에 전달. 👍(:thumbsup:)만 인식, 봇 자기 반응 무시.
// 카운트/보상/게이트(웹 회원·작성자 제외·고유 원장)는 웹(/api/gallery/reaction)에서 처리한다.
async function handleGalleryReaction(
  reaction: MessageReaction | PartialMessageReaction,
  user: User | PartialUser,
  added: boolean,
) {
  try {
    if (user.bot) return;
    if (reaction.partial) {
      try {
        await reaction.fetch();
      } catch {
        return; // 삭제된 메시지 등
      }
    }
    if (reaction.emoji.name !== "👍") return; // :thumbsup: 만 인식
    const messageId = reaction.message.id;
    if (!messageId) return;
    // 일반 포럼 게시물 반응 보상(전시관 등)용: 글 작성자 + 채널/부모 포럼 채널 id 도 함께 전송(best-effort).
    // (블루프린트 갤러리 반응은 message_id 만으로도 동작하므로 여기 실패해도 무방)
    let messageAuthorId: string | null = null;
    let channelId: string | null = reaction.message.channelId ?? null;
    let parentId: string | null = null;
    try {
      const m = reaction.message.partial ? await reaction.message.fetch() : reaction.message;
      messageAuthorId = m.author?.id ?? null;
      channelId = m.channelId ?? channelId;
      const ch = m.channel ?? (channelId ? await client.channels.fetch(channelId).catch(() => null) : null);
      parentId = (ch as { parentId?: string | null } | null)?.parentId ?? null;
    } catch {
      /* best-effort */
    }
    await postToWeb("/api/gallery/reaction", { message_id: messageId, user_id: user.id, added, message_author_id: messageAuthorId, channel_id: channelId, parent_id: parentId });
  } catch (e) {
    console.error("갤러리 반응 동기화 오류:", e);
  }
}
client.on(Events.MessageReactionAdd, (reaction, user) => {
  void handleGalleryReaction(reaction, user, true);
});
client.on(Events.MessageReactionRemove, (reaction, user) => {
  void handleGalleryReaction(reaction, user, false);
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return;
  try {
    switch (interaction.commandName) {
      case "홍보":
        await handlePromote(interaction, "홍보");
        break;
      case "판매":
        await handlePromote(interaction, "판매");
        break;
      case "내정보":
        await handleMyInfo(interaction);
        break;
    }
  } catch (err) {
    console.error("명령 처리 오류:", err);
    const msg = "처리 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.";
    if (interaction.deferred || interaction.replied) {
      await interaction.editReply(msg).catch(() => {});
    } else {
      await interaction.reply({ content: msg, flags: MessageFlags.Ephemeral }).catch(() => {});
    }
  }
});

async function handlePromote(interaction: ChatInputCommandInteraction, kind: "홍보" | "판매") {
  const plotId = interaction.options.getString("플롯", true).trim();
  await interaction.deferReply();

  const { status, data } = await postToWeb("/api/discord/plot", {
    discord_id: interaction.user.id,
    plot_id: plotId,
  });

  if (status !== 200 || !data?.plot) {
    const msg =
      status === 404
        ? data?.error ?? "플롯 또는 연동 정보를 찾을 수 없습니다."
        : status === 403
        ? "본인이 소유한 플롯만 홍보/판매할 수 있습니다."
        : `요청에 실패했습니다. (오류 코드: ${status})`;
    await interaction.editReply({ content: `❌ ${msg}` });
    return;
  }

  const p = data.plot;
  const title = kind === "판매" ? `🏷️ 영토 판매 — ${p.alias || p.id}` : `📢 영토 홍보 — ${p.alias || p.id}`;
  const embed = new EmbedBuilder()
    .setTitle(title)
    .setColor(kind === "판매" ? 0xf59e0b : 0x6366f1)
    .addFields(
      { name: "소유자", value: String(p.ownerName ?? p.creatorName ?? "-"), inline: true },
      { name: "월드", value: String(p.world ?? "-"), inline: true },
      { name: "플롯 ID", value: `\`${p.id}\``, inline: true },
      { name: "멤버", value: `초대 ${p.trustedCount ?? 0} · 임시 ${p.memberCount ?? 0}`, inline: true },
    )
    .setFooter({ text: `요청자: ${interaction.user.username}` })
    .setTimestamp();

  if (p.x !== null && p.x !== undefined && p.z !== null && p.z !== undefined) {
    embed.addFields({ name: "좌표", value: `${p.x}, ${p.z}`, inline: true });
  }
  if (p.mapUrl) {
    embed.addFields({ name: "라이브 지도", value: `[Dynmap 에서 보기](${p.mapUrl})` });
  }

  await interaction.editReply({ embeds: [embed] });
}

// /내정보 — 본인의 통합 프로필 카드(영토·월드·코인·클라우드)를 이미지로 표시.
// 코인·클라우드 용량은 민감할 수 있어 ephemeral(본인만 보임)로 응답한다.
//   ※ 채널에 공개(MEE6식 자랑)하려면 아래 deferReply 의 flags 를 제거하면 된다.
async function handleMyInfo(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const result = await postToWebImage("/api/discord/info-card", {
    discord_id: interaction.user.id,
  });

  if (!result.ok) {
    const msg =
      result.status === 404
        ? result.message ?? "계정 연동이 필요합니다. 웹 대시보드에서 먼저 연동해주세요."
        : `카드를 불러오지 못했습니다. 잠시 후 다시 시도해주세요. (오류 코드: ${result.status})`;
    await interaction.editReply({ content: `❌ ${msg}` });
    return;
  }

  const file = new AttachmentBuilder(result.buffer, { name: "info-card.png" });
  await interaction.editReply({ files: [file] });
}

client.login(TOKEN);
