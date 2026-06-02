'use client'

import { useState } from 'react'
import { generate2faSetupAction, enable2faAction, disable2faAction } from '@/app/actions/auth'

interface TwoFactorAuthSettingsProps {
  creatorName: string
  is2faEnabled: boolean
}

export default function TwoFactorAuthSettings({ creatorName, is2faEnabled }: TwoFactorAuthSettingsProps) {
  const [enabled, setEnabled] = useState(is2faEnabled)
  const [isSetupOpen, setIsSetupOpen] = useState(false)
  const [isDisableOpen, setIsDisableOpen] = useState(false)
  
  // Setup state
  const [secret, setSecret] = useState('')
  const [otpauthUrl, setOtpauthUrl] = useState('')
  const [code, setCode] = useState('')
  const [setupError, setSetupError] = useState('')
  const [setupSuccess, setSetupSuccess] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  // Disable state
  const [password, setPassword] = useState('')
  const [disableCode, setDisableCode] = useState('')
  const [disableError, setDisableError] = useState('')

  // Copy secret helper
  const [copied, setCopied] = useState(false)
  const handleCopy = () => {
    navigator.clipboard.writeText(secret)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // Handle open setup modal
  const handleStartSetup = async () => {
    setIsLoading(true)
    setSetupError('')
    setSetupSuccess('')
    setCode('')
    try {
      const res = await generate2faSetupAction(creatorName)
      if (res.error) {
        setSetupError(res.error)
      } else if (res.secret && res.otpauthUrl) {
        setSecret(res.secret)
        setOtpauthUrl(res.otpauthUrl)
        setIsSetupOpen(true)
      }
    } catch (e) {
      setSetupError('2FA 정보를 불러오는 데 실패했습니다.')
    }
    setIsLoading(false)
  }

  // Handle verify & enable
  const handleEnable = async (e: React.FormEvent) => {
    e.preventDefault()
    if (code.length !== 6 || isNaN(Number(code))) {
      setSetupError('6자리 숫자 코드를 정확히 입력하세요.')
      return
    }
    setIsLoading(true)
    setSetupError('')
    try {
      const res = await enable2faAction(creatorName, code, secret)
      if (res.error) {
        setSetupError(res.error)
      } else {
        setSetupSuccess('Google Authenticator 2FA 보안 설정이 완벽하게 활성화되었습니다.')
        setEnabled(true)
        setTimeout(() => {
          setIsSetupOpen(false)
          setSetupSuccess('')
          setCode('')
          setSecret('')
          setOtpauthUrl('')
        }, 1500)
      }
    } catch (e) {
      setSetupError('인증 과정 중 서버 통신 에러가 발생했습니다.')
    }
    setIsLoading(false)
  }

  // Handle verify & disable
  const handleDisable = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setDisableError('')
    try {
      const res = await disable2faAction(creatorName, password, disableCode)
      if (res.error) {
        setDisableError(res.error)
      } else {
        setEnabled(false)
        setIsDisableOpen(false)
        setPassword('')
        setDisableCode('')
        alert('2FA 보안 설정이 성공적으로 비활성화되었습니다.')
      }
    } catch (e) {
      setDisableError('처리 중 서버 통신 에러가 발생했습니다.')
    }
    setIsLoading(false)
  }

  return (
    <section className="pt-6 border-t border-neutral-100">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-lg font-bold text-neutral-900 flex items-center gap-2">
            <span>Google Authenticator (2차 OTP 보안 인증)</span>
            {enabled ? (
              <span className="text-[10px] bg-emerald-50 text-emerald-600 border border-emerald-200/50 px-2 py-0.5 rounded-full font-bold select-none">
                보안 활성화 중
              </span>
            ) : (
              <span className="text-[10px] bg-neutral-100 text-neutral-500 border border-neutral-200/50 px-2 py-0.5 rounded-full font-bold select-none">
                비활성 상태
              </span>
            )}
          </h2>
          <p className="text-sm text-neutral-500 mt-1 max-w-xl leading-relaxed">
            로그인 시 스마트폰의 Google Authenticator 앱에서 제공하는 6자리 일회용 비밀번호(TOTP)를 필수로 요구하여 계정 무단 점유 및 탈취 시도를 완전히 무력화합니다.
          </p>
        </div>

        <div>
          {!enabled ? (
            <button
              onClick={handleStartSetup}
              disabled={isLoading}
              className="text-sm font-bold text-white bg-neutral-900 hover:bg-black px-4 py-2.5 rounded-lg shadow-sm transition-colors whitespace-nowrap disabled:opacity-50"
            >
              {isLoading ? '준비 중...' : '2FA 인증 설정'}
            </button>
          ) : (
            <button
              onClick={() => setIsDisableOpen(true)}
              className="text-sm font-bold text-red-600 bg-red-50 hover:bg-red-100 px-4 py-2.5 rounded-lg transition-colors whitespace-nowrap"
            >
              2FA 보안 해제
            </button>
          )}
        </div>
      </div>

      {/* 🔮 2FA 활성화 설정 모달 (Modal) */}
      {isSetupOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="w-full max-w-[480px] bg-white rounded-3xl p-6 sm:p-8 border border-neutral-200 shadow-2xl animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-black text-neutral-900 flex items-center gap-2">
                <svg className="w-5 h-5 text-neutral-800" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                2단계 OTP 설정하기
              </h3>
              <button 
                onClick={() => setIsSetupOpen(false)}
                className="text-neutral-400 hover:text-neutral-600 p-1.5 hover:bg-neutral-100 rounded-full transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {setupError && (
              <div className="p-3 mb-4 text-xs font-semibold text-rose-600 bg-rose-50 border border-rose-100 rounded-xl text-center">
                {setupError}
              </div>
            )}

            {setupSuccess && (
              <div className="p-3 mb-4 text-xs font-semibold text-emerald-600 bg-emerald-50 border border-emerald-100 rounded-xl text-center">
                {setupSuccess}
              </div>
            )}

            <div className="space-y-6">
              {/* Step 1: 안내 */}
              <div className="text-xs text-neutral-500 leading-relaxed bg-neutral-50 p-4 rounded-2xl border border-neutral-100">
                <p className="font-bold text-neutral-800 mb-1">💡 연동 안내:</p>
                1. 스마트폰에서 <strong>Google Authenticator</strong> 앱을 다운로드 및 설치합니다.<br />
                2. 아래의 QR 코드를 카메라로 스캔하거나, Secret Key를 직접 수동 등록합니다.
              </div>

              {/* Step 2: QR Code */}
              {otpauthUrl && (
                <div className="flex flex-col items-center justify-center p-4 border border-neutral-100 bg-neutral-50/50 rounded-2xl">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(otpauthUrl)}`}
                    alt="2FA QR Code"
                    width={180}
                    height={180}
                    className="bg-white p-2.5 rounded-xl border border-neutral-200 shadow-sm"
                  />
                  <span className="text-[10px] text-neutral-400 font-medium mt-2 select-none">스마트폰 OTP 앱으로 촬영하세요</span>
                </div>
              )}

              {/* Step 3: Key display */}
              <div>
                <label className="block text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-1">
                  또는 직접 등록 키 (Secret Key)
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={secret}
                    readOnly
                    className="flex-1 bg-neutral-50 border border-neutral-200 text-xs px-3 py-2.5 rounded-xl select-all outline-none font-mono text-neutral-700"
                  />
                  <button
                    type="button"
                    onClick={handleCopy}
                    className="text-xs font-bold text-neutral-700 bg-neutral-100 border border-neutral-200 hover:bg-neutral-200 px-3.5 rounded-xl transition-all"
                  >
                    {copied ? '복사 완료!' : '복사'}
                  </button>
                </div>
              </div>

              {/* Step 4: Verification Code Input */}
              <form onSubmit={handleEnable} className="border-t border-neutral-100 pt-5">
                <label className="block text-xs font-bold text-neutral-700 mb-2">
                  구글 OTP의 6자리 인증 번호 대조
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/[^0-9]/g, '').slice(0, 6))}
                    placeholder="000000"
                    maxLength={6}
                    required
                    className="flex-1 border border-neutral-200 p-3 rounded-xl bg-neutral-50 focus:bg-white focus:outline-none focus:border-black focus:ring-1 focus:ring-black text-center text-lg font-bold tracking-widest"
                  />
                  <button
                    type="submit"
                    disabled={isLoading || code.length !== 6}
                    className="bg-neutral-900 hover:bg-black text-white text-xs font-bold px-6 rounded-xl transition-colors disabled:opacity-50"
                  >
                    {isLoading ? '검증 중...' : '검증 및 등록'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* ⚠️ 2FA 비활성화 해제 모달 (Disable Modal) */}
      {isDisableOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="w-full max-w-[420px] bg-white rounded-3xl p-6 sm:p-8 border border-neutral-200 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center mb-5">
              <h3 className="text-lg font-bold text-red-600 flex items-center gap-2">
                ⚠️ 2차 보안인증 해제 요청
              </h3>
              <button 
                onClick={() => { setIsDisableOpen(false); setDisableError(''); setPassword(''); setDisableCode(''); }}
                className="text-neutral-400 hover:text-neutral-600 p-1.5 hover:bg-neutral-100 rounded-full transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {disableError && (
              <div className="p-3 mb-4 text-xs font-semibold text-rose-600 bg-rose-50 border border-rose-100 rounded-xl text-center">
                {disableError}
              </div>
            )}

            <p className="text-xs text-neutral-500 mb-5 leading-relaxed">
              안전한 해제를 위해 크리에이터 <strong>본인 비밀번호</strong>와 <strong>구글 OTP 6자리 코드</strong>를 모두 검증해야 비활성화가 완료됩니다.
            </p>

            <form onSubmit={handleDisable} className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-1">
                  계정 비밀번호
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="현재 비밀번호를 입력해 주세요"
                  required
                  className="w-full border border-neutral-200 p-3 rounded-xl bg-neutral-50 focus:bg-white focus:outline-none focus:border-black focus:ring-1 focus:ring-black text-sm font-medium"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-1">
                  구글 OTP 6자리 번호
                </label>
                <input
                  type="text"
                  value={disableCode}
                  onChange={(e) => setDisableCode(e.target.value.replace(/[^0-9]/g, '').slice(0, 6))}
                  placeholder="000000"
                  maxLength={6}
                  required
                  className="w-full border border-neutral-200 p-3 rounded-xl bg-neutral-50 focus:bg-white focus:outline-none focus:border-black focus:ring-1 focus:ring-black text-center text-base font-bold tracking-widest"
                />
              </div>

              <div className="flex gap-2.5 pt-2">
                <button
                  type="submit"
                  disabled={isLoading || !password || disableCode.length !== 6}
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white text-xs font-bold py-3.5 rounded-xl transition-colors disabled:opacity-50"
                >
                  {isLoading ? '검증 해제 중...' : '보안 해제 실행'}
                </button>
                <button
                  type="button"
                  onClick={() => { setIsDisableOpen(false); setDisableError(''); setPassword(''); setDisableCode(''); }}
                  className="flex-1 bg-white border border-neutral-200 text-neutral-600 hover:bg-neutral-50 text-xs font-bold py-3.5 rounded-xl transition-colors"
                >
                  취소
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  )
}
