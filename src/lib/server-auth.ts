import { cookies } from 'next/headers'
import { prisma } from './prisma'

/**
 * Checks if the current session matches the requested creatorName.
 * Throws an error if unauthorized.
 * Returns the creator's Profile ID for safe database queries.
 */
export async function requireAuth(creatorName: string): Promise<string> {
  const cookieStore = await cookies()
  const session = cookieStore.get('session')?.value

  let isAuthorized = false

  if (session === creatorName || session === 'admin') {
    isAuthorized = true
  } else if (session) {
    const sessionProfile = await prisma.profile.findUnique({
      where: { creator_name: session },
      select: { role: true }
    })
    if (sessionProfile?.role === 'admin') {
      isAuthorized = true
    }
  }

  if (!isAuthorized) {
    throw new Error('Unauthorized Access')
  }

  const profile = await prisma.profile.findUnique({
    where: { creator_name: creatorName },
    select: { id: true }
  })

  if (!profile) {
    throw new Error('Profile not found')
  }

  return profile.id
}
