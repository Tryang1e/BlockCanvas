'use server'

import { prisma } from '@/lib/prisma'

export async function incrementProjectViewCount(projectId: string) {
  try {
    await prisma.project.update({
      where: { id: projectId },
      data: {
        view_count: { increment: 1 }
      }
    })
  } catch (err) {
    console.error('Failed to increment view count:', err)
  }
}
