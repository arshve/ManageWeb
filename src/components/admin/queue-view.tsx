'use client';

import { useState, useMemo, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { StatusToken, QUEUE_STATUS } from '@/components/ui/status-token';
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
import { Field, FieldLabel } from '@/components/ui/field';
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
import {
  AntrianRequestRows,
  type RequestRow,
  rowsToJson,
} from '@/components/dashboard/antrian-request-rows';
import { fulfillEntryRequest, updateEntryRequests, updateEntry } from '@/app/actions/entries';
import { formatRupiah, formatWeight } from '@/lib/format';
import { toast } from 'sonner';
import {
  CheckCircle2,
  Clock,
  Package,
  Search,
  Pencil,
  ChevronDown,
  Save,
  XCircle,
} from 'lucide-react';

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
    salesId: string | null;
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

type EntryGroup = {
  entryId: string;
  entry: QueueRequest['entry'];
  requests: QueueRequest[];
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
  const ds = QUEUE_STATUS[status] ?? { intent: 'neutral' as const, label: status };
  return <StatusToken intent={ds.intent} size="sm">{ds.label}</StatusToken>;
}

function requestToRow(req: QueueRequest): RequestRow {
  return {
    _id: req.id,
    type: req.type,
    grade: req.grade ?? 'A',
    weightMin: req.weightMin?.toString() ?? '',
    weightMax: req.weightMax?.toString() ?? '',
    hargaJual: req.hargaJual.toString(),
    hargaModal: req.hargaModal?.toString() ?? '',
    resellerCut: req.resellerCut?.toString() ?? '',
    notes: req.notes ?? '',
  };
}

// ─── Mobile card per entry ────────────────────────────────────────────────────

function QueueEntryCard({
  group,
  canEdit,
  canViewFinancials,
  onFulfill,
}: {
  group: EntryGroup;
  canEdit: boolean;
  canViewFinancials: boolean;
  onFulfill: (req: QueueRequest) => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const [editing, setEditing] = useState(false);
  const [rows, setRows] = useState<RequestRow[]>([]);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const hasUnfulfilled = group.requests.some((r) => !r.isFulfilled);
  const allFulfilled = group.requests.every((r) => r.isFulfilled);
  const open = expanded || editing;

  function startEdit() {
    setRows(group.requests.filter((r) => !r.isFulfilled).map(requestToRow));
    setEditing(true);
    setExpanded(true);
  }

  function cancelEdit() {
    setEditing(false);
    setRows([]);
  }

  function handleSave() {
    startTransition(async () => {
      const result = await updateEntryRequests(group.entry.id, rowsToJson(rows));
      if ('error' in result) {
        toast.error(result.error);
      } else {
        toast.success('Antrian berhasil diperbarui');
        setEditing(false);
        router.refresh();
      }
    });
  }

  return (
    <div className={`rounded-lg border shadow-sm overflow-hidden ${allFulfilled ? 'bg-success-bg/40' : 'bg-card'}`}>
      {/* Header */}
      <div
        role="button"
        tabIndex={0}
        onClick={() => !editing && setExpanded((v) => !v)}
        onKeyDown={(e) => {
          if (!editing && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault();
            setExpanded((v) => !v);
          }
        }}
        className="w-full flex items-center gap-2 p-3 text-left hover:bg-muted/30 transition-colors cursor-pointer"
      >
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium truncate">{group.entry.buyerName}</div>
          <div className="text-xs text-muted-foreground truncate mt-0.5">
            {group.entry.invoiceNo}
            {group.entry.salesName ? ` · ${group.entry.salesName}` : ''}
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <StatusBadge status={group.entry.status} />
          <span className="text-xs text-muted-foreground flex items-center gap-0.5">
            <Clock className="size-3" />
            {relativeTime(group.requests[0].createdAt)}
          </span>
          {canEdit && hasUnfulfilled && !editing && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); startEdit(); }}
              className="p-1 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
              title="Edit antrian"
            >
              <Pencil className="size-3.5" />
            </button>
          )}
        </div>
        <ChevronDown
          className={`size-4 text-muted-foreground shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </div>

      {/* Body */}
      {open && (
        <div className="border-t">
          {editing ? (
            <div className="p-3 flex flex-col gap-3">
              <AntrianRequestRows
                rows={rows}
                onChange={setRows}
                showHargaModal={canViewFinancials}
              />
              <div className="flex gap-2 pt-2 border-t">
                <Button size="sm" className="flex-1" onClick={handleSave} disabled={pending}>
                  <Save className="size-3.5 mr-1" />
                  {pending ? 'Menyimpan...' : 'Simpan'}
                </Button>
                <Button size="sm" variant="outline" className="flex-1" onClick={cancelEdit} disabled={pending}>
                  <XCircle className="size-3.5 mr-1" />
                  Batal
                </Button>
              </div>
            </div>
          ) : (
            <div className="divide-y text-sm">
              {group.requests.map((req, idx) => (
                <div
                  key={req.id}
                  className={`px-3 py-2.5 flex items-center gap-3 ${req.isFulfilled ? 'bg-success-bg/30' : ''}`}
                >
                  <div className="flex-1 min-w-0 flex flex-col gap-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-xs text-muted-foreground">{idx + 1}.</span>
                      <Badge variant="secondary" className="text-xs">{TYPE_LABEL[req.type]}</Badge>
                      <Badge variant="outline" className="text-xs">{detailLabel(req)}</Badge>
                      {req.isFulfilled && (
                        <span className="inline-flex items-center gap-1 text-xs text-success-fg font-medium">
                          <CheckCircle2 className="size-3.5" />
                          Selesai
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-xs">
                      <span className="font-medium">{formatRupiah(req.hargaJual)}</span>
                      {req.notes && (
                        <span className="text-muted-foreground italic truncate">{req.notes}</span>
                      )}
                    </div>
                  </div>
                  {!req.isFulfilled && (
                    <Button size="sm" onClick={() => onFulfill(req)}>
                      Fulfill
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main view ────────────────────────────────────────────────────────────────

export function QueueView({
  requests,
  availableLivestock,
  canViewFinancials,
  currentUserId,
  isAdmin,
}: {
  requests: QueueRequest[];
  availableLivestock: AvailableLivestock[];
  canViewFinancials: boolean;
  currentUserId: string;
  isAdmin: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  // Fulfill dialog
  const [fulfillTarget, setFulfillTarget] = useState<QueueRequest | null>(null);
  const [pickedId, setPickedId] = useState<string | null>(null);
  const [hargaModal, setHargaModal] = useState('');
  const [resellerCut, setResellerCut] = useState('');

  // Desktop edit dialog
  const [editGroup, setEditGroup] = useState<EntryGroup | null>(null);
  const [editRows, setEditRows] = useState<RequestRow[]>([]);
  const [editBuyerName, setEditBuyerName] = useState('');
  const [editPending, startEditTransition] = useTransition();

  // Filters
  const [search, setSearch] = useState('');
  const [jenisFilter, setJenisFilter] = useState('ALL');
  const [gradeFilter, setGradeFilter] = useState('ALL');
  const [weightMinFilter, setWeightMinFilter] = useState('');
  const [weightMaxFilter, setWeightMaxFilter] = useState('');
  const [page, setPage] = useState(0);

  const PAGE_SIZE = 10;

  function handleJenisChange(v: string) {
    setJenisFilter(v);
    setGradeFilter('ALL');
    setWeightMinFilter('');
    setWeightMaxFilter('');
    setPage(0);
  }

  // Group-first: group all requests, then filter groups
  const grouped = useMemo(() => {
    const map = new Map<string, EntryGroup>();
    for (const r of requests) {
      if (!map.has(r.entryId)) {
        map.set(r.entryId, { entryId: r.entryId, entry: r.entry, requests: [] });
      }
      map.get(r.entryId)!.requests.push(r);
    }
    return [...map.values()];
  }, [requests]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return grouped.filter((g) => {
      if (q && !g.entry.buyerName.toLowerCase().includes(q) && !(g.entry.salesName?.toLowerCase().includes(q) ?? false)) return false;
      if (jenisFilter !== 'ALL') {
        const hasType = g.requests.some((r) => !r.isFulfilled && r.type === jenisFilter);
        if (!hasType) return false;
      }
      if (jenisFilter !== 'ALL' && jenisFilter !== 'SAPI' && gradeFilter !== 'ALL') {
        const hasGrade = g.requests.some((r) => !r.isFulfilled && r.type === jenisFilter && r.grade === gradeFilter);
        if (!hasGrade) return false;
      }
      if (jenisFilter === 'SAPI') {
        const wMin = weightMinFilter ? Number(weightMinFilter) : null;
        const wMax = weightMaxFilter ? Number(weightMaxFilter) : null;
        if (wMin !== null || wMax !== null) {
          const hasWeight = g.requests.some((r) => {
            if (r.isFulfilled || r.type !== 'SAPI') return false;
            if (wMin !== null && (r.weightMin ?? 0) < wMin) return false;
            if (wMax !== null && (r.weightMax ?? Infinity) > wMax) return false;
            return true;
          });
          if (!hasWeight) return false;
        }
      }
      return true;
    });
  }, [grouped, search, jenisFilter, gradeFilter, weightMinFilter, weightMaxFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);
  const pagedGroups = filtered.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE);

  const pickerLivestock: PickerLivestock[] = useMemo(
    () => availableLivestock.map((l) => ({ ...l, hargaJual: l.hargaJual })),
    [availableLivestock],
  );

  function canEditEntry(entry: QueueRequest['entry']) {
    return isAdmin || currentUserId === entry.salesId;
  }

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

  function openEditDesktop(group: EntryGroup) {
    setEditRows(group.requests.filter((r) => !r.isFulfilled).map(requestToRow));
    setEditBuyerName(group.entry.buyerName);
    setEditGroup(group);
  }

  function handleEditSave() {
    if (!editGroup) return;
    startEditTransition(async () => {
      const fd = new FormData();
      fd.set('buyerName', editBuyerName);
      const [entryResult, reqResult] = await Promise.all([
        updateEntry(editGroup.entry.id, fd),
        updateEntryRequests(editGroup.entry.id, rowsToJson(editRows)),
      ]);
      if ('error' in entryResult) { toast.error(entryResult.error); return; }
      if ('error' in reqResult) { toast.error(reqResult.error); return; }
      toast.success('Antrian berhasil diperbarui');
      setEditGroup(null);
      router.refresh();
    });
  }

  if (requests.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-16 text-center border rounded-xl bg-muted/20 border-dashed">
        <div className="size-16 bg-muted rounded-full flex items-center justify-center mb-4">
          <Package className="size-8 text-muted-foreground/50" />
        </div>
        <h3 className="font-semibold text-lg">Tidak Ada Antrian</h3>
        <p className="text-sm text-muted-foreground mt-1">Semua permintaan sudah terpenuhi.</p>
      </div>
    );
  }

  return (
    <>
      {/* Filter bar */}
      <div className="flex flex-col gap-2 mb-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder="Cari nama pembeli atau sales..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0); }}
            className="pl-9"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <Select value={jenisFilter} onValueChange={(v) => v && handleJenisChange(v)}>
            <SelectTrigger className="w-36">
              <SelectValue placeholder="Semua Jenis" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Semua Jenis</SelectItem>
              <SelectItem value="KAMBING">Kambing</SelectItem>
              <SelectItem value="DOMBA">Domba</SelectItem>
              <SelectItem value="SAPI">Sapi</SelectItem>
            </SelectContent>
          </Select>
          {(jenisFilter === 'KAMBING' || jenisFilter === 'DOMBA') && (
            <Select value={gradeFilter} onValueChange={(v) => { if (v) { setGradeFilter(v); setPage(0); } }}>
              <SelectTrigger className="w-32">
                <SelectValue placeholder="Semua Grade" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Semua Grade</SelectItem>
                {(['SUPER', 'A', 'B', 'C', 'D'] as const).map((g) => (
                  <SelectItem key={g} value={g}>{g}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {jenisFilter === 'SAPI' && (
            <>
              <div className="flex items-center gap-1">
                <Input
                  type="number"
                  placeholder="Min kg"
                  value={weightMinFilter}
                  onChange={(e) => { setWeightMinFilter(e.target.value); setPage(0); }}
                  className="w-24 h-9 text-sm"
                />
                <span className="text-muted-foreground text-sm">–</span>
                <Input
                  type="number"
                  placeholder="Max kg"
                  value={weightMaxFilter}
                  onChange={(e) => { setWeightMaxFilter(e.target.value); setPage(0); }}
                  className="w-24 h-9 text-sm"
                />
              </div>
            </>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          {filtered.length === grouped.length
            ? `${grouped.length} antrian`
            : `${filtered.length} dari ${grouped.length} antrian`}
        </p>
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
              <tbody>
                {pagedGroups.map((group, gi) => (
                  <>
                    {/* Entry group header */}
                    <tr
                      key={`hdr-${group.entryId}`}
                      className={`border-t ${gi === 0 ? 'border-t-0' : ''} bg-muted/30`}
                    >
                      <td className="px-4 py-2 font-mono text-xs text-muted-foreground">
                        {group.entry.invoiceNo}
                      </td>
                      <td className="px-4 py-2 font-semibold text-sm">{group.entry.buyerName}</td>
                      <td className="px-4 py-2 text-xs text-muted-foreground">{group.entry.salesName ?? '-'}</td>
                      <td colSpan={3} />
                      <td className="px-4 py-2">
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Clock className="size-3" />
                          {relativeTime(group.requests[0].createdAt)}
                        </span>
                      </td>
                      <td className="px-4 py-2">
                        <StatusBadge status={group.entry.status} />
                      </td>
                      <td className="px-4 py-2 text-right">
                        {canEditEntry(group.entry) && group.requests.some((r) => !r.isFulfilled) && (
                          <button
                            type="button"
                            onClick={() => openEditDesktop(group)}
                            className="p-1 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                            title="Edit antrian"
                          >
                            <Pencil className="size-3.5" />
                          </button>
                        )}
                      </td>
                    </tr>
                    {/* Request sub-rows */}
                    {group.requests.map((req) => (
                      <tr
                        key={req.id}
                        className={`border-t border-border/50 transition-colors ${req.isFulfilled ? 'bg-success-bg/30 text-muted-foreground' : 'hover:bg-muted/20'}`}
                      >
                        <td colSpan={3} />
                        <td className="px-4 py-2.5 pl-8">{TYPE_LABEL[req.type]}</td>
                        <td className="px-4 py-2.5">{detailLabel(req)}</td>
                        <td className="px-4 py-2.5 font-medium">{formatRupiah(req.hargaJual)}</td>
                        <td colSpan={2} />
                        <td className="px-4 py-2.5 text-right">
                          {req.isFulfilled ? (
                            <span className="inline-flex items-center gap-1 text-xs text-success-fg font-medium">
                              <CheckCircle2 className="size-4" />
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
                  </>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile: grouped collapsible cards */}
          <div className="md:hidden flex flex-col gap-3">
            {pagedGroups.map((group) => (
              <QueueEntryCard
                key={group.entryId}
                group={group}
                canEdit={canEditEntry(group.entry)}
                canViewFinancials={canViewFinancials}
                onFulfill={openFulfill}
              />
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-4">
              <button
                type="button"
                disabled={safePage === 0}
                onClick={() => setPage(safePage - 1)}
                className="px-3 py-1.5 text-sm rounded border disabled:opacity-30 hover:bg-muted"
              >
                ←
              </button>
              <span className="text-sm text-muted-foreground">
                {safePage + 1} / {totalPages}
              </span>
              <button
                type="button"
                disabled={safePage >= totalPages - 1}
                onClick={() => setPage(safePage + 1)}
                className="px-3 py-1.5 text-sm rounded border disabled:opacity-30 hover:bg-muted"
              >
                →
              </button>
            </div>
          )}
        </>
      )}

      {/* Fulfill Dialog */}
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
            <div className="flex flex-col gap-4">
              <div className="rounded-lg border bg-muted/30 p-3 text-sm flex flex-col gap-1">
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
                {pickerLivestock.filter((l) => l.type === fulfillTarget.type).length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-6 border rounded-lg">
                    Tidak ada stok {TYPE_LABEL[fulfillTarget.type]} tersedia saat ini.
                  </p>
                ) : (
                  <LivestockPicker
                    livestock={pickerLivestock}
                    selectedIds={pickedId ? [pickedId] : []}
                    onToggle={handleToggle}
                    initialType={fulfillTarget.type}
                    initialGrade={fulfillTarget.grade ?? 'ALL'}
                  />
                )}
              </div>

              <div className={`grid gap-3 pt-2 border-t ${canViewFinancials ? 'grid-cols-2' : 'grid-cols-1'}`}>
                {canViewFinancials && (
                  <Field>
                    <FieldLabel className="text-xs">Harga Modal</FieldLabel>
                    <RupiahInput
                      value={hargaModal}
                      onValueChange={setHargaModal}
                      placeholder={
                        availableLivestock.find((l) => l.id === pickedId)?.hargaModal?.toString() ??
                        '0'
                      }
                      className="h-9 text-sm"
                    />
                  </Field>
                )}
                <Field>
                  <FieldLabel className="text-xs">Komisi Sales</FieldLabel>
                  <RupiahInput
                    value={resellerCut}
                    onValueChange={setResellerCut}
                    placeholder={fulfillTarget.resellerCut?.toString() ?? '0'}
                    className="h-9 text-sm"
                  />
                </Field>
                {canViewFinancials && pickedId && hargaModal && (
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
            <Button variant="outline" onClick={() => setFulfillTarget(null)} disabled={pending}>
              Batal
            </Button>
            <Button onClick={handleConfirm} disabled={!pickedId || pending}>
              {pending ? 'Menyimpan...' : 'Konfirmasi Fulfillment'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Desktop Edit Dialog */}
      <Dialog open={!!editGroup} onOpenChange={(open) => !open && setEditGroup(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Edit Antrian — {editGroup?.entry.buyerName}
            </DialogTitle>
          </DialogHeader>

          {editGroup && (
            <div className="flex flex-col gap-4">
              <p className="text-xs text-muted-foreground">
                {editGroup.entry.invoiceNo} · {editGroup.requests.filter((r) => !r.isFulfilled).length} permintaan belum terpenuhi
              </p>
              <Field>
                <FieldLabel className="text-xs">Nama Pembeli</FieldLabel>
                <Input
                  value={editBuyerName}
                  onChange={(e) => setEditBuyerName(e.target.value)}
                  className="h-9 text-sm"
                />
              </Field>
              <AntrianRequestRows
                rows={editRows}
                onChange={setEditRows}
                showHargaModal={canViewFinancials}
              />
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditGroup(null)} disabled={editPending}>
              Batal
            </Button>
            <Button onClick={handleEditSave} disabled={editPending}>
              {editPending ? 'Menyimpan...' : 'Simpan'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
