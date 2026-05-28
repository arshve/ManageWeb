'use client';

// Extracted from entry-table.tsx so it can be lazy-loaded (only fetched when
// the user clicks the pencil/swap trigger). Behavior is unchanged.

import { useEffect, useState } from 'react';
import { Beef, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  LivestockPicker,
  type PickerLivestock,
} from '@/components/dashboard/livestock-picker';
import { getAvailableLivestockForSwap } from '@/app/actions/entries';
import type { EntryItemData } from './entry-table';

export function LivestockSwapDialog({
  currentLivestock,
  pendingLivestockSku,
  onSwap,
  onReset,
}: {
  currentLivestock: EntryItemData['livestock'];
  pendingLivestockSku: string | null;
  onSwap: (livestockId: string, sku: string, grade: string | null, hargaJual: number | null) => void;
  onReset: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState<PickerLivestock[]>([]);
  const [loadingOpts, setLoadingOpts] = useState(false);

  useEffect(() => {
    if (!open || options.length > 0) return;
    setLoadingOpts(true);
    getAvailableLivestockForSwap(currentLivestock.type).then((res) => {
      if (!('error' in res)) setOptions(res as PickerLivestock[]);
      setLoadingOpts(false);
    });
  }, [open, currentLivestock.type, options.length]);

  const selectedId = pendingLivestockSku
    ? (options.find((o) => o.sku === pendingLivestockSku)?.id ?? null)
    : null;

  return (
    <>
      {pendingLivestockSku ? (
        <span className="inline-flex items-center gap-1">
          <Button size="sm" variant="secondary" className="h-6 text-xs px-2 gap-1" onClick={() => setOpen(true)}>
            <Beef className="size-3" />
            {pendingLivestockSku}
          </Button>
          <Button size="sm" variant="ghost" className="size-6 p-0 text-muted-foreground" onClick={onReset} title="Batal ganti">
            <X className="size-3" />
          </Button>
        </span>
      ) : (
        <Button size="sm" variant="outline" className="h-6 text-xs px-2 gap-1" onClick={() => setOpen(true)}>
          <Beef className="size-3" />
          Ganti
        </Button>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Ganti Hewan</DialogTitle>
            <DialogDescription>
              Saat ini: <span className="font-mono">{currentLivestock.sku}</span>
              {currentLivestock.grade ? ` · ${currentLivestock.grade}` : ''}
            </DialogDescription>
          </DialogHeader>
          {loadingOpts ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Memuat hewan tersedia...</p>
          ) : (
            <LivestockPicker
              livestock={options}
              selectedIds={selectedId ? [selectedId] : []}
              onToggle={(id) => {
                const lv = options.find((o) => o.id === id);
                if (!lv) return;
                onSwap(lv.id, lv.sku, lv.grade, lv.hargaJual);
                setOpen(false);
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
