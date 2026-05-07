'use client';

import { useState, useMemo, useEffect } from 'react';
import { Pagination } from '@/components/ui/pagination';
import {
  ChevronDown,
  HeartPulse,
  Thermometer,
  Skull,
  CircleCheck,
  ShoppingBag,
  Search,
  X,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { LivestockPhoto } from '@/components/dashboard/livestock-photo';
import { LivestockActions } from '@/components/dashboard/livestock-actions';
import type { PricingMap } from '@/components/dashboard/livestock-form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { formatRupiah, formatWeight } from '@/lib/format';

export interface LivestockItem {
  id: string;
  sku: string;
  type: string;
  grade: string | null;
  condition: string;
  weightMin: number | null;
  weightMax: number | null;
  hargaJual: number | null;
  hargaModal: number | null;
  tag: string | null;
  photoUrl: string | null;
  notes: string | null;
  isSold: boolean;
  buyerName: string | null;
  salesName: string | null;
  driverName: string | null;
  deliveryStatus: string | null;
}

function ConditionIcon({ condition }: { condition: string }) {
  if (condition === 'SEHAT') {
    return (
      <span title="Sehat" className="inline-flex text-green-600">
        <HeartPulse className="h-4 w-4" />
      </span>
    );
  }
  if (condition === 'SAKIT') {
    return (
      <span title="Sakit" className="inline-flex">
        <Thermometer className="h-4 w-4" />
      </span>
    );
  }
  return (
    <span title="Mati" className="inline-flex">
      <Skull className="h-4 w-4" />
    </span>
  );
}

function StatusIcon({ isSold }: { isSold: boolean }) {
  if (isSold) {
    return (
      <span title="Terjual" className="inline-flex text-yellow-600">
        <ShoppingBag className="h-4 w-4" />
      </span>
    );
  }
  return (
    <span title="Tersedia" className="inline-flex text-green-600">
      <CircleCheck className="h-4 w-4" />
    </span>
  );
}

export function LivestockTableClient({
  livestock,
  pricingTemplate,
  readOnly = false,
  canViewFinancials = false,
}: {
  livestock: LivestockItem[];
  pricingTemplate?: PricingMap;
  readOnly?: boolean;
  canViewFinancials?: boolean;
}) {
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [conditionFilter, setConditionFilter] = useState('ALL');
  const [gradeFilter, setGradeFilter] = useState('ALL');
  const [weightFilter, setWeightFilter] = useState('ALL');
  const [tagFilter, setTagFilter] = useState('ALL');
  const [sortOrder, setSortOrder] = useState<'newest' | 'sku_asc' | 'sku_desc' | 'harga_asc' | 'harga_desc'>('newest');
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 25;

  useEffect(() => { setPage(1); }, [search, typeFilter, statusFilter, conditionFilter, gradeFilter, weightFilter, tagFilter]);

  const typeFiltered = useMemo(() => {
    return typeFilter !== 'ALL' ? livestock.filter((l) => l.type === typeFilter) : livestock;
  }, [livestock, typeFilter]);

  const gradeOptions = useMemo(() => {
    const set = new Set<string>();
    typeFiltered.forEach((l) => { if (l.grade) set.add(l.grade); });
    return Array.from(set).sort();
  }, [typeFiltered]);

  const WEIGHT_BUCKET = 50;
  const weightBuckets = useMemo(() => {
    const buckets = new Set<number>();
    typeFiltered.forEach((l) => {
      const w = l.weightMin ?? l.weightMax;
      if (w != null) buckets.add(Math.floor(w / WEIGHT_BUCKET) * WEIGHT_BUCKET);
    });
    return Array.from(buckets).sort((a, b) => a - b);
  }, [typeFiltered]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let result = livestock.filter((item) => {
      if (q && !item.sku.toLowerCase().includes(q) && !(item.tag?.toLowerCase().includes(q)) && !(item.notes?.toLowerCase().includes(q))) return false;
      if (typeFilter !== 'ALL' && item.type !== typeFilter) return false;
      if (statusFilter === 'SOLD' && !item.isSold) return false;
      if (statusFilter === 'AVAILABLE' && item.isSold) return false;
      if (conditionFilter !== 'ALL' && item.condition !== conditionFilter) return false;
      if (gradeFilter !== 'ALL' && item.grade !== gradeFilter) return false;
      if (weightFilter !== 'ALL') {
        const lo = Number(weightFilter);
        const w = item.weightMin ?? item.weightMax;
        if (w == null || w < lo || w >= lo + WEIGHT_BUCKET) return false;
      }
      if (tagFilter === 'WITH_TAG' && !item.tag) return false;
      if (tagFilter === 'NO_TAG' && item.tag) return false;
      return true;
    });
    if (sortOrder === 'sku_asc') result = [...result].sort((a, b) => a.sku.localeCompare(b.sku));
    else if (sortOrder === 'sku_desc') result = [...result].sort((a, b) => b.sku.localeCompare(a.sku));
    else if (sortOrder === 'harga_asc') result = [...result].sort((a, b) => (a.hargaJual ?? 0) - (b.hargaJual ?? 0));
    else if (sortOrder === 'harga_desc') result = [...result].sort((a, b) => (b.hargaJual ?? 0) - (a.hargaJual ?? 0));
    return result;
  }, [livestock, search, typeFilter, statusFilter, conditionFilter, gradeFilter, weightFilter, tagFilter, sortOrder]);

  const hasFilters =
    search !== '' ||
    typeFilter !== 'ALL' ||
    statusFilter !== 'ALL' ||
    conditionFilter !== 'ALL' ||
    gradeFilter !== 'ALL' ||
    weightFilter !== 'ALL' ||
    tagFilter !== 'ALL' ||
    sortOrder !== 'newest';

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div className="space-y-4">
      {/* Filter bar with labels */}
      <div className="flex items-end gap-3 flex-wrap bg-muted/20 p-3 rounded-lg border border-border/50">
        {/* Search */}
        <div className="space-y-1.5 w-full sm:w-auto">
          <Label className="text-xs text-muted-foreground">Cari</Label>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="SKU, tag, catatan..."
              className="h-8 pl-8 pr-8 text-xs w-full sm:w-[200px]"
            />
            {search && (
              <button type="button" onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Jenis Hewan</Label>
          <Select
            value={typeFilter}
            onValueChange={(val) => { setTypeFilter(val ?? typeFilter); setGradeFilter('ALL'); setWeightFilter('ALL'); }}
          >
            <SelectTrigger className="h-8 w-[130px] text-xs">
              <SelectValue>
                {{ ALL: 'Semua Jenis', KAMBING: 'Kambing', DOMBA: 'Domba', SAPI: 'Sapi' }[typeFilter] ?? typeFilter}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Semua Jenis</SelectItem>
              <SelectItem value="KAMBING">Kambing</SelectItem>
              <SelectItem value="DOMBA">Domba</SelectItem>
              <SelectItem value="SAPI">Sapi</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {(typeFilter === 'KAMBING' || typeFilter === 'DOMBA') && gradeOptions.length > 0 && (
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Grade</Label>
            <Select
              value={gradeFilter}
              onValueChange={(val) => setGradeFilter(val ?? gradeFilter)}
            >
              <SelectTrigger className="h-8 w-[130px] text-xs">
                <SelectValue>
                  {gradeFilter === 'ALL' ? 'Semua Grade' : gradeFilter}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Semua Grade</SelectItem>
                {gradeOptions.map((g) => (
                  <SelectItem key={g} value={g}>{g}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Status</Label>
          <Select
            value={statusFilter}
            onValueChange={(val) => setStatusFilter(val ?? statusFilter)}
          >
            <SelectTrigger className="h-8 w-[130px] text-xs">
              <SelectValue>
                {{ ALL: 'Semua Status', AVAILABLE: 'Tersedia', SOLD: 'Terjual' }[statusFilter] ?? statusFilter}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Semua Status</SelectItem>
              <SelectItem value="AVAILABLE">Tersedia</SelectItem>
              <SelectItem value="SOLD">Terjual</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Kondisi</Label>
          <Select
            value={conditionFilter}
            onValueChange={(val) => setConditionFilter(val ?? conditionFilter)}
          >
            <SelectTrigger className="h-8 w-[130px] text-xs">
              <SelectValue>
                {{ ALL: 'Semua Kondisi', SEHAT: 'Sehat', SAKIT: 'Sakit', MATI: 'Mati' }[conditionFilter] ?? conditionFilter}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Semua Kondisi</SelectItem>
              <SelectItem value="SEHAT">Sehat</SelectItem>
              <SelectItem value="SAKIT">Sakit</SelectItem>
              <SelectItem value="MATI">Mati</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {weightBuckets.length > 0 && (
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Berat (kg)</Label>
            <Select
              value={weightFilter}
              onValueChange={(val) => setWeightFilter(val ?? weightFilter)}
            >
              <SelectTrigger className="h-8 w-[140px] text-xs">
                <SelectValue>
                  {weightFilter === 'ALL'
                    ? 'Semua Berat'
                    : `${weightFilter}–${Number(weightFilter) + WEIGHT_BUCKET} kg`}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Semua Berat</SelectItem>
                {weightBuckets.map((lo) => (
                  <SelectItem key={lo} value={String(lo)}>
                    {lo}–{lo + WEIGHT_BUCKET} kg
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Tag</Label>
          <Select
            value={tagFilter}
            onValueChange={(val) => setTagFilter(val ?? tagFilter)}
          >
            <SelectTrigger className="h-8 w-[130px] text-xs">
              <SelectValue>
                {{ ALL: 'Semua Tag', WITH_TAG: 'Ada Tag', NO_TAG: 'Tanpa Tag' }[tagFilter] ?? tagFilter}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Semua Tag</SelectItem>
              <SelectItem value="WITH_TAG">Ada Tag</SelectItem>
              <SelectItem value="NO_TAG">Tanpa Tag</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Urutkan</Label>
          <Select
            value={sortOrder}
            onValueChange={(val) => setSortOrder(val as typeof sortOrder)}
          >
            <SelectTrigger className="h-8 w-[160px] text-xs">
              <SelectValue>
                {{ newest: 'Terbaru', sku_asc: 'SKU A-Z', sku_desc: 'SKU Z-A', harga_asc: 'Harga ↑', harga_desc: 'Harga ↓' }[sortOrder]}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="newest">Terbaru</SelectItem>
              <SelectItem value="sku_asc">SKU A-Z</SelectItem>
              <SelectItem value="sku_desc">SKU Z-A</SelectItem>
              <SelectItem value="harga_asc">Harga ↑</SelectItem>
              <SelectItem value="harga_desc">Harga ↓</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {hasFilters && (
          <button
            type="button"
            onClick={() => {
              setSearch('');
              setTypeFilter('ALL');
              setStatusFilter('ALL');
              setConditionFilter('ALL');
              setGradeFilter('ALL');
              setWeightFilter('ALL');
              setTagFilter('ALL');
              setSortOrder('newest');
            }}
            className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2 transition-colors mb-2 ml-1"
          >
            Reset
          </button>
        )}
        <span className="ml-auto text-xs text-muted-foreground mb-2">
          {filtered.length} dari {livestock.length} hewan
        </span>
      </div>

      {/* Table (desktop) */}
      <Card>
        <CardContent className="p-0">
          <div className="hidden md:block overflow-x-auto">
            <table className="text-sm w-full">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="p-3 w-14"></th>
                  <th className="p-3 font-medium text-left">SKU</th>
                  <th className="p-3 font-medium text-left">Tag</th>
                  <th className="p-3 font-medium text-left">Jenis</th>
                  <th className="p-3 font-medium text-center">Grade/Berat</th>
                  {canViewFinancials && (
                    <th className="p-3 font-medium text-right">Modal</th>
                  )}
                  <th className="p-3 font-medium text-right">Harga</th>
                  <th className="p-3 font-medium text-center w-12">Kondisi</th>
                  <th className="p-3 font-medium text-center w-12">Status</th>
                  <th className="p-3 font-medium text-left">Pembeli</th>
                  <th className="p-3 font-medium text-left">Sales</th>
                  <th className="p-3 font-medium text-left">Pengiriman</th>
                  {!readOnly && (
                    <th className="p-3 font-medium text-center">Aksi</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {paginated.map((item) => {
                  const isMati = item.condition === 'MATI';
                  const rowClass = isMati
                    ? 'bg-black text-white hover:bg-zinc-900'
                    : item.condition === 'SAKIT'
                      ? 'bg-zinc-300 text-zinc-800 hover:bg-zinc-400/70 dark:bg-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-600'
                      : 'hover:bg-muted/30';
                  const mutedClass = isMati
                    ? 'text-white/70'
                    : 'text-muted-foreground';
                  return (
                    <tr
                      key={item.id}
                      className={`border-b last:border-0 transition-colors ${rowClass}`}
                    >
                      <td className="p-3">
                        <LivestockPhoto
                          photoUrl={item.photoUrl}
                          alt={`${item.type} ${item.grade} - ${item.sku}`}
                        />
                      </td>
                      <td className="p-3 font-mono text-xs whitespace-nowrap">
                        {item.sku}
                      </td>
                      <td className={`p-3 text-xs ${mutedClass}`}>
                        {item.tag || '—'}
                      </td>
                      <td className="p-3 whitespace-nowrap">
                        {item.type.charAt(0) + item.type.slice(1).toLowerCase()}
                      </td>
                      <td className="p-3 text-center whitespace-nowrap">
                        {item.type === 'SAPI' ? (
                          <span className="tabular-nums">
                            {formatWeight(item.weightMin, item.weightMax) ?? '—'}
                          </span>
                        ) : item.grade ? (
                          <Badge
                            variant="outline"
                            className={isMati ? 'border-white/40 text-white' : ''}
                          >
                            {item.grade}
                          </Badge>
                        ) : (
                          <span className={mutedClass}>—</span>
                        )}
                      </td>
                      {canViewFinancials && (
                        <td className="p-3 text-right tabular-nums whitespace-nowrap text-muted-foreground">
                          {item.hargaModal ? formatRupiah(item.hargaModal) : '—'}
                        </td>
                      )}
                      <td className="p-3 text-right tabular-nums whitespace-nowrap">
                        {item.hargaJual ? formatRupiah(item.hargaJual) : '—'}
                      </td>
                      <td className="p-3 text-center">
                        <ConditionIcon condition={item.condition} />
                      </td>
                      <td className="p-3 text-center">
                        <StatusIcon isSold={item.isSold} />
                      </td>
                      <td className="p-3 text-xs whitespace-nowrap">
                        {item.buyerName || (
                          <span className={mutedClass}>—</span>
                        )}
                      </td>
                      <td className="p-3 text-xs whitespace-nowrap">
                        {item.salesName || (
                          <span className={mutedClass}>—</span>
                        )}
                      </td>
                      <td className="p-3 text-xs whitespace-nowrap">
                        {item.deliveryStatus ? (
                          <div className="flex items-center gap-1.5">
                            <span>{item.driverName ?? '—'}</span>
                            <Badge
                              variant="outline"
                              className={
                                isMati
                                  ? 'border-white/40 text-white text-[10px]'
                                  : 'text-[10px]'
                              }
                            >
                              {item.deliveryStatus}
                            </Badge>
                          </div>
                        ) : (
                          <span className={mutedClass}>—</span>
                        )}
                      </td>
                      {!readOnly && (
                        <td className="p-3">
                          <div className="flex items-center justify-center">
                            <LivestockActions livestock={item} pricingTemplate={pricingTemplate} />
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
                {filtered.length === 0 && (
                  <tr>
                    <td
                      colSpan={(readOnly ? 11 : 12) + (canViewFinancials ? 1 : 0)}
                      className="p-8 text-center text-muted-foreground"
                    >
                      {livestock.length === 0
                        ? 'Belum ada hewan terdaftar.'
                        : 'Tidak ada hewan yang cocok dengan filter.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile card list */}
          <div className="md:hidden p-3 space-y-3">
            {paginated.map((item) => (
              <MobileLivestockCard
                key={item.id}
                item={item}
                readOnly={readOnly}
                canViewFinancials={canViewFinancials}
                pricingTemplate={pricingTemplate}
              />
            ))}
            {filtered.length === 0 && (
              <div className="p-8 text-center text-muted-foreground text-sm">
                {livestock.length === 0
                  ? 'Belum ada hewan terdaftar.'
                  : 'Tidak ada hewan yang cocok dengan filter.'}
              </div>
            )}
          </div>

          <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
        </CardContent>
      </Card>
    </div>
  );
}

function MobileLivestockCard({
  item,
  readOnly,
  canViewFinancials,
  pricingTemplate,
}: {
  item: LivestockItem;
  readOnly: boolean;
  canViewFinancials: boolean;
  pricingTemplate?: PricingMap;
}) {
  const [expanded, setExpanded] = useState(false);

  const typeLabel = item.type.charAt(0) + item.type.slice(1).toLowerCase();
  const weightLabel = formatWeight(item.weightMin, item.weightMax);

  const cardClass =
    item.condition === 'MATI'
      ? 'bg-black text-white'
      : item.condition === 'SAKIT'
        ? 'bg-zinc-300 text-zinc-800 dark:bg-zinc-700 dark:text-zinc-200'
        : 'bg-card';

  return (
    <div className={`rounded-lg border shadow-sm overflow-hidden ${cardClass}`}>
      {/* Header — photo opens lightbox, rest toggles expand */}
      <div className="flex items-center gap-3 p-3 hover:bg-muted/30 transition-colors">
        <LivestockPhoto
          photoUrl={item.photoUrl}
          alt={`${item.type} ${item.grade ?? ''} - ${item.sku}`}
        />
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="flex-1 min-w-0 flex items-center gap-2 text-left"
        >
          <div className="flex-1 min-w-0 text-sm truncate">
            <span className="font-medium">{item.tag || item.sku}</span>
            <span className="mx-2 text-muted-foreground">|</span>
            <span className="font-medium">
              {typeLabel}
              {item.type === 'SAPI'
                ? weightLabel ? ' ' + weightLabel : ''
                : item.grade ? ' ' + item.grade : ''}
            </span>
          </div>
          <ConditionIcon condition={item.condition} />
          <StatusIcon isSold={item.isSold} />
          <ChevronDown
            className={`h-4 w-4 text-muted-foreground shrink-0 transition-transform ${
              expanded ? 'rotate-180' : ''
            }`}
          />
        </button>
      </div>

      {/* Body */}
      {expanded && (
        <div className="border-t">
          <dl className="divide-y text-sm">
            <LivestockCardRow
              label="SKU"
              value={<span className="font-mono text-xs">{item.sku}</span>}
            />
            <LivestockCardRow label="Tag" value={item.tag || '—'} />
            <LivestockCardRow label="Jenis" value={typeLabel} />
            {item.type === 'SAPI' ? (
              <LivestockCardRow
                label="Berat"
                value={formatWeight(item.weightMin, item.weightMax) ?? '—'}
              />
            ) : (
              <LivestockCardRow
                label="Grade"
                value={
                  item.grade ? <Badge variant="outline">{item.grade}</Badge> : '—'
                }
              />
            )}
            {canViewFinancials && (
              <LivestockCardRow
                label="Modal"
                value={item.hargaModal ? formatRupiah(item.hargaModal) : '—'}
              />
            )}
            <LivestockCardRow
              label="Harga"
              value={item.hargaJual ? formatRupiah(item.hargaJual) : '—'}
            />
            <LivestockCardRow
              label="Kondisi"
              value={
                <div className="flex items-center gap-2">
                  <ConditionIcon condition={item.condition} />
                  <span>
                    {item.condition.charAt(0) +
                      item.condition.slice(1).toLowerCase()}
                  </span>
                </div>
              }
            />
            <LivestockCardRow
              label="Pembeli"
              value={
                item.buyerName || (
                  <span className="text-muted-foreground">—</span>
                )
              }
            />
            <LivestockCardRow
              label="Sales"
              value={
                item.salesName || (
                  <span className="text-muted-foreground">—</span>
                )
              }
            />
            <LivestockCardRow
              label="Pengiriman"
              value={
                item.deliveryStatus ? (
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span>{item.driverName ?? '—'}</span>
                    <Badge variant="outline" className="text-[10px]">
                      {item.deliveryStatus}
                    </Badge>
                  </div>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )
              }
            />
            {item.notes && (
              <LivestockCardRow
                label="Catatan"
                value={
                  <span className="text-muted-foreground text-xs whitespace-pre-wrap">
                    {item.notes}
                  </span>
                }
              />
            )}
          </dl>

          {/* Action bar */}
          {!readOnly && (
            <div className="flex items-center justify-end gap-1 p-2 border-t bg-muted/20">
              <LivestockActions livestock={item} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function LivestockCardRow({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3 px-3 py-2">
      <dt className="text-muted-foreground text-xs w-24 flex-shrink-0 pt-0.5">
        {label}
      </dt>
      <dd className="flex-1 text-sm min-w-0">{value}</dd>
    </div>
  );
}
