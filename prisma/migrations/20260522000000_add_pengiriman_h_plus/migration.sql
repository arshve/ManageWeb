-- Add post-delivery-day options to Pengiriman enum (H+1, H+2, H+3)
ALTER TYPE "Pengiriman" ADD VALUE IF NOT EXISTS 'H_PLUS_1';
ALTER TYPE "Pengiriman" ADD VALUE IF NOT EXISTS 'H_PLUS_2';
ALTER TYPE "Pengiriman" ADD VALUE IF NOT EXISTS 'H_PLUS_3';
