'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { updateSiteSettingsAction } from '@/app/actions/admin'
import { Search, Plus, X, GripVertical, ChevronUp, ChevronDown, Check, LayoutGrid, Info } from 'lucide-react'

interface Creator {
  creator_name: string
  display_name: string | null
  avatar_url: string | null
}

interface AdminSettingsFormProps {
  initialSettings: Record<string, string>
  availableCreators: Creator[]
}

export default function AdminSettingsForm({ initialSettings, availableCreators = [] }: AdminSettingsFormProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  
  // 글로벌 설정 States
  const [maintenanceMode, setMaintenanceMode] = useState(initialSettings['MAINTENANCE_MODE'] === 'true')
  const [globalBannerActive, setGlobalBannerActive] = useState(initialSettings['GLOBAL_BANNER_ACTIVE'] === 'true')
  const [globalBannerText, setGlobalBannerText] = useState(initialSettings['GLOBAL_BANNER_TEXT'] || '')
  
  // 추천 크리에이터 대화형 선택기 (Featured Creators Selector) States
  const [selectedList, setSelectedList] = useState<Creator[]>(() => {
    const raw = initialSettings['FEATURED_CREATORS'] || ''
    const ids = raw.split(',').map(s => s.trim().toLowerCase()).filter(Boolean)
    return ids.map(id => {
      const found = availableCreators.find(c => c.creator_name.toLowerCase() === id)
      return found || { creator_name: id, display_name: id, avatar_url: null }
    })
  })
  
  const [searchQuery, setSearchQuery] = useState('')
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null)
  const [isDraggingOverRight, setIsDraggingOverRight] = useState(false)

  // 크리에이터 검색 필터링 (검색어 없으면 전체 중 미선택된 크리에이터 표시)
  const filteredCreators = availableCreators.filter(c => {
    const isAlreadySelected = selectedList.some(s => s.creator_name.toLowerCase() === c.creator_name.toLowerCase())
    if (isAlreadySelected) return false
    
    if (searchQuery.trim() === '') return true // 검색어 비어있을 때는 전체 나열
    
    const query = searchQuery.toLowerCase()
    const matchName = c.creator_name.toLowerCase().includes(query)
    const matchDisplay = c.display_name?.toLowerCase().includes(query)
    return matchName || matchDisplay
  })

  // 크리에이터 추가
  const handleAddCreator = (creator: Creator) => {
    if (selectedList.some(c => c.creator_name.toLowerCase() === creator.creator_name.toLowerCase())) return
    setSelectedList(prev => [...prev, creator])
  }

  // 크리에이터 삭제
  const handleRemoveCreator = (creatorName: string) => {
    setSelectedList(prev => prev.filter(c => c.creator_name !== creatorName))
  }

  // 크리에이터 위로 이동
  const handleMoveUp = (index: number) => {
    if (index === 0) return
    setSelectedList(prev => {
      const copy = [...prev]
      const temp = copy[index]
      copy[index] = copy[index - 1]
      copy[index - 1] = temp
      return copy
    })
  }

  // 크리에이터 아래로 이동
  const handleMoveDown = (index: number) => {
    if (index === selectedList.length - 1) return
    setSelectedList(prev => {
      const copy = [...prev]
      const temp = copy[index]
      copy[index] = copy[index + 1]
      copy[index + 1] = temp
      return copy
    })
  }

  // HTML5 Drag-and-Drop Handlers (좌측 -> 우측 드래그 추가)
  const handleAvailableDragStart = (e: React.DragEvent, creator: Creator) => {
    e.dataTransfer.setData('application/json', JSON.stringify({ type: 'ADD', creator }))
    e.dataTransfer.effectAllowed = 'copyMove'
  }

  // HTML5 Drag-and-Drop Handlers (우측 리스트 내부 순서 변경)
  const handleSelectedDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index)
    e.dataTransfer.setData('application/json', JSON.stringify({ type: 'REORDER', index }))
    e.dataTransfer.effectAllowed = 'move'
    
    // 드래그 시 고스트 이미지 디자인을 개선하기 위해 투명도를 조절
    const target = e.currentTarget as HTMLElement
    setTimeout(() => {
      target.style.opacity = '0.4'
    }, 0)
  }

  const handleSelectedDragEnd = (e: React.DragEvent) => {
    const target = e.currentTarget as HTMLElement
    target.style.opacity = '1'
    setDraggedIndex(null)
    setIsDraggingOverRight(false)
  }

  const handleRightPanelDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    if (!isDraggingOverRight) {
      setIsDraggingOverRight(true)
    }
  }

  const handleRightPanelDragLeave = () => {
    setIsDraggingOverRight(false)
  }

  const handleRightPanelDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDraggingOverRight(false)
    try {
      const dataStr = e.dataTransfer.getData('application/json')
      if (!dataStr) return
      const data = JSON.parse(dataStr)
      if (data.type === 'ADD') {
        handleAddCreator(data.creator)
      }
    } catch (err) {
      console.error(err)
    }
  }

  const handleSelectedCardDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault()
    if (draggedIndex === null || draggedIndex === index) return
    
    // 실시간으로 리스트 항목을 스왑
    setSelectedList(prev => {
      const copy = [...prev]
      const draggedItem = copy[draggedIndex]
      copy.splice(draggedIndex, 1)
      copy.splice(index, 0, draggedItem)
      return copy
    })
    setDraggedIndex(index)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    try {
      setLoading(true)
      
      const featuredCreatorsValue = selectedList.map(c => c.creator_name.toLowerCase()).join(',')

      const settingsToSave = [
        { key: 'MAINTENANCE_MODE', value: maintenanceMode ? 'true' : 'false' },
        { key: 'GLOBAL_BANNER_ACTIVE', value: globalBannerActive ? 'true' : 'false' },
        { key: 'GLOBAL_BANNER_TEXT', value: globalBannerText },
        { key: 'FEATURED_CREATORS', value: featuredCreatorsValue }
      ]
      
      const res = await updateSiteSettingsAction(settingsToSave)
      
      if (res?.error) {
        alert(`저장 실패: ${res.error}`)
      } else {
        alert('성공적으로 저장되었습니다. 메인 화면에 즉시 동기화됩니다.')
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
      {/* 🛠️ 1. 긴급 점검 모드 */}
      <div className="flex items-start justify-between p-4 rounded-2xl bg-neutral-50/50 border border-neutral-100 hover:border-neutral-200 transition-all">
        <div>
          <h4 className="text-sm font-bold text-neutral-900 flex items-center gap-2">
            🚨 긴급 점검 모드 (Maintenance Mode)
          </h4>
          <p className="text-xs text-neutral-500 mt-1 pl-6">
            활성화 시 일반 사용자의 서비스 접근이 차단되며, 어드민만 접근할 수 있습니다.
          </p>
        </div>
        <label className="relative inline-flex items-center cursor-pointer ml-4 mt-0.5 shrink-0">
          <input 
            type="checkbox" 
            className="sr-only peer" 
            checked={maintenanceMode}
            onChange={(e) => setMaintenanceMode(e.target.checked)}
          />
          <div className="w-11 h-6 bg-neutral-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-red-500"></div>
        </label>
      </div>

      {/* 📢 2. 글로벌 공지 배너 */}
      <div className="flex flex-col gap-4 p-4 rounded-2xl bg-neutral-50/50 border border-neutral-100 hover:border-neutral-200 transition-all">
        <div className="flex items-start justify-between">
          <div>
            <h4 className="text-sm font-bold text-neutral-900 flex items-center gap-2">
              📢 상단 글로벌 공지 배너
            </h4>
            <p className="text-xs text-neutral-500 mt-1 pl-6">
              활성화 시 사이트 상단에 공지사항 띠 배너가 모든 페이지에 노출됩니다.
            </p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer ml-4 mt-0.5 shrink-0">
            <input 
              type="checkbox" 
              className="sr-only peer" 
              checked={globalBannerActive}
              onChange={(e) => setGlobalBannerActive(e.target.checked)}
            />
            <div className="w-11 h-6 bg-neutral-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
          </label>
        </div>

        {globalBannerActive && (
          <div className="bg-white p-4 rounded-xl border border-neutral-200/60 animate-in fade-in slide-in-from-top-2 duration-200 pl-6">
            <label className="block text-xs font-bold text-neutral-700 mb-2">공지사항 배너 문구</label>
            <input 
              type="text" 
              value={globalBannerText}
              onChange={(e) => setGlobalBannerText(e.target.value)}
              placeholder="예: 🚀 내일 새벽 2시부터 4시까지 시스템 정기 점검이 진행될 예정입니다."
              className="w-full px-4 py-2.5 border border-neutral-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm bg-neutral-50/30"
            />
            <p className="text-[10px] text-neutral-400 mt-2 flex items-center gap-1">
              <Info size={12} /> 이모지를 적극적으로 활용하여 눈에 띄고 친근하게 작성해 보세요.
            </p>
          </div>
        )}
      </div>

      <hr className="border-neutral-100" />

      {/* 🎨 3. 추천 크리에이터 정밀 제어기 (드래그 앤 드롭 양방향 패널) */}
      <div className="space-y-4">
        <div>
          <h4 className="text-base font-extrabold text-neutral-900 tracking-tight flex items-center gap-2">
            ✨ 추천 크리에이터 드래그 앤 드롭 관리 (Featured Creators)
          </h4>
          <p className="text-xs text-neutral-500 mt-1 leading-relaxed">
            메인 홈페이지 'BLOCKCANVAS CREATORS' 슬라이드에 노출될 특정 크리에이터를 선정하고 정렬합니다. 
            좌측 목록에서 크리에이터를 <strong className="text-neutral-800 font-bold">드래그하여 우측 패널에 드롭</strong>하거나, 
            <strong className="text-neutral-800 font-bold">더하기(+) 버튼</strong>을 눌러 바로 추가할 수 있습니다. 
            우측 목록 내에서 카드를 드래그하여 순서를 부드럽게 조정할 수도 있습니다.
          </p>
        </div>

        {/* 대화형 양방향 드래그 앤 드롭 컬럼 레이아웃 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          
          {/* [좌측 패널] 사용 가능한 크리에이터 검색 및 선택 풀 */}
          <div className="flex flex-col bg-neutral-50/70 border border-neutral-200/80 rounded-2xl overflow-hidden shadow-inner">
            <div className="p-4 border-b border-neutral-200/80 bg-neutral-100/50">
              <span className="text-xs font-black text-neutral-600 uppercase tracking-wide flex items-center gap-1.5">
                🔍 크리에이터 검색 및 목록 ({filteredCreators.length}명)
              </span>
              
              {/* 검색 필드 */}
              <div className="relative mt-3">
                <input 
                  type="text" 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="아이디 또는 이름으로 검색..."
                  className="w-full pl-9 pr-4 py-2 border border-neutral-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-xs bg-white"
                />
                <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400" />
              </div>
            </div>

            {/* 스크롤 크리에이터 목록 */}
            <div className="p-3 overflow-y-auto max-h-[380px] min-h-[260px] divide-y divide-neutral-100 custom-scrollbar space-y-1.5">
              {filteredCreators.length === 0 ? (
                <div className="h-full min-h-[200px] flex flex-col items-center justify-center text-center text-xs font-semibold text-neutral-400 p-6 select-none">
                  {searchQuery.trim() !== '' ? (
                    <>
                      <div className="text-2xl mb-2">❌</div>
                      일치하는 크리에이터가 없습니다.
                    </>
                  ) : (
                    <>
                      <div className="text-2xl mb-2">🎉</div>
                      모든 크리에이터가 이미 선택되었습니다!
                    </>
                  )}
                </div>
              ) : (
                filteredCreators.map((creator) => (
                  <div
                    key={creator.creator_name}
                    draggable
                    onDragStart={(e) => handleAvailableDragStart(e, creator)}
                    className="flex items-center justify-between p-2.5 bg-white border border-neutral-200/60 rounded-xl hover:border-blue-300 hover:shadow-sm cursor-grab active:cursor-grabbing group transition-all"
                    title="드래그하여 우측 패널에 추가 가능"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      {/* 드래그 핸들 */}
                      <GripVertical size={14} className="text-neutral-300 group-hover:text-neutral-400 shrink-0" />
                      
                      {/* 아바타 */}
                      <div className="w-8 h-8 rounded-lg bg-neutral-50 border border-neutral-200/50 overflow-hidden flex items-center justify-center text-xs font-extrabold text-neutral-700 shrink-0 select-none">
                        {creator.avatar_url ? (
                          <img src={creator.avatar_url} alt="avatar" className="w-full h-full object-cover" />
                        ) : (
                          (creator.display_name || creator.creator_name).charAt(0).toUpperCase()
                        )}
                      </div>
                      
                      {/* 기본 정보 */}
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-neutral-900 truncate">{creator.creator_name}</div>
                        <div className="text-[10px] text-neutral-400 truncate">({creator.display_name || '이름 없음'})</div>
                      </div>
                    </div>

                    {/* 간편 추가 버튼 */}
                    <button
                      type="button"
                      onClick={() => handleAddCreator(creator)}
                      className="p-1.5 bg-neutral-50 hover:bg-blue-50 border border-neutral-200 hover:border-blue-200/50 text-neutral-500 hover:text-blue-600 rounded-lg transition-all"
                      title="목록에 즉시 추가"
                    >
                      <Plus size={14} />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* [우측 패널] 선정 및 배치된 크리에이터 (Drop Zone & Reorder List) */}
          <div 
            onDragOver={handleRightPanelDragOver}
            onDragLeave={handleRightPanelDragLeave}
            onDrop={handleRightPanelDrop}
            className={`flex flex-col border rounded-2xl overflow-hidden transition-all duration-300 ${
              isDraggingOverRight 
                ? 'bg-blue-50/50 border-blue-400 border-dashed border-2 ring-4 ring-blue-500/10' 
                : 'bg-white border-neutral-200/80 shadow-sm'
            }`}
          >
            <div className={`p-4 border-b bg-neutral-100/50 flex justify-between items-center transition-colors ${
              isDraggingOverRight ? 'border-blue-300 bg-blue-100/30' : 'border-neutral-200/80'
            }`}>
              <span className="text-xs font-black text-neutral-600 uppercase tracking-wide flex items-center gap-1.5">
                ✨ 배치된 추천 목록 ({selectedList.length}명)
              </span>
              <span className="text-[10px] bg-neutral-200/60 text-neutral-600 px-2.5 py-0.5 rounded-full font-bold select-none">
                marquee 순서
              </span>
            </div>

            {/* 선정 리스트 컨테이너 */}
            <div className="p-3 overflow-y-auto max-h-[380px] min-h-[260px] custom-scrollbar space-y-2 flex-1">
              {selectedList.length === 0 ? (
                <div className="h-full min-h-[230px] flex flex-col items-center justify-center text-center p-6 select-none border border-dashed border-neutral-200 rounded-xl bg-neutral-50/30">
                  <div className="text-4xl mb-3 opacity-60 animate-bounce">📥</div>
                  <div className="text-xs font-bold text-neutral-800">이곳에 크리에이터를 드롭하세요</div>
                  <div className="text-[10px] text-neutral-400 mt-1.5 leading-relaxed">
                    좌측 목록의 크리에이터를 끌어서 놓거나,<br />
                    우측 상단 비워둘 시 모든 크리에이터가 순서대로 노출됩니다.
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  {selectedList.map((creator, index) => {
                    const isBeingDragged = draggedIndex === index;
                    return (
                      <div 
                        key={creator.creator_name}
                        draggable
                        onDragStart={(e) => handleSelectedDragStart(e, index)}
                        onDragEnd={handleSelectedDragEnd}
                        onDragOver={(e) => handleSelectedCardDragOver(e, index)}
                        className={`flex items-center justify-between p-2.5 bg-white border rounded-xl shadow-sm hover:shadow transition-all group cursor-grab active:cursor-grabbing ${
                          isBeingDragged 
                            ? 'opacity-40 border-blue-400 border-dashed bg-neutral-50Scale' 
                            : 'border-neutral-200/80 hover:border-neutral-300'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          {/* 순서 배지 */}
                          <span className="text-[10px] font-black text-neutral-400 bg-neutral-100 border border-neutral-200/30 px-2 py-0.5 rounded-md min-w-[26px] text-center select-none shrink-0">
                            #{index + 1}
                          </span>

                          {/* 드래그 그리퍼 */}
                          <GripVertical size={14} className="text-neutral-300 group-hover:text-neutral-400 shrink-0 select-none" />

                          {/* 아바타 */}
                          <div className="w-8 h-8 rounded-lg bg-neutral-50 border border-neutral-200/50 overflow-hidden flex items-center justify-center text-xs font-bold text-neutral-700 shrink-0 select-none">
                            {creator.avatar_url ? (
                              <img src={creator.avatar_url} alt="avatar" className="w-full h-full object-cover" />
                            ) : (
                              (creator.display_name || creator.creator_name).charAt(0).toUpperCase()
                            )}
                          </div>

                          {/* 정보 */}
                          <div className="min-w-0">
                            <span className="text-xs font-bold text-neutral-900 truncate block">{creator.creator_name}</span>
                            <span className="text-[10px] text-neutral-400 truncate block">({creator.display_name || '이름 없음'})</span>
                          </div>
                        </div>

                        {/* 미세 조정 제어기 및 제거 액션 */}
                        <div className="flex items-center gap-0.5 shrink-0 ml-2">
                          <button
                            type="button"
                            disabled={index === 0}
                            onClick={() => handleMoveUp(index)}
                            className="p-1.5 bg-neutral-50 border border-neutral-200 hover:bg-neutral-100 rounded-lg text-neutral-500 disabled:opacity-30 disabled:pointer-events-none transition-all"
                            title="위로 이동"
                          >
                            <ChevronUp size={12} />
                          </button>
                          <button
                            type="button"
                            disabled={index === selectedList.length - 1}
                            onClick={() => handleMoveDown(index)}
                            className="p-1.5 bg-neutral-50 border border-neutral-200 hover:bg-neutral-100 rounded-lg text-neutral-500 disabled:opacity-30 disabled:pointer-events-none transition-all"
                            title="아래로 이동"
                          >
                            <ChevronDown size={12} />
                          </button>
                          
                          <button
                            type="button"
                            onClick={() => handleRemoveCreator(creator.creator_name)}
                            className="p-1.5 bg-red-50 hover:bg-red-100 border border-red-100 hover:border-red-200/40 rounded-lg text-red-500 ml-1.5 transition-all"
                            title="추천에서 제거"
                          >
                            <X size={12} />
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>

        </div>
      </div>

      <hr className="border-neutral-100" />

      {/* 저장 전송 버튼 */}
      <div className="flex justify-end pt-2">
        <button 
          type="submit"
          disabled={loading}
          className="px-6 py-2.5 bg-neutral-900 hover:bg-black text-white font-bold rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50 shadow-md"
        >
          {loading ? (
            <>
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
              설정 저장중...
            </>
          ) : (
            <>
              <Check size={16} />
              설정 저장하기
            </>
          )}
        </button>
      </div>
    </form>
  )
}
