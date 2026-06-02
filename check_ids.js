const { PrismaClient } = require('@prisma/client')
const { PrismaLibSql } = require('@prisma/adapter-libsql')
const path = require('path')

const adapter = new PrismaLibSql({
  url: 'file:' + path.join(process.cwd(), 'dev.db'),
})

const prisma = new PrismaClient({ adapter })

async function main() {
  const ids = ['47856458-45f0-4d22-808e-5ab4374d468c', '14b0e819-7f2e-4aff-9aa2-51657590c1a9']
  
  for (const id of ids) {
    console.log(`\nChecking Project ID: ${id}`)
    const project = await prisma.project.findUnique({
      where: { id },
      include: { widgets: true }
    })
    
    if (project) {
      console.log(`  Found: ${project.title}`)
      console.log(`  Widgets: ${project.widgets.length}`)
      project.widgets.forEach(w => {
         console.log(`    - [${w.type}] ${w.id}`)
      })
    } else {
      console.log('  NOT FOUND')
    }
  }
}

main().catch(console.error).finally(() => prisma.$disconnect())
