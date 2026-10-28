import { useQuery } from "@tanstack/react-query";
import { getSession, signIn, signOut } from "@/lib/auth.functions";
import type { SessionUser } from "@/lib/sessions";

export const SESSION_QUERY_KEY = ["session"] as const;

export type AuthStatus = "loading" | "signed-in" | "signed-out";
export interface AuthState {
  status: AuthStatus;
  user: SessionUser | null;
}

/** Current session from the server (httpOnly cookie). The browser never sees the token. */
export function useAuthSession(): AuthState {
  const query = useQuery({
    queryKey: SESSION_QUERY_KEY,
    queryFn: () => getSession(),
    staleTime: 60_000,
    retry: false,
  });
  if (query.isPending) return { status: "loading", user: null };
  const user = query.data?.user ?? null;
  return user ? { status: "signed-in", user } : { status: "signed-out", user: null };
}

export async function signInWithPassword(email: string, password: string) {
  const result = await signIn({ data: { email, password } });
  return result.ok
    ? { ok: true as const, user: result.user }
    : { ok: false as const, message: result.error };
}

export async function signOutCurrentUser() {
  await signOut();
}
