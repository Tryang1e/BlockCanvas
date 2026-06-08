import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { setTimeout as sleep } from 'node:timers/promises'

import { rateLimit } from '../../src/lib/rate-limit.ts'

describe('rateLimit', () => {
  test('윈도 안에서 maxCount 까지는 허용하고 그 다음은 차단', () => {
    const key = 'unit:allow-then-block:' + Math.random()
    assert.equal(rateLimit(key, 3, 60_000), true)  // 1
    assert.equal(rateLimit(key, 3, 60_000), true)  // 2
    assert.equal(rateLimit(key, 3, 60_000), true)  // 3
    assert.equal(rateLimit(key, 3, 60_000), false) // 4 -> 초과
    assert.equal(rateLimit(key, 3, 60_000), false) // 계속 차단
  })

  test('키가 다르면 카운터가 독립적', () => {
    const a = 'unit:keyA:' + Math.random()
    const b = 'unit:keyB:' + Math.random()
    assert.equal(rateLimit(a, 1, 60_000), true)
    assert.equal(rateLimit(a, 1, 60_000), false) // a 소진
    assert.equal(rateLimit(b, 1, 60_000), true)  // b 는 영향 없음
  })

  test('빈 key 는 항상 통과(레이트리밋 미적용)', () => {
    assert.equal(rateLimit('', 1, 60_000), true)
    assert.equal(rateLimit('', 1, 60_000), true)
  })

  test('윈도가 지나면 카운터가 초기화되어 다시 허용', async () => {
    const key = 'unit:window-reset:' + Math.random()
    assert.equal(rateLimit(key, 1, 30), true)
    assert.equal(rateLimit(key, 1, 30), false) // 윈도 내 초과
    await sleep(45)                             // 윈도(30ms) 경과
    assert.equal(rateLimit(key, 1, 30), true)  // 만료된 hit 제거 -> 재허용
  })
})
