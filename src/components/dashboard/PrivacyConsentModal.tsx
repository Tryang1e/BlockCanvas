'use client'

import React, { useState } from 'react'
import { Check, ShieldAlert, Loader2 } from 'lucide-react'
import { acceptPrivacyPolicyAction } from '@/app/actions/profile'

interface PrivacyConsentModalProps {
  creatorName: string
  // 이전에 (구버전 방침에) 동의한 적이 있는 사용자에게는 '재동의' 문구를 노출한다.
  previouslyConsented?: boolean
}

export default function PrivacyConsentModal({ creatorName, previouslyConsented = false }: PrivacyConsentModalProps) {
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
              {previouslyConsented
                ? '개인정보 처리방침이 개정(v4)되었습니다. 서비스를 계속 이용하시려면 변경된 내용에 대한 동의가 필요합니다.'
                : 'BlockCanvas 서비스를 원활히 이용하기 위해 최초 1회 필수 동의가 필요합니다.'}
            </p>
          </div>
        </div>

        {/* Scrollable Terms Content */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-sm text-neutral-700 leading-relaxed scrollbar-thin">
          
          <div className="bg-amber-50 border border-amber-200/80 rounded-xl p-4 text-xs text-amber-800 font-medium space-y-1.5">
            <span className="font-bold text-amber-900">⚠️ 고지사항 및 안내 (개인정보처리방침 v4 · 2026. 07. 10 시행)</span>
            <p>
              대한민국 개인정보 보호법(제15조 등)에 따라 서비스 운영자가 제공하는 개인정보 수집·이용 동의 안내입니다.
              본 동의는 공식 Discord 서버 가입 여부 확인을 통한 건축 이용 자격 부여·회수, Patreon 후원 연동(후원자 인증·구독 혜택), 마인크래프트 서버 연동, Discord/Microsoft 계정 연동, 월드 클라우드·영토(플롯) 기능을 반영한 개정판(v4)을 기준으로 합니다.
              아래 요약 외 전체 항목·국외 이전·보유기간 등 상세 내용은{' '}
              <a href="/privacy" target="_blank" rel="noopener noreferrer" className="font-bold text-amber-900 underline underline-offset-2 hover:text-amber-950">개인정보처리방침 전문</a>에서 확인하실 수 있으며,
              동의 내역은 대시보드 [계정 및 보안 관리] 메뉴에서 상시 열람할 수 있습니다.
            </p>
          </div>

          {/* Non-affiliation disclaimer (Mojang usage guidelines) */}
          <div className="bg-amber-50 border border-amber-200/80 rounded-xl p-4 text-xs text-amber-800 font-medium space-y-1">
            <span className="font-bold text-amber-900">⚠️ 마인크래프트 관련 비제휴 고지 (Non-affiliation Notice)</span>
            <p>
              본 서비스(BlockCanvas)는 Mojang Studios 또는 Microsoft의 공식 마인크래프트 제품·서비스가 아니며, 이들로부터 승인받거나 제휴·후원 관계에 있지 않습니다. &quot;Minecraft&quot;, &quot;Mojang&quot;은 각 사의 상표입니다. 본 서비스는 마인크래프트 정품 계정 보유 여부 확인(본인 인증) 목적으로만 이용자 본인이 직접 수행하는 Microsoft 로그인을 이용하며, 인증 과정의 토큰은 저장하지 않습니다.
            </p>
            <p className="text-[11px] text-amber-700">NOT AN OFFICIAL MINECRAFT PRODUCT. NOT APPROVED BY OR ASSOCIATED WITH MOJANG OR MICROSOFT.</p>
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
                    <td className="p-3 bg-neutral-50/30 font-bold">회원가입·계정 (이메일)</td>
                    <td className="p-3">이메일 주소, 비밀번호(일방향 암호화), 식별자(하위 도메인 ID/creator_name) <span className="text-red-500 font-bold">[필수]</span></td>
                    <td className="p-3">로그인 및 크리에이터 본인 식별·인증, 보안 통지</td>
                  </tr>
                  <tr>
                    <td className="p-3 bg-neutral-50/30 font-bold">Discord 연동</td>
                    <td className="p-3">Discord 계정 고유 ID, Discord 사용자명, 공식 Discord 서버 가입 여부 <span className="text-red-500 font-bold">[필수]</span></td>
                    <td className="p-3">Discord 계정 연동·신원 연결, 서버 가입 여부에 따른 건축 이용 자격 부여·회수</td>
                  </tr>
                  <tr>
                    <td className="p-3 bg-neutral-50/30 font-bold">마인크래프트 정품 인증·연동</td>
                    <td className="p-3">마인크래프트 UUID, 마인크래프트 사용자명 <span className="text-red-500 font-bold">[필수]</span><br /><span className="text-neutral-400">Microsoft 로그인 시 Microsoft·Xbox·Mojang 액세스 토큰은 검증에만 일시 사용하며 저장하지 않습니다.</span></td>
                    <td className="p-3">마인크래프트 정품 계정 본인 인증 및 연동</td>
                  </tr>
                  <tr>
                    <td className="p-3 bg-neutral-50/30 font-bold">연동 허브 (auth.craftopia.work)</td>
                    <td className="p-3">Discord ID·사용자명, 마인크래프트 UUID·사용자명을 하나의 연동 신원으로 묶어 보관</td>
                    <td className="p-3">연동 신원 통합 관리, 인게임-웹 권한·역할 동기화</td>
                  </tr>
                  <tr>
                    <td className="p-3 bg-neutral-50/30 font-bold">프로필·포트폴리오</td>
                    <td className="p-3">표시명(닉네임), 프로필 아바타·배너 이미지, 자기소개, 연락 이메일, SNS 링크(Patreon·X·YouTube·Instagram), 테마 설정, 프로젝트·위젯·작업로그(WIP)의 제목·설명 및 업로드 이미지·영상 <span className="text-neutral-400">[선택]</span></td>
                    <td className="p-3">하위 도메인 포트폴리오 개설·노출 및 배지 연동</td>
                  </tr>
                  <tr>
                    <td className="p-3 bg-neutral-50/30 font-bold">방문자 문의(Contact)</td>
                    <td className="p-3">보내는 사람 이름, 이메일 주소, 문의 메시지 내용, 회신 답변 내용 <span className="text-neutral-400">[선택]</span></td>
                    <td className="p-3">외부 방문자 문의 접수·전달 및 답변 회신</td>
                  </tr>
                  <tr>
                    <td className="p-3 bg-neutral-50/30 font-bold">월드 클라우드·플롯·경매</td>
                    <td className="p-3">월드 메타데이터(이름·버전·용량·보더·게임룰), 업로드 월드 .zip·백업 데이터, 초대 멤버 UUID·닉네임, 플롯 ID·좌표·소유/초대 멤버 UUID, 양도 대상 닉네임, 경매 가격, 보유 코인(CMI) 잔액, LuckPerms 그룹(역할 동기화)</td>
                    <td className="p-3">영토(플롯)·개인 월드 클라우드 생성·백업·초대·양도·경매 기능 제공</td>
                  </tr>
                  <tr>
                    <td className="p-3 bg-neutral-50/30 font-bold">계정 보안 (2FA)</td>
                    <td className="p-3">2단계 인증(TOTP) 보안 키, 활성화 여부 <span className="text-neutral-400">[선택]</span></td>
                    <td className="p-3">계정 보안 보호 및 보안 알림</td>
                  </tr>
                  <tr>
                    <td className="p-3 bg-neutral-50/30 font-bold">자동 수집 항목</td>
                    <td className="p-3">접속 IP 주소, 쿠키(세션·OAuth state), 접속·로그인 일시, 브라우저/OS 정보, 서비스 이용·조작 로그(CreatorLog·AuditLog·WipLog)</td>
                    <td className="p-3">부정 이용 차단, 비인가 접근 방지, 분쟁 발생 시 증빙</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* International transfer notice (PIPA Art. 28-8) */}
          <div className="space-y-2">
            <h3 className="font-bold text-neutral-900 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-black"></span>
              개인정보 국외 이전 안내 (개인정보 보호법 제28조의8)
            </h3>
            <div className="bg-neutral-50 border border-neutral-200 rounded-xl p-4 text-xs text-neutral-600 space-y-2">
              <p>원활한 서비스 제공을 위해 아래 국외 사업자에게 일부 개인정보가 이전(처리위탁)됩니다.</p>
              <ul className="list-disc list-inside space-y-0.5 text-neutral-500 pl-1">
                <li><span className="font-bold text-neutral-700">Resend, Inc. (미국)</span> — 수신자 이메일·인증 메일 내용 / 회원가입·서비스 통지 메일 발송</li>
                <li><span className="font-bold text-neutral-700">Cloudflare, Inc. (미국 등 글로벌)</span> — 접속 트래픽(IP 포함)·DB 백업 파일 / 접속 중계·보안 및 재해 복구 백업</li>
                <li><span className="font-bold text-neutral-700">Microsoft / Mojang Studios (미국 등)</span> — 이용자 본인이 직접 로그인하는 제3자 인증 / OAuth 토큰·회신 UUID·닉네임 / 마인크래프트 정품 본인 인증(토큰 미저장)</li>
                <li><span className="font-bold text-neutral-700">Discord, Inc. (미국)</span> — OAuth 인가 코드·회신 Discord ID·사용자명, 서버 가입 여부 확인용 Discord ID 조회 / Discord 계정 본인 인증·연동 및 공식 서버 가입 여부 확인</li>
                <li><span className="font-bold text-neutral-700">Patreon, Inc. (미국)</span> — OAuth 인가 코드·회신 Patreon 사용자 ID·표시 이름·후원 상태 / 후원자 본인 인증 및 구독 혜택 부여(이메일·후원 금액 미저장)</li>
              </ul>
              <p className="text-neutral-500">
                이용자는 국외 이전을 거부할 수 있으며, 이 경우 이메일 인증·계정 연동·백업 등 해당 기능 이용이 제한될 수 있습니다.
                자세한 이전 시점·방법·보유기간은{' '}
                <a href="/privacy" target="_blank" rel="noopener noreferrer" className="font-bold text-neutral-800 underline underline-offset-2">개인정보처리방침 제5조</a>를 참고해 주세요.
              </p>
            </div>
          </div>

          {/* Legal Terms Text */}
          <div className="space-y-4 pt-2">
            <h3 className="font-bold text-neutral-900 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-black"></span>
              개인정보 보유·이용 기간 및 권리 안내 (2026. 07. 10 기준, v4)
            </h3>

            <div className="space-y-3 pl-2.5 border-l border-neutral-200 text-xs text-neutral-600">
              <div>
                <p className="font-bold text-neutral-800">1. 개인정보의 보유 및 이용 기간</p>
                <p className="mt-1">
                  개인정보는 원칙적으로 회원 탈퇴 즉시 또는 수집 목적이 달성되면 지체 없이 파기합니다.
                  단, 관계 법령에 보존 의무가 있거나 서비스 특성상 보존이 필요한 경우 아래 기간 동안 분리 보관합니다.
                </p>
                <ul className="list-disc list-inside mt-1 space-y-0.5 text-neutral-500 pl-1">
                  <li>웹사이트 방문·로그인 접속 기록: 3개월 (통신비밀보호법)</li>
                  <li>소비자 불만 또는 분쟁처리에 관한 기록: 3년 (전자상거래법)</li>
                  <li>계약 또는 청약철회 등에 관한 기록: 5년 (전자상거래법)</li>
                  <li>이메일·Discord·마인크래프트 인증 코드 및 OAuth 상태값: 발급 후 단기간(약 10분~24시간) 내 자동 파기</li>
                  <li>개인 월드 클라우드 데이터: 30일 미사용 시 아카이브, 아카이브 후 90일(최종 약 120일) 경과 시 영구 삭제</li>
                  <li>재해 복구용 DB 백업본(국외 저장소 포함): 최대 5년 후 자동 삭제</li>
                </ul>
              </div>

              <div>
                <p className="font-bold text-neutral-800">2. 동의를 거부할 권리 및 불이익 고지</p>
                <p className="mt-1">
                  이용자는 개인정보 수집 및 이용 동의를 거부할 권리가 있습니다. 단, 필수 정보 수집에 동의하지 않을 경우 크리에이터 대시보드 진입 및 포트폴리오 관리 서비스 이용이 불가능합니다.
                  선택 정보(프로필·SNS 연동·2FA 등) 수집 동의를 거부하는 경우에는 해당 부가 서비스 사용만 제한됩니다.
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
              <span>위 개인정보 수집·이용 및 국외 이전 안내(개인정보처리방침 v4 · 2026. 07. 10)를 충분히 확인하였으며, 이에 동의합니다. (필수)</span>
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
