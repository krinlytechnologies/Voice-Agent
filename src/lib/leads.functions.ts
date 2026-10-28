import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { PrismaClient } from "@prisma/client";

import { requireAuth } from "@/lib/auth.server";
import { db } from "@/lib/db.server";
import { currentWorkspaceClient } from "@/lib/workspace.functions";

export async function listLeadsFor(database: PrismaClient, userId: string, campaignId: string) {
  const client = await currentWorkspaceClient(database, userId);
  if (!client) return { client: null, leads: [] };
  const leads = await database.lead.findMany({
    where: { clientId: client.id, campaignId },
    orderBy: { createdAt: "desc" },
  });
  return { client, leads };
}

const importLeadsSchema = z.object({
  campaignId: z.string().uuid(),
  rows: z
    .array(
      z.object({
        name: z.string().trim().max(100),
        phone: z.string().regex(/^\+?\d{7,15}$/),
      }),
    )
    .min(1)
    .max(5000),
});
export type ImportLeadsInput = z.infer<typeof importLeadsSchema>;

/** Re-importing the same contacts is safe: duplicates per campaign are skipped by the unique key. */
export async function importLeadsFor(
  database: PrismaClient,
  userId: string,
  input: ImportLeadsInput,
) {
  const client = await currentWorkspaceClient(database, userId);
  if (!client) throw new Error("Your account isn't linked to a workspace yet.");

  const campaign = await database.campaign.findFirst({
    where: { id: input.campaignId, clientId: client.id },
    select: { id: true },
  });
  if (!campaign) throw new Error("Campaign not found.");

  const result = await database.lead.createMany({
    data: input.rows.map((row) => ({
      clientId: client.id,
      campaignId: campaign.id,
      name: row.name || "—",
      phone: row.phone,
    })),
    skipDuplicates: true,
  });
  return { imported: result.count, submitted: input.rows.length };
}

export const listLeads = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .validator(z.object({ campaignId: z.string().uuid() }))
  .handler(({ context, data }) => listLeadsFor(db, context.userId, data.campaignId));

export const importLeads = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator(importLeadsSchema)
  .handler(({ context, data }) => importLeadsFor(db, context.userId, data));
