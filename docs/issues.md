# Issues, Sample Data & Mismatches

Re-verified against the source on 2026-10-26. The previous version of this file (2026-10-24) was written before real
authentication, Supabase persistence and the voice-engine plumbing landed, so most of its critical items are now fixed.
Severity is about product and trust risk if this were shown to a real user as-is, not about code style. Many "sample data"
items are intentional per [AGENTS.md](../AGENTS.md), but they are easy to mistake for live functionality.

## Resolved since the last version

| # | Was | Now |
|---|---|---|
| 1 | Hardcoded `admin` / `admin123` login, bypassable in devtools | Real Supabase email/password sign-in (`src/lib/auth.ts`); `WorkspaceShell` redirects when there is no session |
| 2 | Supabase auth built but unused | Campaigns, leads, prompts and workspace server functions all use `requireSupabaseAuth`; RLS scopes the data |
| 4 | "Book a demo" validated, showed success, stored nothing | `DemoDialog` inserts into `demo_requests` (RLS: anyone can insert, only super admins can read) and shows an error if the insert fails |
| 3 | Service-role client with no caller | Its only caller is the voice-engine webhook route, which imports it dynamically inside the handler as documented |
| 10a | Campaign wizard created an in-memory campaign | `createCampaign` and `importLeads` persist to Supabase |
| 12 | Schema existed but nothing used it | Credits, calling activity, campaigns, leads and demo requests are now read and written |

## Critical

None found in the code. One thing cannot be checked from this repository:

- **Public sign-up may be open.** Supabase auth settings (sign-ups, email confirmation, password rules) live in the hosted
  Supabase project, and `supabase/config.toml` only contains the project id. If sign-ups are enabled, anyone can create an
  account; the `handle_new_user` trigger gives them a profile, and what they can then see depends on the RLS policies and on
  whether a `client_members` row exists. Confirm sign-ups are disabled or invite-only before launch.

## High: sample data presented as live

5. **Overview mixes real and sample numbers. Mostly fixed 2026-10-28.** The credits ring, calling activity, the three tiles
   (active campaigns, leads, callback requests), campaign performance and callback requests now read the workspace's own
   records. **Still sample, and labelled:** best time to call and number health (the engine reports no per-number pick-up
   rates or hourly connection rates yet). — `src/components/dashboard/Overview.tsx`.
6. **~~Two datasets that disagree.~~ Fixed 2026-10-28.** Voice Leads, the Overview and the Campaigns page all read the same
   database records. `sampleCampaigns` remains only as a test/reference fixture in `src/lib/campaigns.ts`.
7. **~~Voice Leads pads its numbers with generated filler rows.~~ Fixed 2026-10-28.** It is now a read-only view of real
   campaigns and leads; the generator was removed.
8. **~~Outbound Calls and Missed Callbacks are generated.~~ Fixed 2026-10-28.** Outbound Calls, a new Inbound Calls page and
   Missed Callbacks (callback requests from inbound calls and campaigns) read persisted calls. Notes typed on these pages
   are still kept on the page only, and the pages say so.
9. **~~Prompts never persist.~~ Fixed 2026-10-27.** The Prompts page now loads and saves through `listPrompts`,
   `savePromptVersion` and `deletePrompt` (a revision per save), and a campaign speaks its persona's latest saved revision
   when started ([ARCHITECTURE.md §8](./ARCHITECTURE.md)).
10. **The campaign wizard's voice choice is not real; its persona choice is.** The persona picker now lists the saved,
    active personas. The voice picker still offers fixed labels ("Voice 8 · Reflective Women · Female") that are not the
    engine's voices and change nothing on a call. — `src/components/dashboard/CampaignWizard.tsx`.
11. **Landing-page testimonials** are attributed to "Sample customer" with real-sounding job titles.
    — `src/routes/index.tsx`.
12. **Call Outcome Rules are never saved** (page state only), so they cannot influence how calls are classified.

## Voice-engine integration

