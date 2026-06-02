const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  const profiles = await prisma.profile.findMany({
    select: { creator_name: true }
  })
  console.log('--- Registered IDs ---')
  console.log(profiles.map(p => p.creator_name))
  console.log('----------------------')
  
  const testProfile = await prisma.profile.findUnique({
    where: { creator_name: 'test' }
  })
  console.log('Test Profile Found:', !!testProfile)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
