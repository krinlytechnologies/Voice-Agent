# Local development: PostgreSQL in Docker, Prisma ORM, local sign-in

## Architecture decisions

- **Database:** PostgreSQL 16 in Docker (`docker-compose.yml`). The app talks to it only through
  Prisma (`prisma/schema.prisma`). `DATABASE_URL` is the only setting that changes when the
  project moves to Supabase or Cloudflare.
- **Tenancy:** enforced in application code. Every tenant query is scoped by the caller's
  client id, which is resolved from their `client_members` row (`currentWorkspaceClient`).
  No request input supplies a client id. Integration tests prove cross-tenant access is refused.
- **Sign-in:** accounts and sessions live in the same PostgreSQL database. Passwords are salted
  scrypt hashes. The browser holds only an httpOnly, SameSite=Lax session cookie, and the server
  stores only a SHA-256 hash of the token. Sign-in is limited to 10 failures per email in 15
  minutes. Supabase Auth is not used.
- **No Supabase at runtime.** Supabase-specific pieces (RLS policies, `auth.uid()`, the
  `auth.users` trigger) are archived in `docs/legacy/supabase-rls/` for porting later.

## Prerequisites

- Docker Desktop running
- Node 22+ (the account script uses `--experimental-strip-types`)

## First-time setup

```bash
cp .env.example .env          # add the two DATABASE_URL lines if not already present
npm install                   # also runs `prisma generate` (postinstall)
npm run db:up                 # starts Postgres on localhost:5434
```

Create the test database once:

```bash
docker compose exec postgres psql -U mona -d mona -c "create database mona_test;"
```

Apply migrations to both databases:

```bash
DATABASE_URL="postgresql://mona:mona_local_only@localhost:5434/mona?schema=public" npm run db:migrate
DATABASE_URL="postgresql://mona:mona_local_only@localhost:5434/mona_test?schema=public" npm run db:migrate
```

## Creating accounts

There is no public signup. Create accounts with the script. The password comes from the
environment so it stays out of shell history:

```bash
MONA_PASSWORD="<at least 12 characters>" npm run user:create -- you@example.com "Your Name" "Workspace name"
```

The optional third argument creates a workspace you own. Without it, the user has no workspace
and sees an empty dashboard.

## Calling from campaigns (voice engine)

Pressing **Start** on a campaign makes the Python engine place **real phone calls** through Exotel, one lead at a
time, inside the campaign's calling hours. Try it with a campaign that contains only your own number first.

1. **Engine** (`agent/.env`): `ENABLE_OUTBOUND_CALLS=true`, `EXOTEL_APP_ID`, and a new random
   `DASHBOARD_WEBHOOK_SECRET`. Restart the engine; it applies migration `004_dispatch_jobs` on start.
2. **Write the persona in the dashboard** (Prompts page): instructions, greeting, knowledge and language. There is
   nothing to create on the engine: each time you press Start, the dashboard sends the persona's latest saved revision
   and the engine's calls for that campaign say exactly that text. Editing the prompt later does not change a campaign
   that is already running; it takes effect the next time a campaign is started. (The engine keeps an agent row per
   persona for the voice; to use a different Bakbak voice or LLM model for a persona, set `voice_id` +
   `tts_model_id` or `llm_model` on that agent with `PUT /agents/{id}`; they are kept across starts.)
3. **Dashboard** (`.env`): `VOICE_ENGINE_BASE_URL=http://127.0.0.1:8000`, `VOICE_ENGINE_API_KEY` = the engine's
   `APP_SECRET_KEY`, `VOICE_ENGINE_WEBHOOK_SECRET` = the engine's `DASHBOARD_WEBHOOK_SECRET`, and `APP_BASE_URL` = the
   URL the engine can reach this app on (`http://localhost:8080`). Restart the dev server.
4. Add leads to the campaign and press **Start**. The page refreshes every 10 seconds while a campaign is Active.
   **Pause** stops new calls; a call already in progress finishes first.

If Start fails, the toast says why (engine unreachable, persona removed or switched off, outbound disabled, no credits).

## Inbound numbers (a caller hears a Mona persona)

A caller who dials a number that is routed here hears the persona assigned to that number. Nothing is fetched
from the dashboard while a call connects: the dashboard **publishes** the route to the engine, which stores it.

1. **Engine** (`agent/.env`), then restart it (it applies migration `006_inbound_routes` on start):
   - `INBOUND_RESERVED_CALLS`: slots that outbound and campaign calls may never use. They may use only
     `MAX_CONCURRENT_CALLS - INBOUND_RESERVED_CALLS` in total, so keep `MAX_CONCURRENT_CALLS` at least one higher
     than the reservation or campaigns can never dial. `0` (default) reserves nothing. Not allowed to exceed the max.
   - `INBOUND_LEGACY_DEFAULT_ENABLED`: `true` (default) still answers a number with no published route using the
     engine-wide default agent (an agent with `is_inbound_default` and **no** `client_id`). Set it to `false` once your
     number is routed, so an unrouted number is refused instead.
