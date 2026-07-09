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
                        <td className="p-3 bg-neutral-50/20 font-bold text-neutral-800">회원가입·계정 (이메일)</td>
                        <td className="p-3">이메일 주소, 비밀번호(일방향 암호화), 식별자(하위 도메인 ID/creator_name) <span className="text-red-500 font-bold">[필수]</span></td>
                        <td className="p-3">로그인 및 크리에이터 본인 식별·인증, 보안 통지</td>
                      </tr>
                      <tr>
                        <td className="p-3 bg-neutral-50/20 font-bold text-neutral-800">Discord 연동</td>
                        <td className="p-3">Discord 계정 고유 ID, Discord 사용자명, 공식 Discord 서버 가입 여부 <span className="text-red-500 font-bold">[필수]</span></td>
                        <td className="p-3">Discord 계정 연동·신원 연결, 서버 가입 여부에 따른 건축 이용 자격 부여·회수</td>
                      </tr>
                      <tr>
                        <td className="p-3 bg-neutral-50/20 font-bold text-neutral-800">마인크래프트 정품 인증·연동</td>
                        <td className="p-3">마인크래프트 UUID, 마인크래프트 사용자명 <span className="text-red-500 font-bold">[필수]</span><br /><span className="text-neutral-400">Microsoft 로그인 또는 인게임 /웹연동 코드로 연동하며, 인증 과정의 Microsoft·Xbox·Mojang 액세스 토큰은 검증에만 일시 사용하고 저장하지 않습니다.</span></td>
                        <td className="p-3">마인크래프트 정품 계정 본인 인증 및 인게임-웹 신원 연결</td>
                      </tr>
                      <tr>
                        <td className="p-3 bg-neutral-50/20 font-bold text-neutral-800">연동 허브 (auth.craftopia.work)</td>
                        <td className="p-3">Discord ID·사용자명, 마인크래프트 UUID·사용자명을 하나의 연동 신원으로 묶어 보관</td>
                        <td className="p-3">연동 신원 통합 관리, 인게임-웹 권한·역할 동기화</td>
                      </tr>
                      <tr>
                        <td className="p-3 bg-neutral-50/20 font-bold text-neutral-800">프로필·포트폴리오</td>
                        <td className="p-3">표시명(닉네임), 프로필 아바타·배너 이미지, 자기소개, 연락 이메일, SNS 링크(Patreon·X·YouTube·Instagram), 테마 설정, 프로젝트·위젯·작업로그(WIP)의 제목·설명 및 업로드 이미지·영상 <span className="text-neutral-400 font-bold">[선택]</span></td>
                        <td className="p-3">하위 도메인 포트폴리오 개설·노출 및 배지 연동</td>
                      </tr>
                      <tr>
                        <td className="p-3 bg-neutral-50/20 font-bold text-neutral-800">방문자 문의(Contact)</td>
                        <td className="p-3">보내는 사람 이름, 이메일 주소, 문의 메시지 내용, 회신 답변 내용 <span className="text-neutral-400 font-bold">[선택]</span></td>
                        <td className="p-3">외부 방문자 문의 접수·전달 및 답변 회신</td>
                      </tr>
                      <tr>
                        <td className="p-3 bg-neutral-50/20 font-bold text-neutral-800">월드 클라우드·플롯·경매</td>
                        <td className="p-3">월드 메타데이터(이름·버전·용량·보더·게임룰), 업로드 월드 .zip·백업 데이터, 초대 멤버 UUID·닉네임, 플롯 ID·좌표·소유/초대 멤버 UUID, 양도 대상 닉네임, 경매 가격, 보유 코인(CMI) 잔액, LuckPerms 그룹(역할 동기화)</td>
                        <td className="p-3">영토(플롯)·개인 월드 클라우드 생성·백업·초대·양도·경매 기능 제공</td>
                      </tr>
                      <tr>
                        <td className="p-3 bg-neutral-50/20 font-bold text-neutral-800">계정 보안 (2FA)</td>
                        <td className="p-3">2단계 인증(TOTP) 보안 키, 활성화 여부 <span className="text-neutral-400 font-bold">[선택]</span></td>
                        <td className="p-3">계정 보안 보호 및 보안 알림</td>
                      </tr>
                      <tr>
                        <td className="p-3 bg-neutral-50/20 font-bold text-neutral-800">자동 수집 항목</td>
                        <td className="p-3">접속 IP 주소, 쿠키(세션·OAuth state), 접속·로그인 일시, 브라우저/OS 정보, 서비스 이용·조작 로그(CreatorLog·AuditLog·WipLog)</td>
                        <td className="p-3">부정 이용 차단, 비인가 접근 방지, 분쟁 발생 시 증빙</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* International transfer notice (PIPA Art. 28-8) */}
              <div className="space-y-2.5">
                <h4 className="font-bold text-neutral-900 text-sm">개인정보 국외 이전 안내 (개인정보 보호법 제28조의8)</h4>
                <div className="bg-neutral-50 border border-neutral-200 rounded-xl p-4 text-[11px] text-neutral-600 space-y-2">
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
                  <p className="text-[11px] text-neutral-500 border-t border-neutral-200 pt-2 mt-1">
                    ⚠️ 본 서비스는 Mojang Studios 또는 Microsoft의 공식 마인크래프트 제품이 아니며, 승인·제휴·후원 관계가 없습니다. 마인크래프트 정품 계정 본인 인증 목적으로만 Microsoft 로그인을 이용합니다. <span className="text-neutral-400">(NOT AN OFFICIAL MINECRAFT PRODUCT. NOT APPROVED BY OR ASSOCIATED WITH MOJANG OR MICROSOFT.)</span>
                  </p>
                </div>
              </div>

              {/* Legal Terms Text */}
              <div className="space-y-3 bg-white p-5 rounded-xl border border-neutral-200/60">
                <h4 className="font-bold text-neutral-900 text-sm">개인정보 수집 및 이용 동의 약관 전문 (2026. 07. 10 개정, v4)</h4>

                <div className="space-y-4 text-xs text-neutral-600 leading-relaxed font-medium">
                  <p>
                    BlockCanvas는 이용자(크리에이터, 연동 이용자)의 개인정보를 소중히 취급하며, 개인정보 보호법 등 대한민국 법률을 준수합니다. 본 개정판(v4)은 공식 Discord 서버(커뮤니티) 가입 여부 확인을 통한 건축 이용 자격 부여·회수 처리를 반영하였으며, 직전 v3 은 Patreon 후원 연동(후원자 인증·구독 혜택 부여) 및 국외 이전(Patreon, Inc./미국) 사항을, v2 는 마인크래프트 서버 연동, Discord/Microsoft 계정 연동, 월드 클라우드·영토(플롯) 기능 도입에 따른 처리 항목과 국외 이전 사항을 반영하였습니다.
                  </p>

                  <div>
                    <h5 className="font-bold text-neutral-800 mb-1">1. 개인정보의 수집 및 이용 목적</h5>
                    <ul className="list-disc list-inside space-y-0.5 text-neutral-500 pl-1">
                      <li>회원 가입 의사 확인, 본인 식별·인증, 불량 회원의 부정 이용 방지</li>
                      <li>개인별 크리에이터 포트폴리오 하위 도메인 개설 및 편집 권한 제공</li>
                      <li>Discord·마인크래프트 계정 연동 및 연동 신원(허브) 관리, 인게임-웹 권한·역할 동기화</li>
                      <li>공식 Discord 서버 가입 여부 확인을 통한 건축 서버 이용 자격 부여·회수(연동 시 및 주기적 확인, 서버 이탈 시 자동 회수·재가입 시 자동 복구)</li>
                      <li>마인크래프트 영토(플롯)·개인 월드 클라우드 생성·백업·초대·양도·경매 등 영토 관리 기능 제공</li>
                      <li>2단계 인증(2FA)을 통한 계정 보안 보호 및 보안 알림</li>
                      <li>외부 방문자 문의의 접수·전달 및 답변 회신</li>
                      <li>보안 침해사고 대응, 접속 이력 모니터링을 통한 비인가 접근 차단 및 분쟁 발생 시 증빙</li>
                      <li>이메일 인증 등 서비스 운영에 필요한 통지 발송</li>
                    </ul>
                  </div>

                  <div>
                    <h5 className="font-bold text-neutral-800 mb-1">2. 수집하는 개인정보의 항목</h5>
                    <p>
                      - [필수 항목]: 이메일 주소, 비밀번호(일방향 암호화), 크리에이터 식별자(하위 도메인 ID/creator_name), Discord 고유 ID·사용자명, 마인크래프트 UUID·사용자명, 접속 IP 주소, 쿠키(세션·OAuth state), 서비스 이용·조작 로그, 브라우저/OS 정보
                    </p>
                    <p className="mt-1">
                      - [선택 항목]: 표시명(닉네임), 프로필 아바타·배너 이미지, 자기소개, 연락 이메일, SNS 링크(Patreon·X·YouTube·Instagram), 2FA 보안 키(TOTP), 방문자 문의 내용
                    </p>
                    <p className="mt-1">
                      - [월드 클라우드·플롯·경매 이용 시]: 월드 메타데이터·업로드 월드 .zip·백업 데이터, 초대/소유 멤버 UUID·닉네임, 플롯 ID·좌표, 양도 대상 닉네임, 경매 가격, 보유 코인(CMI) 잔액, LuckPerms 그룹
                    </p>
                  </div>

                  <div>
                    <h5 className="font-bold text-neutral-800 mb-1">3. 개인정보의 보유 및 이용 기간</h5>
                    <p>
                      이용자의 개인정보는 회원 탈퇴 즉시 또는 수집 목적이 달성되면 지체 없이 파기합니다. 단, 관계 법령에 보존 의무가 있거나 서비스 특성상 보존이 필요한 경우 아래 기간 동안 분리하여 안전하게 보관합니다.
                    </p>
                    <ul className="list-disc list-inside mt-1 space-y-0.5 text-neutral-500 pl-1">
                      <li>웹사이트 방문·로그인 접속 기록: 3개월 보관 (통신비밀보호법)</li>
                      <li>소비자의 불만 또는 분쟁처리에 관한 기록: 3년 보관 (전자상거래법)</li>
                      <li>계약 또는 청약철회 등에 관한 기록: 5년 보관 (전자상거래법)</li>
                      <li>이메일·Discord·마인크래프트 인증 코드 및 OAuth 상태값: 발급 후 단기간(약 10분~24시간) 내 자동 파기</li>
                      <li>개인 월드 클라우드 데이터: 30일 미사용 시 아카이브, 아카이브 후 90일(최종 약 120일) 경과 시 영구 삭제(수명주기 정책)</li>
                      <li>재해 복구용 DB 백업본(국외 저장소 포함): 최대 5년 후 자동 삭제</li>
                    </ul>
                  </div>

                  <div>
                    <h5 className="font-bold text-neutral-800 mb-1">4. 동의 거부 권리 및 불이익 고지</h5>
                    <p>
                      귀하는 개인정보 수집 및 이용에 대한 동의를 거부할 권리가 있습니다. 필수 정보 수집에 동의하지 않을 경우 크리에이터 대시보드 진입 및 포트폴리오 관리 서비스 이용이 불가합니다. 선택 정보(프로필·SNS 연동·2FA 등) 수집에 동의하지 않는 경우에는 해당 연동 기능만 제한되며, 기본 서비스는 제한 없이 이용하실 수 있습니다.
                    </p>
                  </div>
                </div>
              </div>

              {/* Admin contact info */}
              <div className="bg-amber-50/50 border border-amber-200/50 rounded-xl p-4 text-[11px] text-neutral-600 font-medium">
                <span className="font-bold text-neutral-900 block mb-1">📞 서비스 책임자 및 개인정보 관리 문의</span>
                <p>
                  본 사이트(BlockCanvas)의 개인정보 책임자는 사이트 대표자 김민수이며, 개인정보에 관한 문의, 동의 철회, 권리 행사(조회, 수정, 삭제 요구 등)는 대표자 이메일 주소(&quot;yeonjm1@gmail.com&quot;)로 상시 요청하실 수 있습니다.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
