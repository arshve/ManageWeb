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
import { Beef, Search } from 'lucide-react';
import { LivestockPhoto } from '@/components/dashboard/livestock-photo';
import { BuktiTransferUpload } from '@/components/dashboard/bukti-transfer-upload';
import { formatWeight, formatRupiah } from '@/lib/format';

interface AvailableLivestock {
  id: string;
  sku: string;
  type: string;
  grade: string | null;
  weightMin: number | null;
  weightMax: number | null;
  condition: string;
  photoUrl: string | null;
  hargaJual: number | null;
  tag: string | null;
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

export default function AdminNewEntryPage() {
  const [livestock, setLivestock] = useState<AvailableLivestock[]>([]);
  const [salesUsers, setSalesUsers] = useState<SalesUser[]>([]);

  const [salesSearch, setSalesSearch] = useState('');
  const [livestockSearch, setLivestockSearch] = useState('');

  const [selectedId, setSelectedId] = useState('');
  const [selectedSalesId, setSelectedSalesId] = useState('');
  const [paymentStatus, setPaymentStatus] = useState('BELUM_BAYAR');
  const [hargaJual, setHargaJual] = useState<string>('');

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

    getActiveSales()
      .then(setSalesUsers)
      .catch(() => toast.error('Gagal memuat data sales'));
  }, []);

  const selected = livestock.find((l) => l.id === selectedId);
  const selectedUser = salesUsers.find((s) => s.id === selectedSalesId);

  const filteredSales = salesUsers.filter((s) =>
    s.name.toLowerCase().includes(salesSearch.toLowerCase()),
  );

  const filteredLivestock = livestock.filter((l) => {
    const q = livestockSearch.toLowerCase();
    return (
      l.sku.toLowerCase().includes(q) ||
      l.type.toLowerCase().includes(q) ||
      (l.grade && l.grade.toLowerCase().includes(q)) ||
      (l.tag && l.tag.toLowerCase().includes(q))
    );
  });

  useEffect(() => {
    if (selected && selected.hargaJual) {
      setHargaJual(selected.hargaJual.toString());
    } else {
      setHargaJual('');
    }
  }, [selected]);

  async function handleSubmit(formData: FormData) {
    if (!selectedSalesId) {
      toast.error('Pilih sales yang menangani');
      return;
    }
    if (!selectedId) {
      toast.error('Pilih hewan terlebih dahulu');
      return;
    }

    // Lunas: auto-set totalBayar = hargaJual
    if (paymentStatus === 'LUNAS') {
      formData.set('totalBayar', hargaJual);
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
        <input type="hidden" name="salesId" value={selectedSalesId ?? ''} />
        <input type="hidden" name="livestockId" value={selectedId ?? ''} />
        <input type="hidden" name="paymentStatus" value={paymentStatus ?? ''} />

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

              <SelectItem value="admin">Diri Sendiri (Admin)</SelectItem>
              {filteredSales.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name}
                </SelectItem>
              ))}
              {filteredSales.length === 0 && (
                <div className="py-4 text-center text-xs text-muted-foreground">
                  Tidak ditemukan
                </div>
              )}
            </SelectContent>
          </Select>
        </section>

        {/* ── Pilih Hewan ── */}
        <section className="rounded-xl border bg-card p-4 space-y-3">
          <h3 className="font-semibold text-sm">Pilih Hewan</h3>
          <Select
            value={selectedId}
            onValueChange={(val) => {
              setSelectedId(val ?? '');
              if (val) setLivestockSearch('');
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Pilih hewan yang tersedia...">
                {selected
                  ? `${selected.sku} — ${selected.type}${selected.grade ? ` ${selected.grade}` : ''}`
                  : undefined}
              </SelectValue>
            </SelectTrigger>
            <SelectContent className="min-w-max w-auto max-h-[350px]">
              <div className="sticky top-0 z-20 -mx-1 -mt-1 mb-1 border-b bg-popover p-2 rounded-t-md">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    placeholder="Cari SKU, Jenis, atau Tag..."
                    value={livestockSearch}
                    onChange={(e) => setLivestockSearch(e.target.value)}
                    onKeyDown={(e) => {
                      e.stopPropagation();
                      e.nativeEvent.stopImmediatePropagation();
                    }}
                    className="h-8 pl-8 text-xs"
                  />
                </div>
              </div>

              {filteredLivestock.map((l) => {
                const weightStr = formatWeight(l.weightMin, l.weightMax);
                return (
                  <SelectItem key={l.id} value={l.id}>
                    <span className="font-mono">{l.sku}</span> — {l.type}
                    {l.grade ? ` Grade ${l.grade}` : ''}
                    {weightStr ? ` (${weightStr})` : ''}
                  </SelectItem>
                );
              })}
              {filteredLivestock.length === 0 && (
                <div className="py-4 text-center text-xs text-muted-foreground">
                  Hewan tidak ditemukan
                </div>
              )}
            </SelectContent>
          </Select>

          {selected && (
            <div className="flex gap-3 p-3 bg-muted rounded-lg text-sm">
              <div className="relative w-20 h-20 flex-shrink-0 rounded-md overflow-hidden bg-background">
                {selected.photoUrl ? (
                  <LivestockPhoto
                    photoUrl={selected.photoUrl}
                    alt={`${selected.type}${selected.grade ? ' ' + selected.grade : ''}`}
                    thumbnailClassName="w-20 h-20"
                    priority
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Beef className="h-6 w-6 text-muted-foreground/30" />
                  </div>
                )}
              </div>
              <div className="space-y-0.5 text-xs">
                <p className="font-medium text-sm">{selected.sku}</p>
                <p className="text-muted-foreground">
                  {selected.type}
                  {selected.grade ? ` · Grade ${selected.grade}` : ''}
                </p>
                <p className="text-muted-foreground">
                  {formatWeight(selected.weightMin, selected.weightMax) ?? '—'}
                </p>
                <p className="font-medium">
                  {selected.hargaJual
                    ? formatRupiah(selected.hargaJual)
                    : 'Harga belum diset'}
                </p>
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
            <Input
              id="buyerMaps"
              name="buyerMaps"
              placeholder="https://maps.google.com/..."
            />
          </div>
        </section>

        {/* ── Pengiriman ── */}
        <section className="rounded-xl border bg-card p-4 space-y-4">
          <h3 className="font-semibold text-sm">Pengiriman</h3>
          <Select name="pengiriman" defaultValue="HARI_H">
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PENGIRIMAN_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </section>

        {/* ── Pembayaran ── */}
        <section className="rounded-xl border bg-card p-4 space-y-4">
          <h3 className="font-semibold text-sm">Pembayaran</h3>
          <div className="space-y-1.5">
            <Label htmlFor="hargaJual">Harga Jual *</Label>
            <RupiahInput
              id="hargaJual"
              name="hargaJual"
              value={hargaJual}
              onValueChange={setHargaJual}
              required
              placeholder="3500000"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Pembayaran</Label>
            <Select
              value={paymentStatus}
              onValueChange={(val) => setPaymentStatus(val ?? 'BELUM_BAYAR')}
            >
              <SelectTrigger>
                <SelectValue />
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
          {loading ? 'Menyimpan...' : 'Kirim Entry & Setujui'}
        </Button>
      </form>
    </DashboardShell>
  );
}