2. **Exotel** (once per number, see `overview.md` §7): attach the flow with the Voicebot applet to the ExoPhone.
3. **Dashboard, Inbound numbers** (sidebar): add the number in international form (`+918047491899`), choose the
   persona and the conversation type, then **Publish**. Version 1 is live once the engine confirms it.
   - **Save draft** changes nothing live. Editing a prompt does not either: press **Publish** again to send the
     persona's latest saved revision.
   - If a publish fails (engine down, refused), the number keeps its last confirmed version, the failure and its
     reason are shown, and **Publish** can simply be pressed again. **Check engine** shows what the engine is really
     serving and confirms a publish whose answer got lost.
   - **Publish this again** in the history re-sends an earlier confirmed version as a new, higher version (rollback).
   - The number must be the one Exotel reports as dialled (for example `08037091588`, entered as `+918037091588`).
     The form refuses a malformed Indian number such as `+9109513886363` (a trunk 0 typed after `+91`) and suggests the fix.
   - After the engine accepts a publish, the dashboard reads the route back and reports a mismatch as a failure instead of
     showing success. A failure stays on the number's card until the next action.
4. **Check which route answered**: the engine logs one line per inbound call, for example
   `inbound call CA… to '08037091588': route 918037091588 v3 answers with persona 'customer-enquiry-assistant' (revision 2) on agent 12`.
   A call to a number with no route logs `… matches no published route; answering with the engine-wide default agent N`
   (or `refusing the call`), and the number appears at the top of **Inbound numbers** with *Add this number*. Marking an
   agent `is_inbound_default` does not choose a persona for a number, and the engine refuses to flag a workspace's agent.
5. **Which number is "the number"?** Exotel's stream `start` frame has `from` and `to`, and Exotel's documentation shows
   their shape but does not say what they mean. On this account Exotel's own call records show that `to` is **not** the
   ExoPhone the caller dialled: for calls to the ExoPhone `09513886363` the stream says `to = 08037091588`, while the
   record's `PhoneNumberSid` is `09513886363`. So the engine looks a call up by the stream's `to` first, and only if that
   matches no route reads Exotel's call record (read-only, the account's own credentials) and tries the ExoPhone in it. Publish
   the route for the number your callers dial (`+919513886363`). Turn the lookup off with `EXOTEL_RESOLVE_CALLED_NUMBER=false`.
   A number that matches nothing is still refused (or answered by the engine-wide default agent while that is enabled).
   To see exactly what Exotel sends, the engine logs every stream start with credentials removed and callers masked
   (`exotel stream start {...}`, with every field name Exotel included) and the upgrade request (`exotel stream request {...}`).
6. **Try it**: call the number. If it is refused, the engine log says why, for example
   `media stream not started: No inbound route is published for the dialled number '…'`. That line also shows the
   exact `to` value Exotel sent, which is how to confirm its format.

Deployment order: apply the dashboard migrations (`npm run db:migrate`), restart the engine, then publish.

### Seeing inbound calls in the dashboard

When an inbound call finishes, the engine queues a signed report and delivers it to the dashboard in the
background (a slow or unreachable dashboard never delays a live call). To turn it on:

1. Engine `agent/.env`: `DASHBOARD_WEBHOOK_URL=http://localhost:8080/api/webhooks/voice-engine` (your dashboard's
   address as the engine can reach it) next to the existing `DASHBOARD_WEBHOOK_SECRET`, which must equal the
   dashboard's `VOICE_ENGINE_WEBHOOK_SECRET`. Restart the engine (migration `007_inbound_reporting`).
2. Dashboard: `npm run db:migrate`. Nothing else to configure; the report is matched to your workspace by the number
   that was dialled, so that number must be one you added and published under **Inbound numbers**.
3. The call shows up under **Inbound Calls** (and under **Missed Callbacks** if the caller asked to be called back)
   within a few seconds of hanging up. Open a row for the summary, the details the agent collected, and the
   transcript (read from the engine when you open it).

