import { describe, expect, it } from "vitest";
import type { Lead } from "./campaigns";
import { filterVoiceLeads, outcomeBreakdown, pendingVoiceLeads } from "./voice-leads";

const lead = (over: Partial<Lead>): Lead => ({
  id: "l",
  name: "—",
  phone: "+919876500000",
  outcome: "Not called",
  endedBy: "—",
  queue: "Queued",
  lastCall: "—",
  attempts: 0,
  followUp: "—",
  ...over,
});

const rows: Lead[] = [
  lead({
    id: "a",
    phone: "+919171803361",
    outcome: "Not picked up",
    queue: "Exhausted",
    attempts: 3,
  }),
  lead({ id: "b", phone: "+919876500101" }),
  lead({
    id: "c",
    phone: "+919876500102",
    outcome: "Voicemail",
    queue: "Retry scheduled",
    attempts: 1,
  }),
  lead({
    id: "d",
    phone: "+919876500103",
    outcome: "Callback",
    queue: "Callback scheduled",
    attempts: 2,
  }),
  lead({ id: "e", phone: "+919876500104", outcome: "Interested", queue: "Done", attempts: 1 }),
  lead({
    id: "f",
    phone: "+919876500105",
    outcome: "Call failed",
    queue: "Exhausted",
    attempts: 3,
  }),
];

describe("voice lead helpers", () => {
  it("places retries and callbacks before untouched leads", () => {
    expect(pendingVoiceLeads(rows).map((l) => l.id)).toEqual(["c", "d", "b"]);
  });

  it("combines number search, outcome and queue filters", () => {
    expect(
      filterVoiceLeads(rows, "919171803361", "Not picked up", "Exhausted").map((l) => l.id),
    ).toEqual(["a"]);
    expect(filterVoiceLeads(rows, "919171803361", "Interested", "All")).toHaveLength(0);
    expect(filterVoiceLeads(rows, "", "All", "Pending").map((l) => l.id)).toEqual(["b", "c", "d"]);
  });

  it("counts how leads ended, keeping unknown labels visible", () => {
    const breakdown = outcomeBreakdown([...rows, lead({ id: "g", outcome: "Some new label" })]);
    expect(breakdown.find((o) => o.name === "Interested")?.value).toBe(1);
    expect(breakdown.find((o) => o.name === "Not called")?.value).toBe(1);
    expect(breakdown.at(-1)).toEqual({ name: "Some new label", value: 1 });
    expect(breakdown.reduce((n, o) => n + o.value, 0)).toBe(7);
  });
});
