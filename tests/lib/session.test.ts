import { test, describe, before } from 'node:test'
import assert from 'node:assert/strict'

// session.ts 의 getSessionSecret 은 호출 시점에 env 를 읽으므로, import 전에 설정해 둔다.
process.env.SESSION_SECRET = 'test-secret-must-be-at-least-32-characters-long'

import { signSession, verifySession, SESSION_TTL_MS } from '../../src/lib/session.ts'

describe('signSession / verifySession', () => {
  test('서명한 토큰은 name.expiry.signature 3파트 구조', () => {
    const token = signSession('Alice')
    assert.equal(token.split('.').length, 3)
  })

  test('정상 토큰은 소문자화된 creatorName 을 돌려준다', () => {
    const token = signSession('Alice')
    assert.equal(verifySession(token), 'alice')
  })

  test('빈 입력은 빈 토큰 -> verify 시 null', () => {
    assert.equal(signSession(''), '')
    assert.equal(verifySession(''), null)
    assert.equal(verifySession(undefined), null)
  })

  test('서명 변조 토큰은 거부', () => {
    const token = signSession('bob')
    const tampered = token.slice(0, -2) + (token.endsWith('aa') ? 'bb' : 'aa')
    assert.equal(verifySession(tampered), null)
  })

  test('만료시각 변조(연장) 토큰은 서명 불일치로 거부', () => {
    const token = signSession('bob')
    const [name, , sig] = token.split('.')
    const farFuture = Date.now() + 10 * SESSION_TTL_MS
    const forged = `${name}.${farFuture}.${sig}`
    assert.equal(verifySession(forged), null)
  })

  test('만료된 토큰은 거부 (음수 TTL)', () => {
    const expired = signSession('bob', -1000)
    assert.equal(verifySession(expired), null)
  })

  test('구버전 2파트 토큰(name.signature)은 무효 -> 재로그인 유도', () => {
    // 만료 없는 옛 형식 모사
    assert.equal(verifySession('alice.somesignature'), null)
  })

  test('creator_name 에 "."이 있어도 안전하게 라운드트립', () => {
    const token = signSession('my.name')
    assert.equal(verifySession(token), 'my.name')
  })

  test('2FA 임시 토큰 접미사(:temp_2fa) 라운드트립', () => {
    const token = signSession('alice:temp_2fa', 5 * 60 * 1000)
    const decoded = verifySession(token)
    assert.equal(decoded, 'alice:temp_2fa')
    assert.ok(decoded?.endsWith(':temp_2fa'))
  })

  test('커스텀 TTL 이 만료 계산에 반영된다', () => {
    const shortLived = signSession('alice', 1000) // 1s
    const expiryStr = shortLived.split('.')[1]
    const expiry = Number(expiryStr)
    const delta = expiry - Date.now()
    assert.ok(delta > 0 && delta <= 1000, `expiry delta ${delta} 가 (0, 1000] 범위여야 함`)
  })
})