What gets refused, and why you might not see a call: a report for a number you have not added (404), never
published (403) or switched off both as a draft and as published (403) is refused and not retried; the engine logs
`giving up on call report …`. A temporary failure (dashboard down, 5xx, 429) is retried with growing delays up to
`WEBHOOK_MAX_ATTEMPTS` times. Reports are kept in the engine's `webhook_outbox` table, so `select id, attempts,
last_error, abandoned_at from webhook_outbox where job_id is null order by id desc;` shows what happened to each.

How outcomes are shown: the dashboard turns the engine's word into its own label (`appointment_requested` →
*Meeting booked*, `callback_requested` → *Callback*, an unknown word → *Inconclusive*) and keeps the original, which
you can see in the call details. The full table is in `src/lib/outcomes.ts`.

## Port notes

Port **5434** is used on purpose. On the development machine the host already had:

- a native PostgreSQL 17 Windows service on `5432`
- another container, `voice-agent-db-1`, on `5433`

Do not stop those to free the ports. If `5434` is also taken, change the mapping in
`docker-compose.yml` and in `DATABASE_URL` / `DATABASE_URL_TEST`.

## Daily commands

| Command | What it does |
| --- | --- |
| `npm run db:up` / `npm run db:down` | Start / stop the local Postgres |
| `npm run db:migrate:dev -- --name <name>` | Create and apply a new migration (dev only) |
| `npm run db:studio` | Browse data in Prisma Studio |
| `npm run user:create -- <email> "<name>" ["<workspace>"]` | Create a sign-in account |
| `npm test` | Unit tests (no database) |
| `DATABASE_URL_TEST=... npm run test:int` | Integration tests against `mona_test` |
| `npm run typecheck` / `npm run lint` / `npm run build` | Checks |

Integration tests refuse to run unless the database name ends in `_test`, so they cannot
delete development data.

## Migrations

- Migrations live in `prisma/migrations/` and are the only way to change the schema.
- Prisma cannot express CHECK constraints or partial indexes, so these are written by hand in
  `*_db_constraints/migration.sql`. Prisma's drift check ignores them, and that is expected.
  An integration test verifies they still exist and are enforced.
- Never edit a migration that has been applied anywhere. Add a new one.

## Moving to Supabase or Cloudflare later

The database move is a configuration change plus migrations:

1. Point `DATABASE_URL` at the new Postgres. For Supabase, use the direct connection for migrations.
2. Run `npm run db:migrate`. The schema has no Supabase-specific objects.
3. Port the RLS policies from `docs/legacy/supabase-rls/` if you want database-level defence in depth.
4. **Users move separately.** Passwords are hashed by this app, so the `users` rows can be
   copied as-is. Existing sessions do not carry over, so users sign in again. Copy
   `login_attempts` only if you need the lockout history.

## Known limits (not yet production-ready)

- **Deployment target:** the Nitro build targets Cloudflare. Prisma's default engine needs
  Node TCP. Deploy to a Node host, or add `@prisma/adapter-pg` with a Cloudflare-compatible
  driver before deploying there.
- **Public demo form** has no rate limiting.
- **Stale dispatch jobs:** a dashboard job stuck in `pending` (process crash between creating it and
  the engine's answer) blocks new dispatches for that campaign. Needs a reaper. The engine side
  already recovers calls that never report back.
- **Credit debit when balance is too low:** usage is billed when the job finishes, so a campaign can
  run past the balance. The finishing webhook then fails and the engine retries until credits are
  topped up. The business rule (stop mid-run? allow overdraft?) is not decided; the credit cap is not enforced.
- **Only part of a persona reaches the engine:** language, instructions, greeting and knowledge. The Prompts
  page's recognition context, WhatsApp message, silence handling, voicemail detection and mid-call languages are
  saved but not used by the engine yet, and the campaign's "Voice" choice is only a label: the engine's voice comes
  from `BAKBAK_VOICES` per language (or the agent's own override).
- **Inbound calls are not billed.** They are routed, reported and listed, but no credits are deducted for them.
  Calls that never connect (a refused or switched-off number, no free line) leave no record to report.
  There is no way to delete a number or its engine route (switch it off and publish instead).
- **Notes** on the call pages are kept on the page only; they are not saved.
- **Per-number health and best-time-to-call** on the Overview are still sample figures, labelled as such. The `to` value Exotel really sends has not been confirmed on a live call; the engine accepts
  `+918047491899`, `918047491899`, `08047491899` and `8047491899` for the same number.
- A caller who is refused (unrouted number, switched off, no free slot) hears the line close with no message; to play a
  recording instead, put a message applet after the Voicebot applet in the Exotel flow.
- **"Resume" after a pause starts a new run** with the persona as it is then.
- **Engine outcome words** (for example `appointment_requested`) are stored as-is; Mona's own outcome
  list (Interested, Callback, ...) is not mapped from them, so "Interested leads" stays 0 for now.
- **Callbacks:** a caller who asks for a callback is not scheduled in the "Callback scheduled" state.
- **Single engine process.** The engine's call queue lives in one process; do not run two.
- **No password reset or change flow.** Accounts are created by the script only.
- **Sign-in rate limit is per email.** Rotating addresses is not limited per IP yet.
- **Super-admin access** from the old RLS model is not implemented in application code.
- **Browser sign-in not yet exercised end to end.** Covered by integration tests and the
  production build, but not clicked through in a real browser.
