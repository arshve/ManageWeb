'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
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
import { DashboardShell } from '@/components/dashboard/dashboard-shell';
import { createEntry } from '@/app/actions/entries';
import { toast } from 'sonner';
import { LivestockPicker, type PickerLivestock } from '@/components/dashboard/livestock-picker';
import { BuktiTransferUpload } from '@/components/dashboard/bukti-transfer-upload';
import { formatRupiah, formatWeight } from '@/lib/format';
import { X } from 'lucide-react';

interface SelectedItem {
  livestock: PickerLivestock;
  hargaJual: string;
  tag: string;
}

const PENGIRIMAN_OPTIONS = [
  { value: 'HARI_H', label: 'Hari H' },
  { value: 'H_1', label: 'H-1' },
  { value: 'H_2', label: 'H-2' },
  { value: 'H_3', label: 'H-3' },
  { value: 'TITIP_POTONG', label: 'Titip Potong' },
] as const;

const PENGIRIMAN_LABEL: Record<string, string> = Object.fromEntries(
  PENGIRIMAN_OPTIONS.map((o) => [o.value, o.label]),
);

const PAYMENT_LABEL: Record<string, string> = {
  BELUM_BAYAR: 'Belum Bayar',
  DP: 'DP (Uang Muka)',
  LUNAS: 'Lunas',
};

