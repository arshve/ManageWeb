'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { RupiahInput } from '@/components/ui/rupiah-input';
import { Field, FieldLabel } from '@/components/ui/field';
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
  weightMin: string;
  weightMax: string;
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
    weightMin: '',
    weightMax: '',
    hargaJual: '',
    hargaModal: '',
    resellerCut: '',
    notes: '',
  };
}

export function rowsToJson(rows: RequestRow[]): string {
  return JSON.stringify(
    rows.map((r) => {
      const hargaJual = Number(r.hargaJual) || 0;
      const hargaModal = r.hargaModal ? Number(r.hargaModal) : null;
      const resellerCut = r.resellerCut ? Number(r.resellerCut) : null;
      const weightMin = r.type === 'SAPI' && r.weightMin ? Number(r.weightMin) : null;
      const weightMax = r.type === 'SAPI' && r.weightMax ? Number(r.weightMax) : null;
      return {
        type: r.type,
        grade: r.type !== 'SAPI' ? (r.grade || null) : null,
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

// key: `${type}_${grade}` → hargaJual
export type PricingMap = Record<string, number>;

export function AntrianRequestRows({
  rows,
  onChange,
  showHargaModal = false,
  pricing = {},
}: {
  rows: RequestRow[];
  onChange: (rows: RequestRow[]) => void;
  showHargaModal?: boolean;
  pricing?: PricingMap;
}) {
  function refPrice(type: string, grade: string): string {
    return pricing[`${type}_${grade}`]?.toString() ?? '';
  }

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
    <div className="flex flex-col gap-3">
      {rows.map((row, idx) => (
        <div key={row._id} className="border rounded-lg p-3 flex flex-col gap-3 bg-muted/20">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Permintaan {idx + 1}</span>
            {rows.length > 1 && (
              <button
                type="button"
                onClick={() => remove(row._id)}
                className="text-muted-foreground hover:text-destructive"
              >
                <X className="size-4" />
              </button>
            )}
          </div>

          {/* Type + Grade/Weight */}
          <div className="grid grid-cols-2 gap-2">
            <Field>
              <FieldLabel className="text-[11px]">Jenis</FieldLabel>
              <Select
                value={row.type}
                onValueChange={(v) => {
                  if (!v) return;
                  const t = v as RequestRow['type'];
                  const grade = row.grade || 'A';
                  const ref = t !== 'SAPI' ? refPrice(t, grade) : '';
                  onChange(rows.map((r) =>
                    r._id === row._id
                      ? { ...r, type: t, grade: t !== 'SAPI' ? grade : r.grade, hargaJual: t === 'SAPI' ? '' : ref || r.hargaJual }
                      : r,
                  ));
                }}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent alignItemWithTrigger={false}>
                  <SelectItem value="KAMBING">Kambing</SelectItem>
                  <SelectItem value="DOMBA">Domba</SelectItem>
                  <SelectItem value="SAPI">Sapi</SelectItem>
                </SelectContent>
              </Select>
            </Field>

            {row.type === 'SAPI' ? (
              <div className="grid grid-cols-2 gap-1 col-span-1">
                <Field>
                  <FieldLabel className="text-[11px]">Min kg</FieldLabel>
                  <Input
                    type="number"
                    value={row.weightMin}
                    onChange={(e) => update(row._id, 'weightMin', e.target.value)}
                    className="h-8 text-xs"
                    placeholder="200"
                  />
                </Field>
                <Field>
                  <FieldLabel className="text-[11px]">Max kg</FieldLabel>
                  <Input
                    type="number"
                    value={row.weightMax}
                    onChange={(e) => update(row._id, 'weightMax', e.target.value)}
                    className="h-8 text-xs"
                    placeholder="300"
                  />
                </Field>
              </div>
            ) : (
              <Field>
                <FieldLabel className="text-[11px]">Grade</FieldLabel>
                <Select
                  value={row.grade || 'A'}
                  onValueChange={(v) => {
                    if (!v) return;
                    const ref = refPrice(row.type, v);
                    onChange(rows.map((r) =>
                      r._id === row._id
                        ? { ...r, grade: v, hargaJual: ref || r.hargaJual }
                        : r,
                    ));
                  }}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent alignItemWithTrigger={false}>
                    {GRADES.map((g) => (
                      <SelectItem key={g} value={g}>{g}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            )}
          </div>

          {/* Pricing */}
          <div className={`grid gap-2 ${showHargaModal ? 'grid-cols-3' : 'grid-cols-1'}`}>
            <Field>
              <FieldLabel className="text-[11px]">Harga Jual *</FieldLabel>
              <RupiahInput
                value={row.hargaJual}
                onValueChange={(v) => update(row._id, 'hargaJual', v)}
                className="h-8 text-xs"
                placeholder="3500000"
              />
            </Field>
            {showHargaModal && (
              <Field>
                <FieldLabel className="text-[11px]">Harga Modal</FieldLabel>
                <RupiahInput
                  value={row.hargaModal}
                  onValueChange={(v) => update(row._id, 'hargaModal', v)}
                  className="h-8 text-xs"
                  placeholder="2800000"
                />
              </Field>
            )}
            {showHargaModal && (
              <Field>
                <FieldLabel className="text-[11px]">Komisi Sales</FieldLabel>
                <RupiahInput
                  value={row.resellerCut}
                  onValueChange={(v) => update(row._id, 'resellerCut', v)}
                  className="h-8 text-xs"
                  placeholder="0"
                />
              </Field>
            )}
          </div>

          <Field>
            <FieldLabel className="text-[11px]">Catatan Permintaan</FieldLabel>
            <Textarea
              value={row.notes}
              onChange={(e) => update(row._id, 'notes', e.target.value)}
              rows={1}
              className="text-xs resize-none"
              placeholder="Misal: preferensi warna, ukuran tanduk, dll"
            />
          </Field>
        </div>
      ))}

      <Button type="button" variant="outline" size="sm" onClick={add} className="w-full gap-2">
        <Plus className="size-4" />
        Tambah Permintaan
      </Button>
    </div>
  );
}
