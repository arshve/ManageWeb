/**
 * Full-data import (wipe-and-replace). Clears every table then re-inserts the
 * export verbatim — a true restore/migrate for white-label tenant setup.
 * DESTRUCTIVE: callers must pass { confirm: true } and pass the safety guard.
 *
 * Runs in a single transaction: delete child → parent, then createMany
 * parent → child so foreign keys are always satisfied. Explicit ids are
 * preserved; bcrypt password hashes are restored as-is. AppConfig (branding)
 * IS included so a restore reproduces the full white-label setup.
 */

import { prisma } from '@/lib/prisma';
import type { ExportPayload } from './export';

// Deletion order = child → parent (reverse of insertion). appConfig is
// independent (no FKs) so its position is free.
const DELETE_ORDER = [
  'auditLog',
  'entryEditRequest',
  'delivery',
  'entryItem',
  'entryRequest',
  'entry',
  'driverAvailability',
  'livestock',
  'cashflow',
  'geocodeCache',
  'pricing',
  'profile',
  'appConfig',
] as const;

// Insertion order = parent → child.
const INSERT_ORDER = [
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

// Maps a table key to its Prisma delegate (createMany / deleteMany).
function delegate(tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0], key: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (tx as any)[key] as {
    deleteMany: (args?: unknown) => Promise<unknown>;
    createMany: (args: { data: unknown[]; skipDuplicates?: boolean }) => Promise<unknown>;
  };
}

export type ImportResult = { inserted: Record<string, number> };

export async function importAll(
  payload: ExportPayload,
  opts: { confirm: boolean },
): Promise<ImportResult> {
  if (!opts.confirm) throw new Error('Import requires explicit confirmation.');
  if (!payload || typeof payload !== 'object' || !payload.tables) {
    throw new Error('File tidak valid: struktur tables tidak ditemukan.');
  }

  const inserted: Record<string, number> = {};

  await prisma.$transaction(
    async (tx) => {
      // 1. wipe everything (child → parent)
      for (const key of DELETE_ORDER) {
        await delegate(tx, key).deleteMany({});
      }
      // 2. insert from payload (parent → child)
      for (const key of INSERT_ORDER) {
        const rows = (payload.tables[key] as unknown[]) ?? [];
        if (rows.length === 0) { inserted[key] = 0; continue; }
        await delegate(tx, key).createMany({ data: rows, skipDuplicates: true });
        inserted[key] = rows.length;
      }
    },
    { timeout: 120_000, maxWait: 120_000 },
  );

  return { inserted };
}

// "Business data" wipe — operational records only. KEEPS Profile (accounts),
// Pricing, AppConfig (branding), and GeocodeCache. Child → parent order.
const BUSINESS_DELETE_ORDER = [
  'auditLog',
  'entryEditRequest',
  'delivery',
  'entryItem',
  'entryRequest',
  'entry',
  'driverAvailability',
  'livestock',
  'cashflow',
] as const;

export type WipeResult = { deleted: Record<string, number> };

/**
 * Clear all business/operational data, preserving users, pricing, branding,
 * and the geocode cache. Destructive + irreversible; runs in one transaction.
 */
export async function wipeBusinessData(opts: { confirm: boolean }): Promise<WipeResult> {
  if (!opts.confirm) throw new Error('Wipe requires explicit confirmation.');
  const deleted: Record<string, number> = {};
  await prisma.$transaction(
    async (tx) => {
      for (const key of BUSINESS_DELETE_ORDER) {
        const res = (await delegate(tx, key).deleteMany({})) as { count: number };
        deleted[key] = res.count;
      }
    },
    { timeout: 120_000, maxWait: 120_000 },
  );
  return { deleted };
}

/** Refuse destructive import on a non-local DB unless explicitly allowed. */
export function importGuardError(): string | null {
  const url = process.env.DATABASE_URL ?? '';
  const isLocal = /localhost|127\.0\.0\.1/.test(url);
  if (!isLocal && process.env.ALLOW_REMOTE_IMPORT !== '1') {
    return 'Import diblokir: database bukan lokal. Set ALLOW_REMOTE_IMPORT=1 untuk mengizinkan restore ke database produksi.';
  }
  return null;
}
