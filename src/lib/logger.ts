/**
 * 경량 콘솔 로거 — 자체 호스팅(단일 인스턴스) 환경에서 콘솔이 곧 관제 수단이므로
 * 로그를 유지하되, 레벨로 켜고 끌 수 있게 한다.
 *
 * 레벨 임계값은 환경변수로 제어:
 *   - 서버:  LOG_LEVEL=debug|info|warn|error|silent
 *   - 클라이언트: NEXT_PUBLIC_LOG_LEVEL (Next.js 가 빌드시 인라인하는 NEXT_PUBLIC_* 만 노출됨)
 *   - 미설정 시 기본값은 'debug' (전체 출력) — 운영에서도 모든 로그를 보고 싶다는 정책.
 *
 * 임계값보다 같거나 높은 심각도의 메시지만 출력된다.
 *   예) LOG_LEVEL=info  -> info/warn/error 출력, debug 숨김
 *       LOG_LEVEL=warn  -> warn/error 만 출력
 *       LOG_LEVEL=silent-> 전부 숨김
 */

type Level = 'debug' | 'info' | 'warn' | 'error' | 'silent'

const PRIORITY: Record<Level, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
  silent: 99,
}

function resolveThreshold(): number {
  const raw = (
    process.env.LOG_LEVEL ||
    process.env.NEXT_PUBLIC_LOG_LEVEL ||
    'debug'
  ).toLowerCase()
  const level = (raw in PRIORITY ? raw : 'debug') as Level
  return PRIORITY[level]
}

// 모듈 로드 시 1회 계산(서버 재시작/클라이언트 빌드 기준).
const THRESHOLD = resolveThreshold()

function enabled(level: Exclude<Level, 'silent'>): boolean {
  return PRIORITY[level] >= THRESHOLD
}

export const logger = {
  debug: (...args: unknown[]): void => {
    if (enabled('debug')) console.log('[DEBUG]', ...args)
  },
  info: (...args: unknown[]): void => {
    if (enabled('info')) console.info('[INFO]', ...args)
  },
  warn: (...args: unknown[]): void => {
    if (enabled('warn')) console.warn('[WARN]', ...args)
  },
  error: (...args: unknown[]): void => {
    if (enabled('error')) console.error('[ERROR]', ...args)
  },
}

export type { Level }
