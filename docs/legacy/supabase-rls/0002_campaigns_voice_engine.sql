-- Persists campaigns, leads, prompts and call records (currently in-memory
-- sample data in src/lib/campaigns.ts, prompts.ts, call-records.ts) and adds
-- the minimum tracking needed to dispatch a campaign to the separately
-- deployed Python voice engine and ingest its webhook events idempotently.
--
-- Reuses the existing tenant model (clients/client_members) and credit
-- ledger (credit_transactions) exactly as they already work — no new
-- pricing or retry policy is introduced. Status/outcome/queue vocabularies
-- are copied verbatim from the existing sample modules (src/lib/campaigns.ts,
-- call-outcome-rules.ts), not invented here.
--
-- ASSUMPTION (flagged, not approved): campaign status transitions are
-- restricted to Scheduled/Active<->Paused, and any of those ->
-- Completed/Out of credits/Credit cap reached, enforced in
-- src/lib/campaigns.functions.ts, not in the database. Confirm before
-- relying on it for anything irreversible.

create table public.campaigns (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 2 and 100),
  purpose text not null default '',
  status text not null default 'Scheduled'
    check (status in ('Active', 'Paused', 'Scheduled', 'Out of credits', 'Credit cap reached', 'Completed')),
  persona_key text not null default '',
  voice text not null default '',
  ambience boolean not null default false,
  calling_start time not null default '09:00',
  calling_end time not null default '18:00',
  max_tries integer not null default 3 check (max_tries >= 1),
  retry_gap_minutes integer not null default 30 check (retry_gap_minutes >= 1),
  callback_window_days integer not null default 3 check (callback_window_days >= 1),
  credit_cap integer check (credit_cap is null or credit_cap > 0),
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index campaigns_client_id_idx on public.campaigns (client_id);
grant select, insert, update on public.campaigns to authenticated;
grant all on public.campaigns to service_role;
alter table public.campaigns enable row level security;

create policy "Super admins can manage campaigns"
  on public.campaigns for all to authenticated
  using (public.has_role(auth.uid(), 'super_admin'))
  with check (public.has_role(auth.uid(), 'super_admin'));

create policy "Members can read their client campaigns"
  on public.campaigns for select to authenticated
  using (exists (
    select 1 from public.client_members m
    where m.client_id = campaigns.client_id and m.user_id = auth.uid()
  ));

create policy "Members can create campaigns for their client"
  on public.campaigns for insert to authenticated
  with check (exists (
    select 1 from public.client_members m
    where m.client_id = campaigns.client_id and m.user_id = auth.uid()
  ));

create policy "Members can update their client campaigns"
  on public.campaigns for update to authenticated
  using (exists (
    select 1 from public.client_members m
    where m.client_id = campaigns.client_id and m.user_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.client_members m
    where m.client_id = campaigns.client_id and m.user_id = auth.uid()
  ));

create table public.leads (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  name text not null default '—',
  phone text not null check (phone ~ '^\+?[0-9]{7,15}$'),
  outcome text not null default 'Not called',
  queue_state text not null default 'Queued'
    check (queue_state in ('Queued', 'Retry scheduled', 'Callback scheduled', 'Done', 'Exhausted')),
  attempts integer not null default 0 check (attempts >= 0),
  follow_up_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (campaign_id, phone)
);
create index leads_client_id_idx on public.leads (client_id);
create index leads_campaign_id_idx on public.leads (campaign_id);
grant select, insert, update on public.leads to authenticated;
grant all on public.leads to service_role;
alter table public.leads enable row level security;

create policy "Super admins can manage leads"
  on public.leads for all to authenticated
  using (public.has_role(auth.uid(), 'super_admin'))
  with check (public.has_role(auth.uid(), 'super_admin'));

create policy "Members can read their client leads"
  on public.leads for select to authenticated
  using (exists (
    select 1 from public.client_members m
    where m.client_id = leads.client_id and m.user_id = auth.uid()
  ));

create policy "Members can import leads for their client"
  on public.leads for insert to authenticated
  with check (exists (
    select 1 from public.client_members m
    where m.client_id = leads.client_id and m.user_id = auth.uid()
  ));

create policy "Members can update their client leads"
  on public.leads for update to authenticated
  using (exists (
    select 1 from public.client_members m
    where m.client_id = leads.client_id and m.user_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.client_members m
    where m.client_id = leads.client_id and m.user_id = auth.uid()
  ));

