import { PrismaClient } from "@prisma/client";

// Singleton del cliente Prisma para evitar agotar conexiones en desarrollo
// (Next.js recarga los módulos con cada cambio).
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
