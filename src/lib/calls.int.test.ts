import { randomUUID } from "node:crypto";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db.server";
import { createTenant, deleteTenants, type Tenant } from "@/test/tenant-fixtures";
import { VoiceEngineUnavailableError } from "@/lib/voice-engine/client";
import { getWorkspaceOverviewFor } from "./workspace.functions";
import {
  callListSchema,
  exportCallsFor,
  getCallTranscriptFor,
  listCallsFor,
  type CallListInput,
} from "./calls.functions";

// The engine client is replaced by a plain function that delegates to `engine.call`, so a test can make it
// fail without Vitest's call tracking reporting the failure as its own.
const engine = vi.hoisted(() => ({ call: (_id: string): unknown => undefined }));
vi.mock("@/lib/voice-engine/client", async () => {
  const actual = await vi.importActual<typeof import("@/lib/voice-engine/client")>(
    "@/lib/voice-engine/client",
  );
  return { ...actual, getEngineCall: (id: string) => engine.call(id) };
});

const engineCall = vi.fn();
const tenants: Tenant[] = [];
afterAll(() => deleteTenants(db, tenants));
beforeEach(() => {
  engineCall.mockReset();
  engine.call = engineCall;
});

const NOW = new Date("2026-10-14T06:00:00Z"); // 11:30 in India
const hoursAgo = (h: number) => new Date(NOW.getTime() - h * 3_600_000);
const input = (over: Partial<CallListInput> = {}): CallListInput => callListSchema.parse(over);

async function workspace() {
  const tenant = await createTenant(db, 100);
  tenants.push(tenant);
  const campaign = await db.campaign.create({
    data: { clientId: tenant.clientId, name: "October follow-ups", status: "Active" },
  });
  const lead = await db.lead.create({
    data: {
      clientId: tenant.clientId,
      campaignId: campaign.id,
      phone: "+919876500001",
      name: "Asha Rao",
    },
  });
  const number = await db.inboundNumber.create({
    data: {
      clientId: tenant.clientId,
      phone: `+91${8_000_000_000 + Math.floor(Math.random() * 999_999_999)}`,
      personaKey: "front-desk",
    },
  });
  return { tenant, campaign, lead, number };
}
type Workspace = Awaited<ReturnType<typeof workspace>>;

function inbound(w: Workspace, over: Record<string, unknown> = {}) {
  return db.call.create({
    data: {
      clientId: w.tenant.clientId,
      inboundNumberId: w.number.id,
      direction: "inbound",
      callerNumber: "+919811100001",
      dialledNumber: w.number.phone,
      outcome: "Interested",
      outcomeRaw: "qualified",
      durationSeconds: 45,
      engineCallId: String(Math.floor(Math.random() * 1e12)),
      createdAt: hoursAgo(1),
      ...over,
    },
  });
}
function outbound(w: Workspace, over: Record<string, unknown> = {}) {
  return db.call.create({
    data: {
      clientId: w.tenant.clientId,
      campaignId: w.campaign.id,
      leadId: w.lead.id,
      direction: "outbound",
      dialledNumber: w.lead.phone,
      outcome: "Not picked up",
      durationSeconds: 0,
      createdAt: hoursAgo(2),
      ...over,
    },
  });
}

describe("call lists: tenant isolation", () => {
  it("shows a workspace only its own calls, inbound and outbound", async () => {
    const a = await workspace();
    const b = await workspace();
    await inbound(a);
    await outbound(a);
    await inbound(b, { callerNumber: "+919822200002" });

    const mine = await listCallsFor(db, a.tenant.userId, input(), NOW);
    expect(mine.total).toBe(2);
    expect(mine.rows.map((r) => r.direction).sort()).toEqual(["inbound", "outbound"]);
    expect(JSON.stringify(mine)).not.toContain("+919822200002");
    expect(mine.numbers).toEqual([a.number.phone]);
    expect(mine.campaigns).toEqual([{ id: a.campaign.id, name: "October follow-ups" }]);
  });

  it("returns nothing for a user with no workspace", async () => {
    const result = await listCallsFor(db, randomUUID(), input(), NOW);
    expect(result).toMatchObject({ client: null, rows: [], total: 0 });
  });

  it("cannot be pointed at another workspace's campaign or number by a filter", async () => {
    const a = await workspace();
    const b = await workspace();
    await inbound(b);
    expect(
      (await listCallsFor(db, a.tenant.userId, input({ campaignId: b.campaign.id }), NOW)).total,
    ).toBe(0);
    expect(
      (await listCallsFor(db, a.tenant.userId, input({ dialled: b.number.phone }), NOW)).total,
    ).toBe(0);
  });
});

