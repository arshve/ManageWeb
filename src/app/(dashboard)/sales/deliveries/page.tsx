import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/auth';
import { DashboardShell } from '@/components/dashboard/dashboard-shell';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { navigationUrl } from '@/lib/delivery/maps';
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

function StatusBadge({ status }: { status: string }) {
  const map: Record<
    string,
    {
      label: string;
      variant: 'default' | 'secondary' | 'outline' | 'destructive';
      className?: string;
    }
  > = {
    ASSIGNED: {
      label: 'Siap',
      variant: 'outline',
      className: 'text-amber-600 bg-amber-50 border-amber-200',
    },
    ON_DELIVERY: {
      label: 'Jalan',
      variant: 'default',
      className: 'bg-blue-500 hover:bg-blue-600',
    },
    DELIVERED: {
      label: 'Terkirim',
      variant: 'secondary',
      className: 'bg-green-100 text-green-800 hover:bg-green-200',
    },
    FAILED: { label: 'Gagal', variant: 'destructive' },
    PENDING: {
      label: 'Pending',
      variant: 'outline',
      className: 'text-gray-500',
    },
  };
  const m = map[status] ?? { label: status, variant: 'outline' };
  return (
    <Badge variant={m.variant} className={m.className}>
      {m.label}
    </Badge>
  );
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
        buyerPhone: true,
        buyerLat: true,
        buyerLng: true,
        buyerMaps: true,
        livestock: {
          select: {
            sku: true,
            type: true,
            grade: true,
          },
        },
        sales: {
          select: {
            name: true,
          },
        },
        delivery: {
          select: {
            sequence: true,
            status: true,
            driverId: true,
            notes: true, // Fetch catatan dari driver
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
      sku: e.livestock?.sku,
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
                <div
                  key={driverId}
                  className="border rounded-lg overflow-hidden"
                >
                  <div className="bg-muted/50 px-4 py-3 border-b flex items-center justify-between">
                    <div className="font-medium text-sm">
                      {driverName}{' '}
                      <span className="text-xs text-muted-foreground font-normal">
                        ({stops.length} stop)
                      </span>
                    </div>
                  </div>

                  {/* Desktop Table View */}
                  <div className="hidden lg:block overflow-x-auto">
                    <table className="w-full text-sm text-left">
                      <thead>
                        <tr className="border-b border-gray-100 bg-gray-50/30">
                          <th className="px-4 py-2.5 font-medium text-xs text-muted-foreground w-10">
                            #
                          </th>
                          <th className="px-3 py-2.5 font-medium text-xs text-muted-foreground w-36">
                            Hewan / SKU
                          </th>
                          <th className="px-3 py-2.5 font-medium text-xs text-muted-foreground">
                            Pembeli
                          </th>
                          <th className="px-3 py-2.5 font-medium text-xs text-muted-foreground">
                            Sales
                          </th>
                          <th className="px-3 py-2.5 font-medium text-xs text-muted-foreground">
                            Alamat
                          </th>
                          <th className="px-3 py-2.5 font-medium text-xs text-muted-foreground w-40">
                            Catatan
                          </th>
                          <th className="px-3 py-2.5 font-medium text-xs text-muted-foreground w-28 text-center">
                            Status
                          </th>
                          <th className="px-4 py-2.5 font-medium text-xs text-muted-foreground w-12 text-right">
                            {' '}
                            Maps
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {stops.map((s) => {
                          const href = navigationUrl({
                            buyerMaps: s.buyerMaps,
                            buyerLat: s.buyerLat,
                            buyerLng: s.buyerLng,
                            buyerAddress: s.buyerAddress,
                          });

                          return (
                            <tr
                              key={s.id}
                              className="hover:bg-muted/30 transition-colors"
                            >
                              <td className="px-4 py-3 text-xs text-muted-foreground font-mono">
                                {(s.delivery?.sequence ?? 0) + 1}
                              </td>
                              <td className="px-3 py-3">
                                <div className="font-medium text-foreground mb-0.5">
                                  {s.livestock?.type
                                    ? s.livestock.type.charAt(0) +
                                      s.livestock.type.slice(1).toLowerCase()
                                    : ''}
                                  {s.livestock?.grade
                                    ? ` ${s.livestock.grade}`
                                    : ''}
                                </div>
                                <span className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded text-muted-foreground">
                                  {s.livestock?.sku ?? s.invoiceNo}
                                </span>
                              </td>
                              <td className="px-3 py-3">
                                <span className="font-medium text-foreground">
                                  {s.buyerName}
                                </span>
                                {s.buyerPhone && (
                                  <span className="block text-xs text-muted-foreground mt-0.5">
                                    {s.buyerPhone}
                                  </span>
                                )}
                              </td>
                              <td className="px-3 py-3 text-xs text-muted-foreground whitespace-nowrap">
                                {s.sales?.name ?? '—'}
                              </td>
                              <td
                                className="px-3 py-3 text-xs text-muted-foreground max-w-[200px] truncate"
                                title={s.buyerAddress ?? undefined}
                              >
                                {s.buyerAddress ?? '—'}
                              </td>
                              <td className="px-3 py-3 text-xs">
                                {s.delivery?.notes ? (
                                  <div
                                    className={cn(
                                      'px-2 py-1 rounded border',
                                      s.delivery.status === 'FAILED'
                                        ? 'bg-destructive/10 border-destructive/20 text-destructive'
                                        : 'bg-muted/50 border-border text-muted-foreground',
                                    )}
                                  >
                                    <span
                                      className="line-clamp-2"
                                      title={s.delivery.notes}
                                    >
                                      {s.delivery.notes}
                                    </span>
                                  </div>
                                ) : (
                                  <span className="text-muted-foreground">
                                    —
                                  </span>
                                )}
                              </td>
                              <td className="px-3 py-3 text-center">
                                <StatusBadge
                                  status={s.delivery?.status ?? 'PENDING'}
                                />
                              </td>
                              <td className="px-4 py-3 text-right">
                                {href && (
                                  <a
                                    href={href}
                                    target="_blank"
                                    rel="noreferrer"
                                    title="Buka di Maps"
                                    className="inline-flex items-center justify-center w-7 h-7 rounded-md border text-muted-foreground hover:bg-muted hover:text-foreground transition-colors text-base"
                                  >
                                    ↗
                                  </a>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Mobile Card View */}
                  <div className="lg:hidden flex flex-col divide-y divide-border">
                    {stops.map((s) => {
                      const href = navigationUrl({
                        buyerMaps: s.buyerMaps,
                        buyerLat: s.buyerLat,
                        buyerLng: s.buyerLng,
                        buyerAddress: s.buyerAddress,
                      });

                      return (
                        <div
                          key={s.id}
                          className="p-4 space-y-3 hover:bg-muted/30 transition-colors"
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex items-center gap-2">
                              <span className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-xs font-bold text-muted-foreground">
                                {(s.delivery?.sequence ?? 0) + 1}
                              </span>
                              <span className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded text-muted-foreground">
                                {s.livestock?.sku ?? s.invoiceNo}
                              </span>
                            </div>
                            <StatusBadge
                              status={s.delivery?.status ?? 'PENDING'}
                            />
                          </div>

                          <div>
                            <div className="font-medium text-foreground">
                              {s.buyerName}
                            </div>
                            {s.buyerPhone && (
                              <div className="text-xs text-muted-foreground mt-0.5">
                                {s.buyerPhone}
                              </div>
                            )}
                          </div>

                          <div className="text-sm text-muted-foreground bg-muted/20 p-2 rounded-md border border-border/50">
                            <span className="font-medium text-foreground block mb-0.5">
                              {s.livestock?.type
                                ? s.livestock.type.charAt(0) +
                                  s.livestock.type.slice(1).toLowerCase()
                                : ''}
                              {s.livestock?.grade
                                ? ` ${s.livestock.grade}`
                                : ''}
                            </span>
                            <span className="block text-xs mb-1">
                              Sales: {s.sales?.name ?? '—'}
                            </span>
                            <p className="line-clamp-2 text-xs">
                              {s.buyerAddress ?? 'Alamat tidak tersedia'}
                            </p>
                          </div>

                          {/* Notes Block for Mobile */}
                          {s.delivery?.notes && (
                            <div
                              className={cn(
                                'text-xs p-2 rounded-md border',
                                s.delivery.status === 'FAILED'
                                  ? 'bg-destructive/10 border-destructive/20 text-destructive'
                                  : 'bg-muted/50 border-border text-muted-foreground',
                              )}
                            >
                              <span className="font-semibold block mb-0.5">
                                Catatan Pengiriman:
                              </span>
                              {s.delivery.notes}
                            </div>
                          )}

                          <div className="pt-2 flex justify-end">
                            {href && (
                              <a
                                href={href}
                                target="_blank"
                                rel="noreferrer"
                                className={cn(
                                  buttonVariants({
                                    variant: 'outline',
                                    size: 'sm',
                                  }),
                                  'h-8 text-xs',
                                )}
                              >
                                Buka di Maps ↗
                              </a>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
            {scheduled.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4 border rounded-lg bg-muted/20">
                Belum ada pengiriman yang dijadwalkan untuk tanggal ini.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardShell>
  );
}
