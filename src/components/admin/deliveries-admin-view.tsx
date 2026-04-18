'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
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
import {
  DeliveryMap,
  type MapStop,
  type MapDriver,
} from '@/components/admin/delivery-map-loader';
import clsx from 'clsx';

// ─── zero-dep primitives ──────────────────────────────────────────────────────

function cn(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(' ');
}

function Btn({
  children,
  onClick,
  disabled,
  variant = 'default',
  className,
  type = 'button',
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  variant?: 'default' | 'outline' | 'ghost';
  className?: string;
  type?: 'button' | 'submit';
}) {
  const base =
    'inline-flex items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-1 disabled:opacity-50 disabled:pointer-events-none';
  const s = {
    default: 'bg-gray-900 text-white hover:bg-gray-700 focus:ring-gray-500',
    outline:
      'border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 focus:ring-gray-400',
    ghost: 'text-gray-500 hover:bg-gray-100 hover:text-gray-800',
  };
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={cn(base, s[variant], className)}
    >
      {children}
    </button>
  );
}

function Badge({
  children,
  color = 'gray',
}: {
  children: React.ReactNode;
  color?: 'gray' | 'green' | 'amber' | 'red' | 'blue';
}) {
  const s = {
    gray: 'bg-gray-100  text-gray-600  border-gray-200',
    green: 'bg-green-50  text-green-700 border-green-200',
    amber: 'bg-amber-50  text-amber-700 border-amber-200',
    red: 'bg-red-50    text-red-600   border-red-200',
    blue: 'bg-blue-50   text-blue-700  border-blue-200',
  };
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium',
        s[color],
      )}
    >
      {children}
    </span>
  );
}

// ─── types ────────────────────────────────────────────────────────────────────

type ScheduledEntry = {
  id: string;
  sku: string | undefined;
  animalType?: string;
  animalGrade?: string | null;
  salesName?: string;
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
  sku: string | undefined;
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
  isAssigned: boolean;
  lastLat: number | null;
  lastLng: number | null;
  lastLocationAt: string | null;
};

// ─── helpers ──────────────────────────────────────────────────────────────────

function parseLatLng(input: string): { lat: number; lng: number } | null {
  const m = input.trim().match(/^(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)$/);
  if (!m) return null;
  const lat = Number(m[1]),
    lng = Number(m[2]);
  if (!isFinite(lat) || !isFinite(lng)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return { lat, lng };
}

function initials(name: string) {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 1);
}

const STATUS_COLOR: Record<
  string,
  'green' | 'blue' | 'amber' | 'red' | 'gray'
> = {
  DELIVERED: 'green',
  IN_PROGRESS: 'blue',
  PENDING: 'amber',
  FAILED: 'red',
};

// ─── main component ───────────────────────────────────────────────────────────

