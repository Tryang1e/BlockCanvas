import { prisma } from './src/lib/prisma'
async function main() {
  const profile = await prisma.profile.findUnique({
    where: { creator_name: 'yunaron1004414' },
    include: { portfolios: true }
  });
  console.log(JSON.stringify(profile, null, 2));
}
main().finally(() => prisma.$disconnect());
