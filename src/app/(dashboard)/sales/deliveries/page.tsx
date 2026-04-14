import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/auth';
import { DashboardShell } from '@/components/dashboard/dashboard-shell';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { buttonVariants } from '@/components/ui/button';
import {
  DeliveryMap,
  type MapStop,
  type MapDriver,
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

function dateOffset(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export default async function SalesDeliveriesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  await requireRole('SALES');
  const params = await searchParams;
  const date = parseDateParam(params.date);
  const dateStr = date.toISOString().slice(0, 10);

  const [scheduled, drivers] = await Promise.all([
    prisma.entry.findMany({
      where: { deliveryDate: date, status: 'APPROVED' },
      select: {
        id: true,
        invoiceNo: true,
        buyerName: true,
        buyerAddress: true,
        buyerLat: true,
        buyerLng: true,
        delivery: {
          select: {
            sequence: true,
            status: true,
            driverId: true,
            driver: { select: { id: true, name: true } },
          },
        },
      },
    }),
    prisma.profile.findMany({
      where: { role: 'DRIVER', isActive: true },
      select: {
        id: true,
        name: true,
        lastLat: true,
        lastLng: true,
        lastLocationAt: true,
      },
      orderBy: { name: 'asc' },
    }),
  ]);

  const depot = getDefaultDepot();

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

  const mapDrivers: MapDriver[] = drivers.map((d) => ({
    id: d.id,
    name: d.name,
    lastLat: d.lastLat,
    lastLng: d.lastLng,
    lastLocationAt: d.lastLocationAt?.toISOString() ?? null,
  }));

  const groups = new Map<string, typeof scheduled>();
  for (const e of scheduled) {
    const id = e.delivery?.driverId ?? '__unassigned__';
    if (!groups.has(id)) groups.set(id, []);
    groups.get(id)!.push(e);
  }
  for (const list of groups.values()) {
    list.sort(
      (a, b) => (a.delivery?.sequence ?? 0) - (b.delivery?.sequence ?? 0),
    );
  }

  return (
    <DashboardShell
      title="Rute Pengiriman"
      description={`Jadwal pengiriman — ${dateStr}`}
    >
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Peta Rute & Driver</CardTitle>
          </CardHeader>
          <CardContent>
            <DeliveryMap depot={depot} stops={mapStops} drivers={mapDrivers} />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 flex flex-wrap items-center gap-2">
            <Link
              href={`/sales/deliveries?date=${dateOffset(dateStr, -1)}`}
              className={buttonVariants({ size: 'sm', variant: 'outline' })}
            >
              ← Hari sebelum
            </Link>
            <Link
              href={`/sales/deliveries?date=${dateOffset(dateStr, 1)}`}
              className={buttonVariants({ size: 'sm', variant: 'outline' })}
            >
              Hari sesudah →
            </Link>
            <span className="ml-auto text-xs text-muted-foreground">
              {scheduled.length} dijadwalkan
            </span>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Rute — {dateStr}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {Array.from(groups.entries()).map(([driverId, stops]) => {
              const driverName =
                driverId === '__unassigned__'
                  ? 'Belum di-assign'
                  : (stops[0]?.delivery?.driver?.name ?? driverId);
              return (
                <div key={driverId} className="border rounded-lg p-3">
                  <div className="mb-2 font-medium text-sm">
                    {driverName}{' '}
                    <span className="text-xs text-muted-foreground">
                      ({stops.length} stop)
                    </span>
                  </div>
                  <ol className="text-sm space-y-1">
                    {stops.map((s) => (
                      <li key={s.id} className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground w-6">
                          {(s.delivery?.sequence ?? 0) + 1}.
                        </span>
                        <span className="font-mono text-xs text-muted-foreground">
                          {s.invoiceNo}
                        </span>
                        <span className="font-medium">{s.buyerName}</span>
                        <span className="text-xs text-muted-foreground truncate flex-1">
                          {s.buyerAddress ?? '—'}
                        </span>
                        <Badge variant="outline" className="text-xs">
                          {s.delivery?.status ?? 'PENDING'}
                        </Badge>
                      </li>
                    ))}
                  </ol>
                </div>
              );
            })}
            {scheduled.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">
                Belum ada entry dijadwalkan untuk tanggal ini.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardShell>
  );
}
