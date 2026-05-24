const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  const projects = await prisma.project.findMany({
    select: { id: true, title: true, created_at: true, thumbnail_url: true, section_id: true, category_id: true }
  })
  console.dir(projects, { depth: null })
}

main().catch(console.error).finally(() => prisma.$disconnect())
