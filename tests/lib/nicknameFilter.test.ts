import { test, describe } from 'node:test'
import assert from 'node:assert/strict'

import { validateNickname, NICK_MAX_LEN } from '../../src/lib/nicknameFilter.ts'

describe('validateNickname', () => {
  test('정상 닉네임 통과 + trim 적용', () => {
    assert.equal(validateNickname('건축왕').ok, true)
    assert.equal(validateNickname('건축왕').nick, '건축왕')
    assert.equal(validateNickname('  코딩  ').nick, '코딩') // 앞뒤 공백 제거
    assert.equal(validateNickname('abc12').ok, true)        // 영문+숫자 5자
  })

  test('길이 제한 (2 ~ 5자)', () => {
    assert.equal(validateNickname('가').ok, false)            // 1자 미만
    assert.equal(validateNickname('가나').ok, true)           // 2자
    assert.equal(validateNickname('가나다라마').ok, true)      // 5자
    assert.equal(validateNickname('가나다라마바').ok, false)   // 6자 초과
    assert.equal(NICK_MAX_LEN, 5)
  })

  test('무조건 5자 이내 — 스크립트 무관 6자 이상 거부, 5자 정확히 허용', () => {
    // 한글/영문/숫자/혼합 모두 코드포인트 5자 경계에서 동일하게 끊긴다.
    assert.equal(validateNickname('abcde').ok, true)          // 영문 5자
    assert.equal(validateNickname('abcdef').ok, false)        // 영문 6자
    assert.equal(validateNickname('12345').ok, true)          // 숫자 5자
    assert.equal(validateNickname('123456').ok, false)        // 숫자 6자
    assert.equal(validateNickname('가나abc').ok, true)        // 혼합 5자
    assert.equal(validateNickname('가나ab12').ok, false)      // 혼합 6자
    assert.equal(validateNickname('가나다라마바사').ok, false) // 7자
    // 공백 trim 후 5자 — trim 결과로 길이 측정(앞뒤 공백은 글자 수에 미포함)
    assert.equal(validateNickname('  가나다라마  ').ok, true)
  })

  test('허용 문자셋 — 공백/특수문자/색상코드 거부', () => {
    assert.equal(validateNickname('건축 왕').ok, false)  // 내부 공백
    assert.equal(validateNickname('건축!').ok, false)    // 특수문자
    assert.equal(validateNickname('&a건축').ok, false)   // 색상코드(& 기호)
    assert.equal(validateNickname('건축👍').ok, false)   // 이모지
  })

  test('운영 사칭(예약어) 차단 — 대소문자 무시, 숫자 혼합도 차단', () => {
    assert.equal(validateNickname('관리자').ok, false)
    assert.equal(validateNickname('admin').ok, false)
    assert.equal(validateNickname('ADMIN').ok, false)   // 대문자
    assert.equal(validateNickname('운영자1').ok, false) // 숫자 뒤섞임
  })

  test('정치/논란/혐오/비속어 차단', () => {
    assert.equal(validateNickname('윤석열').ok, false)
    assert.equal(validateNickname('김정은').ok, false)
    assert.equal(validateNickname('시발').ok, false)
    assert.equal(validateNickname('병신').ok, false)
    assert.equal(validateNickname('fuck').ok, false)
  })

  test('숫자 끼워넣기 우회(시1발→시발) 차단', () => {
    assert.equal(validateNickname('시1발').ok, false)
    assert.equal(validateNickname('병8신').ok, false)
  })

  test('금지어를 부분으로 포함해도 차단', () => {
    assert.equal(validateNickname('개새끼').ok, false)
    assert.equal(validateNickname('시발럼').ok, false) // 시발 포함(4자)
  })

  test('빈 입력 거부', () => {
    assert.equal(validateNickname('').ok, false)
    assert.equal(validateNickname('   ').ok, false)
  })
})
