import { prisma } from './src/lib/prisma'
async function main() {
  const profiles = await prisma.profile.findMany({
    select: {
      id: true,
      creator_name: true,
      display_name: true,
      email: true,
      role: true,
      two_factor_enabled: true
    }
  });
  console.log(JSON.stringify(profiles, null, 2));
}
main().finally(() => prisma.$disconnect());

