/**
 * Full-data export (DB-only). Reads every table in dependency order and
 * returns a single JSON-serializable payload. Image URLs (Supabase) are kept
 * verbatim — the export does not bundle media. Branding (AppConfig) IS
 * included so a backup captures the full white-label setup.
 *
 * Shape: { version, exportedAt, counts, tables: { <model>: rows[] } }
 */

import { prisma } from '@/lib/prisma';

export const EXPORT_VERSION = 1;

// Order is parent → child (safe to insert in this order on import).
export const TABLE_ORDER = [
  'appConfig',
  'profile',
  'pricing',
  'livestock',
  'cashflow',
  'geocodeCache',
  'entry',
  'entryItem',
  'entryRequest',
  'delivery',
  'driverAvailability',
  'entryEditRequest',
  'auditLog',
] as const;

export type ExportPayload = {
  version: number;
  exportedAt: string;
  counts: Record<string, number>;
  tables: Record<string, unknown[]>;
};

export async function exportAll(): Promise<ExportPayload> {
  const [
    appConfig, profile, pricing, livestock, cashflow, geocodeCache,
    entry, entryItem, entryRequest, delivery, driverAvailability,
    entryEditRequest, auditLog,
  ] = await prisma.$transaction([
    prisma.appConfig.findMany(),
    prisma.profile.findMany(),
    prisma.pricing.findMany(),
    prisma.livestock.findMany(),
    prisma.cashflow.findMany(),
    prisma.geocodeCache.findMany(),
    prisma.entry.findMany(),
    prisma.entryItem.findMany(),
    prisma.entryRequest.findMany(),
    prisma.delivery.findMany(),
    prisma.driverAvailability.findMany(),
    prisma.entryEditRequest.findMany(),
    prisma.auditLog.findMany(),
  ]);

  const tables: Record<string, unknown[]> = {
    appConfig, profile, pricing, livestock, cashflow, geocodeCache,
    entry, entryItem, entryRequest, delivery, driverAvailability,
    entryEditRequest, auditLog,
  };

  const counts: Record<string, number> = {};
  for (const [k, v] of Object.entries(tables)) counts[k] = v.length;

  return {
    version: EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
    counts,
    tables,
  };
}
