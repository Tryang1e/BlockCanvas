import React from 'react'
import Link from 'next/link'
import Image from 'next/image'

export const metadata = {
  title: '이용약관 - BlockCanvas',
  description: 'BlockCanvas(craftopia.work) 플랫폼 및 마인크래프트 서버의 이용약관입니다.',
}

export default function TermsOfServicePage() {
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
            이용약관
          </h1>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-neutral-400 dark:text-neutral-500 font-mono font-medium">
            <span>시행일자: 2026년 6월 23일</span>
            <span>최종 개정: 2026년 6월 23일 (v1)</span>
          </div>
        </div>

        {/* Content Body */}
        <div className="space-y-8 text-sm leading-relaxed text-neutral-600 dark:text-neutral-400 font-medium">

          <section className="bg-white dark:bg-neutral-900 border border-neutral-200/60 dark:border-neutral-800/60 p-6 rounded-2xl shadow-[0_2px_8px_rgba(0,0,0,0.01)]">
            <p>
              본 약관은 <strong>BlockCanvas</strong>(서비스 운영 도메인 craftopia.work, 이하 &apos;회사&apos; 또는 &apos;서비스&apos;)가 제공하는 웹 플랫폼(크리에이터 포트폴리오·대시보드·월드 클라우드 등) 및 연동된 마인크래프트 건축 서버(이하 통칭 &apos;서비스&apos;)의 이용에 관한 회사와 이용자(이하 &apos;회원&apos;)의 권리·의무 및 책임사항을 규정함을 목적으로 합니다.
            </p>
            <p className="mt-2">
              회원은 서비스 이용에 앞서 본 약관 및 <Link href="/privacy" className="text-neutral-900 dark:text-white underline">개인정보처리방침</Link>을 충분히 읽고 동의한 것으로 간주됩니다. 본 약관에서 정하지 아니한 사항은 관계 법령 및 회사가 별도로 고지하는 운영정책·서버 규칙에 따릅니다.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-bold text-black dark:text-white">제1조 (용어의 정의)</h2>
            <p>본 약관에서 사용하는 용어의 정의는 다음과 같습니다.</p>
            <ul className="list-disc list-inside space-y-1.5 pl-2 text-xs text-neutral-500 dark:text-neutral-500">
              <li><strong>회원</strong>: 본 약관에 동의하고 회원가입(이메일·Discord) 또는 마인크래프트 계정 연동을 통해 서비스를 이용하는 자.</li>
              <li><strong>웹 플랫폼</strong>: 크리에이터 포트폴리오 하위 도메인, 대시보드, 월드 클라우드, 영토(플롯) 관리·경매 등 회사가 웹으로 제공하는 일체의 기능.</li>
              <li><strong>마인크래프트 서버</strong>: 회사가 운영하는 건축 중심 마인크래프트 게임 서버.</li>
              <li><strong>영토(플롯)·월드</strong>: 회원에게 배정·생성되는 건축 공간 및 개인 월드 클라우드 데이터.</li>
              <li><strong>코인</strong>: 서비스 내 활동 보상·구매 등에 사용되는 가상의 재화로, 현금으로 환급되지 않는 서비스 내 전용 포인트.</li>
              <li><strong>게시물</strong>: 회원이 서비스에 게시·업로드한 텍스트·이미지·영상·건축물·스키매틱(.schem 등)·월드 데이터 등 일체의 콘텐츠.</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-bold text-black dark:text-white">제2조 (약관의 효력 및 변경)</h2>
            <ul className="list-disc list-inside space-y-1.5 pl-2 text-xs">
              <li>본 약관은 서비스 화면에 게시하거나 기타의 방법으로 회원에게 공지함으로써 효력이 발생합니다.</li>
              <li>회사는 관련 법령을 위배하지 않는 범위에서 본 약관을 개정할 수 있으며, 개정 시 적용일자 및 개정사유를 명시하여 시행일자 7일 전(회원에게 불리하거나 중대한 변경의 경우 30일 전)부터 공지합니다.</li>
              <li>회원이 개정 약관의 적용일 이후에도 서비스를 계속 이용하는 경우 개정 약관에 동의한 것으로 봅니다. 동의하지 않는 회원은 이용계약을 해지(회원 탈퇴)할 수 있습니다.</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-bold text-black dark:text-white">제3조 (이용계약의 체결 및 계정)</h2>
            <ul className="list-disc list-inside space-y-1.5 pl-2 text-xs">
              <li>이용계약은 회원이 되고자 하는 자가 약관에 동의하고 가입 신청을 한 후 회사가 이를 승낙함으로써 체결됩니다.</li>
              <li>회사는 실명·실제 정보가 아닌 신청, 타인의 명의·계정 도용, 부정한 목적의 신청, 만 14세 미만 아동의 법정대리인 동의 없는 신청, 과거 이용제한·강제탈퇴 이력이 있는 경우 등에 대하여 승낙을 거부하거나 사후에 이용계약을 해지할 수 있습니다.</li>
              <li>회원은 계정(이메일·비밀번호 및 연동된 Discord·마인크래프트 계정)의 관리 책임을 지며, 이를 타인에게 양도·대여·공유할 수 없습니다. 계정의 부정 사용을 인지한 경우 즉시 회사에 통지하여야 하며, 통지를 게을리하여 발생한 불이익에 대해 회사는 책임지지 않습니다.</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-bold text-black dark:text-white">제4조 (서비스의 제공 및 변경·중단)</h2>
            <ul className="list-disc list-inside space-y-1.5 pl-2 text-xs">
              <li>회사는 웹 플랫폼 및 마인크래프트 서버를 연중무휴 24시간 제공함을 원칙으로 합니다. 다만 서버 점검·업데이트, 설비 보수, 통신 두절, 천재지변 등 불가피한 사유가 있는 경우 서비스의 전부 또는 일부를 일시 중단할 수 있습니다.</li>
              <li>회사는 운영상·기술상의 필요에 따라 제공하는 서비스의 내용(맵·월드·플러그인·기능·구독 혜택 등)을 변경할 수 있으며, 중대한 변경은 사전에 공지합니다.</li>
              <li>본 서비스는 자체 호스팅 환경에서 운영되며, 데이터 백업에도 불구하고 예기치 못한 장애로 인한 데이터 손실이 발생할 수 있습니다. 회원은 중요한 창작물을 별도로 보관할 것을 권장합니다.</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-bold text-black dark:text-white">제5조 (회원의 일반 의무 및 금지행위)</h2>
            <p>회원은 다음 각 호의 행위를 하여서는 안 되며, 위반 시 제8조에 따른 제재 대상이 됩니다.</p>
            <ul className="list-disc list-inside space-y-1.5 pl-2 text-xs">
              <li>가입·연동 정보에 허위 내용을 등록하거나 타인의 정보·계정을 도용하는 행위</li>
              <li>회사 또는 제3자의 지식재산권·초상권 등 권리를 침해하는 행위</li>
              <li>음란·폭력적·차별적·혐오 표현, 욕설, 타인에 대한 괴롭힘·스토킹·명예훼손 등 타인의 권리나 존엄을 침해하는 행위</li>
              <li>서비스의 정상적인 운영을 방해하거나, 비정상적인 방법으로 서버·서비스에 접근·요청을 발생시키는 행위</li>
              <li>회사의 사전 승인 없이 서비스를 영리 목적으로 이용하거나, 자동화된 수단(봇·매크로·크롤러 등)으로 서비스를 이용하는 행위</li>
              <li>법령 또는 본 약관·운영정책·서버 규칙이 금지하거나 공서양속에 반하는 일체의 행위</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-bold text-black dark:text-white">제6조 (마인크래프트 서버 및 영토·월드 이용 규칙 — 테러 및 서버 보호)</h2>
            <p>마인크래프트 서버는 건축과 창작을 위한 공간입니다. 회원은 다음의 규칙을 준수하여야 하며, 아래 행위는 다른 이용자의 창작물과 서버 운영에 중대한 피해를 주는 행위로서 <strong>엄격히 금지</strong>됩니다.</p>
            <ul className="list-disc list-inside space-y-1.5 pl-2 text-xs">
              <li><strong>테러·그리핑 금지</strong>: 권한이 없는 타인의 영토·건축물·월드를 무단으로 파괴·변경·도용·낙서하거나, 신뢰(trust)·초대를 악용하여 손괴하는 일체의 행위.</li>
              <li><strong>핵·치트·비인가 클라이언트 금지</strong>: 핵 클라이언트, 비인가 모드, 익스플로잇, 버그·복사(duplication) 악용 등 공정한 이용을 해치는 행위. 서버에서 허용하지 않는 맵·미니맵 등의 적용을 포함합니다.</li>
              <li><strong>서버 부하 유발 금지</strong>: 과도한 엔티티·레드스톤·청크 로딩 등 의도적으로 서버에 렉(lag)·과부하를 유발하는 장치나 행위.</li>
              <li><strong>악용·우회 금지</strong>: 아이템·몹·텍스트의 비정상적 변조, 사칭, 권한·제재 우회, 이용제한 회피를 위한 우회 접속 또는 부계정 생성.</li>
              <li><strong>이동·상호작용 규칙</strong>: 텔레포트(/tp) 등 이용자 간 상호작용 기능은 상대방이 허용(/tptoggle)한 범위 내에서만 이용하여야 하며, 허용하지 않은(차단한) 이용자에 대한 우회·강제 접근을 시도해서는 안 됩니다.</li>
            </ul>
            <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-1">
              ※ 회사는 그리핑·테러 등 피해 발생 시 가능한 범위에서 백업을 통한 복구를 지원할 수 있으나, 복구를 보장하지는 않습니다. 피해 행위자에 대해서는 영구 이용제한 및 관계 법령에 따른 책임을 물을 수 있습니다.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-bold text-black dark:text-white">제7조 (게시물 및 콘텐츠 — 커뮤니티 이용 권한과 책임)</h2>
            <ul className="list-disc list-inside space-y-1.5 pl-2 text-xs">
              <li><strong>권리 귀속</strong>: 회원이 작성·업로드한 게시물(건축물·스키매틱·월드·포트폴리오 등)의 저작권은 해당 회원에게 있습니다. 단, 회원은 서비스의 운영·전시·홍보 및 정상적인 기능 제공(미리보기·썸네일 생성·백업 등)에 필요한 범위에서 회사가 게시물을 사용·복제·전시할 수 있는 권한을 무상으로 부여합니다.</li>
              <li><strong>게시 책임</strong>: 게시물의 내용에 대한 책임은 게시한 회원에게 있으며, 회원은 제3자의 저작물·권리를 침해하지 않는 콘텐츠만 게시하여야 합니다.</li>
              <li><strong>커뮤니티 이용 권한</strong>: 전시관·게시판 등 커뮤니티 기능에서 회원은 좋아요·이모지 반응·댓글 등으로 상호작용할 수 있으며, 이러한 활동에 따라 코인 등 보상이 지급될 수 있습니다. 보상 적립을 목적으로 한 자전·어뷰징(다중계정·반복 반응·담합 등)은 금지되며, 적발 시 보상 회수 및 제재 대상이 됩니다.</li>
              <li><strong>게시물의 관리</strong>: 회사는 게시물이 본 약관·법령에 위반되거나 타인의 권리를 침해한다고 판단되는 경우, 사전 통지 없이 해당 게시물을 비공개·삭제하거나 접근을 제한할 수 있습니다.</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-bold text-black dark:text-white">제8조 (이용제한 및 제재)</h2>
            <ul className="list-disc list-inside space-y-1.5 pl-2 text-xs">
              <li>회사는 회원이 본 약관·운영정책·서버 규칙을 위반하는 경우, 위반의 정도에 따라 경고, 기능 제한, 게시물 삭제, 영토·코인 회수, 일시 정지, 영구 이용제한(강제 탈퇴) 등의 조치를 단계적 또는 즉시 취할 수 있습니다.</li>
              <li>테러·그리핑, 핵·치트, 타인의 권리에 대한 중대한 침해 등 사안이 중대한 경우 사전 경고 없이 즉시 영구 이용제한을 적용할 수 있습니다. 다만 경미한 최초 위반에 대해서는 기간제(유기) 제한 등 위반의 경중에 상응하는 조치를 우선 적용합니다.</li>
              <li><strong>제재 회피 방지(접근 차단)</strong>: 회사는 이용이 정지·제한된 회원이 부계정 생성·재가입 등으로 제재를 회피하는 것을 방지하기 위하여, 위반과 관련된 식별자(마인크래프트 UUID·Discord ID·이메일 등)를 접근 차단 목록에 등록하여 신규 가입 및 계정 연동을 거부할 수 있습니다. 해당 식별자는 원문이 아닌 단방향 해시로 보관되며, 오직 BlockCanvas 서비스의 가입·연동 거부 목적으로만 사용됩니다(제3자 공유·타 목적 이용 금지). 등록·해제는 사유 기록을 전제로 하며 이의제기 대상입니다.</li>
              <li>회원은 제재에 대해 회사가 정한 절차(개인정보 보호책임자 또는 운영진 문의처)를 통해 이의를 제기할 수 있으며, 회사는 이를 검토하여 회신합니다.</li>
              <li>이용제한 시 무상으로 적립된 코인 및 이미 정상적으로 이용·소진된 혜택은 별도 보상 대상이 아닙니다. 다만 회원의 귀책(약관 위반)으로 인한 이용제한의 경우에도, 회사는 미사용 유료 혜택(유상으로 취득한 구독 잔여 기간 등)에 대하여 위반과 인과관계 있는 회사의 실제 손해를 상계한 후 남는 금액을 관계 법령에 따라 환급합니다.</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-bold text-black dark:text-white">제9조 (코인 등 가상 재화)</h2>
            <ul className="list-disc list-inside space-y-1.5 pl-2 text-xs">
              <li>코인은 서비스 내 활동(접속·게시·반응 등)에 대한 보상 또는 서비스가 정한 방법으로 획득할 수 있는 <strong>서비스 내 전용 포인트</strong>로서, 현금 또는 그에 준하는 가치로 환급·환전되지 않습니다.</li>
              <li>코인은 회사가 정한 범위 내에서 상점(치장·칭호·닉네임 변경권·플롯 구매권 등) 이용 및 회원 간 이전(거래)에 사용될 수 있으며, 회사는 운영상 필요에 따라 적립·사용·이전 정책 및 비율을 변경할 수 있습니다.</li>
              <li>부정한 방법(어뷰징·버그 악용·비정상 거래 등)으로 획득·이전된 코인은 사전 통지 없이 회수·소멸될 수 있습니다.</li>
              <li>코인은 현금으로 환급되지 않는 서비스 내 전용 포인트이므로, 회원 탈퇴 또는 이용제한 시 보유 코인 및 코인으로 해금한 항목은 원칙적으로 소멸되며 별도의 현금 환급 대상이 아닙니다. 다만 현금 등 유상으로 취득한 유료 혜택의 환불은 제8조·제10조 및 관계 법령에 따릅니다.</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-bold text-black dark:text-white">제10조 (구독 등 유료 서비스)</h2>
            <ul className="list-disc list-inside space-y-1.5 pl-2 text-xs">
              <li>회사는 Block Canvas 구독 등 부가 혜택(치장·칭호 해금, 내부 자료 다운로드, 보상 배율, 클라우드 사용권한 등)을 제공할 수 있으며, 구체적인 내용·기간·가격은 각 상품의 안내에 따릅니다.</li>
              <li>구독 혜택의 구성은 변경될 수 있으며, 회원에게 불리한 중대한 변경은 사전에 공지합니다.</li>
              <li>유료 결제·청약철회·환불에 관한 사항은 「전자상거래 등에서의 소비자보호에 관한 법률」 등 관계 법령 및 회사가 별도로 고지하는 환불 정책에 따릅니다. 회원의 약관 위반으로 인한 이용제한의 경우, 잔여 기간에 대한 환불은 위반과 인과관계 있는 회사의 실제 손해를 상계한 범위에서 제한될 수 있습니다.</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-bold text-black dark:text-white">제11조 (회사의 지식재산권)</h2>
            <p>서비스 자체 및 서비스에 포함된 회사 제작 저작물(로고·디자인·UI·플러그인·코드 등)에 대한 지식재산권은 회사에 귀속됩니다. 회원은 회사의 사전 서면 동의 없이 이를 복제·배포·전송·출판·2차적 저작물 작성 등의 방법으로 이용하거나 제3자에게 이용하게 할 수 없습니다.</p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-bold text-black dark:text-white">제12조 (마인크래프트 관련 비제휴 고지)</h2>
            <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 rounded-xl p-4 text-xs text-amber-800 dark:text-amber-300 font-medium space-y-1">
              <p>
                본 서비스(BlockCanvas)는 Mojang Studios 또는 Microsoft의 공식 마인크래프트 제품·서비스가 아니며, 이들로부터 승인받거나 제휴·후원 관계에 있지 않습니다. &quot;Minecraft&quot;, &quot;Mojang&quot;은 각 사의 상표입니다. 회원은 마인크래프트 정품 계정 및 Mojang/Microsoft의 이용약관을 별도로 준수하여야 합니다.
              </p>
              <p className="text-[11px] text-amber-700 dark:text-amber-400/80">NOT AN OFFICIAL MINECRAFT PRODUCT. NOT APPROVED BY OR ASSOCIATED WITH MOJANG OR MICROSOFT.</p>
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-bold text-black dark:text-white">제13조 (면책조항)</h2>
            <ul className="list-disc list-inside space-y-1.5 pl-2 text-xs">
              <li>회사는 천재지변, 통신 장애, 정전, 회원의 귀책 등 회사의 합리적 통제를 벗어난 사유로 인한 서비스 제공의 장애 및 데이터 손실에 대하여 책임을 지지 않습니다.</li>
              <li>회사는 회원 상호 간 또는 회원과 제3자 간에 서비스를 매개로 발생한 분쟁(영토 거래·경매·코인 거래 등 포함)에 대하여 개입할 의무가 없으며, 이로 인한 손해를 배상할 책임이 없습니다.</li>
              <li>회사는 회원이 게시한 게시물의 신뢰성·정확성 등 내용에 대하여 책임을 지지 않습니다.</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-bold text-black dark:text-white">제14조 (계약 해지 및 탈퇴)</h2>
            <ul className="list-disc list-inside space-y-1.5 pl-2 text-xs">
              <li>회원은 언제든지 대시보드의 [계정 및 보안 관리] 메뉴를 통해 회원 탈퇴를 신청할 수 있으며, 회사는 관계 법령이 정하는 바에 따라 이를 처리합니다.</li>
              <li>탈퇴 시 회원의 계정 및 연관 데이터(프로필·포트폴리오·연동·플롯·월드·코인 등)는 개인정보처리방침이 정한 바에 따라 처리·파기됩니다.</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-bold text-black dark:text-white">제15조 (준거법 및 분쟁 해결)</h2>
            <p>본 약관 및 서비스 이용에 관하여는 대한민국 법령을 준거법으로 하며, 서비스 이용과 관련하여 회사와 회원 간에 발생한 분쟁에 대해서는 민사소송법상의 관할 법원을 제1심 관할 법원으로 합니다. 분쟁의 원만한 해결을 위해 회원은 먼저 아래 문의처를 통해 회사와 협의할 수 있습니다.</p>
            <div className="bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 p-5 rounded-xl text-xs space-y-1.5 font-bold mt-2">
              <p>✉️ 문의: <a href="mailto:yeonjm1@gmail.com" className="text-neutral-900 dark:text-white underline">yeonjm1@gmail.com</a></p>
              <p>📄 관련 문서: <Link href="/privacy" className="text-neutral-900 dark:text-white underline">개인정보처리방침</Link></p>
            </div>
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
