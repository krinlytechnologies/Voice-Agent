import { normalizedOutcomes } from "./outcomes";

/** One call as the pages show it (campaign and inbound calls alike). */
export interface CallRecordView {
  id: string;
  direction: "inbound" | "outbound";
  /** The other party: the caller for an inbound call, the person dialled for an outbound one. */
  contact: string;
  name: string;
  campaign: string | null;
  /** Our number that was dialled (inbound only). */
  dialled: string | null;
  outcome: string;
  outcomeRaw: string | null;
  status: string;
  duration: number;
  date: string;
  summary: string;
  /** What the agent collected, as text for display. */
  collectedFields: { key: string; value: string }[];
  transcriptAvailable: boolean;
}

export interface CallStats {
  total: number;
  connected: number;
  rate: number;
  average: number;
  interested: number;
}

export const callOutcomes = [...normalizedOutcomes];
export const PAGE_SIZE = 10;
export type DateRange = "All" | "Today" | "7" | "30";
export type DurationBucket = "All" | "Short" | "Medium" | "Long";

const IST_OFFSET_MS = 330 * 60_000;

/** Start of the chosen window at midnight India time, or null for all time. */
export function rangeStart(range: DateRange, now = new Date()): Date | null {
  if (range === "All") return null;
  const ist = new Date(now.getTime() + IST_OFFSET_MS);
  const midnight =
    Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate()) - IST_OFFSET_MS;
  const days = range === "7" ? 6 : range === "30" ? 29 : 0;
  return new Date(midnight - days * 86_400_000);
}

/** Talk-time limits in seconds for each duration filter: short under 30, medium 30-60, long over 60. */
export function durationBounds(bucket: DurationBucket): {
  gte?: number;
  gt?: number;
  lt?: number;
  lte?: number;
} {
  if (bucket === "Short") return { lt: 30 };
  if (bucket === "Medium") return { gte: 30, lte: 60 };
  if (bucket === "Long") return { gt: 60 };
  return {};
}

export function summarizeStats(
  total: number,
  connected: number,
  averageSeconds: number | null,
  interested: number,
): CallStats {
  return {
    total,
    connected,
    rate: total ? Math.round((connected / total) * 100) : 0,
    average: Math.round(averageSeconds ?? 0),
    interested,
  };
}

export function formatDuration(seconds: number) {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

export function formatCallDate(date: string) {
  return new Intl.DateTimeFormat("en-IN", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "Asia/Kolkata",
  }).format(new Date(date));
}
