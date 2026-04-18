'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Button, buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import {
  startDeliveryRun,
  markDelivered,
  markFailed,
} from '@/app/actions/deliveries';
import { navigationUrl } from '@/lib/delivery/maps';
import { LivestockPhoto } from '@/components/dashboard/livestock-photo';
import {
  MapPin,
  MessageCircle,
  Phone,
  CheckCircle2,
  AlertCircle,
  Navigation,
  Clock,
  CalendarDays,
} from 'lucide-react';

type Stop = {
  id: string;
  sequence: number;
  status: string;
  deliveredAt: string | null;
  notes: string | null;
  entry: {
    buyerName: string;
    buyerPhone: string | null;
    buyerAddress: string | null;
    buyerMaps: string | null;
    buyerLat: number | null;
    buyerLng: number | null;
    salesName: string;
    livestock: {
      sku: string;
      tag: string | null;
      type: string;
      grade: string | null;
      photoUrl: string | null;
    };
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
  const notStarted =
    stops.length > 0 && stops.every((s) => s.status === 'ASSIGNED');

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
    startTransition(async () => {
      const r = await startDeliveryRun(deliveryDate);
      if ('error' in r) toast.error(r.error);
      else toast.success('Rute dimulai! Hati-hati di jalan.');
    });
  }

  const deliveredCount = stops.filter((s) => s.status === 'DELIVERED').length;
  const progress =
    stops.length > 0 ? Math.round((deliveredCount / stops.length) * 100) : 0;

  return (
    <div className="space-y-4 pb-8">
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
            <CalendarDays className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
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
            <div className="flex justify-between text-xs font-medium mb-1">
              <span className="text-muted-foreground">Progress Pengiriman</span>
              <span className="text-primary">
                {deliveredCount} / {stops.length} Selesai
              </span>
            </div>
            <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-primary transition-all duration-500 ease-in-out"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* ── Start Route Button ── */}
      {isToday && notStarted && (
        <Button
          size="lg"
          className="w-full text-base font-semibold shadow-lg shadow-primary/20 h-14"
          onClick={handleStart}
          disabled={pending}
        >
          <Navigation className="mr-2 h-5 w-5" />
          Mulai Perjalanan Rute
        </Button>
      )}

      {/* ── Stop Cards ── */}
      <div className="space-y-4">
        {stops.map((s) => (
          <StopCard
            key={s.id}
            stop={s}
            isCurrent={isToday && current?.id === s.id && !notStarted}
            readOnly={!isToday}
          />
        ))}

        {stops.length === 0 && (
          <div className="flex flex-col items-center justify-center p-12 text-center border rounded-xl bg-muted/20 border-dashed mt-8">
            <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
              <Clock className="h-8 w-8 text-muted-foreground/50" />
            </div>
            <h3 className="font-semibold text-lg">Tidak Ada Jadwal</h3>
            <p className="text-sm text-muted-foreground mt-1 max-w-xs">
              Anda tidak memiliki jadwal pengiriman untuk tanggal ini.
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
}: {
  stop: Stop;
  isCurrent: boolean;
  readOnly: boolean;
}) {
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const done = stop.status === 'DELIVERED' || stop.status === 'FAILED';

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
    const r = await markDelivered(stop.id, notes || undefined);
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

  const typeLabel =
    stop.entry.livestock.type.charAt(0) +
    stop.entry.livestock.type.slice(1).toLowerCase() +
    (stop.entry.livestock.grade ? ' Grade ' + stop.entry.livestock.grade : '');

  return (
    <Card
      className={cn(
        'overflow-hidden transition-all duration-300',
        isCurrent
          ? 'border-primary shadow-md ring-1 ring-primary/20 scale-[1.01]'
          : '',
        done ? 'opacity-75 bg-muted/30' : '',
      )}
    >
      {/* ── Card Header ── */}
      <div
        className={cn(
          'px-4 py-2.5 border-b flex justify-between items-center',
          isCurrent ? 'bg-primary/10' : 'bg-muted/50',
          done && stop.status === 'DELIVERED'
            ? 'bg-green-500/10 border-green-500/20'
            : '',
          done && stop.status === 'FAILED'
            ? 'bg-destructive/10 border-destructive/20'
            : '',
        )}
      >
        <div className="font-bold flex items-center gap-2.5">
          <span
            className={cn(
              'w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white',
              done && stop.status === 'DELIVERED'
                ? 'bg-green-600'
                : done && stop.status === 'FAILED'
                  ? 'bg-destructive'
                  : 'bg-primary',
            )}
          >
            {stop.sequence + 1}
          </span>
          <span className="text-sm font-mono tracking-tight text-muted-foreground">
            {stop.entry.livestock.sku}
          </span>
        </div>
        <StatusBadge status={stop.status} />
      </div>

      <CardContent className="p-4 space-y-4">
        {/* ── Buyer Info ── */}
        <div>
          <h3 className="text-lg font-bold leading-tight">
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
                'flex-1 gap-2 bg-blue-50 hover:bg-blue-100 text-blue-700 border-blue-200',
              )}
            >
              <MapPin className="w-4 h-4" />
              Buka Maps
            </a>
          ) : (
            <Button variant="outline" disabled className="flex-1 gap-2">
              <MapPin className="w-4 h-4" />
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
                'flex-1 gap-2 bg-green-50 hover:bg-green-100 text-green-700 border-green-200',
              )}
            >
              <MessageCircle className="w-4 h-4" />
              Chat WA
            </a>
          ) : stop.entry.buyerPhone ? (
            <a
              href={`tel:${stop.entry.buyerPhone}`}
              className={cn(
                buttonVariants({ variant: 'outline' }),
                'flex-1 gap-2',
              )}
            >
              <Phone className="w-4 h-4" />
              Telepon
            </a>
          ) : (
            <Button variant="outline" disabled className="flex-1 gap-2">
              <Phone className="w-4 h-4" />
              No. HP (N/A)
            </Button>
          )}
        </div>

        {/* ── Animal Details ── */}
        <div className="bg-muted/40 rounded-lg p-3 flex gap-3 items-center border">
          <LivestockPhoto
            photoUrl={stop.entry.livestock.photoUrl}
            alt={stop.entry.livestock.sku}
            thumbnailClassName="w-14 h-14"
          />
          <div className="text-sm flex-1 min-w-0">
            <p className="font-semibold text-foreground truncate">
              {typeLabel}
            </p>
            <div className="text-xs text-muted-foreground mt-0.5 space-y-0.5">
              <p className="truncate">
                <span className="font-medium">Tag:</span>{' '}
                {stop.entry.livestock.tag || '—'}
              </p>
              <p className="truncate">
                <span className="font-medium">Sales:</span>{' '}
                {stop.entry.salesName}
              </p>
            </div>
          </div>
        </div>

        {/* ── Driver Action Forms ── */}
        {!done && isCurrent && !readOnly && (
          <div className="pt-3 border-t space-y-3">
            <Textarea
              placeholder="Catatan pengiriman (opsional, misal: Diterima oleh Pak RT)"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="text-sm resize-none bg-background"
            />
            <div className="flex gap-2">
              <Button
                className="flex-1 gap-2 bg-green-600 hover:bg-green-700 text-white h-11"
                disabled={busy}
                onClick={handleDelivered}
              >
                <CheckCircle2 className="w-5 h-5" />
                Terkirim
              </Button>
              <Button
                variant="destructive"
                className="gap-2 h-11 px-6"
                disabled={busy}
                onClick={handleFailed}
              >
                <AlertCircle className="w-5 h-5" />
                Gagal
              </Button>
            </div>
          </div>
        )}

        {/* ── Completed Status / Notes ── */}
        {done && stop.notes && (
          <div className="mt-2 text-sm bg-background p-3 rounded-md border border-dashed">
            <span className="font-semibold text-xs text-muted-foreground block mb-1 uppercase tracking-wider">
              Catatan Pengiriman:
            </span>
            <span className="text-foreground">{stop.notes}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
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
      label: 'Menunggu',
      variant: 'outline',
      className: 'text-amber-600 bg-amber-50 border-amber-200',
    },
    ON_DELIVERY: {
      label: 'Sedang Jalan',
      variant: 'default',
      className: 'bg-blue-500',
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
    <Badge variant={m.variant} className={cn('px-2.5 py-0.5', m.className)}>
      {m.label}
    </Badge>
  );
}
