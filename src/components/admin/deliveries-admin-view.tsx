'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import {
  assignDeliveryDate,
  unassignDeliveryDate,
  generateRoutes,
  assignDriversToBuckets,
  backfillCoordinates,
  resetRoutes,
  clearSchedule,
} from '@/app/actions/deliveries';
import { setDriverAvailability } from '@/app/actions/drivers';
import { navigationUrl } from '@/lib/delivery/maps';

type ScheduledEntry = {
  id: string;
  invoiceNo: string;
  buyerName: string;
  buyerAddress: string | null;
  buyerPhone: string | null;
  buyerLat: number | null;
  buyerLng: number | null;
  buyerMaps: string | null;
  delivery: {
    id: string;
    sequence: number | null;
    status: string;
    driverId: string | null;
    deliveredAt: Date | null;
    driver: { id: string; name: string } | null;
  } | null;
};

type UnscheduledEntry = {
  id: string;
  invoiceNo: string;
  buyerName: string;
  buyerAddress: string | null;
  hasCoords: boolean;
};

type Driver = {
  id: string;
  name: string;
  phone: string | null;
  vehiclePlate: string | null;
  isAvailable: boolean;
};

export function DeliveriesAdminView({
  dateStr,
  scheduled,
  unscheduled,
  drivers,
  defaultStart,
}: {
  dateStr: string;
  scheduled: ScheduledEntry[];
  unscheduled: UnscheduledEntry[];
  drivers: Driver[];
  defaultStart: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [selectedUnscheduled, setSelectedUnscheduled] = useState<Set<string>>(
    new Set(),
  );
  const [buckets, setBuckets] = useState<string[][] | null>(null);
  const [bucketDrivers, setBucketDrivers] = useState<Record<number, string>>({});
  const [startInput, setStartInput] = useState(defaultStart);

  const availableDrivers = drivers.filter((d) => d.isAvailable);
  const driverCount = availableDrivers.length;

  const groupedByDriver = useMemo(() => {
    const map = new Map<string, ScheduledEntry[]>();
    for (const e of scheduled) {
      const id = e.delivery?.driverId ?? '__unassigned__';
      if (!map.has(id)) map.set(id, []);
      map.get(id)!.push(e);
    }
    for (const list of map.values()) {
      list.sort(
        (a, b) => (a.delivery?.sequence ?? 0) - (b.delivery?.sequence ?? 0),
      );
    }
    return map;
  }, [scheduled]);

  function refresh() {
    router.refresh();
  }

  function gotoDate(next: string) {
    router.push(`/admin/deliveries?date=${next}`);
  }

  function dateOffset(days: number): string {
    const d = new Date(dateStr + 'T00:00:00Z');
    d.setUTCDate(d.getUTCDate() + days);
    return d.toISOString().slice(0, 10);
  }

  function toggleUnscheduled(id: string) {
    setSelectedUnscheduled((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleAssignDate() {
    if (selectedUnscheduled.size === 0) return;
    startTransition(async () => {
      const r = await assignDeliveryDate(
        Array.from(selectedUnscheduled),
        dateStr,
      );
      if ('error' in r) toast.error(r.error);
      else {
        toast.success(`${r.count} entry dijadwalkan`);
        setSelectedUnscheduled(new Set());
        refresh();
      }
    });
  }

  function handleBackfill() {
    startTransition(async () => {
      const r = await backfillCoordinates();
      toast.success(`Coords: ${r.resolved} ok, ${r.failed} gagal`);
      refresh();
    });
  }

  function toggleDriverAvailability(driverId: string, isActive: boolean) {
    startTransition(async () => {
      const r = await setDriverAvailability([driverId], dateStr, isActive);
      if ('error' in r) toast.error(r.error);
      else refresh();
    });
  }

  function handleGenerate() {
    if (driverCount === 0) {
      toast.error('Tandai driver yang available dulu');
      return;
    }
    startTransition(async () => {
      const r = await generateRoutes(dateStr, driverCount, startInput);
      if ('error' in r) {
        toast.error(r.error);
        return;
      }
      setBuckets(r.buckets);
      setBucketDrivers({});
      toast.success(`${r.buckets.length} rute dibuat`);
      refresh();
    });
  }

  function handleCommitDrivers() {
    if (!buckets) return;
    const nonEmpty = buckets.filter((b) => b.length > 0);
    const payload = buckets
      .map((entryIds, i) => ({ driverId: bucketDrivers[i], entryIds }))
      .filter((b) => b.driverId && b.entryIds.length > 0)
      .map((b) => ({ driverId: b.driverId!, entryIds: b.entryIds }));

    if (payload.length !== nonEmpty.length) {
      toast.error('Pilih driver untuk semua rute');
      return;
    }

    startTransition(async () => {
      const r = await assignDriversToBuckets(dateStr, payload);
      if ('error' in r) toast.error(r.error);
      else {
        toast.success('Driver di-assign');
        setBuckets(null);
        setBucketDrivers({});
        refresh();
      }
    });
  }

  function handleUnassign(entryIds: string[]) {
    startTransition(async () => {
      const r = await unassignDeliveryDate(entryIds);
      if ('error' in r) toast.error(r.error);
      else {
        toast.success(`${r.count} entry dilepas dari jadwal`);
        refresh();
      }
    });
  }

  function handleResetRoutes() {
    if (!confirm(`Reset semua rute untuk ${dateStr}? Driver & urutan akan dikosongkan.`)) return;
    startTransition(async () => {
      const r = await resetRoutes(dateStr);
      if ('error' in r) toast.error(r.error);
      else {
        toast.success(`${r.count} delivery di-reset`);
        setBuckets(null);
        setBucketDrivers({});
        refresh();
      }
    });
  }

  function handleClearSchedule() {
    if (!confirm(`Kosongkan jadwal ${dateStr}? Semua entry akan kembali ke "Belum Dijadwalkan".`)) return;
    startTransition(async () => {
      const r = await clearSchedule(dateStr);
      if ('error' in r) toast.error(r.error);
      else {
        toast.success(`${r.count} entry dilepas dari jadwal`);
        setBuckets(null);
        setBucketDrivers({});
        refresh();
      }
    });
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="p-4 flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => gotoDate(dateOffset(-1))}
          >
            ← Hari sebelum
          </Button>
          <Input
            type="date"
            value={dateStr}
            onChange={(e) => e.target.value && gotoDate(e.target.value)}
            className="h-8 w-[160px]"
          />
          <Button
            size="sm"
            variant="outline"
            onClick={() => gotoDate(dateOffset(1))}
          >
            Hari sesudah →
          </Button>
          <span className="ml-auto text-xs text-muted-foreground">
            {scheduled.length} dijadwalkan · {unscheduled.length} belum dijadwal
          </span>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Driver Available — {dateStr}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {drivers.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Belum ada user dengan role DRIVER.
            </p>
          )}
          {drivers.map((d) => (
            <label
              key={d.id}
              className="flex items-center gap-3 text-sm cursor-pointer"
            >
              <input
                type="checkbox"
                checked={d.isAvailable}
                onChange={(e) =>
                  toggleDriverAvailability(d.id, e.target.checked)
                }
                disabled={pending}
                className="h-4 w-4"
              />
              <span className="font-medium">{d.name}</span>
              {d.vehiclePlate && (
                <span className="text-xs text-muted-foreground">
                  {d.vehiclePlate}
                </span>
              )}
              {d.phone && (
                <span className="text-xs text-muted-foreground">{d.phone}</span>
              )}
            </label>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">
            Belum Dijadwalkan ({unscheduled.length})
          </CardTitle>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={handleBackfill}
              disabled={pending}
            >
              Backfill Coords
            </Button>
            <Button
              size="sm"
              onClick={handleAssignDate}
              disabled={pending || selectedUnscheduled.size === 0}
            >
              Jadwalkan ke {dateStr} ({selectedUnscheduled.size})
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <ul className="divide-y">
            {unscheduled.map((e) => (
              <li
                key={e.id}
                className="flex items-center gap-3 px-4 py-2 text-sm"
              >
                <input
                  type="checkbox"
                  checked={selectedUnscheduled.has(e.id)}
                  onChange={() => toggleUnscheduled(e.id)}
                  className="h-4 w-4"
                />
                <span className="font-mono text-xs">{e.invoiceNo}</span>
                <span className="font-medium">{e.buyerName}</span>
                <span className="text-xs text-muted-foreground truncate flex-1">
                  {e.buyerAddress ?? '—'}
                </span>
                {!e.hasCoords && (
                  <Badge variant="outline" className="text-xs">
                    no coords
                  </Badge>
                )}
              </li>
            ))}
            {unscheduled.length === 0 && (
              <li className="p-4 text-center text-muted-foreground text-sm">
                Semua entry sudah dijadwalkan.
              </li>
            )}
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="space-y-3">
          <div className="flex flex-row items-center justify-between gap-2">
            <CardTitle className="text-base">Rute — {dateStr}</CardTitle>
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={handleClearSchedule}
                disabled={pending || scheduled.length === 0}
              >
                Kosongkan Jadwal
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={handleResetRoutes}
                disabled={pending || scheduled.length === 0}
              >
                Reset Rute
              </Button>
              <Button
                size="sm"
                onClick={handleGenerate}
                disabled={pending || scheduled.length === 0 || driverCount === 0}
              >
                Generate Rute ({driverCount} driver)
              </Button>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-muted-foreground whitespace-nowrap">
              Titik awal:
            </label>
            <Input
              placeholder="lat,lng atau Google Maps URL"
              value={startInput}
              onChange={(e) => setStartInput(e.target.value)}
              className="h-8 text-xs"
            />
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {buckets && (
            <div className="space-y-3 p-3 rounded-md border border-primary/40 bg-primary/5">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">
                  Pilih driver untuk tiap rute
                </p>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setBuckets(null)}
                  >
                    Batal
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleCommitDrivers}
                    disabled={pending}
                  >
                    Commit
                  </Button>
                </div>
              </div>
              {buckets.map((entryIds, i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 p-2 rounded border bg-card"
                >
                  <span className="text-sm font-medium">Rute {i + 1}</span>
                  <span className="text-xs text-muted-foreground">
                    {entryIds.length} stop
                  </span>
                  <Select
                    value={bucketDrivers[i] ?? ''}
                    onValueChange={(v) =>
                      setBucketDrivers((prev) => ({ ...prev, [i]: v ?? '' }))
                    }
                  >
                    <SelectTrigger className="h-8 w-[200px] text-xs ml-auto">
                      <SelectValue placeholder="Pilih driver" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableDrivers.map((d) => (
                        <SelectItem key={d.id} value={d.id}>
                          {d.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>
          )}

          {Array.from(groupedByDriver.entries()).map(([driverId, stops]) => {
            const driverName =
              driverId === '__unassigned__'
                ? 'Belum di-assign'
                : (stops[0]?.delivery?.driver?.name ?? driverId);
            return (
              <div key={driverId} className="border rounded-lg p-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="font-medium text-sm">
                    {driverName}{' '}
                    <span className="text-xs text-muted-foreground">
                      ({stops.length} stop)
                    </span>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleUnassign(stops.map((s) => s.id))}
                  >
                    Lepas dari jadwal
                  </Button>
                </div>
                <ol className="text-sm space-y-1">
                  {stops.map((s) => {
                    const href = navigationUrl({
                      buyerMaps: s.buyerMaps,
                      buyerLat: s.buyerLat,
                      buyerLng: s.buyerLng,
                      buyerAddress: s.buyerAddress,
                    });
                    return (
                      <li key={s.id} className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground w-6">
                          {(s.delivery?.sequence ?? 0) + 1}.
                        </span>
                        <span className="font-medium">{s.buyerName}</span>
                        <span className="text-xs text-muted-foreground truncate flex-1">
                          {s.buyerAddress ?? '—'}
                        </span>
                        <Badge variant="outline" className="text-xs">
                          {s.delivery?.status ?? 'PENDING'}
                        </Badge>
                        {href && (
                          <a
                            href={href}
                            target="_blank"
                            rel="noreferrer"
                            className="text-primary text-xs underline"
                          >
                            Maps
                          </a>
                        )}
                      </li>
                    );
                  })}
                </ol>
              </div>
            );
          })}

          {scheduled.length === 0 && !buckets && (
            <p className="text-sm text-muted-foreground text-center py-4">
              Belum ada entry dijadwalkan untuk tanggal ini.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
