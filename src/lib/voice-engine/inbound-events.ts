// Finished inbound calls reported by the voice engine (agent/app/reporting.py).
//
// Trust model: the signature proves the message came from the engine, not that its contents are right.
// So the workspace is never read from the message. It is decided by Mona's own record of who owns the
// dialled number, and every field is validated and size-limited before it is stored.
import { z } from "zod";
import type { Prisma, PrismaClient } from "@prisma/client";

import { isUniqueViolation } from "@/lib/db-errors";
import { normalizeOutcome } from "@/lib/outcomes";

const MAX_COLLECTED_FIELDS_CHARS = 8_192;
const DIGITS = /^[0-9]{1,18}$/;

export const inboundCallEventSchema = z.object({
  schemaVersion: z.literal(1),
  eventId: z.string().uuid(),
  eventType: z.literal("call.completed"),
  occurredAt: z.string().datetime({ offset: true }),
  data: z.object({
    direction: z.literal("inbound"),
    engineCallId: z.string().regex(DIGITS),
    dialledNumber: z.string().regex(/^[1-9][0-9]{9,14}$/),
    callerNumber: z.string().trim().max(20).nullable().optional(),
    durationSeconds: z.number().int().min(0).max(86_400),
    status: z.string().min(1).max(40),
    outcome: z.string().max(200).nullable(),
    summary: z.string().max(4_000).default(""),
    collectedFields: z
      .record(z.string().max(100), z.unknown())
      .refine(
        (v) => JSON.stringify(v).length <= MAX_COLLECTED_FIELDS_CHARS,
        "collectedFields is too large",
      )
      .default({}),
    transcriptRef: z.string().regex(DIGITS).nullable(),
  }),
});
export type InboundCallEvent = z.infer<typeof inboundCallEventSchema>;

/** Whether an event is an inbound call report. Decides only which handler validates it. */
export function isInboundCallEvent(value: unknown): boolean {
  const event = value as { eventType?: unknown; data?: { direction?: unknown } } | null;
  return event?.eventType === "call.completed" && event.data?.direction === "inbound";
}

export type InboundIngestResult =
  | { ok: true; processed: boolean; reason?: string }
  | { ok: false; status: 400 | 403 | 404 | 409; reason: string };

class RefusedCall extends Error {}

export async function processInboundCallEvent(
  database: PrismaClient,
  raw: unknown,
): Promise<InboundIngestResult> {
  const parsed = inboundCallEventSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, status: 400, reason: "invalid inbound call event" };
  const event = parsed.data;
  const { data } = event;

  // Who owns this number is decided here, from Mona's mapping, and from nothing in the message.
  const phone = `+${data.dialledNumber}`;
  const number = await database.inboundNumber.findUnique({ where: { phone } });
  if (!number) return { ok: false, status: 404, reason: "unknown number" };

  // The engine answers calls according to what was published, so that is what decides whether a report is
  // genuine: the newest confirmed publication, not a draft that has not been pushed yet.
  const live = await database.inboundPublication.findFirst({
    where: { numberId: number.id, status: "synced" },
    orderBy: { version: "desc" },
  });
  if (!live) return { ok: false, status: 403, reason: "number has not been published" };
  const published = live.snapshot as { clientId?: unknown; active?: unknown };
  if (published.clientId !== number.clientId) {
    return { ok: false, status: 403, reason: "number mapping is inconsistent" };
  }
  if (!number.active && published.active !== true) {
    return { ok: false, status: 403, reason: "number is switched off" };
  }

  const occurredAt = new Date(event.occurredAt);
  const now = new Date();
  const fields = {
    clientId: number.clientId,
    inboundNumberId: number.id,
    direction: "inbound",
    callerNumber: data.callerNumber || null,
    dialledNumber: phone,
    status: data.status,
    outcome: normalizeOutcome(data.outcome),
    outcomeRaw: data.outcome,
    summary: data.summary || null,
    collectedFields: data.collectedFields as Prisma.InputJsonValue,
    durationSeconds: data.durationSeconds,
    transcriptRef: data.transcriptRef,
    reportedAt: occurredAt,
  };

  try {
    return await database.$transaction(async (tx): Promise<InboundIngestResult> => {
      // Recorded first: a redelivery of the same event stops here.
      await tx.voiceEngineWebhookEvent.create({
        data: {
          eventId: event.eventId,
          jobId: null,
          eventType: event.eventType,
          payload: raw as Prisma.InputJsonValue,
        },
      });

      const existing = await tx.call.findUnique({
        where: { engineCallId: data.engineCallId },
        select: { id: true, clientId: true, direction: true, reportedAt: true },
      });
      if (existing && (existing.clientId !== number.clientId || existing.direction !== "inbound")) {
        throw new RefusedCall("call already recorded elsewhere");
      }
      if (existing?.reportedAt && occurredAt <= existing.reportedAt) {
        return { ok: true, processed: true, reason: "stale event ignored" };
      }
      if (existing) {
        await tx.call.update({ where: { id: existing.id }, data: fields });
      } else {
        await tx.call.create({
          data: {
            ...fields,
            engineCallId: data.engineCallId,
            createdAt: occurredAt > now ? now : occurredAt,
          },
        });
      }
      return { ok: true, processed: true };
    });
  } catch (error) {
    if (error instanceof RefusedCall) return { ok: false, status: 409, reason: error.message };
    if (isUniqueViolation(error, "event_id")) {
      return { ok: true, processed: false, reason: "duplicate event" };
    }
    throw error;
  }
}
