// 프로세스 단위 인메모리 레이트리밋 (로그인/OTP 무차별 대입 완화).
// 단일 인스턴스(next start) 기준으로 동작하며 서버 재시작 시 초기화된다.
const hits = new Map<string, number[]>()

/**
 * key 기준으로 windowMs 동안 maxCount 회까지 허용한다. 초과 시 false.
 */
export function rateLimit(key: string, maxCount: number, windowMs: number): boolean {
  if (!key) return true
  const now = Date.now()
  const arr = (hits.get(key) || []).filter((t) => now - t < windowMs)
  if (arr.length >= maxCount) {
    hits.set(key, arr)
    return false
  }
  arr.push(now)
  hits.set(key, arr)
  // 맵 비대화 방지
  if (hits.size > 10000) {
    for (const [k, v] of hits) {
      if (v.every((t) => now - t >= windowMs)) hits.delete(k)
    }
  }
  return true
}
