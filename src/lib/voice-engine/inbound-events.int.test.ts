import { createHmac, randomUUID } from "node:crypto";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db.server";
import { Route } from "@/routes/api/webhooks/voice-engine";
import { createTenant, deleteTenants, type Tenant } from "@/test/tenant-fixtures";
import { processInboundCallEvent } from "./inbound-events";

const SECRET = "test-voice-engine-secret";
const tenants: Tenant[] = [];
afterAll(() => deleteTenants(db, tenants));
beforeEach(() => {
  process.env["VOICE_ENGINE_WEBHOOK_SECRET"] = SECRET;
});

const newDigits = () => `91${8_000_000_000 + Math.floor(Math.random() * 999_999_999)}`;

async function workspace(
  options: { published?: boolean; liveActive?: boolean; draftActive?: boolean } = {},
) {
  const { published = true, liveActive = true, draftActive = true } = options;
  const tenant = await createTenant(db, 100);
  tenants.push(tenant);
  const digits = newDigits();
  const number = await db.inboundNumber.create({
    data: {
      clientId: tenant.clientId,
      phone: `+${digits}`,
      personaKey: "front-desk",
      workflow: "appointment",
      active: draftActive,
    },
  });
  if (published) {
    await db.inboundPublication.create({
      data: {
        numberId: number.id,
        version: 1,
        status: "synced",
        personaVersion: 1,
        snapshot: {
          phone: number.phone,
          clientId: tenant.clientId,
          version: 1,
          active: liveActive,
        },
      },
    });
  }
  return { tenant, number, digits };
}

type Overrides = { top?: Record<string, unknown>; data?: Record<string, unknown> };
function event(digits: string, overrides: Overrides = {}) {
  return {
    schemaVersion: 1,
    eventId: randomUUID(),
    eventType: "call.completed",
    occurredAt: "2026-10-27T10:00:00+00:00",
    ...overrides.top,
    data: {
      direction: "inbound",
      engineCallId: String(Math.floor(Math.random() * 1e12)),
      dialledNumber: digits,
      callerNumber: "+919876543210",
      durationSeconds: 42,
      status: "completed",
      outcome: "appointment_requested",
      summary: "Caller wants an appointment.",
      collectedFields: { name: null, preferred_time: "tomorrow 10am" },
      transcriptRef: "123",
      ...overrides.data,
    },
  };
}

const sign = (raw: string, secret = SECRET) =>
  createHmac("sha256", secret).update(raw, "utf8").digest("hex");

type Handler = (context: { request: Request }) => Promise<Response>;
const post: Handler = (Route.options as unknown as { server: { handlers: { POST: Handler } } })
  .server.handlers.POST;
async function deliver(body: unknown, options: { signature?: string | null; raw?: string } = {}) {
  const raw = options.raw ?? JSON.stringify(body);
  const headers: Record<string, string> = { "content-type": "application/json" };
  const signature = options.signature === undefined ? sign(raw) : options.signature;
  if (signature !== null) headers["x-voice-engine-signature"] = signature;
  return post({
    request: new Request("https://app.test/api/webhooks/voice-engine", {
      method: "POST",
      headers,
      body: raw,
    }),
  });
}
const callsFor = (engineCallId: string) => db.call.findMany({ where: { engineCallId } });

describe("inbound call reports: accepting a genuine event", () => {
  it("stores the call under the workspace that owns the dialled number, with every field", async () => {
    const { tenant, number, digits } = await workspace();
    const body = event(digits);
    const response = await deliver(body);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, processed: true });
    const [call] = await callsFor(body.data.engineCallId);
    expect(call).toMatchObject({
      clientId: tenant.clientId,
      inboundNumberId: number.id,
      direction: "inbound",
      callerNumber: "+919876543210",
      dialledNumber: number.phone,
      status: "completed",
      outcome: "Meeting booked",
      outcomeRaw: "appointment_requested",
      summary: "Caller wants an appointment.",
      collectedFields: { name: null, preferred_time: "tomorrow 10am" },
      durationSeconds: 42,
      transcriptRef: "123",
      campaignId: null,
      jobId: null,
      leadId: null,
    });
    expect(call?.createdAt.toISOString()).toBe("2026-10-27T10:00:00.000Z");
    expect(call?.reportedAt?.toISOString()).toBe("2026-10-27T10:00:00.000Z");
  });

  it("takes the workspace from Mona's mapping and ignores any workspace named in the message", async () => {
    const owner = await workspace();
    const other = await workspace();
    const body = event(owner.digits, {
      top: { clientId: other.tenant.clientId },
      data: { clientId: other.tenant.clientId },
    });
    expect((await deliver(body)).status).toBe(200);
    const [call] = await callsFor(body.data.engineCallId);
    expect(call?.clientId).toBe(owner.tenant.clientId);
    expect(await db.call.count({ where: { clientId: other.tenant.clientId } })).toBe(0);
  });

  it("normalizes the outcome, keeps the original, and handles an unknown or missing one", async () => {
    const { digits } = await workspace();
    const unknown = event(digits, { data: { outcome: "brand_new_engine_word" } });
    const missing = event(digits, { data: { outcome: null, transcriptRef: null } });
    const callback = event(digits, { data: { outcome: "callback_requested" } });
    for (const e of [unknown, missing, callback]) expect((await deliver(e)).status).toBe(200);

    expect((await callsFor(unknown.data.engineCallId))[0]).toMatchObject({
      outcome: "Inconclusive",
      outcomeRaw: "brand_new_engine_word",
    });
    expect((await callsFor(missing.data.engineCallId))[0]).toMatchObject({
      outcome: "Inconclusive",
      outcomeRaw: null,
      transcriptRef: null,
    });
    expect((await callsFor(callback.data.engineCallId))[0]).toMatchObject({
      outcome: "Callback",
      outcomeRaw: "callback_requested",
    });
  });

  it("adds no billing: credits and the ledger are untouched", async () => {
    const { tenant, digits } = await workspace();
    await deliver(event(digits, { data: { durationSeconds: 3600 } }));
    expect(
      (await db.client.findUniqueOrThrow({ where: { id: tenant.clientId } })).creditBalance,
    ).toBe(100);
    expect(await db.creditTransaction.count({ where: { clientId: tenant.clientId } })).toBe(0);
  });
});

