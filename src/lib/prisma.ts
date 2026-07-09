import { PrismaClient } from '@prisma/client'
import { PrismaLibSql } from '@prisma/adapter-libsql'
import path from 'path'
import { installProcessGuards } from './processGuards'

const adapter = new PrismaLibSql({
  url: 'file:' + path.join(process.cwd(), 'dev.db'),
})

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
  __sqlitePragmas: boolean | undefined
}

export const prisma =
  new PrismaClient({
    adapter,
    // 운영 환경에서는 쿼리(매개변수 값 포함)를 로그에 남기지 않는다. 개발에서만 상세 로깅.
    log: process.env.NODE_ENV === 'production' ? ['error'] : ['query', 'error', 'warn'],
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma

// 프로세스 크래시 관측 핸들러 등록(Node 런타임·1회). 크래시 의미는 유지하고 로그/경보만 추가.
installProcessGuards()

// SQLite 내구성/동시성 튜닝(best-effort) — 프로세스당 1회.
//   • WAL: 동시 읽기 향상 + 쓰기 원자성(크래시 시 절반쓰기 방지). DB 파일에 영속되는 설정.
//   • busy_timeout: 쓰기 경합 시 즉시 SQLITE_BUSY 로 실패하지 않고 최대 5s 대기 → 일시적 경합 흡수.
// libsql 어댑터가 raw PRAGMA 를 지원하지 않으면 조용히 무시된다(무해). 핫리로드 중복 실행은 플래그로 방지.
if (!globalForPrisma.__sqlitePragmas) {
  globalForPrisma.__sqlitePragmas = true
  void (async () => {
    try { await prisma.$queryRawUnsafe('PRAGMA journal_mode = WAL') } catch { /* 미지원/무시 */ }
    try { await prisma.$executeRawUnsafe('PRAGMA busy_timeout = 5000') } catch { /* 미지원/무시 */ }
  })()
}
