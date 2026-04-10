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

import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
  Search,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
} from 'lucide-react';
import {
  updateEntry,
  approveEntry,
  rejectEntry,
  deleteEntry,
} from '@/app/actions/entries';
import { toast } from 'sonner';
import { formatRupiah, formatDateTime } from '@/lib/format';

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
  buyerWa: string | null;
  buyerAddress: string | null;
  buyerMaps: string | null;
  notes: string | null;
  isSent: boolean;
  createdAt: string;
  livestock: { sku: string; type: string; grade: string };
  sales: { name: string };
}

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
}: {
  entries: EntryData[];
  isAdmin?: boolean;
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
              <SelectValue placeholder="Status" />
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
              <SelectValue placeholder="Pembayaran" />
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
              <SelectValue placeholder="Pengiriman" />
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

      <div className="overflow-x-auto">
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
                <>
                  <th
                    className="text-center p-3 font-medium cursor-pointer select-none hover:bg-muted/80"
                    onClick={() => toggleSort('sales')}
                  >
                    <span className="inline-flex items-center gap-1">
                      Sales <SortIcon field="sales" />
                    </span>
                  </th>
                </>
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
              {isAdmin && (
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
              <th className="text-center p-3 font-medium">Kirim</th>
              <th className="text-center p-3 font-medium">Status</th>
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
                isEditing={editingId === entry.id}
                onEdit={() => setEditingId(entry.id)}
                onCancel={() => setEditingId(null)}
                onSaved={() => setEditingId(null)}
              />
            ))}
            {filtered.length === 0 && (
              <tr>
                <td
                  colSpan={isAdmin ? 13 : 10}
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
    </div>
  );
}

function EntryRow({
  entry,
  isAdmin,
  isEditing,
  onEdit,
  onCancel,
  onSaved,
}: {
  entry: EntryData;
  isAdmin: boolean;
  isEditing: boolean;
  onEdit: () => void;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    buyerName: entry.buyerName,
    buyerPhone: entry.buyerPhone ?? '',
    buyerWa: entry.buyerWa ?? '',
    buyerAddress: entry.buyerAddress ?? '',
    buyerMaps: entry.buyerMaps ?? '',
    hargaJual: entry.hargaJual.toString(),
    hargaModal: entry.hargaModal?.toString() ?? '',
    resellerCut: entry.resellerCut?.toString() ?? '',
    dp: entry.dp?.toString() ?? '',
    totalBayar: entry.totalBayar?.toString() ?? '',
    paymentStatus: entry.paymentStatus,
    isSent: entry.isSent,
    notes: entry.notes ?? '',
  });

  function update(field: string, value: string | boolean) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSave() {
    setLoading(true);
    try {
      const formData = new FormData();
      formData.set('buyerName', form.buyerName);
      formData.set('buyerPhone', form.buyerPhone);
      formData.set('buyerWa', form.buyerWa);
      formData.set('buyerAddress', form.buyerAddress);
      formData.set('buyerMaps', form.buyerMaps);
      formData.set('hargaJual', form.hargaJual);
      formData.set('hargaModal', form.hargaModal);
      formData.set('resellerCut', form.resellerCut);
      formData.set('dp', form.dp);
      formData.set('totalBayar', form.totalBayar);
      formData.set('paymentStatus', form.paymentStatus);
      formData.set('isSent', form.isSent.toString());
      formData.set('notes', form.notes);

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

  return (
    <>
      {/* Main row */}
      <tr
        className={`border-b last:border-0 ${isEditing ? 'bg-muted/30' : ''}`}
      >
        <td className="p-3 font-mono text-xs">{entry.invoiceNo}</td>
        <td className="p-3">
          {entry.livestock.type} {entry.livestock.grade}
          <div className="text-xs text-muted-foreground">
            {entry.livestock.sku}
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
        {isAdmin && (
          <>
            <td className="p-3">{entry.sales.name}</td>
          </>
        )}
        <td className="p-3 text-center">{formatRupiah(entry.hargaJual)}</td>
        <td className="p-3 text-center">
          {entry.resellerCut ? formatRupiah(entry.resellerCut) : '-'}
        </td>
        {isAdmin && (
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
          <Badge
            variant={
              entry.paymentStatus === 'LUNAS'
                ? 'default'
                : entry.paymentStatus === 'DP'
                  ? 'secondary'
                  : 'outline'
            }
          >
            {entry.paymentStatus === 'BELUM_BAYAR'
              ? 'Belum'
              : entry.paymentStatus}
          </Badge>
        </td>
        <td className="p-3 text-center">
          {entry.isSent ? (
            <Badge variant="default">Ya</Badge>
          ) : (
            <Badge variant="outline">Belum</Badge>
          )}
        </td>
        <td className="p-3 text-center">
          <Badge
            variant={
              entry.status === 'APPROVED'
                ? 'default'
                : entry.status === 'PENDING'
                  ? 'secondary'
                  : 'destructive'
            }
          >
            {entry.status}
          </Badge>
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
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
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
                <Label className="text-xs">WhatsApp</Label>
                <Input
                  value={form.buyerWa}
                  onChange={(e) => update('buyerWa', e.target.value)}
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
                <Input
                  type="number"
                  value={form.hargaJual}
                  onChange={(e) => update('hargaJual', e.target.value)}
                  className="h-8 text-sm"
                />
              </div>
              {isAdmin && (
                <>
                  <div className="space-y-1">
                    <Label className="text-xs">Harga Modal</Label>
                    <Input
                      type="number"
                      value={form.hargaModal}
                      onChange={(e) => update('hargaModal', e.target.value)}
                      className="h-8 text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Reseller Cut</Label>
                    <Input
                      type="number"
                      value={form.resellerCut}
                      onChange={(e) => update('resellerCut', e.target.value)}
                      className="h-8 text-sm"
                    />
                  </div>
                </>
              )}
              <div className="space-y-1">
                <Label className="text-xs">Status Bayar</Label>
                <Select
                  value={form.paymentStatus}
                  onValueChange={(val) =>
                    update('paymentStatus', val ?? form.paymentStatus)
                  }
                >
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="BELUM_BAYAR">Belum Bayar</SelectItem>
                    <SelectItem value="DP">DP</SelectItem>
                    <SelectItem value="LUNAS">Lunas</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Payment */}
              <div className="space-y-1">
                <Label className="text-xs">DP</Label>
                <Input
                  type="number"
                  value={form.dp}
                  onChange={(e) => update('dp', e.target.value)}
                  className="h-8 text-sm"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Total Dibayar</Label>
                <Input
                  type="number"
                  value={form.totalBayar}
                  onChange={(e) => update('totalBayar', e.target.value)}
                  className="h-8 text-sm"
                />
              </div>
              {isAdmin && (
                <>
                  <div className="space-y-1">
                    <Label className="text-xs">Sudah Dikirim</Label>
                    <div className="pt-1">
                      <Switch
                        checked={form.isSent}
                        onCheckedChange={(val) => update('isSent', val)}
                      />
                    </div>
                  </div>
                </>
              )}
              <div className="space-y-1">
                <Label className="text-xs">Alamat</Label>
                <Input
                  value={form.buyerAddress}
                  onChange={(e) => update('buyerAddress', e.target.value)}
                  className="h-8 text-sm"
                />
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
          </td>
        </tr>
      )}
    </>
  );
}
