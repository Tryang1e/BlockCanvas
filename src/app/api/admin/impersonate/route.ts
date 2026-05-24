import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { cookies } from 'next/headers'

export async function POST(request: Request) {
  try {
    const { creatorName } = await request.json()
    if (!creatorName) {
      return NextResponse.json({ error: '대상 크리에이터 이름이 누락되었습니다.' }, { status: 400 })
    }

    // 1. 어드민 권한 체크
    const cookieStore = await cookies()
    const session = cookieStore.get('session')?.value

    let isAdmin = false
    if (session === 'admin') {
      isAdmin = true
    } else if (session) {
      const adminProfile = await prisma.profile.findUnique({
        where: { creator_name: session }
      })
      if (adminProfile && adminProfile.role?.toLowerCase() === 'admin') {
        isAdmin = true
      }
    }

    if (!isAdmin) {
      return NextResponse.json({ error: '관리자 권한이 없습니다.' }, { status: 403 })
    }

    // 2. 대상 크리에이터 존재 확인
    const targetUser = await prisma.profile.findUnique({
      where: { creator_name: creatorName }
    })
    if (!targetUser) {
      return NextResponse.json({ error: '대상 크리에이터를 찾을 수 없습니다.' }, { status: 404 })
    }

    // 3. 쿠키 갱신 수행 (NextResponse 응답 상에서 direct set)
    const response = NextResponse.json({ success: true })
    response.cookies.set('session', creatorName, {
      httpOnly: true,
      secure: false, // Localhost http 대응
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 30 // 30 days
    })

    // 4. 어드민 활동 기록
    try {
      await prisma.auditLog.create({
        data: {
          admin_name: session || 'admin',
          action: 'IMPERSONATE_USER',
          target_id: targetUser.id,
          details: `Admin ${session} impersonated user: ${creatorName}`
        }
      })
    } catch (logErr) {
      console.error('Audit log failed', logErr)
    }

    return response
  } catch (err: any) {
    console.error('Impersonate API Error:', err)
    return NextResponse.json({ error: '서버 처리 중 오류가 발생했습니다.' }, { status: 500 })
  }
}
