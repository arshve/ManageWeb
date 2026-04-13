'use client';

import { useState, useMemo } from 'react';
import {
  ChevronDown,
  HeartPulse,
  Thermometer,
  Skull,
  CircleCheck,
  ShoppingBag,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { LivestockPhoto } from '@/components/dashboard/livestock-photo';
import { LivestockActions } from '@/components/dashboard/livestock-actions';
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
  tag: string | null;
  photoUrl: string | null;
  notes: string | null;
  isSold: boolean;
  buyerName: string | null;
  salesName: string | null;
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
}: {
  livestock: LivestockItem[];
}) {
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [conditionFilter, setConditionFilter] = useState('ALL');

  const filtered = useMemo(() => {
    return livestock.filter((item) => {
      if (typeFilter !== 'ALL' && item.type !== typeFilter) return false;
      if (statusFilter === 'SOLD' && !item.isSold) return false;
      if (statusFilter === 'AVAILABLE' && item.isSold) return false;
      if (conditionFilter !== 'ALL' && item.condition !== conditionFilter)
        return false;
      return true;
    });
  }, [livestock, typeFilter, statusFilter, conditionFilter]);

  const hasFilters =
    typeFilter !== 'ALL' || statusFilter !== 'ALL' || conditionFilter !== 'ALL';

  return (
    <div className="space-y-4">
      {/* Filter bar */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-sm text-muted-foreground">Filter:</span>
        <Select
          value={typeFilter}
          onValueChange={(val) => setTypeFilter(val ?? typeFilter)}
        >
          <SelectTrigger className="h-8 w-[130px] text-xs">
            <SelectValue placeholder="Jenis" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Semua Jenis</SelectItem>
            <SelectItem value="KAMBING">Kambing</SelectItem>
            <SelectItem value="DOMBA">Domba</SelectItem>
            <SelectItem value="SAPI">Sapi</SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={statusFilter}
          onValueChange={(val) => setStatusFilter(val ?? statusFilter)}
        >
          <SelectTrigger className="h-8 w-[130px] text-xs">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Semua Status</SelectItem>
            <SelectItem value="AVAILABLE">Tersedia</SelectItem>
            <SelectItem value="SOLD">Terjual</SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={conditionFilter}
          onValueChange={(val) => setConditionFilter(val ?? conditionFilter)}
        >
          <SelectTrigger className="h-8 w-[130px] text-xs">
            <SelectValue placeholder="Kondisi" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Semua Kondisi</SelectItem>
            <SelectItem value="SEHAT">Sehat</SelectItem>
            <SelectItem value="SAKIT">Sakit</SelectItem>
            <SelectItem value="MATI">Mati</SelectItem>
          </SelectContent>
        </Select>
        {hasFilters && (
          <button
            type="button"
            onClick={() => {
              setTypeFilter('ALL');
              setStatusFilter('ALL');
              setConditionFilter('ALL');
            }}
            className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2 transition-colors"
          >
            Reset
          </button>
        )}
        <span className="ml-auto text-xs text-muted-foreground">
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
                  <th className="p-3 font-medium text-center">Grade</th>
                  <th className="p-3 font-medium text-right">Berat</th>
                  <th className="p-3 font-medium text-right">Harga</th>
                  <th className="p-3 font-medium text-center w-12">Kondisi</th>
                  <th className="p-3 font-medium text-center w-12">Status</th>
                  <th className="p-3 font-medium text-left">Pembeli</th>
                  <th className="p-3 font-medium text-left">Sales</th>
                  <th className="p-3 font-medium text-center">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((item) => {
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
                    <td className="p-3 text-center">
                      {item.grade ? (
                        <Badge
                          variant="outline"
                          className={
                            isMati ? 'border-white/40 text-white' : ''
                          }
                        >
                          {item.grade}
                        </Badge>
                      ) : (
                        <span className={mutedClass}>—</span>
                      )}
                    </td>
                    <td className="p-3 text-right tabular-nums whitespace-nowrap">
                      {formatWeight(item.weightMin, item.weightMax) ?? '—'}
                    </td>
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
                      {item.buyerName || <span className={mutedClass}>—</span>}
                    </td>
                    <td className="p-3 text-xs whitespace-nowrap">
                      {item.salesName || <span className={mutedClass}>—</span>}
                    </td>
                    <td className="p-3">
                      <div className="flex items-center justify-center">
                        <LivestockActions livestock={item} />
                      </div>
                    </td>
                  </tr>
                  );
                })}
                {filtered.length === 0 && (
                  <tr>
                    <td
                      colSpan={12}
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
            {filtered.map((item) => (
              <MobileLivestockCard key={item.id} item={item} />
            ))}
            {filtered.length === 0 && (
              <div className="p-8 text-center text-muted-foreground text-sm">
                {livestock.length === 0
                  ? 'Belum ada hewan terdaftar.'
                  : 'Tidak ada hewan yang cocok dengan filter.'}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function MobileLivestockCard({ item }: { item: LivestockItem }) {
  const [expanded, setExpanded] = useState(false);

  const typeLabel = item.type.charAt(0) + item.type.slice(1).toLowerCase();

  const cardClass =
    item.condition === 'MATI'
      ? 'bg-black text-white'
      : item.condition === 'SAKIT'
        ? 'bg-zinc-300 text-zinc-800 dark:bg-zinc-700 dark:text-zinc-200'
        : 'bg-card';

  return (
    <div
      className={`rounded-lg border shadow-sm overflow-hidden ${cardClass}`}
    >
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
              {item.grade ? ' ' + item.grade : ''}
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
            <LivestockCardRow
              label="Grade"
              value={
                item.grade ? (
                  <Badge variant="outline">{item.grade}</Badge>
                ) : (
                  '—'
                )
              }
            />
            <LivestockCardRow
              label="Berat"
              value={formatWeight(item.weightMin, item.weightMax) ?? '—'}
            />
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
          <div className="flex items-center justify-end gap-1 p-2 border-t bg-muted/20">
            <LivestockActions livestock={item} />
          </div>
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
