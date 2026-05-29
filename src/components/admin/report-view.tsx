'use client';

// Report shell — toolbar (date controls + view toggle + PDF link) over one
// of two child views: Sampul (magazine cover) or Briefing (card grid). The
// active view is encoded in the URL as `?view=sampul|briefing` so it's
// shareable and the PDF link can mirror it.

import { useRouter, useSearchParams } from 'next/navigation';
import { Download, ChevronLeft, ChevronRight, FileText, LayoutGrid } from 'lucide-react';
import type { ReportData } from '@/lib/report/get-report';
import { SampulView } from './report/sampul-view';
import { BriefingView } from './report/briefing-view';

type ViewKind = 'sampul' | 'briefing';

export function ReportView({ data }: { data: ReportData }) {
  const router = useRouter();
  const search = useSearchParams();
  const view: ViewKind = search.get('view') === 'briefing' ? 'briefing' : 'sampul';

  const { start, end } = data.range;

  function push(params: Record<string, string>) {
    const sp = new URLSearchParams(search.toString());
    for (const [k, v] of Object.entries(params)) sp.set(k, v);
    router.push(`/admin/laporan?${sp.toString()}`);
  }
  function go(s: string, e: string) { push({ start: s, end: e }); }
  function setYear(y: number) { go(`${y}-01-01`, `${y}-12-31`); }
  function thisMonth() {
    const now = new Date();
    const first = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const last = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0));
    go(first.toISOString().slice(0, 10), last.toISOString().slice(0, 10));
  }
  function setView(v: ViewKind) { push({ view: v }); }

  return (
    <div className="flex flex-col gap-5">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 rounded-xl border bg-card p-2.5">
        <div className="inline-flex items-center rounded-lg border bg-background h-8">
          <button onClick={() => setYear(data.range.year - 1)} className="inline-flex items-center justify-center size-8 hover:bg-muted/50 rounded-l-lg" title="Tahun sebelumnya">
            <ChevronLeft className="size-4" />
          </button>
          <span className="px-2 text-xs font-semibold tabular-nums">{data.range.year}</span>
          <button onClick={() => setYear(data.range.year + 1)} className="inline-flex items-center justify-center size-8 hover:bg-muted/50 rounded-r-lg" title="Tahun berikutnya">
            <ChevronRight className="size-4" />
          </button>
        </div>
        <button onClick={() => setYear(new Date().getUTCFullYear())} className="h-8 px-3 rounded-lg border text-xs hover:bg-muted/50">Tahun ini</button>
        <button onClick={() => setYear(new Date().getUTCFullYear() - 1)} className="h-8 px-3 rounded-lg border text-xs hover:bg-muted/50">Tahun lalu</button>
        <button onClick={thisMonth} className="h-8 px-3 rounded-lg border text-xs hover:bg-muted/50">Bulan ini</button>
        <div className="mx-1 h-5 w-px bg-border" />
        <input type="date" value={start} onChange={(e) => go(e.target.value, end)} className="h-8 rounded-lg border bg-background px-2 text-xs" />
        <span className="text-xs text-muted-foreground">s/d</span>
        <input type="date" value={end} onChange={(e) => go(start, e.target.value)} className="h-8 rounded-lg border bg-background px-2 text-xs" />

        {/* View toggle — Sampul (cover) / Briefing (grid) */}
        <div className="ml-auto inline-flex items-center rounded-lg border bg-background h-8 p-0.5">
          <ViewBtn active={view === 'sampul'} onClick={() => setView('sampul')} icon={<FileText className="size-3.5" />} label="Sampul" />
          <ViewBtn active={view === 'briefing'} onClick={() => setView('briefing')} icon={<LayoutGrid className="size-3.5" />} label="Briefing" />
        </div>

        <a
          href={`/api/laporan/pdf?start=${start}&end=${end}&view=${view}`}
          className="inline-flex items-center gap-1.5 h-8 px-3.5 rounded-lg text-xs font-semibold"
          style={{ background: 'var(--primary)', color: 'var(--sidebar-primary)' }}
        >
          <Download className="size-3.5" /> Unduh PDF
        </a>
      </div>

      {view === 'sampul' ? <SampulView data={data} /> : <BriefingView data={data} />}
    </div>
  );
}

function ViewBtn({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md text-xs font-semibold transition-colors ${active ? 'bg-foreground text-background' : 'text-muted-foreground hover:bg-muted/40'}`}
      title={label}
    >
      {icon}<span className="hidden sm:inline">{label}</span>
    </button>
  );
}
