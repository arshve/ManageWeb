// Briefing PDF — landscape executive one-pager that mirrors the on-screen
// Briefing view (5 KPI cards + a modular card grid). Single page A4 landscape
// for at-a-glance reading; spills to additional pages if a section overflows.

import path from 'node:path';
import {
  Document, Page, View, Text, Image, Svg, Rect, StyleSheet,
} from '@react-pdf/renderer';
import { COMPANY, type CompanyInfo } from './company';
import { formatRupiah } from '@/lib/format';
import type { ReportData, Delta } from '@/lib/report/get-report';

const logoSrc = path.join(process.cwd(), 'public', 'logofix.png');

const C = {
  ink: '#15201c', muted: '#6c7773', line: '#d8dad4', track: '#e8e9e3',
  cardBorder: '#dcdfd7', success: '#16a34a', danger: '#dc2626',
};

const s = StyleSheet.create({
  page: { padding: 24, fontSize: 9, fontFamily: 'Helvetica', color: C.ink, backgroundColor: '#f4f3ef' },

  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 1.5, borderColor: C.ink, paddingBottom: 12 },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  logo: { width: 32, height: 32 },
  title: { fontSize: 16, fontWeight: 'bold' },
  sub: { fontSize: 9, color: C.muted, marginTop: 2 },
  meta: { fontSize: 8, color: C.muted, textTransform: 'uppercase', letterSpacing: 1 },

  kpiRow: { flexDirection: 'row', gap: 6, marginTop: 12 },
  kpi: { flex: 1, backgroundColor: '#ffffff', borderWidth: 1, borderColor: C.cardBorder, borderRadius: 8, padding: 8 },
  kpiTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  kpiLabel: { fontSize: 7.5, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.8 },
  kpiValue: { fontSize: 16, fontWeight: 'bold', marginTop: 6 },
  kpiSub: { fontSize: 7, color: C.muted, marginTop: 4 },
  delta: { fontSize: 7.5, fontWeight: 'bold' },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  card: { backgroundColor: '#ffffff', borderWidth: 1, borderColor: C.cardBorder, borderRadius: 8, padding: 9 },
  cardHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 1, borderColor: C.line, paddingBottom: 6, marginBottom: 7 },
  cardTitle: { fontSize: 9, fontWeight: 'bold' },
  cardMeta: { fontSize: 7.5, color: C.muted },

  barRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 3 },
  barLabel: { width: 80, fontSize: 7, color: C.muted },
  barTrack: { flex: 1, height: 6, backgroundColor: C.track, borderRadius: 2 },
  barVal: { width: 65, fontSize: 7.5, textAlign: 'right' },

  dg: { flexDirection: 'row', flexWrap: 'wrap', borderRadius: 4, overflow: 'hidden', borderWidth: 1, borderColor: C.line, marginTop: 2 },
  dgCell: { width: '50%', backgroundColor: '#ffffff', padding: 6, borderRightWidth: 1, borderBottomWidth: 1, borderColor: C.line },
  dgLabel: { fontSize: 6.5, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.5 },
  dgValue: { fontSize: 10, fontWeight: 'bold', marginTop: 2 },

  tr: { flexDirection: 'row', paddingVertical: 3, borderBottomWidth: 1, borderColor: C.line },
  th: { fontSize: 7, fontWeight: 'bold', color: C.muted, textTransform: 'uppercase', letterSpacing: 0.5 },
  td: { fontSize: 7.5 },

  foot: { marginTop: 10, paddingTop: 6, borderTopWidth: 1, borderColor: C.line, flexDirection: 'row', justifyContent: 'space-between', fontSize: 7, color: C.muted },
});

function deltaText(d: Delta): string {
  if (d.pct === null) return d.value > 0 ? 'baru' : '0%';
  const sign = d.pct > 0 ? '+' : d.pct < 0 ? '-' : '';
  return `${sign}${Math.abs(d.pct).toFixed(0)}%`;
}
function deltaColor(d: Delta): string {
  const v = d.pct ?? d.value;
  return v > 0 ? C.success : v < 0 ? C.danger : C.muted;
}
function rpShort(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1e9) return `Rp ${(n / 1e9).toFixed(1).replace('.', ',')} M`;
  if (abs >= 1e6) return `Rp ${(n / 1e6).toFixed(1).replace('.', ',')} jt`;
  if (abs >= 1e3) return `Rp ${Math.round(n / 1e3)} rb`;
  return formatRupiah(n);
}

