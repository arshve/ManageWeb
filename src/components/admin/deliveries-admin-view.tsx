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
  updateEntryCoordinates,
} from '@/app/actions/deliveries';
import { navigationUrl } from '@/lib/delivery/maps';
import {
  DeliveryMap,
  type MapStop,
  type MapDriver,
} from '@/components/admin/delivery-map-loader';
import { formatPengiriman } from '@/lib/format';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const badgeColors = {
  gray: 'bg-gray-100 text-gray-600 border-gray-200',
  green: 'bg-green-50 text-green-700 border-green-200',
  amber: 'bg-amber-50 text-amber-700 border-amber-200',
  red: 'bg-red-50 text-red-600 border-red-200',
  blue: 'bg-blue-50 text-blue-700 border-blue-200',
} as const;

function ColorBadge({
  children,
  color = 'gray',
}: {
  children: React.ReactNode;
  color?: keyof typeof badgeColors;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium',
        badgeColors[color],
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
  items: { sku: string | undefined; tag: string | null | undefined; type: string | undefined; grade: string | null | undefined }[];
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
  items: { sku: string | undefined; tag: string | null | undefined; type: string | undefined; grade: string | null | undefined; weightMin: number | null | undefined; weightMax: number | null | undefined }[];
  buyerName: string;
  buyerAddress: string | null;
  buyerLat: number | null;
  buyerLng: number | null;
  pengiriman: string | null;
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

  const [unscheduledSearch, setUnscheduledSearch] = useState('');
  const [unscheduledCoordFilter, setUnscheduledCoordFilter] = useState<'ALL' | 'HAS_COORDS' | 'NO_COORDS'>('ALL');
  const [unscheduledPengirimanFilter, setUnscheduledPengirimanFilter] = useState('ALL');
  const [unscheduledJenisFilter, setUnscheduledJenisFilter] = useState('ALL');
  const [unscheduledPage, setUnscheduledPage] = useState(0);
  const UNSCHEDULED_PAGE_SIZE = 25;

  const filteredUnscheduled = useMemo(() => {
    let list = unscheduled;
    if (unscheduledCoordFilter === 'HAS_COORDS') list = list.filter((e) => e.hasCoords);
    else if (unscheduledCoordFilter === 'NO_COORDS') list = list.filter((e) => !e.hasCoords);
    if (unscheduledPengirimanFilter !== 'ALL') list = list.filter((e) => e.pengiriman === unscheduledPengirimanFilter);
    if (unscheduledJenisFilter !== 'ALL') list = list.filter((e) => e.items.some((i) => i.type === unscheduledJenisFilter));
    if (unscheduledSearch.trim()) {
      const q = unscheduledSearch.trim().toLowerCase();
      list = list.filter(
        (e) =>
          e.buyerName.toLowerCase().includes(q) ||
          (e.sku?.toLowerCase().includes(q)) ||
          (e.buyerAddress?.toLowerCase().includes(q)),
      );
    }
    return list;
  }, [unscheduled, unscheduledSearch, unscheduledCoordFilter, unscheduledPengirimanFilter, unscheduledJenisFilter]);

  const unscheduledTotalPages = Math.max(1, Math.ceil(filteredUnscheduled.length / UNSCHEDULED_PAGE_SIZE));
  const unscheduledSafePage = Math.min(unscheduledPage, unscheduledTotalPages - 1);
  const pagedUnscheduled = filteredUnscheduled.slice(
    unscheduledSafePage * UNSCHEDULED_PAGE_SIZE,
    (unscheduledSafePage + 1) * UNSCHEDULED_PAGE_SIZE,
  );

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
      checked ? new Set(filteredUnscheduled.map((e) => e.id)) : new Set(),
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
    selectedUnscheduled.size === filteredUnscheduled.length && filteredUnscheduled.length > 0;
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
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => gotoDate(dateOffset(-1))}>←</Button>
          <input
            type="date"
            value={dateStr}
            onChange={(e) => e.target.value && gotoDate(e.target.value)}
            className="h-8 flex-1 min-w-0 rounded-md border border-gray-300 bg-white px-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-400"
          />
          <Button size="sm" variant="outline" onClick={() => gotoDate(dateOffset(1))}>→</Button>
        </div>
        <p className="text-xs text-gray-400 mt-2 text-center sm:text-left">
          {scheduled.length} dijadwalkan · {unscheduled.length} belum dijadwal
        </p>
      </div>

      {/* ── Driver availability ── */}
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-gray-100 px-4 sm:px-5 py-4">
          <h2 className="text-sm font-semibold text-gray-900">
            Driver — {dateStr}
          </h2>
          <span className="text-xs text-gray-400">
            {driverCount}/{drivers.length} tersedia
          </span>
        </div>
        {drivers.length === 0 ? (
          <p className="px-5 py-6 text-sm text-gray-400">
            Belum ada user dengan role DRIVER.
          </p>
        ) : (
          <>
            {/* Desktop */}
            <div className="hidden sm:block overflow-x-auto">
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
                  {drivers.map((d) => {
                    const loc = driverLocs.get(d.id);
                    return (
                      <tr key={d.id} className={cn('transition-colors', d.isAssigned ? 'bg-amber-50/40' : 'hover:bg-gray-50')}>
                        <td className={cn(td, 'pl-5')}>
                          <div className="flex items-center gap-2">
                            <div className={cn('w-7 h-7 shrink-0 rounded-full flex items-center justify-center text-xs font-semibold select-none', d.isAssigned ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700')}>
                              {initials(d.name)}
                            </div>
                            <span className="font-medium text-gray-900">{d.name}</span>
                          </div>
                        </td>
                        <td className={cn(td, 'text-gray-500')}>{d.phone ?? '—'}</td>
                        <td className={td}>
                          {loc?.lastLat != null && loc?.lastLng != null ? (
                            <div className="flex flex-col gap-0.5">
                              <span className="font-mono text-xs text-gray-700">{loc.lastLat.toFixed(5)}, {loc.lastLng.toFixed(5)}</span>
                              {loc.lastLocationAt && <span className="text-xs text-gray-400">{new Date(loc.lastLocationAt).toLocaleTimeString()}</span>}
                            </div>
                          ) : (
                            <span className="text-xs text-gray-400">no signal</span>
                          )}
                        </td>
                        <td className={cn(td, 'pr-5')}>
                          {d.isAssigned ? (
                            <ColorBadge color="amber"><span className="w-1.5 h-1.5 rounded-full bg-amber-500 inline-block" /> On Delivery</ColorBadge>
                          ) : (
                            <ColorBadge color="green"><span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" /> Available</ColorBadge>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {/* Mobile cards */}
            <div className="sm:hidden divide-y divide-gray-100">
              {drivers.map((d) => {
                const loc = driverLocs.get(d.id);
                return (
                  <div key={d.id} className={cn('px-4 py-3 flex items-center gap-3', d.isAssigned && 'bg-amber-50/40')}>
                    <div className={cn('w-9 h-9 shrink-0 rounded-full flex items-center justify-center text-sm font-semibold select-none', d.isAssigned ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700')}>
                      {initials(d.name)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm text-gray-900 truncate">{d.name}</span>
                        {d.isAssigned ? (
                          <ColorBadge color="amber">On Delivery</ColorBadge>
                        ) : (
                          <ColorBadge color="green">Available</ColorBadge>
                        )}
                      </div>
                      <div className="text-xs text-gray-500 mt-0.5">
                        {d.phone ?? 'No phone'}
                        {loc?.lastLat != null && loc?.lastLng != null && (
                          <span className="ml-2 font-mono">{loc.lastLat.toFixed(4)},{loc.lastLng.toFixed(4)}</span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* ── Unscheduled ── */}
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 px-4 sm:px-5 py-4">
          <h2 className="text-sm font-semibold text-gray-900">
            Belum Dijadwalkan{' '}
            <span className="font-normal text-gray-400">
              ({unscheduled.length})
            </span>
          </h2>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={handleBackfill} disabled={pending}>
              Backfill Coords
            </Button>
            <Button size="sm"
              onClick={handleAssignDate}
              disabled={pending || !selectedUnscheduled.size}
            >
              Jadwalkan {selectedUnscheduled.size > 0 && `(${selectedUnscheduled.size})`}
            </Button>
          </div>
        </div>

        {/* Search & filter bar */}
        <div className="flex flex-wrap items-center gap-2 border-b border-gray-100 px-4 sm:px-5 py-2.5">
          <div className="relative flex-1 min-w-[160px]">
            <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
            <Input
              value={unscheduledSearch}
              onChange={(ev) => { setUnscheduledSearch(ev.target.value); setUnscheduledPage(0); }}
              placeholder="Cari nama / SKU / alamat"
              className="h-8 text-xs pl-8"
            />
          </div>
          <select
            value={unscheduledPengirimanFilter}
            onChange={(ev) => { setUnscheduledPengirimanFilter(ev.target.value); setUnscheduledPage(0); }}
            className="h-8 rounded-md border border-gray-300 bg-white px-2 text-xs text-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-400"
          >
            <option value="ALL">Semua Pengiriman</option>
            <option value="HARI_H">{formatPengiriman('HARI_H')}</option>
            <option value="H_1">{formatPengiriman('H_1')}</option>
            <option value="H_2">{formatPengiriman('H_2')}</option>
            <option value="H_3">{formatPengiriman('H_3')}</option>
            <option value="TITIP_POTONG">{formatPengiriman('TITIP_POTONG')}</option>
          </select>
          <select
            value={unscheduledJenisFilter}
            onChange={(ev) => { setUnscheduledJenisFilter(ev.target.value); setUnscheduledPage(0); }}
            className="h-8 rounded-md border border-gray-300 bg-white px-2 text-xs text-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-400"
          >
            <option value="ALL">Semua Jenis</option>
            <option value="KAMBING">Kambing</option>
            <option value="DOMBA">Domba</option>
            <option value="SAPI">Sapi</option>
          </select>
          <select
            value={unscheduledCoordFilter}
            onChange={(ev) => { setUnscheduledCoordFilter(ev.target.value as 'ALL' | 'HAS_COORDS' | 'NO_COORDS'); setUnscheduledPage(0); }}
            className="h-8 rounded-md border border-gray-300 bg-white px-2 text-xs text-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-400"
          >
            <option value="ALL">Semua Koordinat</option>
            <option value="HAS_COORDS">Punya Koordinat</option>
            <option value="NO_COORDS">Belum Ada Koordinat</option>
          </select>
          {(unscheduledSearch || unscheduledCoordFilter !== 'ALL' || unscheduledPengirimanFilter !== 'ALL' || unscheduledJenisFilter !== 'ALL') && (
            <button
              type="button"
              onClick={() => { setUnscheduledSearch(''); setUnscheduledCoordFilter('ALL'); setUnscheduledPengirimanFilter('ALL'); setUnscheduledJenisFilter('ALL'); setUnscheduledPage(0); }}
              className="text-xs text-gray-400 hover:text-gray-700 underline underline-offset-2"
            >
              Reset
            </button>
          )}
          {filteredUnscheduled.length !== unscheduled.length && (
            <span className="text-xs text-gray-400">
              {filteredUnscheduled.length} dari {unscheduled.length}
            </span>
          )}
        </div>

        {selectedUnscheduled.size > 0 && (
          <div className="mx-4 sm:mx-5 mt-3 flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-700">
            <span>{selectedUnscheduled.size} dipilih</span>
            <button
              className="ml-auto text-xs underline hover:no-underline"
              onClick={() => setSelectedUnscheduled(new Set())}
            >
              Batal
            </button>
          </div>
        )}

        {unscheduled.length === 0 ? (
          <p className="px-5 py-6 text-sm text-gray-400">
            Semua entry sudah dijadwalkan.
          </p>
        ) : filteredUnscheduled.length === 0 ? (
          <p className="px-5 py-6 text-sm text-gray-400">
            Tidak ada entry yang cocok dengan filter.
          </p>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden sm:block overflow-x-auto">
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
                    <th className={cn(th, 'w-32')}>Tag</th>
                    <th className={cn(th, 'w-36')}>Hewan</th>
                    <th className={th}>Pembeli</th>
                    <th className={th}>Alamat</th>
                    <th className={cn(th, 'w-28')}>Pengiriman</th>
                    <th className={cn(th, 'w-52 pr-5')}>Koordinat</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {pagedUnscheduled.map((e) => (
                    <UnscheduledRow
                      key={e.id}
                      entry={e}
                      selected={selectedUnscheduled.has(e.id)}
                      onToggle={() => toggleOne(e.id)}
                      pending={pending}
                      startTransition={startTransition}
                    />
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="sm:hidden divide-y divide-gray-100">
              <div className="px-4 py-2 bg-gray-50 flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={allSelected}
                  ref={(el) => {
                    if (el) el.indeterminate = someSelected;
                  }}
                  onChange={(e) => toggleAll(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 accent-gray-800 cursor-pointer"
                />
                <span className="text-xs text-gray-500">Pilih semua</span>
              </div>
              {pagedUnscheduled.map((e) => (
                <UnscheduledCard
                  key={e.id}
                  entry={e}
                  selected={selectedUnscheduled.has(e.id)}
                  onToggle={() => toggleOne(e.id)}
                  pending={pending}
                  startTransition={startTransition}
                />
              ))}
            </div>

            {/* Pagination */}
            {unscheduledTotalPages > 1 && (
              <div className="flex items-center justify-between gap-2 border-t border-gray-100 px-4 sm:px-5 py-3">
                <span className="text-xs text-gray-400">
                  {unscheduledSafePage * UNSCHEDULED_PAGE_SIZE + 1}–{Math.min((unscheduledSafePage + 1) * UNSCHEDULED_PAGE_SIZE, filteredUnscheduled.length)} dari {filteredUnscheduled.length}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    disabled={unscheduledSafePage === 0}
                    onClick={() => setUnscheduledPage(unscheduledSafePage - 1)}
                    className="px-2.5 py-1 text-xs rounded border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    ←
                  </button>
                  <span className="text-xs text-gray-500 px-1">
                    {unscheduledSafePage + 1} / {unscheduledTotalPages}
                  </span>
                  <button
                    type="button"
                    disabled={unscheduledSafePage >= unscheduledTotalPages - 1}
                    onClick={() => setUnscheduledPage(unscheduledSafePage + 1)}
                    className="px-2.5 py-1 text-xs rounded border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    →
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Route management ── */}
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="space-y-3 border-b border-gray-100 px-4 sm:px-5 py-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-gray-900">
              Rute — {dateStr}
            </h2>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={handleClearSchedule} disabled={pending || !scheduled.length}>
                Kosongkan
              </Button>
              <Button size="sm" variant="outline" onClick={handleResetRoutes} disabled={pending || !scheduled.length}>
                Reset Rute
              </Button>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-2 border border-gray-300 rounded-md p-1 pl-3">
              <label className="text-xs text-gray-500 font-medium">Bagi ke</label>
              <input
                type="number"
                min={1}
                value={customRouteCount}
                onChange={(e) => setCustomRouteCount(e.target.value === '' ? '' : parseInt(e.target.value))}
                placeholder={String(Math.max(driverCount, 1))}
                className="h-6 w-12 rounded bg-white px-1 text-xs text-center border focus:outline-none focus:ring-1"
              />
              <span className="text-xs text-gray-500 mr-2">rute</span>
              <Button size="sm" onClick={handleGenerate} disabled={pending || !scheduled.length} className="py-1 px-3 h-6">
                Generate
              </Button>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-500 whitespace-nowrap">Titik awal:</label>
            <input
              type="text"
              placeholder="lat,lng atau Google Maps URL"
              value={startInput}
              onChange={(e) => updateStartInput(e.target.value)}
              className="h-8 w-full rounded-md border border-gray-300 bg-white px-2 text-xs text-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-400"
            />
          </div>
        </div>

        <div className="space-y-4 p-4 sm:p-5">
          {/* Bucket driver assignment */}
          {buckets && (
            <div className="space-y-3 rounded-lg border border-blue-200 bg-blue-50/60 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-medium text-gray-800">Pilih driver tiap rute</p>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => setBuckets(null)}>Batal</Button>
                  <Button size="sm" onClick={handleCommitDrivers} disabled={pending}>Commit</Button>
                </div>
              </div>
              {buckets.map((entryIds, i) => (
                <div key={i} className="flex flex-wrap items-center gap-2 sm:gap-3 rounded-md border border-gray-200 bg-white p-2">
                  <span className="text-sm font-medium text-gray-700">🚚 Rute {i + 1}</span>
                  <span className="text-xs text-gray-400">{entryIds.length} stop</span>
                  <select
                    value={bucketDrivers[i] ?? ''}
                    onChange={(e) => setBucketDrivers((prev) => ({ ...prev, [i]: e.target.value }))}
                    className="ml-auto h-8 w-full sm:w-auto rounded-md border border-gray-300 bg-white px-2 text-xs text-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-400"
                  >
                    <option value="">Pilih driver…</option>
                    {assignableDrivers.map((d) => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          )}

          {/* Per-driver route groups */}
          {Array.from(groupedByDriver.entries()).map(([driverId, stops]) => {
            const isUnassigned = driverId === '__unassigned__';
            const driverName = isUnassigned
              ? 'Belum di-assign'
              : (stops[0]?.delivery?.driver?.name ?? driverId);
            return (
              <div key={driverId} className="overflow-hidden rounded-lg border border-gray-200">
                {/* group header */}
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 bg-gray-50 px-4 py-2.5">
                  <div className="flex items-center gap-2">
                    <div className={cn('w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold shrink-0 select-none', isUnassigned ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700')}>
                      {isUnassigned ? '?' : initials(driverName)}
                    </div>
                    <span className="text-sm font-medium text-gray-900">{driverName}</span>
                    <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">{stops.length} stop</span>
                  </div>
                  <Button size="sm" variant="ghost" className="text-xs" onClick={() => handleUnassign(stops.map((s) => s.id))} disabled={pending}>
                    Lepas
                  </Button>
                </div>

                {/* Desktop stops table */}
                <div className="hidden sm:block overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-100 bg-gray-50/60">
                        <th className={cn(th, 'pl-4 w-10')}>#</th>
                        <th className={cn(th, 'w-36')}>Hewan / SKU</th>
                        <th className={th}>Pembeli</th>
                        <th className={th}>Alamat</th>
                        <th className={cn(th, 'w-28 text-center')}>Status</th>
                        <th className={cn(th, 'w-12 pr-4')}></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {stops.map((s) => {
                        const href = navigationUrl({ buyerMaps: s.buyerMaps, buyerLat: s.buyerLat, buyerLng: s.buyerLng, buyerAddress: s.buyerAddress });
                        return (
                          <tr key={s.id} className="hover:bg-gray-50 transition-colors">
                            <td className={cn(td, 'pl-4 text-xs text-gray-400 font-mono')}>{(s.delivery?.sequence ?? 0) + 1}</td>
                            <td className={td}>
                              <div className="space-y-1">
                                {s.items.map((item) => (
                                  <div key={item.sku ?? item.tag}>
                                    <div className="font-medium text-gray-900 text-xs">
                                      {item.type ? item.type.charAt(0) + item.type.slice(1).toLowerCase() : ''}{item.grade ? ` ${item.grade}` : ''}
                                    </div>
                                    <span className="font-mono text-xs bg-gray-100 px-1.5 py-0.5 rounded text-gray-600">
                                      {item.tag ?? item.sku}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </td>
                            <td className={td}>
                              <span className="font-medium text-gray-900">{s.buyerName}</span>
                              {s.buyerPhone && <span className="block text-xs text-gray-400">{s.buyerPhone}</span>}
                            </td>
                            <td className={cn(td, 'text-xs text-gray-500 max-w-xs truncate')} title={s.buyerAddress ?? undefined}>{s.buyerAddress ?? '—'}</td>
                            <td className={cn(td, 'text-center')}>
                              <ColorBadge color={STATUS_COLOR[s.delivery?.status ?? ''] ?? 'gray'}>{s.delivery?.status ?? 'PENDING'}</ColorBadge>
                            </td>
                            <td className={cn(td, 'pr-4 text-right')}>
                              {href && (
                                <a href={href} target="_blank" rel="noreferrer" title="Buka di Maps" className="inline-flex items-center justify-center w-7 h-7 rounded-md border border-gray-200 text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors text-base">↗</a>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Mobile stop cards */}
                <div className="sm:hidden divide-y divide-gray-100">
                  {stops.map((s) => {
                    const href = navigationUrl({ buyerMaps: s.buyerMaps, buyerLat: s.buyerLat, buyerLng: s.buyerLng, buyerAddress: s.buyerAddress });
                    return (
                      <div key={s.id} className="px-4 py-3 space-y-1.5">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-400 font-mono w-5">#{(s.delivery?.sequence ?? 0) + 1}</span>
                            <span className="font-medium text-sm text-gray-900">{s.buyerName}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <ColorBadge color={STATUS_COLOR[s.delivery?.status ?? ''] ?? 'gray'}>{s.delivery?.status ?? 'PENDING'}</ColorBadge>
                            {href && (
                              <a href={href} target="_blank" rel="noreferrer" className="inline-flex items-center justify-center w-7 h-7 rounded-md border border-gray-200 text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors text-base">↗</a>
                            )}
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-1 text-xs">
                          {s.items.map((item) => (
                            <span key={item.sku ?? item.tag} className="inline-flex items-center gap-1">
                              <span className="font-medium text-gray-700">
                                {item.type ? item.type.charAt(0) + item.type.slice(1).toLowerCase() : ''}{item.grade ? ` ${item.grade}` : ''}
                              </span>
                              <span className="font-mono bg-gray-100 px-1.5 py-0.5 rounded text-gray-600">{item.tag ?? item.sku}</span>
                            </span>
                          ))}
                        </div>
                        {s.buyerAddress && <p className="text-xs text-gray-500 line-clamp-2">{s.buyerAddress}</p>}
                        {s.buyerPhone && <p className="text-xs text-gray-400">{s.buyerPhone}</p>}
                      </div>
                    );
                  })}
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

// ─── Unscheduled row (desktop) ────────────────────────────────────────────────

function UnscheduledRow({
  entry: e,
  selected,
  onToggle,
  pending,
  startTransition,
}: {
  entry: UnscheduledEntry;
  selected: boolean;
  onToggle: () => void;
  pending: boolean;
  startTransition: (fn: () => void) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [coordInput, setCoordInput] = useState(
    e.buyerLat != null && e.buyerLng != null ? `${e.buyerLat},${e.buyerLng}` : '',
  );

  const td = 'px-3 py-3 text-sm';

  function saveCoords() {
    const parsed = parseLatLng(coordInput);
    if (!parsed && coordInput.trim() !== '') {
      toast.error('Format: lat,lng (contoh: -6.123,106.456)');
      return;
    }
    startTransition(async () => {
      const r = await updateEntryCoordinates(e.id, parsed?.lat ?? null, parsed?.lng ?? null);
      if ('error' in r) toast.error(r.error);
      else {
        toast.success('Koordinat disimpan');
        setEditing(false);
      }
    });
  }

  return (
    <tr
      onClick={() => onToggle()}
      className={cn('cursor-pointer transition-colors hover:bg-gray-50', selected && 'bg-blue-50 hover:bg-blue-50')}
    >
      <td className="pl-5 py-3" onClick={(ev) => ev.stopPropagation()}>
        <input type="checkbox" checked={selected} onChange={onToggle} className="h-4 w-4 rounded border-gray-300 accent-gray-800 cursor-pointer" />
      </td>
      <td className={td}>
        <div className="space-y-0.5">
          {e.items.map((item) => (
            <span key={item.sku ?? item.tag} className="block font-mono text-xs bg-gray-100 px-2 py-0.5 rounded">
              {item.tag ?? item.sku ?? '—'}
            </span>
          ))}
        </div>
      </td>
      <td className={td}>
        <div className="space-y-0.5">
          {e.items.map((item) => {
            const typeLabel = item.type
              ? item.type.charAt(0) + item.type.slice(1).toLowerCase()
              : '—';
            const detail = item.type === 'SAPI'
              ? (item.weightMin && item.weightMax ? ` · ${item.weightMin}-${item.weightMax}kg` : '')
              : (item.grade ? ` ${item.grade}` : '');
            return (
              <span key={item.sku ?? item.tag} className="block text-xs text-gray-700">
                {typeLabel}{detail}
              </span>
            );
          })}
        </div>
      </td>
      <td className={cn(td, 'font-medium text-gray-900')}>{e.buyerName}</td>
      <td className={cn(td, 'text-xs text-gray-500 max-w-xs truncate')} title={e.buyerAddress ?? undefined}>
        {e.buyerAddress ?? '—'}
      </td>
      <td className={cn(td, 'text-xs text-gray-600')}>
        {formatPengiriman(e.pengiriman)}
      </td>
      <td className={cn(td, 'pr-5')} onClick={(ev) => ev.stopPropagation()}>
        {editing ? (
          <div className="flex items-center gap-1">
            <Input
              value={coordInput}
              onChange={(ev) => setCoordInput(ev.target.value)}
              onKeyDown={(ev) => { if (ev.key === 'Enter') saveCoords(); if (ev.key === 'Escape') setEditing(false); }}
              placeholder="-6.123,106.456"
              className="h-7 text-xs w-36 font-mono"
              autoFocus
            />
            <Button size="sm" className="h-7 px-2 text-xs" onClick={saveCoords} disabled={pending}>OK</Button>
            <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => setEditing(false)}>✕</Button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="inline-flex items-center gap-1"
          >
            {e.hasCoords ? (
              <ColorBadge color="green">📍 {e.buyerLat?.toFixed(4)},{e.buyerLng?.toFixed(4)}</ColorBadge>
            ) : (
              <ColorBadge color="red">📍 Belum ada</ColorBadge>
            )}
            <span className="text-xs text-gray-400 ml-1">✎</span>
          </button>
        )}
      </td>
    </tr>
  );
}

// ─── Unscheduled card (mobile) ────────────────────────────────────────────────

function UnscheduledCard({
  entry: e,
  selected,
  onToggle,
  pending,
  startTransition,
}: {
  entry: UnscheduledEntry;
  selected: boolean;
  onToggle: () => void;
  pending: boolean;
  startTransition: (fn: () => void) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [coordInput, setCoordInput] = useState(
    e.buyerLat != null && e.buyerLng != null ? `${e.buyerLat},${e.buyerLng}` : '',
  );

  function saveCoords() {
    const parsed = parseLatLng(coordInput);
    if (!parsed && coordInput.trim() !== '') {
      toast.error('Format: lat,lng');
      return;
    }
    startTransition(async () => {
      const r = await updateEntryCoordinates(e.id, parsed?.lat ?? null, parsed?.lng ?? null);
      if ('error' in r) toast.error(r.error);
      else {
        toast.success('Koordinat disimpan');
        setEditing(false);
      }
    });
  }

  return (
    <div className={cn('px-4 py-3 space-y-2', selected && 'bg-blue-50')}>
      <div className="flex items-start gap-3">
        <input
          type="checkbox"
          checked={selected}
          onChange={onToggle}
          className="h-4 w-4 mt-0.5 rounded border-gray-300 accent-gray-800 cursor-pointer shrink-0"
        />
        <div className="flex-1 min-w-0" onClick={onToggle}>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-sm text-gray-900 truncate">{e.buyerName}</span>
            {e.pengiriman && <ColorBadge color="blue">{formatPengiriman(e.pengiriman)}</ColorBadge>}
          </div>
          <div className="mt-1 space-y-0.5">
            {e.items.map((item) => {
              const typeLabel = item.type
                ? item.type.charAt(0) + item.type.slice(1).toLowerCase()
                : '—';
              const detail = item.type === 'SAPI'
                ? (item.weightMin && item.weightMax ? ` · ${item.weightMin}-${item.weightMax}kg` : '')
                : (item.grade ? ` ${item.grade}` : '');
              return (
                <div key={item.sku ?? item.tag} className="flex items-center gap-1.5">
                  <span className="font-mono text-xs bg-gray-100 px-1.5 py-0.5 rounded text-gray-600">
                    {item.tag ?? item.sku ?? '—'}
                  </span>
                  <span className="text-xs text-gray-600">{typeLabel}{detail}</span>
                </div>
              );
            })}
          </div>
          {e.buyerAddress && <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{e.buyerAddress}</p>}
        </div>
      </div>
      <div className="pl-7">
        {editing ? (
          <div className="flex items-center gap-1">
            <Input
              value={coordInput}
              onChange={(ev) => setCoordInput(ev.target.value)}
              onKeyDown={(ev) => { if (ev.key === 'Enter') saveCoords(); if (ev.key === 'Escape') setEditing(false); }}
              placeholder="-6.123,106.456"
              className="h-7 text-xs flex-1 font-mono"
              autoFocus
            />
            <Button size="sm" className="h-7 px-2 text-xs" onClick={saveCoords} disabled={pending}>OK</Button>
            <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => setEditing(false)}>✕</Button>
          </div>
        ) : (
          <button type="button" onClick={() => setEditing(true)} className="inline-flex items-center gap-1">
            {e.hasCoords ? (
              <ColorBadge color="green">📍 {e.buyerLat?.toFixed(4)},{e.buyerLng?.toFixed(4)}</ColorBadge>
            ) : (
              <ColorBadge color="red">📍 Belum ada</ColorBadge>
            )}
            <span className="text-xs text-gray-400 ml-1">✎</span>
          </button>
        )}
      </div>
    </div>
  );
}
