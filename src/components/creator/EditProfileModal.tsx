'use client'

import { useState } from 'react'
import { updateProfileAction } from '@/app/actions/profile'
import { useRouter } from 'next/navigation'

type ProfileData = {
  creator_name: string
  display_name: string
  discord_id: string
  headline: string
  about_text: string
  contact_email: string
  youtube_url: string
}

export default function EditProfileModal({ profile }: { profile: ProfileData }) {
  const [isOpen, setIsOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setIsLoading(true)
    try {
      const formData = new FormData(e.currentTarget)
      formData.append('creator_name', profile.creator_name)
      await updateProfileAction(formData)
      setIsOpen(false)
      router.refresh()
    } catch (err) {
      alert('프로필 업데이트 중 오류가 발생했습니다.')
      console.error(err)
    }
    setIsLoading(false)
  }

  return (
    <>
      <button 
        onClick={() => setIsOpen(true)}
        className="bg-white/10 hover:bg-white/20 text-white border border-white/30 px-4 py-2 rounded-full font-bold text-xs uppercase tracking-widest backdrop-blur-sm transition-all"
      >
        프로필 편집
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col text-neutral-900">
            <div className="px-6 py-4 border-b border-neutral-100 flex justify-between items-center bg-neutral-50">
              <h2 className="font-extrabold tracking-widest text-sm text-neutral-800">EDIT PROFILE</h2>
              <button onClick={() => setIsOpen(false)} className="text-neutral-400 hover:text-neutral-800 font-bold text-xl leading-none">&times;</button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 overflow-y-auto max-h-[70vh] space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className="block text-xs font-bold mb-2 uppercase text-neutral-500 tracking-wide">표시 이름 (Display Name)</label>
                  <input name="display_name" defaultValue={profile.display_name} required className="w-full border border-neutral-200 p-3 rounded bg-neutral-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm font-medium" />
                </div>
                <div>
                  <label className="block text-xs font-bold mb-2 uppercase text-neutral-500 tracking-wide">헤드라인 (직업 / 짧은 소개)</label>
                  <input name="headline" defaultValue={profile.headline} placeholder="Minecraft Level Designer" className="w-full border border-neutral-200 p-3 rounded bg-neutral-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm font-medium" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold mb-2 uppercase text-neutral-500 tracking-wide">상세 소개 (About Text)</label>
                <textarea name="about_text" defaultValue={profile.about_text} rows={3} className="w-full border border-neutral-200 p-3 rounded bg-neutral-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm font-medium resize-none"></textarea>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 pt-4 border-t border-neutral-100">
                <div>
                  <label className="block text-xs font-bold mb-2 uppercase text-neutral-500 tracking-wide">Contact Email</label>
                  <input name="contact_email" defaultValue={profile.contact_email} type="email" className="w-full border border-neutral-200 p-3 rounded bg-neutral-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm font-medium" />
                </div>
                <div>
                  <label className="block text-xs font-bold mb-2 uppercase text-neutral-500 tracking-wide">Discord ID</label>
                  <input name="discord_id" defaultValue={profile.discord_id} placeholder="User#1234" className="w-full border border-neutral-200 p-3 rounded bg-neutral-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm font-medium" />
                </div>
                <div>
                  <label className="block text-xs font-bold mb-2 uppercase text-neutral-500 tracking-wide">Youtube URL</label>
                  <input name="youtube_url" defaultValue={profile.youtube_url} type="url" placeholder="https://youtube.com/..." className="w-full border border-neutral-200 p-3 rounded bg-neutral-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm font-medium" />
                </div>
              </div>

              <div className="flex justify-end pt-6">
                <button 
                  type="submit" 
                  disabled={isLoading}
                  className="bg-black text-white px-8 py-3 rounded text-sm font-bold tracking-widest hover:bg-neutral-800 disabled:opacity-50 transition-colors uppercase"
                >
                  {isLoading ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
