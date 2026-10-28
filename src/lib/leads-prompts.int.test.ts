import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { db } from "@/lib/db.server";
import { createTenant, deleteTenants, type Tenant } from "@/test/tenant-fixtures";
import { createCampaignFor } from "./campaigns.functions";
import { importLeadsFor, listLeadsFor } from "./leads.functions";
import { deletePromptFor, listPromptsFor, savePromptVersionFor } from "./prompts.functions";
import { newPromptContent } from "./prompts";

const tenants: Tenant[] = [];
afterAll(() => deleteTenants(db, tenants));

async function newTenant() {
  const tenant = await createTenant(db);
  tenants.push(tenant);
  return tenant;
}

const campaignInput = {
  name: "Leads campaign",
  purpose: "Sales",
  callingStart: "09:00",
  callingEnd: "18:00",
  maxTries: 3,
  retryGapMinutes: 30,
  callbackWindowDays: 3,
  personaKey: "october-14",
  voice: "Voice 8",
  ambience: false,
  creditCap: null,
};

const personaKey = () => `persona-${randomUUID().slice(0, 8)}`;

describe("leads: idempotent import and tenant isolation", () => {
  it("imports contacts once; re-importing the same contacts creates no duplicates", async () => {
    const a = await newTenant();
    const campaign = await createCampaignFor(db, a.userId, campaignInput);
    const rows = [
      { name: "Asha", phone: "+919876500001" },
      { name: "Ravi", phone: "+919876500002" },
    ];

    expect(await importLeadsFor(db, a.userId, { campaignId: campaign.id, rows })).toEqual({
      imported: 2,
      submitted: 2,
    });
    expect(await importLeadsFor(db, a.userId, { campaignId: campaign.id, rows })).toEqual({
      imported: 0,
      submitted: 2,
    });

    const listed = await listLeadsFor(db, a.userId, campaign.id);
    expect(listed.leads).toHaveLength(2);
  });

  it("refuses to import into another tenant's campaign", async () => {
    const a = await newTenant();
    const b = await newTenant();
    const campaign = await createCampaignFor(db, a.userId, campaignInput);

    await expect(
      importLeadsFor(db, b.userId, {
        campaignId: campaign.id,
        rows: [{ name: "X", phone: "+919876500009" }],
      }),
    ).rejects.toThrow("Campaign not found.");
    expect(await db.lead.count({ where: { campaignId: campaign.id } })).toBe(0);
  });

  it("returns none of another tenant's leads for a campaign id it does not own", async () => {
    const a = await newTenant();
    const b = await newTenant();
    const campaign = await createCampaignFor(db, a.userId, campaignInput);
    await importLeadsFor(db, a.userId, {
      campaignId: campaign.id,
      rows: [{ name: "Asha", phone: "+919876500001" }],
    });

    const seenByB = await listLeadsFor(db, b.userId, campaign.id);
    expect(seenByB.leads).toEqual([]);
  });
});

