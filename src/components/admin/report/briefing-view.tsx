'use client';

// "Briefing" — scannable executive one-pager. Direction B from the design.
// Header band + 5 KPI cards (with sparklines) + 12-col modular card grid.
// Monochrome ink; same data primitives as Sampul. Wider artboard (1240px).

import Image from 'next/image';
import { formatRupiah } from '@/lib/format';
import type { ReportData } from '@/lib/report/get-report';
import { MonthlyBars, HorizontalBars, Donut, CountUp, Spark } from './charts';
import { rpShort, toWeekly, SERIF } from './utils';
import { DeltaChip } from './sampul-view';

export function BriefingView({ data }: { data: ReportData }) {
  const f = data.finance;
  const d = data.delivery;
  const weekly = toWeekly(f.perDay);

  return (
    <article
      className="w-full max-w-[1400px] mx-auto rounded-2xl border bg-card shadow-sm report-reveal"
      style={{ padding: 'clamp(16px, 2.4vw, 32px) clamp(14px, 2.6vw, 34px) clamp(22px, 2.2vw, 30px)' }}
    >
      {/* ── Header band — logo + title vs nothing (toolbar handles actions) */}
      <header
        className="flex flex-wrap justify-between items-center gap-4 pb-[22px]"
        style={{ borderBottom: '1.5px solid var(--foreground)' }}
      >
        <div className="flex items-center gap-3.5">
          <Image src="/logofix.png" alt="Millenials Farm" width={46} height={46} className="size-[46px] object-contain dark:invert" />
          <div>
            <h1 className="m-0 leading-none" style={{ fontFamily: SERIF, fontSize: 'clamp(21px, 3.4vw, 28px)' }}>
              Laporan Musim Qurban {data.range.year}
            </h1>
            <p className="text-muted-foreground mt-1.5" style={{ fontSize: 12.5 }}>
              Idul Adha · {data.range.label}
            </p>
          </div>
        </div>
        <p className="uppercase text-muted-foreground" style={{ fontSize: 10.5, letterSpacing: '0.2em' }}>
          {data.range.days} hari{data.range.hasComparison && ` · ${data.range.compareLabel}`}
        </p>
      </header>

      {/* ── 5 KPI cards with sparklines ── phone 2, tablet 3, desktop 5 */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 my-[18px]">
        <Kpi
          label="Penjualan"
          value={<CountUp value={f.penjualan} format={rpShort} />}
          delta={data.range.hasComparison ? f.deltas.penjualan : undefined}
          spark={weekly.length > 1 ? weekly.map((w) => ({ value: w.value })) : undefined}
          sid="kpiPenj"
        />
        <Kpi
          label="Profit"
          value={<CountUp value={f.profit} format={rpShort} />}
          delta={data.range.hasComparison ? f.deltas.profit : undefined}
          sub={`margin ${(f.margin * 100).toFixed(1)}%`}
          spark={f.perDay.length > 1 ? f.perDay.map((p) => ({ value: Math.max(p.profit, 0) })) : undefined}
          sid="kpiProf"
        />
        <Kpi
          label="Hewan Terjual"
          value={<CountUp value={f.itemCount} format={(v) => Math.round(v).toLocaleString('id-ID')} />}
          sub={`${f.entryCount} transaksi`}
        />
        <Kpi
          label="Pelanggan"
          value={<CountUp value={f.uniqueBuyers} format={(v) => Math.round(v).toLocaleString('id-ID')} />}
          sub={`${formatRupiah(f.avgPerTxn)} / txn`}
        />
        <Kpi
          label="Pengiriman"
          value={<CountUp value={d.successRate * 100} format={(v) => `${Math.round(v)}%`} />}
          sub={`${d.terkirim}/${d.total} terkirim`}
          delta={data.range.hasComparison ? d.deltas.terkirim : undefined}
        />
      </div>

      {/* ── 12-col modular grid ──────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-3">

        <Card title="Penjualan per pekan" meta="Puncak · pekan tertinggi" span={8}>
          <MonthlyBars data={weekly} format={rpShort} height={180} />
        </Card>

        <Card title="Status pembayaran" span={4}>
          {f.paymentMix.length > 0 ? (
            <Donut data={f.paymentMix} mono size={132} center={{ primary: `${(f.collectionRate * 100).toFixed(0)}%`, secondary: 'TERTAGIH' }} />
          ) : <Empty />}
        </Card>

        <Card title="Ringkasan keuangan" span={5}>
          <DataGridB items={[
            ['Penjualan', formatRupiah(f.penjualan)],
            ['Modal / HPP', formatRupiah(f.modal)],
            ['Profit', formatRupiah(f.profit)],
            ['Fee reseller', formatRupiah(f.fee)],
            ['Diterima', formatRupiah(f.diterima)],
            ['Piutang', formatRupiah(f.piutang)],
          ]} />
        </Card>

        <Card title="Penjualan per sales" span={7}>
          <HorizontalBars data={f.perSales.map((s) => ({ label: s.name, value: s.penjualan }))} format={rpShort} />
        </Card>

        <Card title="Penjualan per jenis" span={6}>
          <HorizontalBars data={f.byType.map((t) => ({ label: `${t.label} · ${t.qty} ekor`, value: t.penjualan }))} format={rpShort} />
        </Card>

        <Card title="Pembeli teratas" span={6}>
          {f.topBuyers.length > 0 ? (
            <TableB
              head={['Pembeli', 'Txn', 'Penjualan']}
              align={['left', 'right', 'right']}
              rows={f.topBuyers.map((b) => [b.name, String(b.count), rpShort(b.penjualan)])}
            />
          ) : <Empty />}
        </Card>

        <Card title="Papan peringkat sales" span={12}>
          {f.perSales.length > 0 ? (
            <TableB
              head={['#', 'Sales', 'Transaksi', 'Penjualan', 'Profit', 'Fee', 'Margin']}
              align={['left', 'left', 'right', 'right', 'right', 'right', 'right']}
              rows={f.perSales.map((s, i) => [`${i + 1}`, s.name, String(s.count), formatRupiah(s.penjualan), formatRupiah(s.profit), formatRupiah(s.fee), `${(s.margin * 100).toFixed(0)}%`])}
            />
          ) : <Empty />}
        </Card>

        <Card title="Pengiriman" meta={`${(d.successRate * 100).toFixed(0)}% sukses`} span={4}>
          {d.statusBreakdown.length > 0 ? (
            <Donut data={d.statusBreakdown} mono size={128} center={{ primary: `${(d.successRate * 100).toFixed(0)}%`, secondary: 'SUKSES' }} />
          ) : <Empty />}
        </Card>

        <Card title="Pengiriman per driver" span={8}>
          {d.perDriver.length > 0 ? (
            <HorizontalBars data={d.perDriver.map((x) => ({ label: x.name, value: x.total }))} format={(v) => String(v)} />
          ) : <Empty />}
        </Card>

        <Card title="Fee reseller" meta={`${(data.reseller.feeRate * 100).toFixed(1)}%`} span={6}>
          {data.reseller.perSales.length > 0 ? (
            <HorizontalBars data={data.reseller.perSales.map((s) => ({ label: s.name, value: s.fee }))} format={rpShort} />
          ) : <p className="text-xs text-muted-foreground py-3">Belum ada fee reseller.</p>}
        </Card>

        <Card title="Stok tersedia" meta={`${data.stock.available} ekor`} span={6}>
          <DataGridB items={[
            ['Tersedia', String(data.stock.available)],
            ['Terjual', String(data.stock.sold)],
            ['Nilai jual stok', rpShort(data.stock.inventoryValueJual)],
            ['Potensi profit', rpShort(data.stock.inventoryValueJual - data.stock.inventoryValueModal)],
          ]} />
          <div className="mt-3.5">
            <HorizontalBars data={data.stock.byType} format={(v) => String(v)} />
          </div>
        </Card>

        {f.cashflow.categories.length > 0 && (
          <Card title="Arus kas per kategori" span={f.cashflow.byTag.length > 0 || f.cashflow.byBank.length > 0 ? 6 : 12}>
            <TableB
              head={['Kategori', 'Tipe', 'Jumlah']}
              align={['left', 'left', 'right']}
              rows={f.cashflow.categories.map((c) => [c.name, c.type === 'PEMASUKAN' ? 'Masuk' : 'Keluar', formatRupiah(c.amount)])}
            />
          </Card>
        )}

        {f.cashflow.byTag.length > 0 && (
          <Card title="Arus kas per tag" span={6}>
            <TableB
              head={['Tag', 'Tipe', 'Jumlah']}
              align={['left', 'left', 'right']}
              rows={f.cashflow.byTag.map((c) => [c.name, c.type === 'PEMASUKAN' ? 'Masuk' : 'Keluar', formatRupiah(c.amount)])}
            />
          </Card>
        )}

        {f.cashflow.byBank.length > 0 && (
          <Card title="Arus kas per bank / sumber dana" span={6}>
            <TableB
              head={['Bank / Sumber', 'Tipe', 'Jumlah']}
              align={['left', 'left', 'right']}
              rows={f.cashflow.byBank.map((c) => [c.name, c.type === 'PEMASUKAN' ? 'Masuk' : 'Keluar', formatRupiah(c.amount)])}
            />
          </Card>
        )}

        {data.stock.liabilityCount > 0 && (
          <Card title="Liabilitas stok" meta={`− ${rpShort(data.stock.lossModal)}`} span={6}>
            <ul className="list-none m-0 p-0 text-sm">
              {data.stock.sakitCount > 0 && (
                <li className="flex justify-between py-2 border-b border-border">
                  <span className="text-muted-foreground">Sakit</span>
                  <span className="text-foreground tabular-nums">{data.stock.sakitCount} ekor</span>
                </li>
              )}
              {data.stock.matiCount > 0 && (
                <li className="flex justify-between py-2">
                  <span className="text-muted-foreground">Mati</span>
                  <span className="text-foreground tabular-nums">{data.stock.matiCount} ekor</span>
                </li>
              )}
            </ul>
          </Card>
        )}
      </div>

      <footer
        className="flex flex-wrap justify-between gap-2 mt-[18px] pt-4 text-muted-foreground"
        style={{ borderTop: '1px solid var(--border)', fontSize: 11 }}
      >
        <span>Millenials Farm · PT Millenials Farm Abadi</span>
        <span>Laporan Musim Qurban {data.range.year}{data.range.hasComparison && ` · ${data.range.compareLabel}`}</span>
      </footer>
    </article>
  );
}

/* ── pieces ────────────────────────────────────────────────────────── */

function Kpi({
  label, value, sub, delta, spark, sid,
}: {
  label: string;
  value: React.ReactNode;
  sub?: string;
  delta?: import('@/lib/report/get-report').Delta;
  spark?: { value: number }[];
  sid?: string;
}) {
  return (
    <div className="rounded-2xl border bg-card p-[15px_16px_14px] flex flex-col">
      <div className="flex justify-between items-center">
        <span className="uppercase text-muted-foreground" style={{ fontSize: 10.5, letterSpacing: '0.12em' }}>{label}</span>
        {delta && <DeltaChip d={delta} />}
      </div>
      <p className="m-0 mt-2.5 tabular-nums" style={{ fontFamily: SERIF, fontSize: 30, lineHeight: 1 }}>{value}</p>
      {spark ? (
        <div className="mt-2.5 text-foreground"><Spark data={spark} valueKey="value" gid={sid} height={36} /></div>
      ) : (
        sub && <p className="m-0 mt-2 text-muted-foreground" style={{ fontSize: 11.5 }}>{sub}</p>
      )}
      {spark && sub && <p className="m-0 mt-1.5 text-muted-foreground" style={{ fontSize: 11.5 }}>{sub}</p>}
    </div>
  );
}

// Card span map — single col on phone, all-6 on tablet, natural span on lg+.
// Listed literally so Tailwind picks them up during build.
const CARD_SPAN: Record<number, string> = {
  4: 'md:col-span-6 lg:col-span-4',
  5: 'md:col-span-6 lg:col-span-5',
  6: 'md:col-span-6 lg:col-span-6',
  7: 'md:col-span-6 lg:col-span-7',
  8: 'md:col-span-6 lg:col-span-8',
  12: 'md:col-span-12 lg:col-span-12',
};

function Card({ title, meta, span = 4, children }: { title: string; meta?: string; span?: number; children: React.ReactNode }) {
  return (
    <div
      className={`rounded-2xl border bg-card flex flex-col ${CARD_SPAN[span] ?? 'md:col-span-6 lg:col-span-4'}`}
      style={{ padding: '16px 18px 18px' }}
    >
      <div
        className="flex justify-between items-baseline mb-4"
        style={{ paddingBottom: 12, borderBottom: '1px solid var(--border)' }}
      >
        <span style={{ fontSize: 13, fontWeight: 600, letterSpacing: '-0.01em' }}>{title}</span>
        {meta && <span className="text-muted-foreground" style={{ fontSize: 11 }}>{meta}</span>}
      </div>
      <div className="flex-1 max-sm:overflow-x-auto">{children}</div>
    </div>
  );
}

function DataGridB({ items }: { items: [string, string][] }) {
  return (
    <div
      className="grid grid-cols-2 overflow-hidden rounded-lg"
      style={{ gap: 1, background: 'var(--border)', border: '1px solid var(--border)' }}
    >
      {items.map(([label, value], i) => (
        <div key={i} className="bg-card" style={{ padding: '11px 13px' }}>
          <p className="uppercase text-muted-foreground" style={{ fontSize: 10.5, letterSpacing: '0.06em' }}>{label}</p>
          <p className="mt-1.5 tabular-nums" style={{ fontFamily: SERIF, fontSize: 19, lineHeight: 1 }}>{value}</p>
        </div>
      ))}
    </div>
  );
}

function TableB({ head, rows, align }: { head: string[]; rows: string[][]; align: ('left' | 'right')[] }) {
  return (
    <table className="w-full max-sm:min-w-[460px]" style={{ borderCollapse: 'collapse' }}>
      <thead>
        <tr>
          {head.map((h, i) => (
            <th
              key={i}
              className={`uppercase text-muted-foreground font-semibold ${align[i] === 'right' ? 'text-right' : 'text-left'}`}
              style={{ fontSize: 10, letterSpacing: '0.08em', padding: '0 12px 9px', borderBottom: '1px solid var(--border)' }}
            >
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((r, ri) => (
          <tr key={ri} className="hover:bg-muted/40 transition-colors">
            {r.map((c, ci) => (
              <td
                key={ci}
                className={`${align[ci] === 'right' ? 'text-right' : 'text-left'}`}
                style={{
                  padding: '9px 12px',
                  borderBottom: ri === rows.length - 1 ? 'none' : '1px solid var(--border)',
                  fontSize: 12.5,
                  fontVariantNumeric: 'tabular-nums',
                  color: ci === 0 && align[0] === 'left' ? 'var(--muted-foreground)' : undefined,
                }}
              >
                {c}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Empty() {
  return <p className="text-xs text-muted-foreground py-4 text-center">Tidak ada data.</p>;
}
