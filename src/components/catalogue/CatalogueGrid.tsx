'use client';

import { useState, useMemo } from 'react';
import { Beef, ChevronLeft, ChevronRight } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { AnimalCard } from './AnimalCard';
import { FilterBar, type FilterType, type GradeFilter, type SortOrder, type Availability } from './FilterBar';
import { StatsBar } from './StatsBar';
import { formatWeight } from '@/lib/format';
import type { AvailableLivestock } from '@/app/actions/livestock';
import type { Decimal } from '@prisma/client/runtime/library';

interface CatalogueGridProps {
  livestock: AvailableLivestock[];
}

const PAGE_SIZE = 9; // 3 cols × 3 rows

function toNumber(val: Decimal | number | null | undefined): number {
  if (val == null) return 0;
  return typeof val === 'number' ? val : Number(val);
}

export function CatalogueGrid({ livestock }: CatalogueGridProps) {
  const [activeFilter, setActiveFilter] = useState<FilterType>('ALL');
  const [activeSort, setActiveSort] = useState<SortOrder>('newest');
  const [activeGrade, setActiveGrade] = useState<GradeFilter>('ALL');
  const [activeWeight, setActiveWeight] = useState('ALL');
  const [availability, setAvailability] = useState<Availability>('AVAIL');
  const [tagSearch, setTagSearch] = useState('');

  const [page, setPage] = useState(0);

  /* ── Availability-filtered base (for counts + weight options) ─────────── */
  const availFiltered = useMemo(() => {
    if (availability === 'AVAIL') return livestock.filter((l) => !l.isSold);
    return livestock;
  }, [livestock, availability]);

  /* ── Counts per type for filter pills ─────────────────────────────────── */
  const counts = useMemo<Record<string, number>>(() => {
    const base = availFiltered.reduce<Record<string, number>>((acc, item) => {
      acc[item.type] = (acc[item.type] ?? 0) + 1;
      return acc;
    }, {});
    return { ALL: availFiltered.length, ...base };
  }, [availFiltered]);

  /* ── Weight options from type-filtered data ───────────────────────────── */
  const weightOptions = useMemo(() => {
    const source = activeFilter !== 'ALL'
      ? availFiltered.filter((l) => l.type === activeFilter)
      : availFiltered;
    const set = new Set<string>();
    source.forEach((l) => {
      const w = formatWeight(l.weightMin, l.weightMax);
      if (w) set.add(w);
    });
    return Array.from(set).sort();
  }, [availFiltered, activeFilter]);

  const showGrades = activeFilter !== 'SAPI';

  /* ── Filter + Sort ────────────────────────────────────────────────────── */
  const filtered = useMemo(() => {
    let result = availFiltered;

    if (activeFilter !== 'ALL') {
      result = result.filter((item) => item.type === activeFilter);
    }
    if (activeGrade !== 'ALL') {
      result = result.filter((item) => item.grade === activeGrade);
    }
    if (activeWeight !== 'ALL') {
      result = result.filter((item) => formatWeight(item.weightMin, item.weightMax) === activeWeight);
    }
    if (tagSearch.trim()) {
      const q = tagSearch.trim().toLowerCase();
      result = result.filter((item) => item.tag?.toLowerCase().includes(q));
    }
    switch (activeSort) {
      case 'price_asc':
        result = [...result].sort(
          (a, b) => toNumber(a.hargaJual) - toNumber(b.hargaJual),
        );
        break;
      case 'price_desc':
        result = [...result].sort(
          (a, b) => toNumber(b.hargaJual) - toNumber(a.hargaJual),
        );
        break;
      default:
        break;
    }

    return result;
  }, [availFiltered, activeFilter, activeGrade, activeWeight, tagSearch, activeSort]);

  /* ── Pagination ────────────────────────────────────────────────────────── */
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);
  const paged = filtered.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE);

  const hasActiveFilters =
    availability !== 'AVAIL' ||
    activeFilter !== 'ALL' ||
    activeGrade !== 'ALL' ||
    activeWeight !== 'ALL' ||
    activeSort !== 'newest' ||
    tagSearch.trim() !== '';

  /* ── Handlers (reset page on any change) ──────────────────────────────── */
  function handleFilterChange(f: FilterType) {
    setActiveFilter(f);
    if (f === 'SAPI') setActiveGrade('ALL');
    setActiveWeight('ALL');
    setPage(0);
  }
  function handleGradeChange(g: GradeFilter) {
    setActiveGrade(g);
    setPage(0);
  }
  function handleWeightChange(w: string) {
    setActiveWeight(w);
    setPage(0);
  }
  function handleSortChange(s: SortOrder) {
    setActiveSort(s);
    setPage(0);
  }
  function handleAvailabilityChange(a: Availability) {
    setAvailability(a);
    setPage(0);
  }
  function handleTagSearchChange(v: string) {
    setTagSearch(v);
    setPage(0);
  }
  function handleReset() {
    setAvailability('AVAIL');
    setActiveFilter('ALL');
    setActiveSort('newest');
    setActiveGrade('ALL');
    setActiveWeight('ALL');
    setTagSearch('');
    setPage(0);
  }

  return (
    <div>
      {/* Stats bar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-8 pb-6">
        <StatsBar livestock={livestock} />
      </div>

      {/* Filter bar */}
      <FilterBar
        activeFilter={activeFilter}
        activeSort={activeSort}
        activeGrade={activeGrade}
        activeWeight={activeWeight}
        availability={availability}
        tagSearch={tagSearch}

        onFilterChange={handleFilterChange}
        onSortChange={handleSortChange}
        onGradeChange={handleGradeChange}
        onWeightChange={handleWeightChange}
        onAvailabilityChange={handleAvailabilityChange}
        onTagSearchChange={handleTagSearchChange}

        onReset={handleReset}
        counts={counts}
        weightOptions={weightOptions}
        showGrades={showGrades}
        hasActiveFilters={hasActiveFilters}
      />

      {/* Grid */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        {filtered.length === 0 ? (
          <EmptyState filter={activeFilter} />
        ) : (
          <>
            <p className="text-xs text-muted-foreground mb-6 font-mono">
              {filtered.length} hewan ditemukan
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
              {paged.map((item, index) => (
                <AnimalCard key={item.id} item={item} priority={safePage === 0 && index < 3} isSold={item.isSold} />
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-4 pt-8">
                <button
                  type="button"
                  disabled={safePage === 0}
                  onClick={() => setPage(safePage - 1)}
                  className={[
                    'inline-flex items-center justify-center size-10 rounded-full',
                    'border border-border',
                    'text-muted-foreground',
                    'hover:bg-accent',
                    'disabled:opacity-30 disabled:cursor-not-allowed',
                    'transition-all duration-200',
                  ].join(' ')}
                >
                  <ChevronLeft className="size-4" />
                </button>
                <span className="text-sm text-muted-foreground tabular-nums">
                  {safePage + 1} / {totalPages}
                </span>
                <button
                  type="button"
                  disabled={safePage >= totalPages - 1}
                  onClick={() => setPage(safePage + 1)}
                  className={[
                    'inline-flex items-center justify-center size-10 rounded-full',
                    'border border-border',
                    'text-muted-foreground',
                    'hover:bg-accent',
                    'disabled:opacity-30 disabled:cursor-not-allowed',
                    'transition-all duration-200',
                  ].join(' ')}
                >
                  <ChevronRight className="size-4" />
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

/* ── Skeleton ─────────────────────────────────────────────────────────────── */
export function CatalogueGridSkeleton() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-2xl" />
        ))}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="rounded-2xl lg:rounded-3xl overflow-hidden border"
            style={{ animationDelay: `${i * 80}ms` }}
          >
            <Skeleton className="aspect-[4/3] rounded-none" />
            <div className="p-4 flex flex-col gap-3">
              <Skeleton className="h-4 w-3/4 rounded-lg" />
              <Skeleton className="h-3 w-1/2 rounded-lg" />
              <Skeleton className="h-3 w-2/5 rounded-lg" />
              <div className="pt-2 border-t flex flex-col gap-3">
                <Skeleton className="h-6 w-1/2 rounded-lg" />
                <Skeleton className="h-11 rounded-xl" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Empty state ──────────────────────────────────────────────────────────── */
function EmptyState({ filter }: { filter: FilterType }) {
  const typeMap: Record<FilterType, string> = {
    ALL: 'hewan',
    SAPI: 'sapi',
    KAMBING: 'kambing',
    DOMBA: 'domba',
  };

  return (
    <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
      <div className="size-20 rounded-full bg-muted flex items-center justify-center">
        <Beef className="size-10 text-muted-foreground" />
      </div>
      <div>
        <p className="text-lg font-semibold text-foreground">
          Tidak ada {typeMap[filter]} tersedia
        </p>
        <p className="text-sm text-muted-foreground mt-1">
          Silakan cek kembali nanti atau pilih kategori lain.
        </p>
      </div>
    </div>
  );
}
