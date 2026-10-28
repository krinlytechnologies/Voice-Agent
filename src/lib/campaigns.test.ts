import { describe, expect, it } from "vitest";
import { contactTemplate, defaultCallingRules, filterCampaigns, inspectLeadCsv, parseLeadCsv, sampleCampaigns } from "./campaigns";

describe("campaign workspace", () => {
  it("filters paused campaigns by name", () => { expect(filterCampaigns(sampleCampaigns, "visitors", "Paused", "newest").map(c => c.id)).toEqual(["visitors"]); expect(filterCampaigns(sampleCampaigns, "visitors", "Active", "newest")).toHaveLength(0); });
  it("sorts campaigns by creation date", () => { expect(filterCampaigns(sampleCampaigns, "", "All", "oldest")[0]?.id).toBe("tnepl2"); });
  it("uses three maximum calling attempts", () => { expect(defaultCallingRules.maxTries).toBe(3); });
  it("uses a thirty minute retry gap", () => { expect(defaultCallingRules.retryGap).toBe(30); });
  it("uses a three day callback window", () => { expect(defaultCallingRules.callbackWindow).toBe(3); });
  it("retains the 9am to 6pm calling window", () => { expect([defaultCallingRules.start, defaultCallingRules.end]).toEqual(["09:00", "18:00"]); });
  it("imports valid lead rows and rejects invalid numbers", () => { const rows = parseLeadCsv("name,phone\nAsha,+919876543210\nInvalid,abc"); expect(rows).toHaveLength(1); expect(rows[0]?.queue).toBe("Queued"); expect(rows[0]?.attempts).toBe(0); });
  it("provides name and number columns in the sample sheet", () => { expect(contactTemplate[0]).toEqual(["name", "number"]); });
  it("imports the sample sheet name and number columns", () => { const rows = parseLeadCsv("name,number\nSample contact,+919876500001"); expect(rows.map(l => [l.name, l.phone])).toEqual([["Sample contact", "+919876500001"]]); });
  it("handles quoted names and reports invalid or duplicate contacts", () => { const result = inspectLeadCsv('name,number\n"Asha, R",+919876543210\nBad,abc\nDuplicate,+919876543210'); expect(result.rows[0]?.name).toBe("Asha, R"); expect(result.errors.map(e => [e.row, e.reason])).toEqual([[3, "Invalid number"], [4, "Duplicate number"]]); });
});