describe("call lists: what a row shows", () => {
  it("carries the real status, duration, outcome, original outcome, summary and collected details", async () => {
    const w = await workspace();
    await inbound(w, {
      status: "completed",
      durationSeconds: 83,
      outcome: "Callback",
      outcomeRaw: "callback_requested",
      summary: "Wants a call tomorrow.",
      collectedFields: { name: "Ravi", budget: null, tags: ["a", "b"] },
      transcriptRef: "555",
    });
    const [row] = (await listCallsFor(db, w.tenant.userId, input(), NOW)).rows;
    expect(row).toMatchObject({
      direction: "inbound",
      contact: "+919811100001",
      dialled: w.number.phone,
      status: "completed",
      duration: 83,
      outcome: "Callback",
      outcomeRaw: "callback_requested",
      summary: "Wants a call tomorrow.",
      transcriptAvailable: true,
      collectedFields: [
        { key: "budget", value: "—" },
        { key: "name", value: "Ravi" },
        { key: "tags", value: '["a","b"]' },
      ],
    });
  });

  it("shows the contact's number for an outbound call and no transcript when there is no reference", async () => {
    const w = await workspace();
    await outbound(w);
    const [row] = (await listCallsFor(db, w.tenant.userId, input(), NOW)).rows;
    expect(row).toMatchObject({
      direction: "outbound",
      contact: "+919876500001",
      name: "Asha Rao",
      campaign: "October follow-ups",
      dialled: null,
      transcriptAvailable: false,
    });
  });
});

