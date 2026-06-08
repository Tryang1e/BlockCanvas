// 프로세스 단위 인메모리 레이트리밋 (로그인/OTP 무차별 대입 완화).
//
// ⚠️ 한계 및 배포 전제:
//   - 단일 인스턴스(next start, 자체 호스팅 + Cloudflare Tunnel) 기준으로만 정확하다.
//   - 카운터가 프로세스 메모리에 있으므로 서버 재시작 시 초기화된다.
//   - 여러 인스턴스로 수평 확장하면 각 인스턴스가 독립 카운터를 갖게 되어 한도가 사실상
//     인스턴스 수만큼 늘어난다. 멀티 인스턴스로 가게 되면 Redis 등 공유 저장소 기반
//     레이트리밋으로 교체해야 한다.
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
