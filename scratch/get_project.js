const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  const projects = await prisma.project.findMany({
    include: { creator: true, widgets: true },
    orderBy: { created_at: 'desc' },
    take: 1
  });
  console.log(JSON.stringify(projects, null, 2));
}

run();
