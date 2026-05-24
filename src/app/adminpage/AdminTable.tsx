'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { deleteUserAction, updateUserRoleAction, impersonateUserAction } from '@/app/actions/admin'
import Link from 'next/link'

export default function AdminTable({ profiles }: { profiles: any[] }) {
  const router = useRouter()
  const [loading, setLoading] = useState<string | null>(null)
  
  // 1. 클릭 시 사용자 상세 정보를 확인하는 모달 상태
  const [selectedUserProfile, setSelectedUserProfile] = useState<any | null>(null)
  
  const [modalConfig, setModalConfig] = useState<{
    isOpen: boolean;
    type: 'role' | 'delete' | null;
    targetId: string | null;
    targetName: string | null;
    targetRole: string | null;
    selectedRole: string;
  }>({
    isOpen: false,
    type: null,
    targetId: null,
    targetName: null,
    targetRole: null,
    selectedRole: 'creator'
  })

  const openRoleModal = (id: string, name: string, role: string) => {
    setModalConfig({ isOpen: true, type: 'role', targetId: id, targetName: name, targetRole: role, selectedRole: role })
  }

  const openDeleteModal = (id: string, name: string) => {
    setModalConfig({ isOpen: true, type: 'delete', targetId: id, targetName: name, targetRole: null, selectedRole: '' })
  }

  const closeModal = () => {
    setModalConfig({ isOpen: false, type: null, targetId: null, targetName: null, targetRole: null, selectedRole: '' })
  }

  const confirmAction = async () => {
    if (!modalConfig.targetId) return
    const id = modalConfig.targetId

    try {
      setLoading(id)
      if (modalConfig.type === 'delete') {
        const res = await deleteUserAction(id)
        if (res?.error) alert(`오류: ${res.error}`)
      } else if (modalConfig.type === 'role') {
        const res = await updateUserRoleAction(id, modalConfig.selectedRole)
        if (res?.error) alert(`오류: ${res.error}`)
      }
    } catch (err: any) {
      alert(`오류: ${err.message || '서버 통신 실패'}`)
    } finally {
      setLoading(null)
      closeModal()
      router.refresh()
    }
  }

  const handleImpersonation = async (creatorName: string) => {
    const check = confirm(`정말로 [${creatorName}] 크리에이터 계정으로 대리(강제) 로그인하시겠습니까?\n세션 쿠키가 강제 갱신되며, 해당 사용자의 대시보드로 이동합니다.`)
    if (!check) return

    try {
      setLoading(selectedUserProfile?.id || 'impersonate')
      const response = await fetch('/api/admin/impersonate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ creatorName })
      })
      const res = await response.json()
      if (res.error) {
        alert(`대리 로그인 실패: ${res.error}`)
      } else {
        // 성공 시 즉각 해당 사용자의 대시보드로 통째로 밀어넣으며 하드 리플레시(세션 갱신)!
        window.location.href = `/creator/${creatorName}/dashboard`
      }
    } catch (err: any) {
      alert(`시스템 에러: ${err.message || '네트워크 통신 예외 발생'}`)
    } finally {
      setLoading(null)
    }
  }

  return (
    <>
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left align-middle border-collapse">
          <thead className="bg-neutral-50 text-neutral-500 border-b border-neutral-200 text-xs tracking-wide">
            <tr>
              <th className="px-6 py-3 font-semibold uppercase">크리에이터 닉네임</th>
              <th className="px-6 py-3 font-semibold uppercase">디스코드 / 이메일</th>
              <th className="px-6 py-3 font-semibold uppercase">권한 (Role)</th>
              <th className="px-6 py-3 font-semibold uppercase">가입일</th>
              <th className="px-6 py-3 font-semibold uppercase text-right">관리 작업</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100 bg-white text-neutral-600">
            {profiles && profiles.map((profile: any) => (
              <tr key={profile.id} className="hover:bg-blue-50/50 transition-colors">
                  <td className="px-6 py-4">
                    <button
                      onClick={() => setSelectedUserProfile(profile)}
                      type="button"
                      className="font-bold text-neutral-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 transition-colors text-left focus:outline-none group flex items-center gap-1.5"
                      title="클릭하여 상세 정보 확인"
                    >
                      <span>{profile.creator_name}</span>
                      <span className="text-neutral-400 font-normal group-hover:text-blue-500 transition-colors">({profile.display_name})</span>
                      <svg className="w-3.5 h-3.5 text-neutral-400 group-hover:text-blue-500 opacity-0 group-hover:opacity-100 transform scale-90 group-hover:scale-100 transition-all duration-300" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    </button>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-xs font-medium text-neutral-900">{profile.discord_id || '-'}</div>
                    <div className="text-xs text-neutral-400">{profile.email}</div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2.5 py-1 bg-opacity-20 rounded-md text-[11px] font-bold tracking-wide uppercase ${profile.role?.toLowerCase() === 'admin' ? 'bg-purple-100 text-purple-700' : 'bg-green-100 text-green-700'}`}>
                      {profile.role}
                    </span>
                  </td>
                  <td className="px-6 py-4 tabular-nums text-xs">
                  {new Date(profile.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 text-right space-x-3">
                    <Link 
                      href={`/creator/${profile.creator_name}/dashboard`}
                      className="text-neutral-600 hover:text-neutral-900 hover:underline font-bold text-[11px] uppercase"
                    >
                      대시보드 보기
                    </Link>
                    <button 
                      onClick={() => openRoleModal(profile.id, profile.creator_name, profile.role)}
                      disabled={loading === profile.id}
                      className="text-blue-600 hover:text-blue-800 hover:underline font-bold text-[11px] uppercase disabled:opacity-50"
                    >
                      권한수정
                    </button>
                    <button 
                      onClick={() => openDeleteModal(profile.id, profile.creator_name)}
                      disabled={loading === profile.id}
                      className="text-red-500 hover:text-red-700 hover:underline font-bold text-[11px] uppercase disabled:opacity-50"
                    >
                      삭제
                    </button>
                  </td>
              </tr>
            ))}
          </tbody>
        </table>
        
        {(!profiles || profiles.length === 0) && (
          <div className="p-10 text-center text-neutral-400 font-medium">데이터가 없습니다.</div>
        )}
      </div>

      {/* Custom Modal */}
      {modalConfig.isOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200">
            <div className={`p-6 border-b ${modalConfig.type === 'delete' ? 'border-red-100 bg-red-50' : 'border-blue-100 bg-blue-50'}`}>
              <h3 className={`text-lg font-black tracking-tight ${modalConfig.type === 'delete' ? 'text-red-600' : 'text-blue-600'}`}>
                {modalConfig.type === 'delete' ? '계정 영구 삭제' : '권한 설정'}
              </h3>
            </div>
            <div className="p-6 text-neutral-700 font-medium text-sm leading-relaxed">
              {modalConfig.type === 'delete' ? (
                <>정말로 <span className="font-bold text-black">{modalConfig.targetName}</span> 사용자를 삭제하시겠습니까?<br/><span className="text-red-500 mt-2 block text-xs font-bold">이 작업은 취소할 수 없으며 모든 데이터가 날아갑니다.</span></>
              ) : (
                <div className="space-y-4">
                  <p><span className="font-bold text-black">{modalConfig.targetName}</span> 님의 역할을 선택하세요.</p>
                  <div>
                    <label className="block text-xs font-bold text-neutral-500 uppercase tracking-wider mb-2">새로운 권한 (Role)</label>
                    <select
                      value={modalConfig.selectedRole}
                      onChange={(e) => setModalConfig({ ...modalConfig, selectedRole: e.target.value })}
                      className="w-full border border-neutral-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="creator">Creator (일반 크리에이터)</option>
                      <option value="admin">Admin (관리자)</option>
                      <option value="moderator">Moderator (게시물 관리자)</option>
                      <option value="viewer">Viewer (일반 열람자)</option>
                    </select>
                  </div>
                </div>
              )}
            </div>
            <div className="p-4 bg-neutral-50 border-t border-neutral-100 flex justify-end gap-3">
              <button 
                onClick={closeModal}
                disabled={loading !== null}
                className="px-4 py-2 text-sm font-bold text-neutral-500 bg-white border border-neutral-200 hover:bg-neutral-50 rounded-lg transition-colors disabled:opacity-50"
              >
                취소
              </button>
              <button 
                onClick={confirmAction}
                disabled={loading !== null || (modalConfig.type === 'role' && modalConfig.selectedRole === modalConfig.targetRole)}
                className={`px-4 py-2 text-sm font-bold text-white rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50 ${modalConfig.type === 'delete' ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'}`}
              >
                {loading === modalConfig.targetId ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin block"></span> 처리중...
                  </>
                ) : (
                  modalConfig.type === 'delete' ? '삭제하기' : '저장하기'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 👤 어드민 전용 사용자 상세 프로필 모달 */}
      {selectedUserProfile && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-md p-4 animate-in fade-in duration-300">
          <div className="bg-white dark:bg-neutral-900 border border-neutral-200/50 dark:border-neutral-800/60 rounded-3xl w-full max-w-[480px] overflow-hidden shadow-2xl relative animate-in zoom-in-95 duration-300 select-none">
            
            {/* 상단 장식 광선 */}
            <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500 pointer-events-none" />

            {/* 헤더 타이틀 */}
            <div className="p-6 border-b border-neutral-100 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/50 flex justify-between items-center">
              <h3 className="text-base font-extrabold text-neutral-800 dark:text-white flex items-center gap-2">
                👤 크리에이터 상세 정보
              </h3>
              <button
                type="button"
                onClick={() => setSelectedUserProfile(null)}
                className="w-7 h-7 flex items-center justify-center rounded-full bg-neutral-200/60 dark:bg-neutral-800 text-neutral-500 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-200 transition-all font-bold"
              >
                ✕
              </button>
            </div>

            {/* 본문 정보 리스트 */}
            <div className="p-8 space-y-6 max-h-[460px] overflow-y-auto">
              
              {/* 아바타와 닉네임 기본 영역 */}
              <div className="flex items-center gap-4 border-b border-neutral-100 dark:border-neutral-800/80 pb-6">
                <div className="w-16 h-16 rounded-2xl bg-neutral-100 dark:bg-neutral-800 border border-neutral-200/50 dark:border-neutral-700/50 overflow-hidden flex items-center justify-center text-2xl font-black text-blue-600 dark:text-blue-400">
                  {selectedUserProfile.avatar_url ? (
                    <img src={selectedUserProfile.avatar_url} alt="avatar" className="w-full h-full object-cover" />
                  ) : (
                    (selectedUserProfile.display_name || selectedUserProfile.creator_name || 'U').charAt(0).toUpperCase()
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-black text-neutral-900 dark:text-white leading-tight">
                      {selectedUserProfile.creator_name}
                    </span>
                    <span className="px-2 py-0.5 bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 rounded-md text-[10px] font-bold tracking-wide uppercase border border-blue-100 dark:border-blue-900/40">
                      {selectedUserProfile.role}
                    </span>
                  </div>
                  <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-1 font-medium">
                    닉네임: {selectedUserProfile.display_name || '-'}
                  </p>
                </div>
              </div>

              {/* 상세 세부 항목 리스트 */}
              <div className="space-y-4 text-xs font-medium text-neutral-600 dark:text-neutral-400">
                <div className="flex justify-between items-center py-1">
                  <span className="text-neutral-400">고유 계정 ID</span>
                  <span className="font-mono bg-neutral-50 dark:bg-neutral-950 px-2.5 py-1 rounded-lg border border-neutral-200/40 dark:border-neutral-800/60 text-neutral-800 dark:text-neutral-300 select-all">
                    {selectedUserProfile.id}
                  </span>
                </div>

                <div className="flex justify-between items-center py-1">
                  <span className="text-neutral-400">이메일 주소</span>
                  <span className="font-bold text-neutral-800 dark:text-white">
                    {selectedUserProfile.email || '-'}
                  </span>
                </div>

                <div className="flex justify-between items-center py-1">
                  <span className="text-neutral-400">디스코드 계정</span>
                  <span className="font-mono bg-indigo-50/50 dark:bg-indigo-950/20 text-indigo-600 dark:text-indigo-400 px-2.5 py-1 rounded-lg border border-indigo-100/40 dark:border-indigo-900/40 font-bold">
                    {selectedUserProfile.discord_id || '연동 안 됨'}
                  </span>
                </div>

                <div className="flex justify-between items-center py-1">
                  <span className="text-neutral-400">가입 날짜</span>
                  <span className="text-neutral-800 dark:text-white">
                    {new Date(selectedUserProfile.created_at).toLocaleString()}
                  </span>
                </div>
              </div>

              {/* 🔗 포트폴리오 및 대시보드 바로가기 구획 */}
              <div className="border-t border-neutral-100 dark:border-neutral-800/80 pt-5 space-y-3">
                <h4 className="text-[10px] uppercase font-bold text-neutral-400 dark:text-neutral-500 tracking-wider">
                  🔗 포트폴리오 및 대시보드 바로가기
                </h4>
                <div className="grid grid-cols-2 gap-2.5">
                  {/* 1. 사용자 대시보드 바로가기 */}
                  <Link
                    href={`/creator/${selectedUserProfile.creator_name}/dashboard`}
                    target="_blank"
                    className="px-3 py-3 bg-neutral-50 hover:bg-neutral-100 dark:bg-neutral-950/40 dark:hover:bg-neutral-950 border border-neutral-200/50 dark:border-neutral-800/80 text-neutral-700 dark:text-neutral-300 rounded-2xl text-xs font-bold transition-all text-center flex items-center justify-center gap-1.5 active:scale-[0.98]"
                  >
                    <span>📊 대시보드 이동</span>
                  </Link>

                  {/* 2. 포트폴리오 사이트 바로가기 (비활성 시 disabled 및 디밍) */}
                  {selectedUserProfile.portfolios && selectedUserProfile.portfolios.is_published ? (
                    <Link
                      href={`/creator/${selectedUserProfile.creator_name}`}
                      target="_blank"
                      className="px-3 py-3 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/20 dark:hover:bg-indigo-950/40 border border-indigo-200/50 dark:border-indigo-900/40 text-indigo-600 dark:text-indigo-400 rounded-2xl text-xs font-bold transition-all text-center flex items-center justify-center gap-1.5 active:scale-[0.98]"
                    >
                      <span>🎨 포트폴리오 가기</span>
                    </Link>
                  ) : (
                    <button
                      type="button"
                      disabled
                      className="px-3 py-3 bg-neutral-100 dark:bg-neutral-950/20 border border-neutral-200/30 dark:border-neutral-800/30 text-neutral-400 dark:text-neutral-600 rounded-2xl text-xs font-bold transition-all text-center flex items-center justify-center gap-1.5 cursor-not-allowed opacity-50 select-none"
                      title="포트폴리오가 생성되지 않았거나 비공개 상태입니다."
                    >
                      <span>🔒 포트폴리오 (비활성)</span>
                    </button>
                  )}
                </div>
              </div>

            </div>

            {/* 하단 액션 버튼 바 */}
            <div className="p-6 bg-neutral-50 dark:bg-neutral-900/60 border-t border-neutral-100 dark:border-neutral-800 flex flex-col sm:flex-row gap-2.5 justify-end">
              
              {/* 🔑 원터치 비밀번호 초기화 탭 즉각 자동연계 연동 */}
              {selectedUserProfile.email && (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedUserProfile(null)
                    router.push(`/adminpage/password-reset?email=${encodeURIComponent(selectedUserProfile.email)}`)
                  }}
                  className="w-full sm:w-auto px-4 py-2.5 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/20 dark:hover:bg-rose-950/40 border border-rose-200 dark:border-rose-900/40 text-rose-600 dark:text-rose-400 rounded-xl text-xs font-bold transition-all text-center flex items-center justify-center gap-1 active:scale-[0.98]"
                >
                  🔑 비밀번호 리셋하러 가기
                </button>
              )}

              {/* 👥 대행 로그인 강제 세션 가로채기 단추 */}
              <button
                type="button"
                disabled={loading !== null}
                onClick={() => handleImpersonation(selectedUserProfile.creator_name)}
                className="w-full sm:w-auto px-4 py-2.5 bg-violet-600 hover:bg-violet-700 text-white rounded-xl text-xs font-bold transition-all text-center flex items-center justify-center gap-1.5 active:scale-[0.98] disabled:opacity-50"
              >
                {loading === selectedUserProfile.id ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin block"></span>
                    <span>대행 중...</span>
                  </>
                ) : (
                  <>
                    <span>👥 대행 로그인 (강제)</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => {
                  setSelectedUserProfile(null)
                  openRoleModal(selectedUserProfile.id, selectedUserProfile.creator_name, selectedUserProfile.role)
                }}
                className="w-full sm:w-auto px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all text-center flex items-center justify-center gap-1 active:scale-[0.98]"
              >
                🛠️ 권한 변경
              </button>

              <button
                type="button"
                onClick={() => setSelectedUserProfile(null)}
                className="w-full sm:w-auto px-4 py-2.5 bg-white dark:bg-neutral-850 hover:bg-neutral-50 border border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-400 rounded-xl text-xs font-bold transition-all text-center active:scale-[0.98]"
              >
                닫기
              </button>

            </div>

          </div>
        </div>
      )}
    </>
  )
}
