import { Prisma } from "@prisma/client";

/** True when `error` is a unique-constraint violation, optionally on a specific constraint field. */
export function isUniqueViolation(error: unknown, field?: string): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002")
    return false;
  if (!field) return true;
  const target = error.meta?.["target"];
  return Array.isArray(target) ? target.includes(field) : String(target ?? "").includes(field);
}
