import { PrismaClient } from '@prisma/client';

// In development, hot-reloading (Nodemon) can instantiate multiple PrismaClient instances,
// exhausting the PostgreSQL connection pool. We use a global variable singleton to prevent this.
const globalForPrisma = global;

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

export default prisma;
