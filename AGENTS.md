<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Workspace pages share WorkspaceShell so navigation and the existing temporary sign-in gate stay consistent.
- Campaign interactions use in-memory sample state until real calling services are requested; never imply demo status changes place live calls.
- Keep campaign models, sample data and import/export helpers in a browser-safe module so presentation components share one source of truth.
- Use a dedicated campaign wizard with browser-safe draft validation; keep its scheduling and retry configuration on the campaign so detail views read the saved selections.
- Parse contact CSV files with Papa Parse and expose valid rows and row-level errors; use the shared template data for both preview and download to prevent mismatched columns.
- Voice Leads is a read-only view of the workspace's real campaigns and leads (shared campaign models and adapters); campaigns are managed on the Campaigns page, and outcome/queue totals derive from the loaded lead records.
- Prompts saves personas and their revisions to the database; a campaign sends a copy of its persona's latest saved revision to the voice engine when it is started, so saving, restoring or deleting a persona never changes a campaign or call already running.
- Inbound numbers are drafts until published: saving a number, a prompt or a revision never changes a live call, only Publish does, and a failed publish leaves the last confirmed version live. The engine is the only source of truth for routing at call time; never add a lookup to the dashboard to the call path.
- Persona creation uses a dedicated dialog and shared browser-safe key generation and validation; its selections populate the existing editor and are saved as revision 1.
- Inbound Calls, Outbound Calls and Missed Callbacks show persisted `calls` rows through tenant-scoped server functions (calls.functions.ts); filters, paging, summaries and exports all come from the same server-side filter. Notes are page-local and must say so. Engine outcomes are normalized by src/lib/outcomes.ts with the original kept in `outcome_raw`; the workspace of an inbound call is decided only by Mona's inbound-number mapping, never by a field in the webhook. Transcripts are read server-side per call after a workspace check, and no engine address, key or link ever reaches the browser. Reporting adds no billing.
- Call Outcome Rules uses a browser-safe draft model for validation and ordering with a fixed fallback; page-local saving must not alter live agents, campaign retries or historical call records.
- Resolve the official logo asset pointer through the shared browser-safe branding module against its serving host, because external deployments do not provide Lovable's asset gateway.
