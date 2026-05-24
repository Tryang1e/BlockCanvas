'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { updateSiteSettingsAction } from '@/app/actions/admin'

export default function AdminSettingsForm({ initialSettings }: { initialSettings: Record<string, string> }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  
  // States for each setting
  const [maintenanceMode, setMaintenanceMode] = useState(initialSettings['MAINTENANCE_MODE'] === 'true')
  const [globalBannerActive, setGlobalBannerActive] = useState(initialSettings['GLOBAL_BANNER_ACTIVE'] === 'true')
  const [globalBannerText, setGlobalBannerText] = useState(initialSettings['GLOBAL_BANNER_TEXT'] || '')
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    try {
      setLoading(true)
      const settingsToSave = [
        { key: 'MAINTENANCE_MODE', value: maintenanceMode ? 'true' : 'false' },
        { key: 'GLOBAL_BANNER_ACTIVE', value: globalBannerActive ? 'true' : 'false' },
        { key: 'GLOBAL_BANNER_TEXT', value: globalBannerText }
      ]
      
      const res = await updateSiteSettingsAction(settingsToSave)
      
      if (res?.error) {
        alert(`저장 실패: ${res.error}`)
      } else {
        alert('성공적으로 저장되었습니다.')
        router.refresh()
      }
    } catch (err: any) {
      alert(`오류: ${err.message || '서버 통신 실패'}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {/* Maintenance Mode Toggle */}
      <div className="flex items-start justify-between">
        <div>
          <h4 className="text-base font-bold text-neutral-900">긴급 점검 모드 (Maintenance Mode)</h4>
          <p className="text-sm text-neutral-500 mt-1">
            활성화 시 일반 사용자의 서비스 접근이 차단되며, 어드민만 접근할 수 있습니다.
          </p>
        </div>
        <label className="relative inline-flex items-center cursor-pointer ml-4">
          <input 
            type="checkbox" 
            className="sr-only peer" 
            checked={maintenanceMode}
            onChange={(e) => setMaintenanceMode(e.target.checked)}
          />
          <div className="w-11 h-6 bg-neutral-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-red-500"></div>
        </label>
      </div>

      <hr className="border-neutral-100" />

      {/* Global Banner Toggle */}
      <div className="flex items-start justify-between">
        <div>
          <h4 className="text-base font-bold text-neutral-900">상단 글로벌 공지 배너</h4>
          <p className="text-sm text-neutral-500 mt-1">
            활성화 시 사이트 상단에 공지사항 띠 배너가 노출됩니다.
          </p>
        </div>
        <label className="relative inline-flex items-center cursor-pointer ml-4">
          <input 
            type="checkbox" 
            className="sr-only peer" 
            checked={globalBannerActive}
            onChange={(e) => setGlobalBannerActive(e.target.checked)}
          />
          <div className="w-11 h-6 bg-neutral-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
        </label>
      </div>

      {/* Global Banner Text Input */}
      {globalBannerActive && (
        <div className="bg-neutral-50 p-4 rounded-lg border border-neutral-200 animate-in fade-in slide-in-from-top-2">
          <label className="block text-sm font-bold text-neutral-700 mb-2">공지사항 문구</label>
          <input 
            type="text" 
            value={globalBannerText}
            onChange={(e) => setGlobalBannerText(e.target.value)}
            placeholder="예: 🚀 내일 새벽 2시부터 4시까지 정기 점검이 진행될 예정입니다."
            className="w-full px-4 py-2 border border-neutral-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
          />
          <p className="text-xs text-neutral-400 mt-2">💡 이모지를 적극적으로 활용하여 눈에 띄게 작성해 보세요.</p>
        </div>
      )}

      <hr className="border-neutral-100" />

      <div className="flex justify-end pt-2">
        <button 
          type="submit"
          disabled={loading}
          className="px-6 py-2.5 bg-neutral-900 hover:bg-black text-white font-bold rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50"
        >
          {loading ? (
            <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span> 저장중...</>
          ) : (
            '설정 저장하기'
          )}
        </button>
      </div>
    </form>
  )
}
