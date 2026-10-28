export interface OutcomeRule { id: string; name: string; definition: string; enabled: boolean; builtIn: boolean }
export const fallbackDefinition = "Use when a conversation took place but there is no clear decision, request, or next step. A greeting, polite acknowledgement, or question about who is calling is not enough to infer interest. This is the fallback after all enabled rules have been considered.";
export function defaultOutcomeRules(): OutcomeRule[] {
  return [
    ["no-requirement", "No requirement", "The offering does not apply to this contact, the wrong person answered, or the contact already has what they need. Do not use this for someone who understands the offer and actively declines it."],
    ["meeting-booked", "Meeting booked", "The contact explicitly agrees to a meeting, appointment, visit, or demo at a specific time or date. A general willingness to speak again is not a confirmed booking."],
    ["info-requested", "Info requested", "The contact asks for specific details, a document, pricing, or a message to be sent. An agent offering to send information without being asked does not qualify. A confirmed appointment takes priority."],
    ["not-interested", "Not interested", "The contact understands the offer and clearly declines it or asks not to be contacted again. Being busy or asking for a better time is a callback, not a refusal."],
    ["callback", "Callback", "The contact asks to speak later or gives a preferred time to be called again. Use this even if they also sound interested; keep that context in the conversation summary."],
    ["interested", "Interested", "The contact expresses a clear positive response to the offer or shares a relevant need, but has not confirmed a meeting or requested a callback. Do not treat courtesy, a greeting, or permission to continue as interest."],
  ].map(([id, name, definition]) => ({ id: id ?? "", name: name ?? "", definition: definition ?? "", enabled: true, builtIn: true }));
}
export function moveOutcomeRule(rules: OutcomeRule[], id: string, direction: -1 | 1) {
  const index = rules.findIndex(r => r.id === id);
  const target = index + direction;
  if (index < 0 || target < 0 || target >= rules.length) return rules;
  const next = [...rules];
  const from = next[index]; const to = next[target];
  if (!from || !to) return rules;
  next[index] = to; next[target] = from;
  return next;
}
export function validateOutcomeRules(rules: OutcomeRule[], fallback: string): string | undefined {
  if (rules.filter(r => !r.builtIn).length > 10) return "You can add up to 10 custom rules.";
  const names = new Set<string>(["inconclusive", "not picked up", "voicemail", "short hangup"]);
  for (const rule of rules) {
    const name = rule.name.trim().toLowerCase();
    if (name.length < 2 || name.length > 60) return "Each rule needs a name between 2 and 60 characters.";
    if (names.has(name)) return "Give each outcome a unique name.";
    names.add(name);
    if (!rule.definition.trim() || rule.definition.length > 600) return "Each definition needs 1–600 characters.";
  }
  if (!fallback.trim() || fallback.length > 600) return "The fallback definition needs 1–600 characters.";
  return undefined;
}
export function validateThreshold(value: string): string | undefined {
  const n = Number(value);
  return !value.trim() || !Number.isInteger(n) || n < 1 || n > 300 ? "Choose a whole number from 1 to 300 seconds." : undefined;
}