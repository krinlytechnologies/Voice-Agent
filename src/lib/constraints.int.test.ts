import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db.server";
import { isUniqueViolation } from "@/lib/db-errors";
import { createTenant, deleteTenants, type Tenant } from "@/test/tenant-fixtures";
import { demoRequestSchema, submitDemoRequestFor } from "./demo.functions";
import { getWorkspaceCreditsFor, getWorkspaceOverviewFor } from "./workspace.functions";

const tenants: Tenant[] = [];
afterAll(async () => {
  await deleteTenants(db, tenants);
  await db.demoRequest.deleteMany({ where: { name: { startsWith: "Constraint test" } } });
});

async function newTenant(credits = 100) {
  const tenant = await createTenant(db, credits);
  tenants.push(tenant);
  return tenant;
}

async function newCampaign(clientId: string) {
  return db.campaign.create({ data: { clientId, name: "Constraint campaign", purpose: "Sales" } });
}

describe("database constraints (enforced even if application code is bypassed)", () => {
  it("rejects a negative credit balance", async () => {
    const tenant = await newTenant(10);
    await expect(
      db.client.update({ where: { id: tenant.clientId }, data: { creditBalance: -1 } }),
    ).rejects.toThrow(/clients_credit_balance_non_negative|violates check constraint/);
    expect(
      (await db.client.findUniqueOrThrow({ where: { id: tenant.clientId } })).creditBalance,
    ).toBe(10);
  });

  it("rejects an unknown campaign status", async () => {
    const tenant = await newTenant();
    await expect(
      db.campaign.create({
        data: { clientId: tenant.clientId, name: "Bad status", purpose: "Sales", status: "Bogus" },
      }),
    ).rejects.toThrow(/campaigns_status_known/);
  });

  it("rejects a malformed calling time", async () => {
    const tenant = await newTenant();
    await expect(
      db.campaign.create({
        data: {
          clientId: tenant.clientId,
          name: "Bad time",
          purpose: "Sales",
          callingStart: "9am",
        },
      }),
    ).rejects.toThrow(/campaigns_calling_start_format/);
  });

  it("rejects a lead with a malformed phone number", async () => {
    const tenant = await newTenant();
    const campaign = await newCampaign(tenant.clientId);
    await expect(
      db.lead.create({
        data: { clientId: tenant.clientId, campaignId: campaign.id, phone: "call me" },
      }),
    ).rejects.toThrow(/leads_phone_format/);
  });

  it("allows only one non-terminal voice engine job per campaign, and frees the slot once it is terminal", async () => {
    const tenant = await newTenant();
    const campaign = await newCampaign(tenant.clientId);
    const first = await db.voiceEngineJob.create({
      data: { clientId: tenant.clientId, campaignId: campaign.id, status: "dispatched" },
    });

    const duplicate = await db.voiceEngineJob
      .create({
        data: { clientId: tenant.clientId, campaignId: campaign.id, status: "pending" },
      })
      .catch((error: unknown) => error);
    expect(isUniqueViolation(duplicate)).toBe(true);

    await db.voiceEngineJob.update({ where: { id: first.id }, data: { status: "completed" } });
    await expect(
      db.voiceEngineJob.create({
        data: { clientId: tenant.clientId, campaignId: campaign.id, status: "pending" },
      }),
    ).resolves.toBeDefined();
  });

  it("rejects a duplicate phone number within one campaign", async () => {
    const tenant = await newTenant();
    const campaign = await newCampaign(tenant.clientId);
    await db.lead.create({
      data: { clientId: tenant.clientId, campaignId: campaign.id, phone: "+919876500050" },
    });
    const duplicate = await db.lead
      .create({
        data: { clientId: tenant.clientId, campaignId: campaign.id, phone: "+919876500050" },
      })
      .catch((error: unknown) => error);
    expect(isUniqueViolation(duplicate)).toBe(true);
  });
});

describe("workspace reads", () => {
  it("returns no credits or calls for a user with no workspace", async () => {
    const stranger = randomUUID();
    expect(await getWorkspaceCreditsFor(db, stranger)).toEqual({ client: null });
    const overview = await getWorkspaceOverviewFor(db, stranger, "30d");
    expect(overview.client).toBeNull();
    expect(overview.calls.made).toBe(0);
  });

  it("reads the authoritative credit balance and counts only the caller's calls", async () => {
    const a = await newTenant(123);
    const b = await newTenant(5);
    const campaign = await newCampaign(a.clientId);
    await db.call.createMany({
      data: [
        {
          clientId: a.clientId,
          campaignId: campaign.id,
          outcome: "Interested",
          durationSeconds: 30,
        },
        { clientId: a.clientId, outcome: "Voicemail", durationSeconds: 0 },
        { clientId: b.clientId, outcome: "Interested", durationSeconds: 99 },
      ],
    });

    const credits = await getWorkspaceCreditsFor(db, a.userId);
    expect(credits.client?.creditBalance).toBe(123);

    const overview = await getWorkspaceOverviewFor(db, a.userId, "30d");
    expect(overview.calls).toEqual({ made: 2, connected: 1, interested: 1 });
  });
});

describe("public demo requests", () => {
  it("stores a valid request", async () => {
    const created = await submitDemoRequestFor(db, {
      name: "Constraint test Priya",
      email: "priya@example.test",
      phone: "+91 98765 43210",
      company: "",
      message: "",
    });
    expect(created.ok).toBe(true);
    expect(await db.demoRequest.count({ where: { id: created.id } })).toBe(1);
  });

  it("rejects an invalid request at the schema boundary", () => {
    expect(() =>
      demoRequestSchema.parse({
        name: "Constraint test X",
        email: "not-an-email",
        phone: "+919876543210",
      }),
    ).toThrow();
    expect(() =>
      demoRequestSchema.parse({ name: "Constraint test Y", email: "a@b.co", phone: "abc" }),
    ).toThrow();
  });

  it("refuses an over-long message even if validation were bypassed", async () => {
    await expect(
      db.demoRequest.create({
        data: {
          name: "Constraint test Z",
          email: "z@example.test",
          phone: "+919876543210",
          message: "x".repeat(601),
        },
      }),
    ).rejects.toBeInstanceOf(Prisma.PrismaClientKnownRequestError);
  });
});
