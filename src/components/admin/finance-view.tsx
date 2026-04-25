'use client';

import { useState, useMemo, useRef, useTransition } from 'react';
import { createCashflow, deleteCashflow } from '@/app/actions/cashflow';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { RupiahInput } from '@/components/ui/rupiah-input';
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

/* ── Colors & font ──────────────────────────── */

const FC = {
  green: 'oklch(0.55 0.13 158)',
  blue: 'oklch(0.55 0.13 245)',
  amber: 'oklch(0.70 0.13 78)',
  red: 'oklch(0.55 0.14 20)',
  text2: '#6b6259',
  text3: '#a39890',
};

const SERIF = "var(--font-dm-serif), 'DM Serif Display', serif";

const AVATAR_HEXES = [
  '#c2855a',
  '#5a7fc2',
  '#7a5ac2',
  '#c25a8f',
  '#5ac276',
  '#c2a85a',
  '#5ac2b8',
];

function getAvatarHex(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++)
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_HEXES[Math.abs(hash) % AVATAR_HEXES.length];
}

/* ── Helpers ─────────────────────────────────────────────────────────────── */

function StatusBadge({ status }: { status: string }) {
  switch (status) {
    case 'LUNAS':
      return (
        <Badge
          variant="secondary"
          className="text-[10px]"
          style={{ background: 'oklch(0.55 0.13 158 / 0.1)', color: FC.green }}
        >
          Lunas
        </Badge>
      );
    case 'DP':
      return (
        <Badge
          variant="secondary"
          className="text-[10px]"
          style={{ background: 'oklch(0.70 0.13 78 / 0.12)', color: FC.amber }}
        >
          DP
        </Badge>
      );
    default:
      return (
        <Badge variant="outline" className="text-[10px]">
          Belum Bayar
        </Badge>
      );
  }
}

/* ── Main Component ──────────────────────────────────────────────────────── */

