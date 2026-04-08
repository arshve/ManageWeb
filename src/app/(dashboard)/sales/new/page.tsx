'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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

interface AvailableLivestock {
  id: string;
  sku: string;
  type: string;
  grade: string;
  weight: number | null;
  condition: string;
}

export default function NewEntryPage() {
  const [livestock, setLivestock] = useState<AvailableLivestock[]>([]);
  const [selectedId, setSelectedId] = useState('');
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
                <SelectValue placeholder="Pilih hewan yang tersedia..." />
              </SelectTrigger>
              <SelectContent>
                {livestock.map((l) => (
                  <SelectItem key={l.id} value={l.id}>
                    {l.sku} — {l.type} Grade {l.grade}
                    {l.weight ? ` (${l.weight}kg)` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selected && (
              <div className="mt-3 p-3 bg-muted rounded-lg text-sm">
                <p>
                  <strong>SKU:</strong> {selected.sku}
                </p>
                <p>
                  <strong>Jenis:</strong> {selected.type} | Grade:{' '}
                  {selected.grade}
                </p>
                <p>
                  <strong>Berat:</strong>{' '}
                  {selected.weight ? `${selected.weight} kg` : 'Belum diisi'}
                </p>
                <p>
                  <strong>Kondisi:</strong> {selected.condition}
                </p>
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
              <Input
                id="hargaJual"
                name="hargaJual"
                type="number"
                required
                placeholder="3500000"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="dp">DP (Uang Muka)</Label>
                <Input id="dp" name="dp" type="number" placeholder="1000000" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="totalBayar">Total Dibayar</Label>
                <Input
                  id="totalBayar"
                  name="totalBayar"
                  type="number"
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
