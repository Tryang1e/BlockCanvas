import "dotenv/config";
import { REST, Routes, SlashCommandBuilder } from "discord.js";

const TOKEN = process.env.DISCORD_BOT_TOKEN ?? "";
const CLIENT_ID = process.env.DISCORD_CLIENT_ID ?? "";
const GUILD_ID = process.env.DISCORD_GUILD_ID ?? "";

if (!TOKEN || !CLIENT_ID) {
  console.error("DISCORD_BOT_TOKEN / DISCORD_CLIENT_ID 가 필요합니다. bot/.env 를 확인하세요.");
  process.exit(1);
}

const commands = [
  new SlashCommandBuilder()
    .setName("홍보")
    .setDescription("내 영토를 이 채널에 홍보합니다.")
    .addStringOption((o) => o.setName("플롯").setDescription("플롯 ID (예: 1;2)").setRequired(true)),
  new SlashCommandBuilder()
    .setName("판매")
    .setDescription("내 영토를 판매글로 이 채널에 게시합니다.")
    .addStringOption((o) => o.setName("플롯").setDescription("플롯 ID (예: 1;2)").setRequired(true)),
  new SlashCommandBuilder()
    .setName("내정보")
    .setDescription("내 프로필(영토·월드·코인·클라우드)을 카드로 확인합니다."),
].map((c) => c.toJSON());

const rest = new REST({ version: "10" }).setToken(TOKEN);

async function main() {
  try {
    if (GUILD_ID) {
      await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body: commands });
      console.log(`길드(${GUILD_ID})에 슬래시 명령 ${commands.length}개 등록 완료 (즉시 반영).`);
    } else {
      await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
      console.log(`글로벌 슬래시 명령 ${commands.length}개 등록 완료 (반영까지 최대 1시간).`);
    }
  } catch (err) {
    console.error("명령 등록 실패:", err);
    process.exit(1);
  }
}

main();
