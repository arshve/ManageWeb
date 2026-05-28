'use client';

// Extracted from entry-table.tsx for code-splitting — the dialog (and its
// dependencies: RupiahInput, LivestockSwapDialog, batchUpdateEntryItems server
// action) only loads when the "Edit Batch" button is clicked.

import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { RupiahInput } from '@/components/ui/rupiah-input';
import { batchUpdateEntryItems } from '@/app/actions/entries';
import { formatRupiah } from '@/lib/format';
import { toThumbnailUrl } from '@/lib/image';
import { LivestockSwapDialog } from './livestock-swap-dialog';
import type { EntryData, EntryItemData } from './entry-table';

type BatchItemRow = {
  entryId: string;
  entryInvoice: string;
  buyerName: string;
  salesName: string;
  itemId: string;
  livestock: EntryItemData['livestock'];
  hargaJual: string;
  hargaModal: string;
  resellerCut: string;
  pendingLivestockId?: string;
  pendingLivestockSku?: string;
};

export function BatchEditDialog({
  entries,
  open,
  onClose,
  onSaved,
}: {
  entries: EntryData[];
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [rows, setRows] = useState<BatchItemRow[]>(() =>
    entries.flatMap((e) =>
      e.items.map((item) => ({
        entryId: e.id,
        entryInvoice: e.invoiceNo,
        buyerName: e.buyerName,
        salesName: e.sales.name,
        itemId: item.id,
        livestock: item.livestock,
        hargaJual: item.hargaJual > 0 ? String(item.hargaJual) : '',
        hargaModal: item.hargaModal != null ? String(item.hargaModal) : '',
        resellerCut: item.resellerCut != null ? String(item.resellerCut) : '',
      })),
    ),
  );
  const [loading, setLoading] = useState(false);
  const [fillModal, setFillModal] = useState('');
  const [fillCut, setFillCut] = useState('');

  function updateRow(itemId: string, field: 'hargaJual' | 'hargaModal' | 'resellerCut', val: string) {
    setRows((prev) => prev.map((r) => r.itemId === itemId ? { ...r, [field]: val } : r));
  }

  function updateRowSwap(itemId: string, livestockId: string, sku: string) {
    setRows((prev) => prev.map((r) =>
      r.itemId === itemId ? { ...r, pendingLivestockId: livestockId, pendingLivestockSku: sku } : r,
    ));
  }

  function applyFillModal() {
    if (!fillModal) return;
    setRows((prev) => prev.map((r) => ({ ...r, hargaModal: fillModal })));
  }

  function applyFillCut() {
    if (!fillCut) return;
    setRows((prev) => prev.map((r) => ({ ...r, resellerCut: fillCut })));
  }

  const totalProfit = rows.reduce((sum, r) => {
    const hj = Number(r.hargaJual) || 0;
    const hm = r.hargaModal !== '' ? Number(r.hargaModal) : null;
    const rc = r.resellerCut !== '' ? Number(r.resellerCut) : 0;
    const hpp = hm != null ? hm + rc : null;
    return sum + (hpp != null ? hj - hpp : 0);
  }, 0);

  async function handleSave() {
    setLoading(true);
    try {
      const updates = entries.map((e) => ({
        entryId: e.id,
        items: rows
          .filter((r) => r.entryId === e.id)
          .map((r) => ({
            itemId: r.itemId,
            hargaJual: r.hargaJual !== '' ? Number(r.hargaJual) : undefined,
            hargaModal: r.hargaModal !== '' ? Number(r.hargaModal) : (r.hargaModal === '' ? null : undefined),
            resellerCut: r.resellerCut !== '' ? Number(r.resellerCut) : (r.resellerCut === '' ? null : undefined),
            newLivestockId: r.pendingLivestockId,
          })),
      }));
      const res = await batchUpdateEntryItems(updates);
      if (res && 'error' in res) { toast.error(String(res.error)); return; }
      toast.success(`${entries.length} entry berhasil diperbarui`);
      onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Terjadi kesalahan');
    } finally {
      setLoading(false);
    }
  }

  // Group rows by entry
  const grouped = entries.map((e) => ({
    entry: e,
    rows: rows.filter((r) => r.entryId === e.id),
  }));

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-2xl w-[95vw] max-h-[90dvh] overflow-hidden flex flex-col p-0">
        <DialogHeader className="px-6 pt-6 pb-0 shrink-0">
          <DialogTitle>Edit Batch — {entries.length} Entry</DialogTitle>
          <DialogDescription>
            Ubah Modal, Sales Cut, dan Harga Jual untuk semua item yang dipilih.
          </DialogDescription>
        </DialogHeader>

        {/* Quick-fill strip */}
        <div className="px-4 py-2.5 border-b bg-muted/30 shrink-0 flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground w-28 shrink-0">Isi semua Modal</span>
            <RupiahInput value={fillModal} onValueChange={setFillModal} className="h-7 text-xs flex-1" />
            <Button size="sm" variant="outline" className="h-7 text-xs shrink-0 px-3" onClick={applyFillModal} disabled={!fillModal}>Terapkan</Button>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground w-28 shrink-0">Isi semua Sales Cut</span>
            <RupiahInput value={fillCut} onValueChange={setFillCut} className="h-7 text-xs flex-1" />
            <Button size="sm" variant="outline" className="h-7 text-xs shrink-0 px-3" onClick={applyFillCut} disabled={!fillCut}>Terapkan</Button>
          </div>
        </div>

        {/* Scrollable item list */}
        <div className="flex-1 min-h-0 overflow-y-auto px-4 py-3 space-y-3">
          {grouped.map(({ entry, rows: entryRows }) => (
            <div key={entry.id} className="rounded-md border overflow-hidden">
              {/* Entry header */}
              <div className="px-3 py-2 bg-muted/40 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs font-medium border-b">
                <span className="font-mono">{entry.invoiceNo}</span>
                <span className="text-muted-foreground">·</span>
                <span className="truncate">{entry.buyerName}</span>
                <span className="text-muted-foreground">·</span>
                <span className="text-muted-foreground">{entry.sales.name}</span>
              </div>
              {/* Item rows — 2-line layout */}
              {entryRows.map((row) => {
                const lv = row.livestock;
                const hj = Number(row.hargaJual) || 0;
                const hm = row.hargaModal !== '' ? Number(row.hargaModal) : null;
                const rc = row.resellerCut !== '' ? Number(row.resellerCut) : 0;
                const hpp = hm != null ? hm + rc : null;
                const profit = hpp != null ? hj - hpp : null;
                return (
                  <div key={row.itemId} className="px-3 py-2.5 border-b last:border-0">
                    {/* Line 1: livestock info + profit chip + swap */}
                    <div className="flex items-center gap-2 mb-2">
                      {lv.photoUrl && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={toThumbnailUrl(lv.photoUrl)} alt={lv.sku} width={28} height={28} className="size-7 rounded object-cover border shrink-0" loading="lazy" />
                      )}
                      <div className="flex-1 min-w-0 text-xs">
                        <span className="font-medium">{lv.tag ?? lv.sku}</span>
                        <span className="text-muted-foreground ml-1.5">{lv.type}{lv.grade ? ' ' + lv.grade : ''}</span>
                        {row.pendingLivestockSku && (
                          <span className="ml-1.5 text-[10px] text-warning-fg bg-warning-bg px-1 rounded">→ {row.pendingLivestockSku}</span>
                        )}
                      </div>
                      <div className="text-xs text-right shrink-0">
                        <span className="text-[10px] text-muted-foreground">Profit </span>
                        <span className={profit != null ? (profit >= 0 ? 'text-success-fg font-medium' : 'text-destructive font-medium') : 'text-muted-foreground'}>
                          {profit != null ? formatRupiah(profit) : '—'}
                        </span>
                      </div>
                      <LivestockSwapDialog
                        currentLivestock={lv}
                        pendingLivestockSku={row.pendingLivestockSku ?? null}
                        onSwap={(livestockId, sku) => updateRowSwap(row.itemId, livestockId, sku)}
                        onReset={() => setRows((prev) => prev.map((r) => r.itemId === row.itemId ? { ...r, pendingLivestockId: undefined, pendingLivestockSku: undefined } : r))}
                      />
                    </div>
                    {/* Line 2: 3 inputs full-width */}
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <p className="text-[10px] text-muted-foreground mb-1">Harga Jual</p>
                        <RupiahInput value={row.hargaJual} onValueChange={(v) => updateRow(row.itemId, 'hargaJual', v)} className="h-7 text-xs w-full" />
                      </div>
                      <div>
                        <p className="text-[10px] text-muted-foreground mb-1">Modal</p>
                        <RupiahInput value={row.hargaModal} onValueChange={(v) => updateRow(row.itemId, 'hargaModal', v)} className="h-7 text-xs w-full" />
                      </div>
                      <div>
                        <p className="text-[10px] text-muted-foreground mb-1">Sales Cut</p>
                        <RupiahInput value={row.resellerCut} onValueChange={(v) => updateRow(row.itemId, 'resellerCut', v)} className="h-7 text-xs w-full" />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t bg-muted/20 shrink-0 flex items-center justify-between gap-3">
          <div className="text-sm">
            <span className="text-muted-foreground text-xs">Total profit preview: </span>
            <span className={`font-semibold ${totalProfit >= 0 ? 'text-success-fg' : 'text-destructive'}`}>
              {formatRupiah(totalProfit)}
            </span>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose} disabled={loading}>Batal</Button>
            <Button onClick={handleSave} disabled={loading}>
              {loading ? 'Menyimpan...' : `Simpan ${entries.length} Entry`}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
