'use client';

// "Sampul" — editorial magazine cover view. Direction A from the design.
// 1080px artboard: ink cover (BIG YEAR, hero amount, signature curve, KPI
// strip), then four numbered sections on paper. Monochrome ink.

import Image from 'next/image';
import { ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { formatRupiah } from '@/lib/format';
import type { ReportData, Delta } from '@/lib/report/get-report';
import { AreaChart, MonthlyBars, HorizontalBars, Donut, CountUp } from './charts';
import { rpShort, shortDayLabel, toWeekly, SERIF } from './utils';

export function SampulView({ data }: { data: ReportData }) {
  const f = data.finance;
  const lunas = f.paymentMix.find((m) => /lunas/i.test(m.label))?.value ?? 0;
  const dp = f.paymentMix.find((m) => /dp/i.test(m.label))?.value ?? 0;
  const belum = f.paymentMix.find((m) => /belum/i.test(m.label))?.value ?? 0;

  return (
    <article className="w-full max-w-[1120px] mx-auto overflow-hidden rounded-2xl border bg-card shadow-sm report-reveal">

      {/* ╔═════════════ COVER (always ink) ═════════════╗ */}
      <header
        className="relative overflow-hidden text-background"
        style={{ background: 'var(--report-cover, #14201d)', padding: 'clamp(28px, 4.5vw, 52px) clamp(20px, 5vw, 56px) clamp(28px, 3.6vw, 40px)' }}
      >
        <div
          aria-hidden
          className="absolute inset-0 pointer-events-none"
          style={{ background: 'radial-gradient(120% 80% at 85% 0%, rgba(95,208,138,0.07), transparent 60%)' }}
        />
        <div className="relative">
          {/* brand row — stacks vertically on phone */}
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-[18px] sm:gap-6">
            <div className="flex items-center gap-[13px]">
              <Image src="/logofix.png" alt="Millenials Farm" width={42} height={42} className="size-[42px] object-contain" />
              <div>
                <p className="leading-none" style={{ fontFamily: SERIF, fontSize: 21 }}>Millenials Farm</p>
                <p className="mt-[5px] uppercase" style={{ fontSize: 9.5, letterSpacing: '0.15em', color: 'rgba(243,242,236,0.58)' }}>
                  PT Millenials Farm Abadi
                </p>
              </div>
            </div>
            <div className="text-left sm:text-right">
              <p className="uppercase" style={{ fontSize: 10, letterSpacing: '0.3em', color: 'rgba(243,242,236,0.5)' }}>
                Laporan Musim Qurban
              </p>
              <p className="mt-1.5" style={{ fontSize: 12 }}>{data.range.label}</p>
              <p className="mt-1" style={{ fontSize: 12, color: 'rgba(243,242,236,0.58)' }}>
                {data.range.days} hari{data.range.hasComparison && ` · ${data.range.compareLabel}`}
              </p>
            </div>
          </div>

          <p className="uppercase mt-10" style={{ fontSize: 11, letterSpacing: '0.28em', color: 'rgba(243,242,236,0.58)' }}>
            Penjualan Hewan Qurban · Idul Adha
          </p>

          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-1.5 sm:gap-6 mt-1">
            <p className="tabular-nums" style={{ fontFamily: SERIF, fontSize: 'clamp(74px, 15vw, 168px)', lineHeight: 0.82, letterSpacing: '-0.04em' }}>
              {data.range.year}
            </p>
            <div className="text-left sm:text-right pb-0 sm:pb-[18px]">
              <p style={{ fontFamily: SERIF, fontSize: 'clamp(32px, 6.2vw, 54px)', lineHeight: 1 }}>
                <CountUp value={f.penjualan} format={rpShort} />
              </p>
              <div className="mt-[9px] flex items-center justify-start sm:justify-end gap-[10px]">
                {data.range.hasComparison && <DeltaChip d={f.deltas.penjualan} onDark big />}
                <span style={{ fontSize: 13, color: 'rgba(243,242,236,0.58)' }}>penjualan · margin {(f.margin * 100).toFixed(1)}%</span>
              </div>
            </div>
          </div>

          {/* Hero curve — daily resolution so the day-to-day flow is visible.
              Peak label + axis dates render as HTML overlays inside the chart
              component so they stay correctly proportioned on narrow viewports
              (the SVG itself uses preserveAspectRatio="none" to fill width). */}
          {f.perDay.length > 1 && (
            <div className="mt-1.5 text-background">
              <AreaChart
                data={f.perDay.map((d) => ({ label: shortDayLabel(d.date), penjualan: d.penjualan }))}
                valueKey="penjualan"
                peakLabel={f.bestDay ? rpShort(f.bestDay.penjualan) : undefined}
                height={210}
                format={rpShort}
              />
            </div>
          )}

          <div className="grid grid-cols-2 sm:grid-cols-4 mt-[26px]" style={{ borderTop: '1px solid rgba(255,255,255,0.16)' }}>
            <Kpi index={0} label="Penjualan" delta={data.range.hasComparison ? f.deltas.penjualan : undefined}>
              <CountUp value={f.penjualan} format={rpShort} />
            </Kpi>
            <Kpi index={1} label="Hewan Terjual" sub={f.itemCount ? `${formatRupiah(Math.round(f.penjualan / Math.max(f.itemCount, 1)))} / ekor` : undefined}>
              <CountUp value={f.itemCount} format={(v) => Math.round(v).toLocaleString('id-ID')} />
            </Kpi>
            <Kpi index={2} label="Pelanggan" sub={f.entryCount ? `${f.entryCount} transaksi` : undefined}>
              <CountUp value={f.uniqueBuyers} format={(v) => Math.round(v).toLocaleString('id-ID')} />
            </Kpi>
            <Kpi index={3} label="Profit" delta={data.range.hasComparison ? f.deltas.profit : undefined} sub={`margin ${(f.margin * 100).toFixed(1)}%`}>
              <CountUp value={f.profit} format={rpShort} />
            </Kpi>
          </div>
        </div>
      </header>

      {/* ╔═════════════ BODY (paper) ═════════════╗ */}
      <div style={{ padding: '0 clamp(20px, 5vw, 56px) clamp(32px, 5vw, 56px)' }}>
        {/* Sorotan */}
        {data.insights.length > 0 && (
          <section className="report-reveal" style={{ padding: '46px 0 8px', maxWidth: 880, animationDelay: '80ms' }}>
            <p className="uppercase" style={{ fontSize: 11, letterSpacing: '0.28em', color: 'var(--muted-foreground)' }}>Sorotan</p>
            <p className="mt-4 text-foreground" style={{ fontFamily: SERIF, fontSize: 'clamp(18px, 4.4vw, 31px)', lineHeight: 1.28, letterSpacing: '-0.01em' }}>
              {data.insights[1] ?? data.insights[0]}
            </p>
            {data.insights.length > 2 && (
              <ul className="mt-[26px] sm:columns-2 sm:gap-x-12 list-none p-0">
                {data.insights.slice(2).map((t, i) => (
                  <li key={i} className="flex gap-[11px] text-foreground break-inside-avoid mb-3" style={{ fontSize: 13.5, lineHeight: 1.5 }}>
                    <span className="text-muted-foreground select-none">—</span>
                    <span>{t}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        {/* 01 Keuangan */}
        <Section no="01" title="Keuangan" meta={`${f.entryCount} transaksi · ${f.itemCount} ekor`} delay={160}>
          <DataGrid items={[
            ['Penjualan', formatRupiah(f.penjualan)],
            ['Modal / HPP', formatRupiah(f.modal)],
            ['Profit', formatRupiah(f.profit)],
            ['Margin', `${(f.margin * 100).toFixed(1)}%`],
            ['Fee reseller', formatRupiah(f.fee)],
            ['Rata-rata / transaksi', formatRupiah(f.avgPerTxn)],
            ['Diterima', formatRupiah(f.diterima)],
            ['Piutang', formatRupiah(f.piutang)],
          ]} />

          <Block label="Penjualan & profit per pekan">
            <MonthlyBars data={toWeekly(f.perDay)} format={rpShort} height={186} />
          </Block>

          <TwoCol>
            <Block label="Status pembayaran">
              <Donut data={f.paymentMix} mono center={{ primary: rpShort(f.penjualan), secondary: 'PENJUALAN' }} />
            </Block>
            <Block label="Penagihan">
              <ul className="list-none m-0 p-0">
                <MiniLi label={`Lunas · ${f.countLunas}`} value={formatRupiah(lunas)} />
                <MiniLi label={`DP · ${f.countDp}`} value={formatRupiah(dp)} />
                <MiniLi label={`Belum bayar · ${f.countBelum}`} value={formatRupiah(belum)} />
                <MiniLi label="Tertagih" value={`${(f.collectionRate * 100).toFixed(0)}%`} total />
              </ul>
            </Block>
          </TwoCol>

          <TwoCol>
            <Block label="Penjualan per sales">
              <HorizontalBars data={f.perSales.map((s) => ({ label: s.name, value: s.penjualan }))} format={rpShort} />
            </Block>
            <Block label="Penjualan per jenis">
              <HorizontalBars data={f.byType.map((t) => ({ label: `${t.label} · ${t.qty}`, value: t.penjualan }))} format={rpShort} />
            </Block>
          </TwoCol>

          {f.perSales.length > 0 && (
            <Block label="Papan peringkat sales">
              <Table
                head={['#', 'Sales', 'Txn', 'Penjualan', 'Profit', 'Margin']}
                align={['left', 'left', 'right', 'right', 'right', 'right']}
                rows={f.perSales.map((s, i) => [`${i + 1}`, s.name, String(s.count), rpShort(s.penjualan), rpShort(s.profit), `${(s.margin * 100).toFixed(0)}%`])}
              />
            </Block>
          )}

          <TwoCol>
            {f.topBuyers.length > 0 && (
              <Block label="Pembeli teratas">
                <Table
                  head={['Pembeli', 'Txn', 'Penjualan']}
                  align={['left', 'right', 'right']}
                  rows={f.topBuyers.map((b) => [b.name, String(b.count), rpShort(b.penjualan)])}
                />
              </Block>
            )}
            {f.cashflow.categories.length > 0 && (
              <Block label="Arus kas per kategori">
                <Table
                  head={['Kategori', 'Tipe', 'Jumlah']}
                  align={['left', 'left', 'right']}
                  rows={f.cashflow.categories.map((c) => [c.name, c.type === 'PEMASUKAN' ? 'Masuk' : 'Keluar', rpShort(c.amount)])}
                />
              </Block>
            )}
            {f.cashflow.byTag.length > 0 && (
              <Block label="Arus kas per tag">
                <Table
                  head={['Tag', 'Tipe', 'Jumlah']}
                  align={['left', 'left', 'right']}
                  rows={f.cashflow.byTag.map((c) => [c.name, c.type === 'PEMASUKAN' ? 'Masuk' : 'Keluar', rpShort(c.amount)])}
                />
              </Block>
            )}
            {f.cashflow.byBank.length > 0 && (
              <Block label="Arus kas per bank / sumber dana">
                <Table
                  head={['Bank / Sumber', 'Tipe', 'Jumlah']}
                  align={['left', 'left', 'right']}
                  rows={f.cashflow.byBank.map((c) => [c.name, c.type === 'PEMASUKAN' ? 'Masuk' : 'Keluar', rpShort(c.amount)])}
                />
              </Block>
            )}
          </TwoCol>
        </Section>

        {/* 02 Pengiriman */}
        <Section no="02" title="Pengiriman" meta={`${data.delivery.total} dijadwalkan · ${(data.delivery.successRate * 100).toFixed(0)}% sukses`} delay={240}>
          <div className="grid grid-cols-1 lg:grid-cols-[0.85fr_1fr] gap-x-[38px] gap-y-8 items-center">
            <Block label="Tingkat keberhasilan">
              <Donut data={data.delivery.statusBreakdown} mono center={{ primary: `${(data.delivery.successRate * 100).toFixed(0)}%`, secondary: 'SUKSES' }} />
            </Block>
            <Block label="Pengiriman per driver">
              <HorizontalBars data={data.delivery.perDriver.map((d) => ({ label: d.name, value: d.total }))} format={(v) => String(v)} />
            </Block>
          </div>

          {data.delivery.byPengiriman.length > 0 && (
            <Block label="Volume per tipe pengiriman">
              <HorizontalBars data={data.delivery.byPengiriman} format={(v) => String(v)} />
            </Block>
          )}

          {data.delivery.perDriver.length > 0 && (
            <Block label="Rincian per driver">
              <Table
                head={['Driver', 'Total', 'Terkirim', 'Gagal', 'Sukses']}
                align={['left', 'right', 'right', 'right', 'right']}
                rows={data.delivery.perDriver.map((d) => [d.name, String(d.total), String(d.terkirim), String(d.gagal), `${(d.successRate * 100).toFixed(0)}%`])}
              />
            </Block>
          )}
        </Section>

        {/* 03 Fee Reseller */}
        <Section
          no="03"
          title="Fee Reseller"
          meta={`${formatRupiah(data.reseller.fee)} · ${(data.reseller.feeRate * 100).toFixed(1)}% dari penjualan`}
          delay={320}
        >
          <DataGrid items={[
            ['Total fee', formatRupiah(data.reseller.fee)],
            ['% dari penjualan', `${(data.reseller.feeRate * 100).toFixed(2)}%`],
            ['Rata-rata / transaksi', formatRupiah(data.reseller.avgPerTxn)],
            ['Reseller aktif', `${data.reseller.perSales.length}`],
          ]} />

          {data.reseller.perSales.length > 0 ? (
            <>
              <TwoCol>
                <Block label="Fee per reseller">
                  <HorizontalBars data={data.reseller.perSales.map((s) => ({ label: s.name, value: s.fee }))} format={rpShort} />
                </Block>
                {data.reseller.byType.length > 0 && (
                  <Block label="Fee per jenis hewan">
                    <HorizontalBars data={data.reseller.byType.map((t) => ({ label: `${t.label} · ${t.qty}`, value: t.fee }))} format={rpShort} />
                  </Block>
                )}
              </TwoCol>

              <Block label="Papan peringkat reseller">
                <Table
                  head={['#', 'Reseller', 'Txn', 'Fee', 'Bagian']}
                  align={['left', 'left', 'right', 'right', 'right']}
                  rows={data.reseller.perSales.map((r, i) => [`${i + 1}`, r.name, String(r.count), rpShort(r.fee), `${(r.share * 100).toFixed(1)}%`])}
                />
              </Block>
            </>
          ) : (
            <p className="text-xs text-muted-foreground py-4">Belum ada fee reseller di periode ini.</p>
          )}
        </Section>

        {/* 04 Stok */}
        <Section
          no="04"
          title="Stok Hewan"
          meta={data.stock.liabilityCount > 0 ? `Snapshot saat ini · ${data.stock.liabilityCount} liabilitas` : 'Snapshot saat ini'}
          delay={400}
        >
          <DataGrid items={[
            ['Total ternak', String(data.stock.total)],
            ['Tersedia', String(data.stock.available)],
            ['Terjual', String(data.stock.sold)],
            ['Nilai modal stok', rpShort(data.stock.inventoryValueModal)],
            ['Nilai jual stok', rpShort(data.stock.inventoryValueJual)],
            ['Potensi profit', rpShort(data.stock.inventoryValueJual - data.stock.inventoryValueModal)],
          ]} />
          {data.stock.liabilityCount > 0 && (
            <div className="rounded-xl border border-danger-ring/40 bg-danger-bg/30 px-4 py-3 flex flex-wrap items-baseline justify-between gap-2">
              <div className="flex items-baseline gap-3">
                <p className="text-[10px] uppercase tracking-[0.2em] text-danger-fg">Liabilitas Stok</p>
                <p className="text-sm text-foreground">
                  {data.stock.sakitCount > 0 && <span>{data.stock.sakitCount} sakit</span>}
                  {data.stock.sakitCount > 0 && data.stock.matiCount > 0 && <span className="text-muted-foreground"> · </span>}
                  {data.stock.matiCount > 0 && <span>{data.stock.matiCount} mati</span>}
                </p>
              </div>
              <p className="text-lg tabular-nums text-danger-fg" style={{ fontFamily: SERIF }}>
                − {formatRupiah(data.stock.lossModal)}
              </p>
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-[38px] gap-y-8">
            <Block label="Tersedia per jenis"><HorizontalBars data={data.stock.byType} format={(v) => String(v)} /></Block>
            <Block label="Per grade"><HorizontalBars data={data.stock.byGrade} format={(v) => String(v)} /></Block>
            <Block label="Per kondisi"><HorizontalBars data={data.stock.byCondition} format={(v) => String(v)} /></Block>
          </div>
        </Section>

        <footer
          className="flex flex-col sm:flex-row sm:justify-between sm:items-end gap-3.5 sm:gap-0 report-reveal"
          style={{ marginTop: 50, paddingTop: 26, borderTop: '1px solid var(--border)', animationDelay: '500ms' }}
        >
          <div>
            <p className="text-foreground" style={{ fontSize: 13, fontWeight: 600 }}>Disahkan · Direksi</p>
            <p className="text-muted-foreground mt-[3px]" style={{ fontSize: 11 }}>Millenials Farm · {data.range.year}</p>
          </div>
          <p className="uppercase text-muted-foreground" style={{ fontSize: 11, letterSpacing: '0.1em' }}>
            Laporan Musim Qurban {data.range.year}
          </p>
        </footer>
      </div>
    </article>
  );
}

/* ── pieces ────────────────────────────────────────────────────────── */

// 2-col on phone, 4-col on sm+. Borders depend on (col, row) which differs
// between the two breakpoints — compute from index for both and let the
// `max-sm:` / `sm:` Tailwind variants pick the right rule per viewport.
//   Phone (2-col):   col = index % 2;  row = floor(index / 2)
//   Desktop (4-col): col = index;      row = 0
function Kpi({ index, label, children, sub, delta }: { index: number; label: string; children: React.ReactNode; sub?: string; delta?: Delta }) {
  const mobileLeftBorder = index % 2 !== 0;      // odd index = right column on phone
  const mobileTopBorder = index >= 2;            // row 2+ on phone
  const desktopLeftBorder = index !== 0;
  const cls = [
    'min-w-0',
    mobileLeftBorder ? 'max-sm:border-l max-sm:border-white/15' : '',
    mobileTopBorder ? 'max-sm:border-t max-sm:border-white/15' : '',
    desktopLeftBorder ? 'sm:border-l sm:border-white/15' : '',
  ].filter(Boolean).join(' ');
  return (
    <div
      className={cls}
      style={{ padding: 'clamp(14px, 3vw, 20px) clamp(14px, 3vw, 22px)' }}
    >
      <p className="uppercase truncate" style={{ fontSize: 'clamp(9.5px, 2.4vw, 10.5px)', letterSpacing: '0.16em', color: 'rgba(243,242,236,0.58)' }}>{label}</p>
      <p
        className="mt-[11px] tabular-nums whitespace-nowrap"
        style={{ fontFamily: SERIF, fontSize: 'clamp(22px, 6.4vw, 33px)', lineHeight: 1 }}
      >
        {children}
      </p>
      <div className="mt-[9px] flex flex-wrap items-center gap-x-2 gap-y-1" style={{ minHeight: 14 }}>
        {delta && <DeltaChip d={delta} onDark />}
        {sub && <span className="truncate" style={{ fontSize: 'clamp(10px, 2.6vw, 11.5px)', color: 'rgba(243,242,236,0.58)' }}>{sub}</span>}
      </div>
    </div>
  );
}

export function DeltaChip({ d, onDark, big }: { d: Delta; onDark?: boolean; big?: boolean }) {
  const flat = d.pct === 0 || (d.pct === null && d.value === 0);
  const up = d.pct === null ? d.value > 0 : (d.pct ?? 0) > 0;
  const text = d.pct === null ? (d.value > 0 ? 'baru' : '0%') : `${Math.abs(d.pct).toFixed(0)}%`;
  const Icon = up ? ArrowUpRight : ArrowDownRight;
  const color = flat ? (onDark ? '#cbd5e1' : '#64748b') : up ? (onDark ? '#5fd08a' : 'var(--success-fg)') : (onDark ? '#f87171' : 'var(--danger-fg)');
  return (
    <span
      className={`inline-flex items-center font-semibold ${big ? 'gap-1 text-[15px]' : 'gap-0.5 text-[11px]'}`}
      style={{ color, lineHeight: 1 }}
    >
      {!flat && <Icon className={big ? 'size-3.5' : 'size-3'} />}{text}
    </span>
  );
}

function Section({ no, title, meta, children, delay = 0 }: { no: string; title: string; meta?: string; children: React.ReactNode; delay?: number }) {
  return (
    <section
      className="flex flex-col report-reveal"
      style={{ paddingTop: 44, marginTop: 44, borderTop: '1px solid var(--border)', gap: 30, animationDelay: `${delay}ms` }}
    >
      <div className="flex flex-wrap items-baseline gap-x-[14px] sm:gap-x-[18px] gap-y-2">
        <span className="text-muted-foreground" style={{ fontFamily: SERIF, fontSize: 20 }}>{no}</span>
        <h2 className="m-0" style={{ fontFamily: SERIF, fontSize: 'clamp(22px, 5vw, 38px)', lineHeight: 1, letterSpacing: '-0.01em' }}>{title}</h2>
        {meta && <span className="text-muted-foreground sm:ml-auto max-sm:basis-full" style={{ fontSize: 12.5 }}>{meta}</span>}
      </div>
      {children}
    </section>
  );
}

function DataGrid({ items }: { items: [string, string][] }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4" style={{ borderTop: '1px solid var(--border)', borderLeft: '1px solid var(--border)' }}>
      {items.map(([label, value], i) => (
        <div
          key={i}
          style={{
            borderRight: '1px solid var(--border)',
            borderBottom: '1px solid var(--border)',
            padding: 'clamp(10px, 2.4vw, 16px) clamp(11px, 2.6vw, 18px)',
            minWidth: 0,
          }}
        >
          <p className="uppercase text-muted-foreground" style={{ fontSize: 'clamp(9.5px, 2.3vw, 11px)', letterSpacing: '0.1em', lineHeight: 1.2 }}>{label}</p>
          <p
            className="mt-[9px] tabular-nums break-words"
            style={{ fontFamily: SERIF, fontSize: 'clamp(15px, 4.2vw, 25px)', lineHeight: 1.1, overflowWrap: 'anywhere' }}
          >
            {value}
          </p>
        </div>
      ))}
    </div>
  );
}

function Block({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p
        className="uppercase text-muted-foreground"
        style={{ fontSize: 11, letterSpacing: '0.18em', marginBottom: 18, paddingBottom: 10, borderBottom: '1px solid var(--border)' }}
      >
        {label}
      </p>
      {children}
    </div>
  );
}

function TwoCol({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-[38px] gap-y-8">{children}</div>;
}

function MiniLi({ label, value, total }: { label: string; value: string; total?: boolean }) {
  return (
    <li
      className={`flex justify-between items-baseline gap-3 ${total ? 'text-foreground font-semibold' : 'text-muted-foreground'}`}
      style={{ padding: '12px 0', borderBottom: '1px solid var(--border)', fontSize: 'clamp(11.5px, 2.8vw, 13px)' }}
    >
      <span className="truncate">{label}</span>
      <b
        className="shrink-0 tabular-nums"
        style={{ fontFamily: SERIF, fontSize: 'clamp(13.5px, 3.6vw, 17px)', fontWeight: 400, color: total ? 'inherit' : 'var(--foreground)' }}
      >
        {value}
      </b>
    </li>
  );
}

function Table({ head, rows, align }: { head: string[]; rows: string[][]; align: ('left' | 'right')[] }) {
  return (
    <div className="max-sm:overflow-x-auto">
    <table className="w-full max-sm:min-w-[460px]" style={{ borderCollapse: 'collapse' }}>
      <thead>
        <tr>
          {head.map((h, i) => (
            <th
              key={i}
              className={`uppercase text-muted-foreground font-semibold ${align[i] === 'right' ? 'text-right' : 'text-left'}`}
              style={{ fontSize: 10.5, letterSpacing: '0.1em', padding: '0 14px 11px', borderBottom: '1px solid var(--border)' }}
            >
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((r, ri) => (
          <tr key={ri}>
            {r.map((c, ci) => (
              <td
                key={ci}
                className={`${align[ci] === 'right' ? 'text-right' : 'text-left'}`}
                style={{
                  padding: '10px 12px',
                  borderBottom: ri === rows.length - 1 ? 'none' : '1px solid var(--border)',
                  fontSize: align[ci] === 'right' ? 'clamp(12px, 3.2vw, 15px)' : 'clamp(11.5px, 3vw, 13.5px)',
                  fontFamily: align[ci] === 'right' ? SERIF : undefined,
                  fontVariantNumeric: 'tabular-nums',
                  color: ci === 0 && align[0] === 'left' ? 'var(--muted-foreground)' : undefined,
                  whiteSpace: ci === 0 ? 'nowrap' : undefined,
                }}
              >
                {c}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
    </div>
  );
}