describe("prompts: versioned persistence and tenant isolation", () => {
  it("creates version 1 and appends a snapshot on each edit", async () => {
    const a = await newTenant();
    const key = personaKey();
    const created = await savePromptVersionFor(db, a.userId, {
      promptId: null,
      content: { ...newPromptContent("Versioned persona"), personaKey: key },
    });
    expect(created.version).toBe(1);

    const edited = await savePromptVersionFor(db, a.userId, {
      promptId: created.promptId,
      content: {
        ...newPromptContent("Versioned persona"),
        personaKey: key,
        instructions: "Updated.",
      },
    });
    expect(edited.version).toBe(2);

    const versions = await db.promptVersion.findMany({
      where: { promptId: created.promptId },
      orderBy: { version: "asc" },
    });
    expect(versions.map((v) => v.version)).toEqual([1, 2]);
    expect((versions[1]!.content as { instructions: string }).instructions).toBe("Updated.");
    const prompt = await db.prompt.findUniqueOrThrow({ where: { id: created.promptId } });
    expect(prompt.currentVersion).toBe(2);
  });

  it("rejects a persona key already used in the same workspace", async () => {
    const a = await newTenant();
    const key = personaKey();
    await savePromptVersionFor(db, a.userId, {
      promptId: null,
      content: { ...newPromptContent("First"), personaKey: key },
    });
    await expect(
      savePromptVersionFor(db, a.userId, {
        promptId: null,
        content: { ...newPromptContent("Second"), personaKey: key },
      }),
    ).rejects.toThrow(/already in use/);
  });

  it("allows the same persona key in a different workspace", async () => {
    const a = await newTenant();
    const b = await newTenant();
    const key = personaKey();
    await savePromptVersionFor(db, a.userId, {
      promptId: null,
      content: { ...newPromptContent("Persona A"), personaKey: key },
    });
    const inB = await savePromptVersionFor(db, b.userId, {
      promptId: null,
      content: { ...newPromptContent("Persona B"), personaKey: key },
    });
    expect(inB.version).toBe(1);
  });

  it("refuses to edit another tenant's prompt", async () => {
    const a = await newTenant();
    const b = await newTenant();
    const created = await savePromptVersionFor(db, a.userId, {
      promptId: null,
      content: { ...newPromptContent("Owned by A"), personaKey: personaKey() },
    });
    await expect(
      savePromptVersionFor(db, b.userId, {
        promptId: created.promptId,
        content: newPromptContent("Hijack"),
      }),
    ).rejects.toThrow("Prompt not found.");
    expect(await db.promptVersion.count({ where: { promptId: created.promptId } })).toBe(1);
  });

  it("lists only the caller's prompts", async () => {
    const a = await newTenant();
    const b = await newTenant();
    await savePromptVersionFor(db, a.userId, {
      promptId: null,
      content: { ...newPromptContent("A only"), personaKey: personaKey() },
    });
    expect((await listPromptsFor(db, a.userId)).prompts).toHaveLength(1);
    expect((await listPromptsFor(db, b.userId)).prompts).toEqual([]);
  });

  it("lists each persona with its latest content and its revisions, newest first", async () => {
    const a = await newTenant();
    const key = personaKey();
    const created = await savePromptVersionFor(db, a.userId, {
      promptId: null,
      content: { ...newPromptContent("History persona"), personaKey: key, silenceWait: 7 },
    });
    await savePromptVersionFor(db, a.userId, {
      promptId: created.promptId,
      content: {
        ...newPromptContent("History persona"),
        personaKey: key,
        silenceWait: 7,
        greeting: "Second greeting.",
        recognition: "kept with the revision",
      },
    });

    const [prompt] = (await listPromptsFor(db, a.userId)).prompts;
    expect(prompt?.id).toBe(created.promptId);
    expect(prompt?.content).toMatchObject({
      personaKey: key,
      greeting: "Second greeting.",
      recognition: "kept with the revision",
      silenceWait: 7,
    });
    expect(prompt?.versions.map((v) => v.version)).toEqual([2, 1]);
    expect(prompt?.versions[1]?.content.greeting).toBe(newPromptContent().greeting);
  });

  it("deletes a persona, but not while a campaign that is not completed uses it", async () => {
    const a = await newTenant();
    const key = personaKey();
    const created = await savePromptVersionFor(db, a.userId, {
      promptId: null,
      content: { ...newPromptContent("Doomed persona"), personaKey: key },
    });
    const campaign = await createCampaignFor(db, a.userId, { ...campaignInput, personaKey: key });

    await expect(deletePromptFor(db, a.userId, { promptId: created.promptId })).rejects.toThrow(
      /still uses this persona/,
    );
    await db.campaign.update({ where: { id: campaign.id }, data: { status: "Completed" } });
    await deletePromptFor(db, a.userId, { promptId: created.promptId });
    expect(await db.prompt.count({ where: { id: created.promptId } })).toBe(0);
    expect(await db.promptVersion.count({ where: { promptId: created.promptId } })).toBe(0);
  });

  it("refuses to delete another tenant's persona", async () => {
    const a = await newTenant();
    const b = await newTenant();
    const created = await savePromptVersionFor(db, a.userId, {
      promptId: null,
      content: { ...newPromptContent("Owned by A"), personaKey: personaKey() },
    });
    await expect(deletePromptFor(db, b.userId, { promptId: created.promptId })).rejects.toThrow(
      "Prompt not found.",
    );
    expect(await db.prompt.count({ where: { id: created.promptId } })).toBe(1);
  });
});
