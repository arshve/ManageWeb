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

/* ─── Hero AreaChart — catmull-rom smoothed curve w/ peak dot + label ─
   Editorial "data-viz cover" piece. Paints in currentColor so it inherits
   from the masthead's ink color. Labels thin themselves out at high N. */

export function AreaChart({
  data,
  valueKey = 'value',
  height = 220,
  peakLabel,
  strokeW = 2.5,
  gid = 'rd-ac',
  format = (v: number) => Math.round(v).toLocaleString('id-ID'),
}: {
  data: { label: string; [k: string]: string | number }[];
  valueKey?: string;
  height?: number;
  peakLabel?: string;
  strokeW?: number;
  gid?: string;
  format?: (v: number) => string;
}) {
  if (!data.length) return <Empty />;
  const w = 1000;
  const pad = { t: 28, r: 8, b: 26, l: 8 };
  const cw = w - pad.l - pad.r;
  const ch = height - pad.t - pad.b;
  const vals = data.map((d) => Number(d[valueKey] ?? 0));
  const max = Math.max(...vals, 1);
  const n = data.length;
  const xs = (i: number) => pad.l + (n === 1 ? cw / 2 : (i / (n - 1)) * cw);
  const ys = (v: number) => pad.t + ch - (v / max) * ch;
  const pts = vals.map((v, i) => [xs(i), ys(v)] as const);

  // catmull-rom → bezier (same math as the design prototype)
  let path = `M ${pts[0][0]} ${pts[0][1]}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] || p2;
    const c1x = p1[0] + (p2[0] - p0[0]) / 6;
    const c1y = p1[1] + (p2[1] - p0[1]) / 6;
    const c2x = p2[0] - (p3[0] - p1[0]) / 6;
    const c2y = p2[1] - (p3[1] - p1[1]) / 6;
    path += ` C ${c1x} ${c1y}, ${c2x} ${c2y}, ${p2[0]} ${p2[1]}`;
  }
  const area = `${path} L ${pts[n - 1][0]} ${pad.t + ch} L ${pts[0][0]} ${pad.t + ch} Z`;
  const peakIdx = vals.reduce((bi, v, i) => (v > vals[bi] ? i : bi), 0);
  const labelEvery = Math.max(1, Math.ceil(n / 8));

  return (
    <svg viewBox={`0 0 ${w} ${height}`} width="100%" height={height} preserveAspectRatio="none" style={{ display: 'block', overflow: 'visible' }}>
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="currentColor" stopOpacity={0.22} />
          <stop offset="100%" stopColor="currentColor" stopOpacity={0} />
        </linearGradient>
      </defs>
      <line x1={pad.l} y1={pad.t + ch + 0.5} x2={w - pad.r} y2={pad.t + ch + 0.5} stroke="currentColor" strokeOpacity={0.18} strokeWidth={1} />
      <path d={area} fill={`url(#${gid})`} className="report-fade" />
      <path
        d={path}
        fill="none"
        stroke="currentColor"
        strokeWidth={strokeW}
        strokeLinecap="round"
        strokeLinejoin="round"
        className="report-line"
        style={{ vectorEffect: 'non-scaling-stroke' }}
      />
      <circle cx={pts[peakIdx][0]} cy={pts[peakIdx][1]} r={4} fill="var(--success-fg)" className="report-fade" style={{ animationDelay: '300ms' }} />
      <text
        x={pts[peakIdx][0]}
        y={pts[peakIdx][1] - 12}
        textAnchor="middle"
        fontSize="20"
        fill="var(--success-fg)"
        className="report-fade"
        style={{ fontFamily: SERIF, animationDelay: '400ms' }}
      >
        {peakLabel ?? format(vals[peakIdx])}
      </text>
      {data.map((d, i) =>
        i % labelEvery === 0 || i === n - 1 ? (
          <text key={i} x={pts[i][0]} y={height - 6} textAnchor="middle" fontSize="13" fill="currentColor" fillOpacity={0.45}>
            {d.label}
          </text>
        ) : null,
      )}
    </svg>
  );
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

/* ─── Spark — tiny axis-less area for KPI cards (briefing view) ─────── */

export function Spark({
  data,
  valueKey = 'value',
  height = 38,
  gid = 'sp',
  accent = 'var(--success-fg)',
}: {
  data: { [k: string]: string | number }[];
  valueKey?: string;
  height?: number;
  gid?: string;
  accent?: string;
}) {
  if (data.length < 2) return null;
  const w = 200;
  const vals = data.map((d) => Number(d[valueKey] ?? 0));
  const max = Math.max(...vals, 1);
  const n = data.length;
  const xs = (i: number) => (i / (n - 1)) * w;
  const ys = (v: number) => height - 3 - (v / max) * (height - 6);
  const pts = vals.map((v, i) => [xs(i), ys(v)] as const);

  let path = `M ${pts[0][0]} ${pts[0][1]}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] || p2;
    path += ` C ${p1[0] + (p2[0] - p0[0]) / 6} ${p1[1] + (p2[1] - p0[1]) / 6}, ${p2[0] - (p3[0] - p1[0]) / 6} ${p2[1] - (p3[1] - p1[1]) / 6}, ${p2[0]} ${p2[1]}`;
  }
  const peakIdx = vals.reduce((bi, v, i) => (v > vals[bi] ? i : bi), 0);
  return (
    <svg viewBox={`0 0 ${w} ${height}`} width="100%" height={height} preserveAspectRatio="none" style={{ display: 'block', overflow: 'visible' }}>
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="currentColor" stopOpacity={0.16} />
          <stop offset="100%" stopColor="currentColor" stopOpacity={0} />
        </linearGradient>
      </defs>
      <path d={`${path} L ${w} ${height} L 0 ${height} Z`} fill={`url(#${gid})`} className="report-fade" />
      <path d={path} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="report-line" style={{ vectorEffect: 'non-scaling-stroke' }} />
      <circle cx={pts[peakIdx][0]} cy={pts[peakIdx][1]} r={3} fill={accent} className="report-fade" style={{ animationDelay: '300ms' }} />
    </svg>
  );
}

/* ─── Vertical bar series (weekly / monthly) — rounded bars, peak highlighted
   in `--success-fg` with the peak value drawn above. Used by the cover-style
   "Penjualan per pekan" block in the editorial report. ─────────────────── */

export function MonthlyBars({
  data,
  height = 200,
  format = (v: number) => Math.round(v).toLocaleString('id-ID'),
  color = 'currentColor',
  accent = 'var(--success-fg)',
}: {
  data: { label: string; value: number }[];
  height?: number;
  format?: (v: number) => string;
  color?: string;
  accent?: string;
}) {
  if (!data.length) return <Empty />;
  const max = Math.max(...data.map((d) => d.value), 1);
  const peakIdx = data.reduce((bi, d, i) => (d.value > data[bi].value ? i : bi), 0);
  return (
    <div className="flex items-end w-full" style={{ height }}>
      {data.map((d, i) => {
        const h = Math.max((d.value / max) * (height - 40), 3);
        const isPeak = i === peakIdx && d.value > 0;
        return (
          <div key={i} className="flex-1 flex flex-col items-center justify-end gap-2 h-full">
            {isPeak && (
              <span className="text-[13px] leading-none whitespace-nowrap" style={{ fontFamily: SERIF, color: accent }}>
                {format(d.value)}
              </span>
            )}
            <div
              className="report-bar-y"
              title={`${d.label}: ${format(d.value)}`}
              style={{
                width: '62%',
                maxWidth: 30,
                height: h,
                borderRadius: 5,
                background: isPeak ? accent : color,
                opacity: isPeak ? 1 : 0.78,
                animationDelay: `${i * 45}ms`,
              }}
            />
            <span className={`text-[11px] leading-none ${isPeak ? 'font-bold' : 'font-normal'} text-muted-foreground`}>{d.label}</span>
          </div>
        );
      })}
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
  mono = false,
}: {
  data: { label: string; value: number; color: string }[];
  size?: number;
  center?: { primary: string; secondary?: string };
  /** When true, ignore each segment's `color` and paint in currentColor with
   * a decreasing-opacity ramp — keeps the page monochrome so green/red can
   * stay reserved for up/down deltas only. */
  mono?: boolean;
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
  const monoOps = [1, 0.5, 0.26, 0.16, 0.1];
  const segStroke = (d: { color: string }) => (mono ? 'currentColor' : d.color);
  const segOp = (i: number) => (mono ? monoOps[Math.min(i, monoOps.length - 1)] : 1);

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
                stroke={segStroke(d)}
                strokeOpacity={segOp(i)}
                strokeWidth={stroke}
                strokeLinecap={mono ? 'butt' : 'round'}
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
            <span className="size-2 rounded-full shrink-0 translate-y-px" style={{ background: segStroke(d), opacity: segOp(i) }} />
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
