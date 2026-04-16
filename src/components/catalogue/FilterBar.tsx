'use client';

import { SlidersHorizontal } from 'lucide-react';

export type FilterType = 'ALL' | 'SAPI' | 'KAMBING' | 'DOMBA';
export type SortOrder = 'newest' | 'price_asc' | 'price_desc';

interface FilterBarProps {
  activeFilter: FilterType;
  activeSort: SortOrder;
  onFilterChange: (f: FilterType) => void;
  onSortChange: (s: SortOrder) => void;
  counts: Record<string, number>;
}

const FILTER_PILLS: { key: FilterType; label: string; emoji: string }[] = [
  { key: 'ALL', label: 'Semua', emoji: '✨' },
  { key: 'SAPI', label: 'Sapi', emoji: '🐄' },
  { key: 'DOMBA', label: 'Domba', emoji: '🐑' },
  { key: 'KAMBING', label: 'Kambing', emoji: '🐐' },
];

const SORT_OPTIONS: { key: SortOrder; label: string }[] = [
  { key: 'newest', label: 'Terbaru' },
  { key: 'price_asc', label: 'Harga ↑' },
  { key: 'price_desc', label: 'Harga ↓' },
];

export function FilterBar({
  activeFilter,
  activeSort,
  onFilterChange,
  onSortChange,
  counts,
}: FilterBarProps) {
  return (
    <div
      className={[
        'sticky top-0 z-20',
        'bg-neutral-50/90 dark:bg-neutral-950/90 backdrop-blur-md',
        'border-b border-neutral-200/60 dark:border-neutral-800/60',
        'py-3',
      ].join(' ')}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex items-center gap-2 overflow-x-auto scrollbar-none scroll-smooth snap-x snap-mandatory">
          {/* Filter pills */}
          <div className="flex items-center gap-2 shrink-0">
            {FILTER_PILLS.map((pill) => {
              const isActive = activeFilter === pill.key;
              const count =
                pill.key === 'ALL'
                  ? (counts['ALL'] ?? 0)
                  : (counts[pill.key] ?? 0);
              return (
                <button
                  key={pill.key}
                  type="button"
                  onClick={() => onFilterChange(pill.key)}
                  className={[
                    'snap-start inline-flex items-center gap-1.5',
                    'min-h-[44px] px-3.5 py-2 rounded-full',
                    'text-sm font-medium whitespace-nowrap',
                    'transition-all duration-200',
                    isActive
                      ? 'bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900 shadow-sm'
                      : [
                          'bg-white dark:bg-neutral-900',
                          'text-neutral-600 dark:text-neutral-400',
                          'border border-neutral-200 dark:border-neutral-800',
                          'hover:border-neutral-400 dark:hover:border-neutral-600',
                          'active:scale-95',
                        ].join(' '),
                  ].join(' ')}
                >
                  <span
                    role="img"
                    aria-hidden
                    className="text-base leading-none"
                  >
                    {pill.emoji}
                  </span>
                  {pill.label}
                  {count > 0 && (
                    <span
                      className={[
                        'text-[10px] font-bold tabular-nums px-1.5 py-0.5 rounded-full',
                        isActive
                          ? 'bg-white/20 text-white dark:bg-neutral-900/20 dark:text-neutral-900'
                          : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400',
                      ].join(' ')}
                    >
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Divider */}
          <div className="w-px h-6 bg-neutral-200 dark:bg-neutral-700 shrink-0 mx-1" />

          {/* Sort */}
          <div className="flex items-center gap-1.5 shrink-0">
            <SlidersHorizontal className="w-3.5 h-3.5 text-neutral-400 dark:text-neutral-500 shrink-0" />
            {SORT_OPTIONS.map((opt) => {
              const isActive = activeSort === opt.key;
              return (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => onSortChange(opt.key)}
                  className={[
                    'snap-start inline-flex items-center',
                    'min-h-[44px] px-3 py-2 rounded-full',
                    'text-sm whitespace-nowrap',
                    'transition-all duration-200',
                    isActive
                      ? 'font-semibold text-neutral-900 dark:text-neutral-100 underline underline-offset-4 decoration-2 decoration-emerald-500'
                      : 'font-normal text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-300 active:scale-95',
                  ].join(' ')}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
