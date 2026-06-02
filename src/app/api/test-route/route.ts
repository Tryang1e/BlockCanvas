import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const updated = await prisma.profile.update({
      where: { creator_name: 'tryangle' },
      data: { two_factor_enabled: false }
    })
    return NextResponse.json({ status: 'success', creator: updated.creator_name, two_factor_enabled: updated.two_factor_enabled })
  } catch (err: any) {
    return NextResponse.json({ status: 'error', message: err.message })
  }
}
