const SERIF = "var(--font-dm-serif), 'DM Serif Display', serif";

type Accent = 'success' | 'warning' | 'info' | 'danger' | 'primary' | 'neutral';

const ACCENT_VAR: Record<Accent, string> = {
  success: 'var(--success-ring)',
  warning: 'var(--warning-ring)',
  info:    'var(--info-ring)',
  danger:  'var(--danger-ring)',
  primary: 'var(--primary)',
  neutral: 'var(--neutral-ring)',
};

export function StatCard({
  accent = 'neutral',
  label,
  value,
  sub,
}: {
  accent?: Accent;
  label: string;
  value: number | string;
  sub?: string;
}) {
  const color = ACCENT_VAR[accent];
  return (
    <div
      className="rounded-xl bg-card overflow-hidden"
      style={{ border: '1px solid var(--border)', borderLeft: `3px solid ${color}` }}
    >
      <div className="px-4 py-3.5">
        <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground mb-2">
          {label}
        </p>
        <p
          className="text-lg sm:text-2xl font-bold leading-none mb-1 truncate"
          style={{ fontFamily: SERIF, color }}
        >
          {value}
        </p>
        {sub && <p className="text-[11px] text-muted-foreground">{sub}</p>}
      </div>
    </div>
  );
}
