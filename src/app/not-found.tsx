import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-neutral-50 flex-col gap-6">
      <div className="bg-white p-12 rounded-3xl shadow-sm border border-neutral-200 text-center max-w-md">
        <h2 className="text-4xl font-black text-neutral-900 mb-4">404</h2>
        <h3 className="text-xl font-bold text-neutral-800 mb-3">페이지를 찾을 수 없습니다</h3>
        <p className="text-neutral-500 mb-8 font-medium leading-relaxed">
          요청하신 페이지가 삭제되었거나, 잘못된 주소입니다.<br />
          URL을 다시 한번 확인해주세요.
        </p>
        <Link 
          href="/"
          className="block w-full bg-black text-white px-6 py-4 rounded-xl font-bold tracking-wide hover:bg-neutral-800 transition-colors"
        >
          메인으로 돌아가기
        </Link>
      </div>
    </div>
  )
}
