-- CreateEnum
CREATE TYPE "PaymentChannel" AS ENUM ('COMPANY', 'SALES');

-- CreateEnum
CREATE TYPE "SetoranStatus" AS ENUM ('PENDING', 'PAID');

-- CreateEnum
CREATE TYPE "SetoranMethod" AS ENUM ('GATEWAY', 'MANUAL');

-- AlterTable
ALTER TABLE "Entry" ADD COLUMN "collectedBy" "PaymentChannel" NOT NULL DEFAULT 'COMPANY';

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN "transactionId" TEXT;

-- AlterTable
ALTER TABLE "AppConfig" ADD COLUMN "publicSalesId" TEXT;

-- CreateTable
CREATE TABLE "Setoran" (
    "id" TEXT NOT NULL,
    "salesId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "method" "SetoranMethod" NOT NULL DEFAULT 'GATEWAY',
    "status" "SetoranStatus" NOT NULL DEFAULT 'PENDING',
    "orderId" TEXT,
    "transactionId" TEXT,
    "note" TEXT,
    "recordedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paidAt" TIMESTAMP(3),

    CONSTRAINT "Setoran_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Setoran_orderId_key" ON "Setoran"("orderId");

-- CreateIndex
CREATE INDEX "Setoran_salesId_status_idx" ON "Setoran"("salesId", "status");

-- AddForeignKey
ALTER TABLE "Setoran" ADD CONSTRAINT "Setoran_salesId_fkey" FOREIGN KEY ("salesId") REFERENCES "Profile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
