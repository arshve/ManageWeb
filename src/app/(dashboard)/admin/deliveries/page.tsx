import { prisma } from '@/lib/prisma';
import { DashboardShell } from '@/components/dashboard/dashboard-shell';
import { DeliveriesAdminView } from '@/components/admin/deliveries-admin-view';
import type {
  MapStop,
  MapDriver,
} from '@/components/admin/delivery-map-loader';
import { getDefaultDepot } from '@/lib/delivery/depot';

type SearchParams = { date?: string };

function parseDateParam(input: string | undefined): Date {
  if (input && /^\d{4}-\d{2}-\d{2}$/.test(input)) {
    const d = new Date(input + 'T00:00:00Z');
    if (!Number.isNaN(d.getTime())) return d;
  }
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  return today;
}

export default async function AdminDeliveriesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const date = parseDateParam(params.date);
  const dateStr = date.toISOString().slice(0, 10);

  const [
    scheduledRaw,
    unscheduledRaw,
    drivers,
    assignedDeliveries,
  ] = await Promise.all([
    prisma.entry.findMany({
      where: {
        deliveryDate: date,
        status: 'APPROVED',
        buyerMaps: {
          not: null,
          notIn: [''],
        },
      },
      select: {
        id: true,
        invoiceNo: true,
        buyerName: true,
        buyerAddress: true,
        buyerPhone: true,
        buyerLat: true,
        buyerLng: true,
        buyerMaps: true,
        pengiriman: true,
        delivery: {
          select: {
            id: true,
            sequence: true,
            status: true,
            driverId: true,
            deliveredAt: true,
            notes: true,
            proofPhotoUrl: true,
            driver: { select: { id: true, name: true } },
          },
        },
        items: {
          select: {
            id: true,
            loadedAt: true,
            loadedBy: true,
            livestock: { select: { id: true, sku: true, type: true, grade: true, tag: true, photoUrl: true, condition: true, weightMin: true, weightMax: true } },
          },
        },
        sales: {
          select: {
            name: true,
          },
        },
      },
    }),
    prisma.entry.findMany({
      where: { deliveryDate: null, status: 'APPROVED' },
      select: {
        id: true,
        invoiceNo: true,
        buyerName: true,
        buyerAddress: true,
        items: {
          include: { livestock: { select: { id: true, sku: true, tag: true, type: true, grade: true, weightMin: true, weightMax: true } } },
        },
        buyerLat: true,
        buyerLng: true,
        pengiriman: true,
        sales: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.profile.findMany({
      where: { role: 'DRIVER', isActive: true },
      select: {
        id: true,
        name: true,
        phone: true,
        vehiclePlate: true,
        lastLat: true,
        lastLng: true,
        lastLocationAt: true,
      },
      orderBy: { name: 'asc' },
    }),
    // Drivers who are actively assigned to a delivery on this date
    prisma.delivery.findMany({
      where: {
        entry: { deliveryDate: date },
        driverId: { not: null },
        status: { notIn: ['DELIVERED', 'FAILED'] },
      },
      select: { driverId: true },
    }),
  ]);

  const assignedIds = new Set(assignedDeliveries.map((d) => d.driverId!));

  const scheduled = scheduledRaw.map((e) => ({
    id: e.id,
    invoiceNo: e.invoiceNo,
    buyerName: e.buyerName,
    buyerAddress: e.buyerAddress,
    buyerPhone: e.buyerPhone,
    sku: e.items[0]?.livestock?.sku,
    animalType: e.items[0]?.livestock?.type,
    animalGrade: e.items[0]?.livestock?.grade,
    items: e.items.map((i) => ({
      itemId: i.id,
      loadedAt: i.loadedAt?.toISOString() ?? null,
      sku: i.livestock?.sku,
      tag: i.livestock?.tag,
      type: i.livestock?.type,
      grade: i.livestock?.grade,
      photoUrl: i.livestock?.photoUrl ?? null,
      condition: i.livestock?.condition ?? null,
      weightMin: i.livestock?.weightMin ?? null,
      weightMax: i.livestock?.weightMax ?? null,
    })),
    salesName: e.sales?.name,
    buyerLat: e.buyerLat,
    buyerLng: e.buyerLng,
    buyerMaps: e.buyerMaps,
    pengiriman: e.pengiriman,
    delivery: e.delivery,
  }));

  const unscheduled = unscheduledRaw.map((e) => ({
    id: e.id,
    invoiceNo: e.invoiceNo,
    sku: e.items[0]?.livestock?.sku,
    items: e.items.map((i) => ({
      sku: i.livestock?.sku,
      tag: i.livestock?.tag,
      type: i.livestock?.type,
      grade: i.livestock?.grade,
      weightMin: i.livestock?.weightMin,
      weightMax: i.livestock?.weightMax,
    })),
    buyerName: e.buyerName,
    buyerAddress: e.buyerAddress,
    buyerLat: e.buyerLat,
    buyerLng: e.buyerLng,
    pengiriman: e.pengiriman,
    salesName: e.sales?.name ?? null,
    hasCoords: e.buyerLat != null && e.buyerLng != null,
  }));

  const driversForView = drivers.map((d) => ({
    id: d.id,
    name: d.name,
    phone: d.phone,
    vehiclePlate: d.vehiclePlate,
    isAvailable: !assignedIds.has(d.id),
    isAssigned: assignedIds.has(d.id),
    lastLat: d.lastLat,
    lastLng: d.lastLng,
    lastLocationAt: d.lastLocationAt?.toISOString() ?? null,
  }));

  const driversForMap: MapDriver[] = drivers.map((d) => ({
    id: d.id,
    name: d.name,
    lastLat: d.lastLat,
    lastLng: d.lastLng,
    lastLocationAt: d.lastLocationAt?.toISOString() ?? null,
  }));

  const mapStops: MapStop[] = scheduled
    .filter((e) => e.buyerLat != null && e.buyerLng != null)
    .map((e) => ({
      id: e.id,
      invoiceNo: e.invoiceNo,
      sku: e.sku,
      buyerName: e.buyerName,
      lat: e.buyerLat!,
      lng: e.buyerLng!,
      sequence: e.delivery?.sequence ?? null,
      status: e.delivery?.status ?? 'PENDING',
      driverId: e.delivery?.driverId ?? null,
      driverName: e.delivery?.driver?.name ?? null,
    }));

  const defaultDepot = getDefaultDepot();
  const defaultStart = `${defaultDepot.lat},${defaultDepot.lng}`;

  return (
    <DashboardShell
      title="Delivery"
      description={`Jadwal & rute pengiriman — ${dateStr}`}
    >
      <div className="grid gap-6 ">
        <DeliveriesAdminView
          dateStr={dateStr}
          scheduled={scheduled}
          unscheduled={unscheduled}
          drivers={driversForView}
          defaultStart={defaultStart}
          initialDepot={defaultDepot}
          mapStops={mapStops}
          mapDrivers={driversForMap}
        />
      </div>
    </DashboardShell>
  );
}
