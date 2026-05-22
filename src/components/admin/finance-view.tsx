'use client';

import { useState, useMemo, useRef, useTransition } from 'react';
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

/* ── Main Component ──────────────────────────────────────────────────────── */

export function FinanceView({ entries, salesUsers, cashflows }: FinanceViewProps) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [salesPage, setSalesPage] = useState(0);
  const SALES_PAGE_SIZE = 10;
  const [cashflow, setCashflow] = useState<CashflowItem[]>(cashflows);
  const [cfType, setCfType] = useState<'PENGELUARAN' | 'PEMASUKAN'>('PENGELUARAN');
  const [cfName, setCfName] = useState('');
  const [cfAmount, setCfAmount] = useState('');
  const [cfCategory, setCfCategory] = useState('');
  const [cfPending, startCfTransition] = useTransition();
  const nameRef = useRef<HTMLInputElement>(null);

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

  const salesPageCount = Math.ceil(perSales.length / SALES_PAGE_SIZE);
  const pagedSales = perSales.slice(salesPage * SALES_PAGE_SIZE, (salesPage + 1) * SALES_PAGE_SIZE);

  const allExpanded = perSales.length > 0 && perSales.every((r) => expanded.has(r.user.id));

  function toggleAll() {
    if (allExpanded) setExpanded(new Set());
    else setExpanded(new Set(perSales.map((r) => r.user.id)));
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
    startCfTransition(async () => {
      const res = await createCashflow(fd);
      if ('error' in res) { toast.error(res.error); return; }
      setCashflow((prev) => [{
        id: res.item.id, type: res.item.type, name: res.item.name,
        amount: res.item.amount, category: res.item.category,
        date: new Date(res.item.createdAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }),
      }, ...prev]);
      setCfName(''); setCfAmount(''); setCfCategory('');
      nameRef.current?.focus();
    });
  }

  function removeCashflow(id: string) {
    setCashflow((c) => c.filter((item) => item.id !== id));
    startCfTransition(async () => { await deleteCashflow(id); });
  }

  const isProfit = totals.profit >= 0;
  const netCfLabel = cfTotals.pengeluaran - cfTotals.pemasukan;

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
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Ringkasan Per Sales</p>
            <span className="text-[10px] font-semibold text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
              {perSales.length}
            </span>
          </div>
          {perSales.length > 0 && (
            <button
              onClick={toggleAll}
              className="text-[11px] px-3 py-1 rounded-lg border border-border cursor-pointer transition-colors hover:bg-muted/50 text-muted-foreground"
            >
              {allExpanded ? 'Tutup semua' : 'Buka semua'}
            </button>
          )}
        </div>

        {perSales.length === 0 ? (
          <div className="rounded-xl border bg-card px-5 py-12 text-center text-sm text-muted-foreground">
            Belum ada data penjualan
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
                  {salesPage * SALES_PAGE_SIZE + 1}–{Math.min((salesPage + 1) * SALES_PAGE_SIZE, perSales.length)} dari {perSales.length}
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
          <div className="flex items-center gap-2 text-[11px]">
            <span className="font-medium tabular-nums" style={{ color: 'var(--danger-ring)' }}>
              − {formatRupiah(cfTotals.pengeluaran)}
            </span>
            <span className="text-border">·</span>
            <span className="font-medium tabular-nums" style={{ color: 'var(--success-ring)' }}>
              + {formatRupiah(cfTotals.pemasukan)}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-start">
          {/* Input form */}
          <div className="rounded-xl border bg-card p-4 flex flex-col gap-3">
            <div className="flex gap-1 p-0.5 rounded-lg bg-muted">
              {(['PENGELUARAN', 'PEMASUKAN'] as const).map((tipe) => {
                const isPel = tipe === 'PENGELUARAN';
                const active = cfType === tipe;
                return (
                  <button
                    key={tipe}
                    onClick={() => setCfType(tipe)}
                    className={cn(
                      'flex-1 inline-flex items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-xs cursor-pointer transition-all duration-150',
                      active
                        ? 'bg-card shadow-sm font-medium text-foreground'
                        : 'text-muted-foreground hover:text-foreground',
                    )}
                  >
                    {isPel ? <ArrowDown className="size-3" /> : <ArrowUp className="size-3" />}
                    {isPel ? 'Pengeluaran' : 'Pemasukan'}
                  </button>
                );
              })}
            </div>

            <Input
              ref={nameRef}
              placeholder="Nama…"
              value={cfName}
              onChange={(e) => setCfName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addCashflow()}
            />
            <div className="flex gap-2">
              <RupiahInput
                placeholder="Jumlah (Rp)"
                value={cfAmount}
                onValueChange={setCfAmount}
                onKeyDown={(e) => e.key === 'Enter' && addCashflow()}
                className="flex-1"
              />
              <Input
                placeholder="Kategori"
                value={cfCategory}
                onChange={(e) => setCfCategory(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addCashflow()}
                className="flex-1"
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
                <div className="divide-y max-h-[340px] overflow-y-auto">
                  {cashflow.map((item) => {
                    const isPemasukan = item.type === 'PEMASUKAN';
                    return (
                      <div key={item.id} className="flex items-center gap-3 px-4 py-3">
                        <div className="size-6 rounded-md flex items-center justify-center shrink-0 bg-muted">
                          {isPemasukan
                            ? <ArrowUp className="size-3 text-muted-foreground" />
                            : <ArrowDown className="size-3 text-muted-foreground" />
                          }
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[13px] font-medium truncate">{item.name}</p>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="text-[10px] text-muted-foreground">{item.date}</span>
                            {item.category && (
                              <span className="text-[9px] uppercase bg-muted text-muted-foreground px-1.5 py-px rounded tracking-[0.04em]">
                                {item.category}
                              </span>
                            )}
                          </div>
                        </div>
                        <span
                          className="shrink-0 text-sm tabular-nums"
                          style={{ fontFamily: SERIF, color: isPemasukan ? 'var(--success-ring)' : 'var(--danger-ring)' }}
                        >
                          {isPemasukan ? '+' : '−'} {formatRupiah(item.amount)}
                        </span>
                        <button
                          onClick={() => removeCashflow(item.id)}
                          className="size-6 rounded border border-border flex items-center justify-center shrink-0 cursor-pointer text-muted-foreground transition-colors hover:text-destructive hover:bg-destructive/5"
                        >
                          <Trash2 className="size-3" />
                        </button>
                      </div>
                    );
                  })}
                </div>
                <div className="flex items-center justify-between px-4 py-2.5 border-t bg-muted/30">
                  <span className="text-[10px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">Net</span>
                  <span className="tabular-nums" style={{ fontFamily: SERIF, fontSize: 14, color: netCfLabel > 0 ? 'var(--danger-ring)' : 'var(--success-ring)' }}>
                    {netCfLabel >= 0 ? '−' : '+'} {formatRupiah(Math.abs(netCfLabel))}
                  </span>
                </div>
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
