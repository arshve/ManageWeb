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
  recalculateDriverRoute,
  addEntriesToDriverRoute,
  resetDriverRoute,
  bulkToggleItemsForDriver,
  startDeliveryRunForDriver,
  forceUnassignDeliveryDate,
  markDelivered,
  markFailed,
  updateDeliveryNotesProof,
  createManualRoute,
} from '@/app/actions/deliveries';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Lightbox } from '@/components/ui/lightbox';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toThumbnailUrl, compressImage } from '@/lib/image';
import { Textarea } from '@/components/ui/textarea';
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
import { Printer, Trash2, CheckCircle2, ChevronDown, ChevronUp, ChevronRight, Pencil, Camera } from 'lucide-react';


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
  notes: string | null;
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
  const [viewMode, setViewMode] = useState<'all' | 'perDriver'>('all');
  const [focusDriver, setFocusDriver] = useState<string | null>(null);
  const [buckets, setBuckets] = useState<string[][] | null>(null);
  const [bucketDrivers, setBucketDrivers] = useState<Record<number, string>>({});
  const [manualOpen, setManualOpen] = useState(false);
  const [manualOrder, setManualOrder] = useState<string[]>([]);
  const [manualDriver, setManualDriver] = useState('');
  const [startInput, setStartInput] = useState(defaultStart);
  const [maxPerDriver, setMaxPerDriver] = useState(30);
  const [mapDepot, setMapDepot] = useState(() => parseLatLngCoord(defaultStart) ?? initialDepot);
  const [removeTarget, setRemoveTarget] = useState<ScheduledEntry | null>(null);
  const [deliverTarget, setDeliverTarget] = useState<ScheduledEntry | null>(null);
  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set());
  function toggleGroup(id: string) {
    setOpenGroups((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  function doRemoveStop() {
    if (!removeTarget) return;
    const id = removeTarget.id;
    setRemoveTarget(null);
    startTransition(async () => {
      const r = await forceUnassignDeliveryDate([id]);
      if (r && 'error' in r) toast.error(r.error);
      else { toast.success('Entry dihapus — rute ditata ulang'); refresh(); }
    });
  }

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

  // ─── Manual route builder (pick entries → driver → arrange order, no TSP) ──
  const scheduledById = useMemo(() => new Map(scheduled.map((e) => [e.id, e])), [scheduled]);
  function openManual() {
    const ids = selectableScheduledIds.filter((id) => selectedScheduled.has(id));
    if (!ids.length) { toast.error('Pilih entry dulu'); return; }
    setManualOrder(ids);
    setManualDriver('');
    setBuckets(null);
    setManualOpen(true);
  }
  function moveManual(idx: number, dir: -1 | 1) {
    setManualOrder((prev) => {
      const j = idx + dir;
      if (j < 0 || j >= prev.length) return prev;
      const next = [...prev];
      [next[idx], next[j]] = [next[j], next[idx]];
      return next;
    });
  }
  function removeFromManual(id: string) {
    setManualOrder((prev) => prev.filter((x) => x !== id));
  }
  function handleCreateManual() {
    if (!manualDriver) { toast.error('Pilih driver'); return; }
    if (!manualOrder.length) { toast.error('Rute kosong'); return; }
    startTransition(async () => {
      const r = await createManualRoute(dateStr, manualDriver, manualOrder);
      if (r && 'error' in r) toast.error(r.error);
      else {
        toast.success('Rute manual dibuat');
        setManualOpen(false); setManualOrder([]); setManualDriver(''); clearScheduled(); refresh();
      }
    });
  }

  // Per-driver view: drivers that have stops today
  const deliveringDrivers = Array.from(groupedByDriver.entries())
    .filter(([id]) => id !== '__unassigned__')
    .map(([id, stops]) => ({
      id,
      name: stops[0]?.delivery?.driver?.name ?? id,
      count: stops.length,
      started: stops.some((s) => s.delivery?.status === 'ON_DELIVERY'),
      done: stops.length > 0 && stops.every((s) => s.delivery?.status === 'DELIVERED' || s.delivery?.status === 'FAILED'),
    }));
  // Left-behind entries that can be inserted into a route (coords required to route)
  const insertCandidates = [
    ...unassignedStops.map((s) => ({ id: s.id, name: s.buyerName, hasCoords: s.buyerLat != null && s.buyerLng != null })),
    ...unscheduled.map((e) => ({ id: e.id, name: e.buyerName, hasCoords: e.hasCoords })),
  ];

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
  function handleCheckAllDriver(driverId: string, itemIds: string[], loaded: boolean) {
    setCheckedItems((prev) => {
      const next = new Set(prev);
      itemIds.forEach((id) => { if (loaded) next.add(id); else next.delete(id); });
      return next;
    });
    startToggleTransition(async () => {
      const r = await bulkToggleItemsForDriver(driverId, dateStr, loaded);
      if (r && 'error' in r) {
        toast.error(r.error);
        setCheckedItems((prev) => {
          const next = new Set(prev);
          itemIds.forEach((id) => { if (loaded) next.delete(id); else next.add(id); });
          return next;
        });
      }
    });
  }
  function handleStartRun(driverId: string, allLoaded: boolean) {
    if (!allLoaded && !confirm('Sebagian hewan belum dimuat. Sisa muatan akan dikembalikan ke unscheduled. Mulai perjalanan?')) return;
    startTransition(async () => {
      const r = await startDeliveryRunForDriver(driverId, dateStr);
      if (r && 'error' in r) toast.error(r.error);
      else { toast.success('Perjalanan dimulai'); refresh(); }
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

      <AdminDeliverDialog
        stop={deliverTarget}
        onClose={() => setDeliverTarget(null)}
        onSaved={() => { setDeliverTarget(null); refresh(); }}
      />

      <AlertDialog open={!!removeTarget} onOpenChange={(o) => { if (!o) setRemoveTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus entry dari rute?</AlertDialogTitle>
            <AlertDialogDescription>
              <span className="font-medium">{removeTarget?.buyerName}</span> akan dilepas dari jadwal — <span className="font-mono">deliveryDate</span> dikosongkan, delivery dihapus, dan checklist muatan di-reset.
              {removeTarget?.delivery?.status === 'ON_DELIVERY' && (
                <> <span className="block mt-2 text-warning-fg font-medium">⚠ Rute sedang berjalan — driver akan kehilangan stop ini.</span></>
              )}
              <span className="block mt-2 text-muted-foreground">Entry &amp; item-nya tetap ada di sistem dan bisa dijadwalkan ulang nanti.</span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={doRemoveStop} disabled={pending}>Hapus dari Rute</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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

      {/* ── View mode toggle ── */}
      <div className="flex gap-1 p-0.5 rounded-lg bg-muted w-fit">
        {([['all', 'Semua'], ['perDriver', 'Per Driver']] as const).map(([mode, label]) => (
          <button
            key={mode}
            onClick={() => setViewMode(mode)}
            className={cn(
              'rounded-md px-3 py-1.5 text-xs cursor-pointer transition-all',
              viewMode === mode ? 'bg-card shadow-sm font-medium text-foreground' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ── Stat cards ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard accent="info"    label="Dijadwalkan"    value={scheduled.length}  sub="hari ini" />
        <StatCard accent="success" label="Terkirim"       value={deliveredCount}     sub={`dari ${scheduled.length}`} />
        <StatCard accent="warning" label="Belum Dijadwal" value={unscheduled.length} sub="menunggu" />
        <StatCard accent="primary" label="Driver Aktif"   value={driverCount}        sub="tersedia" />
      </div>

      {viewMode === 'all' && (
        <>
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
              onClick={openManual}
              disabled={pending || selectedScheduled.size === 0}
              className="h-8 px-3 rounded-lg border text-xs font-medium hover:bg-muted/40 disabled:opacity-40 transition-colors"
            >
              Buat Rute Manual
            </button>
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
          {/* Manual route builder — pick driver + arrange order by hand (no TSP) */}
          {manualOpen && (
            <div className="flex flex-col gap-3 rounded-xl border border-info-ring/40 bg-info-bg/30 overflow-hidden">
              <div className="flex flex-wrap items-center justify-between gap-2 px-4 pt-3">
                <p className="text-sm font-semibold" style={{ fontFamily: SERIF }}>Susun Rute Manual</p>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => setManualOpen(false)} disabled={pending}>Batal</Button>
                  <Button size="sm" onClick={handleCreateManual} disabled={pending || !manualOrder.length || !manualDriver}
                    style={{ background: 'var(--primary)', color: 'var(--sidebar-primary)' }}>
                    Buat Rute
                  </Button>
                </div>
              </div>
              <div className="px-4 flex flex-wrap items-center gap-2">
                <label className="text-[11px] text-muted-foreground font-medium">Driver</label>
                <select
                  value={manualDriver}
                  onChange={(e) => setManualDriver(e.target.value)}
                  className="h-8 rounded-lg border bg-background px-2 text-xs text-foreground focus:outline-none"
                >
                  <option value="">Pilih driver…</option>
                  {assignableDrivers.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
                <span className="text-[11px] text-muted-foreground">{manualOrder.length} stop · urutan manual (tanpa TSP)</span>
              </div>
              <ol className="px-4 pb-4 flex flex-col gap-1.5">
                {manualOrder.map((id, idx) => {
                  const e = scheduledById.get(id);
                  return (
                    <li key={id} className="flex items-center gap-2 rounded-lg border bg-card px-3 py-2">
                      <span className="size-6 shrink-0 rounded-full bg-muted text-foreground text-[11px] font-bold flex items-center justify-center">{idx + 1}</span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">{e?.buyerName ?? id}</p>
                        {e?.buyerAddress && <p className="text-[11px] text-muted-foreground truncate">{e.buyerAddress}</p>}
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button" title="Naik" disabled={idx === 0}
                          onClick={() => moveManual(idx, -1)}
                          className="inline-flex items-center justify-center size-7 rounded-lg border text-muted-foreground hover:bg-muted/40 disabled:opacity-30 transition-colors"
                        >
                          <ChevronUp className="size-3.5" />
                        </button>
                        <button
                          type="button" title="Turun" disabled={idx === manualOrder.length - 1}
                          onClick={() => moveManual(idx, 1)}
                          className="inline-flex items-center justify-center size-7 rounded-lg border text-muted-foreground hover:bg-muted/40 disabled:opacity-30 transition-colors"
                        >
                          <ChevronDown className="size-3.5" />
                        </button>
                        <button
                          type="button" title="Keluarkan dari rute"
                          onClick={() => removeFromManual(id)}
                          className="inline-flex items-center justify-center size-7 rounded-lg border text-muted-foreground hover:bg-destructive/10 hover:text-destructive hover:border-destructive/40 transition-colors"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </div>
                    </li>
                  );
                })}
                {manualOrder.length === 0 && (
                  <li className="px-3 py-6 text-center text-xs text-muted-foreground">Semua entry dikeluarkan. Batal lalu pilih lagi.</li>
                )}
              </ol>
            </div>
          )}

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
            const isOpen = openGroups.has(driverId);
            return (
              <div key={driverId} className="rounded-xl border bg-card overflow-hidden">
                {/* group header */}
                <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-muted/30 px-4 py-2.5">
                  <button
                    type="button"
                    onClick={() => toggleGroup(driverId)}
                    className="flex items-center gap-2.5 min-w-0 flex-1 text-left"
                  >
                    {isOpen ? (
                      <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                    )}
                    <div
                      className={cn('size-8 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0 select-none', isUnassigned ? 'bg-warning-bg text-warning-fg' : 'bg-primary')}
                      style={!isUnassigned ? { color: 'var(--sidebar-primary)' } : undefined}
                    >
                      {isUnassigned ? '?' : initials(driverName)}
                    </div>
                    <div className="min-w-0">
                      <span className="text-sm font-semibold text-foreground" style={{ fontFamily: SERIF }}>{driverName}</span>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
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
                  </button>
                  <div className="flex flex-wrap items-center gap-2">
                    {!isUnassigned && assignedStopsInBucket.length > 0 && (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-xs h-7"
                          disabled={togglePending || bucketTotalItems === 0}
                          onClick={() => handleCheckAllDriver(
                            driverId,
                            assignedStopsInBucket.flatMap((s) => s.items.map((i) => i.itemId)),
                            bucketLoadedItems !== bucketTotalItems,
                          )}
                        >
                          {bucketLoadedItems === bucketTotalItems ? 'Hapus Semua Muatan' : 'Centang Semua Muatan'}
                        </Button>
                        <Button
                          size="sm"
                          className="text-xs h-7"
                          disabled={pending || bucketLoadedItems === 0}
                          onClick={() => handleStartRun(driverId, bucketLoadedItems === bucketTotalItems)}
                          style={{ background: 'var(--primary)', color: 'var(--sidebar-primary)' }}
                        >
                          Mulai Perjalanan
                        </Button>
                      </>
                    )}
                    <Button size="sm" variant="ghost" className="text-xs h-7" onClick={() => handleUnassign(stops.map((s) => s.id))} disabled={pending}>
                      Lepas
                    </Button>
                  </div>
                </div>

                {isOpen && (
                <>
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
                                  <img src={toThumbnailUrl(s.delivery.proofPhotoUrl, 120)} alt="bukti kirim" loading="lazy" decoding="async" className="w-full h-full object-cover" />
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
                                {(s.delivery?.status === 'ON_DELIVERY' || s.delivery?.status === 'DELIVERED') && (
                                  <button
                                    type="button"
                                    title={s.delivery.status === 'DELIVERED' ? 'Edit bukti / catatan' : 'Tandai terkirim / gagal (admin)'}
                                    onClick={() => setDeliverTarget(s)}
                                    className="inline-flex items-center justify-center size-7 rounded-lg border text-muted-foreground hover:bg-success-bg hover:text-success-fg hover:border-success-ring/40 transition-colors"
                                  >
                                    {s.delivery.status === 'DELIVERED' ? <Pencil className="size-3.5" /> : <CheckCircle2 className="size-3.5" />}
                                  </button>
                                )}
                                {s.delivery?.status !== 'DELIVERED' && (
                                  <button
                                    type="button"
                                    title="Hapus dari rute"
                                    onClick={() => setRemoveTarget(s)}
                                    className="inline-flex items-center justify-center size-7 rounded-lg border text-muted-foreground hover:bg-destructive/10 hover:text-destructive hover:border-destructive/40 transition-colors"
                                  >
                                    <Trash2 className="size-3.5" />
                                  </button>
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
                        {/* Header: seq + full name + info chips */}
                        <div className="flex items-start gap-2">
                          {isUnassigned && (
                            s.buyerLat != null && s.buyerLng != null ? (
                              <Checkbox
                                checked={selectedScheduled.has(s.id)}
                                onCheckedChange={() => toggleScheduled(s.id)}
                                className="size-4 shrink-0 mt-0.5"
                              />
                            ) : (
                              <span className="text-[10px] text-muted-foreground shrink-0 mt-0.5" title="Tanpa koordinat">⚠</span>
                            )
                          )}
                          <span
                            className="size-5 shrink-0 mt-0.5 rounded-full flex items-center justify-center text-[10px] font-bold text-white"
                            style={{ background: `var(--${dsMob.intent}-ring)` }}
                          >
                            {(s.delivery?.sequence ?? 0) + 1}
                          </span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <span className="font-medium text-sm text-foreground break-words leading-snug">{s.buyerName}</span>
                                {s.salesName && <span className="block text-[11px] text-muted-foreground">{s.salesName}</span>}
                              </div>
                              <div className="flex items-center gap-1 shrink-0">
                                {s.pengiriman && <StatusToken intent="info" outlined size="sm">{formatPengiriman(s.pengiriman)}</StatusToken>}
                                <StatusToken intent={dsMob.intent} size="sm">{dsMob.label}</StatusToken>
                              </div>
                            </div>
                            {s.delivery?.status === 'DELIVERED' && s.delivery.proofPhotoUrl && (
                              <button
                                type="button"
                                onClick={() => setLightboxUrl(s.delivery!.proofPhotoUrl!)}
                                className="group relative mt-1 block size-12 rounded-lg overflow-hidden border hover:ring-2 ring-info-ring transition-all"
                              >
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={toThumbnailUrl(s.delivery.proofPhotoUrl, 120)} alt="bukti kirim" loading="lazy" decoding="async" className="w-full h-full object-cover" />
                              </button>
                            )}
                            {s.delivery?.status === 'FAILED' && s.delivery.notes && (
                              <span className="block text-[11px] text-danger-fg mt-0.5">⚠ {s.delivery.notes}</span>
                            )}
                          </div>
                        </div>
                        {/* Actions row — right aligned */}
                        <div className="flex items-center justify-end gap-1">
                          {s.delivery?.id && (s.delivery.status === 'ASSIGNED' || s.delivery.status === 'ON_DELIVERY') && (
                            <button
                              type="button"
                              title="Surat Jalan"
                              onClick={() => window.open(`/api/deliveries/${s.delivery!.id}/surat-jalan`, '_blank')}
                              className="inline-flex items-center justify-center size-7 rounded-lg border text-muted-foreground hover:bg-muted/40 transition-colors"
                            >
                              <Printer className="size-3.5" />
                            </button>
                          )}
                          {href && (
                            <a href={href} target="_blank" rel="noreferrer" title="Buka di Maps"
                              className="inline-flex items-center justify-center size-7 rounded-lg border text-muted-foreground hover:bg-muted/40 transition-colors text-sm">
                              ↗
                            </a>
                          )}
                          {(s.delivery?.status === 'ON_DELIVERY' || s.delivery?.status === 'DELIVERED') && (
                            <button
                              type="button"
                              title={s.delivery.status === 'DELIVERED' ? 'Edit bukti / catatan' : 'Tandai terkirim / gagal (admin)'}
                              onClick={() => setDeliverTarget(s)}
                              className="inline-flex items-center justify-center size-7 rounded-lg border text-muted-foreground hover:bg-success-bg hover:text-success-fg hover:border-success-ring/40 transition-colors"
                            >
                              {s.delivery.status === 'DELIVERED' ? <Pencil className="size-3.5" /> : <CheckCircle2 className="size-3.5" />}
                            </button>
                          )}
                          {s.delivery?.status !== 'DELIVERED' && (
                            <button
                              type="button"
                              title="Hapus dari rute"
                              onClick={() => setRemoveTarget(s)}
                              className="inline-flex items-center justify-center size-7 rounded-lg border text-muted-foreground hover:bg-destructive/10 hover:text-destructive hover:border-destructive/40 transition-colors"
                            >
                              <Trash2 className="size-3.5" />
                            </button>
                          )}
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
                </>
                )}
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
        </>
      )}

      {viewMode === 'perDriver' && (
        <PerDriverPanel
          drivers={deliveringDrivers}
          focusDriver={focusDriver}
          onFocus={setFocusDriver}
          stops={focusDriver ? (groupedByDriver.get(focusDriver) ?? []) : []}
          dateStr={dateStr}
          insertCandidates={insertCandidates}
          onChanged={refresh}
          mapStops={mapStops}
          mapDepot={mapDepot}
          mapDrivers={mapDrivers}
          onPhotoClick={setLightboxUrl}
          onRemove={setRemoveTarget}
          onDeliver={setDeliverTarget}
        />
      )}

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
            <img src={toThumbnailUrl(item.photoUrl, 480)} alt={tag} loading="lazy" decoding="async" className="w-full aspect-square object-cover" />
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

// ─── Per-driver panel (view mode: Per Driver) ─────────────────────────────────

function PerDriverPanel({
  drivers,
  focusDriver,
  onFocus,
  stops,
  dateStr,
  insertCandidates,
  onChanged,
  mapStops,
  mapDepot,
  mapDrivers,
  onPhotoClick,
  onRemove,
  onDeliver,
}: {
  drivers: { id: string; name: string; count: number; started: boolean; done: boolean }[];
  focusDriver: string | null;
  onFocus: (id: string) => void;
  stops: ScheduledEntry[];
  dateStr: string;
  insertCandidates: { id: string; name: string; hasCoords: boolean }[];
  onChanged: () => void;
  mapStops: MapStop[];
  mapDepot: { lat: number; lng: number };
  mapDrivers: MapDriver[];
  onPhotoClick: (url: string) => void;
  onRemove: (stop: ScheduledEntry) => void;
  onDeliver: (stop: ScheduledEntry) => void;
}) {
  const [pending, startTransition] = useTransition();
  const [insertOpen, setInsertOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const started = stops.some((s) => s.delivery?.status === 'ON_DELIVERY');
  const sorted = [...stops].sort((a, b) => (a.delivery?.sequence ?? 0) - (b.delivery?.sequence ?? 0));
  const driverMapStops = focusDriver ? mapStops.filter((s) => s.driverId === focusDriver) : [];

  function recalc() {
    if (!focusDriver) return;
    startTransition(async () => {
      const r = await recalculateDriverRoute(focusDriver, dateStr);
      if (r && 'error' in r) toast.error(r.error);
      else { toast.success('Rute dihitung ulang'); onChanged(); }
    });
  }
  function doReset() {
    if (!focusDriver) return;
    setResetOpen(false);
    startTransition(async () => {
      const r = await resetDriverRoute(focusDriver, dateStr);
      if (r && 'error' in r) toast.error(r.error);
      else { toast.success('Rute di-reset'); onChanged(); }
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-xl border bg-card p-4">
        <p className="text-sm font-semibold mb-3" style={{ fontFamily: SERIF }}>Pilih Driver</p>
        {drivers.length === 0 ? (
          <p className="text-sm text-muted-foreground">Belum ada driver dengan rute hari ini.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {drivers.map((d) => (
              <button
                key={d.id}
                onClick={() => onFocus(d.id)}
                className={cn(
                  'rounded-lg border px-3 py-1.5 text-xs transition-colors',
                  focusDriver === d.id ? 'border-foreground/40 bg-muted font-medium' : 'hover:bg-muted/40',
                )}
              >
                {d.name} · {d.count} stop{d.done ? ' · Selesai' : d.started ? ' · Jalan' : ' · Belum'}
              </button>
            ))}
          </div>
        )}
      </div>

      {focusDriver && driverMapStops.length > 0 && (
        <div className="rounded-xl border bg-card overflow-hidden">
          <div className="px-5 py-3 border-b bg-muted/30">
            <h2 className="text-[13px] font-semibold" style={{ fontFamily: SERIF }}>Peta Rute Driver</h2>
          </div>
          <div className="p-4">
            <DeliveryMap depot={mapDepot} stops={driverMapStops} drivers={mapDrivers.filter((d) => d.id === focusDriver)} />
          </div>
        </div>
      )}

      {focusDriver && (
        <div className="rounded-xl border bg-card overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-muted/30 px-4 py-3">
            <span className="text-sm font-semibold" style={{ fontFamily: SERIF }}>
              {drivers.find((d) => d.id === focusDriver)?.name ?? 'Driver'} — {sorted.length} stop
            </span>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={() => setInsertOpen(true)} disabled={pending}>
                Tambah Entry Tertinggal
              </Button>
              <Button size="sm" onClick={recalc} disabled={pending || sorted.length === 0}>
                Hitung Ulang Rute
              </Button>
              {started && (
                <Button size="sm" variant="outline" onClick={() => setResetOpen(true)} disabled={pending}>
                  Reset Rute (sudah jalan)
                </Button>
              )}
            </div>
          </div>
          {started && (
            <p className="px-4 py-2 text-[11px] text-warning-fg bg-warning-bg border-b">
              Rute sudah jalan. Menambah / menghapus stop akan otomatis menata ulang stop yang belum terkirim (dihitung dari titik awal). Stop yang sudah terkirim / gagal tetap.
            </p>
          )}
          <ol className="divide-y">
            {sorted.map((s) => {
              const ds = DELIVERY_STATUS[s.delivery?.status ?? 'PENDING'] ?? DELIVERY_STATUS.PENDING;
              const href = navigationUrl({ buyerMaps: s.buyerMaps, buyerLat: s.buyerLat, buyerLng: s.buyerLng, buyerAddress: s.buyerAddress });
              const firstPhoto = s.items.find((i) => i.photoUrl)?.photoUrl ?? null;
              const extra = Math.max(0, s.items.length - 1);
              const itemSummary = s.items
                .map((i) => {
                  const t = i.type ? i.type.charAt(0) + i.type.slice(1).toLowerCase() : '';
                  return [t + (i.grade ? ` ${i.grade}` : ''), i.tag].filter(Boolean).join(' · ');
                })
                .filter(Boolean)
                .join(', ');
              return (
                <li key={s.id} className="flex items-start gap-3 px-4 py-3">
                  <span
                    className="size-5 shrink-0 mt-0.5 rounded-full flex items-center justify-center text-[10px] font-bold text-white"
                    style={{ background: `var(--${ds.intent}-ring)` }}
                  >
                    {(s.delivery?.sequence ?? 0) + 1}
                  </span>
                  {firstPhoto && (
                    <button
                      type="button"
                      onClick={() => onPhotoClick(firstPhoto)}
                      className="relative shrink-0 size-11 rounded-md overflow-hidden border bg-muted cursor-zoom-in"
                      title="Lihat foto hewan"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={toThumbnailUrl(firstPhoto)} alt={s.buyerName} width={44} height={44} loading="lazy" className="size-11 object-cover" />
                      {extra > 0 && (
                        <span className="absolute bottom-0 right-0 bg-black/60 text-white text-[8px] leading-none px-1 py-0.5 rounded-tl">+{extra}</span>
                      )}
                    </button>
                  )}
                  <div className="flex-1 min-w-0">
                    {/* Header: full name + info chips (pengiriman + status) */}
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-medium flex-1 min-w-0 break-words leading-snug">{s.buyerName}</p>
                      <div className="flex items-center gap-1 shrink-0">
                        {s.pengiriman && <StatusToken intent="info" outlined size="sm">{formatPengiriman(s.pengiriman)}</StatusToken>}
                        <StatusToken intent={ds.intent} size="sm">{ds.label}</StatusToken>
                      </div>
                    </div>
                    {/* Address — single line */}
                    <p className="text-[11px] text-muted-foreground line-clamp-1 mt-0.5" title={s.buyerAddress ?? undefined}>{s.buyerAddress ?? '—'}</p>
                    {/* Meta: animal + notes inline */}
                    {(itemSummary || s.notes) && (
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-1 text-[11px]">
                        {itemSummary && <span className="text-muted-foreground">{itemSummary}</span>}
                        {s.notes && (
                          <span className="italic text-foreground/80 bg-muted/40 px-1.5 py-0.5 rounded">
                            {s.notes}
                          </span>
                        )}
                      </div>
                    )}
                    {/* Delivery extras */}
                    {s.delivery?.status === 'FAILED' && s.delivery.notes && (
                      <p className="text-[11px] text-danger-fg mt-1">⚠ {s.delivery.notes}</p>
                    )}
                    {s.delivery?.status === 'DELIVERED' && s.delivery.proofPhotoUrl && (
                      <button
                        type="button"
                        onClick={() => onPhotoClick(s.delivery!.proofPhotoUrl!)}
                        className="mt-1 text-[11px] text-info-fg underline underline-offset-2 hover:no-underline"
                      >
                        Lihat bukti kirim
                      </button>
                    )}
                    {/* Actions — bottom-right */}
                    <div className="flex items-center justify-end gap-1 mt-1.5">
                      {href && (
                        <a href={href} target="_blank" rel="noreferrer" title="Buka di Maps" className="inline-flex items-center justify-center size-7 rounded-lg border text-muted-foreground hover:bg-muted/40 hover:text-foreground text-sm transition-colors">↗</a>
                      )}
                      {(s.delivery?.status === 'ON_DELIVERY' || s.delivery?.status === 'DELIVERED') && (
                        <button
                          type="button"
                          onClick={() => onDeliver(s)}
                          title={s.delivery.status === 'DELIVERED' ? 'Edit bukti / catatan' : 'Tandai terkirim / gagal (admin)'}
                          className="inline-flex items-center justify-center size-7 rounded-lg border text-muted-foreground hover:bg-success-bg hover:text-success-fg hover:border-success-ring/40 transition-colors"
                        >
                          {s.delivery.status === 'DELIVERED' ? <Pencil className="size-3.5" /> : <CheckCircle2 className="size-3.5" />}
                        </button>
                      )}
                      {s.delivery?.status !== 'DELIVERED' && (
                        <button
                          type="button"
                          onClick={() => onRemove(s)}
                          title="Hapus dari rute"
                          className="inline-flex items-center justify-center size-7 rounded-lg border text-muted-foreground hover:bg-destructive/10 hover:text-destructive hover:border-destructive/40 transition-colors"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
            {sorted.length === 0 && (
              <li className="px-4 py-8 text-center text-sm text-muted-foreground">Rute kosong.</li>
            )}
          </ol>
        </div>
      )}

      {focusDriver && (
        <InsertEntryDialog
          open={insertOpen}
          onClose={() => setInsertOpen(false)}
          driverId={focusDriver}
          dateStr={dateStr}
          candidates={insertCandidates}
          onSaved={() => { setInsertOpen(false); onChanged(); }}
        />
      )}

      <AlertDialog open={resetOpen} onOpenChange={setResetOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reset rute yang sudah jalan?</AlertDialogTitle>
            <AlertDialogDescription>
              Rute driver ini sedang berjalan (<span className="font-medium">ON_DELIVERY</span>). Reset akan mengembalikan status semua stop yang belum selesai ke <span className="font-medium">ASSIGNED</span> supaya bisa diubah / dihitung ulang. Stop yang sudah <span className="font-medium">DELIVERED / FAILED</span> tidak terpengaruh. Driver akan perlu memulai ulang perjalanan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={doReset} disabled={pending}>Reset Rute</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  );
}

function InsertEntryDialog({
  open,
  onClose,
  driverId,
  dateStr,
  candidates,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  driverId: string;
  dateStr: string;
  candidates: { id: string; name: string; hasCoords: boolean }[];
  onSaved: () => void;
}) {
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [q, setQ] = useState('');
  const [pending, startTransition] = useTransition();
  const filtered = candidates.filter((c) => c.name.toLowerCase().includes(q.toLowerCase()));

  function toggle(id: string) {
    setSel((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }
  function save() {
    const ids = Array.from(sel);
    if (!ids.length) return;
    startTransition(async () => {
      const r = await addEntriesToDriverRoute(driverId, dateStr, ids);
      if (r && 'error' in r) { toast.error(r.error); return; }
      toast.success(`${ids.length} entry ditambahkan & rute dihitung ulang`);
      setSel(new Set());
      onSaved();
    });
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-md w-[95vw] max-h-[85dvh] overflow-hidden flex flex-col p-0">
        <DialogHeader className="px-5 pt-5 pb-0 shrink-0">
          <DialogTitle>Tambah Entry Tertinggal</DialogTitle>
        </DialogHeader>
        <div className="px-5 py-3 shrink-0">
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari pembeli…" className="h-8 text-sm" />
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto px-5 pb-3 flex flex-col gap-1">
          {filtered.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">Tidak ada entry.</p>}
          {filtered.map((c) => (
            <label
              key={c.id}
              className={cn('flex items-center gap-2 rounded-md border px-3 py-2 text-sm', c.hasCoords ? 'cursor-pointer hover:bg-muted/40' : 'opacity-50')}
            >
              <Checkbox checked={sel.has(c.id)} disabled={!c.hasCoords} onCheckedChange={() => c.hasCoords && toggle(c.id)} className="size-4" />
              <span className="flex-1 truncate">{c.name}</span>
              {!c.hasCoords && <span className="text-[10px] text-destructive shrink-0">Backfill dulu</span>}
            </label>
          ))}
        </div>
        <div className="px-5 py-4 border-t flex items-center justify-between gap-3 shrink-0">
          <span className="text-xs text-muted-foreground">{sel.size} dipilih</span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={onClose} disabled={pending}>Batal</Button>
            <Button size="sm" onClick={save} disabled={pending || sel.size === 0}>
              {pending ? 'Menyimpan…' : 'Tambah & Hitung Ulang'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Admin: mark delivered/failed on behalf of driver, or edit proof/notes ───
// ON_DELIVERY → tandai terkirim/gagal · DELIVERED → edit foto bukti + catatan.

function AdminDeliverDialog({
  stop,
  onClose,
  onSaved,
}: {
  stop: ScheduledEntry | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const status = stop?.delivery?.status;
  const isDelivered = status === 'DELIVERED';
  const existingProof = stop?.delivery?.proofPhotoUrl ?? null;
  const existingNotes = stop?.delivery?.notes ?? '';
  const deliveredAt = stop?.delivery?.deliveredAt ?? null;

  const [notes, setNotes] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // Reset form when target changes — prefill existing notes when editing a delivered stop.
  useEffect(() => {
    setNotes(stop?.delivery?.status === 'DELIVERED' ? stop.delivery.notes ?? '' : '');
    setFile(null);
    if (preview) URL.revokeObjectURL(preview);
    setPreview(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stop?.id]);

  async function pickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    try {
      const compressed = await compressImage(f);
      setFile(compressed);
      if (preview) URL.revokeObjectURL(preview);
      setPreview(URL.createObjectURL(compressed));
    } catch {
      toast.error('Gagal proses foto');
    }
  }

  async function uploadProof(): Promise<string | undefined> {
    if (!file) return undefined;
    const fd = new FormData();
    fd.append('file', file);
    const res = await fetch('/api/upload?folder=delivery-proof', { method: 'POST', body: fd });
    if (!res.ok) throw new Error('Upload bukti gagal');
    const data = (await res.json()) as { url: string };
    return data.url;
  }

  function handleDelivered() {
    if (!stop?.delivery?.id) return;
    startTransition(async () => {
      try {
        const proofUrl = await uploadProof();
        const r = await markDelivered(stop.delivery!.id, notes.trim() || undefined, proofUrl);
        if (r && 'error' in r) toast.error(r.error);
        else { toast.success('Ditandai terkirim'); onSaved(); }
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Gagal');
      }
    });
  }
  function handleFailed() {
    if (!stop?.delivery?.id) return;
    const reason = notes.trim();
    if (!reason) { toast.error('Alasan wajib diisi untuk Gagal'); return; }
    startTransition(async () => {
      const r = await markFailed(stop.delivery!.id, reason);
      if (r && 'error' in r) toast.error(r.error);
      else { toast.success('Ditandai gagal'); onSaved(); }
    });
  }
  function handleSaveEdit() {
    if (!stop?.delivery?.id) return;
    startTransition(async () => {
      try {
        const proofUrl = await uploadProof();
        if (!proofUrl && notes.trim() === existingNotes.trim()) {
          toast.error('Tidak ada perubahan');
          return;
        }
        const r = await updateDeliveryNotesProof(stop.delivery!.id, notes.trim() || undefined, proofUrl);
        if (r && 'error' in r) toast.error(r.error);
        else { toast.success('Perubahan disimpan'); onSaved(); }
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Gagal');
      }
    });
  }

  const ds = DELIVERY_STATUS[status ?? 'PENDING'] ?? DELIVERY_STATUS.PENDING;

  return (
    <Dialog open={!!stop} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-md w-[95vw] max-h-[90dvh] overflow-hidden flex flex-col p-0">
        <DialogHeader className="px-5 pt-5 pb-3 border-b shrink-0">
          <div className="flex items-center gap-2">
            <DialogTitle className="text-base">
              {isDelivered ? 'Edit Bukti Kirim' : 'Tandai Delivery'}
            </DialogTitle>
            <StatusToken intent={ds.intent} size="sm">{ds.label}</StatusToken>
          </div>
          <p className="text-[13px] text-muted-foreground mt-0.5">{stop?.buyerName}</p>
          {isDelivered && deliveredAt && (
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Terkirim {new Date(deliveredAt).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })}
            </p>
          )}
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4 flex flex-col gap-4">
          {!isDelivered && (
            <p className="text-[11px] text-muted-foreground -mt-1">
              Atas nama driver. Lampirkan foto bukti (opsional untuk terkirim) & isi catatan / alasan.
            </p>
          )}

          {/* Foto bukti */}
          <div className="flex flex-col gap-2">
            <p className="text-xs font-medium text-foreground">Foto Bukti</p>
            {preview ? (
              <div className="relative w-full overflow-hidden rounded-xl border">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={preview} alt="preview" className="w-full max-h-56 object-contain bg-muted/30" />
                <span className="absolute top-2 left-2 rounded-full bg-info-bg text-info-fg text-[10px] font-medium px-2 py-0.5">Foto baru</span>
                <button
                  type="button"
                  onClick={() => { setFile(null); if (preview) URL.revokeObjectURL(preview); setPreview(null); }}
                  className="absolute top-2 right-2 size-6 rounded-full bg-black/60 text-white text-sm leading-none hover:bg-black/80 transition-colors"
                >×</button>
              </div>
            ) : existingProof ? (
              <div className="relative w-full overflow-hidden rounded-xl border">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={existingProof} alt="bukti" className="w-full max-h-56 object-contain bg-muted/30" />
                <span className="absolute top-2 left-2 rounded-full bg-muted text-muted-foreground text-[10px] font-medium px-2 py-0.5">Foto saat ini</span>
              </div>
            ) : null}
            <label className="cursor-pointer flex flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed py-5 text-center hover:bg-muted/40 transition-colors">
              <Camera className="size-5 text-muted-foreground" />
              <span className="text-xs font-medium">
                {preview || existingProof ? 'Ganti Foto' : 'Pilih / Ambil Foto'}
              </span>
              <span className="text-[10px] text-muted-foreground">Dikompres otomatis</span>
              <input type="file" accept="image/*" onChange={pickFile} className="hidden" />
            </label>
          </div>

          {/* Catatan */}
          <div className="flex flex-col gap-1.5">
            <p className="text-xs font-medium text-foreground">Catatan {isDelivered ? '' : '/ Alasan'}</p>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={isDelivered ? 'Catatan pengiriman...' : 'Catatan tambahan (atau alasan jika gagal)...'}
              rows={3}
              className="text-sm"
            />
            {!isDelivered && (
              <p className="text-[10px] text-muted-foreground">Wajib untuk Tandai Gagal; opsional untuk Tandai Terkirim.</p>
            )}
          </div>
        </div>

        <div className="px-5 py-3 border-t flex flex-wrap items-center justify-end gap-2 shrink-0">
          <Button variant="outline" size="sm" onClick={onClose} disabled={pending}>Batal</Button>
          {isDelivered ? (
            <Button size="sm" onClick={handleSaveEdit} disabled={pending}>
              {pending ? 'Menyimpan…' : 'Simpan Perubahan'}
            </Button>
          ) : (
            <>
              <Button variant="outline" size="sm" onClick={handleFailed} disabled={pending} className="text-destructive border-destructive/40 hover:bg-destructive/10">
                Tandai Gagal
              </Button>
              <Button size="sm" onClick={handleDelivered} disabled={pending}>
                {pending ? 'Menyimpan…' : 'Tandai Terkirim'}
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