function Bar({ label, value, max, fmt }: { label: string; value: number; max: number; fmt: (v: number) => string }) {
  const pct = Math.max((value / (max || 1)) * 100, 2);
  return (
    <View style={s.barRow}>
      <Text style={s.barLabel}>{label}</Text>
      <View style={s.barTrack}><View style={{ height: 6, width: `${pct}%`, backgroundColor: C.ink, borderRadius: 2 }} /></View>
      <Text style={s.barVal}>{fmt(value)}</Text>
    </View>
  );
}

function WeeklyBars({ data }: { data: { label: string; value: number }[] }) {
  if (!data.length) return <Text style={{ fontSize: 7.5, color: C.muted }}>Tidak ada data.</Text>;
  const W = 480, H = 90, gap = 6;
  const max = Math.max(...data.map((d) => d.value), 1);
  const peakIdx = data.reduce((bi, d, i) => (d.value > data[bi].value ? i : bi), 0);
  const n = data.length;
  const bw = (W - (n - 1) * gap) / n;
  return (
    <View>
      <Svg width={W} height={H}>
        {data.map((d, i) => {
          const h = Math.max((d.value / max) * (H - 18), 2);
          const x = i * (bw + gap);
          const y = H - h - 4;
          const isPeak = i === peakIdx && d.value > 0;
          return <Rect key={i} x={x} y={y} width={bw} height={h} fill={isPeak ? C.success : C.ink} rx={2} />;
        })}
      </Svg>
      <View style={{ flexDirection: 'row', marginTop: 2 }}>
        {data.map((d, i) => (
          <Text key={i} style={{ width: bw + (i < n - 1 ? gap : 0), fontSize: 6.5, color: C.muted, textAlign: 'center' }}>
            {d.label}
          </Text>
        ))}
      </View>
    </View>
  );
}

function toWeekly(perDay: { date: string; penjualan: number }[]) {
  if (!perDay.length) return [] as { label: string; value: number }[];
  const M = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agt', 'Sep', 'Okt', 'Nov', 'Des'];
  const out: { label: string; value: number }[] = [];
  for (let i = 0; i < perDay.length; i += 7) {
    const slice = perDay.slice(i, i + 7);
    const [, mo, dd] = slice[0].date.split('-');
    out.push({ label: `${Number(dd)} ${M[Number(mo) - 1] ?? ''}`, value: slice.reduce((a, b) => a + b.penjualan, 0) });
  }
  return out;
}

function Table({ head, rows, widths, rightFrom }: { head: string[]; rows: string[][]; widths: (number | 'flex')[]; rightFrom: number }) {
  const cell = (txt: string, i: number, base: typeof s.th | typeof s.td) => {
    const w = widths[i];
    const right = i >= rightFrom;
    return <Text key={i} style={[base, w === 'flex' ? { flex: 1 } : { width: w }, right ? { textAlign: 'right' } : {}]}>{txt}</Text>;
  };
  return (
    <View>
      <View style={s.tr}>{head.map((h, i) => cell(h, i, s.th))}</View>
      {rows.map((r, ri) => <View key={ri} style={s.tr}>{r.map((c, i) => cell(c, i, s.td))}</View>)}
    </View>
  );
}

