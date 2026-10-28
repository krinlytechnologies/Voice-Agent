-- Constraints Prisma's schema language cannot express (CHECK rules, partial indexes).
-- Enforced in the database so they hold regardless of which code path writes the row.

-- Clients: balance can never go negative; known status values only.
ALTER TABLE "clients"
  ADD CONSTRAINT "clients_credit_balance_non_negative" CHECK ("credit_balance" >= 0),
  ADD CONSTRAINT "clients_status_known" CHECK ("status" IN ('active', 'suspended'));

ALTER TABLE "client_members"
  ADD CONSTRAINT "client_members_role_known" CHECK ("role" IN ('owner', 'member'));

-- Campaigns: calling window format and positive limits.
ALTER TABLE "campaigns"
  ADD CONSTRAINT "campaigns_status_known" CHECK ("status" IN (
    'Active', 'Paused', 'Scheduled', 'Out of credits', 'Credit cap reached', 'Completed')),
  ADD CONSTRAINT "campaigns_calling_start_format" CHECK ("calling_start" ~ '^[0-2][0-9]:[0-5][0-9]$'),
  ADD CONSTRAINT "campaigns_calling_end_format" CHECK ("calling_end" ~ '^[0-2][0-9]:[0-5][0-9]$'),
  ADD CONSTRAINT "campaigns_max_tries_positive" CHECK ("max_tries" >= 1),
  ADD CONSTRAINT "campaigns_retry_gap_positive" CHECK ("retry_gap_minutes" >= 1),
  ADD CONSTRAINT "campaigns_callback_window_positive" CHECK ("callback_window_days" >= 1),
  ADD CONSTRAINT "campaigns_credit_cap_positive" CHECK ("credit_cap" IS NULL OR "credit_cap" > 0);

-- Leads: valid queue states, phone format, non-negative attempts.
ALTER TABLE "leads"
  ADD CONSTRAINT "leads_queue_state_known" CHECK ("queue_state" IN (
    'Queued', 'Retry scheduled', 'Callback scheduled', 'Done', 'Exhausted')),
  ADD CONSTRAINT "leads_phone_format" CHECK ("phone" ~ '^\+?[0-9]{7,15}$'),
  ADD CONSTRAINT "leads_attempts_non_negative" CHECK ("attempts" >= 0);

-- Prompts: persona key format and version numbering.
ALTER TABLE "prompts"
  ADD CONSTRAINT "prompts_persona_key_format" CHECK ("persona_key" ~ '^[a-z0-9-]{2,40}$'),
  ADD CONSTRAINT "prompts_current_version_positive" CHECK ("current_version" >= 1);

ALTER TABLE "prompt_versions"
  ADD CONSTRAINT "prompt_versions_version_positive" CHECK ("version" >= 1);

-- Voice engine jobs: known statuses, and at most one non-terminal dispatch per campaign.
-- A double-submitted "start campaign" therefore fails on insert instead of starting two runs.
ALTER TABLE "voice_engine_jobs"
  ADD CONSTRAINT "voice_engine_jobs_status_known" CHECK ("status" IN (
    'pending', 'dispatched', 'running', 'completed', 'failed', 'cancelled'));

CREATE UNIQUE INDEX "voice_engine_jobs_one_active_per_campaign"
  ON "voice_engine_jobs" ("campaign_id")
  WHERE "status" IN ('pending', 'dispatched', 'running');

-- Public demo requests: same limits as the form, enforced server-side too.
ALTER TABLE "demo_requests"
  ADD CONSTRAINT "demo_requests_name_length" CHECK (char_length(btrim("name")) BETWEEN 2 AND 100),
  ADD CONSTRAINT "demo_requests_email_shape" CHECK ("email" ~ '^[^\s@]+@[^\s@]+\.[^\s@]{2,}$'),
  ADD CONSTRAINT "demo_requests_phone_shape" CHECK ("phone" ~ '^[+0-9][0-9\s()-]{6,19}$');
