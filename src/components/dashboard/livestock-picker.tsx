'use client';

import { useState, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { Beef, Check, Search } from 'lucide-react';
import { LivestockPhoto } from '@/components/dashboard/livestock-photo';
import { formatWeight, formatRupiah } from '@/lib/format';
import { cn } from '@/lib/utils';

export interface PickerLivestock {
  id: string;
  sku: string;
  type: string;
  grade: string | null;
  tag: string | null;
  hargaJual: number | null;
  weightMin: number | null;
  weightMax: number | null;
  condition: string;
  photoUrl: string | null;
}

const TYPES = ['KAMBING', 'DOMBA', 'SAPI'] as const;
const TYPE_LABEL: Record<string, string> = { KAMBING: 'Kambing', DOMBA: 'Domba', SAPI: 'Sapi' };
const GRADES = ['SUPER', 'A', 'B', 'C', 'D'] as const;

const ITEMS_PER_ROW_MOBILE = 3;
const ITEMS_PER_ROW_DESKTOP = 5;
const ROWS_PER_PAGE = 3;
const PAGE_SIZE = ITEMS_PER_ROW_DESKTOP * ROWS_PER_PAGE; // 15 items per page

export function LivestockPicker({
  livestock,
  selectedIds,
  onToggle,
}: {
  livestock: PickerLivestock[];
  selectedIds: string[];
  onToggle: (id: string) => void;
}) {
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [gradeFilter, setGradeFilter] = useState('ALL');
  const [weightFilter, setWeightFilter] = useState('ALL');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);

  // Distinct weight options from current type-filtered data
  const weightOptions = useMemo(() => {
    const source = typeFilter !== 'ALL' ? livestock.filter((l) => l.type === typeFilter) : livestock;
    const set = new Set<string>();
    source.forEach((l) => {
      const w = formatWeight(l.weightMin, l.weightMax);
      if (w) set.add(w);
    });
    return Array.from(set).sort();
  }, [livestock, typeFilter]);

  const filtered = useMemo(() => {
    let list = livestock;
    if (typeFilter !== 'ALL') list = list.filter((l) => l.type === typeFilter);
    if (gradeFilter !== 'ALL') list = list.filter((l) => l.grade === gradeFilter);
    if (weightFilter !== 'ALL') list = list.filter((l) => formatWeight(l.weightMin, l.weightMax) === weightFilter);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(
        (l) =>
          l.sku.toLowerCase().includes(q) ||
          l.type.toLowerCase().includes(q) ||
          (l.grade?.toLowerCase().includes(q)) ||
          (l.tag?.toLowerCase().includes(q)),
      );
    }
    return list;
  }, [livestock, typeFilter, gradeFilter, weightFilter, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);
  const paged = filtered.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE);

  // Reset page when filters change
  const hasFilters = typeFilter !== 'ALL' || gradeFilter !== 'ALL' || weightFilter !== 'ALL' || search.trim() !== '';
  const showGrades = typeFilter !== 'SAPI';

  return (
    <div className="space-y-3">
      {/* Filter bar */}
      <div className="space-y-2">
        {/* Type pills */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-muted-foreground mr-1">Jenis:</span>
          <PillButton active={typeFilter === 'ALL'} onClick={() => { setTypeFilter('ALL'); setGradeFilter('ALL'); setWeightFilter('ALL'); setPage(0); }}>
            Semua
          </PillButton>
          {TYPES.map((t) => (
            <PillButton
              key={t}
              active={typeFilter === t}
              onClick={() => { setTypeFilter(t); if (t === 'SAPI') setGradeFilter('ALL'); setWeightFilter('ALL'); setPage(0); }}
            >
              {TYPE_LABEL[t]}
            </PillButton>
          ))}
        </div>

        {/* Grade pills */}
        {showGrades && (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs text-muted-foreground mr-1">Grade:</span>
            <PillButton active={gradeFilter === 'ALL'} onClick={() => { setGradeFilter('ALL'); setPage(0); }}>
              Semua
            </PillButton>
            {GRADES.map((g) => (
              <PillButton key={g} active={gradeFilter === g} onClick={() => { setGradeFilter(g); setPage(0); }}>
                {g}
              </PillButton>
            ))}
          </div>
        )}

        {/* Weight filter */}
        {weightOptions.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs text-muted-foreground mr-1">Berat:</span>
            <PillButton active={weightFilter === 'ALL'} onClick={() => { setWeightFilter('ALL'); setPage(0); }}>
              Semua
            </PillButton>
            {weightOptions.map((w) => (
              <PillButton key={w} active={weightFilter === w} onClick={() => { setWeightFilter(w); setPage(0); }}>
                {w}
              </PillButton>
            ))}
          </div>
        )}

        {/* Search + count */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(0); }}
              placeholder="Cari SKU / tag..."
              className="h-8 text-xs pl-8"
            />
          </div>
          {hasFilters && (
            <button
              type="button"
              onClick={() => { setTypeFilter('ALL'); setGradeFilter('ALL'); setWeightFilter('ALL'); setSearch(''); setPage(0); }}
              className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2 shrink-0"
            >
              Reset
            </button>
          )}
        </div>

        <p className="text-xs text-muted-foreground">
          {filtered.length === livestock.length
            ? `${livestock.length} hewan tersedia`
            : `${filtered.length} dari ${livestock.length} hewan`}
        </p>
      </div>

      {/* Card grid */}
      {filtered.length === 0 ? (
        <div className="py-8 text-center text-sm text-muted-foreground">
          Tidak ada hewan yang cocok dengan filter
        </div>
      ) : (
        <>
          <div className="grid grid-cols-3 sm:grid-cols-5 gap-1.5">
            {paged.map((l) => (
              <LivestockCard
                key={l.id}
                livestock={l}
                isSelected={selectedIds.includes(l.id)}
                onSelect={() => onToggle(l.id)}
              />
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-2">
              <button
                type="button"
                disabled={safePage === 0}
                onClick={() => setPage(safePage - 1)}
                className="px-2 py-1 text-xs rounded border disabled:opacity-30 hover:bg-muted"
              >
                ←
              </button>
              <span className="text-xs text-muted-foreground">
                {safePage + 1} / {totalPages}
              </span>
              <button
                type="button"
                disabled={safePage >= totalPages - 1}
                onClick={() => setPage(safePage + 1)}
                className="px-2 py-1 text-xs rounded border disabled:opacity-30 hover:bg-muted"
              >
                →
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function PillButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'px-2.5 py-1 rounded-full text-xs font-medium transition-colors border',
        active
          ? 'bg-primary text-primary-foreground border-primary'
          : 'bg-background text-muted-foreground border-border hover:bg-muted hover:text-foreground',
      )}
    >
      {children}
    </button>
  );
}

function LivestockCard({
  livestock: l,
  isSelected,
  onSelect,
}: {
  livestock: PickerLivestock;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const weightStr = formatWeight(l.weightMin, l.weightMax);
  const typeLabel = TYPE_LABEL[l.type] ?? l.type;

  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        'relative rounded-md border p-1 text-left transition-all hover:shadow-sm',
        isSelected
          ? 'border-primary ring-2 ring-primary/30 bg-primary/5'
          : 'border-border hover:border-muted-foreground/40',
      )}
    >
      {/* Selection indicator */}
      {isSelected && (
        <div className="absolute top-1 right-1 w-4 h-4 rounded-full bg-primary flex items-center justify-center z-10">
          <Check className="h-2.5 w-2.5 text-primary-foreground" />
        </div>
      )}

      {/* Photo */}
      <div className="w-full aspect-square rounded overflow-hidden bg-muted mb-1">
        {l.photoUrl ? (
          <LivestockPhoto
            photoUrl={l.photoUrl}
            alt={`${typeLabel}${l.grade ? ' ' + l.grade : ''}`}
            thumbnailClassName="w-full h-full object-cover"
            interactive={false}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Beef className="h-5 w-5 text-muted-foreground/20" />
          </div>
        )}
      </div>

      {/* Info */}
      <div className="space-y-0">
        <p className="font-mono text-[10px] font-medium truncate">{l.sku}</p>
        <p className="text-[10px] text-muted-foreground truncate">
          {typeLabel}{l.grade ? ` · ${l.grade}` : ''}
        </p>
        {weightStr && (
          <p className="text-[10px] text-muted-foreground">{weightStr}</p>
        )}
        <p className="text-[10px] font-medium">
          {l.hargaJual ? formatRupiah(l.hargaJual) : '—'}
        </p>
        {l.tag && (
          <span className="inline-block text-[9px] bg-muted px-1 py-0.5 rounded font-medium truncate max-w-full">
            {l.tag}
          </span>
        )}
      </div>
    </button>
  );
}
