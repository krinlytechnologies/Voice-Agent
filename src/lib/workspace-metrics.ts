// Pure aggregation over real `calls` rows (client_id, outcome, duration_seconds,
// created_at) — no fabricated numbers. Kept framework-free so it is unit-testable
// without a Supabase connection; the server function in src/server/workspace.functions.ts
// is the only caller that touches the network.
export type CallRow = { outcome: string; duration_seconds: number; created_at: string };
export type Range = "today" | "7d" | "30d";

export interface CallSummary {
  made: number;
  connected: number;
  interested: number;
}

export function summarizeCalls(rows: CallRow[]): CallSummary {
  const connected = rows.filter((r) => r.duration_seconds > 0);
  const interested = rows.filter((r) => r.outcome.trim().toLowerCase() === "interested");
  return { made: rows.length, connected: connected.length, interested: interested.length };
}

export function rangeStart(range: Range, now = new Date()): Date {
  const start = new Date(now);
  if (range === "today") {
    start.setHours(0, 0, 0, 0);
  } else if (range === "7d") {
    start.setDate(start.getDate() - 6);
    start.setHours(0, 0, 0, 0);
  } else {
    start.setDate(start.getDate() - 29);
    start.setHours(0, 0, 0, 0);
  }
  return start;
}

/** Buckets real call timestamps into hour-of-day (today) or day (7d/30d) counts. */
export function bucketCalls(
  rows: CallRow[],
  range: Range,
  now = new Date(),
): { label: string; count: number }[] {
  if (range === "today") {
    const buckets = Array.from({ length: 24 }, () => 0);
    for (const row of rows) buckets[new Date(row.created_at).getHours()]!++;
    return buckets.map((count, hour) => ({ label: String(hour), count }));
  }
  const days = range === "7d" ? 7 : 30;
  const start = rangeStart(range, now);
  const buckets = Array.from({ length: days }, () => 0);
  for (const row of rows) {
    const day = Math.floor((new Date(row.created_at).getTime() - start.getTime()) / 86_400_000);
    if (day >= 0 && day < days) buckets[day]!++;
  }
  return buckets.map((count, i) => {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    return { label: d.toLocaleDateString("en-IN", { month: "short", day: "numeric" }), count };
  });
}
