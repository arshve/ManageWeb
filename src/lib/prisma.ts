/**
 * Prisma Client Singleton
 *
 * Creates a single PrismaClient instance that is reused across the app.
 * In development, Next.js hot-reloads modules which would normally create
 * a new database connection on every reload. To prevent this, we store
 * the client on `globalThis` which persists across hot reloads.
 *
 * In production, this is just a normal module-level singleton.
 *
 * Import this everywhere you need database access:
 *   import { prisma } from "@/lib/prisma";
 */

import { PrismaClient } from '@/generated/prisma';

const prismaClientSingleton = () => {
  return new PrismaClient();
};

declare global {
  // eslint-disable-next-line no-var
  var prismaGlobal: undefined | ReturnType<typeof prismaClientSingleton>;
}

export const prisma = globalThis.prismaGlobal ?? prismaClientSingleton();

if (process.env.NODE_ENV !== 'production') globalThis.prismaGlobal = prisma;
