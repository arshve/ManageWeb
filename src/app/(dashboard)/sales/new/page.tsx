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
import { LivestockPicker } from '@/components/dashboard/livestock-picker';
import { BuktiTransferUpload } from '@/components/dashboard/bukti-transfer-upload';

interface AvailableLivestock {
  id: string;
  sku: string;
  type: string;
  grade: string | null;
  tag: string | null;
  hargaJual: number | null;
  weightMin: number | null;
  weightMax: number | null;
  condition: string;
  photoUrl: string | null;
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
  const [livestock, setLivestock] = useState<AvailableLivestock[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [livestockTag, setLivestockTag] = useState('');
  const [pengiriman, setPengiriman] = useState('HARI_H');
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
  }, []);

  const selected = livestock.find((l) => l.id === selectedId);

  useEffect(() => {
    if (selected) {
      setHargaJual(selected.hargaJual?.toString() ?? '');
      setLivestockTag(selected.tag ?? '');
    } else {
      setHargaJual('');
      setLivestockTag('');
    }
  }, [selected]);


  async function handleSubmit(formData: FormData) {
    if (!selectedId) {
      toast.error('Pilih hewan terlebih dahulu');
      return;
    }
    formData.set('livestockId', selectedId);
    formData.set('paymentStatus', paymentStatus);

    // Lunas: auto-set totalBayar = hargaJual
    if (paymentStatus === 'LUNAS') {
      formData.set('totalBayar', hargaJual);
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
            selectedId={selectedId}
            onSelect={setSelectedId}
          />

          {selected && (
            <div className="space-y-1.5 pt-2 border-t">
              <Label htmlFor="livestockTag">Tag Hewan</Label>
              <Input
                id="livestockTag"
                name="livestockTag"
                value={livestockTag}
                onChange={(e) => setLivestockTag(e.target.value)}
                placeholder="MF-00X | RQ-00X | QB-00X"
              />
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
          <input type="hidden" name="pengiriman" value={pengiriman} />
          <Select
            value={pengiriman}
            onValueChange={(val) => setPengiriman(val ?? 'HARI_H')}
          >
            <SelectTrigger>
              <SelectValue>
                {PENGIRIMAN_LABEL[pengiriman] ?? pengiriman}
              </SelectValue>
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
                <SelectValue>
                  {PAYMENT_LABEL[paymentStatus] ?? paymentStatus}
                </SelectValue>
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

        <Button
          type="submit"
          className="w-full h-12 text-base"
          disabled={loading}
        >
          {loading ? 'Menyimpan...' : 'Kirim Entry'}
        </Button>
      </form>
    </DashboardShell>
  );
}
