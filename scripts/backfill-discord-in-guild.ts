/**
 * Profile.discord_in_guild 백필 — 신규 컬럼(@default(false)) 도입 시 기존 연동 계정을 정정한다.
 *
 * 배경: discord_in_guild 가 3종 인증 게이트(hasFullVerification)의 필수 조건이 되면서, 이 컬럼이 없던
 *       기존 연동 계정은 전부 false(미인증)로 시작해 **건축권한·웹 대시보드가 일괄 잠긴다.** 이 스크립트가
 *       배포 시점에 각 연동자의 실제 Discord 길드 멤버십을 확인해 flag 를 맞춰 그 잠금을 방지한다.
 *
 * 실행: npx tsx scripts/backfill-discord-in-guild.ts
 *   - DB: 루트 dev.db (lib/prisma.ts 와 동일 libsql 어댑터)
 *   - 토큰/길드: bot/.env 의 DISCORD_BOT_TOKEN · DISCORD_GUILD_ID
 *   - idempotent: 실제 멤버십과 이미 일치하면 건너뛴다. 안전하게 재실행 가능.
 *   - 길드 조회 실패(레이트리밋/네트워크)는 flag 를 건드리지 않고 건너뛴다(잘못된 강등 방지) → 재실행/정기 스윕이 정리.
 *
 * ⚠ 이 스크립트는 DB flag 만 정정한다. 실제 LP 그룹(builder/default) 반영은 배포 후 첫 /api/world/sweep
 *    (discordGuildSweep) 또는 유저 접속(role-sync)에서 evaluateBuildAccess 로 이뤄진다.
 */
import { PrismaClient } from '@prisma/client'
import { PrismaLibSql } from '@prisma/adapter-libsql'
import path from 'path'
import fs from 'fs'

function loadBotEnv(key: string): string {
  const envPath = path.join(process.cwd(), 'bot', '.env')
  const raw = fs.readFileSync(envPath, 'utf8')
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(new RegExp(`^\\s*${key}\\s*=\\s*(.*)\\s*$`))
    if (m) return m[1].replace(/^["']|["']$/g, '').trim()
  }
  throw new Error(`${key} 을(를) bot/.env 에서 찾지 못했습니다.`)
}

const TOKEN = loadBotEnv('DISCORD_BOT_TOKEN')
const GUILD_ID = loadBotEnv('DISCORD_GUILD_ID')
const adapter = new PrismaLibSql({ url: 'file:' + path.join(process.cwd(), 'dev.db') })
const prisma = new PrismaClient({ adapter })

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/** 봇 토큰으로 길드 멤버 여부 확인. 200→true, 404→false, 429→백오프 후 재시도, 그 외→null(건너뜀). */
async function isMember(discordId: string): Promise<boolean | null> {
  const res = await fetch(`https://discord.com/api/v10/guilds/${GUILD_ID}/members/${discordId}`, {
    headers: { Authorization: `Bot ${TOKEN}` },
  })
  if (res.status === 200) return true
  if (res.status === 404) return false
  if (res.status === 429) {
    const retry = Number(res.headers.get('retry-after') || '1')
    await sleep((retry + 0.5) * 1000)
    return isMember(discordId)
  }
  console.warn(`  ⚠ ${discordId} 길드 조회 실패 (HTTP ${res.status}) — 건너뜀`)
  return null
}

async function main() {
  const profiles = await prisma.profile.findMany({
    where: { discord_id: { not: null } },
    select: { id: true, creator_name: true, discord_id: true, discord_in_guild: true },
  })
  console.log(`연동 계정 ${profiles.length}건 검사 시작 (길드 ${GUILD_ID})`)

  let updated = 0
  let skipped = 0
  let errors = 0
  for (const p of profiles) {
    if (!p.discord_id) continue
    const member = await isMember(p.discord_id)
    if (member === null) {
      errors++
    } else if (member !== p.discord_in_guild) {
      await prisma.profile.update({ where: { id: p.id }, data: { discord_in_guild: member } })
      console.log(`  ✔ ${p.creator_name}: discord_in_guild ${p.discord_in_guild} → ${member}`)
      updated++
    } else {
      skipped++
    }
    await sleep(250)
  }

  console.log(`\n완료 — 갱신 ${updated} · 이미일치 ${skipped} · 조회실패(건너뜀) ${errors}`)
  if (updated > 0) {
    console.log(
      '↳ 이 스크립트는 DB flag 만 정정했습니다. 인게임 LP 그룹(builder/default) 반영은 다음 /api/world/sweep\n' +
      '  또는 유저 접속(role-sync) 시 적용됩니다. 즉시 반영하려면 배포 직후 스윕을 1회 수동 호출하세요\n' +
      '  (POST /api/world/sweep, 헤더 x-cron-secret: WORLD_SWEEP_SECRET).'
    )
  }
  await prisma.$disconnect()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
