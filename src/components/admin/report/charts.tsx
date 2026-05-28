'use client';

// Dependency-free SVG/HTML charts for the on-screen report. Editorial styling
// (thin, rounded, restrained) + pure-CSS reveal animations. Same look as the
// PDF so the on-screen report and the download match.

import { useEffect, useRef, useState } from 'react';

const SERIF = "var(--font-dm-serif), 'DM Serif Display', serif";

/* ─── CountUp ───────────────────────────────────────────────────────── */

const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

export function CountUp({
  value,
  format = (v: number) => Math.round(v).toLocaleString('id-ID'),
  duration = 900,
  className,
  style,
}: {
  value: number;
  format?: (v: number) => string;
  duration?: number;
  className?: string;
  style?: React.CSSProperties;
}) {
  const [n, setN] = useState(0);
  const fromRef = useRef(0);
  const startRef = useRef<number | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return setN(value);
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return setN(value);

    const from = fromRef.current;
    startRef.current = null;
    let raf = 0;
    const tick = (ts: number) => {
      if (startRef.current === null) startRef.current = ts;
      const t = Math.min(1, (ts - startRef.current) / duration);
      const cur = from + (value - from) * easeOutCubic(t);
      setN(cur);
      if (t < 1) raf = requestAnimationFrame(tick);
      else fromRef.current = value;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);

  return <span className={className} style={style}>{format(n)}</span>;
}

/* ─── Vertical bars ─────────────────────────────────────────────────── */

