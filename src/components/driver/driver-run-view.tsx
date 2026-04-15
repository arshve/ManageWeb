'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import {
  startDeliveryRun,
  markDelivered,
  markFailed,
} from '@/app/actions/deliveries';
import { navigationUrl } from '@/lib/delivery/maps';
import { LivestockPhoto } from '@/components/dashboard/livestock-photo';

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
  const notStarted = stops.length > 0 && stops.every((s) => s.status === 'ASSIGNED');
  const current = stops.find((s) => s.status === 'ON_DELIVERY');

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
      else toast.success('Rute dimulai');
    });
  }

  return (
    <div className="space-y-3">
      <Card>
        <CardContent className="p-3 flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => gotoDate(dateOffset(-1))}
          >
            ← Sebelum
          </Button>
          <Input
            type="date"
            value={deliveryDate}
            onChange={(e) => e.target.value && gotoDate(e.target.value)}
            className="h-8 w-[160px]"
          />
          <Button
            size="sm"
            variant="outline"
            onClick={() => gotoDate(dateOffset(1))}
          >
            Sesudah →
          </Button>
          {!isToday && (
            <Button size="sm" variant="ghost" onClick={gotoToday}>
              Hari ini
            </Button>
          )}
          {!isToday && (
            <Badge variant="outline" className="ml-auto text-xs">
              Read-only
            </Badge>
          )}
        </CardContent>
      </Card>

      {isToday && notStarted && (
        <Button className="w-full" onClick={handleStart} disabled={pending}>
          Mulai Rute
        </Button>
      )}

      {stops.map((s) => (
        <StopCard
          key={s.id}
          stop={s}
          isCurrent={isToday && current?.id === s.id}
          readOnly={!isToday}
        />
      ))}

      {stops.length === 0 && (
        <div className="text-center text-muted-foreground p-8 text-sm">
          Tidak ada delivery untuk tanggal ini.
        </div>
      )}
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

  async function handleDelivered() {
    setBusy(true);
    const r = await markDelivered(stop.id, notes || undefined);
    if ('error' in r) toast.error(r.error);
    else toast.success('Terkirim');
    setBusy(false);
  }

  async function handleFailed() {
    const reason = prompt('Alasan gagal?');
    if (!reason) return;
    setBusy(true);
    const r = await markFailed(stop.id, reason);
    if ('error' in r) toast.error(r.error);
    else toast.success('Ditandai gagal');
    setBusy(false);
  }

  const tagLabel = stop.entry.livestock.tag ?? stop.entry.livestock.sku;
  const typeLabel =
    stop.entry.livestock.type +
    (stop.entry.livestock.grade ? ' ' + stop.entry.livestock.grade : '');

  return (
    <Card className={isCurrent ? 'border-primary' : ''}>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start gap-3">
          <div className="flex flex-col items-center gap-1 shrink-0">
            <span className="text-xs font-mono text-muted-foreground">
              #{stop.sequence + 1}
            </span>
            <LivestockPhoto
              photoUrl={stop.entry.livestock.photoUrl}
              alt={`${typeLabel} - ${tagLabel}`}
              thumbnailClassName="w-16 h-16 sm:w-20 sm:h-20"
            />
            <span className="text-[10px] font-mono text-muted-foreground truncate max-w-[5rem]">
              {tagLabel}
            </span>
          </div>
          <div className="flex-1 min-w-0 space-y-1">
            <div className="flex items-start justify-between gap-2">
              <div className="font-medium text-base truncate">
                {stop.entry.buyerName}
              </div>
              <StatusBadge status={stop.status} />
            </div>
            <div className="text-xs text-muted-foreground">{typeLabel}</div>
            <div className="text-xs text-muted-foreground">
              Sales: {stop.entry.salesName}
            </div>
            {stop.entry.buyerAddress && (
              <div className="text-sm text-foreground/90 whitespace-pre-wrap break-words">
                {stop.entry.buyerAddress}
              </div>
            )}
            <div className="flex flex-wrap gap-x-3 gap-y-1 text-sm pt-1">
              {mapsHref && (
                <a
                  href={mapsHref}
                  target="_blank"
                  rel="noreferrer"
                  className="text-primary underline"
                >
                  Buka Maps
                </a>
              )}
              {stop.entry.buyerPhone && (
                <a
                  href={`tel:${stop.entry.buyerPhone}`}
                  className="text-primary underline"
                >
                  {stop.entry.buyerPhone}
                </a>
              )}
            </div>
          </div>
        </div>

        {!done && isCurrent && !readOnly && (
          <>
            <Textarea
              placeholder="Catatan (opsional)"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="text-sm"
            />
            <div className="flex gap-2">
              <Button
                className="flex-1"
                disabled={busy}
                onClick={handleDelivered}
              >
                Terkirim
              </Button>
              <Button variant="outline" disabled={busy} onClick={handleFailed}>
                Gagal
              </Button>
            </div>
          </>
        )}

        {done && stop.notes && (
          <div className="text-xs text-muted-foreground italic">{stop.notes}</div>
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
    }
  > = {
    ASSIGNED: { label: 'Siap', variant: 'outline' },
    ON_DELIVERY: { label: 'Jalan', variant: 'default' },
    DELIVERED: { label: 'Terkirim', variant: 'secondary' },
    FAILED: { label: 'Gagal', variant: 'destructive' },
    PENDING: { label: 'Pending', variant: 'outline' },
  };
  const m = map[status] ?? { label: status, variant: 'outline' as const };
  return <Badge variant={m.variant}>{m.label}</Badge>;
}
