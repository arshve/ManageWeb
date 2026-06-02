-- AlterTable: Midtrans credentials on AppConfig (UI-configurable; env fallback).
ALTER TABLE "AppConfig" ADD COLUMN "midtransServerKey" TEXT;
ALTER TABLE "AppConfig" ADD COLUMN "midtransClientKey" TEXT;
ALTER TABLE "AppConfig" ADD COLUMN "midtransIsProduction" BOOLEAN;
ALTER TABLE "AppConfig" ADD COLUMN "paymentMock" BOOLEAN;
