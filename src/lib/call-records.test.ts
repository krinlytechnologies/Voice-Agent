import { describe, expect, it } from "vitest";
import { durationBounds, formatDuration, rangeStart, summarizeStats } from "./call-records";

describe("call record helpers", () => {
  it("measures date windows from midnight India time", () => {
    const now = new Date("2026-10-14T06:00:00Z"); // 11:30 on 14 October in India
    expect(rangeStart("All", now)).toBeNull();
    expect(rangeStart("Today", now)?.toISOString()).toBe("2026-10-13T18:30:00.000Z");
    expect(rangeStart("7", now)?.toISOString()).toBe("2026-10-07T18:30:00.000Z");
    expect(rangeStart("30", now)?.toISOString()).toBe("2026-09-14T18:30:00.000Z");
  });

  it("starts a new Indian day at 18:30 UTC", () => {
    expect(rangeStart("Today", new Date("2026-10-13T18:29:59Z"))?.toISOString()).toBe(
      "2026-10-12T18:30:00.000Z",
    );
    expect(rangeStart("Today", new Date("2026-10-13T18:30:00Z"))?.toISOString()).toBe(
      "2026-10-13T18:30:00.000Z",
    );
  });

  it("separates the duration buckets without gaps or overlaps", () => {
    expect(durationBounds("Short")).toEqual({ lt: 30 });
    expect(durationBounds("Medium")).toEqual({ gte: 30, lte: 60 });
    expect(durationBounds("Long")).toEqual({ gt: 60 });
    expect(durationBounds("All")).toEqual({});
  });

  it("summarises from counts, and copes with no calls", () => {
    expect(summarizeStats(32, 24, 76.4, 4)).toEqual({
      total: 32,
      connected: 24,
      rate: 75,
      average: 76,
      interested: 4,
    });
    expect(summarizeStats(0, 0, null, 0)).toEqual({
      total: 0,
      connected: 0,
      rate: 0,
      average: 0,
      interested: 0,
    });
    expect(formatDuration(90)).toBe("1:30");
  });
});
