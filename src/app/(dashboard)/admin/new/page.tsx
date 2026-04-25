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
import { getActiveSales } from '@/app/actions/users';
import { toast } from 'sonner';
import { Search, X } from 'lucide-react';
import { LivestockPicker, type PickerLivestock } from '@/components/dashboard/livestock-picker';
import { BuktiTransferUpload } from '@/components/dashboard/bukti-transfer-upload';
import { formatRupiah, formatWeight } from '@/lib/format';

interface SelectedItem {
  livestock: PickerLivestock;
  hargaJual: string;
  hargaModal: string;
  tag: string;
}

interface SalesUser {
  id: string;
  name: string;
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

export default function AdminNewEntryPage() {
  const [livestock, setLivestock] = useState<PickerLivestock[]>([]);
  const [salesUsers, setSalesUsers] = useState<SalesUser[]>([]);
  const [salesSearch, setSalesSearch] = useState('');
  const [selectedSalesId, setSelectedSalesId] = useState('');
  const [selectedItems, setSelectedItems] = useState<SelectedItem[]>([]);
  const [pengiriman, setPengiriman] = useState('HARI_H');
  const [paymentStatus, setPaymentStatus] = useState('BELUM_BAYAR');
  const [buktiTransferUrls, setBuktiTransferUrls] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  useEffect(() => {
    fetch('/api/livestock/available', { cache: 'no-store' })
      .then((res) => { if (!res.ok) throw new Error('Failed'); return res.json(); })
      .then(setLivestock)
      .catch(() => toast.error('Gagal memuat data hewan'));

    getActiveSales()
      .then(setSalesUsers)
      .catch(() => toast.error('Gagal memuat data sales'));
  }, []);

  const selectedIds = selectedItems.map((i) => i.livestock.id);
  const selectedUser = salesUsers.find((s) => s.id === selectedSalesId);
  const filteredSales = salesUsers.filter((s) =>
    s.name.toLowerCase().includes(salesSearch.toLowerCase()),
  );
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
        {
          livestock: lv,
          hargaJual: lv.hargaJual?.toString() ?? '',
          hargaModal: (lv as { hargaModal?: number | null }).hargaModal?.toString() ?? '',
          tag: lv.tag ?? '',
        },
      ]);
    }
  }

  function updateItem(id: string, field: 'hargaJual' | 'hargaModal' | 'tag', value: string) {
    setSelectedItems((prev) =>
      prev.map((i) => (i.livestock.id === id ? { ...i, [field]: value } : i)),
    );
  }

  async function handleSubmit(formData: FormData) {
    if (!selectedSalesId) {
      toast.error('Pilih sales yang menangani');
      return;
    }
    if (selectedItems.length === 0) {
      toast.error('Pilih minimal satu hewan');
      return;
    }

    formData.set('salesId', selectedSalesId);
    formData.set('paymentStatus', paymentStatus);
    formData.set(
      'items',
      JSON.stringify(
        selectedItems.map((i) => ({
          livestockId: i.livestock.id,
          hargaJual: Number(i.hargaJual) || 0,
          hargaModal: Number(i.hargaModal) || null,
          tag: i.tag || null,
        })),
      ),
    );
    if (paymentStatus === 'LUNAS') {
      formData.set('totalBayar', String(totalHargaJual));
    }
    buktiTransferUrls.forEach((url) => formData.append('buktiTransfer', url));

    setLoading(true);
    const result = await createEntry(formData);
    if (result && 'error' in result) {
      toast.error(String(result.error));
    } else {
      toast.success('Entry berhasil dibuat & Otomatis Disetujui');
      router.push('/admin');
    }
    setLoading(false);
  }

  return (
    <DashboardShell
      title="Tambah Entry Baru"
      description="Pilih sales, hewan, dan isi data pembeli (Otomatis Disetujui)"
    >
      <form action={handleSubmit} className="space-y-5 max-w-2xl">
        <input type="hidden" name="pengiriman" value={pengiriman} />

        {/* ── Penanggung Jawab ── */}
        <section className="rounded-xl border bg-card p-4 space-y-3">
          <h3 className="font-semibold text-sm">Penanggung Jawab (Sales)</h3>
          <Select
            value={selectedSalesId || 'admin'}
            onValueChange={(val) => {
              const v = val ?? '';
              setSelectedSalesId(v === 'admin' ? '' : v);
              if (val) setSalesSearch('');
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Diri Sendiri (Admin)">
                {selectedUser ? selectedUser.name : undefined}
              </SelectValue>
            </SelectTrigger>
            <SelectContent className="min-w-max w-auto max-h-[350px]">
              <div className="sticky top-0 z-20 -mx-1 -mt-1 mb-1 border-b bg-popover p-2 rounded-t-md">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    placeholder="Cari sales..."
                    value={salesSearch}
                    onChange={(e) => setSalesSearch(e.target.value)}
                    onKeyDown={(e) => {
                      e.stopPropagation();
                      e.nativeEvent.stopImmediatePropagation();
                    }}
                    className="h-8 pl-8 text-xs"
                  />
                </div>
              </div>
              <SelectItem value="admin" label="Diri Sendiri (Admin)">Diri Sendiri (Admin)</SelectItem>
              {filteredSales.map((s) => (
                <SelectItem key={s.id} value={s.id} label={s.name}>{s.name}</SelectItem>
              ))}
              {filteredSales.length === 0 && (
                <div className="py-4 text-center text-xs text-muted-foreground">Tidak ditemukan</div>
              )}
            </SelectContent>
          </Select>
        </section>

        {/* ── Pilih Hewan ── */}
        <section className="rounded-xl border bg-card p-4 space-y-3">
          <h3 className="font-semibold text-sm">Pilih Hewan</h3>
          <LivestockPicker
            livestock={livestock}
            selectedIds={selectedIds}
            onToggle={handleToggle}
          />

          {/* Selected items list with per-item pricing */}
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
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 mt-1.5">
                        <div className="space-y-0.5">
                          <Label className="text-[10px]">Tag</Label>
                          <Input
                            value={item.tag}
                            onChange={(e) => updateItem(lv.id, 'tag', e.target.value)}
                            placeholder="MF-00X"
                            className="h-7 text-xs"
                          />
                        </div>
                        <div className="space-y-0.5">
                          <Label className="text-[10px]">Harga Jual *</Label>
                          <RupiahInput
                            value={item.hargaJual}
                            onValueChange={(v) => updateItem(lv.id, 'hargaJual', v)}
                            className="h-7 text-xs"
                            placeholder="3500000"
                          />
                        </div>
                        <div className="space-y-0.5">
                          <Label className="text-[10px]">Modal</Label>
                          <RupiahInput
                            value={item.hargaModal}
                            onValueChange={(v) => updateItem(lv.id, 'hargaModal', v)}
                            className="h-7 text-xs"
                            placeholder="2500000"
                          />
                        </div>
                        <div className="space-y-0.5">
                          <Label className="text-[10px]">Profit</Label>
                          <div className="h-7 flex items-center text-xs text-muted-foreground px-2">
                            {item.hargaJual && item.hargaModal
                              ? formatRupiah(Number(item.hargaJual) - Number(item.hargaModal))
                              : '—'}
                          </div>
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
              <div className="flex justify-between items-center pt-1 text-sm font-medium border-t">
                <span>Total Harga Jual</span>
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
                <SelectItem value="BELUM_BAYAR" label="Belum Bayar">Belum Bayar</SelectItem>
                <SelectItem value="DP" label="DP (Uang Muka)">DP (Uang Muka)</SelectItem>
                <SelectItem value="LUNAS" label="Lunas">Lunas</SelectItem>
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
          {loading ? 'Menyimpan...' : 'Kirim Entry & Setujui'}
        </Button>
      </form>
    </DashboardShell>
  );
}