describe("inbound call reports: signature and shape", () => {
  it("rejects a missing, wrong or tampered signature before reading the body", async () => {
    const { digits } = await workspace();
    const body = event(digits);
    const raw = JSON.stringify(body);

    expect((await deliver(body, { signature: null })).status).toBe(401);
    expect((await deliver(body, { signature: sign(raw, "another-secret") })).status).toBe(401);
    expect((await deliver(body, { signature: "not-hex" })).status).toBe(401);
    const tampered = raw.replace("42", "4200");
    expect((await deliver(body, { raw: tampered, signature: sign(raw) })).status).toBe(401);
    expect(await callsFor(body.data.engineCallId)).toHaveLength(0);
  });

  it("verifies the exact bytes received, not a re-serialised copy", async () => {
    const { digits } = await workspace();
    const body = event(digits);
    const spaced = JSON.stringify(body, null, 2); // same content, different bytes
    expect(
      (await deliver(body, { raw: spaced, signature: sign(JSON.stringify(body)) })).status,
    ).toBe(401);
    expect((await deliver(body, { raw: spaced })).status).toBe(200);
  });

  it("refuses everything when the server has no secret configured", async () => {
    delete process.env["VOICE_ENGINE_WEBHOOK_SECRET"];
    const { digits } = await workspace();
    expect((await deliver(event(digits))).status).toBe(500);
  });

  it("rejects malformed JSON and events that do not match the schema, storing nothing", async () => {
    const { digits } = await workspace();
    expect((await deliver(null, { raw: "{not json" })).status).toBe(400);

    const bad: Overrides[] = [
      { top: { schemaVersion: 2 } },
      { top: { eventId: "not-a-uuid" } },
      { top: { occurredAt: "yesterday" } },
      { data: { dialledNumber: "+918047491899" } },
      { data: { dialledNumber: "12" } },
      { data: { durationSeconds: -1 } },
      { data: { durationSeconds: 1.5 } },
      { data: { summary: "x".repeat(4_001) } },
      { data: { collectedFields: { note: "x".repeat(9_000) } } },
      { data: { collectedFields: "not an object" } },
      { data: { engineCallId: "abc" } },
      { data: { transcriptRef: "https://engine.example/calls/1" } },
      { data: { status: "" } },
    ];
    for (const overrides of bad) {
      const body = event(digits, overrides);
      const response = await deliver(body);
      expect(response.status, JSON.stringify(overrides)).toBe(400);
      expect(await callsFor(body.data.engineCallId)).toHaveLength(0);
    }
  });

  it("still requires a job id for events that are not inbound call reports", async () => {
    const { digits } = await workspace();
    const notInbound = event(digits, { data: { direction: "outbound" } });
    expect((await deliver(notInbound)).status).toBe(400);
  });
});

