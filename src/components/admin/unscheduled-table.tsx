'use client';

import { useState } from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { MapPin, MapPinOff } from 'lucide-react';

type UnscheduledEntry = {
  id: string;
  invoiceNo: string;
  buyerName: string;
  buyerAddress: string;
  hasCoords: boolean;
};

export function UnscheduledTable({
  entries,
  dateStr,
  onSchedule,
  onBackfill,
}: {
  entries: UnscheduledEntry[];
  dateStr: string;
  onSchedule: (ids: string[]) => void;
  onBackfill: () => void;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const toggleAll = (checked: boolean) => {
    setSelected(checked ? new Set(entries.map((e) => e.id)) : new Set());
  };

  const toggleOne = (id: string, checked: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      checked ? next.add(id) : next.delete(id);
      return next;
    });
  };

  const allSelected = selected.size === entries.length && entries.length > 0;
  const someSelected = selected.size > 0 && !allSelected;

  return (
    <TooltipProvider>
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium">
            Belum Dijadwalkan{' '}
            <span className="text-muted-foreground font-normal">
              ({entries.length})
            </span>
          </h2>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={onBackfill}>
              Backfill Coords
            </Button>
            <Button
              size="sm"
              disabled={selected.size === 0}
              onClick={() => onSchedule([...selected])}
            >
              Jadwalkan ke {dateStr} {selected.size > 0 && `(${selected.size})`}
            </Button>
          </div>
        </div>

        {selected.size > 0 && (
          <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-700">
            <span>{selected.size} item dipilih</span>
            <button
              className="ml-auto text-xs underline hover:no-underline"
              onClick={() => setSelected(new Set())}
            >
              Batalkan pilihan
            </button>
          </div>
        )}

        <div className="rounded-lg border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="w-10">
                  <Checkbox
                    checked={allSelected}
                    ref={(el) => {
                      if (el)
                        (el as HTMLInputElement).indeterminate = someSelected;
                    }}
                    onCheckedChange={(v) => toggleAll(!!v)}
                  />
                </TableHead>
                <TableHead className="w-40">Invoice</TableHead>
                <TableHead>Pembeli</TableHead>
                <TableHead>Alamat</TableHead>
                <TableHead className="w-28 text-center">Koordinat</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.map((entry) => (
                <TableRow
                  key={entry.id}
                  data-state={selected.has(entry.id) ? 'selected' : undefined}
                  className="data-[state=selected]:bg-blue-50/50 cursor-pointer"
                  onClick={() => toggleOne(entry.id, !selected.has(entry.id))}
                >
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                      checked={selected.has(entry.id)}
                      onCheckedChange={(v) => toggleOne(entry.id, !!v)}
                    />
                  </TableCell>
                  <TableCell>
                    <span className="font-mono text-xs bg-muted px-2 py-0.5 rounded">
                      {entry.invoiceNo}
                    </span>
                  </TableCell>
                  <TableCell className="font-medium text-sm">
                    {entry.buyerName}
                  </TableCell>
                  <TableCell
                    className="text-xs text-muted-foreground max-w-xs truncate"
                    title={entry.buyerAddress}
                  >
                    {entry.buyerAddress}
                  </TableCell>
                  <TableCell className="text-center">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        {entry.hasCoords ? (
                          <Badge
                            variant="outline"
                            className="text-green-700 bg-green-50 border-green-200 gap-1 cursor-default"
                          >
                            <MapPin className="w-3 h-3" />
                            Ada
                          </Badge>
                        ) : (
                          <Badge
                            variant="outline"
                            className="text-red-600 bg-red-50 border-red-200 gap-1 cursor-default"
                          >
                            <MapPinOff className="w-3 h-3" />
                            Tidak ada
                          </Badge>
                        )}
                      </TooltipTrigger>
                      <TooltipContent>
                        {entry.hasCoords
                          ? 'Koordinat tersedia, siap dijadwalkan'
                          : 'Koordinat belum ada, gunakan Backfill Coords'}
                      </TooltipContent>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))}

              {entries.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="text-center text-muted-foreground py-10"
                  >
                    Semua pengiriman sudah dijadwalkan
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </TooltipProvider>
  );
}
