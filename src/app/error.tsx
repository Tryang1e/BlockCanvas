'use client'

import { useEffect } from 'react'
import Link from 'next/link'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Optionally log the error to an error reporting service
    console.error(error)
  }, [error])

  return (
    <div className="min-h-screen flex items-center justify-center bg-neutral-50 flex-col gap-6">
      <div className="bg-white p-12 rounded-3xl shadow-sm border border-neutral-200 text-center max-w-md">
        <h2 className="text-3xl font-black text-neutral-900 mb-4">앗, 오류가 발생했습니다.</h2>
        <p className="text-neutral-500 mb-8 font-medium leading-relaxed">
          요청하신 작업을 처리하는 중 예상치 못한 문제가 생겼습니다.<br />
          잠시 후 다시 시도해주세요.
        </p>
        <div className="flex flex-col gap-3">
          <button
            onClick={() => reset()}
            className="w-full bg-black text-white px-6 py-4 rounded-xl font-bold tracking-wide hover:bg-neutral-800 transition-colors"
          >
            다시 시도하기
          </button>
          <Link 
            href="/"
            className="w-full bg-neutral-100 text-neutral-600 px-6 py-4 rounded-xl font-bold tracking-wide hover:bg-neutral-200 transition-colors inline-block"
          >
            메인으로 돌아가기
          </Link>
        </div>
      </div>
    </div>
  )
}
