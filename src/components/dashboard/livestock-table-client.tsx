'use client';

import { useState, useMemo } from 'react';
import { ChevronDown } from 'lucide-react';
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
                  <th className="p-3 font-medium text-center">Kondisi</th>
                  <th className="p-3 font-medium text-center">Status</th>
                  <th className="p-3 font-medium text-center">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((item) => {
                  const isUnhealthy =
                    item.condition === 'SAKIT' || item.condition === 'MATI';
                  return (
                  <tr
                    key={item.id}
                    className={`border-b last:border-0 transition-colors ${
                      isUnhealthy
                        ? 'bg-muted/60 text-muted-foreground hover:bg-muted/80'
                        : 'hover:bg-muted/30'
                    }`}
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
                    <td className="p-3 text-xs text-muted-foreground">
                      {item.tag || '—'}
                    </td>
                    <td className="p-3 whitespace-nowrap">
                      {item.type.charAt(0) + item.type.slice(1).toLowerCase()}
                    </td>
                    <td className="p-3 text-center">
                      {item.grade ? (
                        <Badge variant="outline">{item.grade}</Badge>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="p-3 text-right tabular-nums whitespace-nowrap">
                      {formatWeight(item.weightMin, item.weightMax) ?? '—'}
                    </td>
                    <td className="p-3 text-right tabular-nums whitespace-nowrap">
                      {item.hargaJual ? formatRupiah(item.hargaJual) : '—'}
                    </td>
                    <td className="p-3 text-center">
                      <Badge
                        variant={
                          item.condition === 'SEHAT'
                            ? 'default'
                            : item.condition === 'SAKIT'
                              ? 'secondary'
                              : 'destructive'
                        }
                      >
                        {item.condition.charAt(0) +
                          item.condition.slice(1).toLowerCase()}
                      </Badge>
                    </td>
                    <td className="p-3 text-center">
                      {item.isSold ? (
                        <Badge variant="secondary">Terjual</Badge>
                      ) : (
                        <Badge className="bg-primary/10 text-primary hover:bg-primary/10">
                          Tersedia
                        </Badge>
                      )}
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
                      colSpan={10}
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
  const isUnhealthy = item.condition === 'SAKIT' || item.condition === 'MATI';

  const typeLabel = item.type.charAt(0) + item.type.slice(1).toLowerCase();
  const conditionLabel =
    item.condition.charAt(0) + item.condition.slice(1).toLowerCase();

  return (
    <div
      className={`rounded-lg border shadow-sm overflow-hidden ${
        isUnhealthy ? 'bg-muted/60 text-muted-foreground' : 'bg-card'
      }`}
    >
      {/* Header — tap to toggle */}
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center gap-2 p-3 text-left hover:bg-muted/30 transition-colors"
      >
        <div className="flex-1 min-w-0 text-sm truncate">
          <span className="font-medium">
            {typeLabel}
            {item.grade ? ' ' + item.grade : ''}
          </span>
          <span className="text-muted-foreground text-xs ml-1">
            ({item.tag || item.sku})
          </span>
        </div>
        {item.isSold ? (
          <Badge variant="secondary" className="text-[10px]">
            Terjual
          </Badge>
        ) : (
          <Badge className="bg-primary/10 text-primary hover:bg-primary/10 text-[10px]">
            Tersedia
          </Badge>
        )}
        <ChevronDown
          className={`h-4 w-4 text-muted-foreground shrink-0 transition-transform ${
            expanded ? 'rotate-180' : ''
          }`}
        />
      </button>

      {/* Body */}
      {expanded && (
        <div className="border-t">
          <dl className="divide-y text-sm">
            <div className="flex items-start gap-3 px-3 py-3">
              <dt className="text-muted-foreground text-xs w-24 flex-shrink-0 pt-0.5">
                Foto
              </dt>
              <dd className="flex-1">
                <LivestockPhoto
                  photoUrl={item.photoUrl}
                  alt={`${item.type} ${item.grade ?? ''} - ${item.sku}`}
                  thumbnailClassName="w-16 h-16"
                />
              </dd>
            </div>
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
                <Badge
                  variant={
                    item.condition === 'SEHAT'
                      ? 'default'
                      : item.condition === 'SAKIT'
                        ? 'secondary'
                        : 'destructive'
                  }
                >
                  {conditionLabel}
                </Badge>
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
