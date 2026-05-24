const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  const user = await prisma.profile.findFirst({
    where: { creator_name: 'Sian17' },
    include: { portfolios: true, projects: true }
  })
  console.dir(user, { depth: null })
}

main().catch(console.error).finally(() => prisma.$disconnect())
