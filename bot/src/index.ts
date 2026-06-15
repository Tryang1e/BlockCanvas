import "dotenv/config";
import {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  Events,
  MessageFlags,
  type ChatInputCommandInteraction,
} from "discord.js";
import crypto from "node:crypto";

const TOKEN = process.env.DISCORD_BOT_TOKEN ?? "";
const WEB_API_URL = (process.env.WEB_API_URL ?? "http://localhost:3000").replace(/\/$/, "");
const SECRET = process.env.DISCORD_API_SECRET ?? "blockcanvas-discord-secret";

if (!TOKEN) {
  console.error("DISCORD_BOT_TOKEN 이 설정되지 않았습니다. bot/.env 를 확인하세요.");
  process.exit(1);
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

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once(Events.ClientReady, (c) => {
  console.log(`BlockCanvas 봇 준비 완료: ${c.user.tag}`);
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return;
  try {
    switch (interaction.commandName) {
      case "연동":
        await handleLink(interaction);
        break;
      case "홍보":
        await handlePromote(interaction, "홍보");
        break;
      case "판매":
        await handlePromote(interaction, "판매");
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

async function handleLink(interaction: ChatInputCommandInteraction) {
  const code = interaction.options.getString("코드", true).trim();
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const { status, data } = await postToWeb("/api/discord/link", {
    code,
    discord_id: interaction.user.id,
    discord_username: interaction.user.username,
  });

  if (status === 200) {
    await interaction.editReply(`✅ 웹 계정 **${data?.linkedTo ?? ""}** 와 성공적으로 연동되었습니다!`);
  } else if (status === 404) {
    await interaction.editReply("❌ 잘못되었거나 만료된 연동 코드입니다.");
  } else if (status === 410) {
    await interaction.editReply("❌ 연동 코드 유효시간(10분)이 만료되었습니다. 웹에서 다시 발급해주세요.");
  } else if (status === 409) {
    await interaction.editReply("⚠️ 이 디스코드 계정은 이미 다른 웹 계정에 연동되어 있습니다.");
  } else if (status === 429) {
    await interaction.editReply("⏳ 시도가 너무 많습니다. 잠시 후 다시 시도해주세요.");
  } else {
    await interaction.editReply(`❌ 연동 중 오류가 발생했습니다. (오류 코드: ${status})`);
  }
}

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

client.login(TOKEN);