describe("call lists: filters, paging and totals", () => {
  async function mixed() {
    const w = await workspace();
    await inbound(w, { outcome: "Interested", durationSeconds: 20, createdAt: hoursAgo(1) });
    await inbound(w, { outcome: "Callback", durationSeconds: 45, createdAt: hoursAgo(30) });
    await inbound(w, { outcome: "Interested", durationSeconds: 120, createdAt: hoursAgo(24 * 10) });
    await outbound(w, { outcome: "Not picked up", durationSeconds: 0, createdAt: hoursAgo(2) });
    await outbound(w, { outcome: "Voicemail", durationSeconds: 0, createdAt: hoursAgo(5) });
    return w;
  }
  const totalOf = async (w: Workspace, over: Partial<CallListInput>) =>
    (await listCallsFor(db, w.tenant.userId, input(over), NOW)).total;

  it("filters by direction, outcome, duration and campaign", async () => {
    const w = await mixed();
    expect(await totalOf(w, {})).toBe(5);
    expect(await totalOf(w, { direction: "inbound" })).toBe(3);
    expect(await totalOf(w, { direction: "outbound" })).toBe(2);
    expect(await totalOf(w, { outcome: "Interested" })).toBe(2);
    expect(await totalOf(w, { duration: "Short", direction: "inbound" })).toBe(1);
    expect(await totalOf(w, { duration: "Medium" })).toBe(1);
    expect(await totalOf(w, { duration: "Long" })).toBe(1);
    expect(await totalOf(w, { campaignId: w.campaign.id })).toBe(2);
  });

  it("filters by date range in India time", async () => {
    const w = await mixed();
    expect(await totalOf(w, { range: "Today" })).toBe(3); // 1h, 2h and 5h ago are all after 05:30 IST
    expect(await totalOf(w, { range: "7" })).toBe(4);
    expect(await totalOf(w, { range: "30" })).toBe(5);
  });

  it("searches a number or a lead's name", async () => {
    const w = await mixed();
    expect(await totalOf(w, { query: "9811100001" })).toBe(3);
    expect(await totalOf(w, { query: "asha" })).toBe(2);
    expect(await totalOf(w, { query: "nobody" })).toBe(0);
  });

  it("summarises exactly the calls the filters select", async () => {
    const w = await mixed();
    const all = await listCallsFor(db, w.tenant.userId, input(), NOW);
    expect(all.stats).toEqual({ total: 5, connected: 3, rate: 60, average: 62, interested: 2 });
    const inboundOnly = await listCallsFor(
      db,
      w.tenant.userId,
      input({ direction: "inbound", duration: "Short" }),
      NOW,
    );
    expect(inboundOnly.stats).toEqual({
      total: 1,
      connected: 1,
      rate: 100,
      average: 20,
      interested: 1,
    });
  });

  it("counts connected calls inside the chosen duration, and counts both directions", async () => {
    const w = await mixed();
    const long = await listCallsFor(db, w.tenant.userId, input({ duration: "Long" }), NOW);
    expect(long.stats).toEqual({ total: 1, connected: 1, rate: 100, average: 120, interested: 1 });
    const medium = await listCallsFor(db, w.tenant.userId, input({ duration: "Medium" }), NOW);
    expect(medium.stats).toMatchObject({ total: 1, connected: 1, average: 45 });
    // The direction counts ignore the direction filter itself, so both tabs can show their number.
    const outboundTab = await listCallsFor(
      db,
      w.tenant.userId,
      input({ direction: "outbound" }),
      NOW,
    );
    expect(outboundTab.byDirection).toEqual({ inbound: 3, outbound: 2 });
  });

  it("pages newest first and reports the full total", async () => {
    const w = await workspace();
    for (let i = 0; i < 25; i++)
      await inbound(w, { createdAt: hoursAgo(i + 1), summary: `call ${i}` });
    const first = await listCallsFor(db, w.tenant.userId, input({ page: 0 }), NOW);
    const last = await listCallsFor(db, w.tenant.userId, input({ page: 2 }), NOW);
    expect(first.total).toBe(25);
    expect(first.rows).toHaveLength(10);
    expect(first.rows[0]?.summary).toBe("call 0");
    expect(last.rows.map((r) => r.summary)).toEqual([
      "call 20",
      "call 21",
      "call 22",
      "call 23",
      "call 24",
    ]);
  });

  it("exports every call that matches, past the page size, only from the caller's workspace", async () => {
    const a = await workspace();
    const b = await workspace();
    for (let i = 0; i < 14; i++) await inbound(a, { createdAt: hoursAgo(i + 1) });
    await inbound(b);
    const exported = await exportCallsFor(
      db,
      a.tenant.userId,
      input({ direction: "inbound" }),
      NOW,
    );
    expect(exported).toHaveLength(14);
    expect(exported.every((r) => r.dialled === a.number.phone)).toBe(true);
  });

  it("finds callback requests regardless of direction", async () => {
    const w = await workspace();
    await inbound(w, { outcome: "Callback" });
    await outbound(w, { outcome: "Callback", durationSeconds: 30 });
    await inbound(w, { outcome: "Interested" });
    expect(
      (await listCallsFor(db, w.tenant.userId, input({ outcome: "Callback" }), NOW)).total,
    ).toBe(2);
  });
});

