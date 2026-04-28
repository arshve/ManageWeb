'use client';

import { useState, useMemo, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { RupiahInput } from '@/components/ui/rupiah-input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  LivestockPicker,
  type PickerLivestock,
} from '@/components/dashboard/livestock-picker';
import { fulfillEntryRequest } from '@/app/actions/entries';
import { formatRupiah, formatWeight } from '@/lib/format';
import { toast } from 'sonner';
import { CheckCircle2, Clock, Package, Search } from 'lucide-react';

type QueueRequest = {
  id: string;
  entryId: string;
  type: 'KAMBING' | 'DOMBA' | 'SAPI';
  grade: 'SUPER' | 'A' | 'B' | 'C' | 'D' | null;
  weightMin: number | null;
  weightMax: number | null;
  hargaJual: number;
  hargaModal: number | null;
  resellerCut: number | null;
  notes: string | null;
  isFulfilled: boolean;
  createdAt: string;
  entry: {
    id: string;
    invoiceNo: string;
    buyerName: string;
    buyerPhone: string | null;
    status: string;
    salesName: string | null;
  };
};

type AvailableLivestock = {
  id: string;
  sku: string;
  type: string;
  grade: string | null;
  tag: string | null;
  hargaJual: number | null;
  hargaModal: number | null;
  weightMin: number | null;
  weightMax: number | null;
  condition: string;
  photoUrl: string | null;
};

const TYPE_LABEL: Record<string, string> = {
  KAMBING: 'Kambing',
  DOMBA: 'Domba',
  SAPI: 'Sapi',
};

function detailLabel(req: QueueRequest): string {
  if (req.type === 'SAPI') {
    return formatWeight(req.weightMin, req.weightMax) ?? '-';
  }
  return req.grade ?? '-';
}

function relativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / 86400000);
  if (days > 0) return `${days}h lalu`;
  const hours = Math.floor(diff / 3600000);
  if (hours > 0) return `${hours}j lalu`;
  return 'Baru saja';
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; className: string }> = {
    PENDING: { label: 'Menunggu', className: 'text-amber-600 bg-amber-50 border-amber-200' },
    APPROVED: { label: 'Disetujui', className: 'bg-green-100 text-green-800' },
    REJECTED: { label: 'Ditolak', className: 'bg-red-100 text-red-800' },
  };
  const m = map[status] ?? { label: status, className: '' };
  return (
    <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${m.className}`}>
      {m.label}
    </Badge>
  );
}

export function QueueView({
  requests,
  availableLivestock,
}: {
  requests: QueueRequest[];
  availableLivestock: AvailableLivestock[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [fulfillTarget, setFulfillTarget] = useState<QueueRequest | null>(null);
  const [pickedId, setPickedId] = useState<string | null>(null);
  const [hargaModal, setHargaModal] = useState('');
  const [resellerCut, setResellerCut] = useState('');

  const [search, setSearch] = useState('');
  const [jenisFilter, setJenisFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return requests.filter((r) => {
      // fulfilled rows always shown alongside their pending siblings
      if (!r.isFulfilled) {
        if (jenisFilter !== 'ALL' && r.type !== jenisFilter) return false;
        if (statusFilter !== 'ALL' && r.entry.status !== statusFilter) return false;
      }
      if (
        q &&
        !r.entry.buyerName.toLowerCase().includes(q) &&
        !r.entry.invoiceNo.toLowerCase().includes(q)
      )
        return false;
      return true;
    });
  }, [requests, search, jenisFilter, statusFilter]);

  const filteredLivestock: PickerLivestock[] = useMemo(() => {
    if (!fulfillTarget) return [];
    return availableLivestock
      .filter((l) => l.type === fulfillTarget.type)
      .map((l) => ({ ...l, hargaJual: l.hargaJual }));
  }, [fulfillTarget, availableLivestock]);

  function openFulfill(req: QueueRequest) {
    setFulfillTarget(req);
    setPickedId(null);
    setHargaModal(req.hargaModal?.toString() ?? '');
    setResellerCut(req.resellerCut?.toString() ?? '');
  }

  function handleToggle(id: string) {
    setPickedId((prev) => (prev === id ? null : id));
    const lv = availableLivestock.find((l) => l.id === id);
    if (lv && !hargaModal) {
      setHargaModal(lv.hargaModal?.toString() ?? '');
    }
  }

  function handleConfirm() {
    if (!fulfillTarget || !pickedId) {
      toast.error('Pilih hewan terlebih dahulu');
      return;
    }
    startTransition(async () => {
      const formData = new FormData();
      if (hargaModal) formData.set('hargaModal', hargaModal);
      if (resellerCut) formData.set('resellerCut', resellerCut);
      const result = await fulfillEntryRequest(fulfillTarget.id, pickedId, formData);
      if ('error' in result) {
        toast.error(result.error);
      } else {
        toast.success('Hewan berhasil dipilih!');
        setFulfillTarget(null);
        router.refresh();
      }
    });
  }

  if (requests.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-16 text-center border rounded-xl bg-muted/20 border-dashed">
        <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
          <Package className="h-8 w-8 text-muted-foreground/50" />
        </div>
        <h3 className="font-semibold text-lg">Tidak Ada Antrian</h3>
        <p className="text-sm text-muted-foreground mt-1">Semua permintaan sudah terpenuhi.</p>
      </div>
    );
  }

  return (
    <>
      {/* Filter bar */}
      <div className="flex flex-col sm:flex-row gap-2 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Cari pembeli atau invoice..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={jenisFilter} onValueChange={(v) => v && setJenisFilter(v)}>
          <SelectTrigger className="w-full sm:w-36">
            <SelectValue placeholder="Semua Jenis" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Semua Jenis</SelectItem>
            <SelectItem value="KAMBING">Kambing</SelectItem>
            <SelectItem value="DOMBA">Domba</SelectItem>
            <SelectItem value="SAPI">Sapi</SelectItem>
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={(v) => v && setStatusFilter(v)}>
          <SelectTrigger className="w-full sm:w-36">
            <SelectValue placeholder="Semua Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Semua Status</SelectItem>
            <SelectItem value="PENDING">Menunggu</SelectItem>
            <SelectItem value="APPROVED">Disetujui</SelectItem>
            <SelectItem value="REJECTED">Ditolak</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-10">
          Tidak ada data ditemukan.
        </p>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden md:block rounded-lg border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Invoice</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Pembeli</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Sales</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Jenis</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Detail</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Harga Jual</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Tanggal</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filtered.map((req) => (
                  <tr key={req.id} className={`transition-colors ${req.isFulfilled ? 'bg-green-50/60 text-muted-foreground' : 'hover:bg-muted/30'}`}>
                    <td className="px-4 py-3 font-mono text-xs">{req.entry.invoiceNo}</td>
                    <td className="px-4 py-3 font-medium">{req.entry.buyerName}</td>
                    <td className="px-4 py-3 text-muted-foreground">{req.entry.salesName ?? '-'}</td>
                    <td className="px-4 py-3">{TYPE_LABEL[req.type]}</td>
                    <td className="px-4 py-3">{detailLabel(req)}</td>
                    <td className="px-4 py-3 font-medium">{formatRupiah(req.hargaJual)}</td>
                    <td className="px-4 py-3">
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {relativeTime(req.createdAt)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={req.entry.status} />
                    </td>
                    <td className="px-4 py-3 text-right">
                      {req.isFulfilled ? (
                        <span className="inline-flex items-center gap-1 text-xs text-green-600 font-medium">
                          <CheckCircle2 className="h-4 w-4" />
                          Selesai
                        </span>
                      ) : (
                        <Button size="sm" onClick={() => openFulfill(req)}>
                          Fulfill
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden space-y-3">
            {filtered.map((req) => (
              <Card key={req.id} className={req.isFulfilled ? 'bg-green-50/60' : ''}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium text-sm">{req.entry.buyerName}</span>
                        <StatusBadge status={req.entry.status} />
                      </div>
                      <p className="text-xs text-muted-foreground font-mono">{req.entry.invoiceNo}</p>
                      <div className="flex flex-wrap gap-1.5 text-xs">
                        <Badge variant="secondary">{TYPE_LABEL[req.type]}</Badge>
                        <Badge variant="outline">{detailLabel(req)}</Badge>
                      </div>
                      <div className="flex flex-wrap gap-3 text-xs pt-0.5">
                        <span className="font-medium">{formatRupiah(req.hargaJual)}</span>
                        {req.entry.salesName && (
                          <span className="text-muted-foreground">{req.entry.salesName}</span>
                        )}
                        <span className="text-muted-foreground flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {relativeTime(req.createdAt)}
                        </span>
                      </div>
                      {req.notes && (
                        <p className="text-xs text-muted-foreground italic truncate">{req.notes}</p>
                      )}
                    </div>
                    {req.isFulfilled ? (
                      <span className="inline-flex items-center gap-1 text-xs text-green-600 font-medium shrink-0">
                        <CheckCircle2 className="h-4 w-4" />
                        Selesai
                      </span>
                    ) : (
                      <Button size="sm" onClick={() => openFulfill(req)}>
                        Fulfill
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}

      {/* Fulfill Modal */}
      <Dialog open={!!fulfillTarget} onOpenChange={(open) => !open && setFulfillTarget(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Fulfill{' '}
              {fulfillTarget
                ? `${TYPE_LABEL[fulfillTarget.type]}${fulfillTarget.grade ? ` ${fulfillTarget.grade}` : ''}`
                : ''}
            </DialogTitle>
          </DialogHeader>

          {fulfillTarget && (
            <div className="space-y-4">
              <div className="rounded-lg border bg-muted/30 p-3 text-sm space-y-1">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Pembeli</span>
                  <span className="font-medium">{fulfillTarget.entry.buyerName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Harga Jual Disepakati</span>
                  <span className="font-medium">{formatRupiah(fulfillTarget.hargaJual)}</span>
                </div>
                {fulfillTarget.type === 'SAPI' &&
                  (fulfillTarget.weightMin || fulfillTarget.weightMax) && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Berat Diminta</span>
                      <span>{formatWeight(fulfillTarget.weightMin, fulfillTarget.weightMax)}</span>
                    </div>
                  )}
                {fulfillTarget.notes && (
                  <div className="flex justify-between gap-4">
                    <span className="text-muted-foreground shrink-0">Catatan</span>
                    <span className="text-right">{fulfillTarget.notes}</span>
                  </div>
                )}
              </div>

              <div>
                <p className="text-xs font-medium text-muted-foreground mb-2">
                  Pilih satu hewan dari stok tersedia ({TYPE_LABEL[fulfillTarget.type]}):
                </p>
                {filteredLivestock.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-6 border rounded-lg">
                    Tidak ada stok {TYPE_LABEL[fulfillTarget.type]} tersedia saat ini.
                  </p>
                ) : (
                  <LivestockPicker
                    livestock={filteredLivestock}
                    selectedIds={pickedId ? [pickedId] : []}
                    onToggle={handleToggle}
                  />
                )}
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2 border-t">
                <div className="space-y-1.5">
                  <Label className="text-xs">Harga Modal</Label>
                  <RupiahInput
                    value={hargaModal}
                    onValueChange={setHargaModal}
                    placeholder={
                      availableLivestock.find((l) => l.id === pickedId)?.hargaModal?.toString() ??
                      '0'
                    }
                    className="h-9 text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Komisi Sales</Label>
                  <RupiahInput
                    value={resellerCut}
                    onValueChange={setResellerCut}
                    placeholder={fulfillTarget.resellerCut?.toString() ?? '0'}
                    className="h-9 text-sm"
                  />
                </div>
                {pickedId && hargaModal && (
                  <div className="col-span-2 flex justify-between text-sm border-t pt-2">
                    <span className="text-muted-foreground">Estimasi Profit</span>
                    <span className="font-medium">
                      {formatRupiah(
                        fulfillTarget.hargaJual -
                          (Number(hargaModal) || 0) -
                          (Number(resellerCut) || 0),
                      )}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setFulfillTarget(null)}
              disabled={pending}
            >
              Batal
            </Button>
            <Button onClick={handleConfirm} disabled={!pickedId || pending}>
              {pending ? 'Menyimpan...' : 'Konfirmasi Fulfillment'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
