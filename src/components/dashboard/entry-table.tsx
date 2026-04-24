/**
 * EntryTable — Interactive table for managing sale entries.
 *
 * Displays all sale entries with inline editing. When the admin clicks the
 * pencil icon on a row, that row expands to show editable fields directly
 * in the table (no popup modal).
 *
 * Features:
 * - Search: Filter by invoice, buyer name, SKU, or sales name
 * - Filter: By status, payment status, and delivery status
 * - Sort: Click column headers to sort ascending/descending
 * - Inline edit: Click pencil → row expands with input fields → Save/Cancel
 * - Approve/Reject: Only shown for PENDING entries
 * - Delete: Removes entry and marks livestock as available again
 *
 * Each row is its own component (EntryRow) with isolated state for editing.
 */

'use client';

import { useState, useMemo, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { RupiahInput } from '@/components/ui/rupiah-input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Check,
  X,
  Trash2,
  Pencil,
  Save,
  XCircle,
  CheckCircle2,
  Clock,
  Truck,
  Route,
  Search,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  ChevronDown,
} from 'lucide-react';
import {
  updateEntry,
  approveEntry,
  rejectEntry,
  deleteEntry,
} from '@/app/actions/entries';
import { toast } from 'sonner';
import {
  formatRupiah,
  formatDateTime,
  formatPaymentStatus,
  formatWeight,
} from '@/lib/format';
import { BuktiTransferUpload } from '@/components/dashboard/bukti-transfer-upload';
import { PdfMenu } from '@/components/dashboard/pdf-menu';
import { LivestockPhotoLink } from '@/components/dashboard/livestock-photo-link';
import Image from 'next/image';

export interface EntryData {
  id: string;
  invoiceNo: string;
  status: string;
  hargaJual: number;
  hargaModal: number | null;
  resellerCut: number | null;
  hpp: number | null;
  profit: number | null;
  dp: number | null;
  totalBayar: number | null;
  paymentStatus: string;
  buyerName: string;
  buyerPhone: string | null;
  buyerAddress: string | null;
  buyerMaps: string | null;
  pengiriman: string | null;
  notes: string | null;
  buktiTransfer: string[];
  isSent: boolean;
  createdAt: string;
  delivery: {
    status: string;
    driverName: string | null;
  } | null;
  livestock: {
    id: string;
    sku: string;
    type: string;
    grade: string | null;
    weightMin: number | null;
    weightMax: number | null;
    tag: string | null;
    photoUrl: string | null;
    condition: string;
  };
  sales: { id: string; name: string };
}

export interface SalesUser {
  id: string;
  name: string;
}

export interface AvailableLivestock {
  id: string;
  sku: string;
  type: string;
  grade: string | null;
  weightMin: number | null;
  weightMax: number | null;
  tag: string | null;
}

const PENGIRIMAN_LABEL: Record<string, string> = {
  HARI_H: 'Hari H',
  H_1: 'H-1',
  H_2: 'H-2',
  H_3: 'H-3',
  TITIP_POTONG: 'Titip Potong',
};

const PAYMENT_LABEL: Record<string, string> = {
  BELUM_BAYAR: 'Belum Bayar',
  DP: 'DP',
  LUNAS: 'Lunas',
};

type SortField =
  | 'invoiceNo'
  | 'buyerName'
  | 'sales'
  | 'hargaJual'
  | 'profit'
  | 'createdAt';
type SortDir = 'asc' | 'desc';

