// @vitest-environment node
import { describe, expect, it } from "vitest";
import { hashPassword, isAcceptablePasswordInput, verifyPassword } from "./password";

describe("password hashing", { timeout: 30_000 }, () => {
  it("verifies the original password and rejects others", async () => {
    const stored = await hashPassword("correct-horse-battery");
    expect(await verifyPassword("correct-horse-battery", stored)).toBe(true);
    expect(await verifyPassword("correct-horse-batterY", stored)).toBe(false);
    expect(await verifyPassword("", stored)).toBe(false);
  });

  it("never stores the plain password and salts every hash", async () => {
    const first = await hashPassword("same-password-here");
    const second = await hashPassword("same-password-here");
    expect(first).not.toContain("same-password-here");
    expect(first).not.toBe(second);
  });

  it("stores its own parameters so they can be raised later", async () => {
    const stored = await hashPassword("parameter-check-pass");
    expect(stored.split("$")).toHaveLength(6);
    expect(stored.startsWith("scrypt$32768$8$1$")).toBe(true);
  });

  it("rejects malformed stored values without throwing", async () => {
    expect(await verifyPassword("anything", "")).toBe(false);
    expect(await verifyPassword("anything", "bcrypt$10$abc")).toBe(false);
    expect(await verifyPassword("anything", "scrypt$x$8$1$AAAA$AAAA")).toBe(false);
  });

  it("treats Unicode-equivalent passwords as the same password", async () => {
    const composed = await hashPassword("café-password-1");
    expect(await verifyPassword("café-password-1", composed)).toBe(true);
  });
});

describe("password input bounds", () => {
  it("accepts non-empty input up to 200 characters", () => {
    expect(isAcceptablePasswordInput("x")).toBe(true);
    expect(isAcceptablePasswordInput("x".repeat(200))).toBe(true);
    expect(isAcceptablePasswordInput("")).toBe(false);
    expect(isAcceptablePasswordInput("x".repeat(201))).toBe(false);
  });
});