describe("call transcripts", () => {
  const turns = [
    { idx: 0, user_text: null, agent_text: "Welcome to Sunrise Clinic." },
    { idx: 1, user_text: "I need an appointment", agent_text: "Sure, may I have your name?" },
  ];
  const detail = (w: Workspace, over: Record<string, unknown> = {}) => ({
    id: 555,
    direction: "inbound" as const,
    from_number: "+919811100001",
    to_number: w.number.phone.replace("+", ""),
    turns,
    ...over,
  });

  it("returns the turns of the caller's own call, reading the engine server-side by reference", async () => {
    const w = await workspace();
    const call = await inbound(w, { transcriptRef: "555" });
    engineCall.mockResolvedValue(detail(w));

    const transcript = await getCallTranscriptFor(db, w.tenant.userId, { callId: call.id });
    expect(engineCall).toHaveBeenCalledWith("555");
    expect(transcript).toEqual({
      available: true,
      turns: [
        { index: 0, caller: null, agent: "Welcome to Sunrise Clinic." },
        { index: 1, caller: "I need an appointment", agent: "Sure, may I have your name?" },
      ],
    });
    const json = JSON.stringify(transcript);
    expect(json).not.toMatch(/http|api[_-]?key|bearer|from_number|to_number/i);
  });

  it("never shows another workspace's transcript, and does not even ask the engine", async () => {
    const a = await workspace();
    const b = await workspace();
    const call = await inbound(a, { transcriptRef: "555" });
    await expect(getCallTranscriptFor(db, b.tenant.userId, { callId: call.id })).rejects.toThrow(
      "Call not found.",
    );
    expect(engineCall).not.toHaveBeenCalled();
  });

  it("says a transcript is unavailable when the call has no reference", async () => {
    const w = await workspace();
    const call = await inbound(w);
    expect(await getCallTranscriptFor(db, w.tenant.userId, { callId: call.id })).toEqual({
      available: false,
      turns: [],
    });
    expect(engineCall).not.toHaveBeenCalled();
  });

  it("refuses an engine record that is not the same call (a reference is only a key)", async () => {
    const w = await workspace();
    const call = await inbound(w, { transcriptRef: "555" });
    engineCall.mockResolvedValueOnce(detail(w, { to_number: "+919000000001" }));
    expect((await getCallTranscriptFor(db, w.tenant.userId, { callId: call.id })).available).toBe(
      false,
    );
    engineCall.mockResolvedValueOnce(detail(w, { direction: "outbound" }));
    expect((await getCallTranscriptFor(db, w.tenant.userId, { callId: call.id })).available).toBe(
      false,
    );
  });

  it("matches an outbound call by the number that was dialled", async () => {
    const w = await workspace();
    const call = await outbound(w, { transcriptRef: "556", durationSeconds: 30 });
    engineCall.mockResolvedValue(detail(w, { direction: "outbound", to_number: "+919876500001" }));
    expect((await getCallTranscriptFor(db, w.tenant.userId, { callId: call.id })).available).toBe(
      true,
    );
  });

  it("gives a plain message, and no engine details, when the engine cannot be reached", async () => {
    const w = await workspace();
    const call = await inbound(w, { transcriptRef: "555" });
    engine.call = () => {
      throw new VoiceEngineUnavailableError("Voice engine unreachable: http://10.0.0.5:8000");
    };
    const error = await getCallTranscriptFor(db, w.tenant.userId, { callId: call.id }).catch(
      (e: Error) => e,
    );
    expect((error as Error).message).toBe(
      "The transcript couldn't be loaded right now. Try again in a moment.",
    );
  });
});

describe("workspace overview from real records", () => {
  it("counts the workspace's own campaigns, leads and callback requests, and lists the newest callbacks", async () => {
    const a = await workspace();
    const b = await workspace();
    await inbound(a, {
      outcome: "Callback",
      summary: "Call tomorrow",
      callerNumber: "+919800000001",
      createdAt: hoursAgo(1),
    });
    await outbound(a, { outcome: "Callback", durationSeconds: 20, createdAt: hoursAgo(3) });
    await inbound(a, { outcome: "Interested" });
    await inbound(b, { outcome: "Callback" });

    const overview = await getWorkspaceOverviewFor(db, a.tenant.userId, "30d");
    expect(overview.totals).toEqual({ activeCampaigns: 1, leads: 1, callbackRequests: 2 });
    expect(overview.callbacks).toHaveLength(2);
    expect(overview.callbacks[0]).toMatchObject({
      contact: "+919800000001",
      direction: "inbound",
      summary: "Call tomorrow",
    });
    expect(overview.callbacks[1]).toMatchObject({
      contact: "+919876500001",
      direction: "outbound",
    });
  });

  it("reports campaign performance from the campaign's own leads and calls", async () => {
    const w = await workspace();
    await outbound(w, { outcome: "Interested", durationSeconds: 40 });
    await outbound(w, { outcome: "Not picked up" });
    const other = await workspace();
    await outbound(other, { outcome: "Interested", durationSeconds: 40 });

    const overview = await getWorkspaceOverviewFor(db, w.tenant.userId, "30d");
    expect(overview.campaignPerformance).toEqual([
      { id: w.campaign.id, name: "October follow-ups", leads: 1, calls: 2, interested: 1 },
    ]);
  });

  it("is empty, not an error, for a workspace with no records", async () => {
    const overview = await getWorkspaceOverviewFor(db, randomUUID(), "7d");
    expect(overview).toMatchObject({
      client: null,
      totals: { activeCampaigns: 0, leads: 0, callbackRequests: 0 },
      callbacks: [],
      campaignPerformance: [],
    });
  });
});
