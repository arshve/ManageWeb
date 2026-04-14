'use server';

import { prisma } from '@/lib/prisma';
import { requireAuth, requireRole } from '@/lib/auth';
import { revalidatePath } from 'next/cache';
import { logAudit } from '@/lib/audit';
import { solveTSP } from '@/lib/delivery/tsp';
import { splitToDrivers } from '@/lib/delivery/split';
import { resolveLocation } from '@/lib/delivery/geocode';
import { getDefaultDepot } from '@/lib/delivery/depot';

const DEFAULT_DEPOT = {
  id: 'DEPOT',
  ...getDefaultDepot(),
};

function parseLatLngString(input: string): { lat: number; lng: number } | null {
  const m = input.trim().match(/^(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)$/);
  if (!m) return null;
  const lat = Number(m[1]);
  const lng = Number(m[2]);
  if (!isFinite(lat) || !isFinite(lng)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return { lat, lng };
}

function parseDateOnly(input: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input)) return null;
  const d = new Date(input + 'T00:00:00Z');
  return isNaN(d.getTime()) ? null : d;
}

/**
 * Bulk-assign a delivery date to a set of approved entries.
 * Creates (or keeps) a PENDING Delivery row for each so routing has something to work on.
 */
export async function assignDeliveryDate(
  entryIds: string[],
  deliveryDate: string,
) {
  const admin = await requireRole('ADMIN');
  if (entryIds.length === 0) return { error: 'Pilih minimal satu entry' };
  const date = parseDateOnly(deliveryDate);
  if (!date) return { error: 'Tanggal tidak valid' };

  await prisma.$transaction(async (tx) => {
    await tx.entry.updateMany({
      where: { id: { in: entryIds }, status: 'APPROVED' },
      data: { deliveryDate: date },
    });
    for (const entryId of entryIds) {
      await tx.delivery.upsert({
        where: { entryId },
        create: { entryId, status: 'PENDING' },
        update: {},
      });
    }
  });

  await logAudit({
    actor: admin,
    action: 'UPDATE',
    entity: 'Entry',
    entityId: entryIds.join(','),
    label: `Assign delivery ${deliveryDate} (${entryIds.length} entries)`,
    after: { deliveryDate, count: entryIds.length },
  });

  revalidatePath('/admin');
  revalidatePath('/admin/deliveries');
  return { success: true, count: entryIds.length };
}

export async function unassignDeliveryDate(entryIds: string[]) {
  const admin = await requireRole('ADMIN');
  if (entryIds.length === 0) return { error: 'Pilih minimal satu entry' };

  const inFlight = await prisma.delivery.findMany({
    where: {
      entryId: { in: entryIds },
      status: { in: ['ON_DELIVERY', 'DELIVERED', 'FAILED'] },
    },
    select: { entryId: true, status: true },
  });
  if (inFlight.length > 0) {
    return {
      error: `Tidak bisa dilepas — ${inFlight.length} delivery sudah berjalan/selesai`,
    };
  }

  await prisma.$transaction(async (tx) => {
    await tx.delivery.deleteMany({
      where: {
        entryId: { in: entryIds },
        status: { in: ['PENDING', 'ASSIGNED'] },
      },
    });
    await tx.entry.updateMany({
      where: { id: { in: entryIds } },
      data: { deliveryDate: null },
    });
  });

  await logAudit({
    actor: admin,
    action: 'UPDATE',
    entity: 'Entry',
    entityId: entryIds.join(','),
    label: `Unassign delivery (${entryIds.length} entries)`,
    after: { deliveryDate: null, count: entryIds.length },
  });

  revalidatePath('/admin/deliveries');
  return { success: true as const, count: entryIds.length };
}

/**
 * Clear driver + sequence for a date, keeping entries scheduled.
 * Only affects PENDING/ASSIGNED deliveries — in-flight/done are untouched.
 */
export async function resetRoutes(deliveryDate: string) {
  const admin = await requireRole('ADMIN');
  const date = parseDateOnly(deliveryDate);
  if (!date) return { error: 'Tanggal tidak valid' };

  const result = await prisma.delivery.updateMany({
    where: {
      entry: { deliveryDate: date },
      status: { in: ['PENDING', 'ASSIGNED'] },
    },
    data: { driverId: null, sequence: null, status: 'PENDING' },
  });

  await logAudit({
    actor: admin,
    action: 'UPDATE',
    entity: 'Delivery',
    entityId: deliveryDate,
    label: `Reset routes ${deliveryDate} (${result.count} deliveries)`,
    after: { count: result.count },
  });

  revalidatePath('/admin/deliveries');
  return { success: true as const, count: result.count };
}

/**
 * Unschedule every PENDING/ASSIGNED entry for a date.
 * Bulk version of unassignDeliveryDate. Refuses if any delivery is in-flight/done.
 */
