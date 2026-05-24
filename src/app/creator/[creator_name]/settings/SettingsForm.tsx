'use client'

import { useState } from 'react'
import { updateProfileAction } from '@/app/actions/profile'
import { useRouter } from 'next/navigation'

export default function SettingsForm({ profile }: { profile: any }) {
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()

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
    try {
      const formData = new FormData(e.currentTarget)
      formData.append('creator_name', profile.creator_name)
      formData.append('sns_settings', JSON.stringify(snsSettings))
      
      await updateProfileAction(formData)
      alert('설정이 성공적으로 저장되었습니다.')
      window.location.href = `/creator/${profile.creator_name}`
    } catch (err) {
      alert('프로필 업데이트 중 오류가 발생했습니다.')
      console.error(err)
    }
    setIsLoading(false)
  }

  const handleTogglePublish = async () => {
    try {
      const { togglePortfolioPublishAction } = await import('@/app/actions/portfolio')
      const newStatus = !(profile.portfolios?.is_published ?? true)
      await togglePortfolioPublishAction(profile.creator_name, newStatus)
      alert(`포트폴리오가 ${newStatus ? '공개' : '비공개'} 상태로 변경되었습니다.`)
      window.location.reload()
    } catch (e) {
      alert('상태 변경 실패')
    }
  }

  return (
    <div className="p-8 sm:p-12 space-y-12">
      {/* Portfolio Publish Toggle */}
      <section className="bg-white p-6 rounded-xl border border-neutral-200 shadow-sm flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-neutral-900">포트폴리오 공개 여부</h2>
          <p className="text-sm text-neutral-500 mt-1">
            {profile.portfolios?.is_published !== false 
              ? '현재 누구나 포트폴리오를 볼 수 있습니다.' 
              : '현재 비공개 상태입니다. 나만 볼 수 있습니다.'}
          </p>
        </div>
        <button
          type="button"
          onClick={handleTogglePublish}
          className={`relative inline-flex h-7 w-14 items-center rounded-full transition-colors ${
            profile.portfolios?.is_published !== false ? 'bg-blue-600' : 'bg-neutral-300'
          }`}
        >
          <span
            className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
              profile.portfolios?.is_published !== false ? 'translate-x-8' : 'translate-x-1'
            }`}
          />
        </button>
      </section>

      <form onSubmit={handleSubmit} className="space-y-12">
        {/* Section: Basic Info */}
      <section>
        <h2 className="text-xl font-bold border-b border-neutral-100 pb-4 mb-6">기본 정보</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div>
            <label className="block text-xs font-bold mb-2 text-neutral-500 uppercase tracking-wide">표시 이름 (Display Name)</label>
            <input name="display_name" defaultValue={profile.display_name} required className="w-full border border-neutral-300 p-4 rounded-lg bg-neutral-50 focus:bg-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all font-medium text-sm" />
          </div>
          <div>
            <label className="block text-xs font-bold mb-2 text-neutral-500 uppercase tracking-wide">직업 / 한 줄 소개 (Headline)</label>
            <input name="headline" defaultValue={profile.headline} placeholder="Minecraft Level Designer" className="w-full border border-neutral-300 p-4 rounded-lg bg-neutral-50 focus:bg-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all font-medium text-sm" />
          </div>
          <div className="md:col-span-2">
            <label className="block text-xs font-bold mb-2 text-neutral-500 uppercase tracking-wide">상세 소개 (About Text)</label>
            <textarea name="about_text" defaultValue={profile.about_text} rows={4} className="w-full border border-neutral-300 p-4 rounded-lg bg-neutral-50 focus:bg-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all font-medium text-sm resize-none" placeholder="방문자에게 자신을 소개하는 문구를 적어주세요."></textarea>
          </div>
          <div className="md:col-span-2">
            <label className="block text-xs font-bold mb-2 text-neutral-500 uppercase tracking-wide">공식 연락처 (Contact Email)</label>
            <input name="contact_email" defaultValue={profile.contact_email} type="email" placeholder="example@email.com" className="w-full border border-neutral-300 p-4 rounded-lg bg-neutral-50 focus:bg-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all font-medium text-sm" />
          </div>
        </div>
      </section>

      {/* Section: Page Theme */}
      <section>
        <h2 className="text-xl font-bold border-b border-neutral-100 pb-4 mb-6">테마 설정 (Theme Settings)</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div>
            <label className="block text-xs font-bold mb-2 text-neutral-500 uppercase tracking-wide">배경 색상 (Background Color)</label>
            <div className="flex items-center gap-4">
              <input type="color" name="theme_bg_color" defaultValue={profile.theme_bg_color} className="w-12 h-12 rounded cursor-pointer border-0 p-0" title="배경 색상" />
              <span className="text-sm text-neutral-500">배너 이미지 아래 메인 배경 색상입니다.<br/>기본값은 #222222 입니다.</span>
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold mb-2 text-neutral-500 uppercase tracking-wide">배경 애니메이션 효과 (Background Effect)</label>
            <select name="theme_bg_effect" defaultValue={profile.theme_bg_effect || 'none'} className="w-full border border-neutral-300 p-4 rounded-lg bg-neutral-50 focus:bg-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all font-medium text-sm">
              <optgroup label="최적화 버전 (가벼움)">
                <option value="none">사용 안 함 (None)</option>
                <option value="floating_blocks">반투명 블록 떠오르기 (Floating Blocks)</option>
                <option value="retro_grid">레트로 3D 모눈종이 (Retro Grid)</option>
                <option value="moving_grid">은은한 모눈종이 (Moving Grid)</option>
                <option value="css_stars">반짝이는 별빛 (Twinkling Stars)</option>
                <option value="aurora">오로라 그라데이션 (Aurora Glow)</option>
              </optgroup>
              <optgroup label="고사양 버전 (화려함)">
                <option value="flickering_grid">🔥 깜빡이는 픽셀 그리드 (Flickering Grid)</option>
                <option value="shooting_stars">🔥 떨어지는 별똥별 (Shooting Stars)</option>
                <option value="wavy_waves">🔥 일렁이는 3D 파동 (Wavy Background)</option>
                <option value="particle_network">🔥 파티클 네트워크 (Particle Network)</option>
                <option value="gravity_stars">🔥 인터랙티브 별빛 (Gravity Stars)</option>
                <option value="fireworks">🔥 불꽃놀이 (Fireworks)</option>
              </optgroup>
              <optgroup label="Animate UI 버전 (고급형)">
                <option value="animate_bubble">✨ 다이나믹 버블 (Bubble)</option>
                <option value="animate_fireworks">✨ 불꽃축제 (Fireworks)</option>
                <option value="animate_gradient">✨ 오로라 그라데이션 (Gradient)</option>
                <option value="animate_gravity_stars">✨ 입체 별자리 (Gravity Stars)</option>
                <option value="animate_hexagon">✨ 육각 패턴 (Hexagon)</option>
                <option value="animate_stars">✨ 밤하늘 (Stars)</option>
              </optgroup>
            </select>
          </div>
        </div>
      </section>

      {/* Section: Footer Info */}
      <section>
        <h2 className="text-xl font-bold border-b border-neutral-100 pb-4 mb-6">푸터 대형 텍스트 설정</h2>
        <p className="text-sm text-neutral-500 mb-6">포트폴리오 최하단에 표시되는 대형 배경 텍스트를 수정할 수 있습니다.</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div>
            <label className="block text-xs font-bold mb-2 text-neutral-500 uppercase tracking-wide">푸터 제목 (Footer Title)</label>
            <input name="footer_title" defaultValue={profile.footer_title} placeholder="BLOCK CANVAS" className="w-full border border-neutral-300 p-4 rounded-lg bg-neutral-50 focus:bg-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all font-medium text-sm" />
          </div>
          <div>
            <label className="block text-xs font-bold mb-2 text-neutral-500 uppercase tracking-wide">푸터 부제목 (Footer Subtitle)</label>
            <input name="footer_subtitle" defaultValue={profile.footer_subtitle} placeholder="CREATOR" className="w-full border border-neutral-300 p-4 rounded-lg bg-neutral-50 focus:bg-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all font-medium text-sm" />
          </div>
        </div>
      </section>

      {/* Section: SNS Links & Visibility */}
      <section>
        <h2 className="text-xl font-bold border-b border-neutral-100 pb-4 mb-6">SNS 및 외부 링크 연결</h2>
        <p className="text-sm text-neutral-500 mb-6">포트폴리오에 노출할 링크를 입력하세요. 우측의 체크박스를 해제하면 사이트에서 임시로 숨길 수 있습니다.</p>
        
        <div className="space-y-4">
          {/* Discord */}
          <div className="flex items-center gap-4 p-4 border border-neutral-200 rounded-lg bg-white shadow-sm">
            <div className="flex-1">
              <label className="block text-xs font-bold mb-1 text-neutral-700">Discord ID</label>
              <input name="discord_id" defaultValue={profile.discord_id} placeholder="User#1234" className="w-full bg-transparent focus:outline-none font-medium text-sm" />
            </div>
            <div className="flex flex-col items-center gap-1 border-l pl-4 border-neutral-200">
              <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">노출</span>
              <input type="checkbox" checked={snsSettings.discord === true} onChange={() => toggleSns('discord')} className="w-5 h-5 accent-blue-600 cursor-pointer" />
            </div>
          </div>

          {/* YouTube */}
          <div className="flex items-center gap-4 p-4 border border-neutral-200 rounded-lg bg-white shadow-sm">
            <div className="flex-1">
              <label className="block text-xs font-bold mb-1 text-neutral-700">YouTube 채널 URL</label>
              <input name="youtube_url" defaultValue={profile.youtube_url} type="text" placeholder="https://youtube.com/@..." className="w-full bg-transparent focus:outline-none font-medium text-sm text-blue-600 placeholder:text-neutral-300" />
            </div>
            <div className="flex flex-col items-center gap-1 border-l pl-4 border-neutral-200">
              <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">노출</span>
              <input type="checkbox" checked={snsSettings.youtube === true} onChange={() => toggleSns('youtube')} className="w-5 h-5 accent-blue-600 cursor-pointer" />
            </div>
          </div>

          {/* Twitter (X) */}
          <div className="flex items-center gap-4 p-4 border border-neutral-200 rounded-lg bg-white shadow-sm">
            <div className="flex-1">
              <label className="block text-xs font-bold mb-1 text-neutral-700">X (Twitter) URL</label>
              <input name="twitter_url" defaultValue={profile.twitter_url} type="text" placeholder="https://x.com/..." className="w-full bg-transparent focus:outline-none font-medium text-sm text-blue-600 placeholder:text-neutral-300" />
            </div>
            <div className="flex flex-col items-center gap-1 border-l pl-4 border-neutral-200">
              <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">노출</span>
              <input type="checkbox" checked={snsSettings.twitter === true} onChange={() => toggleSns('twitter')} className="w-5 h-5 accent-blue-600 cursor-pointer" />
            </div>
          </div>

          {/* Instagram */}
          <div className="flex items-center gap-4 p-4 border border-neutral-200 rounded-lg bg-white shadow-sm">
            <div className="flex-1">
              <label className="block text-xs font-bold mb-1 text-neutral-700">Instagram URL</label>
              <input name="instagram_url" defaultValue={profile.instagram_url} type="text" placeholder="https://instagram.com/..." className="w-full bg-transparent focus:outline-none font-medium text-sm text-blue-600 placeholder:text-neutral-300" />
            </div>
            <div className="flex flex-col items-center gap-1 border-l pl-4 border-neutral-200">
              <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">노출</span>
              <input type="checkbox" checked={snsSettings.instagram === true} onChange={() => toggleSns('instagram')} className="w-5 h-5 accent-blue-600 cursor-pointer" />
            </div>
          </div>

          {/* Patreon */}
          <div className="flex items-center gap-4 p-4 border border-neutral-200 rounded-lg bg-white shadow-sm">
            <div className="flex-1">
              <label className="block text-xs font-bold mb-1 text-neutral-700">Patreon URL</label>
              <input name="patreon_url" defaultValue={profile.patreon_url} type="text" placeholder="https://patreon.com/..." className="w-full bg-transparent focus:outline-none font-medium text-sm text-blue-600 placeholder:text-neutral-300" />
            </div>
            <div className="flex flex-col items-center gap-1 border-l pl-4 border-neutral-200">
              <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">노출</span>
              <input type="checkbox" checked={snsSettings.patreon === true} onChange={() => toggleSns('patreon')} className="w-5 h-5 accent-blue-600 cursor-pointer" />
            </div>
          </div>

        </div>
      </section>

      {/* Submit Button */}
      <div className="flex justify-end pt-8 border-t border-neutral-200">
        <button 
          type="submit" 
          disabled={isLoading}
          className="bg-black text-white px-12 py-4 rounded-full font-bold tracking-widest hover:bg-neutral-800 hover:shadow-lg disabled:opacity-50 transition-all uppercase text-sm"
        >
          {isLoading ? '저장 중...' : '변경사항 저장하기'}
        </button>
      </div>
    </form>
    </div>
  )
}
