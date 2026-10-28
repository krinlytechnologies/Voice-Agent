import { describe, expect, it } from "vitest";
import { bucketCalls, rangeStart, summarizeCalls } from "./workspace-metrics";

describe("workspace metrics (real calls data aggregation)", () => {
  it("counts made, connected and interested from real rows only", () => {
    const rows = [
      { outcome: "Interested", duration_seconds: 42, created_at: "2026-10-20T10:00:00Z" },
      { outcome: "Not picked up", duration_seconds: 0, created_at: "2026-10-20T10:05:00Z" },
      { outcome: "Voicemail", duration_seconds: 12, created_at: "2026-10-20T10:10:00Z" },
    ];
    expect(summarizeCalls(rows)).toEqual({ made: 3, connected: 2, interested: 1 });
  });

  it("returns zeros for an empty result instead of fabricating numbers", () => {
    expect(summarizeCalls([])).toEqual({ made: 0, connected: 0, interested: 0 });
  });

  it("is case-insensitive when matching the interested outcome", () => {
    expect(
      summarizeCalls([
        { outcome: "interested", duration_seconds: 5, created_at: "2026-10-20T10:00:00Z" },
      ]).interested,
    ).toBe(1);
  });

  it("buckets today's calls by hour", () => {
    const now = new Date("2026-10-20T18:00:00");
    const rows = [
      {
        outcome: "x",
        duration_seconds: 1,
        created_at: new Date("2026-10-20T09:15:00").toISOString(),
      },
      {
        outcome: "x",
        duration_seconds: 1,
        created_at: new Date("2026-10-20T09:45:00").toISOString(),
      },
    ];
    const bars = bucketCalls(rows, "today", now);
    expect(bars).toHaveLength(24);
    expect(bars[9]).toEqual({ label: "9", count: 2 });
  });

  it("buckets 7-day calls by day and excludes rows before the range start", () => {
    const now = new Date("2026-10-20T12:00:00");
    const rows = [
      {
        outcome: "x",
        duration_seconds: 1,
        created_at: new Date("2026-10-20T08:00:00").toISOString(),
      },
      {
        outcome: "x",
        duration_seconds: 1,
        created_at: new Date("2026-09-01T08:00:00").toISOString(),
      },
    ];
    const bars = bucketCalls(rows, "7d", now);
    expect(bars).toHaveLength(7);
    expect(bars.reduce((n, b) => n + b.count, 0)).toBe(1);
  });

  it("anchors range start to midnight of the correct day", () => {
    const now = new Date("2026-10-20T12:00:00");
    expect(rangeStart("today", now).getHours()).toBe(0);
    expect(rangeStart("7d", now).getDate()).toBe(14);
    expect(rangeStart("30d", now).getDate()).toBe(21);
  });
});
