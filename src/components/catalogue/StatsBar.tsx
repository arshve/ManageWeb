import type { AvailableLivestock } from '@/app/actions/livestock';

interface StatsBarProps {
  livestock: AvailableLivestock[];
}

interface StatCard {
  emoji: string;
  label: string;
  count: number;
  bg: string;
}

export function StatsBar({ livestock }: StatsBarProps) {
  const counts = livestock.reduce<Record<string, number>>((acc, item) => {
    acc[item.type] = (acc[item.type] ?? 0) + 1;
    return acc;
  }, {});

  const stats: StatCard[] = [
    {
      emoji: '✨',
      label: 'Total Tersedia',
      count: livestock.length,
      bg: 'bg-neutral-100 dark:bg-neutral-800',
    },
    {
      emoji: '🐄',
      label: 'Sapi',
      count: counts['SAPI'] ?? 0,
      bg: 'bg-amber-50 dark:bg-amber-950/40',
    },
    {
      emoji: '🐑',
      label: 'Domba',
      count: counts['DOMBA'] ?? 0,
      bg: 'bg-emerald-50 dark:bg-emerald-950/40',
    },
    {
      emoji: '🐐',
      label: 'Kambing',
      count: counts['KAMBING'] ?? 0,
      bg: 'bg-sky-50 dark:bg-sky-950/40',
    },
  ];

  return (
    <div className="overflow-x-auto scrollbar-none scroll-smooth snap-x snap-mandatory">
      <div className="flex gap-3 pb-1 min-w-max sm:min-w-0 sm:grid sm:grid-cols-4">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className={[
              'snap-start flex-shrink-0 w-36 sm:w-auto',
              'flex flex-col gap-2 p-4 rounded-2xl',
              stat.bg,
            ].join(' ')}
          >
            <span className="text-2xl leading-none" role="img" aria-hidden>
              {stat.emoji}
            </span>
            <div>
              <p className="text-2xl font-bold text-neutral-900 dark:text-neutral-100 tabular-nums">
                {stat.count}
              </p>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                {stat.label}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
