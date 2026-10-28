import { randomUUID } from "node:crypto";
import type { PrismaClient } from "@prisma/client";

export interface Tenant {
  clientId: string;
  userId: string;
}

/**
 * Creates a client workspace with one owner user. Ids and emails are random so tests never
 * collide. The password hash is a placeholder: these users are never signed in with a password.
 */
export async function createTenant(db: PrismaClient, creditBalance = 100): Promise<Tenant> {
  const userId = randomUUID();
  const client = await db.client.create({
    data: {
      name: `Test workspace ${randomUUID().slice(0, 8)}`,
      creditBalance,
      members: {
        create: {
          role: "owner",
          user: {
            create: {
              id: userId,
              email: `test-${userId}@example.test`,
              passwordHash: "test-placeholder-not-a-scrypt-hash",
            },
          },
        },
      },
    },
    select: { id: true },
  });
  return { clientId: client.id, userId };
}

/** Deleting a client cascades to its campaigns, leads, calls, jobs and prompts. Users are removed too. */
export async function deleteTenants(db: PrismaClient, tenants: Tenant[]): Promise<void> {
  if (tenants.length === 0) return;
  const userIds = tenants.map((t) => t.userId);
  await db.client.deleteMany({ where: { id: { in: tenants.map((t) => t.clientId) } } });
  await db.user.deleteMany({ where: { id: { in: userIds } } });
}
