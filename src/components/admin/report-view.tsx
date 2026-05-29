'use client';

import { useRouter } from 'next/navigation';
import { Download, ChevronLeft, ChevronRight, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { formatRupiah } from '@/lib/format';
import type { ReportData, Delta } from '@/lib/report/get-report';
import { ComboDaily, HorizontalBars, Donut, CountUp } from '@/components/admin/report/charts';

const SERIF = "var(--font-dm-serif), 'DM Serif Display', serif";
// compact rupiah for big hero figures: Rp 12,3 jt / Rp 1,2 M
function rpShort(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1e9) return `Rp ${(n / 1e9).toFixed(1).replace('.', ',')} M`;
  if (abs >= 1e6) return `Rp ${(n / 1e6).toFixed(1).replace('.', ',')} jt`;
  if (abs >= 1e3) return `Rp ${Math.round(n / 1e3)} rb`;
  return formatRupiah(n);
}

export function ReportView({ data }: { data: ReportData }) {
  const router = useRouter();
  const { start, end } = data.range;
  const f = data.finance;

  function go(s: string, e: string) {
    router.push(`/admin/laporan?start=${s}&end=${e}`);
  }
  function setYear(y: number) {
    go(`${y}-01-01`, `${y}-12-31`);
  }
  function thisMonth() {
    const now = new Date();
    const first = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const last = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0));
    go(first.toISOString().slice(0, 10), last.toISOString().slice(0, 10));
  }

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
        <a
          href={`/api/laporan/pdf?start=${start}&end=${end}`}
          className="ml-auto inline-flex items-center gap-1.5 h-8 px-3.5 rounded-lg text-xs font-semibold"
          style={{ background: 'var(--primary)', color: 'var(--sidebar-primary)' }}
        >
          <Download className="size-3.5" /> Unduh PDF
        </a>
      </div>

      {/* ─────────────  REPORT SHEET  ───────────── */}
      <article className="overflow-hidden rounded-2xl border bg-card shadow-sm report-reveal">
        {/* Masthead (ink) — annual cover */}
        <header className="bg-foreground text-background px-6 sm:px-10 pt-9 pb-9 relative overflow-hidden">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-[10px] uppercase tracking-[0.28em] text-background/55">PT Millenials Farm Abadi</p>
              <p className="mt-1.5 text-[11px] uppercase tracking-[0.22em] text-background/75">Laporan Tahunan</p>
            </div>
            <div className="text-right">
              <p className="text-sm" style={{ fontFamily: SERIF }}>{data.range.label}</p>
              <p className="text-[11px] text-background/55 mt-1">{data.range.days} hari</p>
              {data.range.hasComparison && (
                <p className="text-[10px] text-background/45 mt-3 uppercase tracking-wider">{data.range.compareLabel}</p>
              )}
            </div>
          </div>

          {/* BIG YEAR — magazine cover focal */}
          <p
            className="mt-3 leading-none tracking-[-0.04em] tabular-nums"
            style={{ fontFamily: SERIF, fontSize: 'clamp(96px, 18vw, 220px)' }}
          >
            {data.range.year}
          </p>
          {data.finance.bestDay && (
            <p className="mt-3 text-[11px] uppercase tracking-[0.2em] text-background/55">
              Hari puncak · {rpShort(data.finance.bestDay.penjualan)}
            </p>
          )}

          {/* Capaian tiles */}
          <div className="mt-8 grid grid-cols-2 lg:grid-cols-4 gap-y-6">
            <Hero label="Penjualan" delta={data.range.hasComparison ? f.deltas.penjualan : undefined} first>
              <CountUp value={f.penjualan} format={rpShort} />
            </Hero>
            <Hero label="Hewan Terjual" sub={f.itemCount ? `Rp ${Math.round(f.penjualan / Math.max(f.itemCount, 1)).toLocaleString('id-ID')} / ekor` : undefined}>
              <CountUp value={f.itemCount} format={(v) => Math.round(v).toLocaleString('id-ID')} />
            </Hero>
            <Hero label="Pelanggan Unik" sub={f.entryCount ? `${f.entryCount} transaksi` : undefined}>
              <CountUp value={f.uniqueBuyers} format={(v) => Math.round(v).toLocaleString('id-ID')} />
            </Hero>
            <Hero label="Profit" delta={data.range.hasComparison ? f.deltas.profit : undefined} sub={`margin ${(f.margin * 100).toFixed(1)}%`}>
              <CountUp value={f.profit} format={rpShort} />
            </Hero>
          </div>
        </header>

        {/* Lede / insights */}
        {data.insights.length > 0 && (
          <section className="px-6 sm:px-10 py-7 border-b report-reveal" style={{ animationDelay: '80ms' }}>
            <p className="text-[10px] uppercase tracking-[0.24em] text-muted-foreground mb-3">Sorotan</p>
            <p className="text-xl sm:text-2xl leading-snug text-foreground" style={{ fontFamily: SERIF }}>
              {data.insights[0]}
            </p>
            {data.insights.length > 1 && (
              <ul className="mt-5 grid sm:grid-cols-2 gap-x-10 gap-y-2.5">
                {data.insights.slice(1).map((t, i) => (
                  <li key={i} className="flex gap-2.5 text-[13px] text-muted-foreground leading-relaxed">
                    <span className="text-foreground/30 select-none">—</span>
                    <span>{t}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        <div className="px-6 sm:px-10 py-9 flex flex-col gap-14">
          {/* 01 — Keuangan */}
          <Section no="01" title="Keuangan" meta={`${f.entryCount} transaksi · ${f.itemCount} ekor`} delay={160}>
            <DataGrid
              items={[
                ['Penjualan', formatRupiah(f.penjualan)],
                ['Modal / HPP', formatRupiah(f.modal)],
                ['Fee reseller', formatRupiah(f.fee)],
                ['Profit', formatRupiah(f.profit)],
                ['Rata-rata / transaksi', formatRupiah(f.avgPerTxn)],
                ['Rata-rata / ekor', formatRupiah(f.avgPerAnimal)],
                ['Margin profit', `${(f.margin * 100).toFixed(1)}%`],
                ['Tertagih', `${(f.collectionRate * 100).toFixed(0)}%`],
                [`Diterima · ${f.countLunas} lunas, ${f.countDp} DP`, formatRupiah(f.diterima)],
                [`Piutang · ${f.countBelum} belum bayar`, formatRupiah(f.piutang)],
                ['Cashflow masuk', formatRupiah(f.cashflow.pemasukan)],
                ['Cashflow keluar', formatRupiah(f.cashflow.pengeluaran)],
              ]}
            />

            <Block label="Penjualan & Profit harian" className="text-foreground/80">
              <ComboDaily
                data={f.perDay.map((d) => ({ label: d.date.slice(8), bar: d.penjualan, line: Math.max(d.profit, 0) }))}
                format={formatRupiah}
              />
            </Block>

            <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-x-12 gap-y-8 items-start">
              {f.paymentMix.length > 0 && (
                <Block label="Status pembayaran">
                  <Donut data={f.paymentMix} center={{ primary: rpShort(f.penjualan), secondary: 'PENJUALAN' }} />
                </Block>
              )}
              <Block label="Cashflow vs profit" className="text-foreground/70 lg:w-72">
                <ul className="flex flex-col gap-2 text-xs">
                  <li className="flex items-center justify-between gap-3"><span className="text-muted-foreground">Profit operasional</span><span className="tabular-nums" style={{ fontFamily: SERIF }}>{formatRupiah(f.profit)}</span></li>
                  <li className="flex items-center justify-between gap-3"><span className="text-muted-foreground">Cashflow bersih</span><span className="tabular-nums" style={{ fontFamily: SERIF }}>{formatRupiah(f.cashflow.net)}</span></li>
                  <li className="flex items-center justify-between gap-3 border-t pt-2"><span className="text-muted-foreground">Selisih</span><span className="tabular-nums" style={{ fontFamily: SERIF }}>{formatRupiah(f.profit - f.cashflow.net)}</span></li>
                </ul>
              </Block>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-12 gap-y-8">
              <Block label="Penjualan per sales" className="text-foreground/80">
                <HorizontalBars data={f.perSales.map((s) => ({ label: s.name, value: s.penjualan }))} format={formatRupiah} />
              </Block>
              <Block label="Penjualan per jenis hewan" className="text-success-fg">
                <HorizontalBars data={f.byType.map((t) => ({ label: `${t.label} · ${t.qty}`, value: t.penjualan }))} format={formatRupiah} />
              </Block>
              <Block label="Profit per sales" className="text-success-fg">
                <HorizontalBars data={f.perSales.map((s) => ({ label: s.name, value: Math.max(s.profit, 0) }))} format={formatRupiah} />
              </Block>
              <Block label="Profit per jenis hewan" className="text-info-fg">
                <HorizontalBars data={f.byType.map((t) => ({ label: t.label, value: Math.max(t.profit, 0) }))} format={formatRupiah} />
              </Block>
            </div>

            {f.perSales.length > 0 && (
              <Block label="Papan peringkat sales">
                <Table
                  head={['#', 'Sales', 'Txn', 'Penjualan', 'Profit', 'Margin']}
                  align={['left', 'left', 'right', 'right', 'right', 'right']}
                  rows={f.perSales.map((s, i) => [`${i + 1}`, s.name, String(s.count), formatRupiah(s.penjualan), formatRupiah(s.profit), `${(s.margin * 100).toFixed(0)}%`])}
                />
              </Block>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-12 gap-y-8">
              {f.topBuyers.length > 0 && (
                <Block label="Pembeli teratas">
                  <Table
                    head={['Pembeli', 'Txn', 'Penjualan']}
                    align={['left', 'right', 'right']}
                    rows={f.topBuyers.map((b) => [b.name, String(b.count), formatRupiah(b.penjualan)])}
                  />
                </Block>
              )}
              {f.cashflow.categories.length > 0 && (
                <Block label="Cashflow per kategori">
                  <Table
                    head={['Kategori', 'Tipe', 'Jumlah']}
                    align={['left', 'left', 'right']}
                    rows={f.cashflow.categories.map((c) => [c.name, c.type === 'PEMASUKAN' ? 'Masuk' : 'Keluar', formatRupiah(c.amount)])}
                  />
                </Block>
              )}
            </div>
          </Section>

          {/* 02 — Pengiriman */}
          <Section no="02" title="Pengiriman" meta={`${data.delivery.total} dijadwalkan · ${(data.delivery.successRate * 100).toFixed(0)}% sukses`} delay={240}>
            <div className="flex flex-wrap gap-x-12 gap-y-8 items-start text-foreground/80">
              <Donut
                data={data.delivery.statusBreakdown}
                center={{ primary: `${(data.delivery.successRate * 100).toFixed(0)}%`, secondary: 'SUKSES' }}
              />
              <div className="flex-1 min-w-[260px]">
                <Block label="Pengiriman per driver" className="text-foreground/70">
                  <HorizontalBars data={data.delivery.perDriver.map((d) => ({ label: d.name, value: d.total }))} format={(v) => String(v)} />
                </Block>
              </div>
            </div>
            {data.delivery.byPengiriman.length > 0 && (
              <Block label="Volume per tipe pengiriman" className="text-info-fg">
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

          {/* 03 — Fee Reseller */}
          <Section
            no="03"
            title="Fee Reseller"
            meta={`${formatRupiah(data.reseller.fee)} · ${(data.reseller.feeRate * 100).toFixed(1)}% dari penjualan`}
            delay={320}
          >
            <DataGrid
              items={[
                ['Total fee dibayarkan', formatRupiah(data.reseller.fee)],
                ['Persentase dari penjualan', `${(data.reseller.feeRate * 100).toFixed(2)}%`],
                ['Rata-rata / transaksi', formatRupiah(data.reseller.avgPerTxn)],
                ['Reseller aktif', `${data.reseller.perSales.length}`],
              ]}
            />

            {data.reseller.perSales.length > 0 ? (
              <>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-12 gap-y-8">
                  <Block label="Fee per reseller" className="text-foreground/80">
                    <HorizontalBars data={data.reseller.perSales.map((s) => ({ label: s.name, value: s.fee }))} format={formatRupiah} />
                  </Block>
                  {data.reseller.byType.length > 0 && (
                    <Block label="Fee per jenis hewan" className="text-success-fg">
                      <HorizontalBars data={data.reseller.byType.map((t) => ({ label: `${t.label} · ${t.qty}`, value: t.fee }))} format={formatRupiah} />
                    </Block>
                  )}
                </div>

                <Block label="Papan peringkat reseller">
                  <Table
                    head={['#', 'Reseller', 'Txn', 'Fee', 'Bagian']}
                    align={['left', 'left', 'right', 'right', 'right']}
                    rows={data.reseller.perSales.map((r, i) => [`${i + 1}`, r.name, String(r.count), formatRupiah(r.fee), `${(r.share * 100).toFixed(1)}%`])}
                  />
                </Block>
              </>
            ) : (
              <p className="text-xs text-muted-foreground py-4">Belum ada fee reseller di periode ini.</p>
            )}
          </Section>

          {/* 04 — Stok */}
          <Section
            no="04"
            title="Stok Hewan"
            meta={data.stock.liabilityCount > 0
              ? `Snapshot saat ini · ${data.stock.liabilityCount} liabilitas`
              : 'Snapshot saat ini'}
            delay={400}
          >
            <DataGrid
              items={[
                ['Total ternak', String(data.stock.total)],
                ['Tersedia · sehat', String(data.stock.available)],
                ['Terjual · total', String(data.stock.sold)],
                ['Terjual · periode', String(data.stock.soldInPeriod)],
                ['Nilai modal stok', formatRupiah(data.stock.inventoryValueModal)],
                ['Nilai jual stok', formatRupiah(data.stock.inventoryValueJual)],
                ['Potensi profit', formatRupiah(data.stock.inventoryValueJual - data.stock.inventoryValueModal)],
                ['Kerugian stok · modal', formatRupiah(data.stock.lossModal)],
              ]}
            />
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
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-x-12 gap-y-8">
              <Block label="Tersedia per jenis" className="text-success-fg">
                <HorizontalBars data={data.stock.byType} format={(v) => String(v)} />
              </Block>
              <Block label="Tersedia per grade" className="text-info-fg">
                <HorizontalBars data={data.stock.byGrade} format={(v) => String(v)} />
              </Block>
              <Block label="Per kondisi" className="text-warning-fg">
                <HorizontalBars data={data.stock.byCondition} format={(v) => String(v)} />
              </Block>
            </div>
          </Section>
        </div>

        <footer className="px-6 sm:px-10 py-5 border-t flex items-center justify-between text-[10px] uppercase tracking-[0.2em] text-muted-foreground report-reveal" style={{ animationDelay: '500ms' }}>
          <span>Millenials Farm</span>
          <span>{data.range.label}</span>
        </footer>
      </article>
    </div>
  );
}

/* ── pieces ────────────────────────────────────────────────────────── */

function Hero({ label, children, sub, delta, first }: { label: string; children: React.ReactNode; sub?: string; delta?: Delta; first?: boolean }) {
  return (
    <div className={`px-5 lg:border-l lg:border-background/15 ${first ? 'lg:border-l-0 lg:pl-0' : ''}`}>
      <p className="text-[10px] uppercase tracking-[0.18em] text-background/55">{label}</p>
      <p className="mt-1.5 text-3xl sm:text-[2.1rem] leading-none tabular-nums" style={{ fontFamily: SERIF }}>{children}</p>
      <div className="mt-2 flex items-center gap-2 h-4">
        {delta && <DeltaChip d={delta} onDark />}
        {sub && <span className="text-[11px] text-background/55">{sub}</span>}
      </div>
    </div>
  );
}

function DeltaChip({ d, onDark }: { d: Delta; onDark?: boolean }) {
  const flat = d.pct === 0 || (d.pct === null && d.value === 0);
  const up = d.pct === null ? d.value > 0 : (d.pct ?? 0) > 0;
  const text = d.pct === null ? (d.value > 0 ? 'baru' : '0%') : `${Math.abs(d.pct).toFixed(0)}%`;
  const Icon = up ? ArrowUpRight : ArrowDownRight;
  const color = flat ? (onDark ? '#cbd5e1' : '#64748b') : up ? (onDark ? '#4ade80' : 'var(--success-fg)') : (onDark ? '#f87171' : 'var(--danger-fg)');
  return (
    <span className="inline-flex items-center gap-0.5 text-[11px] font-medium" style={{ color }}>
      {!flat && <Icon className="size-3" />}{text}
    </span>
  );
}

function Section({ no, title, meta, children, delay = 0 }: { no: string; title: string; meta?: string; children: React.ReactNode; delay?: number }) {
  return (
    <section className="flex flex-col gap-6 report-reveal" style={{ animationDelay: `${delay}ms` }}>
      <div className="flex items-end gap-4 border-b border-foreground/15 pb-3">
        <span className="text-3xl leading-none text-foreground/20" style={{ fontFamily: SERIF }}>{no}</span>
        <h2 className="text-2xl leading-none" style={{ fontFamily: SERIF }}>{title}</h2>
        {meta && <span className="ml-auto text-[11px] text-muted-foreground pb-0.5">{meta}</span>}
      </div>
      {children}
    </section>
  );
}

// hairline-separated figure grid (the editorial "data table" look)
function DataGrid({ items }: { items: [string, string][] }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 border-t border-l border-border">
      {items.map(([label, value], i) => (
        <div key={i} className="border-b border-r border-border px-3 py-3">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground leading-tight">{label}</p>
          <p className="mt-1.5 text-lg leading-none tabular-nums" style={{ fontFamily: SERIF }}>{value}</p>
        </div>
      ))}
    </div>
  );
}

function Block({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground mb-3">{label}</p>
      {children}
    </div>
  );
}

function Table({ head, rows, align }: { head: string[]; rows: string[][]; align: ('left' | 'right')[] }) {
  return (
    <table className="w-full text-xs">
      <thead>
        <tr className="border-b border-foreground/15">
          {head.map((h, i) => (
            <th key={i} className={`pb-2 text-[10px] uppercase tracking-wider font-medium text-muted-foreground ${align[i] === 'right' ? 'text-right' : 'text-left'}`}>{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((r, ri) => (
          <tr key={ri} className="border-b border-border last:border-0">
            {r.map((c, ci) => (
              <td key={ci} className={`py-2 ${align[ci] === 'right' ? 'text-right tabular-nums' : ''} ${ci === 0 ? 'text-foreground' : 'text-muted-foreground'}`}>{c}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
