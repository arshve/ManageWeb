'use client';

import { useState, useMemo, useRef, useEffect, useTransition, type Dispatch, type SetStateAction } from 'react';
import { createCashflow, deleteCashflow } from '@/app/actions/cashflow';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { RupiahInput } from '@/components/ui/rupiah-input';
import { StatusToken, PAYMENT_STATUS } from '@/components/ui/status-token';
import { formatRupiah } from '@/lib/format';
import {
  ChevronDown,
  Phone,
  CreditCard,
  FileText,
  Trash2,
  ArrowDown,
  ArrowUp,
  Plus,
  TrendingUp,
  TrendingDown,
  FileStack,
  Search,
  Tag,
  Layers,
  X,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

/* ── Types ───────────────────────────────────────────────────────────────── */

interface EntryData {
  id: string;
  hargaJual: number;
  hargaModal: number;
  resellerCut: number;
  profit: number;
  paymentStatus: 'BELUM_BAYAR' | 'DP' | 'LUNAS';
  dp: number | null;
  buyerName: string;
  buyerAddress: string | null;
  salesId: string;
  livestock: {
    sku: string;
    tag: string | null;
    photoUrl: string | null;
  };
}

interface SalesUser {
  id: string;
  name: string;
  phone: string | null;
  rekBank: string | null;
}

interface CashflowItem {
  id: string;
  type: 'PENGELUARAN' | 'PEMASUKAN';
  name: string;
  amount: number;
  category: string | null;
  sourceBank: string | null;
  description: string | null;
  tag: string | null;
  date: string;
}

interface FinanceViewProps {
  entries: EntryData[];
  salesUsers: SalesUser[];
  cashflows: CashflowItem[];
}

const SERIF = "var(--font-dm-serif), 'DM Serif Display', serif";

const AVATAR_HEXES = [
  '#c2855a', '#5a7fc2', '#7a5ac2',
  '#c25a8f', '#5ac276', '#c2a85a', '#5ac2b8',
];

function getAvatarHex(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++)
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_HEXES[Math.abs(hash) % AVATAR_HEXES.length];
}

/* ── Small helpers ───────────────────────────────────────────────────────── */

function StatusBadge({ status }: { status: string }) {
  const ds = PAYMENT_STATUS[status as keyof typeof PAYMENT_STATUS] ?? { intent: 'neutral' as const, label: status };
  return <StatusToken intent={ds.intent} size="sm">{ds.label}</StatusToken>;
}

/* Single pill button used inside PillSelect. */
function Pill({ active, onClick, icon: Icon, children }: { active?: boolean; onClick: () => void; icon?: LucideIcon; children: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex max-w-full items-center gap-1 rounded-full px-2.5 py-1 text-[11px] cursor-pointer transition-all active:scale-95',
        active
          ? 'bg-foreground text-background font-medium shadow-sm'
          : 'bg-muted text-muted-foreground hover:bg-accent hover:text-foreground',
      )}
    >
      {Icon && <Icon className={cn('size-2.5 shrink-0', active ? 'opacity-80' : 'opacity-60')} />}
      <span className="truncate">{children}</span>
    </button>
  );
}

/**
 * Creatable single-select shown as pills. Pick an existing option or type a new
 * value (Enter / "+ tambah") — all in one field. Empty value = none selected.
 */
