import { prisma } from '@/lib/prisma';
import { DashboardShell } from '@/components/dashboard/dashboard-shell';
import { DeliveriesAdminView } from '@/components/admin/deliveries-admin-view';
import { DriverTracker } from '@/components/admin/driver-tracker';
import type { MapStop, MapDriver } from '@/components/admin/delivery-map-loader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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

  const [scheduledRaw, unscheduledRaw, drivers, availability] =
    await Promise.all([
      prisma.entry.findMany({
        where: { deliveryDate: date, status: 'APPROVED' },
        select: {
          id: true,
          invoiceNo: true,
          buyerName: true,
          buyerAddress: true,
          buyerPhone: true,
          buyerLat: true,
          buyerLng: true,
          buyerMaps: true,
          delivery: {
            select: {
              id: true,
              sequence: true,
              status: true,
              driverId: true,
              deliveredAt: true,
              driver: { select: { id: true, name: true } },
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
          buyerLat: true,
          buyerLng: true,
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
      prisma.driverAvailability.findMany({
        where: { date, isActive: true },
        select: { driverId: true },
      }),
    ]);

  const availableIds = new Set(availability.map((a) => a.driverId));

  const scheduled = scheduledRaw.map((e) => ({
    id: e.id,
    invoiceNo: e.invoiceNo,
    buyerName: e.buyerName,
    buyerAddress: e.buyerAddress,
    buyerPhone: e.buyerPhone,
    buyerLat: e.buyerLat,
    buyerLng: e.buyerLng,
    buyerMaps: e.buyerMaps,
    delivery: e.delivery,
  }));

  const unscheduled = unscheduledRaw.map((e) => ({
    id: e.id,
    invoiceNo: e.invoiceNo,
    buyerName: e.buyerName,
    buyerAddress: e.buyerAddress,
    hasCoords: e.buyerLat != null && e.buyerLng != null,
  }));

  const driversForView = drivers.map((d) => ({
    id: d.id,
    name: d.name,
    phone: d.phone,
    vehiclePlate: d.vehiclePlate,
    isAvailable: availableIds.has(d.id),
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
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
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
        <Card className="h-fit">
          <CardHeader>
            <CardTitle className="text-base">Lokasi Driver</CardTitle>
          </CardHeader>
          <CardContent>
            <DriverTracker initial={driversForMap} />
          </CardContent>
        </Card>
      </div>
    </DashboardShell>
  );
}
