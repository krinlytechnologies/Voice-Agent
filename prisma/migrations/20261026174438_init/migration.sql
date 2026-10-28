-- CreateTable
CREATE TABLE "clients" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "credit_balance" INTEGER NOT NULL DEFAULT 0,
    "created_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "clients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "client_members" (
    "id" UUID NOT NULL,
    "client_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'member',
    "invited_email" TEXT NOT NULL DEFAULT '',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "client_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "credit_transactions" (
    "id" UUID NOT NULL,
    "client_id" UUID NOT NULL,
    "amount" INTEGER NOT NULL,
    "note" TEXT NOT NULL DEFAULT '',
    "created_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "credit_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "campaigns" (
    "id" UUID NOT NULL,
    "client_id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "purpose" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'Scheduled',
    "persona_key" TEXT NOT NULL DEFAULT '',
    "voice" TEXT NOT NULL DEFAULT '',
    "ambience" BOOLEAN NOT NULL DEFAULT false,
    "calling_start" VARCHAR(5) NOT NULL DEFAULT '09:00',
    "calling_end" VARCHAR(5) NOT NULL DEFAULT '18:00',
    "max_tries" INTEGER NOT NULL DEFAULT 3,
    "retry_gap_minutes" INTEGER NOT NULL DEFAULT 30,
    "callback_window_days" INTEGER NOT NULL DEFAULT 3,
    "credit_cap" INTEGER,
    "created_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "campaigns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leads" (
    "id" UUID NOT NULL,
    "client_id" UUID NOT NULL,
    "campaign_id" UUID NOT NULL,
    "name" TEXT NOT NULL DEFAULT '—',
    "phone" VARCHAR(16) NOT NULL,
    "outcome" TEXT NOT NULL DEFAULT 'Not called',
    "queue_state" TEXT NOT NULL DEFAULT 'Queued',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "follow_up_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "leads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prompts" (
    "id" UUID NOT NULL,
    "client_id" UUID NOT NULL,
    "persona_key" VARCHAR(40) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "purpose" TEXT NOT NULL DEFAULT '',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "language" TEXT NOT NULL DEFAULT 'English',
    "instructions" TEXT NOT NULL DEFAULT '',
    "knowledge" TEXT NOT NULL DEFAULT '',
    "greeting" TEXT NOT NULL DEFAULT '',
    "current_version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "prompts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prompt_versions" (
    "id" UUID NOT NULL,
    "prompt_id" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "content" JSONB NOT NULL,
    "created_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "prompt_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "calls" (
    "id" UUID NOT NULL,
    "client_id" UUID NOT NULL,
    "campaign_id" UUID,
    "lead_id" UUID,
    "job_id" UUID,
    "outcome" TEXT NOT NULL DEFAULT 'completed',
    "duration_seconds" INTEGER NOT NULL DEFAULT 0,
    "transcript_url" TEXT,
    "engine_call_id" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "calls_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "voice_engine_jobs" (
    "id" UUID NOT NULL,
    "client_id" UUID NOT NULL,
    "campaign_id" UUID NOT NULL,
    "idempotency_key" UUID NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "engine_job_id" TEXT,
    "last_error" TEXT,
    "dispatched_at" TIMESTAMPTZ(6),
    "completed_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "voice_engine_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "voice_engine_webhook_events" (
    "id" UUID NOT NULL,
    "event_id" TEXT NOT NULL,
    "job_id" UUID,
    "event_type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "received_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "voice_engine_webhook_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "demo_requests" (
    "id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "phone" VARCHAR(20) NOT NULL,
    "company" VARCHAR(120) NOT NULL DEFAULT '',
    "message" VARCHAR(600) NOT NULL DEFAULT '',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "demo_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "client_members_user_id_idx" ON "client_members"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "client_members_client_id_user_id_key" ON "client_members"("client_id", "user_id");

-- CreateIndex
CREATE INDEX "credit_transactions_client_id_created_at_idx" ON "credit_transactions"("client_id", "created_at");

-- CreateIndex
CREATE INDEX "campaigns_client_id_created_at_idx" ON "campaigns"("client_id", "created_at");

-- CreateIndex
CREATE INDEX "leads_client_id_idx" ON "leads"("client_id");

-- CreateIndex
CREATE UNIQUE INDEX "leads_campaign_id_phone_key" ON "leads"("campaign_id", "phone");

-- CreateIndex
CREATE UNIQUE INDEX "prompts_client_id_persona_key_key" ON "prompts"("client_id", "persona_key");

-- CreateIndex
CREATE UNIQUE INDEX "prompt_versions_prompt_id_version_key" ON "prompt_versions"("prompt_id", "version");

-- CreateIndex
CREATE UNIQUE INDEX "calls_engine_call_id_key" ON "calls"("engine_call_id");

-- CreateIndex
CREATE INDEX "calls_client_id_created_at_idx" ON "calls"("client_id", "created_at");

-- CreateIndex
CREATE INDEX "calls_campaign_id_idx" ON "calls"("campaign_id");

-- CreateIndex
CREATE UNIQUE INDEX "voice_engine_jobs_idempotency_key_key" ON "voice_engine_jobs"("idempotency_key");

-- CreateIndex
CREATE UNIQUE INDEX "voice_engine_jobs_engine_job_id_key" ON "voice_engine_jobs"("engine_job_id");

-- CreateIndex
CREATE INDEX "voice_engine_jobs_campaign_id_idx" ON "voice_engine_jobs"("campaign_id");

-- CreateIndex
CREATE UNIQUE INDEX "voice_engine_webhook_events_event_id_key" ON "voice_engine_webhook_events"("event_id");

-- CreateIndex
CREATE INDEX "voice_engine_webhook_events_job_id_idx" ON "voice_engine_webhook_events"("job_id");

-- CreateIndex
CREATE INDEX "demo_requests_created_at_idx" ON "demo_requests"("created_at" DESC);

-- AddForeignKey
ALTER TABLE "client_members" ADD CONSTRAINT "client_members_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_transactions" ADD CONSTRAINT "credit_transactions_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prompts" ADD CONSTRAINT "prompts_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prompt_versions" ADD CONSTRAINT "prompt_versions_prompt_id_fkey" FOREIGN KEY ("prompt_id") REFERENCES "prompts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calls" ADD CONSTRAINT "calls_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calls" ADD CONSTRAINT "calls_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "campaigns"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calls" ADD CONSTRAINT "calls_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calls" ADD CONSTRAINT "calls_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "voice_engine_jobs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "voice_engine_jobs" ADD CONSTRAINT "voice_engine_jobs_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "voice_engine_jobs" ADD CONSTRAINT "voice_engine_jobs_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "voice_engine_webhook_events" ADD CONSTRAINT "voice_engine_webhook_events_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "voice_engine_jobs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