export function EntryTable({
  entries,
  isAdmin = false,
  canViewFinancials = false,
  availableLivestock = [],
  salesUsers = [],
}: {
  entries: EntryData[];
  isAdmin?: boolean;
  canViewFinancials?: boolean;
  availableLivestock?: AvailableLivestock[];
  salesUsers?: SalesUser[];
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [paymentFilter, setPaymentFilter] = useState('ALL');
  const [sentFilter, setSentFilter] = useState('ALL');
  const [sortField, setSortField] = useState<SortField>('createdAt');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  function toggleSort(field: SortField) {
    if (sortField === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  }

  function SortIcon({ field }: { field: SortField }) {
    if (sortField !== field)
      return <ArrowUpDown className="h-3 w-3 opacity-40" />;
    return sortDir === 'asc' ? (
      <ArrowUp className="h-3 w-3" />
    ) : (
      <ArrowDown className="h-3 w-3" />
    );
  }

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    let result = entries;

    if (q) {
      result = result.filter(
        (e) =>
          e.invoiceNo.toLowerCase().includes(q) ||
          e.buyerName.toLowerCase().includes(q) ||
          e.livestock.sku.toLowerCase().includes(q) ||
          e.sales.name.toLowerCase().includes(q) ||
          (e.buyerPhone && e.buyerPhone.includes(q)),
      );
    }

    if (statusFilter !== 'ALL') {
      result = result.filter((e) => e.status === statusFilter);
    }
    if (paymentFilter !== 'ALL') {
      result = result.filter((e) => e.paymentStatus === paymentFilter);
    }
    if (sentFilter !== 'ALL') {
      result = result.filter((e) =>
        sentFilter === 'YES' ? e.isSent : !e.isSent,
      );
    }

    result = [...result].sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case 'invoiceNo':
          cmp = a.invoiceNo.localeCompare(b.invoiceNo);
          break;
        case 'buyerName':
          cmp = a.buyerName.localeCompare(b.buyerName);
          break;
        case 'sales':
          cmp = a.sales.name.localeCompare(b.sales.name);
          break;
        case 'hargaJual':
          cmp = a.hargaJual - b.hargaJual;
          break;
        case 'profit':
          cmp = (a.profit ?? 0) - (b.profit ?? 0);
          break;
        case 'createdAt':
          cmp =
            new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
          break;
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });

    return result;
  }, [
    entries,
    search,
    statusFilter,
    paymentFilter,
    sentFilter,
    sortField,
    sortDir,
  ]);

  return (
    <div>
      {/* Toolbar: Search + Filters */}
      <div className="p-3 border-b space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Cari invoice, pembeli, SKU, sales..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <Select
            value={statusFilter}
            onValueChange={(val) => setStatusFilter(val ?? 'ALL')}
          >
            <SelectTrigger className="h-8 w-[140px] text-xs">
              <SelectValue>
                {{
                  ALL: 'Semua Status',
                  PENDING: 'Pending',
                  APPROVED: 'Approved',
                  REJECTED: 'Rejected',
                }[statusFilter] ?? statusFilter}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Semua Status</SelectItem>
              <SelectItem value="PENDING">Pending</SelectItem>
              <SelectItem value="APPROVED">Approved</SelectItem>
              <SelectItem value="REJECTED">Rejected</SelectItem>
            </SelectContent>
          </Select>
          <Select
            value={paymentFilter}
            onValueChange={(val) => setPaymentFilter(val ?? 'ALL')}
          >
            <SelectTrigger className="h-8 w-[150px] text-xs">
              <SelectValue>
                {{
                  ALL: 'Semua Bayar',
                  BELUM_BAYAR: 'Belum Bayar',
                  DP: 'DP',
                  LUNAS: 'Lunas',
                }[paymentFilter] ?? paymentFilter}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Semua Bayar</SelectItem>
              <SelectItem value="BELUM_BAYAR">Belum Bayar</SelectItem>
              <SelectItem value="DP">DP</SelectItem>
              <SelectItem value="LUNAS">Lunas</SelectItem>
            </SelectContent>
          </Select>
          <Select
            value={sentFilter}
            onValueChange={(val) => setSentFilter(val ?? 'ALL')}
          >
            <SelectTrigger className="h-8 w-[140px] text-xs">
              <SelectValue>
                {{ ALL: 'Semua Kirim', YES: 'Sudah Kirim', NO: 'Belum Kirim' }[
                  sentFilter
                ] ?? sentFilter}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Semua Kirim</SelectItem>
              <SelectItem value="YES">Sudah Kirim</SelectItem>
              <SelectItem value="NO">Belum Kirim</SelectItem>
            </SelectContent>
          </Select>
          {(search ||
            statusFilter !== 'ALL' ||
            paymentFilter !== 'ALL' ||
            sentFilter !== 'ALL') && (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 text-xs"
              onClick={() => {
                setSearch('');
                setStatusFilter('ALL');
                setPaymentFilter('ALL');
                setSentFilter('ALL');
              }}
            >
              <X className="h-3 w-3 mr-1" />
              Reset
            </Button>
          )}
          <span className="ml-auto text-xs text-muted-foreground self-center">
            {filtered.length} dari {entries.length} entry
          </span>
        </div>
      </div>

      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th
                className="text-center p-3 font-medium cursor-pointer select-none hover:bg-muted/80"
                onClick={() => toggleSort('invoiceNo')}
              >
                <span className="inline-flex items-center gap-1">
                  Invoice <SortIcon field="invoiceNo" />
                </span>
              </th>
              <th className="text-center p-3 font-medium">Hewan</th>
              <th
                className="text-center p-3 font-medium cursor-pointer select-none hover:bg-muted/80"
                onClick={() => toggleSort('buyerName')}
              >
                <span className="inline-flex items-center gap-1">
                  Pembeli <SortIcon field="buyerName" />
                </span>
              </th>
              {isAdmin && (
                <th
                  className="text-center p-3 font-medium cursor-pointer select-none hover:bg-muted/80"
                  onClick={() => toggleSort('sales')}
                >
                  <span className="inline-flex items-center gap-1">
                    Sales <SortIcon field="sales" />
                  </span>
                </th>
              )}
              <th
                className="text-center p-3 font-medium cursor-pointer select-none hover:bg-muted/80"
                onClick={() => toggleSort('hargaJual')}
              >
                <span className="inline-flex items-center gap-1">
                  Harga Jual <SortIcon field="hargaJual" />
                </span>
              </th>
              <th className="text-center p-3 font-medium">Sales Cut</th>
              {canViewFinancials && (
                <>
                  <th className="text-center p-3 font-medium">Modal</th>
                  <th
                    className="text-center p-3 font-medium cursor-pointer select-none hover:bg-muted/80"
                    onClick={() => toggleSort('profit')}
                  >
                    <span className="inline-flex items-center gap-1">
                      Profit <SortIcon field="profit" />
                    </span>
                  </th>
                </>
              )}
              <th className="text-center p-3 font-medium">Bayar</th>
              <th className="text-center p-3 font-medium w-24">Kirim</th>
              <th className="text-center p-3 font-medium w-12">Status</th>
              <th
                className="text-center p-3 font-medium cursor-pointer select-none hover:bg-muted/80"
                onClick={() => toggleSort('createdAt')}
              >
                <span className="inline-flex items-center gap-1">
                  Tanggal <SortIcon field="createdAt" />
                </span>
              </th>
              <th className="text-center p-3 font-medium">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((entry) => (
              <EntryRow
                key={entry.id}
                entry={entry}
                isAdmin={isAdmin}
                canViewFinancials={canViewFinancials}
                isEditing={editingId === entry.id}
                onEdit={() => setEditingId(entry.id)}
                onCancel={() => setEditingId(null)}
                onSaved={() => setEditingId(null)}
                availableLivestock={availableLivestock}
                salesUsers={salesUsers}
              />
            ))}
            {filtered.length === 0 && (
              <tr>
                <td
                  colSpan={isAdmin ? (canViewFinancials ? 13 : 11) : 10}
                  className="p-8 text-center text-muted-foreground"
                >
                  {entries.length === 0
                    ? 'Belum ada entry penjualan.'
                    : 'Tidak ada entry yang cocok dengan filter.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile card list */}
      <div className="md:hidden p-3 space-y-3">
        {filtered.map((entry) => (
          <MobileEntryCard
            key={entry.id}
            entry={entry}
            isAdmin={isAdmin}
            canViewFinancials={canViewFinancials}
            isEditing={editingId === entry.id}
            onEdit={() => setEditingId(entry.id)}
            onCancel={() => setEditingId(null)}
            onSaved={() => setEditingId(null)}
            availableLivestock={availableLivestock}
            salesUsers={salesUsers}
          />
        ))}
        {filtered.length === 0 && (
          <div className="p-8 text-center text-muted-foreground text-sm">
            {entries.length === 0
              ? 'Belum ada entry penjualan.'
              : 'Tidak ada entry yang cocok dengan filter.'}
          </div>
        )}
      </div>
    </div>
  );
}

function HoverBuktiTransfer({
  buktiTransfer,
  paymentStatus,
}: {
  buktiTransfer: string[];
  paymentStatus: string;
}) {
  const [show, setShow] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const badgeRef = useRef<HTMLDivElement>(null);

  function handleClick() {
    if (buktiTransfer.length === 0) return;
    if (!show && badgeRef.current) {
      const rect = badgeRef.current.getBoundingClientRect();
      setPos({
        top: rect.top + window.scrollY - 8,
        left: rect.left + rect.width / 2,
      });
    }
    setShow((v) => !v);
  }

  return (
    <>
      <div ref={badgeRef} className="inline-block">
        <Badge
          variant={
            paymentStatus === 'LUNAS'
              ? 'default'
              : paymentStatus === 'DP'
                ? 'secondary'
                : 'outline'
          }
          onClick={handleClick}
          className={buktiTransfer.length > 0 ? 'cursor-pointer' : ''}
        >
          {formatPaymentStatus(paymentStatus)}
          {buktiTransfer.length > 0 && (
            <span className="ml-1 opacity-60 text-[10px]">
              ({buktiTransfer.length})
            </span>
          )}
        </Badge>
      </div>

      {/* Backdrop — clicking outside closes the popover */}
      {show && (
        <div
          className="fixed inset-0 z-[9998]"
          onClick={() => setShow(false)}
        />
      )}

      {/* Fixed-position popover */}
      {show && (
        <div
          className="fixed z-[9999] -translate-x-1/2 -translate-y-full"
          style={{ top: pos.top, left: pos.left }}
        >
          <div className="bg-popover border rounded-lg shadow-xl p-2 space-y-1 w-52 mb-2">
            <div className="flex items-center justify-between px-1 pb-1 border-b">
              <p className="text-xs font-medium text-muted-foreground">
                Bukti Transfer ({buktiTransfer.length})
              </p>
              <button
                type="button"
                onClick={() => setShow(false)}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
            {buktiTransfer.map((url, i) => (
              <BuktiPreviewItem
                key={url}
                url={url}
                label={`Bukti Transfer ${i + 1}`}
              />
            ))}
          </div>
          <div className="w-2 h-2 bg-popover border-b border-r rotate-45 mx-auto -mt-1" />
        </div>
      )}
    </>
  );
}

function useEntryRow(entry: EntryData, onSaved: () => void) {
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    buyerName: entry.buyerName,
    buyerPhone: entry.buyerPhone ?? '',
    buyerAddress: entry.buyerAddress ?? '',
    buyerMaps: entry.buyerMaps ?? '',
    hargaJual: entry.hargaJual.toString(),
    hargaModal: entry.hargaModal?.toString() ?? '',
    resellerCut: entry.resellerCut?.toString() ?? '',
    dp: entry.dp?.toString() ?? '',
    totalBayar: entry.totalBayar?.toString() ?? '',
    paymentStatus: entry.paymentStatus,
    pengiriman: entry.pengiriman ?? '',
    livestockTag: entry.livestock.tag ?? '',
    salesId: entry.sales.id,
    isSent: entry.isSent,
    notes: entry.notes ?? '',
  });
  const [buktiTransferUrls, setBuktiTransferUrls] = useState<string[]>(
    entry.buktiTransfer ?? [],
  );
  const [newLivestockId, setNewLivestockId] = useState<string>('');

  function update(field: string, value: string | boolean) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSave() {
    setLoading(true);
    try {
      const formData = new FormData();
      formData.set('buyerName', form.buyerName);
      formData.set('buyerPhone', form.buyerPhone);
      formData.set('buyerAddress', form.buyerAddress);
      formData.set('buyerMaps', form.buyerMaps);
      formData.set('hargaJual', form.hargaJual);
      formData.set('hargaModal', form.hargaModal);
      formData.set('resellerCut', form.resellerCut);
      formData.set('paymentStatus', form.paymentStatus);
      if (form.paymentStatus === 'DP') {
        formData.set('dp', form.dp);
      }
      if (form.paymentStatus === 'LUNAS') {
        formData.set('totalBayar', form.hargaJual);
      }
      formData.set('pengiriman', form.pengiriman);
      formData.set('livestockTag', form.livestockTag);
      formData.set('salesId', form.salesId);
      formData.set('isSent', form.isSent.toString());
      formData.set('notes', form.notes);
      if (newLivestockId) {
        formData.set('livestockId', newLivestockId);
      }
      buktiTransferUrls.forEach((url) => formData.append('buktiTransfer', url));
      if (buktiTransferUrls.length === 0) {
        formData.set('buktiTransferCleared', 'true');
      }

      const result = await updateEntry(entry.id, formData);
      if ('error' in result) {
        toast.error(String(result.error));
      } else {
        toast.success('Entry diperbarui');
        onSaved();
      }
    } catch {
      toast.error('Terjadi kesalahan');
    }
    setLoading(false);
  }

  async function handleApprove() {
    const result = await approveEntry(entry.id);
    if ('error' in result) toast.error(String(result.error));
    else toast.success('Entry disetujui');
  }

  async function handleReject() {
    if (!confirm('Yakin ingin menolak entry ini?')) return;
    const result = await rejectEntry(entry.id);
    if ('error' in result) toast.error(String(result.error));
    else toast.success('Entry ditolak');
  }

  async function handleDelete() {
    if (!confirm('Yakin ingin menghapus entry ini?')) return;
    const result = await deleteEntry(entry.id);
    if ('error' in result) toast.error(String(result.error));
    else toast.success('Entry dihapus');
  }

  return {
    form,
    update,
    loading,
    buktiTransferUrls,
    setBuktiTransferUrls,
    newLivestockId,
    setNewLivestockId,
    handleSave,
    handleApprove,
    handleReject,
    handleDelete,
  };
}

