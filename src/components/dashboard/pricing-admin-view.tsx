'use client';

import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Pencil, Trash2 } from 'lucide-react';
import { formatRupiah } from '@/lib/format';
import { PricingForm } from '@/components/dashboard/pricing-form';
import { deletePricing } from '@/app/actions/pricing';
import { toast } from 'sonner';

interface PricingRow {
  id: string;
  animalType: string;
  grade: string;
  hargaBeli: number;
  hargaJual: number;
}

const TYPE_LABELS: Record<string, string> = { KAMBING: 'Kambing', DOMBA: 'Domba' };
const GRADE_ORDER = ['SUPER', 'A', 'B', 'C', 'D'];

function PricingDeleteButton({ id, label }: { id: string; label: string }) {
  const [loading, setLoading] = useState(false);
  async function handleDelete() {
    if (!confirm(`Hapus harga ${label}?`)) return;
    setLoading(true);
    const result = await deletePricing(id);
    if ('error' in result) {
      toast.error(result.error as string);
    } else {
      toast.success('Harga dihapus');
    }
    setLoading(false);
  }
  return (
    <Button
      variant="ghost"
      size="icon"
      className="h-8 w-8 text-destructive"
      onClick={handleDelete}
      disabled={loading}
    >
      <Trash2 className="h-3.5 w-3.5" />
    </Button>
  );
}

function PricingMobileRow({ pricing }: { pricing: PricingRow }) {
  const margin = pricing.hargaJual - pricing.hargaBeli;
  return (
    <div className="border rounded-lg p-3 flex items-start justify-between gap-2">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="secondary">Grade {pricing.grade === 'SUPER' ? 'Super' : pricing.grade}</Badge>
          <span className="text-xs text-primary font-medium">+{formatRupiah(margin)}</span>
        </div>
        <div className="grid grid-cols-2 gap-2 mt-2 text-xs">
          <div>
            <div className="text-muted-foreground">Beli</div>
            <div className="font-medium">{formatRupiah(pricing.hargaBeli)}</div>
          </div>
          <div>
            <div className="text-muted-foreground">Jual</div>
            <div className="font-medium">{formatRupiah(pricing.hargaJual)}</div>
          </div>
        </div>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <PricingForm
          pricing={pricing}
          trigger={
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <Pencil className="h-3.5 w-3.5" />
            </Button>
          }
        />
        <PricingDeleteButton
          id={pricing.id}
          label={`${TYPE_LABELS[pricing.animalType] ?? pricing.animalType} Grade ${pricing.grade}`}
        />
      </div>
    </div>
  );
}

export function PricingAdminView({ pricing }: { pricing: PricingRow[] }) {
  const grouped = useMemo(() => {
    const out: Record<string, PricingRow[]> = {};
    for (const p of pricing) {
      (out[p.animalType] ??= []).push(p);
    }
    for (const k in out) {
      out[k].sort(
        (a, b) => GRADE_ORDER.indexOf(a.grade) - GRADE_ORDER.indexOf(b.grade),
      );
    }
    return out;
  }, [pricing]);

  if (pricing.length === 0) {
    return (
      <Card>
        <CardContent className="p-8 text-center text-muted-foreground">
          Belum ada data harga. Klik &quot;Tambah Harga&quot; untuk memulai.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-4">
      {Object.entries(grouped).map(([type, rows]) => (
        <Card key={type}>
          <CardHeader>
            <CardTitle>{TYPE_LABELS[type] ?? type}</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left p-3 font-medium">Grade</th>
                    <th className="text-right p-3 font-medium">Harga Beli</th>
                    <th className="text-right p-3 font-medium">Harga Jual</th>
                    <th className="text-right p-3 font-medium">Margin</th>
                    <th className="text-right p-3 font-medium">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((p) => (
                    <tr key={p.id} className="border-b last:border-0">
                      <td className="p-3 font-medium">
                        {p.grade === 'SUPER' ? 'Super' : p.grade}
                      </td>
                      <td className="p-3 text-right">{formatRupiah(p.hargaBeli)}</td>
                      <td className="p-3 text-right">{formatRupiah(p.hargaJual)}</td>
                      <td className="p-3 text-right text-primary">
                        {formatRupiah(p.hargaJual - p.hargaBeli)}
                      </td>
                      <td className="p-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <PricingForm
                            pricing={p}
                            trigger={
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                            }
                          />
                          <PricingDeleteButton
                            id={p.id}
                            label={`${TYPE_LABELS[type] ?? type} Grade ${p.grade}`}
                          />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="md:hidden p-3 space-y-2">
              {rows.map((p) => (
                <PricingMobileRow key={p.id} pricing={p} />
              ))}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
