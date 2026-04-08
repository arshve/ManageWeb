-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'SALES');

-- CreateEnum
CREATE TYPE "AnimalType" AS ENUM ('KAMBING', 'DOMBA', 'SAPI');

-- CreateEnum
CREATE TYPE "AnimalGrade" AS ENUM ('SUPER', 'A', 'B', 'C', 'D');

-- CreateEnum
CREATE TYPE "AnimalCondition" AS ENUM ('SEHAT', 'MATI', 'SAKIT');

-- CreateEnum
CREATE TYPE "EntryStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('BELUM_BAYAR', 'DP', 'LUNAS');

-- CreateTable
CREATE TABLE "Profile" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'SALES',
    "phone" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Profile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Livestock" (
    "id" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "type" "AnimalType" NOT NULL,
    "grade" "AnimalGrade" NOT NULL,
    "condition" "AnimalCondition" NOT NULL DEFAULT 'SEHAT',
    "weight" DOUBLE PRECISION,
    "tagBsd" TEXT,
    "tagKandang" TEXT,
    "tagMf" TEXT,
    "photoUrl" TEXT,
    "notes" TEXT,
    "isSold" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Livestock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Entry" (
    "id" TEXT NOT NULL,
    "invoiceNo" TEXT NOT NULL,
    "status" "EntryStatus" NOT NULL DEFAULT 'PENDING',
    "livestockId" TEXT NOT NULL,
    "salesId" TEXT NOT NULL,
    "hargaJual" DOUBLE PRECISION NOT NULL,
    "hargaModal" DOUBLE PRECISION,
    "resellerCut" DOUBLE PRECISION,
    "hpp" DOUBLE PRECISION,
    "profit" DOUBLE PRECISION,
    "dp" DOUBLE PRECISION,
    "totalBayar" DOUBLE PRECISION,
    "paymentStatus" "PaymentStatus" NOT NULL DEFAULT 'BELUM_BAYAR',
    "buyerName" TEXT NOT NULL,
    "buyerPhone" TEXT,
    "buyerWa" TEXT,
    "buyerAddress" TEXT,
    "buyerMaps" TEXT,
    "notes" TEXT,
    "isSent" BOOLEAN NOT NULL DEFAULT false,
    "approvedAt" TIMESTAMP(3),
    "approvedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Entry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Pricing" (
    "id" TEXT NOT NULL,
    "animalType" "AnimalType" NOT NULL,
    "grade" "AnimalGrade" NOT NULL,
    "hargaBeli" DOUBLE PRECISION NOT NULL,
    "hargaJual" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Pricing_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Profile_email_key" ON "Profile"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Livestock_sku_key" ON "Livestock"("sku");

-- CreateIndex
CREATE UNIQUE INDEX "Entry_invoiceNo_key" ON "Entry"("invoiceNo");

-- CreateIndex
CREATE UNIQUE INDEX "Entry_livestockId_key" ON "Entry"("livestockId");

-- CreateIndex
CREATE UNIQUE INDEX "Pricing_animalType_grade_key" ON "Pricing"("animalType", "grade");

-- AddForeignKey
ALTER TABLE "Entry" ADD CONSTRAINT "Entry_livestockId_fkey" FOREIGN KEY ("livestockId") REFERENCES "Livestock"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Entry" ADD CONSTRAINT "Entry_salesId_fkey" FOREIGN KEY ("salesId") REFERENCES "Profile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
