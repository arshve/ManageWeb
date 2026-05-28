'use client';

// Extracted from deliveries-admin-view.tsx for lazy-loading — only fetched
// when the admin clicks ✓ on an ON_DELIVERY stop (mark terkirim/gagal) or
// ✏️ on a DELIVERED stop (edit bukti/catatan).

import { useEffect, useState, useTransition } from 'react';
import { toast } from 'sonner';
import { Camera } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { StatusToken, DELIVERY_STATUS } from '@/components/ui/status-token';
import { compressImage } from '@/lib/image';
import {
  markDelivered,
  markFailed,
  updateDeliveryNotesProof,
} from '@/app/actions/deliveries';
import type { ScheduledEntry } from './deliveries-admin-view';

export function AdminDeliverDialog({
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