export function BriefingDocument({ data, company = COMPANY }: { data: ReportData; company?: CompanyInfo }) {
  const f = data.finance;
  const d = data.delivery;
  const weekly = toWeekly(f.perDay);
  const salesMax = Math.max(...f.perSales.map((x) => x.penjualan), 1);
  const typeMax = Math.max(...f.byType.map((x) => x.penjualan), 1);
  const driverMax = Math.max(...d.perDriver.map((x) => x.total), 1);
  const stockMax = Math.max(...data.stock.byType.map((x) => x.value), 1);
  const resellerMax = Math.max(...data.reseller.perSales.map((x) => x.fee), 1);

  return (
    <Document>
      <Page size="A4" orientation="landscape" style={s.page}>
        {/* header */}
        <View style={s.head}>
          <View style={s.brand}>
            {/* eslint-disable-next-line jsx-a11y/alt-text */}
            <Image src={company.logoUrl || logoSrc} style={s.logo} />
            <View>
              <Text style={s.title}>Laporan Musim Qurban {data.range.year}</Text>
              <Text style={s.sub}>Idul Adha · {data.range.label}</Text>
            </View>
          </View>
          <Text style={s.meta}>
            {data.range.days} hari{data.range.hasComparison ? ` · ${data.range.compareLabel}` : ''}
          </Text>
        </View>

        {/* KPI row */}
        <View style={s.kpiRow}>
          <View style={s.kpi}>
            <View style={s.kpiTop}>
              <Text style={s.kpiLabel}>Penjualan</Text>
              {data.range.hasComparison && <Text style={[s.delta, { color: deltaColor(f.deltas.penjualan) }]}>{deltaText(f.deltas.penjualan)}</Text>}
            </View>
            <Text style={s.kpiValue}>{rpShort(f.penjualan)}</Text>
          </View>
          <View style={s.kpi}>
            <View style={s.kpiTop}>
              <Text style={s.kpiLabel}>Profit</Text>
              {data.range.hasComparison && <Text style={[s.delta, { color: deltaColor(f.deltas.profit) }]}>{deltaText(f.deltas.profit)}</Text>}
            </View>
            <Text style={s.kpiValue}>{rpShort(f.profit)}</Text>
            <Text style={s.kpiSub}>margin {(f.margin * 100).toFixed(1)}%</Text>
          </View>
          <View style={s.kpi}>
            <Text style={s.kpiLabel}>Hewan Terjual</Text>
            <Text style={s.kpiValue}>{f.itemCount.toLocaleString('id-ID')}</Text>
            <Text style={s.kpiSub}>{f.entryCount} transaksi</Text>
          </View>
          <View style={s.kpi}>
            <Text style={s.kpiLabel}>Pelanggan</Text>
            <Text style={s.kpiValue}>{f.uniqueBuyers.toLocaleString('id-ID')}</Text>
            <Text style={s.kpiSub}>{formatRupiah(f.avgPerTxn)} / txn</Text>
          </View>
          <View style={s.kpi}>
            <View style={s.kpiTop}>
              <Text style={s.kpiLabel}>Pengiriman</Text>
              {data.range.hasComparison && <Text style={[s.delta, { color: deltaColor(d.deltas.terkirim) }]}>{deltaText(d.deltas.terkirim)}</Text>}
            </View>
            <Text style={s.kpiValue}>{Math.round(d.successRate * 100)}%</Text>
            <Text style={s.kpiSub}>{d.terkirim}/{d.total} terkirim</Text>
          </View>
        </View>

        {/* card grid (row 1): weekly bars (wide) + ringkasan keuangan (narrow) */}
        <View style={s.grid}>
          <View style={[s.card, { width: '62%' }]}>
            <View style={s.cardHead}><Text style={s.cardTitle}>Penjualan per pekan</Text><Text style={s.cardMeta}>Puncak ditandai hijau</Text></View>
            <WeeklyBars data={weekly} />
          </View>
          <View style={[s.card, { flex: 1 }]}>
            <View style={s.cardHead}><Text style={s.cardTitle}>Ringkasan keuangan</Text></View>
            <View style={s.dg}>
              {[
                ['Penjualan', formatRupiah(f.penjualan)],
                ['Modal / HPP', formatRupiah(f.modal)],
                ['Profit', formatRupiah(f.profit)],
                ['Fee reseller', formatRupiah(f.fee)],
                ['Diterima', formatRupiah(f.diterima)],
                ['Piutang', formatRupiah(f.piutang)],
              ].map(([k, v], i) => (
                <View key={i} style={s.dgCell}>
                  <Text style={s.dgLabel}>{k}</Text>
                  <Text style={s.dgValue}>{v}</Text>
                </View>
              ))}
            </View>
          </View>
        </View>

        {/* row 2: per sales + per jenis + pembeli teratas */}
        <View style={s.grid}>
          <View style={[s.card, { width: '34%' }]}>
            <View style={s.cardHead}><Text style={s.cardTitle}>Penjualan per sales</Text></View>
            {f.perSales.map((x) => <Bar key={x.name} label={x.name} value={x.penjualan} max={salesMax} fmt={rpShort} />)}
          </View>
          <View style={[s.card, { width: '32%' }]}>
            <View style={s.cardHead}><Text style={s.cardTitle}>Penjualan per jenis</Text></View>
            {f.byType.map((x) => <Bar key={x.label} label={`${x.label} · ${x.qty}`} value={x.penjualan} max={typeMax} fmt={rpShort} />)}
          </View>
          <View style={[s.card, { flex: 1 }]}>
            <View style={s.cardHead}><Text style={s.cardTitle}>Pembeli teratas</Text></View>
            {f.topBuyers.length > 0 ? (
              <Table
                head={['Pembeli', 'Txn', 'Penjualan']}
                widths={['flex', 30, 70]}
                rightFrom={1}
                rows={f.topBuyers.map((b) => [b.name, String(b.count), rpShort(b.penjualan)])}
              />
            ) : <Text style={{ fontSize: 7.5, color: C.muted }}>Tidak ada data.</Text>}
          </View>
        </View>

        {/* row 3: peringkat sales (wide) */}
        {f.perSales.length > 0 && (
          <View style={s.grid}>
            <View style={[s.card, { width: '100%' }]}>
              <View style={s.cardHead}><Text style={s.cardTitle}>Papan peringkat sales</Text></View>
              <Table
                head={['#', 'Sales', 'Txn', 'Penjualan', 'Profit', 'Fee', 'Margin']}
                widths={[18, 'flex', 35, 100, 100, 90, 50]}
                rightFrom={2}
                rows={f.perSales.map((x, i) => [String(i + 1), x.name, String(x.count), formatRupiah(x.penjualan), formatRupiah(x.profit), formatRupiah(x.fee), `${(x.margin * 100).toFixed(0)}%`])}
              />
            </View>
          </View>
        )}

        {/* row 4: pengiriman per driver + fee reseller + stok */}
        <View style={s.grid}>
          <View style={[s.card, { width: '36%' }]}>
            <View style={s.cardHead}>
              <Text style={s.cardTitle}>Pengiriman per driver</Text>
              <Text style={s.cardMeta}>{(d.successRate * 100).toFixed(0)}% sukses</Text>
            </View>
            {d.perDriver.map((x) => <Bar key={x.name} label={x.name} value={x.total} max={driverMax} fmt={(v) => String(v)} />)}
          </View>
          <View style={[s.card, { width: '32%' }]}>
            <View style={s.cardHead}>
              <Text style={s.cardTitle}>Fee reseller</Text>
              <Text style={s.cardMeta}>{(data.reseller.feeRate * 100).toFixed(1)}%</Text>
            </View>
            {data.reseller.perSales.length > 0
              ? data.reseller.perSales.map((x) => <Bar key={x.name} label={x.name} value={x.fee} max={resellerMax} fmt={rpShort} />)
              : <Text style={{ fontSize: 7.5, color: C.muted }}>Belum ada fee reseller.</Text>}
          </View>
          <View style={[s.card, { flex: 1 }]}>
            <View style={s.cardHead}>
              <Text style={s.cardTitle}>Stok tersedia</Text>
              <Text style={s.cardMeta}>{data.stock.available} ekor</Text>
            </View>
            {data.stock.byType.map((x) => <Bar key={x.label} label={x.label} value={x.value} max={stockMax} fmt={(v) => String(v)} />)}
            {data.stock.liabilityCount > 0 && (
              <Text style={{ marginTop: 4, fontSize: 7.5, color: C.danger }}>
                Liabilitas {data.stock.liabilityCount} ekor — modal {rpShort(data.stock.lossModal)}
              </Text>
            )}
          </View>
        </View>

        <View style={s.foot}>
          <Text>{company.name}</Text>
          <Text>Laporan Musim Qurban {data.range.year}</Text>
        </View>
      </Page>
    </Document>
  );
}
