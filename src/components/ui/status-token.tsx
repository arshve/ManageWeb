import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

export type StatusIntent = 'success' | 'warning' | 'info' | 'danger' | 'neutral';

const tokenVariants = cva(
  'inline-flex items-center gap-1 rounded-full font-medium whitespace-nowrap',
  {
    variants: {
      intent: {
        success: 'bg-success-bg text-success-fg',
        warning: 'bg-warning-bg text-warning-fg',
        info:    'bg-info-bg text-info-fg',
        danger:  'bg-danger-bg text-danger-fg',
        neutral: 'bg-neutral-bg text-neutral-fg',
      },
      size: {
        sm: 'px-2 py-0.5 text-[10px]',
        md: 'px-2.5 py-0.5 text-[11px]',
      },
      outlined: {
        true:  'border',
        false: '',
      },
    },
    compoundVariants: [
      { outlined: true, intent: 'success', class: 'border-success-ring/40' },
      { outlined: true, intent: 'warning', class: 'border-warning-ring/40' },
      { outlined: true, intent: 'info',    class: 'border-info-ring/40' },
      { outlined: true, intent: 'danger',  class: 'border-danger-ring/40' },
      { outlined: true, intent: 'neutral', class: 'border-neutral-ring/40' },
    ],
    defaultVariants: { intent: 'neutral', size: 'md', outlined: false },
  },
);

export type StatusTokenProps = React.HTMLAttributes<HTMLSpanElement> &
  VariantProps<typeof tokenVariants> & { dot?: boolean };

export function StatusToken({
  intent,
  size,
  outlined,
  dot,
  className,
  children,
  ...rest
}: StatusTokenProps) {
  return (
    <span className={cn(tokenVariants({ intent, size, outlined }), className)} {...rest}>
      {dot && (
        <span
          className="w-1.5 h-1.5 rounded-full shrink-0"
          style={{ background: `var(--${intent ?? 'neutral'}-ring)` }}
        />
      )}
      {children}
    </span>
  );
}

export function intentVars(intent: StatusIntent): React.CSSProperties {
  return {
    '--token-bg':   `var(--${intent}-bg)`,
    '--token-fg':   `var(--${intent}-fg)`,
    '--token-ring': `var(--${intent}-ring)`,
  } as React.CSSProperties;
}

// Domain → intent maps — single source of truth

export const DELIVERY_STATUS: Record<string, { intent: StatusIntent; label: string }> = {
  DELIVERED:   { intent: 'success', label: 'Terkirim' },
  ON_DELIVERY: { intent: 'info',    label: 'Sedang Jalan' },
  ASSIGNED:    { intent: 'warning', label: 'Menunggu' },
  PENDING:     { intent: 'warning', label: 'Pending' },
  FAILED:      { intent: 'danger',  label: 'Gagal' },
};

export const PAYMENT_STATUS: Record<string, { intent: StatusIntent; label: string }> = {
  LUNAS:       { intent: 'success', label: 'Lunas' },
  DP:          { intent: 'warning', label: 'DP' },
  BELUM_BAYAR: { intent: 'neutral', label: 'Belum Bayar' },
};

export const QUEUE_STATUS: Record<string, { intent: StatusIntent; label: string }> = {
  PENDING:  { intent: 'warning', label: 'Menunggu' },
  APPROVED: { intent: 'success', label: 'Disetujui' },
  REJECTED: { intent: 'danger',  label: 'Ditolak' },
};
