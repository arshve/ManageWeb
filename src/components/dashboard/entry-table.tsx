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

import { memo, useCallback, useState, useMemo, useRef, useEffect } from 'react';
import { Pagination } from '@/components/ui/pagination';
import { Lightbox } from '@/components/ui/lightbox';
import { toThumbnailUrl } from '@/lib/image';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { RupiahInput } from '@/components/ui/rupiah-input';
import { Field, FieldLabel } from '@/components/ui/field';
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
  MapPin,
  Map,
  Search,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  ChevronDown,
  Calendar,
  Beef,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { LivestockPicker, type PickerLivestock } from '@/components/dashboard/livestock-picker';
import {
  updateEntry,
  approveEntry,
  rejectEntry,
  deleteEntry,
  requestDeleteEntry,
  cancelDeleteRequest,
  proposeEntryEdit,
  directEditEntryItems,
  approveEntryEdit,
  rejectEntryEdit,
  cancelEntryEdit,
  getAvailableLivestockForSwap,
  updateEntryRequests,
} from '@/app/actions/entries';
import {
  AntrianRequestRows,
  rowsToJson,
  type RequestRow,
} from '@/components/dashboard/antrian-request-rows';
import { toast } from 'sonner';
import {
  formatRupiah,
  formatDateTime,
  formatPaymentStatus,
  formatWeight,
  formatPengiriman,
} from '@/lib/format';
import { BuktiTransferUpload } from '@/components/dashboard/bukti-transfer-upload';
import { PdfMenu } from '@/components/dashboard/pdf-menu';
import { LivestockPhotoLink } from '@/components/dashboard/livestock-photo-link';
import { StatusToken } from '@/components/ui/status-token';
import Image from 'next/image';

export interface EntryItemData {
  id: string;
  hargaJual: number;
  hargaModal: number | null;
  resellerCut: number | null;
  hpp: number | null;
  profit: number | null;
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
}

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
  updatedAt: string;
  delivery: {
    status: string;
    driverName: string | null;
  } | null;
  items: EntryItemData[];
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
  } | null;
  sales: { id: string; name: string };
  deleteRequestedAt: string | null;
  deleteRequestedById: string | null;
  requests: {
    id: string;
    type: string;
    grade: string | null;
    weightMin: number | null;
    weightMax: number | null;
    hargaJual: number;
  }[];
  editRequests: {
    id: string;
    proposedByName: string;
    createdAt: string;
    itemChanges: {
      entryItemId: string;
      newLivestockId: string;
      newLivestockSku: string;
      newLivestockType: string;
      newLivestockGrade: string | null;
      newHargaJual: number;
    }[];
  }[];
}

