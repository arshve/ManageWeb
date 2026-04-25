-- Step 1: Create EntryItem table
CREATE TABLE IF NOT EXISTS "EntryItem" (
  "id"          TEXT             NOT NULL,
  "entryId"     TEXT             NOT NULL,
  "livestockId" TEXT             NOT NULL,
  "hargaJual"   DOUBLE PRECISION NOT NULL,
  "hargaModal"  DOUBLE PRECISION,
  "resellerCut" DOUBLE PRECISION,
  "hpp"         DOUBLE PRECISION,
  "profit"      DOUBLE PRECISION,
  "createdAt"   TIMESTAMP(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EntryItem_pkey" PRIMARY KEY ("id")
);

-- Step 2: Indexes
CREATE UNIQUE INDEX IF NOT EXISTS "EntryItem_livestockId_key" ON "EntryItem"("livestockId");
CREATE INDEX IF NOT EXISTS "EntryItem_entryId_idx" ON "EntryItem"("entryId");

-- Step 3: Foreign keys (skip if already added)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'EntryItem_entryId_fkey'
  ) THEN
    ALTER TABLE "EntryItem"
      ADD CONSTRAINT "EntryItem_entryId_fkey"
      FOREIGN KEY ("entryId") REFERENCES "Entry"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'EntryItem_livestockId_fkey'
  ) THEN
    ALTER TABLE "EntryItem"
      ADD CONSTRAINT "EntryItem_livestockId_fkey"
      FOREIGN KEY ("livestockId") REFERENCES "Livestock"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

-- Step 4: Migrate data — one EntryItem per existing Entry
INSERT INTO "EntryItem" (
  "id", "entryId", "livestockId",
  "hargaJual", "hargaModal", "resellerCut",
  "hpp", "profit", "createdAt"
)
SELECT
  gen_random_uuid()::text,
  e."id",
  e."livestockId",
  e."hargaJual",
  e."hargaModal",
  e."resellerCut",
  e."hpp",
  e."profit",
  e."createdAt"
FROM "Entry" e
WHERE e."livestockId" IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM "EntryItem" ei WHERE ei."entryId" = e."id"
  );
