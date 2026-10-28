import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { db } from "@/lib/db.server";
import { hashPassword } from "@/lib/password";
import {
  hashToken,
  INVALID_CREDENTIALS,
  resolveSession,
  revokeSession,
  signInWithPassword,
  TOO_MANY_ATTEMPTS,
} from "@/lib/sessions";

const PASSWORD = "correct-horse-battery";
const emails: string[] = [];

afterAll(async () => {
  await db.user.deleteMany({ where: { email: { in: emails } } });
  await db.loginAttempt.deleteMany({ where: { email: { in: emails } } });
});

async function newUser() {
  const email = `signin-${randomUUID().slice(0, 8)}@example.test`;
  emails.push(email);
  const user = await db.user.create({
    data: { email, fullName: "Sign In Tester", passwordHash: await hashPassword(PASSWORD) },
    select: { id: true, email: true },
  });
  return user;
}

describe("sign-in with a local password", () => {
  it("issues a session for the correct password, with the email normalised", async () => {
    const user = await newUser();
    const result = await signInWithPassword(db, {
      email: `  ${user.email.toUpperCase()} `,
      password: PASSWORD,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.user.id).toBe(user.id);
    expect(await resolveSession(db, result.token)).toEqual({
      id: user.id,
      email: user.email,
      fullName: "Sign In Tester",
    });
  });

  it("stores only a hash of the session token, never the token itself", async () => {
    const user = await newUser();
    const result = await signInWithPassword(db, { email: user.email, password: PASSWORD });
    if (!result.ok) throw new Error("sign-in should succeed");
    const rows = await db.session.findMany({ where: { userId: user.id } });
    expect(rows.map((r) => r.tokenHash)).toEqual([hashToken(result.token)]);
    expect(rows.some((r) => r.tokenHash === result.token)).toBe(false);
  });

  it("gives the same generic error for a wrong password and an unknown email", async () => {
    const user = await newUser();
    const wrongPassword = await signInWithPassword(db, {
      email: user.email,
      password: "wrong-password-value",
    });
    const unknownEmail = await signInWithPassword(db, {
      email: `nobody-${randomUUID()}@example.test`,
      password: PASSWORD,
    });
    expect(wrongPassword).toEqual({ ok: false, error: INVALID_CREDENTIALS });
    expect(unknownEmail).toEqual({ ok: false, error: INVALID_CREDENTIALS });
  });

  it("locks an email after too many failures, even for the correct password", async () => {
    const user = await newUser();
    for (let i = 0; i < 10; i++) {
      await signInWithPassword(db, { email: user.email, password: "wrong-password-value" });
    }
    expect(await signInWithPassword(db, { email: user.email, password: PASSWORD })).toEqual({
      ok: false,
      error: TOO_MANY_ATTEMPTS,
    });
  });

  it("keeps working again once the failure window has passed", async () => {
    const user = await newUser();
    const longAgo = new Date(Date.now() - 16 * 60 * 1000);
    await db.loginAttempt.createMany({
      data: Array.from({ length: 10 }, () => ({
        email: user.email,
        succeeded: false,
        createdAt: longAgo,
      })),
    });
    const result = await signInWithPassword(db, { email: user.email, password: PASSWORD });
    expect(result.ok).toBe(true);
  });

  it("refuses an empty or over-long password without touching the hash", async () => {
    const user = await newUser();
    expect(await signInWithPassword(db, { email: user.email, password: "" })).toEqual({
      ok: false,
      error: INVALID_CREDENTIALS,
    });
    expect(await signInWithPassword(db, { email: user.email, password: "x".repeat(201) })).toEqual({
      ok: false,
      error: INVALID_CREDENTIALS,
    });
  });
});

describe("session lifecycle", () => {
  it("returns no user for an unknown token", async () => {
    expect(await resolveSession(db, randomUUID())).toBeNull();
  });

  it("returns no user after the session is revoked (sign-out)", async () => {
    const user = await newUser();
    const result = await signInWithPassword(db, { email: user.email, password: PASSWORD });
    if (!result.ok) throw new Error("sign-in should succeed");
    await revokeSession(db, result.token);
    expect(await resolveSession(db, result.token)).toBeNull();
  });

  it("rejects and deletes an expired session", async () => {
    const user = await newUser();
    const token = randomUUID();
    await db.session.create({
      data: {
        userId: user.id,
        tokenHash: hashToken(token),
        expiresAt: new Date(Date.now() - 1000),
      },
    });
    expect(await resolveSession(db, token)).toBeNull();
    expect(await db.session.count({ where: { tokenHash: hashToken(token) } })).toBe(0);
  });

  it("removes a user's expired sessions when they sign in again", async () => {
    const user = await newUser();
    await db.session.create({
      data: {
        userId: user.id,
        tokenHash: hashToken("stale"),
        expiresAt: new Date(Date.now() - 60_000),
      },
    });
    await signInWithPassword(db, { email: user.email, password: PASSWORD });
    expect(
      await db.session.count({ where: { userId: user.id, tokenHash: hashToken("stale") } }),
    ).toBe(0);
  });
});
