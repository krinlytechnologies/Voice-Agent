import { PrismaClient } from "@prisma/client";

// Reuse one client across dev-server hot reloads so connections don't leak.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env["NODE_ENV"] === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env["NODE_ENV"] !== "production") globalForPrisma.prisma = db;
