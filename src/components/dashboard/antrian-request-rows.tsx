'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { RupiahInput } from '@/components/ui/rupiah-input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { X, Plus } from 'lucide-react';

export interface RequestRow {
  _id: string;
  type: 'KAMBING' | 'DOMBA' | 'SAPI';
  grade: string;
  weight: string;
  hargaJual: string;
  hargaModal: string;
  resellerCut: string;
  notes: string;
}

export function emptyRow(): RequestRow {
  return {
    _id: Math.random().toString(36).slice(2),
    type: 'KAMBING',
    grade: 'A',
    weight: '',
    hargaJual: '',
    hargaModal: '',
    resellerCut: '',
    notes: '',
  };
}

export function rowsToJson(rows: RequestRow[]): string {
  return JSON.stringify(
    rows.map((r) => {
      const isSapi = r.type === 'SAPI';
      const hargaJual = Number(r.hargaJual) || 0;
      const hargaModal = r.hargaModal ? Number(r.hargaModal) : null;
      const resellerCut = r.resellerCut ? Number(r.resellerCut) : null;

      let weightMin: number | null = null;
      let weightMax: number | null = null;
      if (isSapi && r.weight) {
        const [a, b] = r.weight.split('-').map((s) => parseFloat(s.trim()));
        weightMin = isNaN(a) ? null : a;
        weightMax = b !== undefined && !isNaN(b) ? b : weightMin;
      }

      return {
        type: r.type,
        grade: isSapi ? null : r.grade || null,
        weightMin,
        weightMax,
        hargaJual,
        hargaModal,
        resellerCut,
        notes: r.notes || null,
      };
    }),
  );
}

const GRADES = ['SUPER', 'A', 'B', 'C', 'D'];

export function AntrianRequestRows({
  rows,
  onChange,
  showHargaModal = false,
}: {
  rows: RequestRow[];
  onChange: (rows: RequestRow[]) => void;
  showHargaModal?: boolean;
}) {
  function update(id: string, field: keyof RequestRow, value: string) {
    onChange(rows.map((r) => (r._id === id ? { ...r, [field]: value } : r)));
  }

  function remove(id: string) {
    onChange(rows.filter((r) => r._id !== id));
  }

  function add() {
    onChange([...rows, emptyRow()]);
  }

  return (
    <div className="space-y-3">
      {rows.map((row, idx) => (
        <div key={row._id} className="border rounded-lg p-3 space-y-3 bg-muted/20">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Permintaan {idx + 1}</span>
            {rows.length > 1 && (
              <button
                type="button"
                onClick={() => remove(row._id)}
                className="text-muted-foreground hover:text-destructive"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Type + Grade/Weight */}
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-[11px]">Jenis</Label>
              <Select
                value={row.type}
                onValueChange={(v) => {
                  if (!v) return;
                  const t = v as RequestRow['type'];
                  update(row._id, 'type', t);
                  if (t === 'SAPI') update(row._id, 'grade', '');
                  else if (!row.grade) update(row._id, 'grade', 'A');
                }}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="KAMBING">Kambing</SelectItem>
                  <SelectItem value="DOMBA">Domba</SelectItem>
                  <SelectItem value="SAPI">Sapi</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {row.type !== 'SAPI' ? (
              <div className="space-y-1">
                <Label className="text-[11px]">Grade</Label>
                <Select
                  value={row.grade || 'A'}
                  onValueChange={(v) => v && update(row._id, 'grade', v)}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {GRADES.map((g) => (
                      <SelectItem key={g} value={g}>{g}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <div className="space-y-1">
                <Label className="text-[11px]">Berat (kg)</Label>
                <Input
                  value={row.weight}
                  onChange={(e) => update(row._id, 'weight', e.target.value)}
                  placeholder="200-250"
                  className="h-8 text-xs"
                />
              </div>
            )}
          </div>

          {/* Pricing */}
          <div className={`grid gap-2 ${showHargaModal ? 'grid-cols-3' : 'grid-cols-1'}`}>
            <div className="space-y-1">
              <Label className="text-[11px]">Harga Jual *</Label>
              <RupiahInput
                value={row.hargaJual}
                onValueChange={(v) => update(row._id, 'hargaJual', v)}
                className="h-8 text-xs"
                placeholder="3500000"
              />
            </div>
            {showHargaModal && (
              <div className="space-y-1">
                <Label className="text-[11px]">Harga Modal</Label>
                <RupiahInput
                  value={row.hargaModal}
                  onValueChange={(v) => update(row._id, 'hargaModal', v)}
                  className="h-8 text-xs"
                  placeholder="2800000"
                />
              </div>
            )}
            {showHargaModal && (
              <div className="space-y-1">
                <Label className="text-[11px]">Komisi Sales</Label>
                <RupiahInput
                  value={row.resellerCut}
                  onValueChange={(v) => update(row._id, 'resellerCut', v)}
                  className="h-8 text-xs"
                  placeholder="0"
                />
              </div>
            )}
          </div>

          <div className="space-y-1">
            <Label className="text-[11px]">Catatan Permintaan</Label>
            <Textarea
              value={row.notes}
              onChange={(e) => update(row._id, 'notes', e.target.value)}
              rows={1}
              className="text-xs resize-none"
              placeholder="Misal: preferensi warna, ukuran tanduk, dll"
            />
          </div>
        </div>
      ))}

      <Button type="button" variant="outline" size="sm" onClick={add} className="w-full gap-2">
        <Plus className="h-4 w-4" />
        Tambah Permintaan
      </Button>
    </div>
  );
}
