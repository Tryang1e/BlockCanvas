import ProjectModal from '@/components/creator/ProjectModal'

export default function ModalLoading() {
  return (
    <ProjectModal>
      <div className="w-full min-h-[70vh] flex flex-col items-center justify-center gap-4 bg-white dark:bg-neutral-900">
        <div className="w-16 h-16 border-4 border-neutral-100 dark:border-neutral-800 border-t-blue-600 rounded-full animate-spin" />
        <p className="text-neutral-500 font-bold animate-pulse text-sm">작품 정보를 가져오는 중입니다...</p>
      </div>
    </ProjectModal>
  )
}
