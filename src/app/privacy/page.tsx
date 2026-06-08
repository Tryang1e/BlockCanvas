import React from 'react'
import Link from 'next/link'
import Image from 'next/image'

export const metadata = {
  title: '개인정보처리방침 - BlockCanvas',
  description: 'BlockCanvas 플랫폼의 개인정보처리방침입니다.',
}

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-[#fafafa] dark:bg-[#070708] text-neutral-800 dark:text-neutral-200 transition-colors duration-500 py-16 px-6 sm:px-12 lg:px-24">
      {/* Grid line background */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808007_1px,transparent_1px),linear-gradient(to_bottom,#80808007_1px,transparent_1px)] bg-[size:32px_32px] pointer-events-none" />

      <div className="max-w-4xl mx-auto relative z-10">
        {/* Top Back Nav */}
        <div className="mb-12 flex justify-between items-center border-b border-neutral-200 dark:border-neutral-800 pb-6">
          <Link href="/" className="flex items-center gap-2 group text-xs font-bold text-neutral-400 dark:text-neutral-500 hover:text-black dark:hover:text-white transition-colors">
            <svg 
              className="w-4 h-4 transform group-hover:-translate-x-0.5 transition-transform duration-300" 
              fill="none" 
              stroke="currentColor" 
              strokeWidth="2.5" 
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            메인으로 돌아가기
          </Link>
          <div className="flex items-center gap-1.5 select-none">
            <Image src="/logo_icon.png" alt="Logo" width={20} height={20} className="dark:invert" />
            <span className="font-extrabold text-xs tracking-wider text-black dark:text-white">BLOCKCANVAS</span>
          </div>
        </div>

        {/* Header Title */}
        <div className="space-y-4 mb-10">
          <h1 className="text-3xl sm:text-4xl font-black text-black dark:text-white tracking-tight">
            개인정보처리방침
          </h1>
          <p className="text-xs text-neutral-400 dark:text-neutral-500 font-mono font-medium">
            시행일자: 2026년 6월 3일
          </p>
        </div>

        {/* Content Body */}
        <div className="space-y-8 text-sm leading-relaxed text-neutral-600 dark:text-neutral-400 font-medium">
          
          <section className="bg-white dark:bg-neutral-900 border border-neutral-200/60 dark:border-neutral-800/60 p-6 rounded-2xl shadow-[0_2px_8px_rgba(0,0,0,0.01)]">
            <p>
              <strong>BlockCanvas</strong>(이하 &apos;회사&apos; 혹은 &apos;서비스&apos;)는 이용자(크리에이터 및 일반 방문자)의 개인정보를 소중히 다루며, 「개인정보 보호법」 등 대한민국의 관련 법령을 철저히 준수합니다.
            </p>
            <p className="mt-2">
              본 방침은 서비스를 이용하는 과정에서 수집되는 개인정보가 어떤 목적과 방식으로 이용되며, 정보주체의 권리를 보호하기 위해 어떠한 조치가 취해지고 있는지 상시 알려드리기 위해 제정되었습니다.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-bold text-black dark:text-white">1. 수집하는 개인정보의 항목 및 수집 방법</h2>
            <p>회사는 서비스 제공을 위해 필요한 최소한의 개인정보를 아래와 같이 수집하고 있습니다.</p>
            
            <div className="border border-neutral-200 dark:border-neutral-800 rounded-xl overflow-hidden text-xs">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-neutral-50 dark:bg-neutral-900/50 border-b border-neutral-200 dark:border-neutral-800 font-bold text-neutral-700 dark:text-neutral-300">
                    <th className="p-3 w-1/4">수집 주체</th>
                    <th className="p-3 w-1/2">수집하는 개인정보 항목</th>
                    <th className="p-3">수집 방법</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800 text-neutral-600 dark:text-neutral-400">
                  <tr>
                    <td className="p-3 font-bold text-neutral-800 dark:text-neutral-200">크리에이터 (회원)</td>
                    <td className="p-3">이메일 주소, 비밀번호, 하위 도메인 주소(ID), 표시명(닉네임), 프로필 아바타 이미지 URL, Discord ID, 소셜 링크(Patreon, Twitter, YouTube, Instagram), 2FA 보안 키 정보</td>
                    <td className="p-3">회원가입, 프로필 수정 및 대시보드 입력</td>
                  </tr>
                  <tr>
                    <td className="p-3 font-bold text-neutral-800 dark:text-neutral-200">비회원 (방문자)</td>
                    <td className="p-3">이름(Name), 이메일 주소(Email), 문의 사항 메시지 내용</td>
                    <td className="p-3">개별 크리에이터 포트폴리오 하단 문의(Contact) 폼 입력</td>
                  </tr>
                  <tr>
                    <td className="p-3 font-bold text-neutral-800 dark:text-neutral-200">자동 수집 항목</td>
                    <td className="p-3">접속 IP 정보, 쿠키(Cookie), 접속 및 서비스 로그인 일시, 웹 브라우저/OS 정보, 플랫폼 이용 로그(CreatorLog, WipLog)</td>
                    <td className="p-3">시스템 로그 분석기 및 자동 수집 모듈</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-bold text-black dark:text-white">2. 개인정보의 수집 및 이용 목적</h2>
            <p>수집한 개인정보는 다음의 목적을 위해서만 이용되며, 목적이 변경될 경우 반드시 사전 동의를 구합니다.</p>
            <ul className="list-disc list-inside space-y-1.5 pl-2 text-neutral-500 dark:text-neutral-500 text-xs">
              <li>회원 가입 의사 확인 및 본인 식별, 불량 회원의 부정 이용 방지</li>
              <li>개인별 크리에이터 포트폴리오 사이트 서브도메인 개설 및 편집 권한 제공</li>
              <li>2차 인증(2FA)을 적용한 로그인 등 계정 보안 상태 보호</li>
              <li>외부 방문자 문의 사항에 대한 수신 및 크리에이터 본인 확인/전달 및 답변 회신</li>
              <li>보안 침해 사고 대응, 접속 이력 모니터링을 통한 비인가 접근 차단</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-bold text-black dark:text-white">3. 개인정보의 보유 및 이용 기간</h2>
            <p>이용자의 개인정보는 회원 탈퇴 시 혹은 수집 및 이용목적이 달성된 후에는 지체 없이 파기하는 것을 원칙으로 합니다. 단, 관계 법령에 규정이 있는 경우 아래 정한 기간 동안 안전하게 보관합니다.</p>
            <ul className="list-disc list-inside space-y-1 pl-2 text-xs">
              <li><strong>웹사이트 방문 로그 (로그인 이력 등)</strong>: 3개월 보관 (통신비밀보호법)</li>
              <li><strong>소비자의 불만 또는 분쟁처리에 관한 기록</strong>: 3년 보관 (전자상거래 등에서의 소비자보호에 관한 법률)</li>
              <li><strong>계약 또는 청약철회 등에 관한 기록</strong>: 5년 보관 (전자상거래 등에서의 소비자보호에 관한 법률)</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-bold text-black dark:text-white">4. 개인정보의 파기절차 및 파기방법</h2>
            <p>개인정보 보유기간이 경과하거나 수집 목적이 달성된 개인정보는 다음과 같은 절차와 방법으로 파기합니다.</p>
            <ul className="list-disc list-inside space-y-1 pl-2 text-xs">
              <li><strong>파기절차</strong>: 회원탈퇴 완료 즉시 DB에서 관련 레코드가 자동으로 즉각 영구 삭제(Cascade Delete)됩니다.</li>
              <li><strong>파기방법</strong>: 전자적 파일 형태로 저장된 개인정보는 기록을 재생할 수 없는 기술적 방법을 사용하여 완전히 삭제합니다.</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-bold text-black dark:text-white">5. 이용자 및 법정대리인의 권리와 그 행사방법</h2>
            <p>이용자는 언제든지 등록되어 있는 자신의 개인정보를 조회하거나 수정할 수 있으며 회원 탈퇴(계정 삭제)를 요구할 수 있습니다.</p>
            <ul className="list-disc list-inside space-y-1 pl-2 text-xs">
              <li>이용자는 대시보드 [프로필 및 설정] 및 [계정 및 보안 관리] 메뉴를 통해 개인정보를 조회·수정하거나 탈퇴를 직접 진행할 수 있습니다.</li>
              <li>혹은 개인정보 보호책임자에게 이메일로 요청하시는 경우 지체 없이 조치해 드리겠습니다.</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-bold text-black dark:text-white">6. 개인정보를 자동으로 수집하는 장치의 설치·운영 및 거부</h2>
            <p>회사는 서비스 편의를 제공하고 세션을 유지하기 위해 쿠키(Cookie)를 사용합니다.</p>
            <p>이용자는 웹 브라우저 설정을 통해 쿠키 저장을 거부하거나 경고를 받도록 설정할 수 있습니다. 단, 쿠키 저장을 거부할 경우 로그인이 필요한 대시보드 서비스 이용에 제한을 받을 수 있습니다.</p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-bold text-black dark:text-white">7. 개인정보 보호책임자 지정 및 민원 안내</h2>
            <p>회사는 이용자의 개인정보를 보호하고 개인정보와 관련된 불만을 처리하기 위하여 아래와 같이 개인정보 보호책임자를 지정하고 있습니다.</p>
            
            <div className="bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 p-5 rounded-xl text-xs space-y-1.5 font-bold">
              <p>👤 개인정보 보호책임자: 김민수</p>
              <p>✉️ 이메일 주소: <a href="mailto:yeonjm1@gmail.com" className="text-neutral-900 dark:text-white underline">yeonjm1@gmail.com</a></p>
              <p>📞 문의 내용: 개인정보 조회/수정/삭제 요청, 약관 동의 철회, 불만 신고 등</p>
            </div>
            <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-2">
              개인정보침해에 대한 신고나 상담이 필요하신 경우에는 개인정보침해신고센터 (privacy.kisa.or.kr / 국번없이 118번) 등으로 문의하실 수 있습니다.
            </p>
          </section>

        </div>

        {/* Footer info */}
        <div className="mt-16 border-t border-neutral-200 dark:border-neutral-800 pt-6 text-center text-xs text-neutral-400 dark:text-neutral-500">
          <p>© 2026 BlockCanvas. All rights reserved.</p>
        </div>
      </div>
    </div>
  )
}
