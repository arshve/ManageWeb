'use server';

import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/auth';
import { revalidatePath } from 'next/cache';
import { logAudit } from '@/lib/audit';

function parseDateOnly(input: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input)) return null;
  const d = new Date(input + 'T00:00:00Z');
  return isNaN(d.getTime()) ? null : d;
}

export async function setDriverAvailability(
  driverIds: string[],
  deliveryDate: string,
  isActive: boolean,
) {
  const admin = await requireRole('ADMIN', 'SUPER_ADMIN');
  const date = parseDateOnly(deliveryDate);
  if (!date) return { error: 'Tanggal tidak valid' };

  await prisma.$transaction(
    driverIds.map((driverId) =>
      prisma.driverAvailability.upsert({
        where: { driverId_date: { driverId, date } },
        create: { driverId, date, isActive },
        update: { isActive },
      }),
    ),
  );

  await logAudit({
    actor: admin,
    action: 'UPDATE',
    entity: 'DriverAvailability',
    entityId: deliveryDate,
    label: `Availability ${deliveryDate} (${driverIds.length} drivers, ${isActive ? 'on' : 'off'})`,
    after: { driverIds, isActive },
  });

  revalidatePath('/admin/deliveries');
  return { success: true };
}

export async function listAvailableDrivers(deliveryDate: string) {
  await requireRole('ADMIN', 'SUPER_ADMIN');
  const date = parseDateOnly(deliveryDate);
  if (!date) return [];
  return prisma.profile.findMany({
    where: {
      role: 'DRIVER',
      isActive: true,
      availability: { some: { date, isActive: true } },
    },
    select: { id: true, name: true, phone: true, vehiclePlate: true },
    orderBy: { name: 'asc' },
  });
}
