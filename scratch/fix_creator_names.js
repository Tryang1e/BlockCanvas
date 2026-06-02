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
  const profiles = await prisma.profile.findMany();
  console.log('Migrating creator names to lowercase...');
  for (const p of profiles) {
    const lowered = p.creator_name.toLowerCase();
    if (p.creator_name !== lowered) {
      console.log(`Updating ${p.creator_name} -> ${lowered}`);
      await prisma.profile.update({
        where: { id: p.id },
        data: { creator_name: lowered }
      });
    }
  }
  console.log('Migration done!');
}

run().catch(console.error).finally(() => prisma.$disconnect());
