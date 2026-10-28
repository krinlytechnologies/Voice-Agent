-- AlterTable
ALTER TABLE "calls" ADD COLUMN     "caller_number" VARCHAR(20),
ADD COLUMN     "collected_fields" JSONB,
ADD COLUMN     "dialled_number" VARCHAR(20),
ADD COLUMN     "direction" TEXT NOT NULL DEFAULT 'outbound',
ADD COLUMN     "inbound_number_id" UUID,
ADD COLUMN     "outcome_raw" VARCHAR(200),
ADD COLUMN     "reported_at" TIMESTAMPTZ(6),
ADD COLUMN     "status" VARCHAR(40) NOT NULL DEFAULT 'completed',
ADD COLUMN     "summary" TEXT,
ADD COLUMN     "transcript_ref" VARCHAR(40);

-- CreateIndex
CREATE INDEX "calls_client_id_direction_created_at_idx" ON "calls"("client_id", "direction", "created_at" DESC);

-- CreateIndex
CREATE INDEX "calls_client_id_outcome_idx" ON "calls"("client_id", "outcome");

-- AddForeignKey
ALTER TABLE "calls" ADD CONSTRAINT "calls_inbound_number_id_fkey" FOREIGN KEY ("inbound_number_id") REFERENCES "inbound_numbers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
