import React from 'react'
import Link from 'next/link'
import Image from 'next/image'

export const metadata = {
  title: '개인정보처리방침 - BlockCanvas',
  description: 'BlockCanvas(craftopia.work) 플랫폼의 개인정보처리방침입니다.',
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
            <Image src="/logo_text.png" alt="BLOCK CANVAS" width={100} height={12} className="h-3 w-auto object-contain" />
          </div>
        </div>

        {/* Header Title */}
        <div className="space-y-4 mb-10">
          <h1 className="text-3xl sm:text-4xl font-black text-black dark:text-white tracking-tight">
            개인정보처리방침
          </h1>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-neutral-400 dark:text-neutral-500 font-mono font-medium">
            <span>시행일자: 2026년 7월 10일</span>
            <span>최종 개정: 2026년 7월 10일 (v4)</span>
            <span>직전 버전: 2026년 7월 8일 (v3)</span>
          </div>
        </div>

        {/* Content Body */}
        <div className="space-y-8 text-sm leading-relaxed text-neutral-600 dark:text-neutral-400 font-medium">

          <section className="bg-white dark:bg-neutral-900 border border-neutral-200/60 dark:border-neutral-800/60 p-6 rounded-2xl shadow-[0_2px_8px_rgba(0,0,0,0.01)]">
            <p>
              <strong>BlockCanvas</strong>(서비스 운영 도메인 craftopia.work, 이하 &apos;회사&apos; 혹은 &apos;서비스&apos;)는 이용자(크리에이터, 연동 이용자 및 일반 방문자)의 개인정보를 소중히 다루며, 「개인정보 보호법」, 「정보통신망 이용촉진 및 정보보호 등에 관한 법률」 등 대한민국의 관련 법령을 철저히 준수합니다.
            </p>
            <p className="mt-2">
              본 방침은 서비스를 이용하는 과정에서 수집되는 개인정보가 어떤 목적과 방식으로 처리되며, 정보주체의 권리를 보호하기 위해 어떠한 조치가 취해지고 있는지 상시 알려드리기 위해 제정되었습니다. 본 개정판(v4)은 공식 Discord 서버(커뮤니티) 가입 여부 확인을 통한 건축 서버 이용 자격 부여·회수(연동 시 및 주기적 확인, 서버 이탈 시 관련 권한 자동 회수) 처리를 반영하여 보강되었습니다. (직전 v3 은 Patreon 후원 연동(후원자 인증 및 구독 혜택 부여)에 따른 처리 항목과 국외 이전(Patreon, Inc./미국) 사항을, v2 는 마인크래프트 서버 연동, Discord/Microsoft 계정 연동, 월드 클라우드 및 영토(플롯) 기능 도입 사항을 반영하였습니다.)
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-bold text-black dark:text-white">1. 수집하는 개인정보의 항목 및 수집 방법</h2>
            <p>회사는 서비스 제공을 위해 필요한 최소한의 개인정보를 아래와 같이 수집합니다. 필수 항목은 서비스의 핵심 기능 제공을 위한 것이며, 선택 항목은 동의하지 않아도 해당 부가기능만 제한될 뿐 서비스 이용에는 지장이 없습니다.</p>

            <div className="border border-neutral-200 dark:border-neutral-800 rounded-xl overflow-hidden text-xs">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-neutral-50 dark:bg-neutral-900/50 border-b border-neutral-200 dark:border-neutral-800 font-bold text-neutral-700 dark:text-neutral-300">
                    <th className="p-3 w-1/4">처리 영역</th>
                    <th className="p-3 w-1/2">수집하는 개인정보 항목</th>
                    <th className="p-3">수집 방법</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800 text-neutral-600 dark:text-neutral-400">
                  <tr>
                    <td className="p-3 font-bold text-neutral-800 dark:text-neutral-200">회원가입·계정 (이메일)</td>
                    <td className="p-3"><span className="text-red-500 font-bold">[필수]</span> 이메일 주소, 비밀번호(일방향 암호화 저장), 식별자(하위 도메인 ID/creator_name) · 가입 인증 절차에서 이메일·비밀번호 해시·1회용 인증 토큰을 임시 보관</td>
                    <td className="p-3">회원가입 폼 입력, 이메일 인증</td>
                  </tr>
                  <tr>
                    <td className="p-3 font-bold text-neutral-800 dark:text-neutral-200">Discord 연동</td>
                    <td className="p-3"><span className="text-red-500 font-bold">[필수]</span> Discord 계정 고유 ID, Discord 사용자명, 공식 Discord 서버(커뮤니티) 가입 여부 (로그인 후 계정에 연동할 때만 수집 — 회원가입은 이메일로만 진행하며 Discord로는 신규 계정이 생성되지 않습니다)</td>
                    <td className="p-3">로그인 후 Discord OAuth 연동</td>
                  </tr>
                  <tr>
                    <td className="p-3 font-bold text-neutral-800 dark:text-neutral-200">Patreon 후원 연동</td>
                    <td className="p-3"><span className="text-neutral-400">[선택]</span> Patreon 사용자 ID, 표시 이름, 후원 상태(활성 후원자 여부) (구독 혜택 부여 목적으로 로그인 후 연동할 때만 수집 — 이메일·후원 금액 등은 저장하지 않습니다)</td>
                    <td className="p-3">로그인 후 Patreon OAuth 연동</td>
                  </tr>
                  <tr>
                    <td className="p-3 font-bold text-neutral-800 dark:text-neutral-200">마인크래프트 정품 인증·연동</td>
                    <td className="p-3"><span className="text-red-500 font-bold">[필수]</span> 마인크래프트 계정 UUID, 마인크래프트 사용자명. (Microsoft 로그인 시 인증 과정의 Microsoft·Xbox Live·Minecraft 액세스 토큰은 검증에만 일시 사용하며 <strong>저장하지 않습니다</strong>)</td>
                    <td className="p-3">Microsoft OAuth(Xbox·Mojang 인증 흐름) 또는 인게임 /웹연동 코드</td>
                  </tr>
                  <tr>
                    <td className="p-3 font-bold text-neutral-800 dark:text-neutral-200">연동 허브 (auth.craftopia.work)</td>
                    <td className="p-3">Discord ID·사용자명, 마인크래프트 UUID·사용자명을 하나의 연동 신원으로 묶어 보관</td>
                    <td className="p-3">허브에서의 Discord/Minecraft 연결</td>
                  </tr>
                  <tr>
                    <td className="p-3 font-bold text-neutral-800 dark:text-neutral-200">프로필·포트폴리오</td>
                    <td className="p-3"><span className="text-neutral-400">[선택]</span> 표시명(닉네임), 프로필 아바타·배너 이미지, 자기소개, 연락 이메일, SNS 링크(Patreon·X(Twitter)·YouTube·Instagram), 테마 설정, 프로젝트·위젯·작업로그(WIP)의 제목·설명 및 업로드 이미지·영상</td>
                    <td className="p-3">대시보드 직접 입력·파일 업로드</td>
                  </tr>
                  <tr>
                    <td className="p-3 font-bold text-neutral-800 dark:text-neutral-200">방문자 문의(Contact)</td>
                    <td className="p-3"><span className="text-neutral-400">[선택]</span> 보내는 사람 이름, 이메일 주소, 문의 메시지 내용, 회신 답변 내용</td>
                    <td className="p-3">크리에이터 포트폴리오 문의 폼 입력</td>
                  </tr>
                  <tr>
                    <td className="p-3 font-bold text-neutral-800 dark:text-neutral-200">월드 클라우드·플롯·경매</td>
                    <td className="p-3">월드 메타데이터(이름·버전·용량·보더·게임룰), 업로드한 월드 .zip 및 백업 데이터, 초대 멤버의 UUID·닉네임, 플롯 ID·좌표·소유/초대 멤버 UUID, 양도 대상 닉네임, 경매 가격, 보유 코인(CMI) 잔액, LuckPerms 그룹(역할 동기화)</td>
                    <td className="p-3">대시보드·인게임 조작, 마크 서버 연동 동기화</td>
                  </tr>
                  <tr>
                    <td className="p-3 font-bold text-neutral-800 dark:text-neutral-200">계정 보안 (2FA)</td>
                    <td className="p-3"><span className="text-neutral-400">[선택]</span> 2단계 인증(TOTP) 보안 키, 활성화 여부</td>
                    <td className="p-3">대시보드 보안 설정</td>
                  </tr>
                  <tr>
                    <td className="p-3 font-bold text-neutral-800 dark:text-neutral-200">자동 수집 항목</td>
                    <td className="p-3">접속 IP 주소, 쿠키(세션·OAuth state), 접속·로그인 일시, 웹 브라우저/OS 정보, 서비스 이용·조작 로그(CreatorLog·AuditLog·WipLog)</td>
                    <td className="p-3">서비스 이용 과정에서 자동 생성·수집</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-bold text-black dark:text-white">2. 개인정보의 수집 및 이용 목적</h2>
            <p>수집한 개인정보는 다음의 목적을 위해서만 이용하며, 목적이 변경될 경우 「개인정보 보호법」 제18조에 따라 별도의 동의를 받는 등 필요한 조치를 이행합니다.</p>
            <ul className="list-disc list-inside space-y-1.5 pl-2 text-neutral-500 dark:text-neutral-500 text-xs">
              <li>회원 가입 의사 확인, 본인 식별·인증, 불량 회원의 부정 이용 방지</li>
              <li>개인별 크리에이터 포트폴리오 하위 도메인 개설 및 편집 권한 제공</li>
              <li>Discord·마인크래프트 계정 연동 및 연동 신원(허브) 관리, 인게임-웹 권한·역할 동기화</li>
              <li>공식 Discord 서버(커뮤니티) 가입 여부 확인을 통한 건축 서버 이용 자격(권한) 부여 및 회수 — 연동 시점 및 주기적으로 서버 가입 상태를 확인하며, 서버를 떠난 경우 관련 인게임·웹 건축 권한을 자동으로 회수합니다(연동 식별자는 삭제하지 않아 재가입 시 권한이 자동 복구됩니다)</li>
              <li>마인크래프트 영토(플롯)·개인 월드 클라우드 생성·백업·초대·양도·경매 등 영토 관리 기능 제공</li>
              <li>Patreon 후원자 본인 인증 및 그에 따른 구독 혜택(포트폴리오 사이트·클라우드 용량 등) 부여</li>
              <li>2단계 인증(2FA)을 통한 계정 보안 보호 및 보안 알림</li>
              <li>외부 방문자 문의의 접수·전달 및 답변 회신</li>
              <li>보안 침해사고 대응, 접속 이력 모니터링을 통한 비인가 접근 차단 및 분쟁 발생 시 증빙</li>
              <li>이용이 정지·제한된 회원의 제재 회피(부계정 재가입·재연동) 방지를 위한 차단 식별자 대조 (근거: 「개인정보 보호법」 제15조 제1항 제6호 개인정보처리자의 정당한 이익 및 가입 시 동의. 식별자는 단방향 해시로만 보관)</li>
              <li>이메일 인증 등 서비스 운영에 필요한 통지 발송</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-bold text-black dark:text-white">3. 개인정보의 보유 및 이용 기간</h2>
            <p>이용자의 개인정보는 회원 탈퇴 시 혹은 수집 및 이용목적이 달성된 후 지체 없이 파기하는 것을 원칙으로 합니다. 다만 관계 법령에 규정이 있거나 서비스 특성상 보존이 필요한 경우 아래 기간 동안 안전하게 보관합니다.</p>
            <ul className="list-disc list-inside space-y-1 pl-2 text-xs">
              <li><strong>법령에 따른 보존</strong></li>
              <ul className="list-[circle] list-inside space-y-0.5 pl-5 text-neutral-500 dark:text-neutral-500">
                <li>웹사이트 방문·로그인 접속 기록: 3개월 (통신비밀보호법)</li>
                <li>소비자 불만 또는 분쟁처리에 관한 기록: 3년 (전자상거래 등에서의 소비자보호에 관한 법률)</li>
                <li>계약 또는 청약철회 등에 관한 기록: 5년 (전자상거래 등에서의 소비자보호에 관한 법률)</li>
              </ul>
              <li className="mt-1"><strong>서비스 운영에 따른 보존</strong></li>
              <ul className="list-[circle] list-inside space-y-0.5 pl-5 text-neutral-500 dark:text-neutral-500">
                <li>이메일/Discord/마인크래프트 인증 코드 및 OAuth 상태값: 발급 후 단기간(약 10분~24시간) 내 자동 파기</li>
                <li>개인 월드 클라우드 데이터: 마지막 사용일로부터 30일 미사용 시 아카이브, 아카이브 후 90일(최종 미사용 약 120일) 경과 시 영구 삭제(수명주기 정책)</li>
                <li>재해 복구용 데이터베이스 백업본(국외 저장소 포함): 최대 5년 후 자동 삭제(개인정보가 포함될 수 있음)</li>
                <li>제재 회피 방지를 위한 차단 식별자(마인크래프트 UUID·Discord ID·이메일의 단방향 해시값 — 원문 미보관): 회원의 다른 개인정보와 분리하여 저장하며, 재가입 차단에 필요한 기간(등록일 기준 최대 3년) 동안 보관합니다. 관리자가 정기적으로 재검토하여 차단 필요가 소멸한 항목은 파기합니다.</li>
              </ul>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-bold text-black dark:text-white">4. 개인정보의 제3자 제공</h2>
            <p>회사는 이용자의 개인정보를 본 방침에 명시한 범위를 초과하여 제3자에게 제공하지 않습니다. 다만 다음의 경우는 예외로 합니다.</p>
            <ul className="list-disc list-inside space-y-1 pl-2 text-xs">
              <li>이용자가 사전에 명시적으로 동의한 경우</li>
              <li>법령에 특별한 규정이 있거나, 수사기관이 법령에 정한 절차와 방법에 따라 요청하는 경우</li>
            </ul>
            <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-1">
              ※ 영토 초대·양도·경매 진행 시 닉네임/UUID 등 일부 정보가 마인크래프트 게임 내 다른 이용자에게 표시될 수 있습니다. 이는 동일 운영자가 운영하는 게임 서버 내 기능 동작이며 외부 제3자 제공이 아닙니다.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-bold text-black dark:text-white">5. 개인정보 처리의 위탁 및 국외 이전</h2>
            <p>회사는 원활한 서비스 제공을 위해 아래와 같이 개인정보 처리 업무를 국외 사업자에게 위탁하고 있습니다. 「개인정보 보호법」 제28조의8에 따라 국외 이전 사항을 다음과 같이 고지합니다.</p>

            <div className="border border-neutral-200 dark:border-neutral-800 rounded-xl overflow-hidden text-xs">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-neutral-50 dark:bg-neutral-900/50 border-b border-neutral-200 dark:border-neutral-800 font-bold text-neutral-700 dark:text-neutral-300">
                    <th className="p-3">이전받는 자 (수탁자)</th>
                    <th className="p-3">이전 항목</th>
                    <th className="p-3">이전 국가</th>
                    <th className="p-3">이전 시점·방법</th>
                    <th className="p-3">이용 목적 및 보유 기간</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800 text-neutral-600 dark:text-neutral-400">
                  <tr>
                    <td className="p-3 font-bold text-neutral-800 dark:text-neutral-200">Resend, Inc.</td>
                    <td className="p-3">수신자 이메일 주소, 인증 메일 내용</td>
                    <td className="p-3">미국</td>
                    <td className="p-3">메일 발송 시점에 HTTPS API 전송</td>
                    <td className="p-3">회원가입 인증·서비스 통지 메일 발송 / 위탁계약 종료 또는 수탁사 정책에 따른 처리 시까지</td>
                  </tr>
                  <tr>
                    <td className="p-3 font-bold text-neutral-800 dark:text-neutral-200">Cloudflare, Inc.</td>
                    <td className="p-3">서비스 전 구간 접속 트래픽(접속 IP 포함), 데이터베이스 백업 파일(개인정보 포함 가능)</td>
                    <td className="p-3">미국 등 글로벌</td>
                    <td className="p-3">서비스 접속 시 상시(Tunnel/CDN), 백업 시점 전송(R2)</td>
                    <td className="p-3">안전한 접속 중계·보안 및 재해 복구 백업 / 백업본 최대 5년</td>
                  </tr>
                  <tr>
                    <td className="p-3 font-bold text-neutral-800 dark:text-neutral-200">Microsoft / Mojang Studios</td>
                    <td className="p-3">OAuth 인가 코드 및 인증 토큰(이용자 본인이 직접 로그인), 회신되는 마인크래프트 UUID·닉네임</td>
                    <td className="p-3">미국 등</td>
                    <td className="p-3">이용자 본인이 직접 Microsoft 로그인으로 마인크래프트 연동을 진행하는 시점(이용자가 사용하는 제3자 인증 서비스이며 회사의 처리위탁이 아님)</td>
                    <td className="p-3">마인크래프트 정품 계정 본인 인증 / 인증 절차 동안에만 처리(토큰 미저장)</td>
                  </tr>
                  <tr>
                    <td className="p-3 font-bold text-neutral-800 dark:text-neutral-200">Discord, Inc.</td>
                    <td className="p-3">OAuth 인가 코드(이용자가 직접 로그인), 회신되는 Discord ID·사용자명, 서버 가입 여부 확인을 위한 Discord ID 조회 요청</td>
                    <td className="p-3">미국</td>
                    <td className="p-3">Discord 계정 연동 시점 및 서버 가입 여부 주기적 재확인 시 HTTPS API 요청</td>
                    <td className="p-3">Discord 계정 본인 인증·연동 및 공식 서버 가입 여부 확인(건축 이용 자격 판단) / 연동·확인 시점에만 처리(토큰 미저장)</td>
                  </tr>
                  <tr>
                    <td className="p-3 font-bold text-neutral-800 dark:text-neutral-200">Patreon, Inc.</td>
                    <td className="p-3">OAuth 인가 코드(이용자가 직접 로그인), 회신되는 Patreon 사용자 ID·표시 이름·후원 상태 (후원 금액·이메일 등 그 외 정보는 저장하지 않음)</td>
                    <td className="p-3">미국</td>
                    <td className="p-3">이용자가 Patreon 후원 연동을 진행하는 시점</td>
                    <td className="p-3">Patreon 후원자 본인 인증 및 구독 혜택 부여 / 인증 절차 동안에만 처리(토큰 미저장)</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-1">
              이용자는 「개인정보 보호법」 제28조의8 제1항 단서 및 동법 시행령에 따라 개인정보의 국외 이전을 거부할 수 있습니다. 다만 이메일 인증·계정 연동·백업 등 해당 기능 이용이 제한될 수 있습니다. 거부 의사는 개인정보 보호책임자에게 요청하실 수 있습니다.
            </p>

            <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 rounded-xl p-4 text-xs text-amber-800 dark:text-amber-300 font-medium mt-2 space-y-1">
              <p className="font-bold text-amber-900 dark:text-amber-200">⚠️ 마인크래프트 관련 비제휴 고지 (Non-affiliation Notice)</p>
              <p>
                본 서비스(BlockCanvas)는 Mojang Studios 또는 Microsoft의 공식 마인크래프트 제품·서비스가 아니며, 이들로부터 승인받거나 제휴·후원 관계에 있지 않습니다. &quot;Minecraft&quot;, &quot;Mojang&quot;은 각 사의 상표입니다. 본 서비스는 마인크래프트 정품 계정 보유 여부 확인(본인 인증) 목적으로만 이용자 본인이 직접 수행하는 Microsoft 로그인을 이용하며, 인증 과정의 토큰은 저장하지 않습니다.
              </p>
              <p className="text-[11px] text-amber-700 dark:text-amber-400/80">NOT AN OFFICIAL MINECRAFT PRODUCT. NOT APPROVED BY OR ASSOCIATED WITH MOJANG OR MICROSOFT.</p>
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-bold text-black dark:text-white">6. 개인정보의 파기절차 및 파기방법</h2>
            <p>개인정보 보유기간이 경과하거나 수집 목적이 달성된 개인정보는 다음의 절차와 방법으로 지체 없이 파기합니다.</p>
            <ul className="list-disc list-inside space-y-1 pl-2 text-xs">
              <li><strong>파기절차</strong>: 회원 탈퇴(계정 삭제) 시 데이터베이스의 관련 레코드가 연관 데이터(프로젝트·포트폴리오·연동·플롯·월드 등)와 함께 즉시 영구 삭제(Cascade Delete)됩니다. 서버에 저장된 업로드 이미지·영상 등 물리 파일은 탈퇴 직후 정기 정리 절차(미참조 파일 자동 삭제)를 통해 지체 없이 제거되며, 보안·감사 로그는 위 보유기간(접속·이용 기록 3개월)에 따라 분리 정리됩니다.</li>
              <li><strong>파기방법</strong>: 전자적 파일 형태로 저장된 개인정보는 기록을 재생할 수 없는 기술적 방법으로 완전히 삭제하며, 출력물이 있는 경우 분쇄하거나 소각합니다.</li>
              <li><strong>분리 보관</strong>: 법령에 따라 보존해야 하는 정보는 별도의 보관 정책에 따라 다른 정보와 분리하여 안전하게 보관 후 기한 경과 시 파기합니다. 재해 복구용 백업본에 포함된 정보는 보존 주기가 경과하면 자동 삭제됩니다.</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-bold text-black dark:text-white">7. 이용자 및 법정대리인의 권리와 그 행사방법</h2>
            <p>이용자(만 14세 미만 아동의 경우 법정대리인)는 정보주체로서 언제든지 다음의 권리를 행사할 수 있습니다.</p>
            <ul className="list-disc list-inside space-y-1 pl-2 text-xs">
              <li>개인정보 열람 요구 · 오류 등에 대한 정정·삭제 요구 · 처리정지 요구 · 동의 철회</li>
              <li>대시보드 [프로필 및 설정] 및 [계정 및 보안 관리] 메뉴에서 개인정보를 직접 조회·수정하거나 연동 해제·회원 탈퇴를 진행할 수 있습니다. 계정 삭제 시 보안을 위해 비밀번호(및 2FA 사용 시 OTP) 재인증을 요구합니다.</li>
              <li>개인정보 보호책임자에게 이메일로 요청하시는 경우, 본인 확인 후 지체 없이(법령상 10일 이내) 조치합니다.</li>
              <li>권리 행사는 대리인을 통하여도 가능하며, 이 경우 위임장을 제출해야 합니다.</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-bold text-black dark:text-white">8. 개인정보의 안전성 확보 조치</h2>
            <p>회사는 「개인정보 보호법」 제29조에 따라 개인정보의 안전성 확보를 위해 다음과 같은 기술적·관리적·물리적 보호조치를 시행하고 있습니다.</p>
            <ul className="list-disc list-inside space-y-1 pl-2 text-xs">
              <li><strong>비밀번호 및 인증정보 보호</strong>: 비밀번호는 PBKDF2 + bcrypt 일방향 암호화로 저장되어 원문을 복원할 수 없으며, 선택적 2단계 인증(TOTP)을 제공합니다.</li>
              <li><strong>세션·전송 보안</strong>: 세션 토큰은 HMAC-SHA256으로 서명되고 30일 후 만료되며 HttpOnly 쿠키로 관리됩니다. 모든 통신은 HTTPS로 암호화 전송됩니다.</li>
              <li><strong>접근 통제</strong>: 역할 기반 권한 관리로 개인정보 접근 권한을 최소 인원으로 제한하고, 관리자 활동을 감사 로그로 기록합니다.</li>
              <li><strong>부정 이용 방지</strong>: 로그인 등에 무차별 대입 방지(레이트리밋), 업로드 파일 검증, 경로 탐색 차단을 적용하며, 월드 폴더명은 SHA-256으로 익명화하여 닉네임 노출을 방지합니다.</li>
              <li><strong>백업·복구</strong>: 데이터는 주기적으로 백업되며 국외 저장소 백업본은 보존 주기에 따라 자동 삭제됩니다.</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-bold text-black dark:text-white">9. 만 14세 미만 아동의 개인정보 처리</h2>
            <p>회사는 원칙적으로 만 14세 미만 아동의 회원가입을 받지 않으며, 만 14세 미만 아동의 개인정보를 수집할 경우 법정대리인의 동의를 받습니다. 마인크래프트 연동 등 일부 기능은 미성년 이용자가 이용할 수 있으므로, 법정대리인은 아동의 개인정보 열람·정정·삭제 및 처리정지를 요구할 수 있습니다. 법정대리인의 동의 없이 아동의 개인정보가 수집된 사실을 인지한 경우, 회사는 해당 정보를 지체 없이 파기합니다.</p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-bold text-black dark:text-white">10. 개인정보를 자동으로 수집하는 장치(쿠키)의 설치·운영 및 거부</h2>
            <p>회사는 로그인 상태 유지 및 보안 인증(OAuth 상태 검증)을 위해 쿠키(Cookie)를 사용합니다. 세션 쿠키는 HttpOnly로 설정되어 스크립트로 접근할 수 없으며, 광고·행태정보 수집 목적의 추적 쿠키는 사용하지 않습니다.</p>
            <p>이용자는 웹 브라우저 설정을 통해 쿠키 저장을 거부하거나 경고를 받도록 설정할 수 있습니다. 다만 쿠키 저장을 거부할 경우 로그인이 필요한 대시보드 등 서비스 이용에 제한을 받을 수 있습니다.</p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-bold text-black dark:text-white">11. 개인정보 보호책임자 지정 및 민원 안내</h2>
            <p>회사는 이용자의 개인정보를 보호하고 개인정보와 관련된 불만을 처리하기 위하여 아래와 같이 개인정보 보호책임자를 지정하고 있습니다.</p>

            <div className="bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 p-5 rounded-xl text-xs space-y-1.5 font-bold">
              <p>👤 개인정보 보호책임자: 김민수</p>
              <p>✉️ 이메일 주소: <a href="mailto:yeonjm1@gmail.com" className="text-neutral-900 dark:text-white underline">yeonjm1@gmail.com</a></p>
              <p>📞 문의 내용: 개인정보 조회/수정/삭제 요청, 약관 동의 철회, 국외 이전 거부, 불만 신고 등</p>
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-bold text-black dark:text-white">12. 권익침해 구제방법</h2>
            <p>정보주체는 개인정보 침해로 인한 구제를 받기 위하여 아래 기관에 분쟁 해결이나 상담 등을 신청할 수 있습니다. 회사의 자체적인 처리에 만족하지 못하거나 보다 자세한 도움이 필요한 경우 문의하시기 바랍니다.</p>
            <ul className="list-disc list-inside space-y-1 pl-2 text-xs text-neutral-500 dark:text-neutral-500">
              <li>개인정보분쟁조정위원회: (국번없이) 1833-6972 / www.kopico.go.kr</li>
              <li>개인정보침해신고센터: (국번없이) 118 / privacy.kisa.or.kr</li>
              <li>대검찰청 사이버수사과: (국번없이) 1301 / www.spo.go.kr</li>
              <li>경찰청 사이버수사국: (국번없이) 182 / ecrm.cyber.go.kr</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-bold text-black dark:text-white">13. 개인정보처리방침의 변경</h2>
            <p>본 개인정보처리방침은 법령·정책 또는 서비스의 변경에 따라 내용이 추가·삭제·수정될 수 있으며, 변경 시에는 시행일자 7일 전(이용자 권리에 중대한 영향을 미치는 변경의 경우 30일 전)부터 서비스 내 공지사항을 통해 고지합니다. 본 페이지 상단의 시행일자와 개정 이력으로 최신 버전을 확인하실 수 있습니다.</p>
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
