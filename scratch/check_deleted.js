const { PrismaClient } = require('@prisma/client');
const { PrismaLibSql } = require('@prisma/adapter-libsql');
const path = require('path');

const adapter = new PrismaLibSql({
  url: 'file:' + path.join(__dirname, '../dev.db'),
});

const prisma = new PrismaClient({
  adapter,
});

async function main() {
  const creatorName = 'tryangle';
  const projectId = 'aaaa1111-1111-1111-1111-111111111111';

  console.log('--- DB Check for Tryangle Deletion ---');

  // Check Profile
  const profile = await prisma.profile.findUnique({
    where: { creator_name: creatorName }
  });
  console.log('Profile:', profile ? 'EXISTS (Not deleted!)' : 'DELETED (Does not exist)');

  if (profile) {
    console.log('Profile details:', JSON.stringify(profile, null, 2));
  }

  // Check Portfolio
  const portfolio = await prisma.portfolio.findFirst({
    where: { creator_id: profile ? profile.id : 'none' }
  });
  console.log('Portfolio:', portfolio ? 'EXISTS' : 'DELETED/NOT FOUND');

  // Check Projects
  const project = await prisma.project.findUnique({
    where: { id: projectId }
  });
  console.log(`Project (${projectId}):`, project ? 'EXISTS (Not deleted!)' : 'DELETED (Does not exist)');

  const allProjectsForUser = profile ? await prisma.project.findMany({
    where: { creator_id: profile.id }
  }) : [];
  console.log(`All projects count for user:`, allProjectsForUser.length);

  await prisma.$disconnect();
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
