import { describe, expect, it } from "vitest";
import { newCampaignDraft, validateCampaignDraft } from "./campaign-setup";
import { parseLeadCsv } from "./campaigns";

const valid = () => ({ ...newCampaignDraft(), name: "October outreach", purpose: "Sales", rows: parseLeadCsv("name,number\nAsha,+919876543210") });
describe("campaign setup", () => {
  it("requires a service", () => { expect(validateCampaignDraft({ ...valid(), purpose: "" }, 0)).toBe("Choose a service."); });
  it("requires valid uploaded contacts", () => { expect(validateCampaignDraft({ ...valid(), rows: [] }, 1)).toBe("Upload at least one valid contact before continuing."); });
  it("rejects a calling window ending before it starts", () => { const d = valid(); d.rules.end = "08:00"; expect(validateCampaignDraft(d, 0)).toBe("Calling hours must end after they start."); });
  it("requires a future scheduled start", () => { const d = valid(); d.setup.startMode = "scheduled"; d.setup.scheduledAt = "2026-10-13T10:00"; expect(validateCampaignDraft(d, 0, new Date("2026-10-14T18:00:00Z"))).toBe("Choose a future start date and time."); });
  it("rejects retry hours outside the calling window", () => { const d = valid(); d.setup.retryMode = "scheduled"; d.setup.retryStart = "08:00"; expect(validateCampaignDraft(d, 0)).toBe("Keep the retry window within calling hours, with an end after its start."); });
  it("rejects nonpositive caps", () => { const d = valid(); d.setup.creditCap = 0; expect(validateCampaignDraft(d, 0)).toBe("Enter a positive credit cap, or leave it empty for no cap."); });
});