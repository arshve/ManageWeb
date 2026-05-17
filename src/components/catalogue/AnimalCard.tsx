'use client';

import Image from 'next/image';
import { Scale, ArrowRight, Beef } from 'lucide-react';
import { formatRupiah, formatWeight } from '@/lib/format';
import type { AvailableLivestock } from '@/app/actions/livestock';
import { StatusToken } from '@/components/ui/status-token';

/* ─── Grade colour map ─────────────────────────────────────────────────────── */
const gradeConfig: Record<
  string,
  { label: string; bg: string; text: string; dot: string }
> = {
  A: {
    label: 'Grade A',
    bg: 'bg-success-bg',
    text: 'text-success-fg',
    dot: 'bg-success-ring',
  },
  B: {
    label: 'Grade B',
    bg: 'bg-warning-bg',
    text: 'text-warning-fg',
    dot: 'bg-warning-ring',
  },
  C: {
    label: 'Grade C',
    bg: 'bg-neutral-bg',
    text: 'text-neutral-fg',
    dot: 'bg-neutral-ring',
  },
  D: {
    label: 'Grade D',
    bg: 'bg-muted',
    text: 'text-muted-foreground',
    dot: 'bg-neutral-ring',
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
  isSold?: boolean;
}

export function AnimalCard({ item, priority = false, isSold = false }: AnimalCardProps) {
  const grade = item.grade ?? 'C';
  const gradeStyle = gradeConfig[grade] ?? gradeConfig['C'];
  const typeInfo = typeLabels[item.type] ?? { label: item.type, emoji: '🐾' };
  const weight = formatWeight(item.weightMin, item.weightMax);

  return (
    <article
      className={[
        'group relative flex flex-col bg-card',
        'rounded-2xl lg:rounded-3xl overflow-hidden',
        'border border-border/80',
        /* mobile: tap scale */
        'active:scale-[0.98] transition-transform duration-150',
        /* desktop: lift + shadow */
        'lg:hover:-translate-y-1 lg:hover:shadow-xl lg:hover:shadow-neutral-200/60',
        'lg:dark:hover:shadow-neutral-950/60',
        'lg:transition-all lg:duration-300',
      ].join(' ')}
    >
      {/* ── Image ──────────────────────────────────────────────────────────── */}
      <div className="relative aspect-[4/3] bg-muted overflow-hidden">
        {item.photoUrl ? (
          <Image
            src={item.photoUrl}
            alt={`${typeInfo.label}${item.grade ? ` Grade ${item.grade}` : ''} — ${item.sku}`}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            loading={priority ? 'eager' : 'lazy'}
            priority={priority}
            className={[
              'object-cover transition-transform duration-500 ease-out',
              isSold ? 'grayscale' : 'lg:group-hover:scale-105',
            ].join(' ')}
          />
        ) : (
          <div className={['w-full h-full flex items-center justify-center', isSold ? 'grayscale' : ''].join(' ')}>
            <Beef className="size-14 text-muted-foreground" />
          </div>
        )}

        {/* SOLD overlay */}
        {isSold && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/30 pointer-events-none">
            <span className={[
              'rotate-[-12deg] border-4 border-white/90',
              'text-white font-black text-2xl tracking-widest',
              'px-4 py-1 bg-black/40 select-none',
            ].join(' ')}>
              SOLD
            </span>
          </div>
        )}

        {/* Top-left: SKU badge */}
        <div className="absolute top-3 left-3">
          <span
            className={[
              'inline-flex items-center px-2 py-1 rounded-lg',
              'bg-card/90 backdrop-blur-sm',
              'text-[10px] font-mono font-semibold tracking-wider',
              'text-foreground',
              'border border-border/60',
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
          <h3 className="font-bold text-base text-foreground leading-snug">
            {typeInfo.emoji} {typeInfo.label}
            {item.grade ? ` Grade ${item.grade}` : ''}
          </h3>
          {isSold ? (
            <StatusToken intent="neutral" dot size="sm">Terjual</StatusToken>
          ) : (
            <StatusToken intent="success" dot size="sm">Tersedia</StatusToken>
          )}
        </div>

        {/* Weight */}
        {weight && (
          <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <Scale className="w-3.5 h-3.5 shrink-0" />
            <span>{weight}</span>
          </div>
        )}

        {/* Tag */}
        {item.tag && (
          <p className="text-[11px] text-muted-foreground font-mono truncate">
            #{item.tag}
          </p>
        )}

        {/* Spacer */}
        <div className="flex-1" />

        {/* Price + CTA */}
        <div className="pt-2 border-t border-border flex flex-col gap-3">
          {item.hargaJual ? (
            <p className="text-xl font-bold text-foreground tracking-tight">
              {formatRupiah(item.hargaJual)}
            </p>
          ) : (
            <p className="text-sm text-muted-foreground italic">
              Harga on request
            </p>
          )}

          {isSold ? (
            <button
              type="button"
              disabled
              className={[
                'w-full flex items-center justify-center gap-2',
                'min-h-[44px] px-4 py-2.5 rounded-xl',
                'border border-border',
                'text-muted-foreground',
                'text-sm font-semibold',
                'cursor-not-allowed opacity-60',
              ].join(' ')}
            >
              Terjual
            </button>
          ) : (
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
                'bg-primary',
                'text-primary-foreground',
                'text-sm font-semibold',
                'active:scale-95 transition-all duration-150',
                'lg:group-hover:gap-3',
              ].join(' ')}
            >
              Hubungi Kami
              <ArrowRight className="size-4 lg:transition-transform lg:duration-200 lg:group-hover:translate-x-0.5" />
            </button>
          )}
        </div>
      </div>
    </article>
  );
}