export function DeliveriesAdminView({
  dateStr,
  scheduled,
  unscheduled,
  drivers,
  defaultStart,
  initialDepot,
  mapStops,
  mapDrivers,
}: {
  dateStr: string;
  scheduled: ScheduledEntry[];
  unscheduled: UnscheduledEntry[];
  drivers: Driver[];
  defaultStart: string;
  initialDepot: { lat: number; lng: number };
  mapStops: MapStop[];
  mapDrivers: MapDriver[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [selectedUnscheduled, setSelectedUnscheduled] = useState<Set<string>>(
    new Set(),
  );
  const [buckets, setBuckets] = useState<string[][] | null>(null);
  const [bucketDrivers, setBucketDrivers] = useState<Record<number, string>>(
    {},
  );
  const [startInput, setStartInput] = useState(defaultStart);
  const [mapDepot, setMapDepot] = useState(
    () => parseLatLng(defaultStart) ?? initialDepot,
  );

  function updateStartInput(next: string) {
    setStartInput(next);
    const p = parseLatLng(next);
    if (p) setMapDepot(p);
  }

  // ── Live driver locations via Supabase realtime ──
  const [driverLocs, setDriverLocs] = useState<
    Map<
      string,
      {
        lastLat: number | null;
        lastLng: number | null;
        lastLocationAt: string | null;
      }
    >
  >(
    () =>
      new Map(
        drivers.map((d) => [
          d.id,
          {
            lastLat: d.lastLat,
            lastLng: d.lastLng,
            lastLocationAt: d.lastLocationAt,
          },
        ]),
      ),
  );

  useEffect(() => {
    const channel = supabase
      .channel('driver-locations-admin')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'Profile' },
        (payload) => {
          const next = payload.new as {
            id: string;
            role: string;
            lastLat: number | null;
            lastLng: number | null;
            lastLocationAt: string | null;
          };
          if (next.role !== 'DRIVER') return;
          setDriverLocs((prev) => {
            const map = new Map(prev);
            map.set(next.id, {
              lastLat: next.lastLat,
              lastLng: next.lastLng,
              lastLocationAt: next.lastLocationAt,
            });
            return map;
          });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const assignableDrivers = drivers.filter((d) => !d.isAssigned);
  const driverCount = assignableDrivers.length;

  const [customRouteCount, setCustomRouteCount] = useState<number | ''>('');
  const activeRouteCount =
    customRouteCount === '' ? Math.max(driverCount, 1) : customRouteCount;

  const deliveredCount = scheduled.filter(
    (e) => e.delivery?.status === 'DELIVERED',
  ).length;

  const groupedByDriver = useMemo(() => {
    const map = new Map<string, ScheduledEntry[]>();
    for (const e of scheduled) {
      const id = e.delivery?.driverId ?? '__unassigned__';
      if (!map.has(id)) map.set(id, []);
      map.get(id)!.push(e);
    }
    for (const list of map.values())
      list.sort(
        (a, b) => (a.delivery?.sequence ?? 0) - (b.delivery?.sequence ?? 0),
      );
    return map;
  }, [scheduled]);

  function refresh() {
    router.refresh();
  }
  function gotoDate(d: string) {
    router.push(`/admin/deliveries?date=${d}`);
  }
  function dateOffset(days: number) {
    const d = new Date(dateStr + 'T00:00:00Z');
    d.setUTCDate(d.getUTCDate() + days);
    return d.toISOString().slice(0, 10);
  }

  function toggleOne(id: string) {
    setSelectedUnscheduled((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }
  function toggleAll(checked: boolean) {
    setSelectedUnscheduled(
      checked ? new Set(unscheduled.map((e) => e.id)) : new Set(),
    );
  }

  function handleAssignDate() {
    if (!selectedUnscheduled.size) return;
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

  function toggleDriverAvail(driverId: string, isActive: boolean) {
    startTransition(async () => {
      const r = await setDriverAvailability([driverId], dateStr, isActive);
      if ('error' in r) toast.error(r.error);
      else refresh();
    });
  }

  function handleGenerate() {
    if (activeRouteCount < 1) {
      toast.error('Jumlah rute minimal 1');
      return;
    }
    startTransition(async () => {
      const r = await generateRoutes(dateStr, activeRouteCount, startInput);
      if ('error' in r) {
        toast.error(r.error);
        return;
      }
      setBuckets(r.buckets);
      setBucketDrivers({});
      if (r.depot) setMapDepot(r.depot);
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

  function handleUnassign(ids: string[]) {
    startTransition(async () => {
      const r = await unassignDeliveryDate(ids);
      if ('error' in r) toast.error(r.error);
      else {
        toast.success(`${r.count} entry dilepas`);
        refresh();
      }
    });
  }

  function handleResetRoutes() {
    if (!confirm(`Reset semua rute untuk ${dateStr}?`)) return;
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
    if (!confirm(`Kosongkan jadwal ${dateStr}?`)) return;
    startTransition(async () => {
      const r = await clearSchedule(dateStr);
      if ('error' in r) toast.error(r.error);
      else {
        toast.success(`${r.count} entry dilepas`);
        setBuckets(null);
        setBucketDrivers({});
        refresh();
      }
    });
  }

  const allSelected =
    selectedUnscheduled.size === unscheduled.length && unscheduled.length > 0;
  const someSelected = selectedUnscheduled.size > 0 && !allSelected;

  // ─── shared table styles ──────────────────────────────────────────────────
  const th = 'px-3 py-2.5 text-left font-medium text-xs text-gray-500';
  const td = 'px-3 py-3 text-sm';

  return (
    <div className="space-y-5">
      {/* ── Map ── */}
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-100 px-5 py-4">
          <h2 className="text-sm font-semibold text-gray-900">
            Peta Rute &amp; Driver (live)
          </h2>
        </div>
        <DeliveryMap depot={mapDepot} stops={mapStops} drivers={mapDrivers} />
      </div>

      {/* ── Summary cards ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {(
          [
            {
              label: 'Dijadwalkan',
              value: scheduled.length,
              sub: 'pengiriman hari ini',
              color: 'text-gray-900',
            },
            {
              label: 'Terkirim',
              value: deliveredCount,
              sub: `dari ${scheduled.length}`,
              color: 'text-green-700',
            },
            {
              label: 'Belum dijadwal',
              value: unscheduled.length,
              sub: 'menunggu penugasan',
              color: 'text-amber-600',
            },
            {
              label: 'Driver aktif',
              value: driverCount,
              sub: 'tersedia hari ini',
              color: 'text-blue-700',
            },
          ] as const
        ).map((s) => (
          <div
            key={s.label}
            className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
          >
            <p className="text-xs text-gray-500 mb-1">{s.label}</p>
            <p className={cn('text-2xl font-semibold', s.color)}>{s.value}</p>
            <p className="text-xs text-gray-400 mt-1">{s.sub}</p>
          </div>
        ))}
      </div>

      {/* ── Date nav ── */}
      <div className="rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          <Btn variant="outline" onClick={() => gotoDate(dateOffset(-1))}>
            ← Hari sebelum
          </Btn>
          <input
            type="date"
            value={dateStr}
            onChange={(e) => e.target.value && gotoDate(e.target.value)}
            className="h-8 rounded-md border border-gray-300 bg-white px-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-400"
          />
          <Btn variant="outline" onClick={() => gotoDate(dateOffset(1))}>
            Hari sesudah →
          </Btn>
          <span className="ml-auto text-xs text-gray-400">
            {scheduled.length} dijadwalkan · {unscheduled.length} belum dijadwal
          </span>
        </div>
      </div>

      {/* ── Driver availability table ── */}
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <h2 className="text-sm font-semibold text-gray-900">
            Status Driver — {dateStr}
          </h2>
          <span className="text-xs text-gray-400">
            {driverCount} dari {drivers.length} tersedia
          </span>
        </div>
        {drivers.length === 0 ? (
          <p className="px-5 py-6 text-sm text-gray-400">
            Belum ada user dengan role DRIVER.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className={cn(th, 'pl-5')}>Driver</th>
                  <th className={th}>Telepon</th>
                  <th className={th}>Lokasi (live)</th>
                  <th className={cn(th, 'pr-5')}>Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {drivers.map((d) => (
                  <tr
                    key={d.id}
                    className={cn(
                      'transition-colors',
                      d.isAssigned
                        ? 'bg-amber-50/40 cursor-not-allowed'
                        : 'cursor-pointer hover:bg-gray-50',
                    )}
                  >
                    <td className={cn(td, 'pl-5')}>
                      <div className="flex items-center gap-2">
                        <div
                          className={cn(
                            'w-7 h-7 shrink-0 rounded-full flex items-center justify-center text-xs font-semibold select-none',
                            d.isAssigned
                              ? 'bg-amber-100 text-amber-700'
                              : 'bg-blue-100 text-blue-700',
                          )}
                        >
                          {initials(d.name)}
                        </div>
                        <span className="font-medium text-gray-900">
                          {d.name}
                        </span>
                      </div>
                    </td>
                    <td className={cn(td, 'text-gray-500')}>
                      {d.phone ?? '—'}
                    </td>
                    <td className={td}>
                      {(() => {
                        const loc = driverLocs.get(d.id);
                        if (loc?.lastLat != null && loc?.lastLng != null) {
                          return (
                            <div className="flex flex-col gap-0.5">
                              <span className="font-mono text-xs text-gray-700">
                                {loc.lastLat.toFixed(5)},{' '}
                                {loc.lastLng.toFixed(5)}
                              </span>
                              {loc.lastLocationAt && (
                                <span className="text-xs text-gray-400">
                                  {new Date(
                                    loc.lastLocationAt,
                                  ).toLocaleTimeString()}
                                </span>
                              )}
                            </div>
                          );
                        }
                        return (
                          <span className="text-xs text-gray-400">
                            no signal
                          </span>
                        );
                      })()}
                    </td>
                    <td className={cn(td, 'pr-5')}>
                      {d.isAssigned ? (
                        <Badge color="amber">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 inline-block" />
                          On Delivery
                        </Badge>
                      ) : (
                        <Badge color="green">
                          <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" />
                          Available
                        </Badge>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Unscheduled table ── */}
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 px-5 py-4">
          <h2 className="text-sm font-semibold text-gray-900">
            Belum Dijadwalkan{' '}
            <span className="font-normal text-gray-400">
              ({unscheduled.length})
            </span>
          </h2>
          <div className="flex flex-wrap gap-2">
            <Btn variant="outline" onClick={handleBackfill} disabled={pending}>
              Backfill Coords
            </Btn>
            <Btn
              onClick={handleAssignDate}
              disabled={pending || !selectedUnscheduled.size}
            >
              Jadwalkan ke {dateStr}
              {selectedUnscheduled.size > 0 && ` (${selectedUnscheduled.size})`}
            </Btn>
          </div>
        </div>

        {selectedUnscheduled.size > 0 && (
          <div className="mx-5 mt-3 flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-700">
            <span>{selectedUnscheduled.size} item dipilih</span>
            <button
              className="ml-auto text-xs underline hover:no-underline"
              onClick={() => setSelectedUnscheduled(new Set())}
            >
              Batalkan pilihan
            </button>
          </div>
        )}

        {unscheduled.length === 0 ? (
          <p className="px-5 py-6 text-sm text-gray-400">
            Semua entry sudah dijadwalkan.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="pl-5 py-2.5 w-12">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      ref={(el) => {
                        if (el) el.indeterminate = someSelected;
                      }}
                      onChange={(e) => toggleAll(e.target.checked)}
                      className="h-4 w-4 rounded border-gray-300 accent-gray-800 cursor-pointer"
                    />
                  </th>
                  <th className={cn(th, 'w-40')}>SKU</th>
                  <th className={th}>Pembeli</th>
                  <th className={th}>Alamat</th>
                  <th className={cn(th, 'w-28 pr-5 text-center')}>Koordinat</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {unscheduled.map((e) => (
                  <tr
                    key={e.id}
                    onClick={() => toggleOne(e.id)}
                    className={cn(
                      'cursor-pointer transition-colors hover:bg-gray-50',
                      selectedUnscheduled.has(e.id) &&
                        'bg-blue-50 hover:bg-blue-50',
                    )}
                  >
                    <td
                      className="pl-5 py-3"
                      onClick={(ev) => ev.stopPropagation()}
                    >
                      <input
                        type="checkbox"
                        checked={selectedUnscheduled.has(e.id)}
                        onChange={() => toggleOne(e.id)}
                        className="h-4 w-4 rounded border-gray-300 accent-gray-800 cursor-pointer"
                      />
                    </td>
                    <td className={td}>
                      <span className="font-mono text-xs bg-gray-100 px-2 py-0.5 rounded">
                        {e.sku}
                      </span>
                    </td>
                    <td className={cn(td, 'font-medium text-gray-900')}>
                      {e.buyerName}
                    </td>
                    <td
                      className={cn(
                        td,
                        'text-xs text-gray-500 max-w-xs truncate',
                      )}
                      title={e.buyerAddress ?? undefined}
                    >
                      {e.buyerAddress ?? '—'}
                    </td>
                    <td className={cn(td, 'pr-5 text-center')}>
                      {e.hasCoords ? (
                        <Badge color="green">📍 Ada</Badge>
                      ) : (
                        <Badge color="red">📍 Tidak ada</Badge>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Route management ── */}
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="space-y-3 border-b border-gray-100 px-5 py-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-gray-900">
              Rute — {dateStr}
            </h2>
            <div className="flex flex-wrap gap-2">
              <Btn
                variant="outline"
                onClick={handleClearSchedule}
                disabled={pending || !scheduled.length}
              >
                Kosongkan Jadwal
              </Btn>
              <Btn
                variant="outline"
                onClick={handleResetRoutes}
                disabled={pending || !scheduled.length}
              >
                Reset Rute
              </Btn>

              <div className="flex items-center gap-2 border border-gray-300 rounded-md p-1 pl-3 ml-2">
                <label className="text-xs text-gray-500 font-medium">
                  Bagi ke
                </label>
                <input
                  type="number"
                  min={1}
                  value={customRouteCount}
                  onChange={(e) =>
                    setCustomRouteCount(
                      e.target.value === '' ? '' : parseInt(e.target.value),
                    )
                  }
                  placeholder={String(Math.max(driverCount, 1))}
                  className="h-6 w-12 rounded bg-white px-1 text-xs text-center border focus:outline-none focus:ring-1"
                />
                <span className="text-xs text-gray-500 mr-2">rute</span>
                <Btn
                  onClick={handleGenerate}
                  disabled={pending || !scheduled.length}
                  className="py-1 px-3 h-6"
                >
                  Generate
                </Btn>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-500 whitespace-nowrap">
              Titik awal:
            </label>
            <input
              type="text"
              placeholder="lat,lng atau Google Maps URL"
              value={startInput}
              onChange={(e) => updateStartInput(e.target.value)}
              className="h-8 w-full rounded-md border border-gray-300 bg-white px-2 text-xs text-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-400"
            />
          </div>
        </div>

        <div className="space-y-4 p-5">
          {/* Bucket driver assignment */}
          {buckets && (
            <div className="space-y-3 rounded-lg border border-blue-200 bg-blue-50/60 p-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-gray-800">
                  Pilih driver untuk tiap rute
                </p>
                <div className="flex gap-2">
                  <Btn variant="outline" onClick={() => setBuckets(null)}>
                    Batal
                  </Btn>
                  <Btn onClick={handleCommitDrivers} disabled={pending}>
                    Commit
                  </Btn>
                </div>
              </div>
              {buckets.map((entryIds, i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 rounded-md border border-gray-200 bg-white p-2"
                >
                  <span className="text-sm font-medium text-gray-700">
                    🚚 Rute {i + 1}
                  </span>
                  <span className="text-xs text-gray-400">
                    {entryIds.length} stop
                  </span>
                  <select
                    value={bucketDrivers[i] ?? ''}
                    onChange={(e) =>
                      setBucketDrivers((prev) => ({
                        ...prev,
                        [i]: e.target.value,
                      }))
                    }
                    className="ml-auto h-8 rounded-md border border-gray-300 bg-white px-2 text-xs text-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-400"
                  >
                    <option value="">Pilih driver…</option>
                    {assignableDrivers.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          )}

          {/* Per-driver route tables */}
          {Array.from(groupedByDriver.entries()).map(([driverId, stops]) => {
            const isUnassigned = driverId === '__unassigned__';
            const driverName = isUnassigned
              ? 'Belum di-assign'
              : (stops[0]?.delivery?.driver?.name ?? driverId);
            return (
              <div
                key={driverId}
                className="overflow-hidden rounded-lg border border-gray-200"
              >
                {/* group header */}
                <div className="flex items-center justify-between border-b border-gray-100 bg-gray-50 px-4 py-2.5">
                  <div className="flex items-center gap-2">
                    <div
                      className={cn(
                        'w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold shrink-0 select-none',
                        isUnassigned
                          ? 'bg-amber-100 text-amber-700'
                          : 'bg-blue-100 text-blue-700',
                      )}
                    >
                      {isUnassigned ? '?' : initials(driverName)}
                    </div>
                    <span className="text-sm font-medium text-gray-900">
                      {driverName}
                    </span>
                    <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">
                      {stops.length} stop
                    </span>
                  </div>
                  <Btn
                    variant="ghost"
                    className="text-xs"
                    onClick={() => handleUnassign(stops.map((s) => s.id))}
                    disabled={pending}
                  >
                    Lepas dari jadwal
                  </Btn>
                </div>

                {/* stops */}
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-100 bg-gray-50/60">
                        <th className={cn(th, 'pl-4 w-10')}>#</th>
                        <th className={cn(th, 'w-36')}>Hewan / SKU</th>
                        <th className={th}>Pembeli</th>
                        <th className={th}>Sales</th>
                        <th className={th}>Alamat</th>
                        <th className={cn(th, 'w-28 text-center')}>Status</th>
                        <th className={cn(th, 'w-12 pr-4')}></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
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
                            className="hover:bg-gray-50 transition-colors"
                          >
                            <td
                              className={cn(
                                td,
                                'pl-4 text-xs text-gray-400 font-mono',
                              )}
                            >
                              {(s.delivery?.sequence ?? 0) + 1}
                            </td>
                            <td className={td}>
                              <div className="font-medium text-gray-900 mb-0.5">
                                {s.animalType
                                  ? s.animalType.charAt(0) +
                                    s.animalType.slice(1).toLowerCase()
                                  : ''}
                                {s.animalGrade ? ` ${s.animalGrade}` : ''}
                              </div>
                              <span className="font-mono text-xs bg-gray-100 px-1.5 py-0.5 rounded text-gray-600">
                                {s.sku}
                              </span>
                            </td>
                            <td className={td}>
                              <span className="font-medium text-gray-900">
                                {s.buyerName}
                              </span>
                              {s.buyerPhone && (
                                <span className="block text-xs text-gray-400">
                                  {s.buyerPhone}
                                </span>
                              )}
                            </td>
                            <td
                              className={cn(
                                td,
                                'text-xs text-gray-600 whitespace-nowrap',
                              )}
                            >
                              {s.salesName ?? '—'}
                            </td>
                            <td
                              className={cn(
                                td,
                                'text-xs text-gray-500 max-w-xs truncate',
                              )}
                              title={s.buyerAddress ?? undefined}
                            >
                              {s.buyerAddress ?? '—'}
                            </td>
                            <td className={cn(td, 'text-center')}>
                              <Badge
                                color={
                                  STATUS_COLOR[s.delivery?.status ?? ''] ??
                                  'gray'
                                }
                              >
                                {s.delivery?.status ?? 'PENDING'}
                              </Badge>
                            </td>
                            <td className={cn(td, 'pr-4 text-right')}>
                              {href && (
                                <a
                                  href={href}
                                  target="_blank"
                                  rel="noreferrer"
                                  title="Buka di Maps"
                                  className="inline-flex items-center justify-center w-7 h-7 rounded-md border border-gray-200 text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors text-base"
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
              </div>
            );
          })}

          {!scheduled.length && !buckets && (
            <p className="py-8 text-center text-sm text-gray-400">
              Belum ada entry dijadwalkan untuk tanggal ini.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