function PillSelect({
  value,
  onChange,
  options,
  placeholder,
  icon: Icon,
}: {
  value: string;
  onChange: (v: string) => void;
  options: string[];
  placeholder: string;
  icon?: LucideIcon;
}) {
  const [query, setQuery] = useState('');
  const q = query.trim();
  const lower = q.toLowerCase();
  const matches = q ? options.filter((o) => o.toLowerCase().includes(lower)) : options;
  const canCreate = q.length > 0 && !options.some((o) => o.toLowerCase() === lower);
  const valueOutside = value !== '' && !matches.some((o) => o.toLowerCase() === value.toLowerCase());

  function pick(v: string) {
    onChange(v.toLowerCase() === value.toLowerCase() ? '' : v);
    setQuery('');
  }
  function create() {
    if (canCreate) {
      onChange(q);
      setQuery('');
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="relative">
        {Icon && <Icon className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />}
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              if (canCreate) create();
              else if (matches.length === 1) pick(matches[0]);
            }
          }}
          placeholder={placeholder}
          className={cn('h-8 pr-7 text-xs', Icon && 'pl-8')}
        />
        {value !== '' && (
          <button
            type="button"
            onClick={() => onChange('')}
            title="Hapus pilihan"
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
          >
            <X className="size-3.5" />
          </button>
        )}
      </div>
      {(valueOutside || matches.length > 0 || canCreate) && (
        <div className="flex flex-wrap gap-1.5">
          {valueOutside && <Pill active icon={Icon} onClick={() => pick(value)}>{value}</Pill>}
          {matches.map((o) => (
            <Pill key={o} active={o.toLowerCase() === value.toLowerCase()} icon={Icon} onClick={() => pick(o)}>
              {o}
            </Pill>
          ))}
          {canCreate && (
            <button
              type="button"
              onClick={create}
              className="inline-flex items-center gap-1 rounded-full border border-dashed border-border px-2.5 py-1 text-[11px] text-muted-foreground hover:border-foreground/40 hover:text-foreground cursor-pointer transition-colors"
            >
              <Plus className="size-3" /> “{q}”
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/* Multi-select filter chip with a checkbox dropdown (kategori / tag / bank). */
function FilterDropdown({
  label,
  icon: Icon,
  options,
  selected,
  onToggle,
  onClear,
}: {
  label: string;
  icon: LucideIcon;
  options: string[];
  selected: Set<string>;
  onToggle: (v: string) => void;
  onClear: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);
  const count = selected.size;
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          'inline-flex h-8 items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 text-xs text-foreground cursor-pointer transition-colors hover:bg-muted/50 dark:bg-input/30',
          count > 0 && 'border-foreground/30 font-medium',
        )}
      >
        <Icon className="size-3 text-muted-foreground" />
        {label}
        {count > 0 && (
          <span className="inline-flex min-w-3.5 items-center justify-center rounded-full bg-foreground px-1 text-[9px] font-bold text-background">
            {count}
          </span>
        )}
        <ChevronDown className={cn('size-3 text-muted-foreground transition-transform', open && 'rotate-180')} />
      </button>
      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 max-h-56 min-w-[170px] overflow-y-auto rounded-lg border bg-card py-1 shadow-lg dark:bg-popover">
          {options.length === 0 ? (
            <p className="px-3 py-1.5 text-xs text-muted-foreground">Belum ada data</p>
          ) : (
            options.map((opt) => (
              <label key={opt} className="flex cursor-pointer items-center gap-2 px-3 py-1.5 text-xs hover:bg-accent">
                <input
                  type="checkbox"
                  checked={selected.has(opt)}
                  onChange={() => onToggle(opt)}
                  className="h-3.5 w-3.5 rounded border-border accent-foreground"
                />
                <span className="truncate">{opt}</span>
              </label>
            ))
          )}
          {count > 0 && (
            <button
              type="button"
              onClick={onClear}
              className="mt-1 w-full border-t px-3 py-1.5 text-left text-[11px] text-muted-foreground hover:text-foreground cursor-pointer"
            >
              Hapus pilihan
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/* ── Main Component ──────────────────────────────────────────────────────── */

export function FinanceView({ entries, salesUsers, cashflows }: FinanceViewProps) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [salesSearch, setSalesSearch] = useState('');
  const [salesPage, setSalesPage] = useState(0);
  const SALES_PAGE_SIZE = 5;
  const [cashflow, setCashflow] = useState<CashflowItem[]>(cashflows);
  const [cfType, setCfType] = useState<'PENGELUARAN' | 'PEMASUKAN'>('PENGELUARAN');
  const [cfName, setCfName] = useState('');
  const [cfAmount, setCfAmount] = useState('');
  const [cfCategory, setCfCategory] = useState('');
  const [cfSourceBank, setCfSourceBank] = useState('');
  const [cfDescription, setCfDescription] = useState('');
  const [cfTag, setCfTag] = useState('');
  // Granular filters for the expense list.
  const [cfSearch, setCfSearch] = useState('');
  const [cfTypeFilter, setCfTypeFilter] = useState<'ALL' | 'PENGELUARAN' | 'PEMASUKAN'>('ALL');
  const [cfCatFilter, setCfCatFilter] = useState<Set<string>>(new Set());
  const [cfTagFilter, setCfTagFilter] = useState<Set<string>>(new Set());
  const [cfBankFilter, setCfBankFilter] = useState<Set<string>>(new Set());
  const [cfPending, startCfTransition] = useTransition();
  const nameRef = useRef<HTMLInputElement>(null);

  // Distinct existing values → the pickable pills for kategori / tag.
  const cfCategories = useMemo(() => {
    const set = new Set<string>();
    cashflow.forEach((c) => { if (c.category) set.add(c.category); });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [cashflow]);
  const cfTags = useMemo(() => {
    const set = new Set<string>();
    cashflow.forEach((c) => { if (c.tag) set.add(c.tag); });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [cashflow]);
  const cfBanks = useMemo(() => {
    const set = new Set<string>();
    cashflow.forEach((c) => { if (c.sourceBank) set.add(c.sourceBank); });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [cashflow]);

  const totals = useMemo(() => {
    let penjualan = 0, modal = 0, fee = 0;
    let countLunas = 0, countDp = 0, countBelumBayar = 0;
    let diterimaLunas = 0, diterimaDP = 0, piutang = 0;
    entries.forEach((e) => {
      penjualan += e.hargaJual;
      modal += e.hargaModal;
      fee += e.resellerCut;
      if (e.paymentStatus === 'LUNAS') {
        countLunas++;
        diterimaLunas += e.hargaJual;
      } else if (e.paymentStatus === 'DP') {
        countDp++;
        diterimaDP += e.dp ?? 0;
        piutang += e.hargaJual - (e.dp ?? 0);
      } else {
        countBelumBayar++;
        piutang += e.hargaJual;
      }
    });
    const profit = penjualan - modal - fee;
    const avg = entries.length > 0 ? Math.round(penjualan / entries.length) : 0;
    const netAfterFee = penjualan - fee;
    return {
      penjualan, modal, fee, profit, avg, netAfterFee,
      count: entries.length, countLunas, countDp, countBelumBayar,
      diterimaLunas, diterimaDP, diterima: diterimaLunas + diterimaDP, piutang,
    };
  }, [entries]);

  const cfTotals = useMemo(() => {
    let pengeluaran = 0, pemasukan = 0;
    cashflow.forEach((item) => {
      if (item.type === 'PENGELUARAN') pengeluaran += item.amount;
      else pemasukan += item.amount;
    });
    return { pengeluaran, pemasukan, net: pemasukan - pengeluaran };
  }, [cashflow]);

  const perSales = useMemo(() => {
    const map = new Map<string, { user: SalesUser; entries: EntryData[]; totalPenjualan: number; totalFee: number; totalModal: number }>();
    salesUsers.forEach((u) => map.set(u.id, { user: u, entries: [], totalPenjualan: 0, totalFee: 0, totalModal: 0 }));
    entries.forEach((e) => {
      const record = map.get(e.salesId);
      if (record) {
        record.entries.push(e);
        record.totalPenjualan += e.hargaJual;
        record.totalFee += e.resellerCut;
        record.totalModal += e.hargaModal;
      }
    });
    return Array.from(map.values()).filter((r) => r.entries.length > 0);
  }, [entries, salesUsers]);

  const filteredSales = useMemo(() => {
    const q = salesSearch.trim().toLowerCase();
    if (!q) return perSales;
    return perSales.filter(
      (r) =>
        r.user.name.toLowerCase().includes(q) ||
        (r.user.phone?.toLowerCase().includes(q) ?? false) ||
        (r.user.rekBank?.toLowerCase().includes(q) ?? false),
    );
  }, [perSales, salesSearch]);

  const salesPageCount = Math.ceil(filteredSales.length / SALES_PAGE_SIZE);
  const pagedSales = filteredSales.slice(salesPage * SALES_PAGE_SIZE, (salesPage + 1) * SALES_PAGE_SIZE);

  const allExpanded = filteredSales.length > 0 && filteredSales.every((r) => expanded.has(r.user.id));

  function toggleAll() {
    if (allExpanded) setExpanded(new Set());
    else setExpanded(new Set(filteredSales.map((r) => r.user.id)));
  }

  function toggleOne(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function addCashflow() {
    const amount = parseFloat(cfAmount);
    if (!cfName.trim() || !amount || amount <= 0) return;
    const fd = new FormData();
    fd.set('type', cfType);
    fd.set('name', cfName.trim());
    fd.set('amount', String(amount));
    if (cfCategory.trim()) fd.set('category', cfCategory.trim());
    if (cfSourceBank.trim()) fd.set('sourceBank', cfSourceBank.trim());
    if (cfDescription.trim()) fd.set('description', cfDescription.trim());
    if (cfTag.trim()) fd.set('tag', cfTag.trim());
    startCfTransition(async () => {
      const res = await createCashflow(fd);
      if ('error' in res) { toast.error(res.error); return; }
      setCashflow((prev) => [{
        id: res.item.id, type: res.item.type, name: res.item.name,
        amount: res.item.amount, category: res.item.category,
        sourceBank: res.item.sourceBank, description: res.item.description, tag: res.item.tag,
        date: new Date(res.item.createdAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }),
      }, ...prev]);
      setCfName(''); setCfAmount(''); setCfCategory(''); setCfSourceBank(''); setCfDescription(''); setCfTag('');
      nameRef.current?.focus();
    });
  }

  function removeCashflow(id: string) {
    setCashflow((c) => c.filter((item) => item.id !== id));
    startCfTransition(async () => { await deleteCashflow(id); });
  }

  const isProfit = totals.profit >= 0;

  // The cashflow form is tinted by money direction: pengeluaran = danger,
  // pemasukan = success. One accent drives the toggle, amount + top edge.
  const isPengeluaran = cfType === 'PENGELUARAN';
  const cfAccent = isPengeluaran ? 'var(--danger-ring)' : 'var(--success-ring)';

  // Apply the granular filters; the list + its NET footer reflect this subset.
  const filteredCashflow = useMemo(() => {
    const q = cfSearch.trim().toLowerCase();
    return cashflow.filter((item) => {
      if (cfTypeFilter !== 'ALL' && item.type !== cfTypeFilter) return false;
      if (cfCatFilter.size && !(item.category && cfCatFilter.has(item.category))) return false;
      if (cfTagFilter.size && !(item.tag && cfTagFilter.has(item.tag))) return false;
      if (cfBankFilter.size && !(item.sourceBank && cfBankFilter.has(item.sourceBank))) return false;
      if (q) {
        const hay = [item.name, item.description, item.category, item.tag, item.sourceBank]
          .filter(Boolean).join(' ').toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [cashflow, cfSearch, cfTypeFilter, cfCatFilter, cfTagFilter, cfBankFilter]);

  const filteredNet = useMemo(() => {
    let p = 0, m = 0;
    filteredCashflow.forEach((i) => { if (i.type === 'PENGELUARAN') p += i.amount; else m += i.amount; });
    return p - m;
  }, [filteredCashflow]);

  const cfHasFilter =
    cfSearch.trim() !== '' || cfTypeFilter !== 'ALL' || cfCatFilter.size > 0 || cfTagFilter.size > 0 || cfBankFilter.size > 0;

  function toggleFilter(setter: Dispatch<SetStateAction<Set<string>>>, v: string) {
    setter((prev) => {
      const next = new Set(prev);
      if (next.has(v)) next.delete(v);
      else next.add(v);
      return next;
    });
  }

  function resetCfFilters() {
    setCfSearch('');
    setCfTypeFilter('ALL');
    setCfCatFilter(new Set());
    setCfTagFilter(new Set());
    setCfBankFilter(new Set());
  }

  return (
    <div className="flex flex-col gap-6">

      {/* ── 1. Profit Hero ───────────────────────────────────────────────── */}
      <div className="rounded-2xl border bg-card overflow-hidden">
        <div className="px-6 pt-5 pb-5">
          <div className="flex items-start justify-between gap-4 mb-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              Profit Bersih
            </p>
            <span
              className="inline-flex items-center gap-1 text-[10px] font-semibold rounded-full px-2.5 py-1"
              style={{
                background: isProfit ? 'var(--success-bg)' : 'var(--danger-bg)',
                color: isProfit ? 'var(--success-fg)' : 'var(--danger-fg)',
              }}
            >
              {isProfit ? <TrendingUp className="size-3" /> : <TrendingDown className="size-3" />}
              {isProfit ? 'Untung' : 'Rugi'}
            </span>
          </div>
          <p
            className="leading-none mb-2"
            style={{
              fontFamily: SERIF,
              fontSize: 40,
              color: isProfit ? 'var(--success-ring)' : 'var(--danger-ring)',
            }}
          >
            {formatRupiah(totals.profit)}
          </p>
          <p className="text-xs text-muted-foreground">
            Penjualan − Modal − Fee Sales &nbsp;·&nbsp; {totals.count} transaksi
          </p>
        </div>

        <div className="grid grid-cols-3 divide-x border-t">
          {[
            { label: 'Total Penjualan', value: formatRupiah(totals.penjualan) },
            { label: 'Total Modal',     value: formatRupiah(totals.modal) },
            { label: 'Fee Sales',       value: formatRupiah(totals.fee) },
          ].map((m) => (
            <div key={m.label} className="px-5 py-3.5">
              <p className="text-[9px] uppercase tracking-[0.08em] text-muted-foreground mb-1">{m.label}</p>
              <p className="text-sm font-medium tabular-nums">{m.value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── 2. Secondary stats + payment in one card ─────────────────────── */}
      <div className="rounded-xl border bg-card overflow-hidden">
        {/* Top: 4 stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 divide-x border-b">
          {[
            { label: 'Rata-rata / transaksi', value: formatRupiah(totals.avg) },
            { label: 'Net setelah fee',       value: formatRupiah(totals.netAfterFee) },
            { label: 'Pengeluaran',           value: formatRupiah(cfTotals.pengeluaran), color: cfTotals.pengeluaran > 0 ? 'var(--danger-ring)' : undefined },
            { label: 'Pemasukan',             value: formatRupiah(cfTotals.pemasukan),   color: cfTotals.pemasukan > 0 ? 'var(--success-ring)' : undefined },
          ].map((m) => (
            <div key={m.label} className="px-4 py-3.5">
              <p className="text-[9px] uppercase tracking-[0.07em] text-muted-foreground mb-1">{m.label}</p>
              <p className="text-sm font-semibold tabular-nums" style={m.color ? { color: m.color } : undefined}>{m.value}</p>
            </div>
          ))}
        </div>

        {/* Bottom: payment status */}
        <div className="px-5 py-4">
          <p className="text-[9px] uppercase tracking-[0.1em] text-muted-foreground mb-3">Status Pembayaran</p>
          {totals.penjualan > 0 && (
            <div className="flex rounded-full overflow-hidden h-1.5 mb-4 gap-px bg-border">
              {totals.diterimaLunas > 0 && (
                <div style={{ flex: totals.diterimaLunas, background: 'var(--success-ring)', minWidth: 3 }} />
              )}
              {totals.diterimaDP > 0 && (
                <div style={{ flex: totals.diterimaDP, background: 'var(--warning-ring)', minWidth: 3 }} />
              )}
              {totals.piutang > 0 && (
                <div style={{ flex: totals.piutang, background: 'var(--border)', minWidth: 3 }} />
              )}
            </div>
          )}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-y-3">
            {[
              { label: `Lunas · ${totals.countLunas}`,           value: formatRupiah(totals.diterimaLunas), color: 'var(--success-ring)' },
              { label: `DP · ${totals.countDp}`,                 value: formatRupiah(totals.diterimaDP),    color: 'var(--warning-ring)' },
              { label: `Belum Bayar · ${totals.countBelumBayar}`,value: `${totals.countBelumBayar} transaksi`, color: totals.countBelumBayar > 0 ? 'var(--danger-ring)' : undefined },
              { label: 'Uang Diterima',                          value: formatRupiah(totals.diterima) },
              { label: 'Piutang',                                value: formatRupiah(totals.piutang),        color: totals.piutang > 0 ? 'var(--danger-ring)' : undefined },
            ].map((m) => (
              <div key={m.label}>
                <p className="text-[9px] uppercase tracking-[0.06em] text-muted-foreground mb-0.5">{m.label}</p>
                <p className="text-sm font-semibold tabular-nums" style={m.color ? { color: m.color } : undefined}>{m.value}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── 3. Per-Sales ─────────────────────────────────────────────────── */}
      <div>
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2">
            <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Ringkasan Per Sales</p>
            <span className="text-[10px] font-semibold text-muted-foreground bg-muted px-2 py-0.5 rounded-full tabular-nums">
              {salesSearch.trim() ? `${filteredSales.length}/${perSales.length}` : perSales.length}
            </span>
          </div>
          {perSales.length > 0 && (
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
                <Input
                  value={salesSearch}
                  onChange={(e) => { setSalesSearch(e.target.value); setSalesPage(0); }}
                  placeholder="Cari sales…"
                  className="h-8 w-40 pl-8 text-xs sm:w-56"
                />
              </div>
              {filteredSales.length > 0 && (
                <button
                  onClick={toggleAll}
                  className="text-[11px] px-3 py-1 rounded-lg border border-border cursor-pointer transition-colors hover:bg-muted/50 text-muted-foreground whitespace-nowrap"
                >
                  {allExpanded ? 'Tutup semua' : 'Buka semua'}
                </button>
              )}
            </div>
          )}
        </div>

        {perSales.length === 0 ? (
          <div className="rounded-xl border bg-card px-5 py-12 text-center text-sm text-muted-foreground">
            Belum ada data penjualan
          </div>
        ) : filteredSales.length === 0 ? (
          <div className="rounded-xl border bg-card px-5 py-12 text-center text-sm text-muted-foreground">
            Tidak ada sales cocok dengan “{salesSearch}”
          </div>
        ) : (
          <>
            <div className="flex flex-col gap-2">
              {pagedSales.map((record) => (
                <SalesCard
                  key={record.user.id}
                  record={record}
                  isOpen={expanded.has(record.user.id)}
                  onToggle={() => toggleOne(record.user.id)}
                />
              ))}
            </div>
            {salesPageCount > 1 && (
              <div className="flex items-center justify-between mt-3">
                <span className="text-[11px] text-muted-foreground tabular-nums">
                  {salesPage * SALES_PAGE_SIZE + 1}–{Math.min((salesPage + 1) * SALES_PAGE_SIZE, filteredSales.length)} dari {filteredSales.length}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    disabled={salesPage === 0}
                    onClick={() => setSalesPage((p) => p - 1)}
                    className="px-2.5 py-1 text-xs rounded-md border text-muted-foreground hover:bg-muted/40 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  >←</button>
                  <span className="text-[11px] text-muted-foreground tabular-nums px-1">
                    {salesPage + 1} / {salesPageCount}
                  </span>
                  <button
                    disabled={salesPage >= salesPageCount - 1}
                    onClick={() => setSalesPage((p) => p + 1)}
                    className="px-2.5 py-1 text-xs rounded-md border text-muted-foreground hover:bg-muted/40 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  >→</button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* ── 4. Cashflow ──────────────────────────────────────────────────── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Pengeluaran / Pemasukan</p>
          <div className="flex items-center gap-1.5">
            <span
              className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium tabular-nums"
              style={{ background: 'var(--danger-bg)', color: 'var(--danger-fg)' }}
            >
              <ArrowDown className="size-3" /> {formatRupiah(cfTotals.pengeluaran)}
            </span>
            <span
              className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium tabular-nums"
              style={{ background: 'var(--success-bg)', color: 'var(--success-fg)' }}
            >
              <ArrowUp className="size-3" /> {formatRupiah(cfTotals.pemasukan)}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-start">
          {/* Input form */}
          <div className="relative flex flex-col gap-3 overflow-hidden rounded-xl border bg-card p-4">
            {/* Intent edge — recolors with the selected direction */}
            <span className="absolute inset-x-0 top-0 h-[3px] transition-colors" style={{ background: cfAccent }} />

            <div className="flex gap-1 rounded-xl bg-muted p-1">
              {(['PENGELUARAN', 'PEMASUKAN'] as const).map((tipe) => {
                const isPel = tipe === 'PENGELUARAN';
                const active = cfType === tipe;
                const tint = isPel
                  ? { background: 'var(--danger-bg)', color: 'var(--danger-fg)' }
                  : { background: 'var(--success-bg)', color: 'var(--success-fg)' };
                return (
                  <button
                    key={tipe}
                    onClick={() => setCfType(tipe)}
                    style={active ? tint : undefined}
                    className={cn(
                      'flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs cursor-pointer transition-all duration-150',
                      active ? 'font-semibold shadow-sm' : 'text-muted-foreground hover:text-foreground',
                    )}
                  >
                    {isPel ? <ArrowDown className="size-3.5" /> : <ArrowUp className="size-3.5" />}
                    {isPel ? 'Pengeluaran' : 'Pemasukan'}
                  </button>
                );
              })}
            </div>

            <Input
              ref={nameRef}
              placeholder="Nama transaksi…"
              value={cfName}
              onChange={(e) => setCfName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addCashflow()}
            />

            {/* Hero amount — tinted by intent as you type */}
            <RupiahInput
              placeholder="0"
              value={cfAmount}
              onValueChange={setCfAmount}
              onKeyDown={(e) => e.key === 'Enter' && addCashflow()}
              className={cn(
                'h-12 text-xl! font-semibold tabular-nums',
                cfAmount && (isPengeluaran ? 'text-[color:var(--danger-ring)]' : 'text-[color:var(--success-ring)]'),
              )}
            />

            <Input
              placeholder="Deskripsi (opsional)…"
              value={cfDescription}
              onChange={(e) => setCfDescription(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addCashflow()}
            />

            <div className="flex flex-col gap-1.5">
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <CreditCard className="size-3" />
                <p className="text-[10px] font-semibold uppercase tracking-[0.08em]">Bank / Sumber Dana</p>
              </div>
              <PillSelect
                value={cfSourceBank}
                onChange={setCfSourceBank}
                options={cfBanks}
                placeholder="Pilih atau ketik bank baru…"
                icon={CreditCard}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Layers className="size-3" />
                <p className="text-[10px] font-semibold uppercase tracking-[0.08em]">Kategori</p>
              </div>
              <PillSelect
                value={cfCategory}
                onChange={setCfCategory}
                options={cfCategories}
                placeholder="Pilih atau ketik kategori baru…"
                icon={Layers}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Tag className="size-3" />
                <p className="text-[10px] font-semibold uppercase tracking-[0.08em]">Tag</p>
              </div>
              <PillSelect
                value={cfTag}
                onChange={setCfTag}
                options={cfTags}
                placeholder="Pilih atau ketik tag baru…"
                icon={Tag}
              />
            </div>

            <Button onClick={addCashflow} disabled={cfPending} className="w-full gap-1.5">
              <Plus className="size-3.5" /> Tambah
            </Button>
          </div>

          {/* List */}
          <div className="rounded-xl border bg-card overflow-hidden">
            {cashflow.length === 0 ? (
              <div className="py-10 text-center text-sm text-muted-foreground">
                Belum ada catatan
              </div>
            ) : (
              <>
                {/* Filter toolbar */}
                <div className="flex flex-col gap-2 border-b bg-muted/20 p-3">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={cfSearch}
                      onChange={(e) => setCfSearch(e.target.value)}
                      placeholder="Cari catatan…"
                      className="h-8 pl-8 text-xs"
                    />
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <div className="flex rounded-lg bg-muted p-0.5 text-xs">
                      {([['ALL', 'Semua'], ['PENGELUARAN', 'Keluar'], ['PEMASUKAN', 'Masuk']] as const).map(([v, l]) => (
                        <button
                          key={v}
                          type="button"
                          onClick={() => setCfTypeFilter(v)}
                          className={cn(
                            'rounded-md px-2.5 py-1 cursor-pointer transition-colors',
                            cfTypeFilter === v ? 'bg-card shadow-sm font-medium text-foreground' : 'text-muted-foreground hover:text-foreground',
                          )}
                        >
                          {l}
                        </button>
                      ))}
                    </div>
                    <FilterDropdown label="Kategori" icon={Layers} options={cfCategories} selected={cfCatFilter} onToggle={(v) => toggleFilter(setCfCatFilter, v)} onClear={() => setCfCatFilter(new Set())} />
                    <FilterDropdown label="Tag" icon={Tag} options={cfTags} selected={cfTagFilter} onToggle={(v) => toggleFilter(setCfTagFilter, v)} onClear={() => setCfTagFilter(new Set())} />
                    <FilterDropdown label="Bank" icon={CreditCard} options={cfBanks} selected={cfBankFilter} onToggle={(v) => toggleFilter(setCfBankFilter, v)} onClear={() => setCfBankFilter(new Set())} />
                    {cfHasFilter && (
                      <button type="button" onClick={resetCfFilters} className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground cursor-pointer">
                        <X className="size-3" /> Reset
                      </button>
                    )}
                    <span className="ml-auto text-[11px] text-muted-foreground tabular-nums">
                      {cfHasFilter ? `${filteredCashflow.length}/${cashflow.length}` : cashflow.length}
                    </span>
                  </div>
                </div>

                {filteredCashflow.length === 0 ? (
                  <div className="py-10 text-center text-sm text-muted-foreground">
                    Tidak ada catatan yang cocok
                  </div>
                ) : (
                <div className="divide-y max-h-[340px] overflow-y-auto">
                  {filteredCashflow.map((item, i) => {
                    const isPemasukan = item.type === 'PEMASUKAN';
                    const edge = isPemasukan ? 'var(--success-ring)' : 'var(--danger-ring)';
                    const iconTint = isPemasukan
                      ? { background: 'var(--success-bg)', color: 'var(--success-fg)' }
                      : { background: 'var(--danger-bg)', color: 'var(--danger-fg)' };
                    return (
                      <div
                        key={item.id}
                        className="relative flex items-start gap-3 py-3 pl-5 pr-4 transition-colors hover:bg-muted/30 animate-in fade-in slide-in-from-bottom-1 fill-mode-both duration-300"
                        style={{ animationDelay: `${Math.min(i * 25, 250)}ms` }}
                      >
                        <span className="absolute inset-y-0 left-0 w-1" style={{ background: edge }} />
                        <div className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-md" style={iconTint}>
                          {isPemasukan ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[13px] font-medium truncate">{item.name}</p>
                          {item.description && (
                            <p className="text-[11px] text-muted-foreground truncate mt-0.5">{item.description}</p>
                          )}
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1">
                            <span className="text-[10px] text-muted-foreground">{item.date}</span>
                            {item.sourceBank && (
                              <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
                                <CreditCard className="size-2.5" /> {item.sourceBank}
                              </span>
                            )}
                            {item.category && (
                              <span className="text-[9px] uppercase bg-muted text-muted-foreground px-1.5 py-px rounded tracking-[0.04em]">
                                {item.category}
                              </span>
                            )}
                            {item.tag && (
                              <span
                                className="inline-flex items-center gap-0.5 text-[9px] px-1.5 py-px rounded-full"
                                style={{ background: 'var(--info-bg)', color: 'var(--info-fg)' }}
                              >
                                <Tag className="size-2.5" /> {item.tag}
                              </span>
                            )}
                          </div>
                        </div>
                        <span
                          className="shrink-0 text-sm tabular-nums mt-0.5"
                          style={{ fontFamily: SERIF, color: isPemasukan ? 'var(--success-ring)' : 'var(--danger-ring)' }}
                        >
                          {isPemasukan ? '+' : '−'} {formatRupiah(item.amount)}
                        </span>
                        <button
                          onClick={() => removeCashflow(item.id)}
                          className="size-6 rounded border border-border flex items-center justify-center shrink-0 cursor-pointer text-muted-foreground transition-colors hover:text-destructive hover:bg-destructive/5 mt-0.5"
                        >
                          <Trash2 className="size-3" />
                        </button>
                      </div>
                    );
                  })}
                </div>
                )}

                {filteredCashflow.length > 0 && (
                  <div className="flex items-center justify-between px-4 py-2.5 border-t bg-muted/30">
                    <span className="text-[10px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                      {cfHasFilter ? `Net · ${filteredCashflow.length} item` : 'Net'}
                    </span>
                    <span className="tabular-nums" style={{ fontFamily: SERIF, fontSize: 14, color: filteredNet > 0 ? 'var(--danger-ring)' : 'var(--success-ring)' }}>
                      {filteredNet >= 0 ? '−' : '+'} {formatRupiah(Math.abs(filteredNet))}
                    </span>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Sales Card ──────────────────────────────────────────────────────────── */

function SalesCard({
  record,
  isOpen,
  onToggle,
}: {
  record: { user: SalesUser; entries: EntryData[]; totalPenjualan: number; totalFee: number; totalModal: number };
  isOpen: boolean;
  onToggle: () => void;
}) {
  const hex = getAvatarHex(record.user.name);
  // Outstanding = anyone the sales still owes us money on (BELUM_BAYAR + DP).
  const outstandingCount = record.entries.filter(
    (e) => e.paymentStatus === 'BELUM_BAYAR' || e.paymentStatus === 'DP',
  ).length;

  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      <div
        className="hover:bg-muted/30 transition-colors cursor-pointer select-none"
        onClick={onToggle}
      >
        {/* Identity row */}
        <div className="flex items-center gap-3 px-4 py-3">
          {/* Avatar */}
          <div
            className="size-9 rounded-full flex items-center justify-center shrink-0 text-[13px] font-bold"
            style={{ background: hex + '20', color: hex, border: `1.5px solid ${hex}50` }}
          >
            {record.user.name.charAt(0).toUpperCase()}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm leading-tight truncate">{record.user.name}</p>
            <div className="flex flex-wrap items-center mt-0.5 gap-x-2 gap-y-0 text-[10px] text-muted-foreground">
              {record.user.phone && (
                <span className="inline-flex items-center gap-1">
                  <Phone className="h-2.5 w-2.5" /> {record.user.phone}
                </span>
              )}
              {record.user.rekBank && (
                <span className="inline-flex items-center gap-1">
                  <CreditCard className="h-2.5 w-2.5" /> {record.user.rekBank}
                </span>
              )}
              <span>{record.entries.length} transaksi</span>
            </div>
          </div>

          {/* Desktop stats — inline */}
          <div className="hidden sm:flex sm:items-center sm:gap-4 mr-1">
            <div className="text-right shrink-0">
              <p className="text-[9px] uppercase tracking-[0.05em] text-muted-foreground mb-0.5">Penjualan</p>
              <p className="tabular-nums" style={{ fontFamily: SERIF, fontSize: 14, color: 'var(--success-ring)' }}>
                {formatRupiah(record.totalPenjualan)}
              </p>
            </div>
            <div className="text-right shrink-0">
              <p className="text-[9px] uppercase tracking-[0.05em] text-muted-foreground mb-0.5">Modal</p>
              <p className="tabular-nums" style={{ fontFamily: SERIF, fontSize: 14, color: 'var(--muted-foreground)' }}>
                {formatRupiah(record.totalModal)}
              </p>
            </div>
            <div className="text-right shrink-0">
              <p className="text-[9px] uppercase tracking-[0.05em] text-muted-foreground mb-0.5">Fee</p>
              <p className="tabular-nums" style={{ fontFamily: SERIF, fontSize: 14, color: record.totalFee > 0 ? 'var(--warning-ring)' : 'var(--muted-foreground)' }}>
                {record.totalFee > 0 ? formatRupiah(record.totalFee) : '—'}
              </p>
            </div>
          </div>

          {/* Batch invoice (outstanding piutang only) */}
          {outstandingCount > 0 && (
            <button
              onClick={(e) => { e.stopPropagation(); window.open(`/api/batch-invoice/${record.user.id}`, '_blank'); }}
              title={`Batch invoice (${outstandingCount} tagihan terbuka)`}
              className="relative size-8 rounded-lg border border-border bg-muted flex items-center justify-center shrink-0 cursor-pointer transition-colors hover:bg-accent text-muted-foreground"
            >
              <FileStack className="h-3.5 w-3.5" />
              <span
                className="absolute -top-1.5 -right-1.5 min-w-4 h-4 px-1 rounded-full text-[9px] font-bold inline-flex items-center justify-center"
                style={{ background: 'var(--danger-ring)', color: 'var(--background)' }}
              >
                {outstandingCount}
              </span>
            </button>
          )}

          {/* Payslip */}
          <button
            onClick={(e) => { e.stopPropagation(); window.open(`/api/payslip/${record.user.id}`, '_blank'); }}
            title="Generate payslip"
            className="size-8 rounded-lg border border-border bg-muted flex items-center justify-center shrink-0 cursor-pointer transition-colors hover:bg-accent text-muted-foreground"
          >
            <FileText className="h-3.5 w-3.5" />
          </button>

          <ChevronDown
            className={cn('h-3.5 w-3.5 shrink-0 transition-transform duration-200 text-muted-foreground', isOpen && 'rotate-180')}
          />
        </div>

        {/* Mobile stat strip */}
        <div className="grid grid-cols-3 sm:hidden border-t divide-x divide-border/70 bg-muted/20">
          <div className="px-2 py-2.5 text-center">
            <p className="text-[8.5px] uppercase tracking-[0.06em] text-muted-foreground mb-0.5">Penjualan</p>
            <p className="tabular-nums leading-tight break-words" style={{ fontFamily: SERIF, fontSize: 13, color: 'var(--success-ring)' }}>
              {formatRupiah(record.totalPenjualan)}
            </p>
          </div>
          <div className="px-2 py-2.5 text-center">
            <p className="text-[8.5px] uppercase tracking-[0.06em] text-muted-foreground mb-0.5">Modal</p>
            <p className="tabular-nums leading-tight break-words" style={{ fontFamily: SERIF, fontSize: 13, color: 'var(--foreground)' }}>
              {formatRupiah(record.totalModal)}
            </p>
          </div>
          <div className="px-2 py-2.5 text-center">
            <p className="text-[8.5px] uppercase tracking-[0.06em] text-muted-foreground mb-0.5">Fee</p>
            <p className="tabular-nums leading-tight break-words" style={{ fontFamily: SERIF, fontSize: 13, color: record.totalFee > 0 ? 'var(--warning-ring)' : 'var(--muted-foreground)' }}>
              {record.totalFee > 0 ? formatRupiah(record.totalFee) : '—'}
            </p>
          </div>
        </div>
      </div>

      {isOpen && (
        <div className="border-t overflow-x-auto">
          <div className="min-w-[760px]">
            {/* Table header */}
            <div
              className="grid grid-cols-[140px_70px_100px_1fr_90px_110px_70px] bg-muted/40 px-4 py-2 gap-2 text-[9px] font-bold uppercase tracking-[0.07em] text-muted-foreground"
            >
              <span>SKU</span>
              <span>Tag</span>
              <span>Pembeli</span>
              <span>Alamat</span>
              <span className="text-right">Modal</span>
              <span className="text-right">Harga / Fee</span>
              <span className="text-center">Status</span>
            </div>
            {record.entries.map((e) => (
              <div
                key={e.id}
                className="grid grid-cols-[140px_70px_100px_1fr_90px_110px_70px] border-t items-center px-4 py-2.5 gap-2"
              >
                <span className="text-xs font-medium">{e.livestock.sku}</span>
                <span
                  className="inline-flex w-fit rounded px-1.5 py-0.5 text-[9px] font-bold"
                  style={{ background: hex + '18', color: hex }}
                >
                  {e.livestock.tag ?? '—'}
                </span>
                <span className="text-xs text-muted-foreground">{e.buyerName}</span>
                <span className="truncate text-[11px] text-muted-foreground" title={e.buyerAddress ?? undefined}>
                  {e.buyerAddress ?? '—'}
                </span>
                <span className="text-xs text-right text-muted-foreground">{formatRupiah(e.hargaModal)}</span>
                <div className="text-right">
                  <div className="text-xs font-medium">{formatRupiah(e.hargaJual)}</div>
                  <div className="text-[10px] mt-0.5" style={{ color: e.resellerCut > 0 ? 'var(--warning-ring)' : 'var(--muted-foreground)' }}>
                    Fee: {e.resellerCut > 0 ? formatRupiah(e.resellerCut) : '—'}
                  </div>
                </div>
                <div className="flex justify-center">
                  <StatusBadge status={e.paymentStatus} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
