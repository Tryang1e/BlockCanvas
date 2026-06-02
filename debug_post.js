const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  const projectId = '14b0e819-7f2e-4aff-9aa2-51657590c1a9'
  console.log(`Checking project: ${projectId}`)
  
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: { widgets: true }
  })
  
  if (!project) {
    console.log('Project NOT FOUND in DB!')
    return
  }
  
  console.log(`Project Title: ${project.title}`)
  console.log(`Legacy Content field exists: ${!!project.content}`)
  if (project.content) {
     console.log(`Legacy Content Length: ${project.content.length}`)
     console.log(`Legacy Content Snippet: ${project.content.substring(0, 200)}`)
  }
  
  console.log(`Widget Count: ${project.widgets.length}`)
  project.widgets.forEach((w, i) => {
    console.log(`\n--- Widget ${i} ---`)
    console.log(`Type: ${w.type}`)
    console.log(`Sort Order: ${w.sort_order}`)
    console.log(`Raw Content: ${w.content}`)
  })
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
