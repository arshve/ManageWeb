'use client';

import { useState, useMemo } from 'react';
import { Beef, ChevronLeft, ChevronRight } from 'lucide-react';
import { AnimalCard } from './AnimalCard';
import { FilterBar, type FilterType, type GradeFilter, type SortOrder } from './FilterBar';
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

  const [page, setPage] = useState(0);

  /* ── Counts per type for filter pills ─────────────────────────────────── */
  const counts = useMemo<Record<string, number>>(() => {
    const base = livestock.reduce<Record<string, number>>((acc, item) => {
      acc[item.type] = (acc[item.type] ?? 0) + 1;
      return acc;
    }, {});
    return { ALL: livestock.length, ...base };
  }, [livestock]);

  /* ── Weight options from type-filtered data ───────────────────────────── */
  const weightOptions = useMemo(() => {
    const source = activeFilter !== 'ALL'
      ? livestock.filter((l) => l.type === activeFilter)
      : livestock;
    const set = new Set<string>();
    source.forEach((l) => {
      const w = formatWeight(l.weightMin, l.weightMax);
      if (w) set.add(w);
    });
    return Array.from(set).sort();
  }, [livestock, activeFilter]);

  const showGrades = activeFilter !== 'SAPI';

  /* ── Filter + Sort ────────────────────────────────────────────────────── */
  const filtered = useMemo(() => {
    let result = livestock;

    if (activeFilter !== 'ALL') {
      result = result.filter((item) => item.type === activeFilter);
    }
    if (activeGrade !== 'ALL') {
      result = result.filter((item) => item.grade === activeGrade);
    }
    if (activeWeight !== 'ALL') {
      result = result.filter((item) => formatWeight(item.weightMin, item.weightMax) === activeWeight);
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
  }, [livestock, activeFilter, activeGrade, activeWeight, activeSort]);

  /* ── Pagination ────────────────────────────────────────────────────────── */
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);
  const paged = filtered.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE);

  const hasActiveFilters =
    activeFilter !== 'ALL' ||
    activeGrade !== 'ALL' ||
    activeWeight !== 'ALL' ||
    activeSort !== 'newest';

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
  function handleReset() {
    setActiveFilter('ALL');
    setActiveSort('newest');
    setActiveGrade('ALL');
    setActiveWeight('ALL');
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

        onFilterChange={handleFilterChange}
        onSortChange={handleSortChange}
        onGradeChange={handleGradeChange}
        onWeightChange={handleWeightChange}

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
            <p className="text-xs text-neutral-400 dark:text-neutral-500 mb-6 font-mono">
              {filtered.length} hewan ditemukan
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
              {paged.map((item, index) => (
                <AnimalCard key={item.id} item={item} priority={safePage === 0 && index < 3} />
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
                    'inline-flex items-center justify-center w-10 h-10 rounded-full',
                    'border border-neutral-200 dark:border-neutral-800',
                    'text-neutral-600 dark:text-neutral-400',
                    'hover:bg-neutral-100 dark:hover:bg-neutral-800',
                    'disabled:opacity-30 disabled:cursor-not-allowed',
                    'transition-all duration-200',
                  ].join(' ')}
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-sm text-neutral-500 dark:text-neutral-400 tabular-nums">
                  {safePage + 1} / {totalPages}
                </span>
                <button
                  type="button"
                  disabled={safePage >= totalPages - 1}
                  onClick={() => setPage(safePage + 1)}
                  className={[
                    'inline-flex items-center justify-center w-10 h-10 rounded-full',
                    'border border-neutral-200 dark:border-neutral-800',
                    'text-neutral-600 dark:text-neutral-400',
                    'hover:bg-neutral-100 dark:hover:bg-neutral-800',
                    'disabled:opacity-30 disabled:cursor-not-allowed',
                    'transition-all duration-200',
                  ].join(' ')}
                >
                  <ChevronRight className="w-4 h-4" />
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
      {/* Stats skeleton */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="h-24 rounded-2xl bg-neutral-200 dark:bg-neutral-800 animate-pulse"
          />
        ))}
      </div>

      {/* Grid skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="rounded-2xl lg:rounded-3xl overflow-hidden border border-neutral-200/80 dark:border-neutral-800 animate-pulse"
            style={{ animationDelay: `${i * 80}ms` }}
          >
            {/* Image placeholder */}
            <div className="aspect-[4/3] bg-neutral-200 dark:bg-neutral-800" />
            {/* Content placeholder */}
            <div className="p-4 space-y-3">
              <div className="h-4 bg-neutral-200 dark:bg-neutral-800 rounded-lg w-3/4" />
              <div className="h-3 bg-neutral-100 dark:bg-neutral-800/60 rounded-lg w-1/2" />
              <div className="h-3 bg-neutral-100 dark:bg-neutral-800/60 rounded-lg w-2/5" />
              <div className="pt-2 border-t border-neutral-100 dark:border-neutral-800 space-y-3">
                <div className="h-6 bg-neutral-200 dark:bg-neutral-800 rounded-lg w-1/2" />
                <div className="h-11 bg-neutral-200 dark:bg-neutral-800 rounded-xl" />
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
      <div className="w-20 h-20 rounded-full bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center">
        <Beef className="w-10 h-10 text-neutral-300 dark:text-neutral-600" />
      </div>
      <div>
        <p className="text-lg font-semibold text-neutral-700 dark:text-neutral-300">
          Tidak ada {typeMap[filter]} tersedia
        </p>
        <p className="text-sm text-neutral-400 dark:text-neutral-500 mt-1">
          Silakan cek kembali nanti atau pilih kategori lain.
        </p>
      </div>
    </div>
  );
}
