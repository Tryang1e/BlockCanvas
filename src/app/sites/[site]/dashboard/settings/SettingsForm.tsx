'use client'

import { useState } from 'react'
import { updateProfileAction } from '@/app/actions/profile'

export default function SettingsForm({ profile, allCreators = [] }: { profile: any, allCreators?: any[] }) {
  const [isLoading, setIsLoading] = useState(false)
  const [successMsg, setSuccessMsg] = useState('')

  const defaultSns = {
    discord: false,
    youtube: false,
    twitter: false,
    instagram: false,
    patreon: false,
  }

  const [snsSettings, setSnsSettings] = useState<Record<string, any>>(
    profile.sns_settings && Object.keys(profile.sns_settings).length > 0 
      ? profile.sns_settings 
      : defaultSns
  )

  const [searchQuery, setSearchQuery] = useState('')
  const recommendedCreators: string[] = snsSettings.recommended_creators || []

  const peerCandidates = allCreators.filter((c: any) => 
    !recommendedCreators.includes(c.creator_name) &&
    (searchQuery === '' || 
      c.display_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.creator_name?.toLowerCase().includes(searchQuery.toLowerCase())
    )
  )

  const addRecommendedCreator = (username: string) => {
    if (recommendedCreators.includes(username)) return
    setSnsSettings(prev => ({
      ...prev,
      recommended_creators: [...recommendedCreators, username]
    }))
    setSearchQuery('')
  }

  const removeRecommendedCreator = (username: string) => {
    setSnsSettings(prev => ({
      ...prev,
      recommended_creators: recommendedCreators.filter(name => name !== username)
    }))
  }

  const toggleSns = (key: string) => {
    setSnsSettings(prev => ({ ...prev, [key]: !prev[key] }))
  }

  // 명시적 boolean 설정용(커서/스크롤바 토글처럼 기본값 의미가 다른 키에 사용)
  const setSnsValue = (key: string, value: boolean) => {
    setSnsSettings(prev => ({ ...prev, [key]: value }))
  }

  // 커서는 기본 ON(명시적 false일 때만 꺼짐), 스크롤바는 기본 OFF(명시적 true일 때만 켜짐)
  const cursorOn = snsSettings.custom_cursor !== false
  const scrollbarOn = snsSettings.custom_scrollbar === true

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

      {/* Section: Page Theme */}
      <section>
        <h2 className="text-lg font-bold border-b border-neutral-100 pb-3 mb-5">테마 설정 (Theme Settings)</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-[11px] font-bold mb-1.5 text-neutral-500 uppercase tracking-wide">배경 색상 (Background Color)</label>
            <div className="flex items-center gap-4">
              <input type="color" name="theme_bg_color" defaultValue={profile.theme_bg_color} className="w-10 h-10 rounded cursor-pointer border border-neutral-200 p-0" title="배경 색상" />
              <span className="text-xs text-neutral-500">배너 이미지 아래 메인 배경 색상입니다.<br/>기본값은 #222222 입니다.</span>
            </div>
          </div>
          <div>
            <label className="block text-[11px] font-bold mb-1.5 text-neutral-500 uppercase tracking-wide">배경 애니메이션 효과 (Background Effect)</label>
            <select name="theme_bg_effect" defaultValue={profile.theme_bg_effect ? profile.theme_bg_effect.split('|')[0] : 'none'} className="w-full border border-neutral-200 p-3 rounded-lg bg-neutral-50 focus:bg-white focus:outline-none focus:border-black focus:ring-1 focus:ring-black transition-all font-medium text-sm">
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

      {/* Section: Interaction Effects (#9) */}
      <section>
        <h2 className="text-lg font-bold border-b border-neutral-100 pb-3 mb-5">인터랙션 효과 (Interaction Effects)</h2>
        <p className="text-xs text-neutral-500 mb-4 font-medium">방문자가 내 포트폴리오를 둘러볼 때 적용되는 마우스/스크롤 인터랙션을 켜고 끌 수 있습니다.</p>
        <div className="space-y-3">
          {/* Custom Cursor */}
          <div className="flex items-center justify-between gap-4 p-3 border border-neutral-200 rounded-lg bg-white shadow-sm">
            <div>
              <div className="text-sm font-bold text-neutral-800">커스텀 마우스 커서</div>
              <div className="text-[11px] text-neutral-500 mt-0.5 leading-relaxed">마우스를 따라다니는 미니멀한 포인터 효과입니다. 모바일·터치 기기나 모션 최소화 설정에서는 자동으로 비활성화됩니다.</div>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={cursorOn}
              onClick={() => setSnsValue('custom_cursor', !cursorOn)}
              className={`relative inline-flex h-7 w-14 flex-shrink-0 items-center rounded-full transition-colors ${cursorOn ? 'bg-blue-600' : 'bg-neutral-300'}`}
            >
              <span className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${cursorOn ? 'translate-x-8' : 'translate-x-1'}`} />
            </button>
          </div>
          {/* Custom Scrollbar */}
          <div className="flex items-center justify-between gap-4 p-3 border border-neutral-200 rounded-lg bg-white shadow-sm">
            <div>
              <div className="text-sm font-bold text-neutral-800">커스텀 스크롤바</div>
              <div className="text-[11px] text-neutral-500 mt-0.5 leading-relaxed">기본 브라우저 스크롤바 대신 얇고 둥근 스크롤바를 사용합니다.</div>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={scrollbarOn}
              onClick={() => setSnsValue('custom_scrollbar', !scrollbarOn)}
              className={`relative inline-flex h-7 w-14 flex-shrink-0 items-center rounded-full transition-colors ${scrollbarOn ? 'bg-blue-600' : 'bg-neutral-300'}`}
            >
              <span className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${scrollbarOn ? 'translate-x-8' : 'translate-x-1'}`} />
            </button>
          </div>
        </div>
      </section>

      {/* Section: Footer Info */}
      <section>
        <h2 className="text-lg font-bold border-b border-neutral-100 pb-3 mb-5">푸터 대형 텍스트 설정</h2>
        <p className="text-xs text-neutral-500 mb-4 font-medium">포트폴리오 최하단에 표시되는 대형 배경 텍스트를 수정할 수 있습니다.</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-[11px] font-bold mb-1.5 text-neutral-500 uppercase tracking-wide">푸터 제목 (Footer Title)</label>
            <input name="footer_title" defaultValue={profile.footer_title} placeholder="BLOCK CANVAS" className="w-full border border-neutral-200 p-3 rounded-lg bg-neutral-50 focus:bg-white focus:outline-none focus:border-black focus:ring-1 focus:ring-black transition-all font-medium text-sm" />
          </div>
          <div>
            <label className="block text-[11px] font-bold mb-1.5 text-neutral-500 uppercase tracking-wide">푸터 부제목 (Footer Subtitle)</label>
            <input name="footer_subtitle" defaultValue={profile.footer_subtitle} placeholder="CREATOR" className="w-full border border-neutral-200 p-3 rounded-lg bg-neutral-50 focus:bg-white focus:outline-none focus:border-black focus:ring-1 focus:ring-black transition-all font-medium text-sm" />
          </div>
        </div>
      </section>

      {/* Section: Peer Recommendations */}
      <section className="bg-neutral-50/50 p-5 rounded-xl border border-neutral-200">
        <h2 className="text-lg font-bold border-b border-neutral-100 pb-3 mb-4 flex items-center justify-between">
          <span>🤝 추천 동료 크리에이터 설정</span>
          <span className="text-xs bg-black text-white px-2 py-0.5 rounded font-mono">Recommendations</span>
        </h2>
        <p className="text-xs text-neutral-500 mb-4 font-medium">
          내 포트폴리오 메인 프로필 하단에 표시할 동료 크리에이터를 추천할 수 있습니다.
        </p>

        {/* Selected Creators list */}
        <div className="mb-5">
          <label className="block text-[11px] font-bold mb-2 text-neutral-400 uppercase tracking-wider">내가 추천한 동료 목록</label>
          {recommendedCreators.length === 0 ? (
            <div className="text-xs text-neutral-400 italic p-3 border border-dashed border-neutral-200 rounded-lg bg-white/40 text-center">
              아직 추천한 동료가 없습니다. 아래에서 대상을 선택하거나 검색하여 추가해보세요.
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {recommendedCreators.map(username => {
                const creator = allCreators.find((c: any) => c.creator_name === username) || {
                  creator_name: username,
                  display_name: username,
                  avatar_url: ''
                }
                return (
                  <div key={username} className="flex items-center gap-1.5 bg-white border border-neutral-200 px-2.5 py-1.5 rounded-full shadow-sm animate-in zoom-in-95 duration-200 group">
                    <div className="relative w-5 h-5 rounded-full overflow-hidden bg-neutral-200 flex-shrink-0">
                      <img src={creator.avatar_url || '/default_avatar.png'} alt={creator.display_name} className="object-cover w-full h-full" />
                    </div>
                    <div className="flex flex-col text-left">
                      <span className="text-[11px] font-bold text-neutral-800 leading-tight">{creator.display_name}</span>
                      <span className="text-[8px] text-neutral-400 font-mono leading-none">@{creator.creator_name}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeRecommendedCreator(username)}
                      className="ml-1 w-3.5 h-3.5 rounded-full bg-neutral-100 hover:bg-red-500 hover:text-white flex items-center justify-center text-[9px] transition-colors"
                      title="추천 취소"
                    >
                      ✕
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Creator Search & Suggest */}
        <div className="space-y-4">
          <div>
            <label className="block text-[11px] font-bold mb-2 text-neutral-400 uppercase tracking-wider">동료 크리에이터 검색</label>
            <input
              type="text"
              placeholder="크리에이터 이름 또는 핸들 검색..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full border border-neutral-200 p-3 rounded-lg bg-white focus:outline-none focus:border-black focus:ring-1 focus:ring-black transition-all font-medium text-xs shadow-sm"
            />
          </div>

          {/* Inline Peer Candidates Grid */}
          <div>
            <label className="block text-[11px] font-bold mb-2.5 text-neutral-400 uppercase tracking-wider">추천 후보 리스트</label>
            {peerCandidates.length === 0 ? (
              <div className="text-xs text-neutral-400 italic p-5 border border-dashed border-neutral-200 rounded-xl bg-white/40 text-center">
                {searchQuery ? '검색 결과와 일치하는 크리에이터가 없습니다.' : '추천할 수 있는 다른 크리에이터가 없습니다.'}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {peerCandidates.map((creator: any) => (
                  <div
                    key={creator.creator_name}
                    className="flex items-center justify-between p-3 bg-white border border-neutral-200 hover:border-neutral-300 hover:shadow-sm rounded-xl transition-all duration-200 group"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="relative w-8 h-8 rounded-full overflow-hidden bg-neutral-100 border border-neutral-200 flex-shrink-0">
                        <img
                          src={creator.avatar_url || '/default_avatar.png'}
                          alt={creator.display_name}
                          className="object-cover w-full h-full transition-transform duration-300 group-hover:scale-110"
                        />
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-neutral-800 truncate leading-snug">
                          {creator.display_name}
                        </div>
                        <div className="text-[9px] text-neutral-400 font-mono truncate leading-none">
                          @{creator.creator_name}
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => addRecommendedCreator(creator.creator_name)}
                      className="flex-shrink-0 bg-neutral-50 hover:bg-black hover:text-white text-neutral-600 px-2 py-1 rounded text-[10px] font-bold transition-all border border-neutral-200 hover:border-black"
                    >
                      + 추천
                    </button>
                  </div>
                ))}
              </div>
            )}
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
