/**
 * Profile.discord_id 오염값 정리 (OAuth 신원 컬럼 분리).
 *
 * 배경: 예전 프로필 설정 폼이 자유입력 Discord 값을 OAuth 전용 컬럼 Profile.discord_id 에
 *       그대로 써서, 다수 계정의 discord_id 가 'redstone#9999' 같은 비(非)스노우플레이크
 *       텍스트로 오염됨(역할 동기화/플롯 조회가 깨짐). 매핑/폼은 분리 수정됨.
 *
 * 이 스크립트:
 *   1) discord_id 가 숫자 스노우플레이크가 아닌(=수동 입력) 계정에 대해,
 *      값이 있으면 portfolio.sns_settings.discordHandle 로 '표시용 연락처'로 이전(보존).
 *   2) Profile.discord_id 를 null 로 비워 OAuth 신원 컬럼을 깨끗이 한다.
 *   숫자 discord_id(진짜 OAuth 연동)는 건드리지 않는다.
 *
 * 실행: npx tsx scripts/migrate-discord-id-cleanup.ts   (idempotent, 재실행 안전)
 */
import { PrismaClient } from '@prisma/client'
import { PrismaLibSql } from '@prisma/adapter-libsql'
import path from 'path'

const adapter = new PrismaLibSql({ url: 'file:' + path.join(process.cwd(), 'dev.db') })
const prisma = new PrismaClient({ adapter })

const isSnowflake = (s: string) => /^[0-9]{15,21}$/.test(s)

async function main() {
  const profiles = await prisma.profile.findMany({
    where: { discord_id: { not: null } },
    select: { id: true, creator_name: true, discord_id: true },
  })

  let moved = 0
  let cleared = 0
  for (const p of profiles) {
    const raw = p.discord_id || ''
    if (isSnowflake(raw)) {
      console.log(`= ${p.creator_name}: 숫자 discord_id 유지 (진짜 OAuth 연동)`)
      continue
    }

    // 1) 자유텍스트 → 표시용 연락처(sns_settings.discordHandle) 보존
    const handle = raw.trim()
    if (handle) {
      const portfolio = await prisma.portfolio.findUnique({ where: { creator_id: p.id } })
      if (portfolio) {
        let sns: Record<string, unknown> = {}
        try { sns = JSON.parse(portfolio.sns_settings || '{}') } catch { sns = {} }
        if (!sns.discordHandle) {
          sns.discordHandle = handle
          await prisma.portfolio.update({
            where: { creator_id: p.id },
            data: { sns_settings: JSON.stringify(sns) },
          })
          moved++
          console.log(`✓ ${p.creator_name}: discord_id "${raw}" → sns_settings.discordHandle 이전 (노출토글=${sns.discord === true ? 'ON' : 'OFF'})`)
        } else {
          console.log(`= ${p.creator_name}: 이미 discordHandle="${String(sns.discordHandle)}" 존재 — 이전 생략`)
        }
      } else {
        console.log(`· ${p.creator_name}: 포트폴리오 없음(표시중 아니었음) — 핸들 이전 생략`)
      }
    } else {
      console.log(`· ${p.creator_name}: 빈 discord_id — 이전할 값 없음`)
    }

    // 2) OAuth 신원 컬럼 비우기
    await prisma.profile.update({ where: { id: p.id }, data: { discord_id: null } })
    cleared++
    console.log(`  ↳ ${p.creator_name}: Profile.discord_id 비움`)
  }

  console.log(`\n완료: 핸들 이전 ${moved}건 · discord_id 정리 ${cleared}건 / 전체 ${profiles.length}건`)
  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error(e)
  await prisma.$disconnect()
  process.exit(1)
})
