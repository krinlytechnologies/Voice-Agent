import { describe, expect, it } from "vitest";
import { defaultOutcomeRules, fallbackDefinition, moveOutcomeRule, validateOutcomeRules, validateThreshold } from "./call-outcome-rules";

describe("outcome rule drafts", () => {
  it("starts with six enabled built-ins and a separate fallback", () => {
    const rules = defaultOutcomeRules();
    expect(rules).toHaveLength(6);
    expect(rules.every(r => r.enabled && r.builtIn)).toBe(true);
    expect(validateOutcomeRules(rules, fallbackDefinition)).toBeUndefined();
  });
  it("moves rules without changing the source or moving beyond the list", () => {
    const rules = defaultOutcomeRules();
    const moved = moveOutcomeRule(rules, "meeting-booked", -1);
    expect(moved[0]?.id).toBe("meeting-booked");
    expect(rules[0]?.id).toBe("no-requirement");
    expect(moveOutcomeRule(rules, "no-requirement", -1)).toBe(rules);
    expect(moveOutcomeRule(rules, "interested", 1)).toBe(rules);
  });
  it("rejects duplicates, reserved names, and empty definitions", () => {
    const custom = { id: "custom", name: "Interested", definition: "Clear signal", enabled: true, builtIn: false };
    expect(validateOutcomeRules([...defaultOutcomeRules(), custom], fallbackDefinition)).toBeDefined();
    expect(validateOutcomeRules([{ ...custom, name: "Inconclusive" }], fallbackDefinition)).toBeDefined();
    expect(validateOutcomeRules([{ ...custom, name: "Unique", definition: " " }], fallbackDefinition)).toBeDefined();
  });
  it("allows ten custom rules, but not eleven", () => {
    const custom = Array.from({ length: 11 }, (_, i) => ({ id: `c${i}`, name: `Custom ${i}`, definition: "Specific matching condition", enabled: true, builtIn: false }));
    expect(validateOutcomeRules(custom.slice(0, 10), fallbackDefinition)).toBeUndefined();
    expect(validateOutcomeRules(custom, fallbackDefinition)).toBeDefined();
  });
  it("accepts the 15-second default and rejects invalid thresholds", () => {
    expect(validateThreshold("15")).toBeUndefined();
    expect(validateThreshold("1")).toBeUndefined();
    expect(validateThreshold("300")).toBeUndefined();
    for (const value of ["", "0", "301", "1.5", "no"]) expect(validateThreshold(value)).toBeDefined();
  });
});