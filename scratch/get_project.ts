import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const project = await prisma.project.findFirst({
    orderBy: { created_at: 'desc' },
    include: { widgets: { orderBy: { sort_order: 'asc' } } }
  });
  console.dir(project, { depth: null });
}

main()
  .catch(e => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
  });
