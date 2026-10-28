import { createMiddleware } from "@tanstack/react-start";
import { getCookie } from "@tanstack/react-start/server";

import { db } from "@/lib/db.server";
import { resolveSession, SESSION_COOKIE } from "@/lib/sessions";

export class UnauthorizedError extends Error {}

/** Requires a valid session cookie. Context gets the caller's user id for tenant lookups. */
export const requireAuth = createMiddleware({ type: "function" }).server(async ({ next }) => {
  const token = getCookie(SESSION_COOKIE);
  const user = token ? await resolveSession(db, token) : null;
  if (!user) throw new UnauthorizedError("Sign in required.");
  return next({ context: { userId: user.id, email: user.email, fullName: user.fullName } });
});