export async function clearSchedule(deliveryDate: string) {
  const admin = await requireRole('ADMIN');
  const date = parseDateOnly(deliveryDate);
  if (!date) return { error: 'Tanggal tidak valid' };

  const inFlight = await prisma.delivery.count({
    where: {
      entry: { deliveryDate: date },
      status: { in: ['ON_DELIVERY', 'DELIVERED', 'FAILED'] },
    },
  });
  if (inFlight > 0) {
    return {
      error: `Tidak bisa dikosongkan — ${inFlight} delivery sudah berjalan/selesai`,
    };
  }

  const entries = await prisma.entry.findMany({
    where: { deliveryDate: date },
    select: { id: true },
  });
  const entryIds = entries.map((e) => e.id);

  await prisma.$transaction(async (tx) => {
    await tx.delivery.deleteMany({
      where: {
        entryId: { in: entryIds },
        status: { in: ['PENDING', 'ASSIGNED'] },
      },
    });
    await tx.entry.updateMany({
      where: { id: { in: entryIds } },
      data: { deliveryDate: null },
    });
  });

  await logAudit({
    actor: admin,
    action: 'UPDATE',
    entity: 'Entry',
    entityId: deliveryDate,
    label: `Clear schedule ${deliveryDate} (${entryIds.length} entries)`,
    after: { count: entryIds.length },
  });

  revalidatePath('/admin/deliveries');
  return { success: true as const, count: entryIds.length };
}

/**
 * Generate routes for a delivery date.
 * Splits scheduled entries across N driver buckets, runs TSP per bucket,
 * writes sequence onto Delivery rows. driverId is left for assignDriversToBuckets.
 */
export async function generateRoutes(
  deliveryDate: string,
  driverCount: number,
  startInput?: string,
) {
  const admin = await requireRole('ADMIN');
  const date = parseDateOnly(deliveryDate);
  if (!date) return { error: 'Tanggal tidak valid' };
  if (driverCount <= 0) return { error: 'driverCount harus > 0' };

  let depot = { ...DEFAULT_DEPOT };
  if (startInput && startInput.trim()) {
    const trimmed = startInput.trim();
    const direct = parseLatLngString(trimmed);
    if (direct) {
      depot = { id: 'DEPOT', ...direct };
    } else {
      const resolved = await resolveLocation(trimmed);
      if (!resolved) {
        return { error: 'Titik awal tidak bisa diparse (gunakan lat,lng atau Maps URL)' };
      }
      depot = { id: 'DEPOT', lat: resolved.lat, lng: resolved.lng };
    }
  }

  if (!isFinite(depot.lat) || !isFinite(depot.lng) || (depot.lat === 0 && depot.lng === 0)) {
    return { error: 'Titik awal belum diset (tambahkan FARM_LAT/FARM_LNG atau isi input titik awal)' };
  }

  const entries = await prisma.entry.findMany({
    where: {
      deliveryDate: date,
      status: 'APPROVED',
      buyerLat: { not: null },
      buyerLng: { not: null },
    },
    select: { id: true, buyerLat: true, buyerLng: true },
  });

  if (entries.length === 0) {
    return { error: 'Tidak ada entry siap dirutekan (cek koordinat dulu)' };
  }

  const points = entries.map((e) => ({
    id: e.id,
    lat: e.buyerLat!,
    lng: e.buyerLng!,
  }));

  const buckets = splitToDrivers(points, driverCount);
  const routes = buckets.map((b) => solveTSP(depot, b));

  const assignments: { entryId: string; sequence: number }[] = [];
  routes.forEach((route) => {
    route.forEach((p, seq) => {
      assignments.push({ entryId: p.id, sequence: seq });
    });
  });

  await prisma.$transaction(
    assignments.map((a) =>
      prisma.delivery.upsert({
        where: { entryId: a.entryId },
        create: {
          entryId: a.entryId,
          sequence: a.sequence,
          status: 'PENDING',
        },
        update: { sequence: a.sequence, status: 'PENDING', driverId: null },
      }),
    ),
  );

  await logAudit({
    actor: admin,
    action: 'UPDATE',
    entity: 'Delivery',
    entityId: deliveryDate,
    label: `Generate routes ${deliveryDate} (${routes.length} buckets, ${entries.length} stops)`,
    after: { buckets: routes.map((r) => r.length) },
  });

  revalidatePath('/admin/deliveries');
  return {
    success: true as const,
    buckets: routes.map((r) => r.map((p) => p.id)),
  };
}

/**
 * Attach driver_id to a set of deliveries.
 * Input: array of { driverId, entryIds[] } — one entry per bucket from generateRoutes.
 * Sequences are already set; this only writes driverId and flips status to ASSIGNED.
 */
