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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DashboardShell } from '@/components/dashboard/dashboard-shell';
import { createEntry } from '@/app/actions/entries';
import { getActiveSales } from '@/app/actions/users';
import { toast } from 'sonner';
import { Beef } from 'lucide-react';
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
}

interface SalesUser {
  id: string;
  name: string;
}

export default function AdminNewEntryPage() {
  const [livestock, setLivestock] = useState<AvailableLivestock[]>([]);
  const [salesUsers, setSalesUsers] = useState<SalesUser[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [selectedSalesId, setSelectedSalesId] = useState('');
  const [buktiTransferUrls, setBuktiTransferUrls] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [hargaJual, setHargaJual] = useState<string>('');
  const router = useRouter();

  useEffect(() => {
    fetch('/api/livestock/available', { cache: 'no-store' })
      .then((res) => res.json())
      .then(setLivestock)
      .catch(() => toast.error('Gagal memuat data hewan'));

    getActiveSales()
      .then(setSalesUsers)
      .catch(() => toast.error('Gagal memuat data sales'));
  }, []);

  const selected = livestock.find((l) => l.id === selectedId);
  const selectedUser = salesUsers.find((s) => s.id === selectedSalesId);

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

    formData.set('salesId', selectedSalesId);
    formData.set('livestockId', selectedId);
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
      <form action={handleSubmit} className="space-y-6 max-w-2xl">
        {/* NATIVE HIDDEN INPUTS */}
        <input type="hidden" name="salesId" value={selectedSalesId} />
        <input type="hidden" name="livestockId" value={selectedId} />

        {/* Select Sales */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Penanggung Jawab (Sales)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Select
              value={selectedSalesId}
              onValueChange={(val) => setSelectedSalesId(val ?? '')}
            >
              <SelectTrigger>
                <SelectValue placeholder="Pilih sales yang menangani pesanan...">
                  {selectedUser ? selectedUser.name : undefined}
                </SelectValue>
              </SelectTrigger>
              <SelectContent className="min-w-max w-auto">
                {salesUsers.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        {/* Select Animal */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Pilih Hewan</CardTitle>
          </CardHeader>
          <CardContent>
            <Select
              value={selectedId}
              onValueChange={(val) => setSelectedId(val ?? '')}
            >
              <SelectTrigger>
                <SelectValue placeholder="Pilih hewan yang tersedia...">
                  {selected
                    ? `${selected.sku} — ${selected.type}${selected.grade ? ` ${selected.grade}` : ''}`
                    : undefined}
                </SelectValue>
              </SelectTrigger>
              <SelectContent className="min-w-max w-auto">
                {livestock.map((l) => {
                  const weightStr = formatWeight(l.weightMin, l.weightMax);
                  return (
                    <SelectItem key={l.id} value={l.id}>
                      {l.sku} — {l.type}
                      {l.grade ? ` Grade ${l.grade}` : ''}
                      {weightStr ? ` (${weightStr})` : ''}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
            {selected && (
              <div className="flex gap-4 p-3 mt-3 bg-muted rounded-lg text-sm">
                <div className="relative w-24 h-24 flex-shrink-0 rounded-md overflow-hidden bg-background">
                  {selected.photoUrl ? (
                    <LivestockPhoto
                      photoUrl={selected.photoUrl}
                      alt={`${selected.type}${selected.grade ? ' ' + selected.grade : ''}`}
                      thumbnailClassName="w-24 h-24"
                      priority
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Beef className="h-8 w-8 text-muted-foreground/30" />
                    </div>
                  )}
                </div>

                <div className="space-y-1">
                  <p>
                    <strong>SKU:</strong> {selected.sku}
                  </p>
                  <p>
                    <strong>Jenis:</strong> {selected.type}
                    {selected.grade ? ` | Grade: ${selected.grade}` : ''}
                  </p>
                  <p>
                    <strong>Berat:</strong>{' '}
                    {formatWeight(selected.weightMin, selected.weightMax) ??
                      'Belum diisi'}
                  </p>
                  <p>
                    <strong>Kondisi:</strong> {selected.condition}
                  </p>
                  <p>
                    <strong>Harga Jual:</strong>{' '}
                    {selected.hargaJual
                      ? formatRupiah(selected.hargaJual)
                      : 'Belum diset'}
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Buyer Info */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Data Pembeli</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="buyerName">Nama Pembeli *</Label>
              <Input id="buyerName" name="buyerName" required />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="buyerPhone">No. Telepon</Label>
                <Input id="buyerPhone" name="buyerPhone" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="buyerWa">WhatsApp</Label>
                <Input id="buyerWa" name="buyerWa" placeholder="08xxx" />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="buyerAddress">Alamat Lengkap</Label>
              <Textarea id="buyerAddress" name="buyerAddress" rows={2} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="buyerMaps">Link Google Maps</Label>
              <Input
                id="buyerMaps"
                name="buyerMaps"
                placeholder="https://maps.google.com/..."
              />
            </div>
          </CardContent>
        </Card>

        {/* Payment Info */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Pembayaran</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
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
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="dp">DP (Uang Muka)</Label>
                <RupiahInput id="dp" name="dp" placeholder="1000000" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="totalBayar">Total Dibayar</Label>
                <RupiahInput
                  id="totalBayar"
                  name="totalBayar"
                  placeholder="3500000"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Status Pembayaran</Label>
              {/* Added native hidden input for paymentStatus just in case */}
              <Select name="paymentStatus" defaultValue="BELUM_BAYAR">
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="BELUM_BAYAR">Belum Bayar</SelectItem>
                  <SelectItem value="DP">DP</SelectItem>
                  <SelectItem value="LUNAS">Lunas</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Bukti Transfer</Label>
              <BuktiTransferUpload onChange={setBuktiTransferUrls} />
            </div>
          </CardContent>
        </Card>

        {/* Notes */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Catatan</CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea name="notes" rows={3} placeholder="Catatan tambahan..." />
          </CardContent>
        </Card>

        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? 'Menyimpan...' : 'Kirim Entry & Setujui'}
        </Button>
      </form>
    </DashboardShell>
  );
}
