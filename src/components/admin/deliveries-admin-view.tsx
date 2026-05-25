'use client';

import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
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
  toggleItemLoaded,
  bulkToggleItemsLoaded,
} from '@/app/actions/deliveries';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Lightbox } from '@/components/ui/lightbox';
import { parseLatLngCoord } from '@/lib/delivery/geo';
import { navigationUrl } from '@/lib/delivery/maps';
import {
  DeliveryMap,
  type MapStop,
  type MapDriver,
} from '@/components/admin/delivery-map-loader';
import { formatPengiriman, PENGIRIMAN_OPTIONS } from '@/lib/format';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { StatusToken, DELIVERY_STATUS } from '@/components/ui/status-token';
import { StatCard } from '@/components/ui/stat-card';
import { Printer } from 'lucide-react';


const SERIF = "var(--font-dm-serif), 'DM Serif Display', serif";

// ─── types ────────────────────────────────────────────────────────────────────

type ScheduledEntry = {
  id: string;
  sku: string | undefined;
  animalType?: string;
  animalGrade?: string | null;
  items: { itemId: string; loadedAt: string | null; sku: string | undefined; tag: string | null | undefined; type: string | undefined; grade: string | null | undefined; photoUrl: string | null; condition: string | null; weightMin: number | null; weightMax: number | null }[];
  salesName?: string;
  buyerName: string;
  buyerAddress: string | null;
  buyerPhone: string | null;
  buyerLat: number | null;
  buyerLng: number | null;
  buyerMaps: string | null;
  pengiriman: string | null;
  delivery: {
    id: string;
    sequence: number | null;
    status: string;
    driverId: string | null;
    deliveredAt: Date | null;
    notes: string | null;
    proofPhotoUrl: string | null;
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
  salesName: string | null;
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


function initials(name: string) {
  return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);
}

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
  const [togglePending, startToggleTransition] = useTransition();
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  const [checkedItems, setCheckedItems] = useState<Set<string>>(
    () => new Set(
      scheduled.flatMap((e) => e.items)
        .filter((i) => i.loadedAt)
        .map((i) => i.itemId),
    ),
  );

  function handleAdminToggleItem(itemId: string, checked: boolean) {
    setCheckedItems((prev) => {
      const next = new Set(prev);
      if (checked) next.add(itemId); else next.delete(itemId);
      return next;
    });
    startToggleTransition(async () => {
      const r = await toggleItemLoaded(itemId, checked);
      if (r && 'error' in r) {
        toast.error(r.error);
        setCheckedItems((prev) => {
          const next = new Set(prev);
          if (checked) next.delete(itemId); else next.add(itemId);
          return next;
        });
      }
    });
  }

  function handleAdminToggleAll(deliveryId: string, items: ScheduledEntry['items'], checked: boolean) {
    setCheckedItems((prev) => {
      const next = new Set(prev);
      items.forEach((i) => { if (checked) next.add(i.itemId); else next.delete(i.itemId); });
      return next;
    });
    startToggleTransition(async () => {
      const r = await bulkToggleItemsLoaded(deliveryId, checked);
      if (r && 'error' in r) {
        toast.error(r.error);
        setCheckedItems((prev) => {
          const next = new Set(prev);
          items.forEach((i) => { if (checked) next.delete(i.itemId); else next.add(i.itemId); });
          return next;
        });
      }
    });
  }
  const [selectedUnscheduled, setSelectedUnscheduled] = useState<Set<string>>(new Set());
  const [selectedScheduled, setSelectedScheduled] = useState<Set<string>>(new Set());
  const [buckets, setBuckets] = useState<string[][] | null>(null);
  const [bucketDrivers, setBucketDrivers] = useState<Record<number, string>>({});
  const [startInput, setStartInput] = useState(defaultStart);
  const [maxPerDriver, setMaxPerDriver] = useState(30);
  const [mapDepot, setMapDepot] = useState(() => parseLatLngCoord(defaultStart) ?? initialDepot);

  function updateStartInput(next: string) {
    setStartInput(next);
    const p = parseLatLngCoord(next);
    if (p) setMapDepot(p);
  }

  const [driverLocs, setDriverLocs] = useState<Map<string, { lastLat: number | null; lastLng: number | null; lastLocationAt: string | null }>>(
    () => new Map(drivers.map((d) => [d.id, { lastLat: d.lastLat, lastLng: d.lastLng, lastLocationAt: d.lastLocationAt }])),
  );

  useEffect(() => {
    const loadoutChannel = supabase
      .channel('entryitem-loadout-admin')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'EntryItem' }, (payload) => {
        const row = payload.new as { id: string; loadedAt: string | null };
        setCheckedItems((prev) => {
          const next = new Set(prev);
          if (row.loadedAt) next.add(row.id); else next.delete(row.id);
          return next;
        });
      })
      .subscribe();
    return () => { supabase.removeChannel(loadoutChannel); };
  }, []);

  useEffect(() => {
    const channel = supabase
      .channel('driver-locations-admin')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'Profile' }, (payload) => {
        const next = payload.new as { id: string; role: string; lastLat: number | null; lastLng: number | null; lastLocationAt: string | null };
        if (next.role !== 'DRIVER') return;
        setDriverLocs((prev) => {
          const map = new Map(prev);
          map.set(next.id, { lastLat: next.lastLat, lastLng: next.lastLng, lastLocationAt: next.lastLocationAt });
          return map;
        });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (jenisDropdownRef.current && !jenisDropdownRef.current.contains(e.target as Node)) {
        setJenisDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const assignableDrivers = drivers.filter((d) => !d.isAssigned);
  const driverCount = assignableDrivers.length;
  const [customRouteCount, setCustomRouteCount] = useState<number | ''>('');
  const activeRouteCount = customRouteCount === '' ? Math.max(driverCount, 1) : customRouteCount;
  const [unscheduledSearch, setUnscheduledSearch] = useState('');
  const [unscheduledCoordFilter, setUnscheduledCoordFilter] = useState<'ALL' | 'HAS_COORDS' | 'NO_COORDS'>('ALL');
  const [unscheduledPengirimanFilter, setUnscheduledPengirimanFilter] = useState('ALL');
  const [unscheduledJenisFilter, setUnscheduledJenisFilter] = useState<Set<string>>(new Set());
  const [jenisDropdownOpen, setJenisDropdownOpen] = useState(false);
  const jenisDropdownRef = useRef<HTMLDivElement>(null);
  const [unscheduledPage, setUnscheduledPage] = useState(0);
  const UNSCHEDULED_PAGE_SIZE = 25;

  const filteredUnscheduled = useMemo(() => {
    let list = unscheduled;
    if (unscheduledCoordFilter === 'HAS_COORDS') list = list.filter((e) => e.hasCoords);
    else if (unscheduledCoordFilter === 'NO_COORDS') list = list.filter((e) => !e.hasCoords);
    if (unscheduledPengirimanFilter !== 'ALL') list = list.filter((e) => e.pengiriman === unscheduledPengirimanFilter);
    if (unscheduledJenisFilter.size > 0) list = list.filter((e) => e.items.some((i) => i.type != null && unscheduledJenisFilter.has(i.type)));
    if (unscheduledSearch.trim()) {
      const tokens = unscheduledSearch.split(',').map((t) => t.trim().toLowerCase()).filter(Boolean);
      list = list.filter((e) =>
        tokens.some((t) =>
          e.buyerName.toLowerCase().includes(t) ||
          e.sku?.toLowerCase().includes(t) ||
          e.buyerAddress?.toLowerCase().includes(t) ||
          e.salesName?.toLowerCase().includes(t),
        ),
      );
    }
    return list;
  }, [unscheduled, unscheduledSearch, unscheduledCoordFilter, unscheduledPengirimanFilter, unscheduledJenisFilter]);

  const unscheduledTotalPages = Math.max(1, Math.ceil(filteredUnscheduled.length / UNSCHEDULED_PAGE_SIZE));
  const unscheduledSafePage = Math.min(unscheduledPage, unscheduledTotalPages - 1);
  const pagedUnscheduled = filteredUnscheduled.slice(unscheduledSafePage * UNSCHEDULED_PAGE_SIZE, (unscheduledSafePage + 1) * UNSCHEDULED_PAGE_SIZE);

  const { deliveredCount } = useMemo(() => ({
    deliveredCount: scheduled.filter((e) => e.delivery?.status === 'DELIVERED').length,
  }), [scheduled]);

  const groupedByDriver = useMemo(() => {
    const map = new Map<string, ScheduledEntry[]>();
    for (const e of scheduled) {
      const id = e.delivery?.driverId ?? '__unassigned__';
      if (!map.has(id)) map.set(id, []);
      map.get(id)!.push(e);
    }
    for (const list of map.values())
      list.sort((a, b) => (a.delivery?.sequence ?? 0) - (b.delivery?.sequence ?? 0));
    return map;
  }, [scheduled]);

  // Batch selection pool: scheduled-but-unassigned entries with coords
  const unassignedStops = groupedByDriver.get('__unassigned__') ?? [];
  const selectableScheduledIds = unassignedStops
    .filter((s) => s.buyerLat != null && s.buyerLng != null)
    .map((s) => s.id);
  const allScheduledSelected = selectableScheduledIds.length > 0 && selectableScheduledIds.every((id) => selectedScheduled.has(id));

  function toggleScheduled(id: string) {
    setSelectedScheduled((prev) => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next; });
  }
  function selectAllUnassigned() {
    setSelectedScheduled(allScheduledSelected ? new Set() : new Set(selectableScheduledIds));
  }
  function clearScheduled() { setSelectedScheduled(new Set()); }

  function refresh() { router.refresh(); }
  function gotoDate(d: string) { router.push(`/admin/deliveries?date=${d}`); }
  function dateOffset(days: number) {
    const d = new Date(dateStr + 'T00:00:00Z');
    d.setUTCDate(d.getUTCDate() + days);
    return d.toISOString().slice(0, 10);
  }

  function toggleOne(id: string) {
    setSelectedUnscheduled((prev) => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next; });
  }
  function toggleAll(checked: boolean) {
    setSelectedUnscheduled(checked ? new Set(filteredUnscheduled.map((e) => e.id)) : new Set());
  }

  function handleAssignDate() {
    if (!selectedUnscheduled.size) return;
    startTransition(async () => {
      const r = await assignDeliveryDate(Array.from(selectedUnscheduled), dateStr);
      if ('error' in r) toast.error(r.error);
      else { toast.success(`${r.count} entry dijadwalkan`); setSelectedUnscheduled(new Set()); refresh(); }
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
    if (activeRouteCount < 1) { toast.error('Jumlah rute minimal 1'); return; }
    const ids = Array.from(selectedScheduled);
    if (!ids.length) { toast.error('Pilih entry untuk batch ini'); return; }
    startTransition(async () => {
      const r = await generateRoutes(dateStr, ids, activeRouteCount, startInput, maxPerDriver);
      if ('error' in r) { toast.error(r.error); return; }
      setBuckets(r.buckets); setBucketDrivers({});
      if (r.depot) setMapDepot(r.depot);
      toast.success(`${r.buckets.length} rute dibuat`);
      refresh();
    });
  }
  function handleCommitDrivers() {
    if (!buckets) return;
    const nonEmpty = buckets.filter((b) => b.length > 0);
    const payload = buckets.map((entryIds, i) => ({ driverId: bucketDrivers[i], entryIds }))
      .filter((b) => b.driverId && b.entryIds.length > 0)
      .map((b) => ({ driverId: b.driverId!, entryIds: b.entryIds }));
    if (payload.length !== nonEmpty.length) { toast.error('Pilih driver untuk semua rute'); return; }
    startTransition(async () => {
      const r = await assignDriversToBuckets(dateStr, payload);
      if ('error' in r) toast.error(r.error);
      else { toast.success('Driver di-assign'); setBuckets(null); setBucketDrivers({}); clearScheduled(); refresh(); }
    });
  }
  function handleUnassign(ids: string[]) {
    startTransition(async () => {
      const r = await unassignDeliveryDate(ids);
      if ('error' in r) toast.error(r.error);
      else { toast.success(`${r.count} entry dilepas`); refresh(); }
    });
  }
  function handleResetRoutes() {
    if (!confirm(`Reset semua rute untuk ${dateStr}?`)) return;
    startTransition(async () => {
      const r = await resetRoutes(dateStr);
      if ('error' in r) toast.error(r.error);
      else { toast.success(`${r.count} delivery di-reset`); setBuckets(null); setBucketDrivers({}); refresh(); }
    });
  }
  function handleClearSchedule() {
    if (!confirm(`Kosongkan jadwal ${dateStr}?`)) return;
    startTransition(async () => {
      const r = await clearSchedule(dateStr);
      if ('error' in r) toast.error(r.error);
      else { toast.success(`${r.count} entry dilepas`); setBuckets(null); setBucketDrivers({}); refresh(); }
    });
  }

  const allSelected = selectedUnscheduled.size === filteredUnscheduled.length && filteredUnscheduled.length > 0;
  const someSelected = selectedUnscheduled.size > 0 && !allSelected;

  // ─── shared table cell styles ────────────────────────────────────────────────
  const th = 'px-3 py-2.5 text-left text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground';
  const td = 'px-3 py-3 text-sm';

  return (
    <div className="flex flex-col gap-4 min-w-0 overflow-x-hidden">
      <Lightbox src={lightboxUrl ?? ''} alt="Bukti kirim" open={!!lightboxUrl} onClose={() => setLightboxUrl(null)} />

      {/* ── Date nav ── */}
      <div className="rounded-xl border bg-card px-4 py-3 flex flex-wrap items-center gap-2">
        <button
          onClick={() => gotoDate(dateOffset(-1))}
          className="size-8 rounded-lg border flex items-center justify-center text-sm text-muted-foreground hover:bg-muted/40 transition-colors"
        >←</button>
        <input
          type="date"
          value={dateStr}
          onChange={(e) => e.target.value && gotoDate(e.target.value)}
          className="h-8 flex-1 min-w-0 rounded-lg border bg-background px-3 text-sm focus:outline-none focus:ring-1"
          style={{ '--tw-ring-color': 'oklch(0.22 0.065 145)' } as React.CSSProperties}
        />
        <button
          onClick={() => gotoDate(dateOffset(1))}
          className="size-8 rounded-lg border flex items-center justify-center text-sm text-muted-foreground hover:bg-muted/40 transition-colors"
        >→</button>
        <span className="text-[11px] text-muted-foreground hidden sm:block">
          {scheduled.length} dijadwalkan · {unscheduled.length} belum dijadwal
        </span>
      </div>

      {/* ── Stat cards ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard accent="info"    label="Dijadwalkan"    value={scheduled.length}  sub="hari ini" />
        <StatCard accent="success" label="Terkirim"       value={deliveredCount}     sub={`dari ${scheduled.length}`} />
        <StatCard accent="warning" label="Belum Dijadwal" value={unscheduled.length} sub="menunggu" />
        <StatCard accent="primary" label="Driver Aktif"   value={driverCount}        sub="tersedia" />
      </div>

      {/* ── Map ── */}
      <div className="rounded-xl border bg-card overflow-hidden">
        <div className="px-5 py-3.5 border-b bg-muted/30">
          <h2 className="text-sm font-semibold" style={{ fontFamily: SERIF }}>
            Peta Rute &amp; Driver <span className="text-[10px] font-normal text-muted-foreground ml-1">(live)</span>
          </h2>
        </div>
        <DeliveryMap depot={mapDepot} stops={mapStops} drivers={mapDrivers} />
      </div>

      {/* ── Driver availability ── */}
      <div className="rounded-xl border bg-card overflow-hidden">
        <div className="px-5 py-3.5 border-b bg-muted/30 flex items-center justify-between">
          <h2 className="text-sm font-semibold" style={{ fontFamily: SERIF }}>
            Driver
          </h2>
          <span className="text-[11px] text-muted-foreground">
            {driverCount}/{drivers.length} tersedia
          </span>
        </div>
        {drivers.length === 0 ? (
          <p className="px-5 py-8 text-sm text-muted-foreground text-center">Belum ada user dengan role DRIVER.</p>
        ) : (
          <>
            {/* Desktop */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b bg-muted/20">
                    <th className={cn(th, 'pl-5')}>Driver</th>
                    <th className={th}>Telepon</th>
                    <th className={th}>Lokasi (live)</th>
                    <th className={cn(th, 'pr-5')}>Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {drivers.map((d) => {
                    const loc = driverLocs.get(d.id);
                    return (
                      <tr key={d.id} className={cn('transition-colors', d.isAssigned ? 'bg-warning-bg/30' : 'hover:bg-muted/20')}>
                        <td className={cn(td, 'pl-5')}>
                          <div className="flex items-center gap-2.5">
                            <div className={cn('size-7 shrink-0 rounded-full flex items-center justify-center text-[11px] font-bold select-none', d.isAssigned ? 'bg-warning-bg text-warning-fg' : 'bg-primary/10 text-primary')}>
                              {initials(d.name)}
                            </div>
                            <span className="font-medium text-foreground text-sm">{d.name}</span>
                          </div>
                        </td>
                        <td className={cn(td, 'text-muted-foreground text-xs')}>{d.phone ?? '—'}</td>
                        <td className={td}>
                          {loc?.lastLat != null && loc?.lastLng != null ? (
                            <div className="flex flex-col gap-0.5">
                              <span className="font-mono text-xs text-foreground">{loc.lastLat.toFixed(5)}, {loc.lastLng.toFixed(5)}</span>
                              {loc.lastLocationAt && <span className="text-[10px] text-muted-foreground">{new Date(loc.lastLocationAt).toLocaleTimeString()}</span>}
                            </div>
                          ) : (
                            <span className="text-[11px] text-muted-foreground/60">no signal</span>
                          )}
                        </td>
                        <td className={cn(td, 'pr-5')}>
                          {d.isAssigned
                            ? <StatusToken intent="warning" dot>On Delivery</StatusToken>
                            : <StatusToken intent="success" dot>Available</StatusToken>
                          }
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {/* Mobile */}
            <div className="sm:hidden divide-y">
              {drivers.map((d) => {
                const loc = driverLocs.get(d.id);
                return (
                  <div key={d.id} className={cn('px-4 py-3 flex items-center gap-3', d.isAssigned && 'bg-warning-bg/30')}>
                    <div className={cn('size-9 shrink-0 rounded-full flex items-center justify-center text-xs font-bold select-none', d.isAssigned ? 'bg-warning-bg text-warning-fg' : 'bg-primary/10 text-primary')}>
                      {initials(d.name)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm text-foreground truncate">{d.name}</span>
                        {d.isAssigned ? <StatusToken intent="warning" dot>On Delivery</StatusToken> : <StatusToken intent="success" dot>Available</StatusToken>}
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5">
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
      <div className="rounded-xl border bg-card overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b bg-muted/30 px-5 py-3.5">
          <h2 className="text-sm font-semibold" style={{ fontFamily: SERIF }}>
            Belum Dijadwalkan
            <span className="ml-1.5 text-[11px] font-normal text-muted-foreground">({unscheduled.length})</span>
          </h2>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={handleBackfill} disabled={pending}>
              Backfill Coords
            </Button>
            <Button
              size="sm"
              disabled={pending || !selectedUnscheduled.size}
              onClick={handleAssignDate}
              style={selectedUnscheduled.size > 0 ? { background: 'var(--primary)', color: 'var(--sidebar-primary)' } : {}}
            >
              Jadwalkan {selectedUnscheduled.size > 0 && `(${selectedUnscheduled.size})`}
            </Button>
          </div>
        </div>

        {/* Filter bar */}
        <div className="flex flex-wrap items-center gap-2 border-b bg-muted/10 px-5 py-2.5">
          <div className="relative flex-1 min-w-[160px]">
            <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
            <Input
              value={unscheduledSearch}
              onChange={(ev) => { setUnscheduledSearch(ev.target.value); setUnscheduledPage(0); }}
              placeholder="Cari nama, SKU, alamat, sales… (pisah koma)"
              className="h-8 text-xs pl-8"
            />
          </div>
          <select
            value={unscheduledPengirimanFilter}
            onChange={(ev) => { setUnscheduledPengirimanFilter(ev.target.value); setUnscheduledPage(0); }}
            className="h-8 rounded-md border bg-background px-2 text-xs text-foreground focus:outline-none focus:ring-1"
          >
            <option value="ALL">Semua Pengiriman</option>
            {PENGIRIMAN_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          <div ref={jenisDropdownRef} className="relative">
            <button
              type="button"
              onClick={() => setJenisDropdownOpen((o) => !o)}
              className={cn(
                'h-8 rounded-md border bg-background px-2 text-xs text-foreground focus:outline-none flex items-center gap-1.5 whitespace-nowrap transition-colors',
                unscheduledJenisFilter.size > 0 ? 'border-foreground/40 font-medium' : 'border-border',
              )}
            >
              {unscheduledJenisFilter.size === 0
                ? 'Semua Jenis'
                : Array.from(unscheduledJenisFilter).map((t) => t === 'KAMBING' ? 'Kambing' : t === 'DOMBA' ? 'Domba' : 'Sapi').join(', ')}
              <svg className="h-3.5 w-3.5 text-muted-foreground shrink-0" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" /></svg>
            </button>
            {jenisDropdownOpen && (
              <div className="absolute left-0 top-full mt-1 z-50 min-w-[120px] rounded-lg border bg-card shadow-md py-1">
                {(['KAMBING', 'DOMBA', 'SAPI'] as const).map((type) => {
                  const label = type === 'KAMBING' ? 'Kambing' : type === 'DOMBA' ? 'Domba' : 'Sapi';
                  const checked = unscheduledJenisFilter.has(type);
                  return (
                    <label key={type} className="flex items-center gap-2 px-3 py-1.5 text-xs text-foreground hover:bg-muted/40 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => {
                          setUnscheduledJenisFilter((prev) => {
                            const next = new Set(prev);
                            if (checked) next.delete(type); else next.add(type);
                            return next;
                          });
                          setUnscheduledPage(0);
                        }}
                        className="h-3.5 w-3.5 rounded border-border"
                      />
                      {label}
                    </label>
                  );
                })}
              </div>
            )}
          </div>
          <select
            value={unscheduledCoordFilter}
            onChange={(ev) => { setUnscheduledCoordFilter(ev.target.value as 'ALL' | 'HAS_COORDS' | 'NO_COORDS'); setUnscheduledPage(0); }}
            className="h-8 rounded-md border bg-background px-2 text-xs text-foreground focus:outline-none focus:ring-1"
          >
            <option value="ALL">Semua Koordinat</option>
            <option value="HAS_COORDS">Punya Koordinat</option>
            <option value="NO_COORDS">Belum Ada</option>
          </select>
          {(unscheduledSearch || unscheduledCoordFilter !== 'ALL' || unscheduledPengirimanFilter !== 'ALL' || unscheduledJenisFilter.size > 0) && (
            <button
              type="button"
              onClick={() => { setUnscheduledSearch(''); setUnscheduledCoordFilter('ALL'); setUnscheduledPengirimanFilter('ALL'); setUnscheduledJenisFilter(new Set()); setUnscheduledPage(0); }}
              className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2"
            >
              Reset
            </button>
          )}
          {filteredUnscheduled.length !== unscheduled.length && (
            <span className="text-[11px] text-muted-foreground ml-auto">{filteredUnscheduled.length} dari {unscheduled.length}</span>
          )}
        </div>

        {selectedUnscheduled.size > 0 && (
          <div className="mx-5 mt-3 flex items-center gap-2 rounded-lg border border-info-ring/40 bg-info-bg px-3 py-2 text-sm text-info-fg">
            <span>{selectedUnscheduled.size} dipilih</span>
            <button className="ml-auto text-xs underline hover:no-underline" onClick={() => setSelectedUnscheduled(new Set())}>Batal</button>
          </div>
        )}

        {unscheduled.length === 0 ? (
          <p className="px-5 py-8 text-sm text-muted-foreground text-center">Semua entry sudah dijadwalkan.</p>
        ) : filteredUnscheduled.length === 0 ? (
          <p className="px-5 py-8 text-sm text-muted-foreground text-center">Tidak ada entry yang cocok dengan filter.</p>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b bg-muted/20">
                    <th className="pl-5 py-2.5 w-12">
                      <input
                        type="checkbox"
                        checked={allSelected}
                        ref={(el) => { if (el) el.indeterminate = someSelected; }}
                        onChange={(e) => toggleAll(e.target.checked)}
                        className="size-4 rounded border-border cursor-pointer"
                      />
                    </th>
                    <th className={cn(th, 'w-32')}>Tag</th>
                    <th className={cn(th, 'w-36')}>Hewan</th>
                    <th className={th}>Pembeli</th>
                    <th className={th}>Alamat</th>
                    <th className={cn(th, 'w-28')}>Sales</th>
                    <th className={cn(th, 'w-28')}>Pengiriman</th>
                    <th className={cn(th, 'w-52 pr-5')}>Koordinat</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {pagedUnscheduled.map((e) => (
                    <UnscheduledRow key={e.id} entry={e} selected={selectedUnscheduled.has(e.id)} onToggle={() => toggleOne(e.id)} pending={pending} startTransition={startTransition} />
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="sm:hidden divide-y">
              <div className="px-4 py-2 bg-muted/20 flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={allSelected}
                  ref={(el) => { if (el) el.indeterminate = someSelected; }}
                  onChange={(e) => toggleAll(e.target.checked)}
                  className="size-4 rounded border-border cursor-pointer"
                />
                <span className="text-xs text-muted-foreground">Pilih semua</span>
              </div>
              {pagedUnscheduled.map((e) => (
                <UnscheduledCard key={e.id} entry={e} selected={selectedUnscheduled.has(e.id)} onToggle={() => toggleOne(e.id)} pending={pending} startTransition={startTransition} />
              ))}
            </div>

            {/* Pagination */}
            {unscheduledTotalPages > 1 && (
              <div className="flex items-center justify-between gap-2 border-t px-5 py-3">
                <span className="text-[11px] text-muted-foreground">
                  {unscheduledSafePage * UNSCHEDULED_PAGE_SIZE + 1}–{Math.min((unscheduledSafePage + 1) * UNSCHEDULED_PAGE_SIZE, filteredUnscheduled.length)} dari {filteredUnscheduled.length}
                </span>
                <div className="flex items-center gap-1">
                  <button type="button" disabled={unscheduledSafePage === 0} onClick={() => setUnscheduledPage(unscheduledSafePage - 1)}
                    className="px-2.5 py-1 text-xs rounded-md border text-muted-foreground hover:bg-muted/40 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">←</button>
                  <span className="text-xs text-muted-foreground px-2">{unscheduledSafePage + 1} / {unscheduledTotalPages}</span>
                  <button type="button" disabled={unscheduledSafePage >= unscheduledTotalPages - 1} onClick={() => setUnscheduledPage(unscheduledSafePage + 1)}
                    className="px-2.5 py-1 text-xs rounded-md border text-muted-foreground hover:bg-muted/40 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">→</button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Route management ── */}
      <div className="rounded-xl border bg-card overflow-hidden">
        <div className="border-b bg-muted/30 px-5 py-3.5 flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold" style={{ fontFamily: SERIF }}>
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
            <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-background px-3 py-1.5">
              <label className="text-[11px] text-muted-foreground font-medium whitespace-nowrap">Bagi ke</label>
              <input
                type="number" min={1}
                value={customRouteCount}
                onChange={(e) => setCustomRouteCount(e.target.value === '' ? '' : parseInt(e.target.value))}
                placeholder={String(Math.max(driverCount, 1))}
                className="h-6 w-10 rounded bg-muted/30 px-1 text-xs text-center border focus:outline-none"
              />
              <span className="text-[11px] text-muted-foreground">rute · maks</span>
              <input
                type="number" min={1} max={999}
                value={maxPerDriver}
                onChange={(e) => setMaxPerDriver(Math.max(1, parseInt(e.target.value) || 1))}
                className="h-6 w-10 rounded bg-muted/30 px-1 text-xs text-center border focus:outline-none"
              />
              <span className="text-[11px] text-muted-foreground">/driver</span>
              <button
                onClick={handleGenerate}
                disabled={pending || !scheduled.length}
                className="h-6 px-3 rounded-md text-xs font-semibold transition-all disabled:opacity-40"
                style={{ background: 'var(--primary)', color: 'var(--sidebar-primary)' }}
              >
                Generate
              </button>
            </div>
            <button
              type="button"
              onClick={selectAllUnassigned}
              disabled={selectableScheduledIds.length === 0}
              className="h-8 px-3 rounded-lg border text-xs text-muted-foreground hover:bg-muted/40 disabled:opacity-40 transition-colors"
            >
              {allScheduledSelected ? 'Batal pilih' : 'Pilih semua belum di-assign'}
            </button>
            {selectedScheduled.size > 0 && (
              <span className="text-[11px] font-medium text-info-fg bg-info-bg rounded-full px-2.5 py-1">
                {selectedScheduled.size} dipilih untuk batch
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <label className="text-[11px] text-muted-foreground whitespace-nowrap font-medium">Titik awal:</label>
            <input
              type="text"
              placeholder="lat,lng atau Google Maps URL"
              value={startInput}
              onChange={(e) => updateStartInput(e.target.value)}
              className="h-8 flex-1 min-w-0 rounded-lg border bg-background px-3 text-xs text-foreground focus:outline-none focus:ring-1"
            />
          </div>
        </div>

        <div className="p-4 flex flex-col gap-4">
          {/* Bucket driver assignment */}
          {buckets && (
            <div className="flex flex-col gap-3 rounded-xl border border-info-ring/40 bg-info-bg/30 overflow-hidden">
              <div className="flex flex-wrap items-center justify-between gap-2 px-4 pt-3">
                <p className="text-sm font-semibold" style={{ fontFamily: SERIF }}>Pilih driver tiap rute</p>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => setBuckets(null)}>Batal</Button>
                  <Button size="sm" onClick={handleCommitDrivers} disabled={pending}
                    style={{ background: 'var(--primary)', color: 'var(--sidebar-primary)' }}>
                    Commit
                  </Button>
                </div>
              </div>
              <div className="px-4 pb-4 flex flex-col gap-2">
                {buckets.map((entryIds, i) => (
                  <div key={i} className="flex flex-wrap items-center gap-2 rounded-lg border bg-card px-3 py-2">
                    <span className="text-sm font-medium text-foreground">🚚 Rute {i + 1}</span>
                    <span className="text-[11px] text-muted-foreground">{entryIds.length} stop</span>
                    <select
                      value={bucketDrivers[i] ?? ''}
                      onChange={(e) => setBucketDrivers((prev) => ({ ...prev, [i]: e.target.value }))}
                      className="ml-auto h-8 w-full sm:w-auto rounded-lg border bg-background px-2 text-xs text-foreground focus:outline-none"
                    >
                      <option value="">Pilih driver…</option>
                      {assignableDrivers.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                    </select>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Per-driver route groups */}
          {Array.from(groupedByDriver.entries()).map(([driverId, stops]) => {
            const isUnassigned = driverId === '__unassigned__';
            const driverName = isUnassigned ? 'Belum di-assign' : (stops[0]?.delivery?.driver?.name ?? driverId);
            const doneCount = stops.filter((s) => s.delivery?.status === 'DELIVERED').length;
            const failCount = stops.filter((s) => s.delivery?.status === 'FAILED').length;
            const assignedStopsInBucket = stops.filter((s) => s.delivery?.status === 'ASSIGNED');
            const bucketTotalItems = assignedStopsInBucket.flatMap((s) => s.items).length;
            const bucketLoadedItems = assignedStopsInBucket.flatMap((s) => s.items).filter((i) => checkedItems.has(i.itemId)).length;
            return (
              <div key={driverId} className="rounded-xl border bg-card overflow-hidden">
                {/* group header */}
                <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-muted/30 px-4 py-2.5">
                  <div className="flex items-center gap-2.5">
                    <div
                      className={cn('size-8 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0 select-none', isUnassigned ? 'bg-warning-bg text-warning-fg' : 'bg-primary')}
                      style={!isUnassigned ? { color: 'var(--sidebar-primary)' } : undefined}
                    >
                      {isUnassigned ? '?' : initials(driverName)}
                    </div>
                    <div>
                      <span className="text-sm font-semibold text-foreground" style={{ fontFamily: SERIF }}>{driverName}</span>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] text-muted-foreground">{stops.length} stop</span>
                        {doneCount > 0 && <span className="text-[10px] text-success-fg">✓ {doneCount} terkirim</span>}
                        {failCount > 0 && <span className="text-[10px] text-danger-fg">✗ {failCount} gagal</span>}
                        {bucketTotalItems > 0 && (
                          <span className={cn(
                            'text-[10px] font-semibold px-1.5 py-0.5 rounded-full',
                            bucketLoadedItems === bucketTotalItems ? 'bg-success-bg text-success-fg' : bucketLoadedItems > 0 ? 'bg-warning-bg text-warning-fg' : 'bg-muted text-muted-foreground',
                          )}>
                            {bucketLoadedItems}/{bucketTotalItems} dimuat
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <Button size="sm" variant="ghost" className="text-xs h-7" onClick={() => handleUnassign(stops.map((s) => s.id))} disabled={pending}>
                    Lepas
                  </Button>
                </div>

                {/* Desktop stops table */}
                <div className="hidden sm:block overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b bg-muted/10">
                        {isUnassigned && (
                          <th className={cn(th, 'pl-4 w-10')}>
                            <Checkbox
                              checked={allScheduledSelected}
                              disabled={selectableScheduledIds.length === 0}
                              onCheckedChange={selectAllUnassigned}
                              className="size-3.5"
                            />
                          </th>
                        )}
                        <th className={cn(th, 'pl-4 w-10')}>#</th>
                        <th className={cn(th, 'w-36')}>Hewan / SKU</th>
                        <th className={th}>Pembeli</th>
                        <th className={cn(th, 'w-28')}>Sales</th>
                        <th className={th}>Alamat</th>
                        <th className={cn(th, 'w-28 text-center')}>Pengiriman</th>
                        <th className={cn(th, 'w-36 text-center')}>Status</th>
                        <th className={cn(th, 'w-36')}>Bukti / Catatan</th>
                        <th className={cn(th, 'w-10 pr-4')}></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {stops.map((s) => {
                        const href = navigationUrl({ buyerMaps: s.buyerMaps, buyerLat: s.buyerLat, buyerLng: s.buyerLng, buyerAddress: s.buyerAddress });
                        const ds = DELIVERY_STATUS[s.delivery?.status ?? 'PENDING'] ?? DELIVERY_STATUS.PENDING;
                        return (
                          <tr key={s.id} className="hover:bg-muted/20 transition-colors">
                            {isUnassigned && (
                              <td className={cn(td, 'pl-4')}>
                                {s.buyerLat != null && s.buyerLng != null ? (
                                  <Checkbox
                                    checked={selectedScheduled.has(s.id)}
                                    onCheckedChange={() => toggleScheduled(s.id)}
                                    className="size-3.5"
                                  />
                                ) : (
                                  <span className="text-[9px] text-muted-foreground" title="Tanpa koordinat — tidak bisa dirutekan">⚠</span>
                                )}
                              </td>
                            )}
                            <td className={cn(td, 'pl-4')}>
                              <span
                                className="inline-flex size-5 items-center justify-center rounded-full text-[10px] font-bold text-white"
                                style={{ background: `var(--${ds.intent}-ring)` }}
                              >
                                {(s.delivery?.sequence ?? 0) + 1}
                              </span>
                            </td>
                            <td className={td}>
                              {s.delivery?.status === 'ASSIGNED' && s.delivery.id && (
                                <div className="flex items-center justify-between mb-1">
                                  <span className={cn(
                                    'text-[10px] font-semibold px-1.5 py-0.5 rounded-full',
                                    s.items.every((i) => checkedItems.has(i.itemId)) ? 'bg-success-bg text-success-fg' : s.items.some((i) => checkedItems.has(i.itemId)) ? 'bg-warning-bg text-warning-fg' : 'bg-muted text-muted-foreground',
                                  )}>
                                    {s.items.filter((i) => checkedItems.has(i.itemId)).length}/{s.items.length}
                                  </span>
                                  <button
                                    className="text-[10px] text-muted-foreground underline underline-offset-2 disabled:opacity-40"
                                    disabled={togglePending}
                                    onClick={() => handleAdminToggleAll(s.delivery!.id, s.items, !s.items.every((i) => checkedItems.has(i.itemId)))}
                                  >
                                    {s.items.every((i) => checkedItems.has(i.itemId)) ? 'Hapus' : 'Semua'}
                                  </button>
                                </div>
                              )}
                              <div className="flex flex-col gap-1">
                                {s.items.map((item) => {
                                  const isChecked = checkedItems.has(item.itemId);
                                  const isAssigned = s.delivery?.status === 'ASSIGNED';
                                  return (
                                    <div
                                      key={item.itemId}
                                      className={cn('flex items-center gap-1.5', isAssigned ? 'cursor-pointer' : '')}
                                      onClick={isAssigned && !togglePending ? () => handleAdminToggleItem(item.itemId, !isChecked) : undefined}
                                    >
                                      {isAssigned && (
                                        <Checkbox
                                          checked={isChecked}
                                          disabled={togglePending}
                                          onCheckedChange={(v) => handleAdminToggleItem(item.itemId, !!v)}
                                          onClick={(e) => e.stopPropagation()}
                                          className="size-3.5 shrink-0"
                                        />
                                      )}
                                      <div>
                                        <div className={cn('font-medium text-xs', isAssigned && isChecked ? 'text-success-fg' : 'text-foreground')}>
                                          {item.type ? item.type.charAt(0) + item.type.slice(1).toLowerCase() : ''}{item.grade ? ` ${item.grade}` : ''}
                                        </div>
                                        <LivestockTagPreview item={item} />
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </td>
                            <td className={td}>
                              <span className="font-medium text-foreground">{s.buyerName}</span>
                              {s.buyerPhone && <span className="block text-xs text-muted-foreground">{s.buyerPhone}</span>}
                            </td>
                            <td className={cn(td, 'text-xs text-muted-foreground whitespace-nowrap')}>{s.salesName ?? '—'}</td>
                            <td className={cn(td, 'text-xs text-muted-foreground max-w-[180px] truncate')} title={s.buyerAddress ?? undefined}>{s.buyerAddress ?? '—'}</td>
                            <td className={cn(td, 'text-center')}>
                              {s.pengiriman
                                ? <StatusToken intent="info" outlined size="sm">{formatPengiriman(s.pengiriman)}</StatusToken>
                                : <span className="text-xs text-muted-foreground">—</span>}
                            </td>
                            <td className={cn(td, 'text-center')}>
                              <StatusToken intent={ds.intent}>{ds.label}</StatusToken>
                            </td>
                            <td className={td}>
                              {s.delivery?.status === 'DELIVERED' && s.delivery.proofPhotoUrl ? (
                                <button
                                  type="button"
                                  onClick={() => setLightboxUrl(s.delivery!.proofPhotoUrl!)}
                                  className="group relative block size-14 rounded-lg overflow-hidden border hover:ring-2 ring-info-ring transition-all"
                                >
                                  {/* eslint-disable-next-line @next/next/no-img-element */}
                                  <img src={s.delivery.proofPhotoUrl} alt="bukti kirim" className="w-full h-full object-cover" />
                                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                                    <span className="opacity-0 group-hover:opacity-100 text-white text-[10px] font-semibold transition-opacity">buka</span>
                                  </div>
                                </button>
                              ) : s.delivery?.status === 'FAILED' && s.delivery.notes ? (
                                <span className="text-[11px] text-danger-fg" title={s.delivery.notes}>
                                  ⚠ {s.delivery.notes}
                                </span>
                              ) : (
                                <span className="text-xs text-muted-foreground/40">—</span>
                              )}
                            </td>
                            <td className={cn(td, 'pr-4 text-right')}>
                              <div className="flex items-center justify-end gap-1">
                                {s.delivery?.id && (s.delivery.status === 'ASSIGNED' || s.delivery.status === 'ON_DELIVERY') && (
                                  <button
                                    type="button"
                                    title="Surat Jalan"
                                    onClick={() => window.open(`/api/deliveries/${s.delivery!.id}/surat-jalan`, '_blank')}
                                    className="inline-flex items-center justify-center size-7 rounded-lg border text-muted-foreground hover:bg-muted/40 hover:text-foreground transition-colors"
                                  >
                                    <Printer className="size-3.5" />
                                  </button>
                                )}
                                {href && (
                                  <a href={href} target="_blank" rel="noreferrer" title="Buka di Maps"
                                    className="inline-flex items-center justify-center size-7 rounded-lg border text-muted-foreground hover:bg-muted/40 hover:text-foreground transition-colors text-sm">
                                    ↗
                                  </a>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Mobile stop cards */}
                <div className="sm:hidden divide-y">
                  {stops.map((s) => {
                    const href = navigationUrl({ buyerMaps: s.buyerMaps, buyerLat: s.buyerLat, buyerLng: s.buyerLng, buyerAddress: s.buyerAddress });
                    const dsMob = DELIVERY_STATUS[s.delivery?.status ?? 'PENDING'] ?? DELIVERY_STATUS.PENDING;
                    return (
                      <div key={s.id} className="px-4 py-3 flex flex-col gap-1.5">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            {isUnassigned && (
                              s.buyerLat != null && s.buyerLng != null ? (
                                <Checkbox
                                  checked={selectedScheduled.has(s.id)}
                                  onCheckedChange={() => toggleScheduled(s.id)}
                                  className="size-4 shrink-0"
                                />
                              ) : (
                                <span className="text-[10px] text-muted-foreground shrink-0" title="Tanpa koordinat">⚠</span>
                              )
                            )}
                            <span
                              className="size-5 shrink-0 rounded-full flex items-center justify-center text-[10px] font-bold text-white"
                              style={{ background: `var(--${dsMob.intent}-ring)` }}
                            >
                              {(s.delivery?.sequence ?? 0) + 1}
                            </span>
                            <div className="min-w-0">
                              <span className="font-medium text-sm text-foreground truncate block">{s.buyerName}</span>
                              {s.salesName && <span className="text-[11px] text-muted-foreground">{s.salesName}</span>}
                              {s.delivery?.status === 'DELIVERED' && s.delivery.proofPhotoUrl && (
                                <button
                                  type="button"
                                  onClick={() => setLightboxUrl(s.delivery!.proofPhotoUrl!)}
                                  className="group relative mt-1 block size-12 rounded-lg overflow-hidden border hover:ring-2 ring-info-ring transition-all"
                                >
                                  {/* eslint-disable-next-line @next/next/no-img-element */}
                                  <img src={s.delivery.proofPhotoUrl} alt="bukti kirim" className="w-full h-full object-cover" />
                                </button>
                              )}
                              {s.delivery?.status === 'FAILED' && s.delivery.notes && (
                                <span className="block text-[11px] text-danger-fg">
                                  ⚠ {s.delivery.notes}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            {s.pengiriman && <StatusToken intent="info" outlined size="sm">{formatPengiriman(s.pengiriman)}</StatusToken>}
                            <StatusToken intent={dsMob.intent}>{dsMob.label}</StatusToken>
                            {s.delivery?.id && (s.delivery.status === 'ASSIGNED' || s.delivery.status === 'ON_DELIVERY') && (
                              <button
                                type="button"
                                title="Surat Jalan"
                                onClick={() => window.open(`/api/deliveries/${s.delivery!.id}/surat-jalan`, '_blank')}
                                className="inline-flex items-center justify-center size-7 rounded-lg border text-muted-foreground hover:bg-muted/40 transition-colors shrink-0"
                              >
                                <Printer className="size-3.5" />
                              </button>
                            )}
                            {href && (
                              <a href={href} target="_blank" rel="noreferrer"
                                className="inline-flex items-center justify-center size-7 rounded-lg border text-muted-foreground hover:bg-muted/40 transition-colors text-sm shrink-0">
                                ↗
                              </a>
                            )}
                          </div>
                        </div>
                        {s.delivery?.status === 'ASSIGNED' && s.delivery.id ? (
                          <div className="rounded-lg border bg-muted/20 overflow-hidden">
                            <div className="flex items-center justify-between px-2.5 py-1.5 border-b bg-muted/30">
                              <span className={cn(
                                'text-[10px] font-semibold px-1.5 py-0.5 rounded-full',
                                s.items.every((i) => checkedItems.has(i.itemId)) ? 'bg-success-bg text-success-fg' : s.items.some((i) => checkedItems.has(i.itemId)) ? 'bg-warning-bg text-warning-fg' : 'bg-muted text-muted-foreground',
                              )}>
                                {s.items.filter((i) => checkedItems.has(i.itemId)).length}/{s.items.length} dimuat
                              </span>
                              <button
                                className="text-[10px] text-muted-foreground underline underline-offset-2 disabled:opacity-40"
                                disabled={togglePending}
                                onClick={() => handleAdminToggleAll(s.delivery!.id, s.items, !s.items.every((i) => checkedItems.has(i.itemId)))}
                              >
                                {s.items.every((i) => checkedItems.has(i.itemId)) ? 'Hapus semua' : 'Centang semua'}
                              </button>
                            </div>
                            <div className="px-2.5 py-2 flex flex-col gap-2">
                              {s.items.map((item) => {
                                const isChecked = checkedItems.has(item.itemId);
                                return (
                                  <div
                                    key={item.itemId}
                                    className="flex items-center gap-2 cursor-pointer"
                                    onClick={!togglePending ? () => handleAdminToggleItem(item.itemId, !isChecked) : undefined}
                                  >
                                    <Checkbox
                                      checked={isChecked}
                                      disabled={togglePending}
                                      onCheckedChange={(v) => handleAdminToggleItem(item.itemId, !!v)}
                                      onClick={(e) => e.stopPropagation()}
                                      className="size-4 shrink-0"
                                    />
                                    <span className={cn('text-xs font-medium', isChecked ? 'text-success-fg' : 'text-foreground')}>
                                      {item.type ? item.type.charAt(0) + item.type.slice(1).toLowerCase() : ''}{item.grade ? ` ${item.grade}` : ''}
                                    </span>
                                    <span className="ml-auto"><LivestockTagPreview item={item} /></span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        ) : (
                          <div className="flex flex-wrap gap-1 text-xs">
                            {s.items.map((item) => (
                              <span key={item.itemId} className="inline-flex items-center gap-1">
                                <span className="font-medium text-foreground">
                                  {item.type ? item.type.charAt(0) + item.type.slice(1).toLowerCase() : ''}{item.grade ? ` ${item.grade}` : ''}
                                </span>
                                <LivestockTagPreview item={item} />
                              </span>
                            ))}
                          </div>
                        )}
                        {s.buyerAddress && <p className="text-xs text-muted-foreground line-clamp-2">{s.buyerAddress}</p>}
                        {s.buyerPhone && <p className="text-xs text-muted-foreground">{s.buyerPhone}</p>}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {!scheduled.length && !buckets && (
            <div className="py-12 text-center">
              <p className="text-sm text-muted-foreground">Belum ada entry dijadwalkan untuk tanggal ini.</p>
            </div>
          )}
        </div>
      </div>

    </div>
  );
}

// ─── Livestock tag — click to preview ─────────────────────────────────────────

type LivestockPreviewItem = ScheduledEntry['items'][number];

function LivestockTagPreview({ item }: { item: LivestockPreviewItem }) {
  const [open, setOpen] = useState(false);
  const tag = item.tag ?? item.sku ?? '—';
  const typeLabel = item.type
    ? item.type.charAt(0) + item.type.slice(1).toLowerCase() + (item.grade ? ` Grade ${item.grade}` : '')
    : '—';
  const conditionLabel = item.condition === 'SEHAT' ? 'Sehat' : item.condition === 'SAKIT' ? 'Sakit' : item.condition === 'MATI' ? 'Mati' : null;
  const weight = item.weightMin != null || item.weightMax != null
    ? [item.weightMin, item.weightMax].filter(Boolean).join(' – ') + ' kg'
    : null;

  return (
    <>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setOpen(true); }}
        className="font-mono text-[11px] bg-muted/50 hover:bg-muted px-1.5 py-0.5 rounded text-muted-foreground hover:text-foreground transition-colors underline underline-offset-2 decoration-dotted"
      >
        {tag}
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-xs p-0 overflow-hidden">
          <DialogHeader className="sr-only">
            <DialogTitle>{tag}</DialogTitle>
          </DialogHeader>
          {item.photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={item.photoUrl} alt={tag} className="w-full aspect-square object-cover" />
          ) : (
            <div className="w-full aspect-square bg-muted flex items-center justify-center">
              <span className="text-muted-foreground text-sm">Tidak ada foto</span>
            </div>
          )}
          <div className="px-4 py-3 flex flex-col gap-1.5">
            <p className="font-mono font-bold text-base text-foreground">{tag}</p>
            <p className="text-sm text-muted-foreground">{typeLabel}</p>
            {conditionLabel && (
              <p className={cn(
                'text-xs font-medium',
                item.condition === 'SEHAT' ? 'text-success-fg' : item.condition === 'SAKIT' ? 'text-warning-fg' : 'text-danger-fg',
              )}>{conditionLabel}</p>
            )}
            {weight && <p className="text-xs text-muted-foreground">Berat: {weight}</p>}
          </div>
        </DialogContent>
      </Dialog>
    </>
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
    const parsed = parseLatLngCoord(coordInput);
    if (!parsed && coordInput.trim() !== '') { toast.error('Format: lat,lng (contoh: -6.123,106.456)'); return; }
    startTransition(async () => {
      const r = await updateEntryCoordinates(e.id, parsed?.lat ?? null, parsed?.lng ?? null);
      if ('error' in r) toast.error(r.error);
      else { toast.success('Koordinat disimpan'); setEditing(false); }
    });
  }

  return (
    <tr
      onClick={() => onToggle()}
      className={cn('cursor-pointer transition-colors hover:bg-muted/20', selected && 'bg-muted/30')}
    >
      <td className="pl-5 py-3" onClick={(ev) => ev.stopPropagation()}>
        <input type="checkbox" checked={selected} onChange={onToggle} className="size-4 rounded border-border cursor-pointer" />
      </td>
      <td className={td}>
        <div className="flex flex-col gap-0.5">
          {e.items.map((item) => (
            <span key={item.sku ?? item.tag} className="block font-mono text-[11px] bg-muted/50 px-2 py-0.5 rounded text-muted-foreground">
              {item.tag ?? item.sku ?? '—'}
            </span>
          ))}
        </div>
      </td>
      <td className={td}>
        <div className="flex flex-col gap-0.5">
          {e.items.map((item) => {
            const typeLabel = item.type ? item.type.charAt(0) + item.type.slice(1).toLowerCase() : '—';
            const detail = item.type === 'SAPI'
              ? (item.weightMin && item.weightMax ? ` · ${item.weightMin}-${item.weightMax}kg` : '')
              : (item.grade ? ` ${item.grade}` : '');
            return (
              <span key={item.sku ?? item.tag} className="block text-xs text-foreground">{typeLabel}{detail}</span>
            );
          })}
        </div>
      </td>
      <td className={cn(td, 'font-medium text-foreground')}>{e.buyerName}</td>
      <td className={cn(td, 'text-xs text-muted-foreground max-w-[180px] truncate')} title={e.buyerAddress ?? undefined}>{e.buyerAddress ?? '—'}</td>
      <td className={cn(td, 'text-xs text-muted-foreground whitespace-nowrap')}>{e.salesName ?? '—'}</td>
      <td className={cn(td, 'text-xs text-muted-foreground')}>{formatPengiriman(e.pengiriman)}</td>
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
          <button type="button" onClick={() => setEditing(true)} className="inline-flex items-center gap-1">
            {e.hasCoords
              ? <StatusToken intent="success" outlined size="sm">📍 {e.buyerLat?.toFixed(4)},{e.buyerLng?.toFixed(4)}</StatusToken>
              : <StatusToken intent="danger" outlined size="sm">📍 Belum ada</StatusToken>
            }
            <span className="text-xs text-muted-foreground ml-1">✎</span>
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
    const parsed = parseLatLngCoord(coordInput);
    if (!parsed && coordInput.trim() !== '') { toast.error('Format: lat,lng'); return; }
    startTransition(async () => {
      const r = await updateEntryCoordinates(e.id, parsed?.lat ?? null, parsed?.lng ?? null);
      if ('error' in r) toast.error(r.error);
      else { toast.success('Koordinat disimpan'); setEditing(false); }
    });
  }

  return (
    <div className={cn('px-4 py-3 flex flex-col gap-2', selected && 'bg-muted/30')}>
      <div className="flex items-start gap-3">
        <input
          type="checkbox"
          checked={selected}
          onChange={onToggle}
          className="size-4 mt-0.5 rounded border-border cursor-pointer shrink-0"
        />
        <div className="flex-1 min-w-0" onClick={onToggle}>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-sm text-foreground truncate">{e.buyerName}</span>
            {e.pengiriman && <StatusToken intent="info" outlined size="sm">{formatPengiriman(e.pengiriman)}</StatusToken>}
          </div>
          <div className="mt-1 flex flex-col gap-0.5">
            {e.items.map((item) => {
              const typeLabel = item.type ? item.type.charAt(0) + item.type.slice(1).toLowerCase() : '—';
              const detail = item.type === 'SAPI'
                ? (item.weightMin && item.weightMax ? ` · ${item.weightMin}-${item.weightMax}kg` : '')
                : (item.grade ? ` ${item.grade}` : '');
              return (
                <div key={item.sku ?? item.tag} className="flex items-center gap-1.5">
                  <span className="font-mono text-[11px] bg-muted/50 px-1.5 py-0.5 rounded text-muted-foreground">
                    {item.tag ?? item.sku ?? '—'}
                  </span>
                  <span className="text-xs text-foreground">{typeLabel}{detail}</span>
                </div>
              );
            })}
          </div>
          {e.buyerAddress && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{e.buyerAddress}</p>}
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
            {e.hasCoords
              ? <StatusToken intent="success" outlined size="sm">📍 {e.buyerLat?.toFixed(4)},{e.buyerLng?.toFixed(4)}</StatusToken>
              : <StatusToken intent="danger" outlined size="sm">📍 Belum ada</StatusToken>
            }
            <span className="text-xs text-muted-foreground ml-1">✎</span>
          </button>
        )}
      </div>
    </div>
  );
}
