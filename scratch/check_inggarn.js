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
  const p = await prisma.profile.findUnique({
    where: { creator_name: 'inggarn' },
    include: { portfolios: true }
  });
  console.log('User inggarn:', JSON.stringify(p, null, 2));
}

run().catch(console.error).finally(() => prisma.$disconnect());