export function FinanceView({
  entries,
  salesUsers,
  cashflows,
}: FinanceViewProps) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [cashflow, setCashflow] = useState<CashflowItem[]>(cashflows);
  const [cfType, setCfType] = useState<'PENGELUARAN' | 'PEMASUKAN'>(
    'PENGELUARAN',
  );
  const [cfName, setCfName] = useState('');
  const [cfAmount, setCfAmount] = useState('');
  const [cfCategory, setCfCategory] = useState('');
  const [cfPending, startCfTransition] = useTransition();
  const nameRef = useRef<HTMLInputElement>(null);

  /* Totals */
  const totals = useMemo(() => {
    let penjualan = 0;
    let modal = 0;
    let fee = 0;
    entries.forEach((e) => {
      penjualan += e.hargaJual;
      modal += e.hargaModal;
      fee += e.resellerCut;
    });
    const profit = penjualan - modal - fee;
    const avg = entries.length > 0 ? Math.round(penjualan / entries.length) : 0;
    const netAfterFee = penjualan - fee;
    return {
      penjualan,
      modal,
      fee,
      profit,
      avg,
      netAfterFee,
      count: entries.length,
    };
  }, [entries]);

  const cfTotals = useMemo(() => {
    let pengeluaran = 0;
    let pemasukan = 0;
    cashflow.forEach((item) => {
      if (item.type === 'PENGELUARAN') pengeluaran += item.amount;
      else pemasukan += item.amount;
    });
    return { pengeluaran, pemasukan, net: pemasukan - pengeluaran };
  }, [cashflow]);

  /* Per-sales aggregation */
  const perSales = useMemo(() => {
    const map = new Map<
      string,
      {
        user: SalesUser;
        entries: EntryData[];
        totalPenjualan: number;
        totalFee: number;
        totalModal: number;
      }
    >();
    salesUsers.forEach((u) => {
      map.set(u.id, {
        user: u,
        entries: [],
        totalPenjualan: 0,
        totalFee: 0,
        totalModal: 0,
      });
    });
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

  /* Expand/collapse helpers */
  const allExpanded =
    perSales.length > 0 && perSales.every((r) => expanded.has(r.user.id));

  function toggleAll() {
    if (allExpanded) {
      setExpanded(new Set());
    } else {
      setExpanded(new Set(perSales.map((r) => r.user.id)));
    }
  }

  function toggleOne(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  /* Add cashflow item */
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
      if ('error' in res) {
        toast.error(res.error);
        return;
      }
      setCashflow((prev) => [
        {
          id: res.item.id,
          type: res.item.type,
          name: res.item.name,
          amount: res.item.amount,
          category: res.item.category,
          date: new Date(res.item.createdAt).toLocaleDateString('id-ID', {
            day: 'numeric',
            month: 'short',
          }),
        },
        ...prev,
      ]);
      setCfName('');
      setCfAmount('');
      setCfCategory('');
      nameRef.current?.focus();
    });
  }

  function removeCashflow(id: string) {
    setCashflow((c) => c.filter((item) => item.id !== id));
    startCfTransition(async () => {
      await deleteCashflow(id);
    });
  }

  const netLabel = cfTotals.pengeluaran - cfTotals.pemasukan;

  return (
    <div className="space-y-6">
      {/* ── 1. Primary KPI Cards ─────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-[10px]">
        <Card
          className="py-0 rounded-[14px] border-t-[3px]"
          style={{ borderTopColor: totals.profit >= 0 ? FC.green : FC.red }}
        >
          <CardContent className="py-4 px-[18px] flex flex-col gap-[5px]">
            <p className="text-[10px] font-semibold uppercase tracking-[0.07em] text-muted-foreground">
              Profit Bersih
            </p>
            <p
              style={{
                fontFamily: SERIF,
                fontSize: 22,
                lineHeight: 1,
                color: totals.profit >= 0 ? FC.green : FC.red,
              }}
            >
              {formatRupiah(totals.profit)}
            </p>
            <p className="text-[11px] text-muted-foreground">
              Penjualan − Modal − Fee Sales
            </p>
          </CardContent>
        </Card>

        <Card
          className="py-0 rounded-[14px] border-t-[3px]"
          style={{ borderTopColor: FC.blue }}
        >
          <CardContent className="py-4 px-[18px] flex flex-col gap-[5px]">
            <p className="text-[10px] font-semibold uppercase tracking-[0.07em] text-muted-foreground">
              Total Penjualan
            </p>
            <p style={{ fontFamily: SERIF, fontSize: 22, lineHeight: 1 }}>
              {formatRupiah(totals.penjualan)}
            </p>
            <p className="text-[11px] text-muted-foreground">
              {totals.count} transaksi · {perSales.length} sales aktif
            </p>
          </CardContent>
        </Card>

        <Card
          className="py-0 rounded-[14px] border-t-[3px]"
          style={{ borderTopColor: FC.amber }}
        >
          <CardContent className="py-4 px-[18px] flex flex-col gap-[5px]">
            <p className="text-[10px] font-semibold uppercase tracking-[0.07em] text-muted-foreground">
              Fee Sales
            </p>
            <p style={{ fontFamily: SERIF, fontSize: 22, lineHeight: 1 }}>
              {formatRupiah(totals.fee)}
            </p>
            <p className="text-[11px] text-muted-foreground">
              Total komisi sales
            </p>
          </CardContent>
        </Card>
      </div>

      {/* ── 2. Secondary Mini-Stats ──────────────────────────────────────── */}
      <div className="flex flex-wrap gap-2">
        <MiniStat
          label="Rata-rata/transaksi"
          value={formatRupiah(totals.avg)}
        />
        <MiniStat
          label="Total modal"
          value={formatRupiah(totals.modal)}
          color={FC.text2}
        />
        <MiniStat
          label="Net setelah fee"
          value={formatRupiah(totals.netAfterFee)}
          color={FC.blue}
        />
        <MiniStat
          label="Total pengeluaran"
          value={formatRupiah(cfTotals.pengeluaran)}
          color={FC.red}
        />
        <MiniStat
          label="Total pemasukan"
          value={formatRupiah(cfTotals.pemasukan)}
          color={FC.green}
        />
        <MiniStat label="Total transaksi" value={`${totals.count} item`} />
      </div>

      {/* ── 3. Per-Sales Cards ────────────────────────────────────────────── */}
      <div className="space-y-2">
        <div className="flex items-center justify-between mb-[10px]">
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.08em]">
            Ringkasan Per Sales
            <span className="text-foreground bg-muted px-[7px] py-0.5 rounded-full ml-1.5 tracking-normal">
              {perSales.length}
            </span>
          </p>
          {perSales.length > 0 && (
            <button
              onClick={toggleAll}
              className="text-[11px] px-[10px] py-1 rounded-[7px] border border-border cursor-pointer"
              style={{ color: FC.text2 }}
            >
              {allExpanded ? 'Tutup semua' : 'Buka semua'}
            </button>
          )}
        </div>

        {perSales.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-sm text-muted-foreground">
              Belum ada data penjualan
            </CardContent>
          </Card>
        ) : (
          perSales.map((record) => (
            <SalesCard
              key={record.user.id}
              record={record}
              isOpen={expanded.has(record.user.id)}
              onToggle={() => toggleOne(record.user.id)}
            />
          ))
        )}
      </div>

      {/* ── 4. Pengeluaran / Pemasukan ───────────────────────────────────── */}
      <div>
        <div className="flex items-center justify-between mb-[10px]">
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.08em]">
            Pengeluaran / Pemasukan
          </p>
          <div className="flex items-center gap-2 text-[11px]">
            <span className="font-semibold" style={{ color: FC.red }}>
              − {formatRupiah(cfTotals.pengeluaran)}
            </span>
            <span className="text-muted-foreground">·</span>
            <span className="font-semibold" style={{ color: FC.green }}>
              + {formatRupiah(cfTotals.pemasukan)}
            </span>
          </div>
        </div>

        {/* Input card */}
        <Card className="py-0 rounded-[14px] mb-2">
          <CardContent className="py-[14px] px-4">
            {/* Type toggle */}
            <div className="flex gap-1.5 mb-[10px]">
              {(['PENGELUARAN', 'PEMASUKAN'] as const).map((tipe) => {
                const isPel = tipe === 'PENGELUARAN';
                const active = cfType === tipe;
                return (
                  <button
                    key={tipe}
                    onClick={() => setCfType(tipe)}
                    className="inline-flex items-center gap-[5px] rounded-[7px] border border-border cursor-pointer transition-all duration-150"
                    style={{
                      padding: '5px 12px',
                      fontSize: 12,
                      background: active
                        ? isPel
                          ? 'oklch(0.55 0.14 20 / 0.08)'
                          : 'oklch(0.55 0.13 158 / 0.08)'
                        : undefined,
                      color: active ? (isPel ? FC.red : FC.green) : FC.text3,
                      fontWeight: active ? 600 : 400,
                    }}
                  >
                    {isPel ? (
                      <ArrowDown className="h-[11px] w-[11px]" />
                    ) : (
                      <ArrowUp className="h-[11px] w-[11px]" />
                    )}
                    {isPel ? 'Pengeluaran' : 'Pemasukan'}
                  </button>
                );
              })}
            </div>

            {/* Inputs */}
            <div className="flex flex-col sm:flex-row gap-2">
              <Input
                ref={nameRef}
                placeholder="Nama…"
                value={cfName}
                onChange={(e) => setCfName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addCashflow()}
                className="flex-[2] min-w-[130px]"
              />
              <RupiahInput
                placeholder="Jumlah (Rp)"
                value={cfAmount}
                onValueChange={setCfAmount}
                onKeyDown={(e) => e.key === 'Enter' && addCashflow()}
                className="flex-1 min-w-[110px]"
              />
              <Input
                placeholder="Kategori (opsional)"
                value={cfCategory}
                onChange={(e) => setCfCategory(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addCashflow()}
                className="flex-1 min-w-[110px]"
              />
              <Button
                onClick={addCashflow}
                size="default"
                className="gap-[5px] shrink-0"
              >
                <Plus className="h-[13px] w-[13px]" /> Tambah
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* List card */}
        {cashflow.length > 0 && (
          <Card className="py-0 rounded-[14px]">
            <CardContent className="p-0">
              {cashflow.map((item, i) => {
                const isPemasukan = item.type === 'PEMASUKAN';
                return (
                  <div
                    key={item.id}
                    className="flex items-center gap-[10px] px-4 py-[11px]"
                    style={
                      i > 0
                        ? { borderTop: '1px solid var(--border)' }
                        : undefined
                    }
                  >
                    <div
                      className="w-7 h-7 rounded-[7px] flex items-center justify-center shrink-0"
                      style={{
                        background: isPemasukan
                          ? 'oklch(0.55 0.13 158 / 0.1)'
                          : 'oklch(0.55 0.14 20 / 0.08)',
                      }}
                    >
                      {isPemasukan ? (
                        <ArrowUp
                          className="h-[11px] w-[11px]"
                          style={{ color: FC.green }}
                        />
                      ) : (
                        <ArrowDown
                          className="h-[11px] w-[11px]"
                          style={{ color: FC.red }}
                        />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-medium truncate">
                        {item.name}
                      </p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="text-[10px] text-muted-foreground">
                          {item.date}
                        </span>
                        {item.category && (
                          <span
                            className="text-[9px] font-bold uppercase bg-muted text-muted-foreground px-1.5 py-[1px] rounded"
                            style={{ letterSpacing: '0.04em' }}
                          >
                            {item.category}
                          </span>
                        )}
                      </div>
                    </div>
                    <span
                      className="shrink-0"
                      style={{
                        fontFamily: SERIF,
                        fontSize: 14,
                        color: isPemasukan ? FC.green : FC.red,
                      }}
                    >
                      {isPemasukan ? '+' : '−'} {formatRupiah(item.amount)}
                    </span>
                    <button
                      onClick={() => removeCashflow(item.id)}
                      className="w-[26px] h-[26px] rounded-[6px] border border-border flex items-center justify-center shrink-0 cursor-pointer text-muted-foreground transition-colors hover:text-destructive hover:bg-destructive/5"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                );
              })}
              {/* Net total row */}
              <div
                className="flex items-center justify-between px-4 py-[10px] bg-muted/50"
                style={{ borderTop: '2px solid var(--border)' }}
              >
                <span
                  className="text-[10px] font-bold uppercase text-muted-foreground"
                  style={{ letterSpacing: '0.06em' }}
                >
                  Net
                </span>
                <span
                  style={{
                    fontFamily: SERIF,
                    fontSize: 16,
                    color: netLabel > 0 ? FC.red : FC.green,
                  }}
                >
                  {netLabel >= 0 ? '−' : '+'} {formatRupiah(Math.abs(netLabel))}
                </span>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

/* ── Mini Stat Card ──────────────────────────────────────────────────────── */

function MiniStat({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color?: string;
}) {
  return (
    <Card className="flex-1 min-w-[120px] py-0 rounded-xl">
      <CardContent className="py-[11px] px-[15px]">
        <p
          className="text-[10px] uppercase text-muted-foreground mb-1"
          style={{ letterSpacing: '0.06em' }}
        >
          {label}
        </p>
        <p
          className="text-sm font-semibold truncate"
          style={color ? { color } : undefined}
        >
          {value}
        </p>
      </CardContent>
    </Card>
  );
}

/* ── Sales Card ──────────────────────────────────────────────────────────── */

function SalesCard({
  record,
  isOpen,
  onToggle,
}: {
  record: {
    user: SalesUser;
    entries: EntryData[];
    totalPenjualan: number;
    totalFee: number;
    totalModal: number;
  };
  isOpen: boolean;
  onToggle: () => void;
}) {
  const hex = getAvatarHex(record.user.name);

  return (
    <Card className="py-0 overflow-hidden rounded-xl">
      {/* Header */}
      <div
        className="flex items-center gap-[10px] px-4 py-3 hover:bg-muted/30 transition-colors cursor-pointer select-none"
        onClick={onToggle}
      >
        {/* Avatar */}
        <div
          className="w-[34px] h-[34px] rounded-full flex items-center justify-center shrink-0"
          style={{
            background: hex + '22',
            color: hex,
            border: `1.5px solid ${hex}55`,
            fontWeight: 600,
            fontSize: 13,
          }}
        >
          {record.user.name.charAt(0).toUpperCase()}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-[13px] leading-[1.2] truncate">
            {record.user.name}
          </p>
          <div
            className="flex flex-wrap items-center mt-0.5"
            style={{ fontSize: 10, color: FC.text3, gap: '3px 8px' }}
          >
            {record.user.phone && (
              <span className="inline-flex items-center gap-[3px]">
                <Phone className="h-[11px] w-[11px]" /> {record.user.phone}
              </span>
            )}
            {record.user.rekBank && (
              <span className="inline-flex items-center gap-[3px]">
                <CreditCard className="h-[11px] w-[11px]" />{' '}
                {record.user.rekBank}
              </span>
            )}
            <span style={{ color: 'var(--border)' }}>·</span>
            <span>{record.entries.length} transaksi</span>
          </div>
        </div>

        {/* Fee value */}
        <div className="text-right shrink-0">
          <p
            className="text-[10px] uppercase text-muted-foreground mb-0.5"
            style={{ letterSpacing: '0.04em' }}
          >
            Fee
          </p>
          <p
            style={{
              fontFamily: SERIF,
              fontSize: 15,
              color: record.totalFee > 0 ? FC.amber : FC.text3,
            }}
          >
            {record.totalFee > 0 ? formatRupiah(record.totalFee) : '—'}
          </p>
        </div>

        {/* Payslip button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            toast.success(`Generating payslip untuk ${record.user.name}...`);
          }}
          title="Generate payslip"
          className="w-[30px] h-[30px] rounded-[7px] border border-border bg-muted flex items-center justify-center shrink-0 cursor-pointer transition-colors hover:bg-accent"
          style={{ color: FC.text2 }}
        >
          <FileText className="h-[15px] w-[15px]" />
        </button>

        {/* Chevron */}
        <ChevronDown
          className={cn(
            'h-[13px] w-[13px] shrink-0 transition-transform duration-200',
            isOpen && 'rotate-180',
          )}
          style={{ color: FC.text3 }}
        />
      </div>

      {/* Expanded content */}
      {isOpen && (
        <div className="border-t overflow-x-auto">
          <div className="min-w-[760px]">
            <div
              className="grid grid-cols-[1fr_80px_100px_140px_100px_110px_80px] bg-muted/40 items-center"
              style={{
                padding: '7px 16px',
                gap: 8,
                fontSize: 9,
                fontWeight: 700,
                color: FC.text3,
                letterSpacing: '0.07em',
                textTransform: 'uppercase',
              }}
            >
              <span>SKU</span>
              <span>Tag</span>
              <span>Pembeli</span>
              <span>Alamat</span>
              <span style={{ textAlign: 'right' }}>Modal</span>
              <span style={{ textAlign: 'right' }}>Harga / Fee</span>
              <span style={{ textAlign: 'center' }}>Status</span>
            </div>
            {record.entries.map((e) => (
              <div
                key={e.id}
                className="grid grid-cols-[1fr_80px_100px_140px_100px_110px_80px] border-t items-center"
                style={{ padding: '11px 16px', gap: 8 }}
              >
                <span style={{ fontSize: 12, fontWeight: 500 }}>
                  {e.livestock.sku}
                </span>
                <span
                  className="inline-flex w-fit rounded"
                  style={{
                    background: hex + '18',
                    color: hex,
                    padding: '2px 6px',
                    fontSize: 9,
                    fontWeight: 700,
                  }}
                >
                  {e.livestock.tag ?? '—'}
                </span>
                <span style={{ fontSize: 12, color: FC.text2 }}>
                  {e.buyerName}
                </span>
                <span
                  className="truncate"
                  title={e.buyerAddress ?? undefined}
                  style={{ fontSize: 11, color: FC.text3 }}
                >
                  {e.buyerAddress ?? '—'}
                </span>
                <span
                  style={{ textAlign: 'right', fontSize: 12, color: FC.text2 }}
                >
                  {formatRupiah(e.hargaModal)}
                </span>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 12, fontWeight: 500 }}>
                    {formatRupiah(e.hargaJual)}
                  </div>
                  <div
                    style={{
                      fontSize: 10,
                      color: e.resellerCut > 0 ? FC.amber : FC.text3,
                      marginTop: 1,
                    }}
                  >
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
    </Card>
  );
}
