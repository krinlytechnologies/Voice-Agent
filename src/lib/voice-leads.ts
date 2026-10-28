import type { Lead } from "./campaigns";

/** The order outcomes are listed in "How conversations ended". Any other label that appears is added after these. */
export const voiceOutcomes = [
  "Interested",
  "Meeting booked",
  "Callback",
  "Info requested",
  "No requirement",
  "Not picked up",
  "Voicemail",
  "Short hangup",
  "Not interested",
  "Inconclusive",
  "Call failed",
  "Invalid number",
  "Not called",
];

export function isPending(l: Lead) {
  return ["Queued", "Retry scheduled", "Callback scheduled"].includes(l.queue);
}

export function filterVoiceLeads(
  rows: Lead[],
  query: string,
  outcome: string,
  queue: string,
): Lead[] {
  const q = query.trim().toLowerCase();
  return rows.filter(
    (l) =>
      `${l.name} ${l.phone}`.toLowerCase().includes(q) &&
      (outcome === "All" || l.outcome === outcome) &&
      (queue === "All" || (queue === "Pending" && isPending(l)) || l.queue === queue),
  );
}

/** Waiting leads, retries first, then callbacks, then leads not yet called. */
export function pendingVoiceLeads(rows: Lead[]) {
  const priority: Record<string, number> = {
    "Retry scheduled": 0,
    "Callback scheduled": 1,
    Queued: 2,
  };
  return rows.filter(isPending).sort((a, b) => (priority[a.queue] ?? 3) - (priority[b.queue] ?? 3));
}

/** How many leads ended each way, in a stable order, including labels the list above does not know. */
export function outcomeBreakdown(rows: Lead[]): { name: string; value: number }[] {
  const counts = new Map<string, number>();
  for (const lead of rows) counts.set(lead.outcome, (counts.get(lead.outcome) ?? 0) + 1);
  const known = voiceOutcomes.map((name) => ({ name, value: counts.get(name) ?? 0 }));
  const extra = [...counts.keys()].filter((name) => !voiceOutcomes.includes(name)).sort();
  return [...known, ...extra.map((name) => ({ name, value: counts.get(name) ?? 0 }))];
}
