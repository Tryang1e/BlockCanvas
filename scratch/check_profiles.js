const { PrismaClient } = require('@prisma/client');
const { PrismaLibSql } = require('@prisma/adapter-libsql');
const path = require('path');

const adapter = new PrismaLibSql({
  url: 'file:' + path.join(process.cwd(), 'dev.db'),
});

const prisma = new PrismaClient({
  adapter,
});

async function run() {
  const profiles = await prisma.profile.findMany({
    include: { portfolios: true }
  });
  console.log('Profiles:');
  for (const p of profiles) {
    console.log(`- ID: ${p.id}, Creator: ${p.creator_name}, Display: ${p.display_name}, Avatar: ${p.avatar_url}, Banner: ${p.portfolios?.banner_url}`);
  }
}

run().catch(console.error).finally(() => prisma.$disconnect());
