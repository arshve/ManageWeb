'use client';

// Extracted from deliveries-admin-view.tsx for lazy-loading — only fetched
// when the admin clicks "Tambah Entry Tertinggal" on a driver route.

import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { addEntriesToDriverRoute } from '@/app/actions/deliveries';
import { cn } from '@/lib/utils';

export function InsertEntryDialog({
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