function EntryEditFields({
  entry,
  isAdmin,
  form,
  update,
  setBuktiTransferUrls,
  availableLivestock,
  newLivestockId,
  setNewLivestockId,
  salesUsers,
}: {
  entry: EntryData;
  isAdmin: boolean;
  form: ReturnType<typeof useEntryRow>['form'];
  update: ReturnType<typeof useEntryRow>['update'];
  setBuktiTransferUrls: ReturnType<typeof useEntryRow>['setBuktiTransferUrls'];
  availableLivestock: AvailableLivestock[];
  newLivestockId: string;
  setNewLivestockId: (id: string) => void;
  salesUsers: SalesUser[];
}) {
  const isMati = entry.livestock.condition === 'MATI';
  const [livestockSearch, setLivestockSearch] = useState('');

  const filteredLivestock = useMemo(() => {
    const q = livestockSearch.toLowerCase();
    if (!q) return availableLivestock;
    return availableLivestock.filter(
      (l) =>
        l.sku.toLowerCase().includes(q) ||
        (l.tag && l.tag.toLowerCase().includes(q)) ||
        l.type.toLowerCase().includes(q) ||
        (l.grade && l.grade.toLowerCase().includes(q)),
    );
  }, [availableLivestock, livestockSearch]);

  const selectedLivestock = newLivestockId
    ? availableLivestock.find((l) => l.id === newLivestockId)
    : null;
  const selectedLabel = selectedLivestock
    ? [
        selectedLivestock.sku,
        selectedLivestock.type.charAt(0) +
          selectedLivestock.type.slice(1).toLowerCase() +
          (selectedLivestock.grade ? ' ' + selectedLivestock.grade : ''),
      ].join(' — ')
    : null;

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {isMati && (
        <div className="col-span-2 md:col-span-4 space-y-1 p-3 rounded-md border border-destructive/40 bg-destructive/5">
          <Label className="text-xs text-destructive">
            Hewan saat ini berkondisi MATI — pilih pengganti
          </Label>
          <Select
            value={newLivestockId || '__none__'}
            onValueChange={(val) => {
              setNewLivestockId(val === '__none__' ? '' : (val ?? ''));
              if (val) setLivestockSearch('');
            }}
          >
            <SelectTrigger className="h-8 text-sm">
              <SelectValue placeholder="Pilih hewan pengganti">
                {selectedLabel ?? 'Tetap — tidak diganti'}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {/* Search input inside dropdown */}
              <div className="px-2 py-1.5 border-b">
                <div className="relative">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                  <input
                    className="w-full pl-6 pr-2 py-1 text-xs rounded border bg-background focus:outline-none focus:ring-1 focus:ring-ring"
                    placeholder="Cari SKU, tag, jenis..."
                    value={livestockSearch}
                    onChange={(e) => setLivestockSearch(e.target.value)}
                    onKeyDown={(e) => {
                      e.stopPropagation();
                      e.nativeEvent.stopImmediatePropagation();
                    }}
                    onClick={(e) => e.stopPropagation()}
                  />
                </div>
              </div>
              <SelectItem value="__none__" label="Tetap — tidak diganti">
                Tetap — tidak diganti
              </SelectItem>
              {filteredLivestock.map((l) => {
                const typeLabel =
                  l.type.charAt(0) + l.type.slice(1).toLowerCase();
                const label = [
                  l.tag ?? l.sku,
                  typeLabel + (l.grade ? ' ' + l.grade : ''),
                ].join(' — ');
                return (
                  <SelectItem key={l.id} value={l.id} label={label}>
                    {label}
                  </SelectItem>
                );
              })}
              {filteredLivestock.length === 0 && (
                <SelectItem value="__empty__" disabled>
                  {livestockSearch
                    ? `Tidak ada hasil untuk "${livestockSearch}"`
                    : 'Tidak ada hewan tersedia'}
                </SelectItem>
              )}
            </SelectContent>
          </Select>
        </div>
      )}
      {/* Tag Hewan */}
      <div className="space-y-1">
        <Label className="text-xs">Tag Hewan</Label>
        <Input
          value={form.livestockTag}
          onChange={(e) => update('livestockTag', e.target.value)}
          className="h-8 text-sm"
          placeholder="MF-00X | RQ-00X | QB-00X"
        />
      </div>
      {/* Sales */}
      {isAdmin && salesUsers.length > 0 && (
        <div className="space-y-1">
          <Label className="text-xs">Sales</Label>
          <Select
            value={form.salesId}
            onValueChange={(val) => update('salesId', val ?? form.salesId)}
          >
            <SelectTrigger className="h-8 text-sm">
              <SelectValue>
                {salesUsers.find((s) => s.id === form.salesId)?.name ??
                  form.salesId}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {salesUsers.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
      {/* Buyer */}
      <div className="space-y-1">
        <Label className="text-xs">Nama Pembeli</Label>
        <Input
          value={form.buyerName}
          onChange={(e) => update('buyerName', e.target.value)}
          className="h-8 text-sm"
        />
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Telepon</Label>
        <Input
          value={form.buyerPhone}
          onChange={(e) => update('buyerPhone', e.target.value)}
          className="h-8 text-sm"
        />
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Google Maps</Label>
        <Input
          value={form.buyerMaps}
          onChange={(e) => update('buyerMaps', e.target.value)}
          className="h-8 text-sm"
        />
      </div>

      {/* Pricing */}
      <div className="space-y-1">
        <Label className="text-xs">Harga Jual</Label>
        <RupiahInput
          value={form.hargaJual}
          onValueChange={(v) => update('hargaJual', v)}
          className="h-8 text-sm"
        />
      </div>
      {isAdmin && (
        <>
          <div className="space-y-1">
            <Label className="text-xs">Harga Modal</Label>
            <RupiahInput
              value={form.hargaModal}
              onValueChange={(v) => update('hargaModal', v)}
              className="h-8 text-sm"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Reseller Cut</Label>
            <RupiahInput
              value={form.resellerCut}
              onValueChange={(v) => update('resellerCut', v)}
              className="h-8 text-sm"
            />
          </div>
        </>
      )}

      {/* Payment — DP only visible when paymentStatus = DP */}
      {form.paymentStatus === 'DP' && (
        <div className="space-y-1">
          <Label className="text-xs">Jumlah DP</Label>
          <RupiahInput
            value={form.dp}
            onValueChange={(v) => update('dp', v)}
            className="h-8 text-sm"
          />
        </div>
      )}
      {isAdmin && (
        <div className="space-y-1">
          <Label className="text-xs">Sudah Dikirim</Label>
          <div className="pt-1">
            <Switch
              checked={form.isSent}
              onCheckedChange={(val) => update('isSent', val)}
            />
          </div>
        </div>
      )}
      <div className="space-y-1">
        <Label className="text-xs">Alamat</Label>
        <Input
          value={form.buyerAddress}
          onChange={(e) => update('buyerAddress', e.target.value)}
          className="h-8 text-sm"
        />
      </div>

      {/* Pengiriman */}
      <div className="space-y-1">
        <Label className="text-xs">Pengiriman</Label>
        <Select
          value={form.pengiriman || '__none__'}
          onValueChange={(val) =>
            update('pengiriman', !val || val === '__none__' ? '' : val)
          }
        >
          <SelectTrigger className="h-8 text-sm">
            <SelectValue>
              {form.pengiriman
                ? (PENGIRIMAN_LABEL[form.pengiriman] ?? form.pengiriman)
                : '— Tidak ada —'}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__">— Tidak ada —</SelectItem>
            <SelectItem value="HARI_H">Hari H</SelectItem>
            <SelectItem value="H_1">H-1</SelectItem>
            <SelectItem value="H_2">H-2</SelectItem>
            <SelectItem value="H_3">H-3</SelectItem>
            <SelectItem value="TITIP_POTONG">Titip Potong</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Status Bayar + Bukti Transfer */}
      <div className="col-span-2 md:col-span-4">
        <div className="flex flex-wrap items-end gap-4">
          <div className="space-y-1 w-[180px]">
            <Label className="text-xs">Pembayaran</Label>
            <Select
              value={form.paymentStatus}
              onValueChange={(val) =>
                update('paymentStatus', val ?? form.paymentStatus)
              }
            >
              <SelectTrigger className="h-8 text-sm">
                <SelectValue>
                  {PAYMENT_LABEL[form.paymentStatus] ?? form.paymentStatus}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="BELUM_BAYAR">Belum Bayar</SelectItem>
                <SelectItem value="DP">DP</SelectItem>
                <SelectItem value="LUNAS">Lunas</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1 flex-1 min-w-[200px]">
            <Label className="text-xs">Bukti Transfer</Label>
            <BuktiTransferUpload
              key={entry.id + '-bukti'}
              initialUrls={entry.buktiTransfer ?? []}
              onChange={setBuktiTransferUrls}
            />
          </div>
        </div>
      </div>

      {/* Notes - full width */}
      <div className="col-span-2 md:col-span-4 space-y-1">
        <Label className="text-xs">Catatan</Label>
        <Textarea
          value={form.notes}
          onChange={(e) => update('notes', e.target.value)}
          rows={2}
          className="text-sm"
        />
      </div>
    </div>
  );
}

function EntryRow({
  entry,
  isAdmin,
  canViewFinancials,
  isEditing,
  onEdit,
  onCancel,
  onSaved,
  availableLivestock,
  salesUsers,
}: {
  entry: EntryData;
  isAdmin: boolean;
  canViewFinancials: boolean;
  isEditing: boolean;
  onEdit: () => void;
  onCancel: () => void;
  onSaved: () => void;
  availableLivestock: AvailableLivestock[];
  salesUsers: SalesUser[];
}) {
  const {
    form,
    update,
    loading,
    setBuktiTransferUrls,
    newLivestockId,
    setNewLivestockId,
    handleSave,
    handleApprove,
    handleReject,
    handleDelete,
  } = useEntryRow(entry, onSaved);

  const isMati = entry.livestock.condition === 'MATI';
  const rowClass = isMati
    ? 'bg-zinc-300 text-zinc-800 hover:bg-zinc-400/70 dark:bg-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-600'
    : isEditing
      ? 'bg-muted/30'
      : '';

  const weightLabel =
    entry.livestock.type === 'SAPI'
      ? formatWeight(entry.livestock.weightMin, entry.livestock.weightMax)
      : null;

  return (
    <>
      {/* Main row */}
      <tr className={`border-b last:border-0 transition-colors ${rowClass}`}>
        <td className="p-3 font-mono text-xs">{entry.invoiceNo}</td>
        <td className="p-3">
          <span>
            {entry.livestock.type}
            {entry.livestock.grade ? ' ' + entry.livestock.grade : ''}
          </span>
          {weightLabel && (
            <span className="ml-1.5 inline-flex items-center text-[10px] font-medium px-1.5 py-0.5 rounded bg-muted text-muted-foreground align-middle">
              {weightLabel}
            </span>
          )}
          <div className="text-xs text-muted-foreground">
            <LivestockPhotoLink
              photoUrl={entry.livestock.photoUrl}
              alt={`${entry.livestock.type} ${entry.livestock.grade ?? ''} - ${entry.livestock.sku}`}
            >
              {entry.livestock.tag ?? entry.livestock.sku}
            </LivestockPhotoLink>
          </div>
        </td>
        <td className="p-3">
          {entry.buyerName}
          {entry.buyerPhone && (
            <div className="text-xs text-muted-foreground">
              {entry.buyerPhone}
            </div>
          )}
        </td>
        {isAdmin && <td className="p-3">{entry.sales.name}</td>}
        <td className="p-3 text-center">{formatRupiah(entry.hargaJual)}</td>
        <td className="p-3 text-center">
          {entry.resellerCut ? formatRupiah(entry.resellerCut) : '-'}
        </td>
        {canViewFinancials && (
          <>
            <td className="p-3 text-center">
              {entry.hargaModal ? formatRupiah(entry.hargaModal) : '-'}
            </td>
            <td className="p-3 text-center">
              {entry.profit ? (
                <span
                  className={
                    entry.profit >= 0 ? 'text-primary' : 'text-destructive'
                  }
                >
                  {formatRupiah(entry.profit)}
                </span>
              ) : (
                '-'
              )}
            </td>
          </>
        )}
        <td className="p-3 text-center">
          <HoverBuktiTransfer
            buktiTransfer={entry.buktiTransfer}
            paymentStatus={entry.paymentStatus}
          />
        </td>
        <td className="p-3 text-center">
          <KirimCell isSent={entry.isSent} delivery={entry.delivery} />
        </td>
        <td className="p-3 text-center">
          <StatusIcon status={entry.status} />
        </td>
        <td className="p-3 text-xs text-muted-foreground whitespace-nowrap text-center">
          {formatDateTime(new Date(entry.createdAt))}
        </td>
        <td className="p-3 text-center">
          <div className="flex items-center justify-center gap-1">
            {isEditing ? (
              <>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-primary"
                  onClick={handleSave}
                  disabled={loading}
                  title="Simpan"
                >
                  <Save className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={onCancel}
                  title="Batal"
                >
                  <XCircle className="h-3.5 w-3.5" />
                </Button>
              </>
            ) : (
              <>
                {isAdmin && entry.status === 'PENDING' && (
                  <>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-primary"
                      onClick={handleApprove}
                      title="Setujui"
                    >
                      <Check className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive"
                      onClick={handleReject}
                      title="Tolak"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={onEdit}
                  title="Edit"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                {entry.status === 'APPROVED' &&
                  entry.buktiTransfer.length > 0 && (
                    <PdfMenu entryId={entry.id} />
                  )}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-destructive"
                  onClick={handleDelete}
                  title="Hapus"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </>
            )}
          </div>
        </td>
      </tr>

      {/* Inline edit row */}
      {isEditing && (
        <tr className="border-b bg-muted/20">
          <td colSpan={isAdmin ? 13 : 10} className="p-4">
            <EntryEditFields
              entry={entry}
              isAdmin={isAdmin}
              form={form}
              update={update}
              setBuktiTransferUrls={setBuktiTransferUrls}
              availableLivestock={availableLivestock}
              newLivestockId={newLivestockId}
              setNewLivestockId={setNewLivestockId}
              salesUsers={salesUsers}
            />
          </td>
        </tr>
      )}
    </>
  );
}

function MobileEntryCard({
  entry,
  isAdmin,
  canViewFinancials,
  isEditing,
  onEdit,
  onCancel,
  onSaved,
  availableLivestock,
  salesUsers,
}: {
  entry: EntryData;
  isAdmin: boolean;
  canViewFinancials: boolean;
  isEditing: boolean;
  onEdit: () => void;
  onCancel: () => void;
  onSaved: () => void;
  availableLivestock: AvailableLivestock[];
  salesUsers: SalesUser[];
}) {
  const [expanded, setExpanded] = useState(false);
  const {
    form,
    update,
    loading,
    setBuktiTransferUrls,
    newLivestockId,
    setNewLivestockId,
    handleSave,
    handleApprove,
    handleReject,
    handleDelete,
  } = useEntryRow(entry, onSaved);

  const open = expanded || isEditing;
  const isMati = entry.livestock.condition === 'MATI';
  const cardClass = isMati
    ? 'bg-zinc-300 text-zinc-800 dark:bg-zinc-700 dark:text-zinc-200'
    : 'bg-card';
  const weightLabel =
    entry.livestock.type === 'SAPI'
      ? formatWeight(entry.livestock.weightMin, entry.livestock.weightMax)
      : null;

  return (
    <div className={`rounded-lg border shadow-sm overflow-hidden ${cardClass}`}>
      {/* Header — tap to toggle */}
      <div
        role="button"
        tabIndex={0}
        onClick={() => setExpanded((v) => !v)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setExpanded((v) => !v);
          }
        }}
        className="w-full flex items-center gap-2 p-3 text-left hover:bg-muted/30 transition-colors cursor-pointer"
      >
        <div className="flex-1 min-w-0 text-sm truncate">
          <span className="font-medium">{entry.buyerName}</span>
          <span className="mx-2 text-muted-foreground">|</span>
          <span className="font-medium">
            {entry.livestock.type}
            {entry.livestock.grade ? ' ' + entry.livestock.grade : ''}
          </span>
          {weightLabel && (
            <span className="ml-1.5 inline-flex items-center text-[10px] font-medium px-1.5 py-0.5 rounded bg-muted text-muted-foreground align-middle">
              {weightLabel}
            </span>
          )}
          <LivestockPhotoLink
            photoUrl={entry.livestock.photoUrl}
            alt={`${entry.livestock.type} ${entry.livestock.grade ?? ''} - ${entry.livestock.sku}`}
            className="text-muted-foreground text-xs ml-1"
          >
            ({entry.livestock.tag ?? entry.livestock.sku})
          </LivestockPhotoLink>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <StatusIcon status={entry.status} />
          <KirimIcon isSent={entry.isSent} />
          <DeliveryIcon delivery={entry.delivery} />
        </div>
        <ChevronDown
          className={`h-4 w-4 text-muted-foreground shrink-0 transition-transform ${
            open ? 'rotate-180' : ''
          }`}
        />
      </div>

      {/* Body */}
      {open && (
        <div className="border-t">
          {isEditing ? (
            <div className="p-3 space-y-3">
              <EntryEditFields
                entry={entry}
                isAdmin={isAdmin}
                form={form}
                update={update}
                setBuktiTransferUrls={setBuktiTransferUrls}
                availableLivestock={availableLivestock}
                newLivestockId={newLivestockId}
                setNewLivestockId={setNewLivestockId}
                salesUsers={salesUsers}
              />
              <div className="flex gap-2 pt-2 border-t">
                <Button
                  size="sm"
                  className="flex-1"
                  onClick={handleSave}
                  disabled={loading}
                >
                  <Save className="h-3.5 w-3.5 mr-1" />
                  Simpan
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1"
                  onClick={onCancel}
                  disabled={loading}
                >
                  <XCircle className="h-3.5 w-3.5 mr-1" />
                  Batal
                </Button>
              </div>
            </div>
          ) : (
            <>
              <dl className="divide-y text-sm">
                <CardRow
                  label="Hewan"
                  value={
                    <>
                      {entry.livestock.type}
                      {entry.livestock.grade ? ' ' + entry.livestock.grade : ''}
                      {weightLabel && (
                        <span className="ml-1.5 inline-flex items-center text-[10px] font-medium px-1.5 py-0.5 rounded bg-muted text-muted-foreground align-middle">
                          {weightLabel}
                        </span>
                      )}
                      <LivestockPhotoLink
                        photoUrl={entry.livestock.photoUrl}
                        alt={`${entry.livestock.type} ${entry.livestock.grade ?? ''} - ${entry.livestock.sku}`}
                        className="text-muted-foreground text-xs ml-1"
                      >
                        ({entry.livestock.tag ?? entry.livestock.sku})
                      </LivestockPhotoLink>
                    </>
                  }
                />
                <CardRow
                  label="Pembeli"
                  value={
                    <>
                      {entry.buyerName}
                      {entry.buyerPhone && (
                        <div className="text-muted-foreground text-xs">
                          {entry.buyerPhone}
                        </div>
                      )}
                    </>
                  }
                />
                {isAdmin && <CardRow label="Sales" value={entry.sales.name} />}
                <CardRow
                  label="Harga Jual"
                  value={formatRupiah(entry.hargaJual)}
                />
                <CardRow
                  label="Sales Cut"
                  value={
                    entry.resellerCut ? formatRupiah(entry.resellerCut) : '-'
                  }
                />
                {canViewFinancials && (
                  <>
                    <CardRow
                      label="Modal"
                      value={
                        entry.hargaModal ? formatRupiah(entry.hargaModal) : '-'
                      }
                    />
                    <CardRow
                      label="Profit"
                      value={
                        entry.profit ? (
                          <span
                            className={
                              entry.profit >= 0
                                ? 'text-primary'
                                : 'text-destructive'
                            }
                          >
                            {formatRupiah(entry.profit)}
                          </span>
                        ) : (
                          '-'
                        )
                      }
                    />
                  </>
                )}
                <CardRow
                  label="Bayar"
                  value={
                    <HoverBuktiTransfer
                      buktiTransfer={entry.buktiTransfer}
                      paymentStatus={entry.paymentStatus}
                    />
                  }
                />
                <CardRow
                  label="Tanggal"
                  value={
                    <span className="text-muted-foreground text-xs">
                      {formatDateTime(new Date(entry.createdAt))}
                    </span>
                  }
                />
                {entry.notes && (
                  <CardRow
                    label="Catatan"
                    value={
                      <span className="text-muted-foreground text-xs whitespace-pre-wrap">
                        {entry.notes}
                      </span>
                    }
                  />
                )}
              </dl>

              {/* Action bar */}
              <div className="flex items-center justify-end gap-1 p-2 border-t bg-muted/20">
                {isAdmin && entry.status === 'PENDING' && (
                  <>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-primary"
                      onClick={handleApprove}
                      title="Setujui"
                    >
                      <Check className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive"
                      onClick={handleReject}
                      title="Tolak"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={onEdit}
                  title="Edit"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                {entry.status === 'APPROVED' &&
                  entry.buktiTransfer.length > 0 && (
                    <PdfMenu entryId={entry.id} />
                  )}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-destructive"
                  onClick={handleDelete}
                  title="Hapus"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function CardRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 px-3 py-2">
      <dt className="text-muted-foreground text-xs w-24 flex-shrink-0 pt-0.5">
        {label}
      </dt>
      <dd className="flex-1 text-sm min-w-0">{value}</dd>
    </div>
  );
}

function IconTooltip({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <span
      aria-label={label}
      className="relative inline-flex group/tip align-middle"
    >
      {children}
      <span
        role="tooltip"
        className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-1 whitespace-nowrap rounded bg-popover text-popover-foreground border shadow-sm px-2 py-0.5 text-[10px] opacity-0 group-hover/tip:opacity-100 transition-opacity z-50"
      >
        {label}
      </span>
    </span>
  );
}

function KirimIcon({ isSent }: { isSent: boolean }) {
  return (
    <IconTooltip label={isSent ? 'Sudah dikirim' : 'Belum dikirim'}>
      <Truck
        className={`h-4 w-4 ${
          isSent ? 'text-primary' : 'text-muted-foreground/40'
        }`}
      />
    </IconTooltip>
  );
}

function DeliveryIcon({
  delivery,
}: {
  delivery: { status: string; driverName: string | null } | null;
}) {
  const assigned = !!(delivery && delivery.driverName);
  const label = assigned
    ? `Rute: ${delivery!.driverName} (${delivery!.status})`
    : delivery
      ? 'Belum di-assign driver'
      : 'Belum masuk rute';
  const iconClass = `h-4 w-4 ${
    assigned ? 'text-yellow-500' : 'text-muted-foreground/40'
  }`;
  return (
    <IconTooltip label={label}>
      <Route className={iconClass} />
    </IconTooltip>
  );
}

function KirimCell({
  isSent,
  delivery,
}: {
  isSent: boolean;
  delivery: { status: string; driverName: string | null } | null;
}) {
  return (
    <div className="flex flex-col items-center gap-0.5">
      <div className="flex items-center gap-1.5">
        <KirimIcon isSent={isSent} />
        <DeliveryIcon delivery={delivery} />
      </div>
      {delivery?.driverName && (
        <span className="text-[10px] leading-tight text-muted-foreground max-w-[90px] truncate">
          {delivery.driverName}
        </span>
      )}
    </div>
  );
}

function StatusIcon({ status }: { status: string }) {
  const { Icon, label, className } =
    status === 'APPROVED'
      ? { Icon: CheckCircle2, label: 'Disetujui', className: 'text-primary' }
      : status === 'PENDING'
        ? { Icon: Clock, label: 'Menunggu', className: 'text-yellow-600' }
        : { Icon: XCircle, label: 'Ditolak', className: 'text-destructive' };
  return (
    <IconTooltip label={label}>
      <Icon className={`h-4 w-4 ${className}`} />
    </IconTooltip>
  );
}

/**
 * BuktiPreviewItem — Single row in the payment status hover popover.
 * Shows a thumbnail + label. Clicking opens a fullscreen lightbox.
 */
function BuktiPreviewItem({ url, label }: { url: string; label: string }) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Ensure portal target is available (client-side only)
  useEffect(() => {
    setMounted(true);
  }, []);

  const lightbox =
    mounted && open
      ? createPortal(
          <div
            className="fixed inset-0 z-[99999] bg-black/70 flex items-center justify-center p-4"
            onClick={() => setOpen(false)}
          >
            <div
              className="relative max-w-lg w-full rounded-lg overflow-hidden shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <Image
                src={url}
                alt={label}
                width={640}
                height={480}
                sizes="(max-width: 640px) 100vw, 640px"
                className="w-full h-auto object-contain"
              />
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="absolute top-2 right-2 bg-black/50 hover:bg-black/80 text-white rounded-full p-1 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>,
          document.body,
        )
      : null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 w-full rounded hover:bg-muted px-1 py-1 transition-colors text-left"
      >
        <div className="relative w-8 h-8 rounded overflow-hidden flex-shrink-0 bg-muted">
          <Image
            src={url}
            alt={label}
            fill
            sizes="32px"
            className="object-cover"
          />
        </div>
        <span className="text-xs text-primary underline underline-offset-2 truncate">
          {label}
        </span>
      </button>
      {lightbox}
    </>
  );
}
