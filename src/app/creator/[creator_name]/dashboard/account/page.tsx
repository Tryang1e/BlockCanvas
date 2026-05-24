import { prisma } from '@/lib/prisma'
import { notFound } from 'next/navigation'
import PasswordForm from '@/components/creator/PasswordForm'
import AccountDeletion from '@/components/creator/AccountDeletion'

export default async function DashboardAccountPage({
  params,
}: {
  params: Promise<{ creator_name: string }>
}) {
  const { creator_name } = await params
  
  const profile = await prisma.profile.findUnique({
    where: { creator_name },
  })

  if (!profile) {
    notFound()
  }

  return (
    <div className="animate-in fade-in zoom-in-95 duration-500">
      <div className="mb-8">
        <h1 className="text-3xl font-black text-neutral-900 tracking-tight mb-2">계정 관리</h1>
        <p className="text-neutral-500 font-medium">로그인 정보와 보안, 계정 설정을 관리하세요.</p>
      </div>

      <div className="bg-white rounded-2xl shadow-[0_2px_10px_rgba(0,0,0,0.02)] border border-neutral-200 overflow-hidden p-8 space-y-10">
        
        {/* Section: Account Info */}
        <section>
          <h2 className="text-lg font-bold border-b border-neutral-100 pb-3 mb-5">로그인 및 개인 정보</h2>
          <div className="space-y-6 max-w-lg">
            <div>
              <label className="block text-[11px] font-bold mb-1.5 text-neutral-500 uppercase tracking-wide">로그인 이메일</label>
              <input 
                type="email" 
                defaultValue={profile.email || ''} 
                className="w-full border border-neutral-200 p-3 rounded-lg bg-neutral-50 focus:bg-white focus:outline-none focus:border-black focus:ring-1 focus:ring-black transition-all font-medium text-sm" 
                readOnly
              />
              <p className="text-xs text-neutral-400 mt-2 font-medium">현재 이메일 변경 기능은 지원하지 않습니다. 고객센터로 문의해주세요.</p>
            </div>
            
            <div>
              <label className="block text-[11px] font-bold mb-1.5 text-neutral-500 uppercase tracking-wide">비밀번호 변경</label>
              <PasswordForm creatorName={creator_name} />
            </div>
          </div>
        </section>

        <AccountDeletion creatorName={creator_name} />

      </div>
    </div>
  )
}
