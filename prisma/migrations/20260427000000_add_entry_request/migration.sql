-- CreateTable
CREATE TABLE "EntryRequest" (
    "id" TEXT NOT NULL,
    "entryId" TEXT NOT NULL,
    "type" "AnimalType" NOT NULL,
    "grade" "AnimalGrade",
    "weightMin" DOUBLE PRECISION,
    "weightMax" DOUBLE PRECISION,
    "hargaJual" DOUBLE PRECISION NOT NULL,
    "hargaModal" DOUBLE PRECISION,
    "resellerCut" DOUBLE PRECISION,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EntryRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EntryRequest_entryId_idx" ON "EntryRequest"("entryId");

-- CreateIndex
CREATE INDEX "EntryRequest_type_grade_idx" ON "EntryRequest"("type", "grade");

-- AddForeignKey
ALTER TABLE "EntryRequest" ADD CONSTRAINT "EntryRequest_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "Entry"("id") ON DELETE CASCADE ON UPDATE CASCADE;
