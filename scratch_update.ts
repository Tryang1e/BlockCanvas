import { prisma } from './src/lib/prisma'
async function main() {
  await prisma.portfolio.updateMany({ data: { is_published: true } });
  console.log('Updated all portfolios to published');
}
main().finally(() => prisma.$disconnect());
