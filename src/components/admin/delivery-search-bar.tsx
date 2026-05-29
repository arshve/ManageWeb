'use client';

// Search bar for delivery route pages (sales + admin views). Lets the user
// type any of: invoice, buyer name, sales name, driver name, SKU, or animal
// tag and jump straight to that stop card on the page — without filtering
// the route out of context. The full route stays visible so they can see
// where the entry sits in the queue.

import { useEffect, useMemo, useRef, useState } from 'react';
import { Search, X } from 'lucide-react';

export type DeliverySearchRow = {
  id: string;
  invoiceNo: string;
  buyerName: string;
  salesName: string | null;
  driverName: string | null;
  sequence: number | null;
  status: string;
  skus: string[];
  tags: string[];
};

export function DeliverySearchBar({
  rows,
  onBeforeJump,
}: {
  rows: DeliverySearchRow[];
  /**
   * Called with the matched stop id right before scrolling. Lets the parent
   * expand a collapsed group or switch tabs so the target is actually visible
   * before scrollIntoView runs.
   */
  onBeforeJump?: (id: string) => void;
}) {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const matches = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return [] as DeliverySearchRow[];
    return rows
      .filter((r) => {
        if (r.invoiceNo.toLowerCase().includes(needle)) return true;
        if (r.buyerName.toLowerCase().includes(needle)) return true;
        if ((r.salesName ?? '').toLowerCase().includes(needle)) return true;
        if ((r.driverName ?? '').toLowerCase().includes(needle)) return true;
        if (r.skus.some((s) => s.toLowerCase().includes(needle))) return true;
        if (r.tags.some((t) => t.toLowerCase().includes(needle))) return true;
        return false;
      })
      .slice(0, 12);
  }, [q, rows]);

  function jumpTo(id: string) {
    // Let the parent expand the right group / switch tabs first, then wait a
    // frame so the now-visible target exists in layout before we scroll to it.
    onBeforeJump?.(id);
    setQ('');
    setOpen(false);
    requestAnimationFrame(() => {
      // Both desktop <tr> and mobile <div> render the same data-stop-id; pick
      // whichever is currently visible at the breakpoint.
      const all = Array.from(
        document.querySelectorAll<HTMLElement>(`[data-stop-id="${CSS.escape(id)}"]`),
      );
      const target = all.find((el) => el.offsetParent !== null) ?? all[0] ?? null;
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'center' });
        target.classList.add('outline', 'outline-2', 'outline-info-ring', 'outline-offset-2', 'rounded-md');
        setTimeout(() => {
          target.classList.remove('outline', 'outline-2', 'outline-info-ring', 'outline-offset-2', 'rounded-md');
        }, 2400);
      }
    });
  }

  return (
    <div ref={wrapRef} className="relative w-full">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
      <input
        value={q}
        onChange={(e) => { setQ(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && matches[0]) { e.preventDefault(); jumpTo(matches[0].id); }
          else if (e.key === 'Escape') { setOpen(false); }
        }}
        placeholder="Cari invoice / pembeli / driver / SKU / tag…"
        className="h-9 w-full pl-9 pr-9 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring/30"
        aria-label="Cari di rute pengiriman"
      />
      {q && (
        <button
          type="button"
          onClick={() => { setQ(''); setOpen(false); }}
          className="absolute right-2 top-1/2 -translate-y-1/2 size-5 inline-flex items-center justify-center rounded text-muted-foreground hover:bg-muted"
          title="Bersihkan"
        >
          <X className="size-3.5" />
        </button>
      )}
      {open && q.trim() && (
        <div className="absolute z-30 mt-1 w-full rounded-md border bg-popover text-popover-foreground shadow-lg max-h-80 overflow-y-auto">
          {matches.length === 0 ? (
            <p className="px-3 py-3 text-xs text-muted-foreground">Tidak ada hasil.</p>
          ) : (
            <ul className="py-1">
              {matches.map((m) => (
                <li key={m.id}>
                  <button
                    type="button"
                    onClick={() => jumpTo(m.id)}
                    className="w-full px-3 py-2 text-left hover:bg-muted flex items-center gap-2.5"
                  >
                    <span className="text-[10px] font-mono tabular-nums w-7 shrink-0 text-muted-foreground">
                      {(m.sequence ?? -1) >= 0 ? `#${(m.sequence ?? 0) + 1}` : '—'}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{m.buyerName}</div>
                      <div className="text-[11px] text-muted-foreground truncate">
                        <span className="font-mono">{m.invoiceNo}</span>
                        {m.driverName ? ` · ${m.driverName}` : ' · belum di-assign'}
                        {m.salesName ? ` · ${m.salesName}` : ''}
                      </div>
                    </div>
                    {m.status && (
                      <span className="text-[10px] text-muted-foreground shrink-0">{m.status}</span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
