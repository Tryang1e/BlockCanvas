import { test, describe, mock, afterEach } from 'node:test'
import assert from 'node:assert/strict'

// 임계값은 모듈 로드시 1회 계산되므로, import 전에 LOG_LEVEL 을 고정한다.
// (node:test 는 각 테스트 파일을 별도 프로세스로 실행하므로 다른 테스트에 영향 없음)
process.env.LOG_LEVEL = 'warn'
const { logger } = await import('../../src/lib/logger.ts')

describe('logger (LOG_LEVEL=warn)', () => {
  afterEach(() => mock.restoreAll())

  test('임계값(warn) 미만인 debug/info 는 출력되지 않는다', () => {
    const log = mock.method(console, 'log', () => {})
    const info = mock.method(console, 'info', () => {})
    logger.debug('hidden')
    logger.info('hidden')
    assert.equal(log.mock.callCount(), 0)
    assert.equal(info.mock.callCount(), 0)
  })

  test('임계값 이상인 warn/error 는 출력된다', () => {
    const warn = mock.method(console, 'warn', () => {})
    const error = mock.method(console, 'error', () => {})
    logger.warn('shown')
    logger.error('shown')
    assert.equal(warn.mock.callCount(), 1)
    assert.equal(error.mock.callCount(), 1)
  })

  test('레벨 태그와 추가 인자를 함께 전달한다', () => {
    const error = mock.method(console, 'error', () => {})
    logger.error('msg', { detail: 1 })
    assert.deepEqual(error.mock.calls[0].arguments, ['[ERROR]', 'msg', { detail: 1 }])
  })
})
