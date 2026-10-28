import { describe, expect, it } from "vitest";
import { newPromptContent, personaKeyFromName, promptLanguages, validatePersonaKey, validatePrompt } from "./prompts";
describe("prompt persona rules", () => {
  it("offers only the languages the voice engine can speak", () => {
    expect(promptLanguages).toEqual(["English", "Tamil", "Hindi", "Telugu"]);
    expect(promptLanguages).toContain(newPromptContent().language);
    for (const language of newPromptContent().languages) expect(promptLanguages).toContain(language);
  });
  it("generates a lowercase hyphenated key from the display name", () => {
    expect(personaKeyFromName("  Customer Support / Follow Up  ")).toBe("customer-support-follow-up");
  });
  it("limits persona keys to 2–40 lowercase letters, numbers, and hyphens", () => {
    expect(validatePersonaKey("a", [])).toBeDefined();
    expect(validatePersonaKey("a".repeat(41), [])).toBeDefined();
    expect(validatePersonaKey("Support Key", [])).toBeDefined();
    expect(validatePersonaKey("support-2", [])).toBeUndefined();
    expect(validatePersonaKey("a".repeat(40), [])).toBeUndefined();
  });
  it("rejects a duplicate persona key", () => {
    expect(validatePersonaKey("support", ["support"])).toBeDefined();
    expect(validatePersonaKey("support-2", ["support"])).toBeUndefined();
  });
  it("rejects a voicemail check window shorter than its listening time", () => {
    const content = newPromptContent("Voicemail check");
    expect(validatePrompt({ ...content, listen: 8, stop: 3 })).toBeDefined();
    expect(validatePrompt(content)).toBeUndefined();
  });
  it("requires instructions and a greeting", () => {
    const content = newPromptContent("Needs text");
    expect(validatePrompt({ ...content, greeting: " " })).toBeDefined();
    expect(validatePrompt({ ...content, instructions: "" })).toBeDefined();
  });
});
