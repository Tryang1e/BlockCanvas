import { PrismaClient } from '@prisma/client'
import { PrismaLibSql } from '@prisma/adapter-libsql'
import path from 'path'

const adapter = new PrismaLibSql({
  url: 'file:' + path.join(process.cwd(), 'dev.db'),
})

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const prisma =
  new PrismaClient({
    adapter,
    log: ['query'],
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
