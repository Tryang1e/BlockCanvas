'use client'

import { useState } from 'react'
import { updateProfileAction } from '@/app/actions/profile'

export default function SettingsForm({ profile }: { profile: any }) {
  const [isLoading, setIsLoading] = useState(false)
  const [successMsg, setSuccessMsg] = useState('')

  const defaultSns = {
    discord: false,
    youtube: false,
    twitter: false,
    instagram: false,
    patreon: false,
  }

  const [snsSettings, setSnsSettings] = useState<Record<string, boolean>>(
    profile.sns_settings && Object.keys(profile.sns_settings).length > 0 
      ? profile.sns_settings 
      : defaultSns
  )

  const toggleSns = (key: string) => {
    setSnsSettings(prev => ({ ...prev, [key]: !prev[key] }))
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setIsLoading(true)
    setSuccessMsg('')
    try {
      const formData = new FormData(e.currentTarget)
      formData.append('creator_name', profile.creator_name)
      formData.append('sns_settings', JSON.stringify(snsSettings))
      
      await updateProfileAction(formData)
      setSuccessMsg('설정이 성공적으로 저장되었습니다.')
      setTimeout(() => setSuccessMsg(''), 3000)
    } catch (err) {
      alert('프로필 업데이트 중 오류가 발생했습니다.')
      console.error(err)
    }
    setIsLoading(false)
  }

  return (
    <form onSubmit={handleSubmit} className="p-8 space-y-10">
      
      {/* Section: Basic Info */}
      <section>
        <h2 className="text-lg font-bold border-b border-neutral-100 pb-3 mb-5">기본 정보</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-[11px] font-bold mb-1.5 text-neutral-500 uppercase tracking-wide">표시 이름 (Display Name)</label>
            <input name="display_name" defaultValue={profile.display_name} required className="w-full border border-neutral-200 p-3 rounded-lg bg-neutral-50 focus:bg-white focus:outline-none focus:border-black focus:ring-1 focus:ring-black transition-all font-medium text-sm" />
          </div>
          <div>
            <label className="block text-[11px] font-bold mb-1.5 text-neutral-500 uppercase tracking-wide">직업 / 한 줄 소개 (Headline)</label>
            <input name="headline" defaultValue={profile.headline} placeholder="Minecraft Level Designer" className="w-full border border-neutral-200 p-3 rounded-lg bg-neutral-50 focus:bg-white focus:outline-none focus:border-black focus:ring-1 focus:ring-black transition-all font-medium text-sm" />
          </div>
          <div className="md:col-span-2">
            <label className="block text-[11px] font-bold mb-1.5 text-neutral-500 uppercase tracking-wide">상세 소개 (About Text)</label>
            <textarea name="about_text" defaultValue={profile.about_text} rows={4} className="w-full border border-neutral-200 p-3 rounded-lg bg-neutral-50 focus:bg-white focus:outline-none focus:border-black focus:ring-1 focus:ring-black transition-all font-medium text-sm resize-none" placeholder="방문자에게 자신을 소개하는 문구를 적어주세요."></textarea>
          </div>
          <div className="md:col-span-2">
            <label className="block text-[11px] font-bold mb-1.5 text-neutral-500 uppercase tracking-wide">공식 연락처 (Contact Email)</label>
            <input name="contact_email" defaultValue={profile.contact_email} type="email" placeholder="example@email.com" className="w-full border border-neutral-200 p-3 rounded-lg bg-neutral-50 focus:bg-white focus:outline-none focus:border-black focus:ring-1 focus:ring-black transition-all font-medium text-sm" />
          </div>
        </div>
      </section>

      {/* Section: SNS Links & Visibility */}
      <section>
        <div className="border-b border-neutral-100 pb-3 mb-5 flex flex-col sm:flex-row sm:items-end justify-between gap-2">
          <h2 className="text-lg font-bold">SNS 및 외부 링크 연결</h2>
          <p className="text-xs text-neutral-500 font-medium">우측의 체크박스를 해제하면 포트폴리오에서 임시로 숨길 수 있습니다.</p>
        </div>
        
        <div className="space-y-3">
          {/* Discord */}
          <div className="flex items-center gap-4 p-3 border border-neutral-200 rounded-lg bg-white shadow-sm">
            <div className="flex-1">
              <label className="block text-[11px] font-bold mb-1 text-neutral-500 uppercase tracking-wider">Discord ID</label>
              <input name="discord_id" defaultValue={profile.discord_id} placeholder="User#1234" className="w-full bg-transparent focus:outline-none font-medium text-sm" />
            </div>
            <div className="flex flex-col items-center gap-1 border-l pl-4 border-neutral-100">
              <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">노출</span>
              <input type="checkbox" checked={snsSettings.discord === true} onChange={() => toggleSns('discord')} className="w-4 h-4 accent-black cursor-pointer" />
            </div>
          </div>

          {/* YouTube */}
          <div className="flex items-center gap-4 p-3 border border-neutral-200 rounded-lg bg-white shadow-sm">
            <div className="flex-1">
              <label className="block text-[11px] font-bold mb-1 text-neutral-500 uppercase tracking-wider">YouTube 채널 URL</label>
              <input name="youtube_url" defaultValue={profile.youtube_url} type="text" placeholder="https://youtube.com/@..." className="w-full bg-transparent focus:outline-none font-medium text-sm text-blue-600 placeholder:text-neutral-300" />
            </div>
            <div className="flex flex-col items-center gap-1 border-l pl-4 border-neutral-100">
              <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">노출</span>
              <input type="checkbox" checked={snsSettings.youtube === true} onChange={() => toggleSns('youtube')} className="w-4 h-4 accent-black cursor-pointer" />
            </div>
          </div>

          {/* Twitter (X) */}
          <div className="flex items-center gap-4 p-3 border border-neutral-200 rounded-lg bg-white shadow-sm">
            <div className="flex-1">
              <label className="block text-[11px] font-bold mb-1 text-neutral-500 uppercase tracking-wider">X (Twitter) URL</label>
              <input name="twitter_url" defaultValue={profile.twitter_url} type="text" placeholder="https://x.com/..." className="w-full bg-transparent focus:outline-none font-medium text-sm text-blue-600 placeholder:text-neutral-300" />
            </div>
            <div className="flex flex-col items-center gap-1 border-l pl-4 border-neutral-100">
              <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">노출</span>
              <input type="checkbox" checked={snsSettings.twitter === true} onChange={() => toggleSns('twitter')} className="w-4 h-4 accent-black cursor-pointer" />
            </div>
          </div>

          {/* Instagram */}
          <div className="flex items-center gap-4 p-3 border border-neutral-200 rounded-lg bg-white shadow-sm">
            <div className="flex-1">
              <label className="block text-[11px] font-bold mb-1 text-neutral-500 uppercase tracking-wider">Instagram URL</label>
              <input name="instagram_url" defaultValue={profile.instagram_url} type="text" placeholder="https://instagram.com/..." className="w-full bg-transparent focus:outline-none font-medium text-sm text-blue-600 placeholder:text-neutral-300" />
            </div>
            <div className="flex flex-col items-center gap-1 border-l pl-4 border-neutral-100">
              <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">노출</span>
              <input type="checkbox" checked={snsSettings.instagram === true} onChange={() => toggleSns('instagram')} className="w-4 h-4 accent-black cursor-pointer" />
            </div>
          </div>

          {/* Patreon */}
          <div className="flex items-center gap-4 p-3 border border-neutral-200 rounded-lg bg-white shadow-sm">
            <div className="flex-1">
              <label className="block text-[11px] font-bold mb-1 text-neutral-500 uppercase tracking-wider">Patreon URL</label>
              <input name="patreon_url" defaultValue={profile.patreon_url} type="text" placeholder="https://patreon.com/..." className="w-full bg-transparent focus:outline-none font-medium text-sm text-blue-600 placeholder:text-neutral-300" />
            </div>
            <div className="flex flex-col items-center gap-1 border-l pl-4 border-neutral-100">
              <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">노출</span>
              <input type="checkbox" checked={snsSettings.patreon === true} onChange={() => toggleSns('patreon')} className="w-4 h-4 accent-black cursor-pointer" />
            </div>
          </div>

        </div>
      </section>

      {/* Submit Button */}
      <div className="flex items-center justify-end gap-4 pt-6 border-t border-neutral-200 mt-8">
        {successMsg && (
          <span className="text-sm font-bold text-green-600 animate-in fade-in slide-in-from-right-4">{successMsg}</span>
        )}
        <button 
          type="submit" 
          disabled={isLoading}
          className="bg-black text-white px-8 py-3 rounded-lg font-bold hover:bg-neutral-800 hover:shadow-md disabled:opacity-50 transition-all text-sm"
        >
          {isLoading ? '저장 중...' : '변경사항 저장하기'}
        </button>
      </div>
    </form>
  )
}
