import { describe, expect, it } from "vitest";
import { CALLBACK_OUTCOME, normalizeOutcome, normalizedOutcomes } from "./outcomes";

describe("outcome mapping", () => {
  it.each([
    ["resolved", "Info requested"],
    ["unresolved", "Inconclusive"],
    ["callback_requested", "Callback"],
    ["no_conversation", "Short hangup"],
    ["qualified", "Interested"],
    ["not_qualified", "Not interested"],
    ["needs_follow_up", "Callback"],
    ["answered", "Info requested"],
    ["unanswered", "Inconclusive"],
    ["appointment_requested", "Meeting booked"],
    ["declined", "Not interested"],
    ["order_placed", "Interested"],
    ["enquiry_answered", "Info requested"],
    ["extraction_failed", "Inconclusive"],
  ])("maps the engine outcome %s to %s", (raw, label) => {
    expect(normalizeOutcome(raw)).toBe(label);
  });

  it("maps calls where nobody was reached", () => {
    for (const raw of ["no_answer", "busy", "not_connected", "no-answer", "No Answer"]) {
      expect(normalizeOutcome(raw)).toBe("Not picked up");
    }
  });

  it("leaves Mona's own labels as they are, whatever the case", () => {
    expect(normalizeOutcome("Interested")).toBe("Interested");
    expect(normalizeOutcome("meeting booked")).toBe("Meeting booked");
    expect(normalizeOutcome("Call failed")).toBe("Call failed");
    expect(normalizedOutcomes).toContain(normalizeOutcome("voicemail"));
  });

  it("handles unknown, empty and failed outcomes without throwing", () => {
    expect(normalizeOutcome("something_new_from_a_future_engine")).toBe("Inconclusive");
    expect(normalizeOutcome("")).toBe("Inconclusive");
    expect(normalizeOutcome(null)).toBe("Inconclusive");
    expect(normalizeOutcome(undefined, { failed: true })).toBe("Call failed");
    expect(normalizeOutcome("dial_failed", { failed: true })).toBe("Call failed");
    expect(normalizeOutcome("dial_failed")).toBe("Inconclusive");
  });

  it("is deterministic and only ever returns a label Mona's pages know", () => {
    const known = new Set<string>([
      ...normalizedOutcomes,
      "No requirement",
      "Call failed",
      "Invalid number",
    ]);
    for (const raw of [
      "resolved",
      "qualified",
      "x",
      "no_answer",
      "",
      "Callback",
      "weird value ☎",
    ]) {
      const label = normalizeOutcome(raw);
      expect(known.has(label)).toBe(true);
      expect(normalizeOutcome(raw)).toBe(label);
    }
    expect(CALLBACK_OUTCOME).toBe("Callback");
  });
});
