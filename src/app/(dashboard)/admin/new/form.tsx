'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
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
import { DashboardShell } from '@/components/dashboard/dashboard-shell';
import { createEntry } from '@/app/actions/entries';
import { getActiveSales } from '@/app/actions/users';
import { toast } from 'sonner';
import { Search, X } from 'lucide-react';
import {
  LivestockPicker,
  type PickerLivestock,
} from '@/components/dashboard/livestock-picker';
import { BuktiTransferUpload } from '@/components/dashboard/bukti-transfer-upload';
import {
  AntrianRequestRows,
  emptyRow,
  rowsToJson,
  type RequestRow,
} from '@/components/dashboard/antrian-request-rows';
import { formatRupiah, formatWeight } from '@/lib/format';

const SERIF = "var(--font-dm-serif), 'DM Serif Display', serif";

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

function SectionCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border bg-card overflow-hidden">
      <div className="px-5 py-3 border-b bg-muted/30">
        <h3 className="text-[13px] font-semibold" style={{ fontFamily: SERIF }}>
          {title}
        </h3>
      </div>
      <div className="p-5 flex flex-col gap-4">{children}</div>
    </section>
  );
}

export function AdminNewEntryForm({ canViewFinancials }: { canViewFinancials: boolean }) {
  const [mode, setMode] = useState<'LANGSUNG' | 'ANTRIAN'>('LANGSUNG');
  const [livestock, setLivestock] = useState<PickerLivestock[]>([]);
  const [salesUsers, setSalesUsers] = useState<SalesUser[]>([]);
  const [salesSearch, setSalesSearch] = useState('');
  const [selectedSalesId, setSelectedSalesId] = useState('');
  const [selectedItems, setSelectedItems] = useState<SelectedItem[]>([]);
  const [requests, setRequests] = useState<RequestRow[]>([emptyRow()]);
  const [pengiriman, setPengiriman] = useState('HARI_H');
  const [paymentStatus, setPaymentStatus] = useState('BELUM_BAYAR');
  const [buktiTransferUrls, setBuktiTransferUrls] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  useEffect(() => {
    getActiveSales()
      .then(setSalesUsers)
      .catch(() => toast.error('Gagal memuat data sales'));
  }, []);

  useEffect(() => {
    if (mode !== 'LANGSUNG') return;
    fetch('/api/livestock/available', { cache: 'no-store' })
      .then((res) => {
        if (!res.ok) throw new Error('Failed');
        return res.json();
      })
      .then(setLivestock)
      .catch(() => toast.error('Gagal memuat data hewan'));
  }, [mode]);

  const selectedIds = selectedItems.map((i) => i.livestock.id);
  const selectedUser = salesUsers.find((s) => s.id === selectedSalesId);
  const filteredSales = salesUsers.filter((s) =>
    s.name.toLowerCase().includes(salesSearch.toLowerCase()),
  );
  const totalHargaJual = selectedItems.reduce(
    (s, i) => s + (Number(i.hargaJual) || 0),
    0,
  );
  const totalAntrianHarga = requests.reduce(
    (s, r) => s + (Number(r.hargaJual) || 0),
    0,
  );

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

    formData.set('mode', mode);
    formData.set('salesId', selectedSalesId);
    formData.set('paymentStatus', paymentStatus);
    buktiTransferUrls.forEach((url) => formData.append('buktiTransfer', url));

    if (mode === 'ANTRIAN') {
      const hasPrice = requests.some((r) => Number(r.hargaJual) > 0);
      if (!hasPrice) {
        toast.error('Isi harga jual untuk minimal satu permintaan');
        return;
      }
      formData.set('requests', rowsToJson(requests));
    } else {
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
            hargaModal: Number(i.hargaModal) || null,
            tag: i.tag || null,
          })),
        ),
      );
      if (paymentStatus === 'LUNAS') {
        formData.set('totalBayar', String(totalHargaJual));
      }
    }

    setLoading(true);
    const result = await createEntry(formData);
    if (result && 'error' in result) {
      toast.error(String(result.error));
    } else {
      const msg =
        mode === 'ANTRIAN'
          ? 'Antrian berhasil dibuat & Disetujui'
          : 'Entry berhasil dibuat & Otomatis Disetujui';
      toast.success(msg);
      router.push('/admin');
    }
    setLoading(false);
  }

  return (
    <DashboardShell
      title="Tambah Entry Baru"
      description="Pilih sales, hewan, dan isi data pembeli (Otomatis Disetujui)"
    >
      <form action={handleSubmit} className="flex flex-col gap-4 max-w-2xl">
        <input type="hidden" name="pengiriman" value={pengiriman} />

        {/* ── Mode Toggle ── */}
        <div className="grid grid-cols-2 gap-2">
          {(['LANGSUNG', 'ANTRIAN'] as const).map((m) => {
            const active = mode === m;
            return (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                className="rounded-xl border p-4 text-left transition-all duration-150"
                style={
                  active
                    ? {
                        borderColor: 'oklch(0.22 0.065 145)',
                        background: 'oklch(0.22 0.065 145 / 0.06)',
                      }
                    : undefined
                }
              >
                <p
                  className="font-semibold text-sm mb-0.5"
                  style={active ? { color: 'oklch(0.22 0.065 145)' } : undefined}
                >
                  {m === 'LANGSUNG' ? 'Langsung' : 'Antrian'}
                </p>
                <p className="text-[11px] text-muted-foreground leading-snug">
                  {m === 'LANGSUNG'
                    ? 'Hewan sudah tersedia di stok'
                    : 'Stok belum ada — pesan terlebih dahulu'}
                </p>
              </button>
            );
          })}
        </div>

        {/* ── Penanggung Jawab ── */}
        <SectionCard title="Penanggung Jawab (Sales)">
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
              <SelectItem value="admin" label="Diri Sendiri (Admin)">
                Diri Sendiri (Admin)
              </SelectItem>
              {filteredSales.map((s) => (
                <SelectItem key={s.id} value={s.id} label={s.name}>
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
        </SectionCard>

        {/* ── Pilih Hewan (Langsung) ── */}
        {mode === 'LANGSUNG' && (
          <SectionCard title="Pilih Hewan">
            <LivestockPicker
              livestock={livestock}
              selectedIds={selectedIds}
              onToggle={handleToggle}
            />

            {selectedItems.length > 0 && (
              <div className="border-t pt-4 flex flex-col gap-2">
                <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground">
                  {selectedItems.length} hewan dipilih
                </p>
                {selectedItems.map((item) => {
                  const lv = item.livestock;
                  const typeLabel = lv.type.charAt(0) + lv.type.slice(1).toLowerCase();
                  const weightStr = formatWeight(lv.weightMin, lv.weightMax);
                  return (
                    <div
                      key={lv.id}
                      className="flex items-start gap-3 p-3 rounded-lg border bg-muted/20"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold truncate mb-0.5">
                          {typeLabel}
                          {lv.grade ? ` · ${lv.grade}` : ''}
                          {weightStr ? ` · ${weightStr}` : ''}
                        </p>
                        <p className="text-[11px] text-muted-foreground font-mono mb-2">
                          {lv.sku}
                        </p>
                        <div
                          className={`grid gap-2 ${
                            canViewFinancials ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-2'
                          }`}
                        >
                          <Field>
                            <FieldLabel className="text-[10px]">Tag</FieldLabel>
                            <Input
                              value={item.tag}
                              readOnly
                              className="h-7 text-xs bg-muted/50 cursor-default"
                            />
                          </Field>
                          <Field>
                            <FieldLabel className="text-[10px]">Harga Jual *</FieldLabel>
                            <RupiahInput
                              value={item.hargaJual}
                              onValueChange={(v) => updateItem(lv.id, 'hargaJual', v)}
                              className="h-7 text-xs"
                              placeholder="3500000"
                            />
                          </Field>
                          {canViewFinancials && (
                            <>
                              <Field>
                                <FieldLabel className="text-[10px]">Modal</FieldLabel>
                                <RupiahInput
                                  value={item.hargaModal}
                                  onValueChange={(v) => updateItem(lv.id, 'hargaModal', v)}
                                  className="h-7 text-xs"
                                  placeholder="2500000"
                                />
                              </Field>
                              <Field>
                                <FieldLabel className="text-[10px]">Profit</FieldLabel>
                                <div className="h-7 flex items-center text-xs px-2 text-muted-foreground">
                                  {item.hargaJual && item.hargaModal
                                    ? formatRupiah(Number(item.hargaJual) - Number(item.hargaModal))
                                    : '—'}
                                </div>
                              </Field>
                            </>
                          )}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleToggle(lv.id)}
                        className="text-muted-foreground hover:text-destructive mt-0.5 shrink-0 transition-colors"
                      >
                        <X className="size-4" />
                      </button>
                    </div>
                  );
                })}
                <div
                  className="flex justify-between items-center pt-3 border-t"
                >
                  <span className="text-[11px] font-bold uppercase tracking-[0.06em] text-muted-foreground">
                    Total Harga Jual
                  </span>
                  <span
                    className="text-base font-bold"
                    style={{ fontFamily: SERIF, color: 'oklch(0.48 0.13 158)' }}
                  >
                    {formatRupiah(totalHargaJual)}
                  </span>
                </div>
              </div>
            )}
          </SectionCard>
        )}

        {/* ── Daftar Permintaan (Antrian) ── */}
        {mode === 'ANTRIAN' && (
          <SectionCard title="Daftar Permintaan">
            <p className="text-xs text-muted-foreground -mt-1">
              Isi jenis dan harga yang disepakati. Hewan akan dipilih saat stok tiba.
            </p>
            <AntrianRequestRows
              rows={requests}
              onChange={setRequests}
              showHargaModal={canViewFinancials}
            />
            {totalAntrianHarga > 0 && (
              <div className="flex justify-between items-center pt-3 border-t">
                <span className="text-[11px] font-bold uppercase tracking-[0.06em] text-muted-foreground">
                  Total Estimasi
                </span>
                <span
                  className="text-base font-bold"
                  style={{ fontFamily: SERIF, color: 'oklch(0.48 0.13 158)' }}
                >
                  {formatRupiah(totalAntrianHarga)}
                </span>
              </div>
            )}
          </SectionCard>
        )}

        {/* ── Data Pembeli ── */}
        <SectionCard title="Data Pembeli">
          <Field>
            <FieldLabel htmlFor="buyerName">Nama Pembeli *</FieldLabel>
            <Input id="buyerName" name="buyerName" required />
          </Field>
          <Field>
            <FieldLabel htmlFor="buyerPhone">No. Telepon</FieldLabel>
            <Input id="buyerPhone" name="buyerPhone" type="tel" />
          </Field>
          <Field>
            <FieldLabel htmlFor="buyerAddress">Alamat Lengkap</FieldLabel>
            <Textarea id="buyerAddress" name="buyerAddress" rows={2} />
          </Field>
          <Field>
            <FieldLabel htmlFor="buyerMaps">Link Google Maps</FieldLabel>
            <Input
              id="buyerMaps"
              name="buyerMaps"
              placeholder="https://maps.google.com/..."
            />
          </Field>
        </SectionCard>

        {/* ── Pengiriman (Langsung only) ── */}
        {mode === 'LANGSUNG' && (
          <SectionCard title="Pengiriman">
            <Select
              value={pengiriman}
              onValueChange={(val) => setPengiriman(val ?? 'HARI_H')}
            >
              <SelectTrigger>
                <SelectValue>{PENGIRIMAN_LABEL[pengiriman] ?? pengiriman}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {PENGIRIMAN_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </SectionCard>
        )}

        {/* ── Pembayaran ── */}
        <SectionCard title="Pembayaran">
          {(mode === 'LANGSUNG' ? totalHargaJual : totalAntrianHarga) > 0 && (
            <div className="flex justify-between items-center pb-3 border-b -mt-1">
              <span className="text-[11px] font-bold uppercase tracking-[0.06em] text-muted-foreground">
                Total {mode === 'ANTRIAN' ? 'Estimasi ' : ''}Harga Jual
              </span>
              <span
                className="text-base font-bold"
                style={{ fontFamily: SERIF, color: 'oklch(0.48 0.13 158)' }}
              >
                {formatRupiah(mode === 'LANGSUNG' ? totalHargaJual : totalAntrianHarga)}
              </span>
            </div>
          )}
          <Field>
            <FieldLabel>Status Pembayaran</FieldLabel>
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
          </Field>
          {paymentStatus === 'DP' && (
            <Field>
              <FieldLabel htmlFor="dp">Jumlah DP</FieldLabel>
              <RupiahInput id="dp" name="dp" placeholder="1000000" />
            </Field>
          )}
          <Field>
            <FieldLabel>Bukti Transfer</FieldLabel>
            <BuktiTransferUpload onChange={setBuktiTransferUrls} />
          </Field>
        </SectionCard>

        {/* ── Catatan ── */}
        <SectionCard title="Catatan">
          <Textarea name="notes" rows={2} placeholder="Catatan tambahan..." />
        </SectionCard>

        <Button
          type="submit"
          className="w-full h-11 font-semibold"
          disabled={loading}
        >
          {loading
            ? 'Menyimpan...'
            : mode === 'ANTRIAN'
              ? 'Kirim Antrian & Setujui'
              : 'Kirim Entry & Setujui'}
        </Button>
      </form>
    </DashboardShell>
  );
}