export async function assignDriversToBuckets(
  deliveryDate: string,
  buckets: { driverId: string; entryIds: string[] }[],
) {
  const admin = await requireRole('ADMIN');
  const date = parseDateOnly(deliveryDate);
  if (!date) return { error: 'Tanggal tidak valid' };

  const driverIds = buckets.map((b) => b.driverId);
  const available = await prisma.driverAvailability.findMany({
    where: { date, isActive: true, driverId: { in: driverIds } },
    select: { driverId: true },
  });
  const availableSet = new Set(available.map((a) => a.driverId));
  const missing = driverIds.filter((id) => !availableSet.has(id));
  if (missing.length > 0) {
    return { error: `Driver belum di-set available: ${missing.join(', ')}` };
  }

  await prisma.$transaction(
    buckets.flatMap((b) =>
      b.entryIds.map((entryId) =>
        prisma.delivery.update({
          where: { entryId },
          data: { driverId: b.driverId, status: 'ASSIGNED' },
        }),
      ),
    ),
  );

  await logAudit({
    actor: admin,
    action: 'UPDATE',
    entity: 'Delivery',
    entityId: deliveryDate,
    label: `Assign drivers ${deliveryDate} (${buckets.length} buckets)`,
    after: {
      buckets: buckets.map((b) => ({
        driverId: b.driverId,
        count: b.entryIds.length,
      })),
    },
  });

  revalidatePath('/admin/deliveries');
  return { success: true };
}

export async function unassignDriver(deliveryIds: string[]) {
  await requireRole('ADMIN');
  await prisma.delivery.updateMany({
    where: { id: { in: deliveryIds }, status: { in: ['ASSIGNED', 'PENDING'] } },
    data: { driverId: null, status: 'PENDING' },
  });
  revalidatePath('/admin/deliveries');
  return { success: true };
}

async function requireDriverOwnership(deliveryId: string) {
  const profile = await requireAuth();
  const delivery = await prisma.delivery.findUnique({
    where: { id: deliveryId },
    include: { entry: { select: { invoiceNo: true } } },
  });
  if (!delivery) return { error: 'Delivery tidak ditemukan' as const };
  if (profile.role !== 'ADMIN' && delivery.driverId !== profile.id) {
    return { error: 'Bukan delivery Anda' as const };
  }
  return { profile, delivery } as const;
}

/** Driver taps "Mulai Rute" — flips all their ASSIGNED stops for the date to ON_DELIVERY. */
export async function startDeliveryRun(deliveryDate: string) {
  const profile = await requireAuth();
  if (profile.role !== 'DRIVER') return { error: 'Hanya driver' };
  const date = parseDateOnly(deliveryDate);
  if (!date) return { error: 'Tanggal tidak valid' };

  await prisma.delivery.updateMany({
    where: {
      driverId: profile.id,
      status: 'ASSIGNED',
      entry: { deliveryDate: date },
    },
    data: { status: 'ON_DELIVERY' },
  });

  revalidatePath('/driver');
  return { success: true };
}

export async function markDelivered(deliveryId: string, notes?: string) {
  const result = await requireDriverOwnership(deliveryId);
  if ('error' in result) return result;
  const { profile, delivery } = result;

  const updated = await prisma.delivery.update({
    where: { id: deliveryId },
    data: {
      status: 'DELIVERED',
      deliveredAt: new Date(),
      notes: notes ?? delivery.notes,
    },
  });

  await logAudit({
    actor: profile,
    action: 'UPDATE',
    entity: 'Delivery',
    entityId: deliveryId,
    label: `${delivery.entry.invoiceNo} — delivered`,
    before: { status: delivery.status },
    after: { status: updated.status, deliveredAt: updated.deliveredAt },
  });

  revalidatePath('/driver');
  revalidatePath('/admin/deliveries');
  return { success: true };
}

export async function markFailed(deliveryId: string, reason: string) {
  const result = await requireDriverOwnership(deliveryId);
  if ('error' in result) return result;
  const { profile, delivery } = result;

  await prisma.delivery.update({
    where: { id: deliveryId },
    data: { status: 'FAILED', notes: reason },
  });

  await logAudit({
    actor: profile,
    action: 'UPDATE',
    entity: 'Delivery',
    entityId: deliveryId,
    label: `${delivery.entry.invoiceNo} — failed: ${reason}`,
    before: { status: delivery.status },
    after: { status: 'FAILED' },
  });

  revalidatePath('/driver');
  revalidatePath('/admin/deliveries');
  return { success: true };
}

/**
 * Batch-backfill buyerLat/buyerLng for entries missing coords.
 * Uses URL parse → cache → Google (if GOOGLE_MAPS_API_KEY is set).
 * Idempotent — safe to re-run.
 */
export async function backfillCoordinates(entryIds?: string[]) {
  await requireRole('ADMIN');

  const entries = await prisma.entry.findMany({
    where: {
      ...(entryIds ? { id: { in: entryIds } } : {}),
      status: 'APPROVED',
      buyerLat: null,
    },
    select: {
      id: true,
      buyerMaps: true,
      buyerAddress: true,
    },
  });

  let resolved = 0;
  let failed = 0;
  for (const e of entries) {
    const input = e.buyerMaps || e.buyerAddress || '';
    const loc = await resolveLocation(input);
    if (loc) {
      await prisma.entry.update({
        where: { id: e.id },
        data: { buyerLat: loc.lat, buyerLng: loc.lng },
      });
      resolved++;
    } else {
      failed++;
    }
  }

  revalidatePath('/admin/deliveries');
  return { success: true, resolved, failed, total: entries.length };
}
