import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function test() {
  const profile = await prisma.profile.findFirst()
  if (!profile) return console.log('No profile found')
  
  console.log('Profile password before:', profile.password)

  // Try updating
  await prisma.profile.update({
    where: { id: profile.id },
    data: { password: 'testpassword' }
  })
  
  const updated = await prisma.profile.findUnique({ where: { id: profile.id }})
  console.log('Profile password after:', updated?.password)
}

test()