export interface SalesUser {
  id: string;
  name: string;
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
  | 'createdAt'
  | 'updatedAt';
type SortDir = 'asc' | 'desc';

export function EntryTable({
  entries,
  isAdmin = false,
  canViewFinancials = false,
  salesUsers = [],
}: {
  entries: EntryData[];
  isAdmin?: boolean;
  canViewFinancials?: boolean;
  salesUsers?: SalesUser[];
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const handleClearEditing = useCallback(() => setEditingId(null), []);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [paymentFilter, setPaymentFilter] = useState('ALL');
  const [sentFilter, setSentFilter] = useState('ALL');
  const [pengirimanFilter, setPengirimanFilter] = useState('ALL');
  const [dataFilter, setDataFilter] = useState('ALL');
  const [sortField, setSortField] = useState<SortField>('createdAt');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 20;

  useEffect(() => { setPage(1); }, [search, statusFilter, paymentFilter, sentFilter, pengirimanFilter, dataFilter]);

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
      return <ArrowUpDown className="size-3 opacity-40" />;
    return sortDir === 'asc' ? (
      <ArrowUp className="size-3" />
    ) : (
      <ArrowDown className="size-3" />
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
          e.items.some((i) => i.livestock.sku.toLowerCase().includes(q)) ||
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
    if (pengirimanFilter !== 'ALL') {
      result = result.filter((e) =>
        pengirimanFilter === 'NONE' ? !e.pengiriman : e.pengiriman === pengirimanFilter,
      );
    }
    if (dataFilter === 'NO_ALAMAT') {
      result = result.filter((e) => !e.buyerAddress?.trim());
    }
    if (dataFilter === 'NO_MAPS') {
      result = result.filter((e) => !e.buyerMaps?.trim());
    }

    result = [...result].sort((a, b) => {
      if (isAdmin) {
        const priority = (e: EntryData) =>
          e.deleteRequestedAt ? 0
          : e.status === 'PENDING' ? 1
          : e.editRequests.length > 0 ? 2
          : 3;
        const diff = priority(a) - priority(b);
        if (diff !== 0) return diff;
      }
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
        case 'updatedAt':
          cmp =
            new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime();
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
    pengirimanFilter,
    dataFilter,
    sortField,
    sortDir,
  ]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div>
      {/* Toolbar: Search + Filters */}
      <div className="p-3 border-b flex flex-col gap-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
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
          <Select
            value={pengirimanFilter}
            onValueChange={(val) => setPengirimanFilter(val ?? 'ALL')}
          >
            <SelectTrigger className="h-8 w-[140px] text-xs">
              <SelectValue>
                {{
                  ALL: 'Semua Kirim',
                  NONE: 'Belum Diset',
                  HARI_H: 'Hari H',
                  H_1: 'H-1',
                  H_2: 'H-2',
                  H_3: 'H-3',
                  TITIP_POTONG: 'Titip Potong',
                }[pengirimanFilter] ?? pengirimanFilter}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Semua Pengiriman</SelectItem>
              <SelectItem value="NONE">Belum Diset</SelectItem>
              <SelectItem value="HARI_H">Hari H</SelectItem>
              <SelectItem value="H_1">H-1</SelectItem>
              <SelectItem value="H_2">H-2</SelectItem>
              <SelectItem value="H_3">H-3</SelectItem>
              <SelectItem value="TITIP_POTONG">Titip Potong</SelectItem>
            </SelectContent>
          </Select>
          <Select
            value={dataFilter}
            onValueChange={(val) => setDataFilter(val ?? 'ALL')}
          >
            <SelectTrigger className="h-8 w-[150px] text-xs">
              <SelectValue>
                {{
                  ALL: 'Semua Data',
                  NO_ALAMAT: 'Tanpa Alamat',
                  NO_MAPS: 'Tanpa Maps',
                }[dataFilter] ?? dataFilter}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Semua Data</SelectItem>
              <SelectItem value="NO_ALAMAT">Tanpa Alamat</SelectItem>
              <SelectItem value="NO_MAPS">Tanpa Maps</SelectItem>
            </SelectContent>
          </Select>
          {(search ||
            statusFilter !== 'ALL' ||
            paymentFilter !== 'ALL' ||
            sentFilter !== 'ALL' ||
            pengirimanFilter !== 'ALL' ||
            dataFilter !== 'ALL') && (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 text-xs"
              onClick={() => {
                setSearch('');
                setStatusFilter('ALL');
                setPaymentFilter('ALL');
                setSentFilter('ALL');
                setPengirimanFilter('ALL');
                setDataFilter('ALL');
              }}
            >
              <X className="size-3 mr-1" />
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
              {(!isAdmin || canViewFinancials) && <th className="text-center p-3 font-medium">{isAdmin ? 'Sales Cut' : 'Komisi'}</th>}
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
              <th className="text-center p-3 font-medium w-32">Status</th>
              <th className="text-center p-3 font-medium">
                <div className="inline-flex flex-col items-center gap-0.5">
                  <button className="inline-flex items-center gap-1 hover:text-foreground cursor-pointer select-none" onClick={() => toggleSort('createdAt')}>
                    Dibuat <SortIcon field="createdAt" />
                  </button>
                  <button className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground cursor-pointer select-none" onClick={() => toggleSort('updatedAt')}>
                    Diperbarui <SortIcon field="updatedAt" />
                  </button>
                </div>
              </th>
              <th className="text-center p-3 font-medium">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {paginated.map((entry) => (
              <EntryRow
                key={entry.id}
                entry={entry}
                isAdmin={isAdmin}
                canViewFinancials={canViewFinancials}
                isEditing={editingId === entry.id}
                onEdit={setEditingId}
                onCancel={handleClearEditing}
                onSaved={handleClearEditing}
                salesUsers={salesUsers}
              />
            ))}
            {filtered.length === 0 && (
              <tr>
                <td
                  colSpan={isAdmin ? (canViewFinancials ? 12 : 10) : 8}
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
      <div className="md:hidden p-3 flex flex-col gap-3">
        {paginated.map((entry) => (
          <MobileEntryCard
            key={entry.id}
            entry={entry}
            isAdmin={isAdmin}
            canViewFinancials={canViewFinancials}
            isEditing={editingId === entry.id}
            onEdit={setEditingId}
            onCancel={handleClearEditing}
            onSaved={handleClearEditing}
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

      <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
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
          <div className="bg-popover border rounded-lg shadow-xl p-2 flex flex-col gap-1 w-52 mb-2">
            <div className="flex items-center justify-between px-1 pb-1 border-b">
              <p className="text-xs font-medium text-muted-foreground">
                Bukti Transfer ({buktiTransfer.length})
              </p>
              <button
                type="button"
                onClick={() => setShow(false)}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="size-3" />
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
          <div className="size-2 bg-popover border-b border-r rotate-45 mx-auto -mt-1" />
        </div>
      )}
    </>
  );
}

interface ItemPriceState {
  id: string;
  hargaJual: string;
  hargaModal: string;
  resellerCut: string;
  tag: string;
  livestock: EntryItemData['livestock'];
  originalHargaJual: number;
  originalLivestockId: string;
  pendingLivestockId: string | null;
  pendingLivestockSku: string | null;
  pendingLivestockGrade: string | null;
}

function useEntryRow(entry: EntryData, onSaved: () => void, isAdmin = false) {
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    buyerName: entry.buyerName,
    buyerPhone: entry.buyerPhone ?? '',
    buyerAddress: entry.buyerAddress ?? '',
    buyerMaps: entry.buyerMaps ?? '',
    dp: entry.dp?.toString() ?? '',
    paymentStatus: entry.paymentStatus,
    pengiriman: entry.pengiriman ?? '',
    salesId: entry.sales.id,
    isSent: entry.isSent,
    notes: entry.notes ?? '',
  });
  const [itemPrices, setItemPrices] = useState<ItemPriceState[]>(() =>
    entry.items.map((i) => ({
      id: i.id,
      hargaJual: i.hargaJual.toString(),
      hargaModal: i.hargaModal?.toString() ?? '',
      resellerCut: i.resellerCut?.toString() ?? '',
      tag: i.livestock.tag ?? '',
      livestock: i.livestock,
      originalHargaJual: i.hargaJual,
      originalLivestockId: i.livestock.id,
      pendingLivestockId: null,
      pendingLivestockSku: null,
      pendingLivestockGrade: null,
    })),
  );
  const [buktiTransferUrls, setBuktiTransferUrls] = useState<string[]>(
    entry.buktiTransfer ?? [],
  );
  const [requestRows, setRequestRows] = useState<RequestRow[]>(() =>
    entry.requests.map((r) => ({
      _id: r.id,
      type: r.type as RequestRow['type'],
      grade: r.grade ?? 'A',
      weightMin: r.weightMin?.toString() ?? '',
      weightMax: r.weightMax?.toString() ?? '',
      hargaJual: r.hargaJual.toString(),
      hargaModal: '',
      resellerCut: '',
      notes: '',
    })),
  );

  function update(field: string, value: string | boolean) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function updateItemPrice(id: string, field: keyof Omit<ItemPriceState, 'id' | 'livestock'>, value: string) {
    setItemPrices((prev) =>
      prev.map((ip) => (ip.id === id ? { ...ip, [field]: value } : ip)),
    );
  }

  const isSalesOnApproved = !isAdmin && entry.status === 'APPROVED';
  const isAdminOnApproved = isAdmin && entry.status === 'APPROVED';
  const pendingRequest = entry.editRequests?.[0] ?? null;

  async function handleSave() {
    setLoading(true);
    try {
      const totalHargaJual = itemPrices.reduce((s, i) => s + (Number(i.hargaJual) || 0), 0);

      // Item changes that differ from original (livestock swap or hargaJual change)
      const itemChanges = itemPrices
        .filter((ip) =>
          ip.pendingLivestockId !== null ||
          Number(ip.hargaJual) !== ip.originalHargaJual,
        )
        .map((ip) => ({
          entryItemId: ip.id,
          livestockId: ip.pendingLivestockId ?? ip.originalLivestockId,
          hargaJual: Number(ip.hargaJual),
        }));

      if (isSalesOnApproved && itemChanges.length > 0) {
        if (pendingRequest) {
          toast.error('Sudah ada permintaan perubahan yang menunggu persetujuan admin');
          setLoading(false);
          return;
        }
        const fd = new FormData();
        fd.set('itemChanges', JSON.stringify(itemChanges));
        const res = await proposeEntryEdit(entry.id, fd);
        if ('error' in res) {
          toast.error(String(res.error));
          setLoading(false);
          return;
        }
        toast.success('Perubahan harga/hewan diajukan ke admin');
      } else if (isAdminOnApproved && itemChanges.length > 0) {
        const fd = new FormData();
        fd.set('itemChanges', JSON.stringify(itemChanges));
        const res = await directEditEntryItems(entry.id, fd);
        if ('error' in res) {
          toast.error(String(res.error));
          setLoading(false);
          return;
        }
      }

      // Non-item fields always go through updateEntry directly
      const formData = new FormData();
      formData.set('buyerName', form.buyerName);
      formData.set('buyerPhone', form.buyerPhone);
      formData.set('buyerAddress', form.buyerAddress);
      formData.set('buyerMaps', form.buyerMaps);
      formData.set('paymentStatus', form.paymentStatus);
      if (form.paymentStatus === 'DP') formData.set('dp', form.dp);
      if (form.paymentStatus === 'LUNAS') formData.set('totalBayar', String(totalHargaJual));
      formData.set('pengiriman', form.pengiriman);
      formData.set('salesId', form.salesId);
      formData.set('isSent', form.isSent.toString());
      formData.set('notes', form.notes);
      buktiTransferUrls.forEach((url) => formData.append('buktiTransfer', url));
      if (buktiTransferUrls.length === 0) formData.set('buktiTransferCleared', 'true');

      // Sales-on-PENDING and non-approved admin: item changes go through updateEntry
      // Admin-on-approved with livestock changes: already handled by directEditEntryItems above
      if (!isSalesOnApproved && !(isAdminOnApproved && itemChanges.length > 0)) {
        formData.set('itemPrices', JSON.stringify(
          itemPrices.map((ip) => ({
            id: ip.id,
            hargaJual: ip.hargaJual,
            hargaModal: ip.hargaModal,
            resellerCut: ip.resellerCut,
            tag: ip.tag,
          })),
        ));
      }

      const result = await updateEntry(entry.id, formData);
      if ('error' in result) {
        toast.error(String(result.error));
        return;
      }

      if (entry.requests.length > 0) {
        const reqResult = await updateEntryRequests(entry.id, rowsToJson(requestRows));
        if ('error' in reqResult) {
          toast.error(String(reqResult.error));
          return;
        }
      }

      if (!isSalesOnApproved || itemChanges.length === 0) toast.success('Entry diperbarui');
      onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Terjadi kesalahan');
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
    if (isAdmin) {
      if (!confirm('Yakin ingin menghapus entry ini?')) return;
      const result = await deleteEntry(entry.id);
      if ('error' in result) toast.error(String(result.error));
      else toast.success('Entry dihapus');
    } else {
      if (!confirm('Kirim permintaan hapus ke admin?')) return;
      const result = await requestDeleteEntry(entry.id);
      if ('error' in result) toast.error(String(result.error));
      else toast.success('Permintaan hapus dikirim ke admin');
    }
  }

  async function handleCancelDelete() {
    const result = await cancelDeleteRequest(entry.id);
    if ('error' in result) toast.error(String(result.error));
    else toast.success('Permintaan hapus dibatalkan');
  }

  async function handleApproveDelete() {
    if (!confirm('Setujui dan hapus entry ini?')) return;
    const result = await deleteEntry(entry.id);
    if ('error' in result) toast.error(String(result.error));
    else toast.success('Entry dihapus');
  }

  async function handleRejectDelete() {
    const result = await cancelDeleteRequest(entry.id);
    if ('error' in result) toast.error(String(result.error));
    else toast.success('Permintaan hapus ditolak');
  }

  async function handleApproveEdit() {
    if (!pendingRequest) return;
    const result = await approveEntryEdit(pendingRequest.id);
    if ('error' in result) toast.error(String(result.error));
    else toast.success('Perubahan disetujui');
  }

  async function handleRejectEdit() {
    if (!pendingRequest) return;
    if (!confirm('Tolak perubahan ini?')) return;
    const result = await rejectEntryEdit(pendingRequest.id);
    if ('error' in result) toast.error(String(result.error));
    else toast.success('Perubahan ditolak');
  }

  async function handleCancelEdit() {
    if (!pendingRequest) return;
    if (!confirm('Batalkan permintaan perubahan ini?')) return;
    const result = await cancelEntryEdit(pendingRequest.id);
    if ('error' in result) toast.error(String(result.error));
    else toast.success('Permintaan dibatalkan');
  }

  function swapLivestock(entryItemId: string, livestockId: string, sku: string, grade: string | null, hargaJual: number | null) {
    setItemPrices((prev) =>
      prev.map((ip) =>
        ip.id === entryItemId
          ? {
              ...ip,
              pendingLivestockId: livestockId,
              pendingLivestockSku: sku,
              pendingLivestockGrade: grade,
              ...(hargaJual != null ? { hargaJual: String(hargaJual) } : {}),
            }
          : ip,
      ),
    );
  }

  function resetSwap(entryItemId: string) {
    setItemPrices((prev) =>
      prev.map((ip) =>
        ip.id === entryItemId
          ? { ...ip, pendingLivestockId: null, pendingLivestockSku: null, pendingLivestockGrade: null }
          : ip,
      ),
    );
  }

  return {
    form,
    update,
    itemPrices,
    updateItemPrice,
    swapLivestock,
    resetSwap,
    loading,
    buktiTransferUrls,
    setBuktiTransferUrls,
    requestRows,
    setRequestRows,
    isSalesOnApproved,
    isAdminOnApproved,
    pendingRequest,
    handleSave,
    handleApprove,
    handleReject,
    handleDelete,
    handleCancelDelete,
    handleApproveDelete,
    handleRejectDelete,
    handleApproveEdit,
    handleRejectEdit,
    handleCancelEdit,
  };
}

function LivestockSwapDialog({
  currentLivestock,
  pendingLivestockSku,
  onSwap,
  onReset,
}: {
  currentLivestock: EntryItemData['livestock'];
  pendingLivestockSku: string | null;
  onSwap: (livestockId: string, sku: string, grade: string | null, hargaJual: number | null) => void;
  onReset: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState<PickerLivestock[]>([]);
  const [loadingOpts, setLoadingOpts] = useState(false);

  useEffect(() => {
    if (!open || options.length > 0) return;
    setLoadingOpts(true);
    getAvailableLivestockForSwap(currentLivestock.type).then((res) => {
      if (!('error' in res)) setOptions(res as PickerLivestock[]);
      setLoadingOpts(false);
    });
  }, [open, currentLivestock.type, options.length]);

  const selectedId = pendingLivestockSku
    ? (options.find((o) => o.sku === pendingLivestockSku)?.id ?? null)
    : null;

  return (
    <>
      {pendingLivestockSku ? (
        <span className="inline-flex items-center gap-1">
          <Button size="sm" variant="secondary" className="h-6 text-xs px-2 gap-1" onClick={() => setOpen(true)}>
            <Beef className="size-3" />
            {pendingLivestockSku}
          </Button>
          <Button size="sm" variant="ghost" className="size-6 p-0 text-muted-foreground" onClick={onReset} title="Batal ganti">
            <X className="size-3" />
          </Button>
        </span>
      ) : (
        <Button size="sm" variant="outline" className="h-6 text-xs px-2 gap-1" onClick={() => setOpen(true)}>
          <Beef className="size-3" />
          Ganti
        </Button>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Ganti Hewan</DialogTitle>
            <DialogDescription>
              Saat ini: <span className="font-mono">{currentLivestock.sku}</span>
              {currentLivestock.grade ? ` · ${currentLivestock.grade}` : ''}
            </DialogDescription>
          </DialogHeader>
          {loadingOpts ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Memuat hewan tersedia...</p>
          ) : (
            <LivestockPicker
              livestock={options}
              selectedIds={selectedId ? [selectedId] : []}
              onToggle={(id) => {
                const lv = options.find((o) => o.id === id);
                if (!lv) return;
                onSwap(lv.id, lv.sku, lv.grade, lv.hargaJual);
                setOpen(false);
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

function PendingEditBanner({
  pendingRequest,
  isAdmin,
  entry,
  onApprove,
  onReject,
  onCancel,
  loading,
}: {
  pendingRequest: EntryData['editRequests'][0];
  isAdmin: boolean;
  entry: EntryData;
  onApprove: () => void;
  onReject: () => void;
  onCancel: () => void;
  loading: boolean;
}) {
  return (
    <div className="rounded-md border border-warning-ring/40 bg-warning-bg/30 p-3 flex flex-col gap-2">
      <div className="flex items-center gap-2 text-xs font-medium text-warning-fg">
        <Clock className="h-3.5 w-3.5" />
        <span>Perubahan diajukan oleh {pendingRequest.proposedByName}</span>
      </div>
      {isAdmin && (
        <div className="flex flex-col gap-1.5">
          {pendingRequest.itemChanges.map((ic) => {
            const originalItem = entry.items.find((i) => i.id === ic.entryItemId);
            return (
              <div key={ic.entryItemId} className="text-xs text-muted-foreground">
                <span className="line-through">{originalItem?.livestock.sku ?? ic.entryItemId}</span>
                {' → '}
                <span className="font-medium text-foreground">{ic.newLivestockSku}</span>
                {ic.newLivestockType && (
                  <span> ({ic.newLivestockType}{ic.newLivestockGrade ? ' ' + ic.newLivestockGrade : ''})</span>
                )}
                {originalItem && originalItem.hargaJual !== ic.newHargaJual && (
                  <span>
                    {' · '}
                    <span className="line-through">{formatRupiah(originalItem.hargaJual)}</span>
                    {' → '}
                    <span className="font-medium text-foreground">{formatRupiah(ic.newHargaJual)}</span>
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}
      <div className="flex gap-2">
        {isAdmin ? (
          <>
            <Button size="sm" className="h-7 text-xs" onClick={onApprove} disabled={loading}>
              <Check className="size-3 mr-1" />
              Setujui
            </Button>
            <Button size="sm" variant="outline" className="h-7 text-xs text-destructive border-destructive/50" onClick={onReject} disabled={loading}>
              <X className="size-3 mr-1" />
              Tolak
            </Button>
          </>
        ) : (
          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={onCancel} disabled={loading}>
            <XCircle className="size-3 mr-1" />
            Batalkan Permintaan
          </Button>
        )}
      </div>
    </div>
  );
}

function EntryEditFields({
  entry,
  isAdmin,
  canViewFinancials,
  isSalesOnApproved,
  isAdminOnApproved,
  form,
  update,
  itemPrices,
  updateItemPrice,
  swapLivestock,
  resetSwap,
  setBuktiTransferUrls,
  requestRows,
  setRequestRows,
  salesUsers,
}: {
  entry: EntryData;
  isAdmin: boolean;
  canViewFinancials: boolean;
  isSalesOnApproved: boolean;
  isAdminOnApproved: boolean;
  form: ReturnType<typeof useEntryRow>['form'];
  update: ReturnType<typeof useEntryRow>['update'];
  itemPrices: ItemPriceState[];
  updateItemPrice: ReturnType<typeof useEntryRow>['updateItemPrice'];
  swapLivestock: ReturnType<typeof useEntryRow>['swapLivestock'];
  resetSwap: ReturnType<typeof useEntryRow>['resetSwap'];
  setBuktiTransferUrls: ReturnType<typeof useEntryRow>['setBuktiTransferUrls'];
  requestRows: ReturnType<typeof useEntryRow>['requestRows'];
  setRequestRows: ReturnType<typeof useEntryRow>['setRequestRows'];
  salesUsers: SalesUser[];
}) {
  return (
    <div className="flex flex-col gap-4">
      {/* ── Per-item pricing ── */}
      <div className="flex flex-col gap-2">
        <p className="text-xs font-medium text-muted-foreground">
          Hewan ({itemPrices.length})
        </p>
        {itemPrices.map((ip) => {
          const lv = ip.livestock;
          const typeLabel = lv.type.charAt(0) + lv.type.slice(1).toLowerCase();
          const isMatiItem = lv.condition === 'MATI';
          return (
            <div
              key={ip.id}
              className={`rounded-md border p-2 flex flex-col gap-1.5 ${isMatiItem ? 'border-destructive/40 bg-destructive/5' : 'bg-muted/20'}`}
            >
              <p className="text-xs font-medium flex flex-wrap items-center gap-1.5">
                {typeLabel}{lv.grade ? ` · ${lv.grade}` : ''}
                {isMatiItem && <span className="text-destructive text-[10px] font-semibold">MATI</span>}
                <span className="text-muted-foreground font-mono text-[10px]">{lv.sku}</span>
                {(isSalesOnApproved || isAdminOnApproved) && (
                  <LivestockSwapDialog
                    currentLivestock={lv}
                    pendingLivestockSku={ip.pendingLivestockSku}
                    onSwap={(livestockId, sku, grade, hargaJual) => swapLivestock(ip.id, livestockId, sku, grade, hargaJual)}
                    onReset={() => resetSwap(ip.id)}
                  />
                )}
              </p>
              <div className={`grid gap-1.5 ${canViewFinancials ? 'grid-cols-2 sm:grid-cols-4' : isAdmin ? 'grid-cols-2 sm:grid-cols-3' : 'grid-cols-2'}`}>
                <Field>
                  <FieldLabel className="text-[10px]">Tag</FieldLabel>
                  <Input
                    value={ip.tag}
                    readOnly
                    className="h-7 text-xs bg-muted/50 cursor-default"
                  />
                </Field>
                <Field>
                  <FieldLabel className="text-[10px]">Harga Jual</FieldLabel>
                  <RupiahInput
                    value={ip.hargaJual}
                    onValueChange={(v) => updateItemPrice(ip.id, 'hargaJual', v)}
                    className="h-7 text-xs"
                  />
                </Field>
                {canViewFinancials && (
                  <Field>
                    <FieldLabel className="text-[10px]">Modal</FieldLabel>
                    <RupiahInput
                      value={ip.hargaModal}
                      onValueChange={(v) => updateItemPrice(ip.id, 'hargaModal', v)}
                      className="h-7 text-xs"
                    />
                  </Field>
                )}
                {canViewFinancials && (
                  <Field>
                    <FieldLabel className="text-[10px]">Reseller Cut</FieldLabel>
                    <RupiahInput
                      value={ip.resellerCut}
                      onValueChange={(v) => updateItemPrice(ip.id, 'resellerCut', v)}
                      className="h-7 text-xs"
                    />
                  </Field>
                )}
              </div>
            </div>
          );
        })}
        {isSalesOnApproved && (
          <p className="text-[11px] text-muted-foreground">
            Perubahan hewan &amp; Harga Jual perlu persetujuan admin.
          </p>
        )}
        {isAdminOnApproved && (
          <p className="text-[11px] text-muted-foreground">
            Perubahan hewan &amp; Harga Jual akan langsung diterapkan.
          </p>
        )}
        {itemPrices.length > 1 && (
          <div className="flex justify-between text-xs font-medium pt-1 border-t">
            <span>Total Harga Jual</span>
            <span>{formatRupiah(itemPrices.reduce((s, i) => s + (Number(i.hargaJual) || 0), 0))}</span>
          </div>
        )}
      </div>

      {/* ── Antrian requests ── */}
      {entry.requests.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-xs font-medium text-muted-foreground">Antrian ({requestRows.length})</p>
          <AntrianRequestRows
            rows={requestRows}
            onChange={setRequestRows}
            showHargaModal={canViewFinancials}
          />
        </div>
      )}

      {/* ── Order-level fields ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {/* Sales */}
        {isAdmin && salesUsers.length > 0 && (
          <Field>
            <FieldLabel className="text-xs">Sales</FieldLabel>
            <Select
              value={form.salesId}
              onValueChange={(val) => update('salesId', val ?? form.salesId)}
            >
              <SelectTrigger className="h-8 text-sm">
                <SelectValue>
                  {salesUsers.find((s) => s.id === form.salesId)?.name ?? form.salesId}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {salesUsers.map((s) => (
                  <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        )}
        {/* Buyer */}
        <Field>
          <FieldLabel className="text-xs">Nama Pembeli</FieldLabel>
          <Input value={form.buyerName} onChange={(e) => update('buyerName', e.target.value)} className="h-8 text-sm" />
        </Field>
        <Field>
          <FieldLabel className={`text-xs${!isAdmin && !form.buyerPhone ? ' text-destructive font-semibold' : ''}`}>Telepon</FieldLabel>
          <Input value={form.buyerPhone} onChange={(e) => update('buyerPhone', e.target.value)} className={`h-8 text-sm${!isAdmin && !form.buyerPhone ? ' border-destructive/60 ring-1 ring-destructive/20' : ''}`} />
        </Field>
        <Field>
          <FieldLabel className={`text-xs${!isAdmin && !form.buyerAddress ? ' text-destructive font-semibold' : ''}`}>Alamat</FieldLabel>
          <Input value={form.buyerAddress} onChange={(e) => update('buyerAddress', e.target.value)} className={`h-8 text-sm${!isAdmin && !form.buyerAddress ? ' border-destructive/60 ring-1 ring-destructive/20' : ''}`} />
        </Field>
        <Field>
          <FieldLabel className={`text-xs${!isAdmin && !form.buyerMaps ? ' text-destructive font-semibold' : ''}`}>Google Maps</FieldLabel>
          <Input value={form.buyerMaps} onChange={(e) => update('buyerMaps', e.target.value)} className={`h-8 text-sm${!isAdmin && !form.buyerMaps ? ' border-destructive/60 ring-1 ring-destructive/20' : ''}`} />
        </Field>

        {/* Pengiriman */}
        <Field>
          <FieldLabel className={`text-xs${!isAdmin && !form.pengiriman ? ' text-destructive font-semibold' : ''}`}>Pengiriman</FieldLabel>
          <Select
            value={form.pengiriman || '__none__'}
            onValueChange={(val) => update('pengiriman', !val || val === '__none__' ? '' : val)}
          >
            <SelectTrigger className={`h-8 text-sm${!isAdmin && !form.pengiriman ? ' border-destructive/60 ring-1 ring-destructive/20' : ''}`}>
              <SelectValue>
                {form.pengiriman ? (PENGIRIMAN_LABEL[form.pengiriman] ?? form.pengiriman) : '— Tidak ada —'}
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
        </Field>

        {/* DP field */}
        {form.paymentStatus === 'DP' && (
          <Field>
            <FieldLabel className="text-xs">Jumlah DP</FieldLabel>
            <RupiahInput value={form.dp} onValueChange={(v) => update('dp', v)} className="h-8 text-sm" />
          </Field>
        )}
        {isAdmin && (
          <Field>
            <FieldLabel className="text-xs">Sudah Dikirim</FieldLabel>
            <div className="pt-1">
              <Switch checked={form.isSent} onCheckedChange={(val) => update('isSent', val)} />
            </div>
          </Field>
        )}

        {/* Payment + Bukti */}
        <div className="col-span-2 md:col-span-4">
          <div className="flex flex-wrap items-end gap-4">
            <Field className="w-[180px]">
              <FieldLabel className="text-xs">Pembayaran</FieldLabel>
              <Select
                value={form.paymentStatus}
                onValueChange={(val) => update('paymentStatus', val ?? form.paymentStatus)}
              >
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue>{PAYMENT_LABEL[form.paymentStatus] ?? form.paymentStatus}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="BELUM_BAYAR">Belum Bayar</SelectItem>
                  <SelectItem value="DP">DP</SelectItem>
                  <SelectItem value="LUNAS">Lunas</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field className="flex-1 min-w-[200px]">
              <FieldLabel className="text-xs">Bukti Transfer</FieldLabel>
              <BuktiTransferUpload
                key={entry.id + '-bukti'}
                initialUrls={entry.buktiTransfer ?? []}
                onChange={setBuktiTransferUrls}
              />
            </Field>
          </div>
        </div>

        {/* Notes */}
        <Field className="col-span-2 md:col-span-4">
          <FieldLabel className="text-xs">Catatan</FieldLabel>
          <Textarea value={form.notes} onChange={(e) => update('notes', e.target.value)} rows={2} className="text-sm" />
        </Field>
      </div>
    </div>
  );
}

const EntryRow = memo(function EntryRow({
  entry,
  isAdmin,
  canViewFinancials,
  isEditing,
  onEdit,
  onCancel,
  onSaved,
  salesUsers,
}: {
  entry: EntryData;
  isAdmin: boolean;
  canViewFinancials: boolean;
  isEditing: boolean;
  onEdit: (id: string) => void;
  onCancel: () => void;
  onSaved: () => void;
  salesUsers: SalesUser[];
}) {
  const {
    form,
    update,
    loading,
    setBuktiTransferUrls,
    itemPrices,
    updateItemPrice,
    swapLivestock,
    resetSwap,
    requestRows,
    setRequestRows,
    isSalesOnApproved,
    isAdminOnApproved,
    pendingRequest,
    handleSave,
    handleApprove,
    handleReject,
    handleDelete,
    handleCancelDelete,
    handleApproveDelete,
    handleRejectDelete,
    handleApproveEdit,
    handleRejectEdit,
    handleCancelEdit,
  } = useEntryRow(entry, onSaved, isAdmin);

  const isMati = entry.items.some((i) => i.livestock.condition === 'MATI');
  const rowClass = isMati
    ? 'bg-zinc-300 text-zinc-800 hover:bg-zinc-400/70 dark:bg-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-600'
    : isEditing
      ? 'bg-muted/30'
      : '';

  return (
    <>
      {/* Main row */}
      <tr className={`border-b last:border-0 transition-colors ${rowClass}`}>
        <td className="p-3 font-mono text-xs">{entry.invoiceNo}</td>
        <td className="p-3">
          <div className="flex flex-col gap-1">
            {entry.items.map((item) => {
              const lv = item.livestock;
              const wLabel = lv.type === 'SAPI' ? formatWeight(lv.weightMin, lv.weightMax) : null;
              return (
                <div key={lv.id} className="flex items-center gap-1.5 text-xs">
                  <LivestockPhotoLink
                    photoUrl={lv.photoUrl}
                    alt={`${lv.type} ${lv.grade ?? ''} - ${lv.sku}`}
                  >
                    <span className="font-medium">{lv.tag ?? lv.sku}</span>
                  </LivestockPhotoLink>
                  <span className="text-muted-foreground">
                    {lv.type}{lv.grade ? ' ' + lv.grade : ''}{wLabel ? ' · ' + wLabel : ''}
                  </span>
                </div>
              );
            })}
            {entry.requests.map((req) => {
              const wLabel = req.type === 'SAPI' ? formatWeight(req.weightMin, req.weightMax) : null;
              return (
                <div key={req.id} className="flex items-center gap-1.5 text-xs text-muted-foreground italic">
                  <StatusToken intent="warning" size="sm">antrian</StatusToken>
                  <span>{req.type}{req.grade ? ' ' + req.grade : ''}{wLabel ? ' · ' + wLabel : ''}</span>
                </div>
              );
            })}
          </div>
        </td>
        <td className="p-3">
          {entry.buyerName}
          {entry.buyerPhone && (
            <div className="text-xs text-muted-foreground">
              {entry.buyerPhone}
            </div>
          )}
          <BuyerLocationIcons
            address={entry.buyerAddress}
            maps={entry.buyerMaps}
            className="mt-1"
          />
        </td>
        {isAdmin && <td className="p-3">{entry.sales.name}</td>}
        <td className="p-3 text-center">{formatRupiah(entry.hargaJual)}</td>
        {(!isAdmin || canViewFinancials) && (
          <td className="p-3 text-center">
            {entry.resellerCut ? formatRupiah(entry.resellerCut) : '-'}
          </td>
        )}
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
          <StatusCell
            status={entry.status}
            isSent={entry.isSent}
            delivery={entry.delivery}
          />
          {pendingRequest && (
            <span className="mt-1 inline-block text-[9px] font-medium text-warning-fg bg-warning-bg px-1.5 py-0.5 rounded-full">
              Perubahan Diajukan
            </span>
          )}
          {entry.deleteRequestedAt && (
            <span className="mt-1 inline-block text-[9px] font-medium text-destructive bg-destructive/10 px-1.5 py-0.5 rounded-full">
              Minta Hapus
            </span>
          )}
          {!isAdmin && entry.status !== 'REJECTED' && (!entry.buyerPhone || !entry.buyerAddress?.trim() || !entry.buyerMaps?.trim() || !entry.pengiriman) && (
            <span className="mt-1 inline-block text-[9px] font-medium text-destructive bg-destructive/10 px-1.5 py-0.5 rounded-full">
              Data kurang
            </span>
          )}
        </td>
        <td className="p-3 text-xs text-muted-foreground whitespace-nowrap text-center">
          <div>{formatDateTime(new Date(entry.createdAt))}</div>
          {new Date(entry.updatedAt).getTime() - new Date(entry.createdAt).getTime() > 5000 && (
            <div className="text-[10px] text-muted-foreground/70 mt-0.5">{formatDateTime(new Date(entry.updatedAt))}</div>
          )}
        </td>
        <td className="p-3 text-center">
          <div className="flex items-center justify-center gap-1">
            {isEditing ? (
              <>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8 text-primary"
                  onClick={handleSave}
                  disabled={loading || (isAdmin && !!pendingRequest)}
                  title={isAdmin && pendingRequest ? 'Selesaikan permintaan perubahan dulu' : 'Simpan'}
                >
                  <Save className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8"
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
                      className="size-8 text-primary"
                      onClick={handleApprove}
                      title="Setujui"
                    >
                      <Check className="size-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8 text-destructive"
                      onClick={handleReject}
                      title="Tolak"
                    >
                      <X className="size-4" />
                    </Button>
                  </>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8"
                  onClick={() => onEdit(entry.id)}
                  title="Edit"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                {entry.status === 'APPROVED' &&
                  entry.buktiTransfer.length > 0 && (
                    <PdfMenu entryId={entry.id} />
                  )}
                {isAdmin && entry.deleteRequestedAt ? (
                  <>
                    <Button variant="ghost" size="icon" className="size-8 text-destructive" onClick={handleApproveDelete} title="Setujui Hapus">
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="size-8 text-muted-foreground" onClick={handleRejectDelete} title="Tolak Hapus">
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </>
                ) : !isAdmin && entry.deleteRequestedAt ? (
                  <Button variant="ghost" size="icon" className="size-8 text-warning-fg" onClick={handleCancelDelete} title="Batalkan permintaan hapus">
                    <Trash2 className="h-3.5 w-3.5 opacity-50" />
                  </Button>
                ) : (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8 text-destructive"
                    onClick={handleDelete}
                    title={isAdmin ? 'Hapus' : 'Minta Hapus'}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </>
            )}
          </div>
        </td>
      </tr>

      {/* Inline edit row */}
      {isEditing && (
        <tr className="border-b bg-muted/20">
          <td colSpan={isAdmin ? 12 : 8} className="p-4">
            <div className="flex flex-col gap-3">
              <EntryEditFields
                entry={entry}
                isAdmin={isAdmin}
                canViewFinancials={canViewFinancials}
                isSalesOnApproved={isSalesOnApproved}
                isAdminOnApproved={isAdminOnApproved}
                form={form}
                update={update}
                setBuktiTransferUrls={setBuktiTransferUrls}
                itemPrices={itemPrices}
                updateItemPrice={updateItemPrice}
                swapLivestock={swapLivestock}
                resetSwap={resetSwap}
                requestRows={requestRows}
                setRequestRows={setRequestRows}
                salesUsers={salesUsers}
              />
              {pendingRequest && (
                <PendingEditBanner
                  pendingRequest={pendingRequest}
                  isAdmin={isAdmin}
                  entry={entry}
                  onApprove={handleApproveEdit}
                  onReject={handleRejectEdit}
                  onCancel={handleCancelEdit}
                  loading={loading}
                />
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
});

const MobileEntryCard = memo(function MobileEntryCard({
  entry,
  isAdmin,
  canViewFinancials,
  isEditing,
  onEdit,
  onCancel,
  onSaved,
  salesUsers,
}: {
  entry: EntryData;
  isAdmin: boolean;
  canViewFinancials: boolean;
  isEditing: boolean;
  onEdit: (id: string) => void;
  onCancel: () => void;
  onSaved: () => void;
  salesUsers: SalesUser[];
}) {
  const [expanded, setExpanded] = useState(false);
  const {
    form,
    update,
    loading,
    setBuktiTransferUrls,
    itemPrices,
    updateItemPrice,
    swapLivestock,
    resetSwap,
    requestRows,
    setRequestRows,
    isSalesOnApproved,
    isAdminOnApproved,
    pendingRequest,
    handleSave,
    handleApprove,
    handleReject,
    handleDelete,
    handleCancelDelete,
    handleApproveDelete,
    handleRejectDelete,
    handleApproveEdit,
    handleRejectEdit,
    handleCancelEdit,
  } = useEntryRow(entry, onSaved, isAdmin);

  const open = expanded || isEditing;
  const isMati = entry.items.some((i) => i.livestock.condition === 'MATI');
  const cardClass = isMati
    ? 'bg-zinc-300 text-zinc-800 dark:bg-zinc-700 dark:text-zinc-200'
    : 'bg-card';

  const firstLv = entry.items[0]?.livestock;
  const firstWeight = firstLv?.type === 'SAPI' ? formatWeight(firstLv.weightMin, firstLv.weightMax) : null;
  const livestockSummary = firstLv
    ? [firstLv.type, firstLv.grade, firstWeight].filter(Boolean).join(' · ') +
      (entry.items.length > 1 ? ` +${entry.items.length - 1}` : '')
    : entry.requests.length > 0
    ? `${entry.requests.length} antrian`
    : '—';

  return (
    <div className={`rounded-lg border shadow-sm overflow-hidden ${cardClass}`}>
      {/* Header */}
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
        {/* Photo thumbnail or count badge */}
        {entry.items.length > 1 ? (
          <div className="shrink-0 size-10 rounded-md border bg-muted flex items-center justify-center">
            <span className="text-sm font-bold text-muted-foreground">{entry.items.length}</span>
          </div>
        ) : firstLv?.photoUrl ? (
          <PhotoThumb photoUrl={firstLv.photoUrl} alt={`${firstLv.type} ${firstLv.grade ?? ''}`} />
        ) : null}
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium truncate">{entry.buyerName}</div>
          <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1.5 flex-wrap">
            <span className="truncate">{livestockSummary}</span>
            <span className="inline-flex items-center px-1.5 py-0.5 rounded-full bg-muted text-[10px] font-medium whitespace-nowrap shrink-0">
              {entry.sales.name}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
          {pendingRequest && (
            <span className="text-[9px] font-medium text-warning-fg bg-warning-bg px-1.5 py-0.5 rounded-full">
              Perubahan Diajukan
            </span>
          )}
          {!isAdmin && entry.status !== 'REJECTED' && (!entry.buyerPhone || !entry.buyerAddress?.trim() || !entry.buyerMaps?.trim() || !entry.pengiriman) && (
            <span className="text-[9px] font-medium text-destructive bg-destructive/10 px-1.5 py-0.5 rounded-full">
              Data kurang
            </span>
          )}
          <StatusIcon status={entry.status} />
          <KirimIcon isSent={entry.isSent} />
          <DeliveryIcon delivery={entry.delivery} />
          <BuyerLocationIcons address={entry.buyerAddress} maps={entry.buyerMaps} />
        </div>
        <ChevronDown
          className={`size-4 text-muted-foreground shrink-0 transition-transform ${
            open ? 'rotate-180' : ''
          }`}
        />
      </div>

      {/* Expanded bands */}
      {open && (
        isEditing ? (
          <div className="p-3 flex flex-col gap-3 border-t">
            <EntryEditFields
              entry={entry}
              isAdmin={isAdmin}
              canViewFinancials={canViewFinancials}
              isSalesOnApproved={isSalesOnApproved}
              isAdminOnApproved={isAdminOnApproved}
              form={form}
              update={update}
              setBuktiTransferUrls={setBuktiTransferUrls}
              itemPrices={itemPrices}
              updateItemPrice={updateItemPrice}
              swapLivestock={swapLivestock}
              resetSwap={resetSwap}
              requestRows={requestRows}
              setRequestRows={setRequestRows}
              salesUsers={salesUsers}
            />
            {pendingRequest && (
              <PendingEditBanner
                pendingRequest={pendingRequest}
                isAdmin={isAdmin}
                entry={entry}
                onApprove={handleApproveEdit}
                onReject={handleRejectEdit}
                onCancel={handleCancelEdit}
                loading={loading}
              />
            )}
            <div className="flex gap-2 pt-2 border-t">
              <Button
                size="sm"
                className="flex-1"
                onClick={handleSave}
                disabled={loading || (isAdmin && !!pendingRequest)}
                title={isAdmin && pendingRequest ? 'Selesaikan permintaan perubahan dulu' : undefined}
              >
                <Save className="h-3.5 w-3.5 mr-1" />
                Simpan
              </Button>
              <Button size="sm" variant="outline" className="flex-1" onClick={onCancel} disabled={loading}>
                <XCircle className="h-3.5 w-3.5 mr-1" />
                Batal
              </Button>
            </div>
          </div>
        ) : (
          <div className="divide-y text-sm border-t">
            {/* Hewan + Pembeli */}
            <div className="grid grid-cols-2 gap-3 px-3 py-2.5">
              <div>
                <BandLabel>Hewan</BandLabel>
                {entry.items.map((item) => {
                  const lv = item.livestock;
                  const w = lv.type === 'SAPI' ? formatWeight(lv.weightMin, lv.weightMax) : null;
                  return (
                    <div key={lv.id} className="mt-1">
                      <LivestockPhotoLink photoUrl={lv.photoUrl} alt={`${lv.type} ${lv.grade ?? ''} - ${lv.sku}`}>
                        <span className="text-sm font-medium">{lv.tag ?? lv.sku}</span>
                      </LivestockPhotoLink>
                      <div className="text-xs text-muted-foreground">
                        {lv.type}{lv.grade ? ` ${lv.grade}` : ''}{w ? ` · ${w}` : ''}
                      </div>
                    </div>
                  );
                })}
                {entry.requests.map((req) => {
                  const w = req.type === 'SAPI' ? formatWeight(req.weightMin, req.weightMax) : null;
                  return (
                    <div key={req.id} className="mt-1 flex items-center gap-1 text-xs text-muted-foreground italic">
                      <StatusToken intent="warning" size="sm">antrian</StatusToken>
                      <span>{req.type}{req.grade ? ` ${req.grade}` : ''}{w ? ` · ${w}` : ''}</span>
                    </div>
                  );
                })}
              </div>
              <div>
                <BandLabel>Pembeli</BandLabel>
                <div className="mt-1 font-medium truncate">{entry.buyerName}</div>
                {entry.buyerPhone && (
                  <div className="text-xs text-muted-foreground">{entry.buyerPhone}</div>
                )}
                {entry.buyerAddress && (
                  <div className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{entry.buyerAddress}</div>
                )}
                <BuyerLocationIcons address={entry.buyerAddress} maps={entry.buyerMaps} className="mt-1" />
              </div>
            </div>

            {/* Sales + Harga Jual */}
            <div className={`grid gap-3 px-3 py-2.5 ${isAdmin ? 'grid-cols-2' : 'grid-cols-1'}`}>
              {isAdmin && (
                <div>
                  <BandLabel>Sales</BandLabel>
                  <div className="mt-1 font-medium">{entry.sales.name}</div>
                </div>
              )}
              <div>
                <BandLabel>Harga Jual</BandLabel>
                <div className="mt-1 font-semibold">{formatRupiah(entry.hargaJual)}</div>
              </div>
            </div>

            {/* Financial */}
            {((!isAdmin && entry.resellerCut != null) || canViewFinancials) && (
              <div className="flex gap-5 px-3 py-2.5 bg-muted/20">
                {(!isAdmin || canViewFinancials) && (
                  <FinCol
                    label={isAdmin ? 'Sales Cut' : 'Komisi'}
                    value={entry.resellerCut ? formatRupiah(entry.resellerCut) : '–'}
                  />
                )}
                {canViewFinancials && (
                  <>
                    <FinCol label="Modal" value={entry.hargaModal ? formatRupiah(entry.hargaModal) : '–'} />
                    <FinCol
                      label="Profit"
                      value={entry.profit ? formatRupiah(entry.profit) : '–'}
                      valueClass={entry.profit != null && entry.profit < 0 ? 'text-destructive' : undefined}
                    />
                  </>
                )}
              </div>
            )}

            {/* Pembayaran */}
            <div className="flex items-center justify-between px-3 py-2.5">
              <BandLabel>Pembayaran</BandLabel>
              <HoverBuktiTransfer buktiTransfer={entry.buktiTransfer} paymentStatus={entry.paymentStatus} />
            </div>

            {/* Catatan */}
            {entry.notes && (
              <div className="px-3 py-2.5 bg-muted/20">
                <BandLabel>Catatan</BandLabel>
                <p className="mt-1 text-xs text-muted-foreground whitespace-pre-wrap">{entry.notes}</p>
              </div>
            )}

            {/* Date + Pengiriman + Actions */}
            <div className="flex items-center justify-between px-3 py-2 bg-muted/20">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground min-w-0">
                <Calendar className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">
                  {new Date(entry.updatedAt).getTime() - new Date(entry.createdAt).getTime() > 5000
                    ? <>{formatDateTime(new Date(entry.updatedAt))} <span className="text-[10px]">(diperbarui)</span></>
                    : formatDateTime(new Date(entry.createdAt))}
                </span>
                {entry.pengiriman && (
                  <span className="shrink-0 bg-muted text-muted-foreground text-[10px] font-medium px-1.5 py-0.5 rounded">
                    {formatPengiriman(entry.pengiriman)}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {isAdmin && entry.status === 'PENDING' && (
                  <>
                    <Button variant="ghost" size="icon" className="size-8 text-primary" onClick={handleApprove} title="Setujui">
                      <Check className="size-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="size-8 text-destructive" onClick={handleReject} title="Tolak">
                      <X className="size-4" />
                    </Button>
                  </>
                )}
                {entry.status === 'APPROVED' && entry.buktiTransfer.length > 0 && (
                  <PdfMenu entryId={entry.id} />
                )}
                <Button variant="ghost" size="icon" className="size-8" onClick={() => onEdit(entry.id)} title="Edit">
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                {isAdmin && entry.deleteRequestedAt ? (
                  <>
                    <Button variant="ghost" size="icon" className="size-8 text-destructive" onClick={handleApproveDelete} title="Setujui Hapus">
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="size-8 text-muted-foreground" onClick={handleRejectDelete} title="Tolak Hapus">
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </>
                ) : !isAdmin && entry.deleteRequestedAt ? (
                  <Button variant="ghost" size="icon" className="size-8 text-warning-fg" onClick={handleCancelDelete} title="Batalkan permintaan hapus">
                    <Trash2 className="h-3.5 w-3.5 opacity-50" />
                  </Button>
                ) : (
                  <Button variant="ghost" size="icon" className="size-8 text-destructive" onClick={handleDelete} title={isAdmin ? 'Hapus' : 'Minta Hapus'}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            </div>
          </div>
        )
      )}
    </div>
  );
});

function PhotoThumb({ photoUrl, alt }: { photoUrl: string; alt: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setOpen(true); }}
        className="shrink-0 size-10 rounded-md overflow-hidden border bg-muted cursor-zoom-in hover:opacity-90 transition-opacity"
        title="Lihat foto"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={toThumbnailUrl(photoUrl)}
          alt={alt}
          width={40}
          height={40}
          loading="lazy"
          decoding="async"
          className="size-10 object-cover"
        />
      </button>
      <Lightbox src={photoUrl} alt={alt} open={open} onClose={() => setOpen(false)} />
    </>
  );
}

function BandLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
      {children}
    </span>
  );
}

function FinCol({
  label,
  value,
  valueClass,
}: {
  label: string;
  value: React.ReactNode;
  valueClass?: string;
}) {
  return (
    <div>
      <BandLabel>{label}</BandLabel>
      <div className={`mt-0.5 text-sm ${valueClass ?? ''}`}>{value}</div>
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
        className={`size-4 ${
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
  const iconClass = `size-4 ${
    assigned ? 'text-warning-fg' : 'text-muted-foreground/40'
  }`;
  return (
    <IconTooltip label={label}>
      <Route className={iconClass} />
    </IconTooltip>
  );
}

function StatusCell({
  status,
  isSent,
  delivery,
}: {
  status: string;
  isSent: boolean;
  delivery: { status: string; driverName: string | null } | null;
}) {
  return (
    <div className="flex flex-col items-center gap-0.5">
      <div className="flex items-center gap-1.5">
        <StatusIcon status={status} />
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

function BuyerLocationIcons({
  address,
  maps,
  className = '',
}: {
  address: string | null;
  maps: string | null;
  className?: string;
}) {
  return (
    <div className={`flex items-center gap-1.5 ${className}`}>
      <IconTooltip label={address ? `Alamat: ${address}` : 'Alamat belum diisi'}>
        <MapPin
          className={`h-3.5 w-3.5 ${
            address ? 'text-primary' : 'text-muted-foreground/30'
          }`}
        />
      </IconTooltip>
      {maps ? (
        <a
          href={maps}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="inline-flex hover:opacity-70"
        >
          <IconTooltip label="Buka di Google Maps">
            <Map className="h-3.5 w-3.5 text-primary" />
          </IconTooltip>
        </a>
      ) : (
        <IconTooltip label="Maps belum diisi">
          <Map className="h-3.5 w-3.5 text-muted-foreground/30" />
        </IconTooltip>
      )}
    </div>
  );
}

function StatusIcon({ status }: { status: string }) {
  const { Icon, label, className } =
    status === 'APPROVED'
      ? { Icon: CheckCircle2, label: 'Disetujui', className: 'text-primary' }
      : status === 'PENDING'
        ? { Icon: Clock, label: 'Menunggu', className: 'text-warning-fg' }
        : { Icon: XCircle, label: 'Ditolak', className: 'text-destructive' };
  return (
    <IconTooltip label={label}>
      <Icon className={`size-4 ${className}`} />
    </IconTooltip>
  );
}

/**
 * BuktiPreviewItem — Single row in the payment status hover popover.
 * Shows a thumbnail + label. Clicking opens a fullscreen lightbox.
 */
function BuktiPreviewItem({ url, label }: { url: string; label: string }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 w-full rounded hover:bg-muted px-1 py-1 transition-colors text-left"
      >
        <div className="relative size-8 rounded overflow-hidden flex-shrink-0 bg-muted">
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
      <Lightbox src={url} alt={label} open={open} onClose={() => setOpen(false)} />
    </>
  );
}