describe("inbound call reports: which numbers are accepted", () => {
  it("rejects a number Mona does not know", async () => {
    const body = event(newDigits());
    const response = await deliver(body);
    expect(response.status).toBe(404);
    expect(await callsFor(body.data.engineCallId)).toHaveLength(0);
  });

  it("rejects a number that was never published", async () => {
    const { digits } = await workspace({ published: false });
    const response = await deliver(event(digits));
    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({ reason: "number has not been published" });
  });

  it("rejects a number switched off both as a draft and as published", async () => {
    const { digits } = await workspace({ liveActive: false, draftActive: false });
    const response = await deliver(event(digits));
    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({ reason: "number is switched off" });
  });

  it("accepts a call the engine really answered while the draft says off, or just after it was published off", async () => {
    const draftOffLiveOn = await workspace({ liveActive: true, draftActive: false });
    expect((await deliver(event(draftOffLiveOn.digits))).status).toBe(200);
    const liveOffDraftOn = await workspace({ liveActive: false, draftActive: true });
    expect((await deliver(event(liveOffDraftOn.digits))).status).toBe(200);
  });

  it("rejects a number whose published route belongs to a different workspace than its mapping", async () => {
    const { number, digits } = await workspace();
    const stranger = await createTenant(db);
    tenants.push(stranger);
    await db.inboundPublication.updateMany({
      where: { numberId: number.id },
      data: {
        snapshot: { phone: number.phone, clientId: stranger.clientId, version: 1, active: true },
      },
    });
    const response = await deliver(event(digits));
    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({ reason: "number mapping is inconsistent" });
  });

  it("never lets one workspace's report touch a call another workspace owns", async () => {
    const a = await workspace();
    const b = await workspace();
    const first = event(a.digits);
    await deliver(first);

    const hijack = event(b.digits, {
      data: { engineCallId: first.data.engineCallId, summary: "overwritten" },
    });
    const response = await deliver(hijack);
    expect(response.status).toBe(409);
    const [call] = await callsFor(first.data.engineCallId);
    expect(call).toMatchObject({
      clientId: a.tenant.clientId,
      summary: "Caller wants an appointment.",
    });
    expect(await db.voiceEngineWebhookEvent.count({ where: { eventId: hijack.eventId } })).toBe(0);
  });

  it("will not turn a campaign call into an inbound one", async () => {
    const { tenant, digits } = await workspace();
    const campaign = await db.campaign.create({
      data: { clientId: tenant.clientId, name: "Campaign", status: "Active" },
    });
    const outbound = await db.call.create({
      data: {
        clientId: tenant.clientId,
        campaignId: campaign.id,
        engineCallId: "777000",
        direction: "outbound",
      },
    });
    const response = await deliver(event(digits, { data: { engineCallId: "777000" } }));
    expect(response.status).toBe(409);
    expect((await db.call.findUniqueOrThrow({ where: { id: outbound.id } })).direction).toBe(
      "outbound",
    );
  });
});

describe("inbound call reports: replays and ordering", () => {
  it("handles a redelivered event once", async () => {
    const { digits } = await workspace();
    const body = event(digits);
    expect(await (await deliver(body)).json()).toEqual({ ok: true, processed: true });
    const replay = await deliver(body);
    expect(replay.status).toBe(200);
    expect(await replay.json()).toEqual({ ok: true, processed: false, reason: "duplicate event" });
    expect(await callsFor(body.data.engineCallId)).toHaveLength(1);
  });

  it("keeps the newest report when an older one for the same call arrives late", async () => {
    const { digits } = await workspace();
    const newer = event(digits, {
      top: { occurredAt: "2026-10-27T10:05:00+00:00" },
      data: { summary: "newer" },
    });
    const older = event(digits, {
      top: { occurredAt: "2026-10-27T10:00:00+00:00" },
      data: { engineCallId: newer.data.engineCallId, summary: "older" },
    });
    await deliver(newer);
    const late = await deliver(older);
    expect(await late.json()).toEqual({ ok: true, processed: true, reason: "stale event ignored" });
    const calls = await callsFor(newer.data.engineCallId);
    expect(calls).toHaveLength(1);
    expect(calls[0]?.summary).toBe("newer");
  });

  it("updates the call when a newer report arrives after an older one", async () => {
    const { digits } = await workspace();
    const older = event(digits, {
      top: { occurredAt: "2026-10-27T10:00:00+00:00" },
      data: { outcome: "unresolved" },
    });
    const newer = event(digits, {
      top: { occurredAt: "2026-10-27T10:05:00+00:00" },
      data: { engineCallId: older.data.engineCallId, outcome: "callback_requested" },
    });
    await deliver(older);
    await deliver(newer);
    const [call] = await callsFor(older.data.engineCallId);
    expect(call).toMatchObject({ outcome: "Callback", outcomeRaw: "callback_requested" });
    expect(await callsFor(older.data.engineCallId)).toHaveLength(1);
  });

  it("is safe when the same event is delivered twice at once", async () => {
    const { digits } = await workspace();
    const body = event(digits);
    const [a, b] = await Promise.all([
      processInboundCallEvent(db, body),
      processInboundCallEvent(db, body),
    ]).catch(() => [null, null]);
    expect(await callsFor(body.data.engineCallId)).toHaveLength(1);
    expect([a, b].filter((r) => r?.ok && r.processed).length).toBeLessThanOrEqual(1);
  });
});
