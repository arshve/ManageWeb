import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/auth';
import { DashboardShell } from '@/components/dashboard/dashboard-shell';
import { DriverRunView } from '@/components/driver/driver-run-view';
import { LocationPinger } from '@/components/driver/location-pinger';
import {
  DeliveryMap,
  type MapStop,
  type MapDriver,
} from '@/components/admin/delivery-map-loader';
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

export default async function DriverPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const profile = await requireRole('DRIVER');
  const params = await searchParams;
  const date = parseDateParam(params.date);
  const dateStr = date.toISOString().slice(0, 10);

  const deliveries = await prisma.delivery.findMany({
    where: {
      driverId: profile.id,
      entry: { deliveryDate: date },
      status: { in: ['ASSIGNED', 'ON_DELIVERY', 'DELIVERED', 'FAILED'] },
    },
    orderBy: { sequence: 'asc' },
    include: {
      entry: {
        select: {
          id: true,
          invoiceNo: true,
          buyerName: true,
          buyerPhone: true,
          buyerAddress: true,
          buyerMaps: true,
          buyerLat: true,
          buyerLng: true,
          sales: { select: { name: true } },
          livestock: {
            select: {
              sku: true,
              tag: true,
              type: true,
              grade: true,
              photoUrl: true,
            },
          },
        },
      },
    },
  });

  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const isToday = dateStr === today.toISOString().slice(0, 10);

  const depotForMap = getDefaultDepot();

  const mapStops: MapStop[] = deliveries
    .filter((d) => d.entry.buyerLat != null && d.entry.buyerLng != null)
    .map((d) => ({
      id: d.entry.id,
      invoiceNo: d.entry.invoiceNo,
      buyerName: d.entry.buyerName,
      lat: d.entry.buyerLat!,
      lng: d.entry.buyerLng!,
      sequence: d.sequence,
      status: d.status,
      driverId: profile.id,
      driverName: profile.name,
    }));

  const mapDrivers: MapDriver[] = [
    {
      id: profile.id,
      name: profile.name,
      lastLat: profile.lastLat,
      lastLng: profile.lastLng,
      lastLocationAt: profile.lastLocationAt?.toISOString() ?? null,
    },
  ];

  return (
    <DashboardShell
      title={`Rute ${dateStr} — ${profile.name}`}
      description={`${deliveries.length} stop`}
    >
      {isToday && <LocationPinger />}
      {mapStops.length > 0 && (
        <Card className="mb-4">
          <CardHeader>
            <CardTitle className="text-base">Peta Rute Anda</CardTitle>
          </CardHeader>
          <CardContent>
            <DeliveryMap
              depot={depotForMap}
              stops={mapStops}
              drivers={mapDrivers}
            />
          </CardContent>
        </Card>
      )}
      <DriverRunView
        deliveryDate={dateStr}
        isToday={isToday}
        stops={deliveries.map((d) => ({
          id: d.id,
          sequence: d.sequence ?? 0,
          status: d.status,
          deliveredAt: d.deliveredAt?.toISOString() ?? null,
          notes: d.notes,
          entry: {
            buyerName: d.entry.buyerName,
            buyerPhone: d.entry.buyerPhone,
            buyerAddress: d.entry.buyerAddress,
            buyerMaps: d.entry.buyerMaps,
            buyerLat: d.entry.buyerLat,
            buyerLng: d.entry.buyerLng,
            salesName: d.entry.sales.name,
            livestock: d.entry.livestock,
          },
        }))}
      />
    </DashboardShell>
  );
}
