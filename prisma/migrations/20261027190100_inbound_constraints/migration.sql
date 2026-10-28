-- Constraints Prisma's schema language cannot express, for inbound routing.

-- A number is globally unique (schema @unique) and must be E.164; the workflow is one the engine knows.
ALTER TABLE "inbound_numbers"
  ADD CONSTRAINT "inbound_numbers_phone_format" CHECK ("phone" ~ '^\+[1-9][0-9]{9,14}$'),
  ADD CONSTRAINT "inbound_numbers_workflow_known" CHECK ("workflow" IN (
    'general', 'faq', 'appointment', 'order', 'lead_qualification')),
  ADD CONSTRAINT "inbound_numbers_persona_key_format" CHECK ("persona_key" ~ '^[a-z0-9-]{2,40}$'),
  ADD CONSTRAINT "inbound_numbers_known_version_non_negative" CHECK ("known_engine_version" >= 0);

ALTER TABLE "inbound_publications"
  ADD CONSTRAINT "inbound_publications_status_known" CHECK ("status" IN ('pending', 'synced', 'failed')),
  ADD CONSTRAINT "inbound_publications_version_positive" CHECK ("version" >= 1);

-- At most one publish in flight per number, so two clicks (or two tabs) cannot race to the engine.
CREATE UNIQUE INDEX "inbound_publications_one_pending_per_number"
  ON "inbound_publications" ("number_id")
  WHERE "status" = 'pending';
