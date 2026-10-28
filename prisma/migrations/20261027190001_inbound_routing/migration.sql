-- CreateTable
CREATE TABLE "inbound_numbers" (
    "id" UUID NOT NULL,
    "client_id" UUID NOT NULL,
    "phone" VARCHAR(16) NOT NULL,
    "persona_key" VARCHAR(40) NOT NULL,
    "workflow" TEXT NOT NULL DEFAULT 'general',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "known_engine_version" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "inbound_numbers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inbound_publications" (
    "id" UUID NOT NULL,
    "number_id" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "snapshot" JSONB NOT NULL,
    "persona_version" INTEGER NOT NULL,
    "error" TEXT,
    "created_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "synced_at" TIMESTAMPTZ(6),

    CONSTRAINT "inbound_publications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "inbound_numbers_phone_key" ON "inbound_numbers"("phone");

-- CreateIndex
CREATE INDEX "inbound_numbers_client_id_idx" ON "inbound_numbers"("client_id");

-- CreateIndex
CREATE UNIQUE INDEX "inbound_publications_number_id_version_key" ON "inbound_publications"("number_id", "version");

-- AddForeignKey
ALTER TABLE "inbound_numbers" ADD CONSTRAINT "inbound_numbers_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inbound_publications" ADD CONSTRAINT "inbound_publications_number_id_fkey" FOREIGN KEY ("number_id") REFERENCES "inbound_numbers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
