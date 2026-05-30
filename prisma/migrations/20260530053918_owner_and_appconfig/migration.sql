-- AlterEnum
ALTER TYPE "Role" ADD VALUE 'OWNER';

-- CreateTable
CREATE TABLE "AppConfig" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "companyName" TEXT,
    "tagline" TEXT,
    "address" TEXT,
    "city" TEXT,
    "bankName" TEXT,
    "bankAccountName" TEXT,
    "bankAccountNo" TEXT,
    "signer" TEXT,
    "instagram" TEXT,
    "appTitle" TEXT,
    "appDescription" TEXT,
    "logoUrl" TEXT,
    "logoLightUrl" TEXT,
    "signatureUrl" TEXT,
    "brandHex" TEXT,
    "brandScale" JSONB,
    "coverColor" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppConfig_pkey" PRIMARY KEY ("id")
);
