'use client'

import React, { useState } from 'react'
import { CheckCircle2, ChevronDown, ChevronUp, FileText, Info } from 'lucide-react'

interface PrivacyConsentStatusProps {
  privacyConsented: boolean
  privacyConsentedAt: Date | null
}

export default function PrivacyConsentStatus({
  privacyConsented,
  privacyConsentedAt,
}: PrivacyConsentStatusProps) {
  const [isOpen, setIsOpen] = useState(false)

  // Format date to KST
  const formattedDate = privacyConsentedAt
    ? new Date(privacyConsentedAt).toLocaleString('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
      timeZone: 'Asia/Seoul',
    }) + ' (KST)'
    : '기록 없음'

  return (
    <section className="border-t border-neutral-100 pt-8">
      <h2 className="text-lg font-bold border-b border-neutral-100 pb-3 mb-5">개인정보 수집 및 이용 동의 현황</h2>

      <div className="space-y-4 max-w-3xl">
        {/* Status Card */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between p-5 bg-neutral-50 rounded-2xl border border-neutral-200/80 gap-4">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${privacyConsented
              ? 'bg-emerald-50 text-emerald-600 border border-emerald-200'
              : 'bg-amber-50 text-amber-600 border border-amber-200'
              }`}>
              {privacyConsented ? <CheckCircle2 size={22} /> : <Info size={22} />}
            </div>
            <div>
              <p className="text-xs font-bold text-neutral-400 uppercase tracking-wide">동의 상태</p>
              <div className="flex items-center gap-2 mt-0.5">
                <span className={`text-sm font-black ${privacyConsented ? 'text-emerald-700' : 'text-amber-700'}`}>
                  {privacyConsented ? '개인정보 수집 및 이용 동의 완료' : '미동의 상태'}
                </span>
              </div>
            </div>
          </div>

          <div className="sm:text-right">
            <p className="text-xs font-bold text-neutral-400 uppercase tracking-wide">동의 완료 일시</p>
            <p className="text-xs text-neutral-700 font-bold mt-1 bg-neutral-200/60 px-3 py-1.5 rounded-lg inline-block">
              {formattedDate}
            </p>
          </div>
        </div>

        {/* Toggle Accordion */}
        <div className="border border-neutral-200 rounded-2xl overflow-hidden bg-white">
          <button
            type="button"
            onClick={() => setIsOpen(!isOpen)}
            className="w-full flex items-center justify-between p-4 hover:bg-neutral-50/50 transition-colors text-left focus:outline-none"
          >
            <div className="flex items-center gap-2.5 text-neutral-800">
              <FileText size={18} className="text-neutral-500" />
              <span className="text-sm font-bold">수집 항목 및 약관 전문 상시 조회</span>
            </div>
            {isOpen ? <ChevronUp size={18} className="text-neutral-500" /> : <ChevronDown size={18} className="text-neutral-500" />}
          </button>

          {isOpen && (
            <div className="p-6 border-t border-neutral-100 bg-neutral-50/30 text-xs text-neutral-700 space-y-6 leading-relaxed animate-in slide-in-from-top-2 duration-200">
              {/* Collected List Table */}
              <div className="space-y-2.5">
                <h4 className="font-bold text-neutral-900 text-sm">BlockCanvas 기능별 수집 및 이용 목적</h4>
                <div className="border border-neutral-200 rounded-xl overflow-hidden bg-white">
                  <table className="w-full text-left border-collapse text-[11px]">
                    <thead>
                      <tr className="bg-neutral-50 border-b border-neutral-200 font-bold text-neutral-700">
                        <th className="p-3 w-1/4">서비스 주요 기능</th>
                        <th className="p-3 w-1/3">수집 항목</th>
                        <th className="p-3">수집 및 이용 목적</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-200 text-neutral-600 font-medium">
                      <tr>
                        <td className="p-3 bg-neutral-50/20 font-bold text-neutral-800">계정 관리 및 인증</td>
                        <td className="p-3">이메일 주소, 비밀번호 <span className="text-red-500 font-bold">[필수]</span></td>
                        <td className="p-3">로그인 및 크리에이터 본인 식별, 보안 공지</td>
                      </tr>
                      <tr>
                        <td className="p-3 bg-neutral-50/20 font-bold text-neutral-800">서브도메인 개설</td>
                        <td className="p-3">아이디(서브도메인명), 표시 이름(닉네임) <span className="text-red-500 font-bold">[필수]</span></td>
                        <td className="p-3">고유 접속 주소 할당 및 포트폴리오 프로필 노출</td>
                      </tr>
                      <tr>
                        <td className="p-3 bg-neutral-50/20 font-bold text-neutral-800">대시보드 로그 및 통계</td>
                        <td className="p-3">접속 IP 주소, 쿠키, 대시보드 편집/기능 수행 이력 <span className="text-red-500 font-bold">[필수]</span></td>
                        <td className="p-3">부정 이용 및 비인가 접속 차단, 성능 개선</td>
                      </tr>
                      <tr>
                        <td className="p-3 bg-neutral-50/20 font-bold text-neutral-800">포트폴리오 부가 기능</td>
                        <td className="p-3">프로필 아바타 이미지 URL, Discord 고유 ID, 소셜 링크(Patreon, Twitter, YouTube, Instagram URL) <span className="text-neutral-400 font-bold">[선택]</span></td>
                        <td className="p-3">포트폴리오 테마 설정 및 외부 연동 배지 활성화</td>
                      </tr>
                      <tr>
                        <td className="p-3 bg-neutral-50/20 font-bold text-neutral-800">계정 보안 강화</td>
                        <td className="p-3">2FA 보안 설정 키(Two-Factor Secret) 정보 <span className="text-neutral-400 font-bold">[선택]</span></td>
                        <td className="p-3">계정 도용 방지를 위한 추가 로그인 2단계 인증 구성</td>
                      </tr>
                      <tr>
                        <td className="p-3 bg-neutral-50/20 font-bold text-neutral-800">외부 방문자 소통</td>
                        <td className="p-3">메시지 수집 시: 발송자 이름, 이메일 주소, 문의 내용 <span className="text-neutral-400 font-bold">[선택]</span></td>
                        <td className="p-3">외부 방문자의 크리에이터 개별 문의 접수 및 확인 지원</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Legal Terms Text */}
              <div className="space-y-3 bg-white p-5 rounded-xl border border-neutral-200/60">
                <h4 className="font-bold text-neutral-900 text-sm">개인정보 수집 및 이용 동의 약관 전문 (2026. 06. 03 개정)</h4>

                <div className="space-y-4 text-xs text-neutral-600 leading-relaxed font-medium">
                  <p>
                    BlockCanvas는 이용자(크리에이터)의 개인정보를 소중히 취급하며, 개인정보 보호법 등 대한민국 법률을 준수합니다. 본 서비스 이용(대시보드 접근 및 포트폴리오 관리)을 위해 개인정보를 수집 및 이용하고 있습니다.
                  </p>

                  <div>
                    <h5 className="font-bold text-neutral-800 mb-1">1. 개인정보의 수집 및 이용 목적</h5>
                    <ul className="list-disc list-inside space-y-0.5 text-neutral-500 pl-1">
                      <li>회원 가입 의사 확인, 크리에이터 본인 식별 및 회원 인증</li>
                      <li>개인별 크리에이터 포트폴리오 서브도메인 페이지 개설 및 관리</li>
                      <li>프로젝트 업로드, 카테고리 관리, WIP 로그 작성 등 대시보드 기능 제공</li>
                      <li>2단계 보안 인증(2FA) 적용 및 계정 보안 강화</li>
                      <li>외부 방문자 전송 메시지(문의 내역)의 안전한 보관 및 크리에이터 전달</li>
                      <li>불량 회원의 부정 이용 및 비인가 접속 차단, 보안 사고 방지</li>
                    </ul>
                  </div>

                  <div>
                    <h5 className="font-bold text-neutral-800 mb-1">2. 수집하는 개인정보의 항목</h5>
                    <p>
                      - [필수 항목]: 이메일 주소, 비밀번호(암호화), 크리에이터 고유식별자(하위 도메인 주소), 표시 이름(닉네임), 접속 IP 주소, 쿠키(Cookie), 서비스 이용 내역, 기기 정보
                    </p>
                    <p className="mt-1">
                      - [선택 항목]: 프로필 아바타 이미지 URL, Discord 고유 ID, 소셜 링크(Patreon, Twitter, YouTube, Instagram URL), 2FA 보안 키(Two-Factor Secret) 정보
                    </p>
                  </div>

                  <div>
                    <h5 className="font-bold text-neutral-800 mb-1">3. 개인정보의 보유 및 이용 기간</h5>
                    <p>
                      이용자의 개인정보는 회원 탈퇴 완료 시 즉시 파기합니다. 단, 관계 법령에 보존 의무가 있는 경우 아래 기간 동안 분리하여 안전하게 보관합니다.
                    </p>
                    <ul className="list-disc list-inside mt-1 space-y-0.5 text-neutral-500 pl-1">
                      <li>웹사이트 로그인 및 접속 로그: 3개월 보관 (통신비밀보호법)</li>
                      <li>소비자의 불만 또는 분쟁처리에 관한 기록: 3년 보관 (전자상거래법)</li>
                      <li>계약 또는 청약철회 등에 관한 기록: 5년 보관 (전자상거래법)</li>
                    </ul>
                  </div>

                  <div>
                    <h5 className="font-bold text-neutral-800 mb-1">4. 동의 거부 권리 및 불이익 고지</h5>
                    <p>
                      귀하는 개인정보 수집 및 이용에 대한 동의를 거부할 권리가 있습니다. 필수 정보 수집에 동의하지 않을 경우 크리에이터 대시보드 진입 및 포트폴리오 관리 서비스 이용이 불가합니다. 선택 정보 수집에 동의하지 않는 경우에는 해당 연동 기능만 제한되며, 기본 서비스는 제한 없이 이용하실 수 있습니다.
                    </p>
                  </div>
                </div>
              </div>

              {/* Admin contact info */}
              <div className="bg-amber-50/50 border border-amber-200/50 rounded-xl p-4 text-[11px] text-neutral-600 font-medium">
                <span className="font-bold text-neutral-900 block mb-1">📞 서비스 책임자 및 개인정보 관리 문의</span>
                <p>
                  본 사이트(BlockCanvas)의 개인정보 책임자는 사이트 대표자 김민수이며, 개인정보에 관한 문의, 동의 철회, 권리 행사(조회, 수정, 삭제 요구 등)는 대표자 이메일 주소("yeonjm1@gmail.com")로 상시 요청하실 수 있습니다.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
