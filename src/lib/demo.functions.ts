import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { PrismaClient } from "@prisma/client";

import { db } from "@/lib/db.server";

// Same limits as the public form (src/components/DemoDialog.tsx), enforced again here and in
// the database. Public endpoint: rate limiting is a known gap (see docs/issues.md).
export const demoRequestSchema = z.object({
  name: z.string().trim().min(2).max(100),
  email: z
    .string()
    .trim()
    .max(255)
    .regex(/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/),
  phone: z
    .string()
    .trim()
    .max(20)
    .regex(/^[+\d][\d\s\-()]{6,19}$/),
  company: z.string().trim().max(120).default(""),
  message: z.string().trim().max(600).default(""),
});
export type DemoRequestInput = z.infer<typeof demoRequestSchema>;

export async function submitDemoRequestFor(database: PrismaClient, input: DemoRequestInput) {
  const created = await database.demoRequest.create({ data: input, select: { id: true } });
  return { ok: true as const, id: created.id };
}

export const submitDemoRequest = createServerFn({ method: "POST" })
  .validator(demoRequestSchema)
  .handler(({ data }) => submitDemoRequestFor(db, data));
