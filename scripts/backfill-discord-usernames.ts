/**
 * 기존 Profile.discord_username 백필 — '표시이름(global_name)'으로 저장돼 있던 값을
 * 실제 '아이디(핸들=user.username)'로 다시 채운다.
 *
 * 배경: discordOAuth.ts 가 예전엔 global_name 을 우선 저장해 어드민 표시가 닉네임으로 떴다.
 *       매핑은 username 우선으로 수정됐고, 이 스크립트가 기존 레코드를 일괄 정정한다.
 *
 * 실행: npx tsx scripts/backfill-discord-usernames.ts
 *   - DB: 루트 dev.db (lib/prisma.ts 와 동일 libsql 어댑터)
 *   - 토큰: bot/.env 의 DISCORD_BOT_TOKEN (Discord GET /users/{id} 조회용)
 *   - idempotent: 이미 핸들이 저장된 계정은 건너뛴다. 안전하게 재실행 가능.
 */
import { PrismaClient } from '@prisma/client'
import { PrismaLibSql } from '@prisma/adapter-libsql'
import path from 'path'
import fs from 'fs'

function loadBotToken(): string {
  const envPath = path.join(process.cwd(), 'bot', '.env')
  const raw = fs.readFileSync(envPath, 'utf8')
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^\s*DISCORD_BOT_TOKEN\s*=\s*(.*)\s*$/)
    if (m) return m[1].replace(/^["']|["']$/g, '').trim()
  }
  throw new Error('DISCORD_BOT_TOKEN 을 bot/.env 에서 찾지 못했습니다.')
}

const TOKEN = loadBotToken()
const adapter = new PrismaLibSql({ url: 'file:' + path.join(process.cwd(), 'dev.db') })
const prisma = new PrismaClient({ adapter })

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

async function fetchDiscordUser(id: string): Promise<{ username: string; global_name: string | null } | null> {
  const res = await fetch(`https://discord.com/api/v10/users/${id}`, {
    headers: { Authorization: `Bot ${TOKEN}` },
  })
  if (res.status === 429) {
    const retry = Number(res.headers.get('retry-after') || '1')
    await sleep((retry + 0.5) * 1000)
    return fetchDiscordUser(id)
  }
  if (!res.ok) {
    console.warn(`  ⚠ ${id} 조회 실패 (HTTP ${res.status})`)
    return null
  }
  const u = await res.json()
  return { username: String(u.username || u.id), global_name: u.global_name ?? null }
}

async function main() {
  const profiles = await prisma.profile.findMany({
    where: { discord_id: { not: null } },
    select: { id: true, creator_name: true, discord_id: true, discord_username: true },
  })
  console.log(`대상 ${profiles.length}명 (discord_id 연동 계정)\n`)

  let updated = 0
  for (const p of profiles) {
    const info = await fetchDiscordUser(p.discord_id!)
    await sleep(300) // Discord rate-limit 여유
    if (!info) continue

    if (info.username === p.discord_username) {
      console.log(`= ${p.creator_name}: 이미 핸들("${info.username}") 저장됨 — 건너뜀`)
      continue
    }
    await prisma.profile.update({ where: { id: p.id }, data: { discord_username: info.username } })
    updated++
    console.log(`✓ ${p.creator_name}: "${p.discord_username}" → "${info.username}" (global_name=${info.global_name ?? '없음'})`)
  }

  console.log(`\n완료: ${updated}건 갱신 / 전체 ${profiles.length}건`)
  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error(e)
  await prisma.$disconnect()
  process.exit(1)
})
