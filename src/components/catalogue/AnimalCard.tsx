'use client';

import Image from 'next/image';
import { Scale, ArrowRight, Beef } from 'lucide-react';
import { formatRupiah, formatWeight } from '@/lib/format';
import type { AvailableLivestock } from '@/app/actions/livestock';

/* ─── Grade colour map ─────────────────────────────────────────────────────── */
const gradeConfig: Record<
  string,
  { label: string; bg: string; text: string; dot: string }
> = {
  A: {
    label: 'Grade A',
    bg: 'bg-amber-50 dark:bg-amber-950/40',
    text: 'text-amber-600 dark:text-amber-400',
    dot: 'bg-amber-500',
  },
  B: {
    label: 'Grade B',
    bg: 'bg-yellow-50 dark:bg-yellow-950/40',
    text: 'text-yellow-600 dark:text-yellow-500',
    dot: 'bg-yellow-500',
  },
  C: {
    label: 'Grade C',
    bg: 'bg-neutral-100 dark:bg-neutral-800',
    text: 'text-neutral-500 dark:text-neutral-400',
    dot: 'bg-neutral-400',
  },
  D: {
    label: 'Grade D',
    bg: 'bg-stone-100 dark:bg-stone-800',
    text: 'text-stone-500 dark:text-stone-400',
    dot: 'bg-stone-400',
  },
};

const typeLabels: Record<string, { label: string; emoji: string }> = {
  SAPI: { label: 'Sapi', emoji: '🐄' },
  KAMBING: { label: 'Kambing', emoji: '🐐' },
  DOMBA: { label: 'Domba', emoji: '🐑' },
};

interface AnimalCardProps {
  item: AvailableLivestock;
  priority?: boolean;
}

export function AnimalCard({ item, priority = false }: AnimalCardProps) {
  const grade = item.grade ?? 'C';
  const gradeStyle = gradeConfig[grade] ?? gradeConfig['C'];
  const typeInfo = typeLabels[item.type] ?? { label: item.type, emoji: '🐾' };
  const weight = formatWeight(item.weightMin, item.weightMax);

  return (
    <article
      className={[
        'group relative flex flex-col bg-white dark:bg-neutral-900',
        'rounded-2xl lg:rounded-3xl overflow-hidden',
        'border border-neutral-200/80 dark:border-neutral-800',
        /* mobile: tap scale */
        'active:scale-[0.98] transition-transform duration-150',
        /* desktop: lift + shadow */
        'lg:hover:-translate-y-1 lg:hover:shadow-xl lg:hover:shadow-neutral-200/60',
        'lg:dark:hover:shadow-neutral-950/60',
        'lg:transition-all lg:duration-300',
      ].join(' ')}
    >
      {/* ── Image ──────────────────────────────────────────────────────────── */}
      <div className="relative aspect-[4/3] bg-neutral-100 dark:bg-neutral-800 overflow-hidden">
        {item.photoUrl ? (
          <Image
            src={item.photoUrl}
            alt={`${typeInfo.label}${item.grade ? ` Grade ${item.grade}` : ''} — ${item.sku}`}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            loading={priority ? 'eager' : 'lazy'}
            priority={priority}
            className="object-cover lg:group-hover:scale-105 transition-transform duration-500 ease-out"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Beef className="h-14 w-14 text-neutral-300 dark:text-neutral-600" />
          </div>
        )}

        {/* Top-left: SKU badge */}
        <div className="absolute top-3 left-3">
          <span
            className={[
              'inline-flex items-center px-2 py-1 rounded-lg',
              'bg-white/90 dark:bg-neutral-900/90 backdrop-blur-sm',
              'text-[10px] font-mono font-semibold tracking-wider',
              'text-neutral-700 dark:text-neutral-300',
              'border border-neutral-200/60 dark:border-neutral-700/60',
            ].join(' ')}
          >
            {item.sku}
          </span>
        </div>

        {/* Bottom-right: Grade badge */}
        {item.grade && (
          <div className="absolute bottom-3 right-3">
            <span
              className={[
                'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg',
                'text-[11px] font-semibold tracking-wide',
                gradeStyle.bg,
                gradeStyle.text,
                'backdrop-blur-sm',
              ].join(' ')}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${gradeStyle.dot}`} />
              {gradeStyle.label}
            </span>
          </div>
        )}
      </div>

      {/* ── Content ────────────────────────────────────────────────────────── */}
      <div className="flex flex-col flex-1 p-4 gap-3">
        {/* Title row */}
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-bold text-base text-neutral-900 dark:text-neutral-100 leading-snug">
            {typeInfo.emoji} {typeInfo.label}
            {item.grade ? ` Grade ${item.grade}` : ''}
          </h3>
          <span
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full
              text-[10px] font-medium tracking-wide
              bg-emerald-50 text-emerald-700
              dark:bg-emerald-950/40 dark:text-emerald-400
              border border-emerald-200/60 dark:border-emerald-800/50
              shrink-0"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Tersedia
          </span>
        </div>

        {/* Weight */}
        {weight && (
          <div className="flex items-center gap-1.5 text-sm text-neutral-500 dark:text-neutral-400">
            <Scale className="w-3.5 h-3.5 shrink-0" />
            <span>{weight}</span>
          </div>
        )}

        {/* Tag */}
        {item.tag && (
          <p className="text-[11px] text-neutral-400 dark:text-neutral-500 font-mono truncate">
            #{item.tag}
          </p>
        )}

        {/* Spacer */}
        <div className="flex-1" />

        {/* Price + CTA */}
        <div className="pt-2 border-t border-neutral-100 dark:border-neutral-800 space-y-3">
          {item.hargaJual ? (
            <p className="text-xl font-bold text-neutral-900 dark:text-neutral-100 tracking-tight">
              {formatRupiah(item.hargaJual)}
            </p>
          ) : (
            <p className="text-sm text-neutral-400 dark:text-neutral-500 italic">
              Harga on request
            </p>
          )}

          <button
            type="button"
            onClick={() => {
              const message = `Halo Millenials Farm!, Saya mau pesan ${typeInfo.label} dengan kode ${item.sku}`;
              window.open(
                `https://wa.me/+6287785925431?text=${encodeURIComponent(message)}`,
                '_blank',
                'noopener,noreferrer',
              );
            }}
            className={[
              'w-full flex items-center justify-center gap-2',
              'min-h-[44px] px-4 py-2.5 rounded-xl',
              'bg-neutral-900 dark:bg-neutral-100',
              'text-white dark:text-neutral-900',
              'text-sm font-semibold',
              'active:scale-95 transition-all duration-150',
              'lg:group-hover:gap-3',
            ].join(' ')}
          >
            Hubungi Kami
            <ArrowRight className="w-4 h-4 lg:transition-transform lg:duration-200 lg:group-hover:translate-x-0.5" />
          </button>
        </div>
      </div>
    </article>
  );
}
