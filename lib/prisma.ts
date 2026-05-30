import { PrismaClient } from "@prisma/client";

// Reuse a single PrismaClient across hot-reloads in dev and across route
// invocations in production. Instantiating a new client per request exhausts
// the database connection pool under load.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

export default prisma;
