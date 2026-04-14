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
import { toast } from 'sonner';
import { Beef } from 'lucide-react';
import { LivestockPhoto } from '@/components/dashboard/livestock-photo';
import { BuktiTransferUpload } from '@/components/dashboard/bukti-transfer-upload';
import { formatWeight } from '@/lib/format';

interface AvailableLivestock {
  id: string;
  sku: string;
  type: string;
  grade: string | null;
  weightMin: number | null;
  weightMax: number | null;
  condition: string;
  photoUrl: string | null;
}

export default function AdminNewEntryPage() {
  const [livestock, setLivestock] = useState<AvailableLivestock[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [buktiTransferUrls, setBuktiTransferUrls] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  useEffect(() => {
    fetch('/api/livestock/available')
      .then((res) => res.json())
      .then(setLivestock)
      .catch(() => toast.error('Gagal memuat data hewan'));
  }, []);

  const selected = livestock.find((l) => l.id === selectedId);

  async function handleSubmit(formData: FormData) {
    if (!selectedId) {
      toast.error('Pilih hewan terlebih dahulu');
      return;
    }
    formData.set('livestockId', selectedId);
    buktiTransferUrls.forEach((url) => formData.append('buktiTransfer', url));
    setLoading(true);

    const result = await createEntry(formData);
    if ('error' in result) {
      toast.error(result.error);
    } else {
      toast.success('Entry berhasil dibuat');
      router.push('/admin');
    }
    setLoading(false);
  }

  return (
    <DashboardShell
      title="Tambah Entry Baru"
      description="Pilih hewan dan isi data pembeli"
    >
      <form action={handleSubmit} className="space-y-6 max-w-2xl">
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
                  {selected?.sku}
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
              <div className="flex gap-4 p-3 bg-muted rounded-lg text-sm">
                {/* Photo */}
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

                {/* Info */}
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
          {loading ? 'Menyimpan...' : 'Kirim Entry'}
        </Button>
      </form>
    </DashboardShell>
  );
}
