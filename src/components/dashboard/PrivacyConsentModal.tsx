'use client'

import React, { useState } from 'react'
import { Check, ShieldAlert, Loader2 } from 'lucide-react'
import { acceptPrivacyPolicyAction } from '@/app/actions/profile'

interface PrivacyConsentModalProps {
  creatorName: string
}

export default function PrivacyConsentModal({ creatorName }: PrivacyConsentModalProps) {
  const [isChecked, setIsChecked] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!isChecked || isLoading) return

    setIsLoading(true)
    setError(null)

    try {
      const result = await acceptPrivacyPolicyAction(creatorName)
      if (result?.success) {
        // revalidatePath will handle refresh on the server-rendered layout
      } else {
        setError('동의 처리 중 오류가 발생했습니다. 다시 시도해 주세요.')
        setIsLoading(false)
      }
    } catch (err) {
      console.error(err)
      setError('서버 통신 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.')
      setIsLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-neutral-900/60 backdrop-blur-md p-4 animate-in fade-in duration-300">
      <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl border border-neutral-100 overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-300">
        
        {/* Header */}
        <div className="p-6 border-b border-neutral-100 bg-neutral-50 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-black flex items-center justify-center text-white shrink-0">
            <ShieldAlert size={20} />
          </div>
          <div>
            <h2 className="text-lg font-black text-neutral-900 tracking-tight">개인정보 수집 및 이용 동의</h2>
            <p className="text-xs text-neutral-500 font-medium mt-0.5">
              BlockCanvas 서비스를 원활히 이용하기 위해 최초 1회 필수 동의가 필요합니다.
            </p>
          </div>
        </div>

        {/* Scrollable Terms Content */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-sm text-neutral-700 leading-relaxed scrollbar-thin">
          
          <div className="bg-amber-50 border border-amber-200/80 rounded-xl p-4 text-xs text-amber-800 font-medium space-y-1">
            <span className="font-bold text-amber-900">⚠️ 고지사항 및 안내</span>
            <p>
              대한민국 개인정보 보호법(제15조 등)에 따라 사이트 책임자(운영자)가 제공하는 개인정보 이용 약관입니다.
              동의 내역과 상세 수집 항목은 대시보드 내 [계정 및 보안 관리] 메뉴에서 언제든지 상시 확인 및 열람하실 수 있습니다.
            </p>
          </div>

          {/* Table of collected items */}
          <div className="space-y-2">
            <h3 className="font-bold text-neutral-900 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-black"></span>
              서비스 기능별 개인정보 수집 항목 및 목적
            </h3>
            <div className="border border-neutral-200 rounded-xl overflow-hidden text-xs">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-neutral-50 border-b border-neutral-200 font-bold text-neutral-700">
                    <th className="p-3 w-1/4">서비스 주요 기능</th>
                    <th className="p-3 w-1/3">수집 항목 (필수/선택)</th>
                    <th className="p-3">수집 및 이용 목적</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-200 text-neutral-600 font-medium">
                  <tr>
                    <td className="p-3 bg-neutral-50/30 font-bold">계정 관리 및 인증</td>
                    <td className="p-3">이메일 주소, 비밀번호, 식별자(ID) <span className="text-red-500 font-bold">[필수]</span></td>
                    <td className="p-3">로그인 및 본인 확인, 보안 통지</td>
                  </tr>
                  <tr>
                    <td className="p-3 bg-neutral-50/30 font-bold">포트폴리오 페이지</td>
                    <td className="p-3">표시 이름(닉네임) <span className="text-red-500 font-bold">[필수]</span><br />프로필 사진 URL, 디스코드 ID, SNS 채널 링크 <span className="text-neutral-400">[선택]</span></td>
                    <td className="p-3">하위도메인 개설, 포트폴리오 노출 및 배지 연동</td>
                  </tr>
                  <tr>
                    <td className="p-3 bg-neutral-50/30 font-bold">대시보드 활동 이력</td>
                    <td className="p-3">접속 IP 주소, 쿠키, 로그인 및 조작 로그 <span className="text-red-500 font-bold">[필수]</span></td>
                    <td className="p-3">부정 이용 차단, 비인가 접근 방지, 계정 보안 강화</td>
                  </tr>
                  <tr>
                    <td className="p-3 bg-neutral-50/30 font-bold">방문자 메시지 중개</td>
                    <td className="p-3">발송인 이름, 이메일 주소, 문의 메시지 내용 <span className="text-neutral-400">[선택]</span></td>
                    <td className="p-3">외부 방문자의 크리에이터 연락/접수 및 보관</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Legal Terms Text */}
          <div className="space-y-4 pt-2">
            <h3 className="font-bold text-neutral-900 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-black"></span>
              개인정보 처리 위탁 및 보관 정책 (2026. 06. 03 기준)
            </h3>
            
            <div className="space-y-3 pl-2.5 border-l border-neutral-200 text-xs text-neutral-600">
              <div>
                <p className="font-bold text-neutral-800">1. 개인정보의 보유 및 이용 기간</p>
                <p className="mt-1">
                  크리에이터의 개인정보는 원칙적으로 회원 탈퇴 즉시 또는 수집 목적이 달성되면 즉시 파기합니다.
                  단, 통신비밀보호법 등 관련 법령에 보존 의무가 있는 경우 아래 명시한 기간 동안 분리 보관합니다.
                </p>
                <ul className="list-disc list-inside mt-1 space-y-0.5 text-neutral-500 pl-1">
                  <li>웹사이트 로그인 및 접속 로그: 3개월 보관 (통신비밀보호법)</li>
                  <li>소비자의 불만 또는 분쟁처리에 관한 기록: 3년 보관 (전자상거래법)</li>
                  <li>계약 또는 청약철회 등에 관한 기록: 5년 보관 (전자상거래법)</li>
                </ul>
              </div>

              <div>
                <p className="font-bold text-neutral-800">2. 동의를 거부할 권리 및 불이익 고지</p>
                <p className="mt-1">
                  이용자는 개인정보 수집 및 이용 동의를 거부할 권리가 있습니다. 단, 필수 정보 수집에 동의하지 않을 경우 크리에이터 대시보드 진입 및 포트폴리오 관리 서비스 이용이 불가능합니다.
                  선택 정보 수집 동의를 거부하는 경우에는 관련 부가 서비스(SNS 연동 등) 사용만 제한됩니다.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Action Form Footer */}
        <form onSubmit={handleSubmit} className="p-6 border-t border-neutral-100 bg-neutral-50/50 space-y-4">
          {error && (
            <p className="text-xs text-red-500 font-bold text-center bg-red-50 py-2 rounded-lg border border-red-200/50">
              {error}
            </p>
          )}

          <div className="flex items-start gap-3">
            <button
              type="button"
              onClick={() => setIsChecked(!isChecked)}
              className="mt-0.5 shrink-0 flex items-center justify-center w-5 h-5 rounded border border-neutral-300 bg-white hover:border-black transition-colors focus:outline-none"
              aria-checked={isChecked}
              role="checkbox"
            >
              {isChecked && <Check size={14} className="text-black stroke-[3]" />}
            </button>
            <div className="text-xs text-neutral-600 font-bold select-none cursor-pointer" onClick={() => setIsChecked(!isChecked)}>
              <span>위의 개인정보 수집 및 이용 고지 사항을 충분히 확인하였으며, 이에 동의합니다. (필수)</span>
            </div>
          </div>

          <button
            type="submit"
            disabled={!isChecked || isLoading}
            className={`w-full py-3 px-4 rounded-xl font-bold text-sm text-white transition-all flex items-center justify-center gap-2 ${
              isChecked && !isLoading
                ? 'bg-black hover:bg-neutral-800 shadow-md hover:shadow-lg active:scale-[0.99]'
                : 'bg-neutral-300 cursor-not-allowed'
            }`}
          >
            {isLoading ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                <span>처리 중...</span>
              </>
            ) : (
              <span>동의하고 대시보드 시작하기</span>
            )}
          </button>
        </form>

      </div>
    </div>
  )
}
