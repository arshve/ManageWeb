'use client';

import { useState, useEffect, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button, buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { compressImage } from '@/lib/image';

import { cn } from '@/lib/utils';
import { StatusToken, intentVars, DELIVERY_STATUS } from '@/components/ui/status-token';

const SERIF = "var(--font-dm-serif), 'DM Serif Display', serif";
import {
  startDeliveryRun,
  markDelivered,
  markFailed,
  toggleItemLoaded,
  bulkToggleItemsLoaded,
} from '@/app/actions/deliveries';
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
import { Checkbox } from '@/components/ui/checkbox';
import { navigationUrl } from '@/lib/delivery/maps';
import { LivestockPhoto } from '@/components/dashboard/livestock-photo';
import { supabase } from '@/lib/supabase';
import {
  MapPin,
  MessageCircle,
  Phone,
  CheckCircle2,
  AlertCircle,
  Navigation,
  Clock,
  CalendarDays,
  Camera,
  X,
} from 'lucide-react';

type Stop = {
  id: string;
  sequence: number;
  status: string;
  deliveredAt: string | null;
  notes: string | null;
  proofPhotoUrl: string | null;
  entry: {
    buyerName: string;
    buyerPhone: string | null;
    buyerAddress: string | null;
    buyerMaps: string | null;
    buyerLat: number | null;
    buyerLng: number | null;
    salesName: string;
    items: {
      itemId: string;
      loadedAt: string | null;
      sku: string;
      tag: string | null;
      type: string;
      grade: string | null;
      photoUrl: string | null;
    }[];
  };
};

function formatWaNumber(phone: string) {
  let cleaned = phone.replace(/\D/g, '');
  if (cleaned.startsWith('0')) {
    cleaned = '62' + cleaned.slice(1);
  }
  return cleaned;
}

export function DriverRunView({
  deliveryDate,
  isToday,
  stops,
}: {
  deliveryDate: string;
  isToday: boolean;
  stops: Stop[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [togglePending, startToggleTransition] = useTransition();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const notStarted =
    stops.length > 0 && stops.every((s) => s.status === 'ASSIGNED');

  const [checkedItems, setCheckedItems] = useState<Set<string>>(
    () => new Set(
      stops.flatMap((s) => s.entry.items)
        .filter((i) => i.loadedAt)
        .map((i) => i.itemId),
    ),
  );

  useEffect(() => {
    const channel = supabase
      .channel('entryitem-loadout-driver')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'EntryItem' }, (payload) => {
        const row = payload.new as { id: string; loadedAt: string | null };
        setCheckedItems((prev) => {
          const next = new Set(prev);
          if (row.loadedAt) next.add(row.id); else next.delete(row.id);
          return next;
        });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const assignedStops = stops.filter((s) => s.status === 'ASSIGNED');
  const totalAssignedItems = assignedStops.flatMap((s) => s.entry.items).length;
  const totalLoaded = assignedStops.flatMap((s) => s.entry.items).filter((i) => checkedItems.has(i.itemId)).length;
  const hasPartial = assignedStops.some(
    (s) => s.entry.items.some((i) => checkedItems.has(i.itemId)) && !s.entry.items.every((i) => checkedItems.has(i.itemId)),
  );
  const hasSkipped = assignedStops.some(
    (s) => s.entry.items.every((i) => !checkedItems.has(i.itemId)),
  );
  const needsConfirm = hasPartial || hasSkipped;
  const partialOrSkippedEntries = assignedStops
    .filter((s) => !s.entry.items.every((i) => checkedItems.has(i.itemId)))
    .map((s) => {
      const loaded = s.entry.items.filter((i) => checkedItems.has(i.itemId)).length;
      return `${s.entry.buyerName} (${loaded}/${s.entry.items.length} dimuat)`;
    });

  function handleToggleItem(itemId: string, checked: boolean) {
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

  function handleToggleAll(deliveryId: string, items: Stop['entry']['items'], checked: boolean) {
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

  // Find the first stop that is not DELIVERED or FAILED
  const current = stops.find(
    (s) => s.status === 'ON_DELIVERY' || s.status === 'ASSIGNED',
  );

  function gotoDate(next: string) {
    router.push(`/driver?date=${next}`);
  }

  function dateOffset(days: number): string {
    const d = new Date(deliveryDate + 'T00:00:00Z');
    d.setUTCDate(d.getUTCDate() + days);
    return d.toISOString().slice(0, 10);
  }

  function gotoToday() {
    const t = new Date();
    t.setUTCHours(0, 0, 0, 0);
    gotoDate(t.toISOString().slice(0, 10));
  }

  function handleStart() {
    if (needsConfirm) { setConfirmOpen(true); return; }
    doStart();
  }

  function doStart() {
    startTransition(async () => {
      const r = await startDeliveryRun(deliveryDate);
      if ('error' in r) toast.error(r.error);
      else {
        const extras: string[] = [];
        if ('skipped' in r && r.skipped > 0) extras.push(`${r.skipped} stop dikembalikan ke unscheduled`);
        if ('splitEntries' in r && r.splitEntries > 0) extras.push(`${r.splitEntries} entry dipecah`);
        toast.success('Rute dimulai! Hati-hati di jalan.' + (extras.length ? ` (${extras.join(', ')})` : ''));
      }
    });
  }

  const deliveredCount = stops.filter((s) => s.status === 'DELIVERED').length;
  const progress =
    stops.length > 0 ? Math.round((deliveredCount / stops.length) * 100) : 0;

  return (
    <div className="flex flex-col gap-4 pb-8">
      {/* ── Sticky Date Nav ── */}
      <div className="sticky top-0 z-10 -mx-4 px-4 py-3 bg-background/80 backdrop-blur-md border-b">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => gotoDate(dateOffset(-1))}
            className="flex-1 sm:flex-none"
          >
            ←
          </Button>
          <div className="relative flex-1 sm:flex-none">
            <CalendarDays className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
            <Input
              type="date"
              value={deliveryDate}
              onChange={(e) => e.target.value && gotoDate(e.target.value)}
              className="h-9 pl-9 w-full sm:w-[160px] text-sm"
            />
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => gotoDate(dateOffset(1))}
            className="flex-1 sm:flex-none"
          >
            →
          </Button>
          {!isToday && (
            <Button
              size="sm"
              variant="secondary"
              onClick={gotoToday}
              className="w-full sm:w-auto"
            >
              Kembali ke Hari Ini
            </Button>
          )}
        </div>

        {/* Progress Bar */}
        {stops.length > 0 && (
          <div className="mt-3">
            <div className="flex justify-between text-xs font-medium mb-1.5">
              <span className="text-muted-foreground uppercase tracking-[0.08em] text-[10px] font-bold">Progress</span>
              <span className="text-sm font-bold text-success-fg" style={{ fontFamily: SERIF }}>
                {deliveredCount} / {stops.length}
              </span>
            </div>
            <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500 ease-in-out"
                style={{ width: `${progress}%`, background: 'var(--success-ring)' }}
              />
            </div>
          </div>
        )}
      </div>

      {/* ── Start Route Button ── */}
      {isToday && notStarted && (
        <>
          <div className="rounded-xl border bg-card overflow-hidden">
            <div className="px-4 py-2.5 border-b bg-muted/30 flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-[0.1em] text-muted-foreground">Checklist Muatan</span>
              <span className={cn(
                'text-xs font-semibold px-2 py-0.5 rounded-full',
                totalLoaded === totalAssignedItems && totalAssignedItems > 0
                  ? 'bg-success-bg text-success-fg'
                  : totalLoaded > 0
                    ? 'bg-warning-bg text-warning-fg'
                    : 'bg-muted text-muted-foreground',
              )}>
                {totalLoaded}/{totalAssignedItems} dimuat
              </span>
            </div>
            <p className="px-4 py-2 text-xs text-muted-foreground border-b">
              Centang setiap hewan yang sudah naik ke kendaraan sebelum berangkat.
            </p>
          </div>
          <button
            className="w-full h-14 rounded-xl text-base font-bold flex items-center justify-center gap-2.5 transition-all disabled:opacity-60"
            style={{ background: 'var(--primary)', color: 'var(--sidebar-primary)', fontFamily: SERIF, boxShadow: '0 4px 24px oklch(0.22 0.065 145 / 0.25)' }}
            onClick={handleStart}
            disabled={pending || totalLoaded === 0}
          >
            <Navigation className="size-5" />
            Mulai Perjalanan Rute
          </button>
          <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Ada hewan yang belum dimuat</AlertDialogTitle>
                <AlertDialogDescription>
                  Stop berikut akan dikembalikan ke unscheduled:{' '}
                  {partialOrSkippedEntries.join(', ')}.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Batal</AlertDialogCancel>
                <AlertDialogAction onClick={() => { setConfirmOpen(false); doStart(); }}>
                  Lanjutkan
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </>
      )}

      {/* ── Stop Cards ── active first, done/failed last */}
      <div className="flex flex-col gap-4">
        {[...stops]
          .sort((a, b) => {
            const done = (s: Stop) => s.status === 'DELIVERED' || s.status === 'FAILED';
            if (done(a) !== done(b)) return done(a) ? 1 : -1;
            return (a.sequence ?? 0) - (b.sequence ?? 0);
          })
          .map((s) => (
          <StopCard
            key={s.id}
            stop={s}
            isCurrent={isToday && current?.id === s.id && !notStarted}
            readOnly={!isToday}
            checkedItems={checkedItems}
            onToggleItem={handleToggleItem}
            onToggleAll={handleToggleAll}
            toggleDisabled={togglePending}
          />
        ))}

        {stops.length === 0 && (
          <div className="flex flex-col items-center justify-center p-12 text-center border rounded-xl bg-muted/20 border-dashed mt-8">
            <div className="size-14 rounded-full flex items-center justify-center mb-4 bg-primary/10">
              <Clock className="size-7 text-success-fg" />
            </div>
            <h3 className="font-bold text-lg" style={{ fontFamily: SERIF }}>Tidak Ada Jadwal</h3>
            <p className="text-sm text-muted-foreground mt-1 max-w-xs">
              Tidak ada pengiriman untuk tanggal ini.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function StopCard({
  stop,
  isCurrent,
  readOnly,
  checkedItems,
  onToggleItem,
  onToggleAll,
  toggleDisabled,
}: {
  stop: Stop;
  isCurrent: boolean;
  readOnly: boolean;
  checkedItems: Set<string>;
  onToggleItem: (itemId: string, checked: boolean) => void;
  onToggleAll: (deliveryId: string, items: Stop['entry']['items'], checked: boolean) => void;
  toggleDisabled: boolean;
}) {
  const [notes, setNotes] = useState('');
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const done = stop.status === 'DELIVERED' || stop.status === 'FAILED';

  async function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const compressed = await compressImage(file);
    setPhotoFile(compressed);
    setPhotoPreview(URL.createObjectURL(compressed));
  }

  function clearPhoto() {
    setPhotoFile(null);
    if (photoPreview) URL.revokeObjectURL(photoPreview);
    setPhotoPreview(null);
  }

  const mapsHref = navigationUrl({
    buyerMaps: stop.entry.buyerMaps,
    buyerLat: stop.entry.buyerLat,
    buyerLng: stop.entry.buyerLng,
    buyerAddress: stop.entry.buyerAddress,
  });

  const waNumber = stop.entry.buyerPhone
    ? formatWaNumber(stop.entry.buyerPhone)
    : null;

  async function handleDelivered() {
    setBusy(true);
    let proofUrl: string | undefined;
    if (photoFile) {
      const fd = new FormData();
      fd.append('file', photoFile);
      const res = await fetch('/api/upload?folder=delivery-proof', { method: 'POST', body: fd });
      if (res.ok) {
        const { url } = await res.json() as { url: string };
        proofUrl = url;
      } else {
        toast.error('Gagal upload foto bukti — coba lagi');
        setBusy(false);
        return;
      }
    }
    const r = await markDelivered(stop.id, notes || undefined, proofUrl);
    if ('error' in r) toast.error(r.error);
    else toast.success('Berhasil ditandai terkirim!');
    setBusy(false);
  }

  async function handleFailed() {
    const reason = prompt('Alasan gagal pengiriman? (Wajib diisi)');
    if (!reason || !reason.trim()) {
      toast.error('Alasan gagal wajib diisi');
      return;
    }
    setBusy(true);
    const r = await markFailed(stop.id, reason);
    if ('error' in r) toast.error(r.error);
    else toast.success('Ditandai gagal');
    setBusy(false);
  }


  const ds = DELIVERY_STATUS[stop.status] ?? DELIVERY_STATUS.ASSIGNED;

  return (
    <div
      className={cn(
        'rounded-xl border bg-card overflow-hidden transition-all duration-300',
        isCurrent ? 'shadow-md' : '',
        done ? 'opacity-70' : '',
      )}
      style={isCurrent ? { borderColor: 'var(--primary)', boxShadow: '0 0 0 1px oklch(0.22 0.065 145 / 0.15), 0 4px 16px oklch(0.22 0.065 145 / 0.12)' } : {}}
    >
      {/* ── Card Header ── */}
      <div
        className="px-4 py-2.5 border-b flex justify-between items-center"
        style={{ ...intentVars(ds.intent), background: 'var(--token-bg)', borderColor: 'var(--token-ring)' }}
      >
        <div className="flex items-center gap-2.5">
          <span
            className="size-7 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
            style={{ background: 'var(--token-ring)', fontFamily: SERIF }}
          >
            {stop.sequence + 1}
          </span>
          <div className="flex flex-wrap gap-1">
            {stop.entry.items.map((lv) => (
              <span key={lv.sku} className="text-xs font-mono tracking-tight text-muted-foreground bg-muted/70 px-1.5 py-0.5 rounded">
                {lv.tag ?? lv.sku}
              </span>
            ))}
          </div>
        </div>
        <StatusToken intent={ds.intent}>{ds.label}</StatusToken>
      </div>

      <div className="p-4 flex flex-col gap-4">
        {/* ── Buyer Info ── */}
        <div>
          <h3 className="text-xl font-bold leading-tight" style={{ fontFamily: SERIF }}>
            {stop.entry.buyerName}
          </h3>
          <p className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap">
            {stop.entry.buyerAddress || 'Alamat tidak tersedia'}
          </p>
        </div>

        {/* ── Quick Actions ── */}
        <div className="flex gap-2">
          {mapsHref ? (
            <a
              href={mapsHref}
              target="_blank"
              rel="noreferrer"
              className={cn(
                buttonVariants({ variant: 'outline' }),
                'flex-1 gap-2 bg-info-bg hover:bg-info-bg/80 text-info-fg border-info-ring/40',
              )}
            >
              <MapPin className="size-4" />
              Buka Maps
            </a>
          ) : (
            <Button variant="outline" disabled className="flex-1 gap-2">
              <MapPin className="size-4" />
              Maps (N/A)
            </Button>
          )}

          {waNumber ? (
            <a
              href={`https://wa.me/${waNumber}`}
              target="_blank"
              rel="noreferrer"
              className={cn(
                buttonVariants({ variant: 'outline' }),
                'flex-1 gap-2 bg-success-bg hover:bg-success-bg/80 text-success-fg border-success-ring/40',
              )}
            >
              <MessageCircle className="size-4" />
              Chat WA
            </a>
          ) : stop.entry.buyerPhone ? (
            <a
              href={`tel:${stop.entry.buyerPhone}`}
              className={cn(buttonVariants({ variant: 'outline' }), 'flex-1 gap-2')}
            >
              <Phone className="size-4" />
              Telepon
            </a>
          ) : (
            <Button variant="outline" disabled className="flex-1 gap-2">
              <Phone className="size-4" />
              No. HP (N/A)
            </Button>
          )}
        </div>

        {/* ── Animal Details ── */}
        {(() => {
          const isAssigned = stop.status === 'ASSIGNED';
          const loadedCount = stop.entry.items.filter((i) => checkedItems.has(i.itemId)).length;
          const total = stop.entry.items.length;
          const allLoaded = loadedCount === total;
          return (
            <div className="rounded-lg border bg-muted/30 overflow-hidden">
              <div className="px-3 py-2 border-b bg-muted/30 flex items-center justify-between">
                <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
                  Detail Hewan · Sales: {stop.entry.salesName}
                </p>
                {isAssigned && (
                  <div className="flex items-center gap-2">
                    <span className={cn(
                      'text-xs font-semibold px-1.5 py-0.5 rounded-full',
                      allLoaded ? 'bg-success-bg text-success-fg' : loadedCount > 0 ? 'bg-warning-bg text-warning-fg' : 'bg-muted text-muted-foreground',
                    )}>
                      {loadedCount}/{total}
                    </span>
                    <button
                      className="text-[10px] text-muted-foreground underline underline-offset-2 disabled:opacity-40"
                      disabled={toggleDisabled}
                      onClick={() => onToggleAll(stop.id, stop.entry.items, !allLoaded)}
                    >
                      {allLoaded ? 'Hapus semua' : 'Centang semua'}
                    </button>
                  </div>
                )}
              </div>
              <div className="p-3 flex flex-col gap-2">
                {stop.entry.items.map((lv) => {
                  const typeLabel =
                    lv.type.charAt(0) + lv.type.slice(1).toLowerCase() +
                    (lv.grade ? ' Grade ' + lv.grade : '');
                  const isChecked = checkedItems.has(lv.itemId);
                  return (
                    <div
                      key={lv.itemId}
                      className={cn('flex gap-3 items-center rounded-lg transition-colors', isAssigned ? 'cursor-pointer hover:bg-muted/60 -mx-1 px-1 py-1' : '')}
                      onClick={isAssigned && !toggleDisabled ? () => onToggleItem(lv.itemId, !isChecked) : undefined}
                    >
                      {isAssigned && (
                        <Checkbox
                          checked={isChecked}
                          disabled={toggleDisabled}
                          onCheckedChange={(v) => onToggleItem(lv.itemId, !!v)}
                          onClick={(e) => e.stopPropagation()}
                          className="shrink-0"
                        />
                      )}
                      <LivestockPhoto
                        photoUrl={lv.photoUrl}
                        alt={lv.sku}
                        thumbnailClassName="size-12"
                      />
                      <div className="text-sm flex-1 min-w-0">
                        <p className={cn('font-semibold truncate', isAssigned && isChecked ? 'text-success-fg' : 'text-foreground')}>{typeLabel}</p>
                        <p className="text-xs text-muted-foreground truncate">Tag: {lv.tag || '—'}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })()}

        {/* ── Driver Action Forms ── */}
        {!done && isCurrent && !readOnly && (
          <div className="pt-3 border-t flex flex-col gap-3">
            <Textarea
              placeholder="Catatan pengiriman (opsional)"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="text-sm resize-none bg-background"
            />
            {/* Bukti kirim photo capture */}
            {photoPreview ? (
              <div className="relative rounded-lg overflow-hidden border">
                <img src={photoPreview} alt="Bukti kirim" className="w-full max-h-48 object-cover" />
                <button
                  onClick={clearPhoto}
                  className="absolute top-2 right-2 size-7 rounded-full bg-black/60 flex items-center justify-center"
                >
                  <X className="size-4 text-white" />
                </button>
                <div className="absolute bottom-0 left-0 right-0 px-3 py-1.5 bg-black/50">
                  <p className="text-[11px] text-white/80">Foto bukti pengiriman</p>
                </div>
              </div>
            ) : (
              <label className="flex items-center gap-2.5 px-4 py-2.5 rounded-lg border border-dashed cursor-pointer transition-colors hover:bg-muted/40">
                <Camera className="size-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Foto bukti kirim (opsional)</span>
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="sr-only"
                  onChange={handlePhotoChange}
                />
              </label>
            )}
            <div className="flex gap-2">
              <button
                className="flex-1 h-11 rounded-lg flex items-center justify-center gap-2 font-semibold text-sm transition-all disabled:opacity-60"
                style={{ background: 'var(--success-ring)', color: 'white' }}
                disabled={busy}
                onClick={handleDelivered}
              >
                <CheckCircle2 className="size-4" />
                {busy ? 'Menyimpan…' : 'Terkirim'}
              </button>
              <Button
                variant="destructive"
                className="gap-2 h-11 px-5"
                disabled={busy}
                onClick={handleFailed}
              >
                <AlertCircle className="size-4" />
                Gagal
              </Button>
            </div>
          </div>
        )}

        {/* ── Completed Notes + Proof ── */}
        {done && (stop.notes || stop.proofPhotoUrl) && (
          <div className="flex flex-col gap-2">
            {stop.proofPhotoUrl && (
              <a href={stop.proofPhotoUrl} target="_blank" rel="noreferrer" className="block rounded-lg overflow-hidden border relative group">
                <img src={stop.proofPhotoUrl} alt="Bukti kirim" className="w-full max-h-48 object-cover" />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
                <div className="absolute bottom-0 left-0 right-0 px-3 py-1.5 bg-black/40">
                  <p className="text-[11px] text-white/90 flex items-center gap-1.5">
                    <Camera className="size-3" />
                    Bukti pengiriman — ketuk untuk buka
                  </p>
                </div>
              </a>
            )}
            {stop.notes && (
              <div className="text-sm bg-muted/30 p-3 rounded-lg border border-dashed">
                <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground block mb-1">Catatan:</span>
                <span className="text-foreground">{stop.notes}</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