create table public.prompts (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  persona_key text not null check (persona_key ~ '^[a-z0-9-]{2,40}$'),
  name text not null check (char_length(trim(name)) >= 2),
  purpose text not null default '',
  active boolean not null default true,
  language text not null default 'English',
  instructions text not null default '',
  knowledge text not null default '',
  greeting text not null default '',
  current_version integer not null default 1 check (current_version >= 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (client_id, persona_key)
);
create index prompts_client_id_idx on public.prompts (client_id);
grant select, insert, update on public.prompts to authenticated;
grant all on public.prompts to service_role;
alter table public.prompts enable row level security;

create policy "Super admins can manage prompts"
  on public.prompts for all to authenticated
  using (public.has_role(auth.uid(), 'super_admin'))
  with check (public.has_role(auth.uid(), 'super_admin'));

create policy "Members can read their client prompts"
  on public.prompts for select to authenticated
  using (exists (
    select 1 from public.client_members m
    where m.client_id = prompts.client_id and m.user_id = auth.uid()
  ));

create policy "Members can create prompts for their client"
  on public.prompts for insert to authenticated
  with check (exists (
    select 1 from public.client_members m
    where m.client_id = prompts.client_id and m.user_id = auth.uid()
  ));

create policy "Members can update their client prompts"
  on public.prompts for update to authenticated
  using (exists (
    select 1 from public.client_members m
    where m.client_id = prompts.client_id and m.user_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.client_members m
    where m.client_id = prompts.client_id and m.user_id = auth.uid()
  ));

-- One row per save; current_version on `prompts` always points at the
-- highest `version` here for that prompt. Snapshots are immutable (insert
-- only, no update/delete policy for members) so history can't be rewritten.
create table public.prompt_versions (
  id uuid primary key default gen_random_uuid(),
  prompt_id uuid not null references public.prompts(id) on delete cascade,
  version integer not null check (version >= 1),
  content jsonb not null,
  created_by uuid,
  created_at timestamptz not null default now(),
  unique (prompt_id, version)
);
create index prompt_versions_prompt_id_idx on public.prompt_versions (prompt_id);
grant select, insert on public.prompt_versions to authenticated;
grant all on public.prompt_versions to service_role;
alter table public.prompt_versions enable row level security;

create policy "Super admins can manage prompt versions"
  on public.prompt_versions for all to authenticated
  using (public.has_role(auth.uid(), 'super_admin'))
  with check (public.has_role(auth.uid(), 'super_admin'));

create policy "Members can read their client prompt versions"
  on public.prompt_versions for select to authenticated
  using (exists (
    select 1 from public.prompts p
    join public.client_members m on m.client_id = p.client_id
    where p.id = prompt_versions.prompt_id and m.user_id = auth.uid()
  ));

create policy "Members can save prompt versions for their client"
  on public.prompt_versions for insert to authenticated
  with check (exists (
    select 1 from public.prompts p
    join public.client_members m on m.client_id = p.client_id
    where p.id = prompt_versions.prompt_id and m.user_id = auth.uid()
  ));

-- One dispatch attempt of a campaign to the external voice engine.
-- `idempotency_key` is what we send the engine so a retried dispatch on our
-- side (network timeout, etc.) can never start the same run twice; `unique`
-- also makes a second INSERT from a double-submitted UI action a no-op
-- error the application layer already expects and swallows.
create table public.voice_engine_jobs (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  idempotency_key uuid not null default gen_random_uuid(),
  status text not null default 'pending'
    check (status in ('pending', 'dispatched', 'running', 'completed', 'failed', 'cancelled')),
  engine_job_id text,
  last_error text,
  dispatched_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (idempotency_key)
);
create index voice_engine_jobs_campaign_id_idx on public.voice_engine_jobs (campaign_id);
-- At most one non-terminal dispatch per campaign: the application layer's
-- own idempotency key can't stop a double-submitted "start campaign" click
-- from racing two inserts, but this index can — the second insert fails
-- with a unique violation the dispatch service already expects and reports
-- as "already running" rather than starting a duplicate run.
create unique index voice_engine_jobs_one_active_per_campaign
  on public.voice_engine_jobs (campaign_id)
  where status in ('pending', 'dispatched', 'running');
grant select, insert, update on public.voice_engine_jobs to authenticated;
grant all on public.voice_engine_jobs to service_role;
alter table public.voice_engine_jobs enable row level security;

create policy "Super admins can manage voice engine jobs"
  on public.voice_engine_jobs for all to authenticated
  using (public.has_role(auth.uid(), 'super_admin'))
  with check (public.has_role(auth.uid(), 'super_admin'));

create policy "Members can read their client voice engine jobs"
  on public.voice_engine_jobs for select to authenticated
  using (exists (
    select 1 from public.client_members m
    where m.client_id = voice_engine_jobs.client_id and m.user_id = auth.uid()
  ));

create policy "Members can dispatch jobs for their client"
  on public.voice_engine_jobs for insert to authenticated
  with check (exists (
    select 1 from public.client_members m
    where m.client_id = voice_engine_jobs.client_id and m.user_id = auth.uid()
  ));

-- Every webhook delivery from the voice engine, keyed by the engine's own
-- event id, so a retried/replayed delivery (the engine resending after a
-- timed-out ack, or a replay attack with a captured payload) is rejected
-- before it can double-count a call or usage. Only service_role touches
-- this table — it is written exclusively by the webhook handler, which
-- authenticates the engine by shared secret, not by a Supabase user JWT.
create table public.voice_engine_webhook_events (
  id uuid primary key default gen_random_uuid(),
  event_id text not null unique,
  job_id uuid references public.voice_engine_jobs(id) on delete set null,
  event_type text not null,
  received_at timestamptz not null default now(),
  payload jsonb not null
);
create index voice_engine_webhook_events_job_id_idx on public.voice_engine_webhook_events (job_id);
alter table public.voice_engine_webhook_events enable row level security;

create policy "Super admins can read webhook events"
  on public.voice_engine_webhook_events for select to authenticated
  using (public.has_role(auth.uid(), 'super_admin'));

grant all on public.voice_engine_webhook_events to service_role;

-- Extend the existing `calls` table with the links a dispatched campaign's
-- reported events need, instead of creating a parallel call-records table.
alter table public.calls
  add column campaign_id uuid references public.campaigns(id) on delete set null,
  add column lead_id uuid references public.leads(id) on delete set null,
  add column job_id uuid references public.voice_engine_jobs(id) on delete set null,
  add column transcript_url text,
  add column engine_call_id text;
create unique index calls_engine_call_id_idx on public.calls (engine_call_id) where engine_call_id is not null;
create index calls_campaign_id_idx on public.calls (campaign_id);
