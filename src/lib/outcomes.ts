// Turns what the voice engine reports into the wording Mona's pages, filters and counts use.
// Deterministic and browser-safe. The engine's original word is always kept next to the label
// (calls.outcome_raw), so a mapping can be corrected later without losing information.

/** Mona's own outcome labels (the campaign outcome list). */
export const normalizedOutcomes = [
  "Interested",
  "Meeting booked",
  "Callback",
  "Info requested",
  "Not interested",
  "Short hangup",
  "Voicemail",
  "Not picked up",
  "Inconclusive",
] as const;

// Labels that already are Mona wording (typed by hand, or written by Mona itself) pass through unchanged.
const MONA_LABELS = [...normalizedOutcomes, "No requirement", "Call failed", "Invalid number"];

// The words the engine's workflows produce (agent/app/prompts.py `OUTCOMES`), plus the ones the engine adds itself.
const ENGINE_OUTCOMES: Record<string, string> = {
  // general
  resolved: "Info requested",
  unresolved: "Inconclusive",
  callback_requested: "Callback",
  no_conversation: "Short hangup",
  // lead_qualification
  qualified: "Interested",
  not_qualified: "Not interested",
  needs_follow_up: "Callback",
  // faq
  answered: "Info requested",
  unanswered: "Inconclusive",
  // appointment
  appointment_requested: "Meeting booked",
  declined: "Not interested",
  // order
  order_placed: "Interested",
  enquiry_answered: "Info requested",
  // added by the engine when the conversation could not be classified
  extraction_failed: "Inconclusive",
};

// How an attempt ended when nobody was reached (Exotel's statuses and the engine's own).
const NOBODY_REACHED = new Set(["no_answer", "busy", "not_connected"]);

/**
 * The Mona label for an engine outcome. Unknown words become "Inconclusive" (or "Call failed" for a failed
 * attempt) rather than failing, and the caller keeps the raw word.
 */
export function normalizeOutcome(
  raw: string | null | undefined,
  options: { failed?: boolean } = {},
): string {
  const fallback = options.failed ? "Call failed" : "Inconclusive";
  const text = raw?.trim();
  if (!text) return fallback;
  const label = MONA_LABELS.find((l) => l.toLowerCase() === text.toLowerCase());
  if (label) return label;
  const key = text.toLowerCase().replace(/[\s-]+/g, "_");
  if (NOBODY_REACHED.has(key)) return "Not picked up";
  return ENGINE_OUTCOMES[key] ?? fallback;
}

/** Callers who asked to be called back: the contents of the Missed Callbacks page. */
export const CALLBACK_OUTCOME = "Callback";