export default function NewEntryPage() {
  const [livestock, setLivestock] = useState<PickerLivestock[]>([]);
  const [selectedItems, setSelectedItems] = useState<SelectedItem[]>([]);
  const [pengiriman, setPengiriman] = useState('HARI_H');
  const [paymentStatus, setPaymentStatus] = useState('BELUM_BAYAR');
  const [buktiTransferUrls, setBuktiTransferUrls] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  useEffect(() => {
    fetch('/api/livestock/available', { cache: 'no-store' })
      .then((res) => {
        if (!res.ok) throw new Error('Failed');
        return res.json();
      })
      .then(setLivestock)
      .catch(() => toast.error('Gagal memuat data hewan'));
  }, []);

  const selectedIds = selectedItems.map((i) => i.livestock.id);
  const totalHargaJual = selectedItems.reduce((s, i) => s + (Number(i.hargaJual) || 0), 0);

  function handleToggle(id: string) {
    const existing = selectedItems.find((i) => i.livestock.id === id);
    if (existing) {
      setSelectedItems((prev) => prev.filter((i) => i.livestock.id !== id));
    } else {
      const lv = livestock.find((l) => l.id === id);
      if (!lv) return;
      setSelectedItems((prev) => [
        ...prev,
        { livestock: lv, hargaJual: lv.hargaJual?.toString() ?? '', tag: lv.tag ?? '' },
      ]);
    }
  }

  function updateItem(id: string, field: 'hargaJual' | 'tag', value: string) {
    setSelectedItems((prev) =>
      prev.map((i) => (i.livestock.id === id ? { ...i, [field]: value } : i)),
    );
  }

  async function handleSubmit(formData: FormData) {
    if (selectedItems.length === 0) {
      toast.error('Pilih minimal satu hewan');
      return;
    }

    formData.set(
      'items',
      JSON.stringify(
        selectedItems.map((i) => ({
          livestockId: i.livestock.id,
          hargaJual: Number(i.hargaJual) || 0,
          tag: i.tag || null,
        })),
      ),
    );
    formData.set('paymentStatus', paymentStatus);
    if (paymentStatus === 'LUNAS') {
      formData.set('totalBayar', String(totalHargaJual));
    }
    buktiTransferUrls.forEach((url) => formData.append('buktiTransfer', url));

    setLoading(true);
    const result = await createEntry(formData);
    if ('error' in result) {
      toast.error(result.error);
    } else {
      toast.success('Entry berhasil dibuat, menunggu approval admin');
      router.push('/sales');
    }
    setLoading(false);
  }

  return (
    <DashboardShell
      title="Tambah Entry Baru"
      description="Pilih hewan dan isi data pembeli"
    >
      <form action={handleSubmit} className="space-y-5 max-w-2xl">
        {/* ── Pilih Hewan ── */}
        <section className="rounded-xl border bg-card p-4 space-y-3">
          <h3 className="font-semibold text-sm">Pilih Hewan</h3>
          <LivestockPicker
            livestock={livestock}
            selectedIds={selectedIds}
            onToggle={handleToggle}
          />

          {/* Selected items list */}
          {selectedItems.length > 0 && (
            <div className="border-t pt-3 space-y-2">
              <p className="text-xs font-medium text-muted-foreground">
                {selectedItems.length} hewan dipilih
              </p>
              {selectedItems.map((item) => {
                const lv = item.livestock;
                const typeLabel = lv.type.charAt(0) + lv.type.slice(1).toLowerCase();
                const weightStr = formatWeight(lv.weightMin, lv.weightMax);
                return (
                  <div
                    key={lv.id}
                    className="flex items-start gap-2 p-2 rounded-lg border bg-muted/30"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate">
                        {typeLabel}{lv.grade ? ` · ${lv.grade}` : ''}{weightStr ? ` · ${weightStr}` : ''}
                      </p>
                      <p className="text-[11px] text-muted-foreground font-mono">{lv.sku}</p>
                      <div className="flex gap-2 mt-1.5">
                        <div className="flex-1 space-y-0.5">
                          <Label className="text-[10px]">Tag</Label>
                          <Input
                            value={item.tag}
                            onChange={(e) => updateItem(lv.id, 'tag', e.target.value)}
                            placeholder="MF-00X"
                            className="h-7 text-xs"
                          />
                        </div>
                        <div className="flex-1 space-y-0.5">
                          <Label className="text-[10px]">Harga Jual *</Label>
                          <RupiahInput
                            value={item.hargaJual}
                            onValueChange={(v) => updateItem(lv.id, 'hargaJual', v)}
                            className="h-7 text-xs"
                            placeholder="3500000"
                          />
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleToggle(lv.id)}
                      className="text-muted-foreground hover:text-destructive mt-0.5 shrink-0"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                );
              })}
              <div className="flex justify-between items-center pt-1 text-sm font-medium">
                <span>Total</span>
                <span>{formatRupiah(totalHargaJual)}</span>
              </div>
            </div>
          )}
        </section>

        {/* ── Data Pembeli ── */}
        <section className="rounded-xl border bg-card p-4 space-y-4">
          <h3 className="font-semibold text-sm">Data Pembeli</h3>
          <div className="space-y-1.5">
            <Label htmlFor="buyerName">Nama Pembeli *</Label>
            <Input id="buyerName" name="buyerName" required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="buyerPhone">No. Telepon</Label>
            <Input id="buyerPhone" name="buyerPhone" type="tel" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="buyerAddress">Alamat Lengkap</Label>
            <Textarea id="buyerAddress" name="buyerAddress" rows={2} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="buyerMaps">Link Google Maps</Label>
            <Input id="buyerMaps" name="buyerMaps" placeholder="https://maps.google.com/..." />
          </div>
        </section>

        {/* ── Pengiriman ── */}
        <section className="rounded-xl border bg-card p-4 space-y-4">
          <h3 className="font-semibold text-sm">Pengiriman</h3>
          <input type="hidden" name="pengiriman" value={pengiriman} />
          <Select value={pengiriman} onValueChange={(val) => setPengiriman(val ?? 'HARI_H')}>
            <SelectTrigger>
              <SelectValue>{PENGIRIMAN_LABEL[pengiriman] ?? pengiriman}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {PENGIRIMAN_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </section>

        {/* ── Pembayaran ── */}
        <section className="rounded-xl border bg-card p-4 space-y-4">
          <h3 className="font-semibold text-sm">Pembayaran</h3>
          {totalHargaJual > 0 && (
            <div className="flex justify-between text-sm text-muted-foreground border-b pb-2">
              <span>Total Harga Jual</span>
              <span className="font-medium text-foreground">{formatRupiah(totalHargaJual)}</span>
            </div>
          )}
          <div className="space-y-1.5">
            <Label>Status Pembayaran</Label>
            <Select
              value={paymentStatus}
              onValueChange={(val) => setPaymentStatus(val ?? 'BELUM_BAYAR')}
            >
              <SelectTrigger>
                <SelectValue>{PAYMENT_LABEL[paymentStatus] ?? paymentStatus}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="BELUM_BAYAR">Belum Bayar</SelectItem>
                <SelectItem value="DP">DP (Uang Muka)</SelectItem>
                <SelectItem value="LUNAS">Lunas</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {paymentStatus === 'DP' && (
            <div className="space-y-1.5">
              <Label htmlFor="dp">Jumlah DP</Label>
              <RupiahInput id="dp" name="dp" placeholder="1000000" />
            </div>
          )}
          <div className="space-y-1.5">
            <Label>Bukti Transfer</Label>
            <BuktiTransferUpload onChange={setBuktiTransferUrls} />
          </div>
        </section>

        {/* ── Catatan ── */}
        <section className="rounded-xl border bg-card p-4 space-y-3">
          <h3 className="font-semibold text-sm">Catatan</h3>
          <Textarea name="notes" rows={2} placeholder="Catatan tambahan..." />
        </section>

        <Button type="submit" className="w-full h-12 text-base" disabled={loading}>
          {loading ? 'Menyimpan...' : 'Kirim Entry'}
        </Button>
      </form>
    </DashboardShell>
  );
}
