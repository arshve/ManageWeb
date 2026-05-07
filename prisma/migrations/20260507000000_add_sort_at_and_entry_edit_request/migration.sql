-- CreateEnum
CREATE TYPE "EntryEditRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- AlterTable: add sortAt to Entry, backfill existing rows with createdAt
ALTER TABLE "Entry" ADD COLUMN "sortAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
UPDATE "Entry" SET "sortAt" = "createdAt";

-- CreateIndex
CREATE INDEX "Entry_sortAt_idx" ON "Entry"("sortAt");

-- CreateTable
CREATE TABLE "EntryEditRequest" (
    "id" TEXT NOT NULL,
    "entryId" TEXT NOT NULL,
    "proposedById" TEXT NOT NULL,
    "status" "EntryEditRequestStatus" NOT NULL DEFAULT 'PENDING',
    "itemChanges" JSONB NOT NULL,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EntryEditRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EntryEditRequest_entryId_status_idx" ON "EntryEditRequest"("entryId", "status");

-- AddForeignKey
ALTER TABLE "EntryEditRequest" ADD CONSTRAINT "EntryEditRequest_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "Entry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EntryEditRequest" ADD CONSTRAINT "EntryEditRequest_proposedById_fkey" FOREIGN KEY ("proposedById") REFERENCES "Profile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EntryEditRequest" ADD CONSTRAINT "EntryEditRequest_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "Profile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