export function VerticalBars({
  data,
  color = 'currentColor',
  height = 150,
}: {
  data: { label: string; value: number }[];
  color?: string;
  height?: number;
}) {
  if (!data.length) return <Empty />;
  const max = Math.max(...data.map((d) => d.value), 1);
  const n = data.length;
  const gap = 5;
  const bw = 26;
  const w = n * bw + (n - 1) * gap;
  const chartH = height - 20;
  const labelEvery = Math.ceil(n / 14);

  return (
    <svg viewBox={`0 0 ${Math.max(w, 1)} ${height}`} width="100%" height={height} preserveAspectRatio="xMinYMid meet">
      <line x1={0} y1={chartH + 0.5} x2={w} y2={chartH + 0.5} stroke="currentColor" strokeOpacity={0.12} strokeWidth={1} />
      {data.map((d, i) => {
        const h = Math.max((d.value / max) * chartH, 2);
        const x = i * (bw + gap);
        const y = chartH - h;
        return (
          <g key={i}>
            <title>{`${d.label}: ${Math.round(d.value).toLocaleString('id-ID')}`}</title>
            <rect
              x={x} y={y} width={bw} height={h} rx={bw / 2} fill={color}
              className="report-bar-y"
              style={{ animationDelay: `${i * 18}ms` }}
            />
            {i % labelEvery === 0 && (
              <text x={x + bw / 2} y={height - 5} textAnchor="middle" fontSize="8" fill="currentColor" fillOpacity={0.45}>
                {d.label}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

/* ─── Combo daily chart: penjualan bars + profit line ───────────────── */

export function ComboDaily({
  data,
  barColor = 'currentColor',
  lineColor = 'var(--success-fg)',
  height = 170,
  format = (v: number) => Math.round(v).toLocaleString('id-ID'),
}: {
  data: { label: string; bar: number; line: number }[];
  barColor?: string;
  lineColor?: string;
  height?: number;
  format?: (v: number) => string;
}) {
  if (!data.length) return <Empty />;
  const max = Math.max(...data.map((d) => Math.max(d.bar, d.line)), 1);
  const n = data.length;
  const gap = 5;
  const bw = 26;
  const w = n * bw + (n - 1) * gap;
  const chartH = height - 22;
  const labelEvery = Math.ceil(n / 14);

  // baseline-to-baseline polyline for profit
  const pts = data.map((d, i) => {
    const x = i * (bw + gap) + bw / 2;
    const y = chartH - (d.line / max) * chartH;
    return `${x},${y}`;
  }).join(' ');

  return (
    <div className="w-full">
      <div className="flex items-center gap-4 text-[10px] uppercase tracking-[0.2em] text-muted-foreground mb-1.5">
        <span className="inline-flex items-center gap-1.5"><span className="size-2 rounded-full" style={{ background: barColor }} />Penjualan</span>
        <span className="inline-flex items-center gap-1.5"><span className="w-3 h-[2px] rounded-full" style={{ background: lineColor }} />Profit</span>
      </div>
      <svg viewBox={`0 0 ${Math.max(w, 1)} ${height}`} width="100%" height={height} preserveAspectRatio="xMinYMid meet">
        <line x1={0} y1={chartH + 0.5} x2={w} y2={chartH + 0.5} stroke="currentColor" strokeOpacity={0.12} strokeWidth={1} />
        {data.map((d, i) => {
          const h = Math.max((d.bar / max) * chartH, 2);
          const x = i * (bw + gap);
          const y = chartH - h;
          return (
            <g key={i}>
              <title>{`${d.label} · Penjualan ${format(d.bar)} · Profit ${format(d.line)}`}</title>
              <rect
                x={x} y={y} width={bw} height={h} rx={bw / 2} fill={barColor}
                className="report-bar-y"
                style={{ animationDelay: `${i * 18}ms` }}
              />
              {i % labelEvery === 0 && (
                <text x={x + bw / 2} y={height - 5} textAnchor="middle" fontSize="8" fill="currentColor" fillOpacity={0.45}>
                  {d.label}
                </text>
              )}
            </g>
          );
        })}
        <polyline
          fill="none" stroke={lineColor} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"
          points={pts}
          className="report-line"
        />
        {data.map((d, i) => {
          const x = i * (bw + gap) + bw / 2;
          const y = chartH - (d.line / max) * chartH;
          return <circle key={i} cx={x} cy={y} r={2.4} fill={lineColor} className="report-fade" style={{ animationDelay: `${300 + i * 18}ms` }} />;
        })}
      </svg>
    </div>
  );
}

/* ─── Monthly timeline (12 bars Jan–Des, with peak + future-month state) ─ */

export function MonthlyTimeline({
  data,
  color = 'currentColor',
  peakColor = 'var(--success-fg)',
  height = 180,
  format = (v: number) => Math.round(v).toLocaleString('id-ID'),
}: {
  data: { label: string; value: number; isFuture?: boolean }[];
  color?: string;
  peakColor?: string;
  height?: number;
  format?: (v: number) => string;
}) {
  if (!data.length) return <Empty />;
  const max = Math.max(...data.map((d) => d.value), 1);
  const peakIdx = data.reduce((bi, d, i) => (d.value > data[bi].value ? i : bi), 0);
  const n = data.length;
  const gap = 10;
  const bw = 34;
  const w = n * bw + (n - 1) * gap;
  const chartH = height - 30;

  return (
    <svg viewBox={`0 0 ${w} ${height}`} width="100%" height={height} preserveAspectRatio="xMinYMid meet">
      <line x1={0} y1={chartH + 0.5} x2={w} y2={chartH + 0.5} stroke="currentColor" strokeOpacity={0.12} strokeWidth={1} />
      {data.map((d, i) => {
        const h = Math.max((d.value / max) * chartH, d.value > 0 ? 3 : 2);
        const x = i * (bw + gap);
        const y = chartH - h;
        const isPeak = i === peakIdx && d.value > 0;
        const fill = d.isFuture ? 'currentColor' : isPeak ? peakColor : color;
        const opacity = d.isFuture ? 0.08 : isPeak ? 1 : 0.85;
        return (
          <g key={i}>
            <title>{`${d.label}: ${format(d.value)}${isPeak ? ' · puncak' : ''}${d.isFuture ? ' (akan datang)' : ''}`}</title>
            <rect
              x={x} y={y} width={bw} height={h} rx={4}
              fill={fill} opacity={opacity}
              className="report-bar-y"
              style={{ animationDelay: `${i * 40}ms` }}
            />
            {isPeak && (
              <text x={x + bw / 2} y={y - 6} textAnchor="middle" fontSize="9" fill={peakColor} fontWeight={700}>
                PUNCAK
              </text>
            )}
            <text x={x + bw / 2} y={height - 11} textAnchor="middle" fontSize="10" fill="currentColor" fillOpacity={d.isFuture ? 0.25 : 0.6}>
              {d.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

/* ─── Horizontal bars ───────────────────────────────────────────────── */

export function HorizontalBars({
  data,
  color = 'currentColor',
  format = (v: number) => Math.round(v).toLocaleString('id-ID'),
}: {
  data: { label: string; value: number }[];
  color?: string;
  format?: (v: number) => string;
}) {
  if (!data.length) return <Empty />;
  const max = Math.max(...data.map((d) => d.value), 1);
  return (
    <div className="flex flex-col gap-2.5">
      {data.map((d, i) => (
        <div key={i} className="flex items-center gap-3 text-xs">
          <span className="w-28 shrink-0 truncate text-[11px] text-muted-foreground" title={d.label}>{d.label}</span>
          <div className="flex-1 h-2 rounded-full bg-muted/60 overflow-hidden">
            <div
              className="h-full rounded-full report-bar-x"
              style={{
                width: `${Math.max((d.value / max) * 100, 2)}%`,
                background: color,
                animationDelay: `${i * 60}ms`,
              }}
            />
          </div>
          <span className="w-24 shrink-0 text-right text-[13px] tabular-nums" style={{ fontFamily: SERIF }}>{format(d.value)}</span>
        </div>
      ))}
    </div>
  );
}

/* ─── Donut ─────────────────────────────────────────────────────────── */

export function Donut({
  data,
  size = 152,
  center,
}: {
  data: { label: string; value: number; color: string }[];
  size?: number;
  center?: { primary: string; secondary?: string };
}) {
  const total = data.reduce((s, d) => s + d.value, 0);
  if (!total) return <Empty />;
  const r = size / 2;
  const stroke = 14;
  const radius = r - stroke / 2 - 2;
  const circ = 2 * Math.PI * radius;
  let offset = 0;

  const primaryText = center?.primary ?? String(total);
  const secondaryText = center?.secondary ?? 'TOTAL';

  return (
    <div className="flex items-center gap-6 report-fade">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={r} cy={r} r={radius} fill="none" stroke="currentColor" strokeOpacity={0.08} strokeWidth={stroke} />
        <g transform={`rotate(-90 ${r} ${r})`}>
          {data.map((d, i) => {
            const dash = (d.value / total) * circ;
            const el = (
              <circle
                key={i}
                cx={r}
                cy={r}
                r={radius}
                fill="none"
                stroke={d.color}
                strokeWidth={stroke}
                strokeLinecap="round"
                strokeDasharray={`${Math.max(dash - 2, 0)} ${circ - Math.max(dash - 2, 0)}`}
                strokeDashoffset={-offset}
              />
            );
            offset += dash;
            return el;
          })}
        </g>
        <text x={r} y={r - 1} textAnchor="middle" fontSize="26" fill="currentColor" style={{ fontFamily: SERIF }}>{primaryText}</text>
        <text x={r} y={r + 15} textAnchor="middle" fontSize="8" fill="currentColor" fillOpacity={0.5} style={{ letterSpacing: 2 }}>{secondaryText}</text>
      </svg>
      <div className="flex flex-col gap-2">
        {data.map((d, i) => (
          <div key={i} className="flex items-baseline gap-2 text-xs">
            <span className="size-2 rounded-full shrink-0 translate-y-px" style={{ background: d.color }} />
            <span className="text-muted-foreground min-w-[60px]">{d.label}</span>
            <span className="text-sm tabular-nums" style={{ fontFamily: SERIF }}>
              <CountUp value={d.value} duration={700} />
            </span>
            <span className="text-[10px] text-muted-foreground">{Math.round((d.value / total) * 100)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Empty() {
  return <p className="text-xs text-muted-foreground py-6 text-center">Tidak ada data.</p>;
}
