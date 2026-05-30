'use server';

import { prisma } from '@/lib/prisma';
import { requireAuth, requireRole, isAdminRole } from '@/lib/auth';
import { revalidatePath } from 'next/cache';
import { logAudit } from '@/lib/audit';
import { solveTSP } from '@/lib/delivery/tsp';
import { splitToDrivers } from '@/lib/delivery/split';
import { resolveLocation } from '@/lib/delivery/geocode';
import { parseLatLngCoord } from '@/lib/delivery/geo';
import { getDefaultDepot } from '@/lib/delivery/depot';
import { generateInvoiceNo } from '@/lib/format';

const DEFAULT_DEPOT = {
  id: 'DEPOT',
  ...getDefaultDepot(),
};


function parseDateOnly(input: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input)) return null;
  const d = new Date(input + 'T00:00:00Z');
  return isNaN(d.getTime()) ? null : d;
}

export async function assignDeliveryDate(
  entryIds: string[],
  deliveryDate: string,
) {
  const admin = await requireRole('ADMIN', 'SUPER_ADMIN');
  if (entryIds.length === 0) return { error: 'Pilih minimal satu entry' };
  const date = parseDateOnly(deliveryDate);
  if (!date) return { error: 'Tanggal tidak valid' };

  await prisma.$transaction([
    prisma.entry.updateMany({
      where: { id: { in: entryIds }, status: 'APPROVED' },
      data: { deliveryDate: date },
    }),
    prisma.delivery.createMany({
      data: entryIds.map((entryId) => ({ entryId, status: 'PENDING' })),
      skipDuplicates: true,
    }),
  ]);

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
  const admin = await requireRole('ADMIN', 'SUPER_ADMIN');
  if (entryIds.length === 0) return { error: 'Pilih minimal satu entry' };

  const inFlight = await prisma.delivery.findMany({
    where: {
      entryId: { in: entryIds },
      status: { in: ['ON_DELIVERY', 'DELIVERED'] },
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
        status: { in: ['PENDING', 'ASSIGNED', 'FAILED'] },
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
 * Admin force-remove entries from their route regardless of status, except DELIVERED.
 * Allows ON_DELIVERY ("on the way") to be pulled off a running route. Resets item
 * loadedAt so the entry can be re-scheduled cleanly later.
 */
export async function forceUnassignDeliveryDate(entryIds: string[]) {
  const admin = await requireRole('ADMIN', 'SUPER_ADMIN');
  if (entryIds.length === 0) return { error: 'Pilih minimal satu entry' };

  const delivered = await prisma.delivery.findMany({
    where: { entryId: { in: entryIds }, status: 'DELIVERED' },
    select: { entryId: true },
  });
  if (delivered.length > 0) {
    return { error: `Tidak bisa dihapus — ${delivered.length} sudah DELIVERED` };
  }

  // Capture which driver routes these entries belong to (before removal) so we
  // can re-optimize each affected route once the stops are gone.
  const affectedRows = await prisma.delivery.findMany({
    where: { entryId: { in: entryIds }, driverId: { not: null } },
    select: { driverId: true, entry: { select: { deliveryDate: true } } },
  });
  const affected = new Map<string, { driverId: string; date: Date }>();
  for (const r of affectedRows) {
    if (r.driverId && r.entry.deliveryDate) {
      affected.set(`${r.driverId}|${r.entry.deliveryDate.toISOString()}`, {
        driverId: r.driverId,
        date: r.entry.deliveryDate,
      });
    }
  }

  await prisma.$transaction(async (tx) => {
    // Reset loadedAt so items can be re-scheduled cleanly later
    await tx.entryItem.updateMany({
      where: { entryId: { in: entryIds } },
      data: { loadedAt: null, loadedBy: null },
    });
    await tx.delivery.deleteMany({
      where: {
        entryId: { in: entryIds },
        status: { in: ['PENDING', 'ASSIGNED', 'ON_DELIVERY', 'FAILED'] },
      },
    });
    await tx.entry.updateMany({
      where: { id: { in: entryIds } },
      data: { deliveryDate: null },
    });
  });

  // Re-optimize every route that lost a stop (best-effort; skip empty / no-coords).
  for (const { driverId, date } of affected.values()) {
    await reoptimizeDriverRoute(driverId, date);
  }

  await logAudit({
    actor: admin,
    action: 'UPDATE',
    entity: 'Entry',
    entityId: entryIds.join(','),
    label: `Force unassign ${entryIds.length} entry (admin hapus dari rute)`,
    after: { deliveryDate: null, count: entryIds.length, force: true, recalculated: affected.size },
  });

  revalidatePath('/admin/deliveries');
  revalidatePath('/driver');
  return { success: true as const, count: entryIds.length };
}

export async function resetRoutes(deliveryDate: string) {
  const admin = await requireRole('ADMIN', 'SUPER_ADMIN');
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

export async function clearSchedule(deliveryDate: string) {
  const admin = await requireRole('ADMIN', 'SUPER_ADMIN');
  const date = parseDateOnly(deliveryDate);
  if (!date) return { error: 'Tanggal tidak valid' };

  const inFlight = await prisma.delivery.count({
    where: {
      entry: { deliveryDate: date },
      status: { in: ['ON_DELIVERY', 'DELIVERED'] },
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
        status: { in: ['PENDING', 'ASSIGNED', 'FAILED'] },
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

export async function generateRoutes(
  deliveryDate: string,
  entryIds: string[],
  driverCount: number,
  startInput?: string,
  maxPerDriver = 30,
) {
  const admin = await requireRole('ADMIN', 'SUPER_ADMIN');
  const date = parseDateOnly(deliveryDate);
  if (!date) return { error: 'Tanggal tidak valid' };
  if (!entryIds.length) return { error: 'Pilih entry untuk dirutekan' };
  if (driverCount <= 0) return { error: 'driverCount harus > 0' };

  let depot = { ...DEFAULT_DEPOT };
  if (startInput && startInput.trim()) {
    const trimmed = startInput.trim();
    const direct = parseLatLngCoord(trimmed);
    if (direct) {
      depot = { id: 'DEPOT', ...direct };
    } else {
      const resolved = await resolveLocation(trimmed);
      if (!resolved) {
        return {
          error:
            'Titik awal tidak bisa diparse (gunakan lat,lng atau Maps URL)',
        };
      }
      depot = { id: 'DEPOT', lat: resolved.lat, lng: resolved.lng };
    }
  }

  if (
    !isFinite(depot.lat) ||
    !isFinite(depot.lng) ||
    (depot.lat === 0 && depot.lng === 0)
  ) {
    return {
      error:
        'Titik awal belum diset (tambahkan FARM_LAT/FARM_LNG atau isi input titik awal)',
    };
  }

  const entries = await prisma.entry.findMany({
    where: {
      id: { in: entryIds },
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

  const buckets = splitToDrivers(depot, points, driverCount, maxPerDriver);
  const routes = buckets.map((b) => solveTSP(depot, b));

  const assignments: { entryId: string; sequence: number }[] = [];
  routes.forEach((route) => {
    route.forEach((p, seq) => {
      assignments.push({ entryId: p.id, sequence: seq });
    });
  });

  await prisma.$transaction(async (tx) => {
    await Promise.all(
      assignments.map((a) =>
        tx.delivery.upsert({
          where: { entryId: a.entryId },
          create: { entryId: a.entryId, sequence: a.sequence, status: 'PENDING' },
          update: { sequence: a.sequence, status: 'PENDING', driverId: null },
        }),
      ),
    );
  });

  await logAudit({
    actor: admin,
    action: 'UPDATE',
    entity: 'Delivery',
    entityId: deliveryDate,
    label: `Generate routes batch ${deliveryDate} (${routes.length} buckets, ${entries.length} stops)`,
    after: { buckets: routes.map((r) => r.length) },
  });

  revalidatePath('/admin/deliveries');
  return {
    success: true as const,
    buckets: routes.map((r) => r.map((p) => p.id)),
    depot: { lat: depot.lat, lng: depot.lng },
  };
}

export async function assignDriversToBuckets(
  deliveryDate: string,
  buckets: { driverId: string; entryIds: string[] }[],
) {
  const admin = await requireRole('ADMIN', 'SUPER_ADMIN');
  const date = parseDateOnly(deliveryDate);
  if (!date) return { error: 'Tanggal tidak valid' };

  // FIX: DriverAvailability query removed because drivers are available by default

  // One batch per driver per day: reject drivers who already hold an active route today
  const driverIds = buckets.map((b) => b.driverId);
  const clash = await prisma.delivery.findMany({
    where: {
      entry: { deliveryDate: date },
      driverId: { in: driverIds },
      status: { notIn: ['DELIVERED', 'FAILED'] },
    },
    select: { driverId: true },
  });
  if (clash.length) {
    return { error: 'Driver sudah punya rute hari ini — pilih driver lain' };
  }

  await prisma.$transaction(async (tx) => {
    await Promise.all(
      buckets.flatMap((b) =>
        b.entryIds.map((entryId) =>
          tx.delivery.update({
            where: { entryId },
            data: { driverId: b.driverId, status: 'ASSIGNED' },
          }),
        ),
      ),
    );
  });

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

/**
 * Build a route by hand: assign the given entries to one driver in the EXACT
 * order provided (sequence = array index), no k-means split, no TSP. Entries
 * must be APPROVED with coordinates; the driver must not already hold a route
 * that day. Stops are created/updated as ASSIGNED.
 */
export async function createManualRoute(
  deliveryDate: string,
  driverId: string,
  orderedEntryIds: string[],
) {
  const admin = await requireRole('ADMIN', 'SUPER_ADMIN');
  const date = parseDateOnly(deliveryDate);
  if (!date) return { error: 'Tanggal tidak valid' };
  if (!driverId) return { error: 'Pilih driver' };
  if (!orderedEntryIds.length) return { error: 'Rute kosong — pilih minimal satu entry' };

  // One batch per driver per day
  const clash = await prisma.delivery.count({
    where: {
      driverId,
      entry: { deliveryDate: date },
      status: { notIn: ['DELIVERED', 'FAILED'] },
    },
  });
  if (clash) return { error: 'Driver sudah punya rute hari ini — pilih driver lain' };

  const entries = await prisma.entry.findMany({
    where: { id: { in: orderedEntryIds }, status: 'APPROVED' },
    select: { id: true, buyerLat: true, buyerLng: true },
  });
  if (entries.length !== orderedEntryIds.length) return { error: 'Sebagian entry tidak valid' };
  if (entries.some((e) => e.buyerLat == null || e.buyerLng == null)) {
    return { error: 'Ada entry tanpa koordinat — Backfill dulu' };
  }

  await prisma.$transaction(async (tx) => {
    for (let i = 0; i < orderedEntryIds.length; i++) {
      const entryId = orderedEntryIds[i];
      await tx.entry.update({ where: { id: entryId }, data: { deliveryDate: date } });
      await tx.delivery.upsert({
        where: { entryId },
        create: { entryId, driverId, sequence: i, status: 'ASSIGNED' },
        update: { driverId, sequence: i, status: 'ASSIGNED' },
      });
    }
  });

  await logAudit({
    actor: admin,
    action: 'UPDATE',
    entity: 'Delivery',
    entityId: deliveryDate,
    label: `Rute manual ${deliveryDate} — driver, ${orderedEntryIds.length} stop`,
    after: { driverId, stops: orderedEntryIds.length, manual: true },
  });

  revalidatePath('/admin/deliveries');
  revalidatePath('/driver');
  return { success: true as const };
}

export async function unassignDriver(deliveryIds: string[]) {
  await requireRole('ADMIN', 'SUPER_ADMIN');
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
  if (!isAdminRole(profile.role) && delivery.driverId !== profile.id) {
    return { error: 'Bukan delivery Anda' as const };
  }
  return { profile, delivery } as const;
}

export async function toggleItemLoaded(itemId: string, loaded: boolean) {
  const profile = await requireAuth();

  const item = await prisma.entryItem.findUnique({
    where: { id: itemId },
    include: {
      entry: {
        select: {
          invoiceNo: true,
          delivery: { select: { driverId: true, status: true } },
        },
      },
      livestock: { select: { tag: true, sku: true } },
    },
  });
  if (!item) return { error: 'Item tidak ditemukan' };

  const delivery = item.entry.delivery;
  if (!delivery) return { error: 'Delivery tidak ditemukan' };
  if (delivery.status !== 'ASSIGNED') return { error: 'Tidak bisa ubah checklist setelah perjalanan dimulai' };

  const isAdmin = isAdminRole(profile.role);
  if (!isAdmin && delivery.driverId !== profile.id) return { error: 'Bukan delivery Anda' };

  await prisma.entryItem.update({
    where: { id: itemId },
    data: {
      loadedAt: loaded ? new Date() : null,
      loadedBy: loaded ? profile.id : null,
    },
  });

  const tag = item.livestock?.tag ?? item.livestock?.sku ?? itemId;
  await logAudit({
    actor: profile,
    action: 'UPDATE',
    entity: 'Entry',
    entityId: item.entry.invoiceNo,
    label: `${item.entry.invoiceNo} — ${tag} ${loaded ? 'dimuat' : 'batal muat'}`,
    after: { loaded },
  });

  revalidatePath('/driver');
  revalidatePath('/admin/deliveries');
  return { success: true };
}

export async function bulkToggleItemsLoaded(deliveryId: string, loaded: boolean) {
  const profile = await requireAuth();

  const delivery = await prisma.delivery.findUnique({
    where: { id: deliveryId },
    select: { driverId: true, status: true, entryId: true },
  });
  if (!delivery) return { error: 'Delivery tidak ditemukan' };
  if (delivery.status !== 'ASSIGNED') return { error: 'Tidak bisa ubah checklist setelah perjalanan dimulai' };

  const isAdmin = isAdminRole(profile.role);
  if (!isAdmin && delivery.driverId !== profile.id) return { error: 'Bukan delivery Anda' };

  await prisma.entryItem.updateMany({
    where: { entryId: delivery.entryId },
    data: {
      loadedAt: loaded ? new Date() : null,
      loadedBy: loaded ? profile.id : null,
    },
  });

  revalidatePath('/driver');
  revalidatePath('/admin/deliveries');
  return { success: true };
}

async function executeStartRun(
  driverId: string,
  date: Date,
  actor: { id: string; name: string },
) {
  const deliveries = await prisma.delivery.findMany({
    where: {
      driverId,
      status: 'ASSIGNED',
      entry: { deliveryDate: date },
    },
    include: {
      entry: {
        select: {
          id: true,
          invoiceNo: true,
          salesId: true,
          pengiriman: true,
          buyerName: true,
          buyerPhone: true,
          buyerAddress: true,
          buyerMaps: true,
          buyerLat: true,
          buyerLng: true,
          notes: true,
          items: { select: { id: true, loadedAt: true, hargaJual: true, hargaModal: true, resellerCut: true, hpp: true, profit: true, livestockId: true } },
        },
      },
    },
  });

  if (deliveries.length === 0) return { error: 'Tidak ada delivery untuk dimulai' };

  const totalItems = deliveries.flatMap((d) => d.entry.items).length;
  const totalLoaded = deliveries.flatMap((d) => d.entry.items).filter((i) => i.loadedAt).length;
  if (totalLoaded === 0) return { error: 'Tidak ada hewan yang dimuat. Centang minimal satu hewan.' };

  let fullLoad = 0;
  let partialLoad = 0;
  let skipped = 0;
  let splitEntries = 0;

  await prisma.$transaction(async (tx) => {
    for (const delivery of deliveries) {
      const items = delivery.entry.items;
      const loadedItems = items.filter((i) => i.loadedAt);
      const unloadedItems = items.filter((i) => !i.loadedAt);

      if (loadedItems.length === items.length) {
        // All loaded — flip to ON_DELIVERY
        await tx.delivery.update({ where: { id: delivery.id }, data: { status: 'ON_DELIVERY' } });
        fullLoad++;
      } else if (loadedItems.length > 0) {
        // Partial — split unloaded items into new entry
        const newEntry = await tx.entry.create({
          data: {
            invoiceNo: generateInvoiceNo(),
            status: 'APPROVED',
            salesId: delivery.entry.salesId,
            buyerName: delivery.entry.buyerName,
            buyerPhone: delivery.entry.buyerPhone,
            buyerAddress: delivery.entry.buyerAddress,
            buyerMaps: delivery.entry.buyerMaps,
            buyerLat: delivery.entry.buyerLat,
            buyerLng: delivery.entry.buyerLng,
            pengiriman: delivery.entry.pengiriman,
            notes: `Sisa muatan dari ${delivery.entry.invoiceNo}${delivery.entry.notes ? `. ${delivery.entry.notes}` : ''}`,
            deliveryDate: null,
          },
        });
        await tx.entryItem.updateMany({
          where: { id: { in: unloadedItems.map((i) => i.id) } },
          data: { entryId: newEntry.id, loadedAt: null, loadedBy: null },
        });
        await tx.delivery.update({ where: { id: delivery.id }, data: { status: 'ON_DELIVERY' } });
        partialLoad++;
        splitEntries++;
      } else {
        // Nothing loaded — unschedule the whole entry
        await tx.delivery.delete({ where: { id: delivery.id } });
        await tx.entry.update({ where: { id: delivery.entry.id }, data: { deliveryDate: null } });
        skipped++;
      }
    }
  });

  await logAudit({
    actor,
    action: 'UPDATE',
    entity: 'Delivery',
    entityId: date.toISOString().slice(0, 10),
    label: `Start delivery run ${date.toISOString().slice(0, 10)} — ${actor.name}`,
    after: { assigned: deliveries.length, totalItems, totalLoaded, fullLoad, partialLoad, skipped, splitEntries },
  });

  revalidatePath('/driver');
  revalidatePath('/admin/deliveries');
  revalidatePath('/admin/entries');
  return { success: true, skipped, splitEntries };
}

/** Driver starts their own run. */
export async function startDeliveryRun(deliveryDate: string) {
  const profile = await requireAuth();
  if (profile.role !== 'DRIVER') return { error: 'Hanya driver' };
  const date = parseDateOnly(deliveryDate);
  if (!date) return { error: 'Tanggal tidak valid' };
  return executeStartRun(profile.id, date, profile);
}

/** Admin starts a specific driver's run from the admin delivery page. */
export async function startDeliveryRunForDriver(driverId: string, deliveryDate: string) {
  const admin = await requireRole('ADMIN', 'SUPER_ADMIN');
  const date = parseDateOnly(deliveryDate);
  if (!date) return { error: 'Tanggal tidak valid' };
  return executeStartRun(driverId, date, admin);
}

/** Mark every item of a driver's ASSIGNED stops (for a date) loaded/unloaded — admin "check all". */
export async function bulkToggleItemsForDriver(
  driverId: string,
  deliveryDate: string,
  loaded: boolean,
) {
  const profile = await requireAuth();
  const isAdmin = isAdminRole(profile.role);
  if (!isAdmin && driverId !== profile.id) return { error: 'Bukan delivery Anda' };
  const date = parseDateOnly(deliveryDate);
  if (!date) return { error: 'Tanggal tidak valid' };

  await prisma.entryItem.updateMany({
    where: {
      entry: { deliveryDate: date, delivery: { driverId, status: 'ASSIGNED' } },
    },
    data: {
      loadedAt: loaded ? new Date() : null,
      loadedBy: loaded ? profile.id : null,
    },
  });

  await logAudit({
    actor: profile,
    action: 'UPDATE',
    entity: 'Delivery',
    entityId: driverId,
    label: `${loaded ? 'Muat' : 'Batal muat'} semua hewan rute driver ${deliveryDate}`,
  });
  revalidatePath('/driver');
  revalidatePath('/admin/deliveries');
  return { success: true as const };
}

export async function markDelivered(deliveryId: string, notes?: string, proofPhotoUrl?: string) {
  const result = await requireDriverOwnership(deliveryId);
  if ('error' in result) return result;
  const { profile, delivery } = result;

  const [updated] = await prisma.$transaction([
    prisma.delivery.update({
      where: { id: deliveryId },
      data: {
        status: 'DELIVERED',
        deliveredAt: new Date(),
        notes: notes ?? delivery.notes,
        ...(proofPhotoUrl ? { proofPhotoUrl } : {}),
      },
    }),
    prisma.entry.update({
      where: { id: delivery.entryId },
      data: { isSent: true },
    }),
  ]);

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
  revalidatePath('/admin/entries');
  revalidatePath('/sales');
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
 * Edit proof photo / notes of an already-recorded delivery without changing
 * its status or deliveredAt. Admin (or owning driver) only.
 */
export async function updateDeliveryNotesProof(
  deliveryId: string,
  notes?: string,
  proofPhotoUrl?: string,
) {
  const result = await requireDriverOwnership(deliveryId);
  if ('error' in result) return result;
  const { profile, delivery } = result;

  await prisma.delivery.update({
    where: { id: deliveryId },
    data: {
      notes: notes ?? delivery.notes,
      ...(proofPhotoUrl ? { proofPhotoUrl } : {}),
    },
  });

  await logAudit({
    actor: profile,
    action: 'UPDATE',
    entity: 'Delivery',
    entityId: deliveryId,
    label: `${delivery.entry.invoiceNo} — edit bukti/catatan`,
    before: { notes: delivery.notes },
    after: { notes: notes ?? delivery.notes },
  });

  revalidatePath('/driver');
  revalidatePath('/admin/deliveries');
  revalidatePath('/sales');
  return { success: true };
}

export async function updateEntryCoordinates(
  entryId: string,
  lat: number | null,
  lng: number | null,
) {
  await requireRole('ADMIN', 'SUPER_ADMIN');
  if (lat !== null && (lat < -90 || lat > 90))
    return { error: 'Latitude tidak valid' };
  if (lng !== null && (lng < -180 || lng > 180))
    return { error: 'Longitude tidak valid' };

  await prisma.entry.update({
    where: { id: entryId },
    data: { buyerLat: lat, buyerLng: lng },
  });

  revalidatePath('/admin/deliveries');
  return { success: true as const };
}

export async function backfillCoordinates(entryIds?: string[]) {
  await requireRole('ADMIN', 'SUPER_ADMIN');

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
  const CONCURRENCY = 5;
  for (let i = 0; i < entries.length; i += CONCURRENCY) {
    const batch = entries.slice(i, i + CONCURRENCY);
    await Promise.all(
      batch.map(async (e) => {
        const input = e.buyerMaps || e.buyerAddress || '';
        const loc = await resolveLocation(input);
        if (loc) {
          await prisma.entry.update({ where: { id: e.id }, data: { buyerLat: loc.lat, buyerLng: loc.lng } });
          resolved++;
        } else {
          failed++;
        }
      }),
    );
  }

  revalidatePath('/admin/deliveries');
  return { success: true, resolved, failed, total: entries.length };
}

// ── Per-driver single-route ops ──────────────────────────────────────────────

/**
 * Re-optimize ONE driver's route in place (TSP). Other drivers untouched.
 * DELIVERED/FAILED stops are pinned at the front by their current order;
 * only ASSIGNED stops are re-sequenced. Blocked if the route is ON_DELIVERY.
 */
/**
 * Re-optimize a driver's route for a date (TSP from depot). Works on idle AND
 * running routes: DELIVERED/FAILED stops stay fixed at the front (in their
 * existing order), while every not-yet-finished stop (ASSIGNED + ON_DELIVERY)
 * is re-sequenced. Only `sequence` changes — statuses are untouched.
 * Internal core: no auth, no revalidate (caller handles those).
 */
async function reoptimizeDriverRoute(driverId: string, date: Date) {
  const rows = await prisma.delivery.findMany({
    where: { driverId, entry: { deliveryDate: date } },
    select: {
      id: true,
      status: true,
      sequence: true,
      entry: { select: { buyerLat: true, buyerLng: true } },
    },
  });
  if (!rows.length) return { skipped: 'empty' as const };

  const done = rows
    .filter((r) => r.status === 'DELIVERED' || r.status === 'FAILED')
    .sort((a, b) => (a.sequence ?? 0) - (b.sequence ?? 0));
  const remaining = rows
    .filter((r) => r.status === 'ASSIGNED' || r.status === 'ON_DELIVERY')
    .sort((a, b) => (a.sequence ?? 0) - (b.sequence ?? 0));

  if (remaining.some((r) => r.entry.buyerLat == null || r.entry.buyerLng == null)) {
    return { error: 'Ada stop tanpa koordinat — Backfill dulu' as const };
  }

  const depot = { id: 'DEPOT', ...getDefaultDepot() };
  const ordered = remaining.length
    ? solveTSP(
        depot,
        remaining.map((r) => ({ id: r.id, lat: r.entry.buyerLat!, lng: r.entry.buyerLng! })),
      )
    : [];

  await prisma.$transaction([
    ...done.map((r, i) =>
      prisma.delivery.update({ where: { id: r.id }, data: { sequence: i } }),
    ),
    ...ordered.map((p, i) =>
      prisma.delivery.update({ where: { id: p.id }, data: { sequence: done.length + i } }),
    ),
  ]);

  return { success: true as const, stops: rows.length };
}

export async function recalculateDriverRoute(driverId: string, deliveryDate: string) {
  const admin = await requireRole('ADMIN', 'SUPER_ADMIN');
  const date = parseDateOnly(deliveryDate);
  if (!date) return { error: 'Tanggal tidak valid' };

  const res = await reoptimizeDriverRoute(driverId, date);
  if ('skipped' in res) return { error: 'Rute kosong' };
  if ('error' in res) return res;

  await logAudit({
    actor: admin,
    action: 'UPDATE',
    entity: 'Delivery',
    entityId: driverId,
    label: `Hitung ulang rute driver ${deliveryDate}`,
    after: { stops: res.stops },
  });
  revalidatePath('/admin/deliveries');
  revalidatePath('/driver');
  return { success: true as const };
}

/**
 * Attach left-behind entries to a driver's route, then re-optimize. Works on
 * idle AND running routes — if the route is already running (ON_DELIVERY), new
 * stops join as ON_DELIVERY so the driver can still deliver them; otherwise
 * they're ASSIGNED. Entries must be APPROVED and have coordinates.
 */
export async function addEntriesToDriverRoute(
  driverId: string,
  deliveryDate: string,
  entryIds: string[],
) {
  const admin = await requireRole('ADMIN', 'SUPER_ADMIN');
  const date = parseDateOnly(deliveryDate);
  if (!date) return { error: 'Tanggal tidak valid' };
  if (!entryIds.length) return { error: 'Pilih entry' };

  const running = await prisma.delivery.count({
    where: { driverId, entry: { deliveryDate: date }, status: 'ON_DELIVERY' },
  });
  const newStatus = running > 0 ? 'ON_DELIVERY' : 'ASSIGNED';

  const entries = await prisma.entry.findMany({
    where: { id: { in: entryIds }, status: 'APPROVED' },
    select: { id: true, buyerLat: true, buyerLng: true },
  });
  if (entries.length !== entryIds.length) return { error: 'Sebagian entry tidak valid' };
  if (entries.some((e) => e.buyerLat == null || e.buyerLng == null)) {
    return { error: 'Ada entry tanpa koordinat — Backfill dulu' };
  }

  await prisma.$transaction(async (tx) => {
    for (const e of entries) {
      await tx.entry.update({ where: { id: e.id }, data: { deliveryDate: date } });
      await tx.delivery.upsert({
        where: { entryId: e.id },
        create: { entryId: e.id, driverId, status: newStatus },
        update: { driverId, status: newStatus },
      });
    }
  });

  await logAudit({
    actor: admin,
    action: 'UPDATE',
    entity: 'Delivery',
    entityId: driverId,
    label: `Tambah ${entries.length} entry ke rute driver ${deliveryDate}`,
    after: { entryIds },
  });

  // re-optimize this driver's route (also revalidates)
  return recalculateDriverRoute(driverId, deliveryDate);
}

/**
 * Un-start a driver's route: flip ON_DELIVERY back to ASSIGNED so admin can
 * edit/recalc it. DELIVERED/FAILED stops and driver assignment are untouched.
 */
export async function resetDriverRoute(driverId: string, deliveryDate: string) {
  const admin = await requireRole('ADMIN', 'SUPER_ADMIN');
  const date = parseDateOnly(deliveryDate);
  if (!date) return { error: 'Tanggal tidak valid' };

  const res = await prisma.delivery.updateMany({
    where: { driverId, entry: { deliveryDate: date }, status: 'ON_DELIVERY' },
    data: { status: 'ASSIGNED' },
  });

  await logAudit({
    actor: admin,
    action: 'UPDATE',
    entity: 'Delivery',
    entityId: driverId,
    label: `Reset (un-start) rute driver ${deliveryDate}`,
    after: { count: res.count },
  });
  revalidatePath('/admin/deliveries');
  return { success: true as const, count: res.count };
}