13. **~~Most of the engine contract is not implemented.~~ Fixed 2026-10-27.** The engine now implements dispatch, job
    status/cancel and signed, ordered, retried webhooks (`agent/app/dispatch.py`), and the Campaign page's Start/Pause
    buttons use them (see [ARCHITECTURE.md §8](./ARCHITECTURE.md)). Not yet exercised with a real phone call.
14. **~~The webhook never updates leads.~~ Fixed 2026-10-27.** Events carry `leadId`; `processWebhookEvent` links the call and
    updates `attempts`, `queue_state`, `outcome` and `follow_up_at`, after checking the lead belongs to the job's campaign.
15. **Outcome vocabularies differ.** Mona classifies calls as Interested, Callback, Meeting booked, Info requested, Not
    interested, Voicemail and so on, using editable rules. The engine's outcomes depend on the agent workflow (for example
    `qualified`, `order_placed`) and it is not sent Mona's rules.
16. **Personas are sent by key only.** Dispatch carries `personaKey`, but Mona's personas are not persisted (item 9) and the
    engine has no persona store keyed that way. Mona persona features without an engine equivalent: silence wait and nudges,
    voicemail handling, listen/stop timing, confirmations, confidence, recognition words, WhatsApp follow-up.
17. **Inbound and ad-hoc calls are invisible to Mona.** The webhook ignores events for an unknown `engineJobId`, and the
    engine handles inbound calls with no job.
18. **Credit maths is an unconfirmed assumption.** One engine minute = one credit (`VOICE_ENGINE_CREDITS_PER_MINUTE`). The
    engine's own estimate is roughly ₹2 per connected minute before telephony, so credit pricing needs checking.
19. **Capacity.** The engine runs one concurrent call by default, so a campaign of ~1,200 leads would take many hours.
20. **Marketing claim vs supported languages.** The dashboard now offers English, Tamil, Hindi and Telugu (the engine's
    languages). The landing-page FAQ still says "All major Indian languages plus English, including mixed speech like
    Hinglish and Tanglish" (`src/routes/index.tsx`). That describes the separate ElevenLabs demo agent, not the engine, and
    should be reviewed. Mona's own change here was limited to the dashboard.

## Medium: drift and dead code

21. `src/integrations/supabase/cron-auth.ts` has no caller; it is correct but never exercised by a request path.
22. **Tests do not cover pages.** Server functions, the auth middleware, the voice-engine client/webhook and the pure
    modules are tested. There are no tests for dashboard components, the login page or the ElevenLabs widget.
23. **Branding depends on a third-party host.** `branding.ts` resolves the logo against `monaaivoiceagent.lovable.app`
    even on other domains (a deliberate workaround for hosts without Lovable's asset gateway).

## Low

24. Sample dates are anchored to 2026-10-13/14, close enough to "today" to be mistaken for real activity
    (`call-records.ts`, `campaigns.ts`, `voice-leads.ts`).
25. `roadmap.md` is a flat, fully ticked checklist of UI and sample-data tasks; it is a prompt history, not a plan for
    connecting the backend.

## Summary table

| # | Area | Type | Severity |
|---|---|---|---|
| — | Supabase sign-up settings | Cannot be verified from the repository | Check before launch |
| 5–8 | Overview, Voice Leads, call records | ~~Sample data shown as live~~ Fixed; Overview best-time and number health stay labelled samples | Resolved |
| 9, 12 | Prompts, outcome rules | Edits never saved | High |
| 10 | Campaign wizard / "Active" status | Voice and persona not real; no calling starts | High |
| 11 | Testimonials | Placeholder quotes | High |
| 13 | Engine contract | ~~Dispatch, jobs, webhook events not implemented~~ Fixed; needs a live-call trial | Resolved |
| 14–17 | Webhook, outcomes, personas, inbound | Integration mismatches | High |
| 18–20 | Credits, capacity, language claim | Assumptions to confirm | Medium |
| 21–23 | Dead code, tests, branding | Drift | Medium |
| 24–25 | Dates, roadmap | Consistency | Low |
