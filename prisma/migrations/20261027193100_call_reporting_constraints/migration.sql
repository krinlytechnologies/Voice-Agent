-- Constraints Prisma's schema language cannot express, for reported calls.

ALTER TABLE "calls"
  ADD CONSTRAINT "calls_direction_known" CHECK ("direction" IN ('inbound', 'outbound')),
  ADD CONSTRAINT "calls_duration_non_negative" CHECK ("duration_seconds" >= 0),
  -- An inbound call is always tied to our own number it was dialled on, never to a campaign.
  ADD CONSTRAINT "calls_inbound_has_no_campaign" CHECK (
    "direction" <> 'inbound' OR ("campaign_id" IS NULL AND "job_id" IS NULL AND "lead_id" IS NULL)),
  ADD CONSTRAINT "calls_inbound_has_dialled_number" CHECK ("direction" <> 'inbound' OR "dialled_number" IS NOT NULL),
  ADD CONSTRAINT "calls_transcript_ref_digits" CHECK ("transcript_ref" IS NULL OR "transcript_ref" ~ '^[0-9]{1,18}$');
