import path from 'node:path';
import {
  Document,
  Page,
  View,
  Text,
  Image,
  Svg,
  Rect,
  StyleSheet,
} from '@react-pdf/renderer';
import { COMPANY } from './company';
import { formatRupiah } from '@/lib/format';
import type { ReportData, Delta } from '@/lib/report/get-report';

const logoSrc = path.join(process.cwd(), 'public', 'logo.png');

const C = {
  ink: '#0f172a', muted: '#64748b', line: '#e2e8f0', track: '#eef2f7',
  blue: '#2563eb', green: '#16a34a', red: '#dc2626', violet: '#7c3aed',
  amber: '#ca8a04', cyan: '#0891b2', infoBg: '#eff6ff',
};

const s = StyleSheet.create({
  page: { padding: 30, fontSize: 9, fontFamily: 'Helvetica', color: C.ink },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', borderBottomWidth: 1, borderColor: C.line, paddingBottom: 10 },
  logoBlock: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  logo: { width: 38, height: 38 },
  companyName: { fontSize: 11, fontWeight: 'bold' },
  companyTagline: { fontSize: 7.5, color: C.muted, marginTop: 1 },
  title: { fontSize: 16, fontWeight: 'bold', textAlign: 'right' },
  period: { fontSize: 8, color: C.muted, textAlign: 'right', marginTop: 2 },

  insightBox: { marginTop: 10, borderWidth: 1, borderColor: '#bfdbfe', backgroundColor: C.infoBg, borderRadius: 4, padding: 8 },
  insightTitle: { fontSize: 9, fontWeight: 'bold', marginBottom: 4 },
  insightItem: { fontSize: 8, marginBottom: 2, lineHeight: 1.35 },

  kpiRow: { flexDirection: 'row', gap: 8, marginTop: 10 },
  kpi: { flex: 1, borderWidth: 1, borderColor: C.line, borderRadius: 4, padding: 7 },
  kpiLabel: { fontSize: 7.5, color: C.muted },
  kpiValue: { fontSize: 11, fontWeight: 'bold', marginTop: 2 },
  kpiSub: { fontSize: 6.5, color: C.muted, marginTop: 2 },

  section: { marginTop: 14 },
  sectionHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', borderBottomWidth: 1, borderColor: C.line, paddingBottom: 4, marginBottom: 8 },
  sectionTitle: { fontSize: 13, fontWeight: 'bold' },
  sectionSub: { fontSize: 8, color: C.muted },

  statGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 5 },
  stat: { width: '23.7%', borderWidth: 1, borderColor: C.line, borderRadius: 3, padding: 5 },
  statLabel: { fontSize: 6.5, color: C.muted },
  statValue: { fontSize: 9, fontWeight: 'bold', marginTop: 2 },

  subHead: { fontSize: 8, fontWeight: 'bold', color: C.muted, textTransform: 'uppercase', marginTop: 9, marginBottom: 5 },

  barRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 3 },
  barLabel: { width: 110, fontSize: 7.5, color: C.muted },
  barTrack: { flex: 1, height: 7, backgroundColor: C.track, borderRadius: 2 },
  barVal: { width: 78, fontSize: 7.5, textAlign: 'right' },

  tr: { flexDirection: 'row', borderBottomWidth: 1, borderColor: C.line, paddingVertical: 3 },
  th: { fontSize: 7.5, fontWeight: 'bold', color: C.muted },
  td: { fontSize: 7.5 },

  footer: { marginTop: 16, paddingTop: 6, borderTopWidth: 1, borderColor: C.line, fontSize: 7.5, color: C.muted, textAlign: 'center' },
});

function deltaText(d: Delta): string {
  if (d.pct === null) return d.value > 0 ? '(baru)' : '';
  const arrow = d.pct > 0 ? '+' : d.pct < 0 ? '-' : '';
  return `(${arrow}${Math.abs(d.pct).toFixed(0)}% vs lalu)`;
}

function Bar({ label, value, max, color, fmt }: { label: string; value: number; max: number; color: string; fmt: (v: number) => string }) {
  const pct = Math.max((value / (max || 1)) * 100, 2);
  return (
    <View style={s.barRow}>
      <Text style={s.barLabel}>{label}</Text>
      <View style={s.barTrack}><View style={{ height: 7, width: `${pct}%`, backgroundColor: color, borderRadius: 2 }} /></View>
      <Text style={s.barVal}>{fmt(value)}</Text>
    </View>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return <View style={s.stat}><Text style={s.statLabel}>{label}</Text><Text style={s.statValue}>{value}</Text></View>;
}

function PerDayChart({ data }: { data: { date: string; penjualan: number }[] }) {
  if (!data.length) return <Text style={{ fontSize: 8, color: C.muted }}>Tidak ada data.</Text>;
  const W = 535, H = 80, pad = 2;
  const max = Math.max(...data.map((d) => d.penjualan), 1);
  const n = data.length;
  const bw = (W - (n - 1) * pad) / n;
  return (
    <Svg width={W} height={H}>
      {data.map((d, i) => {
        const h = Math.max((d.penjualan / max) * (H - 4), 1);
        return <Rect key={i} x={i * (bw + pad)} y={H - h} width={bw} height={h} fill={C.blue} rx={1} />;
      })}
    </Svg>
  );
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

export function ReportDocument({ data }: { data: ReportData }) {
  const f = data.finance;
  const salesMax = Math.max(...f.perSales.map((x) => x.penjualan), 1);
  const typeRevMax = Math.max(...f.byType.map((x) => x.penjualan), 1);
  const driverMax = Math.max(...data.delivery.perDriver.map((x) => x.total), 1);
  const typeMax = Math.max(...data.stock.byType.map((x) => x.value), 1);
  const gradeMax = Math.max(...data.stock.byGrade.map((x) => x.value), 1);
  const condMax = Math.max(...data.stock.byCondition.map((x) => x.value), 1);

  return (
    <Document>
      <Page size="A4" style={s.page}>
        {/* Header */}
        <View style={s.headerRow}>
          <View style={s.logoBlock}>
            {/* eslint-disable-next-line jsx-a11y/alt-text */}
            <Image src={logoSrc} style={s.logo} />
            <View>
              <Text style={s.companyName}>{COMPANY.name}</Text>
              <Text style={s.companyTagline}>{COMPANY.tagline}</Text>
            </View>
          </View>
          <View>
            <Text style={s.title}>LAPORAN RINGKASAN</Text>
            <Text style={s.period}>Periode {data.range.label} · {data.range.days} hari</Text>
            <Text style={s.period}>vs {data.range.prevLabel}</Text>
          </View>
        </View>

        {/* Insights */}
        <View style={s.insightBox}>
          <Text style={s.insightTitle}>Ringkasan & Insight</Text>
          {data.insights.map((t, i) => <Text key={i} style={s.insightItem}>• {t}</Text>)}
        </View>

        {/* Headline KPIs */}
        <View style={s.kpiRow}>
          <View style={s.kpi}><Text style={s.kpiLabel}>Penjualan</Text><Text style={[s.kpiValue, { color: C.blue }]}>{formatRupiah(f.penjualan)}</Text><Text style={s.kpiSub}>{deltaText(f.deltas.penjualan)}</Text></View>
          <View style={s.kpi}><Text style={s.kpiLabel}>Profit</Text><Text style={[s.kpiValue, { color: f.profit >= 0 ? C.green : C.red }]}>{formatRupiah(f.profit)}</Text><Text style={s.kpiSub}>Margin {(f.margin * 100).toFixed(1)}% {deltaText(f.deltas.profit)}</Text></View>
          <View style={s.kpi}><Text style={s.kpiLabel}>Terkirim</Text><Text style={s.kpiValue}>{data.delivery.terkirim} / {data.delivery.total}</Text><Text style={s.kpiSub}>{(data.delivery.successRate * 100).toFixed(0)}% sukses</Text></View>
          <View style={s.kpi}><Text style={s.kpiLabel}>Stok Tersedia</Text><Text style={s.kpiValue}>{data.stock.available}</Text><Text style={s.kpiSub}>Nilai {formatRupiah(data.stock.inventoryValueModal)}</Text></View>
        </View>

        {/* Keuangan */}
        <View style={s.section}>
          <View style={s.sectionHead}>
            <Text style={s.sectionTitle}>Keuangan</Text>
            <Text style={s.sectionSub}>{f.entryCount} transaksi · {f.itemCount} hewan terjual</Text>
          </View>
          <View style={s.statGrid}>
            <Stat label="Penjualan" value={formatRupiah(f.penjualan)} />
            <Stat label="Modal (HPP)" value={formatRupiah(f.modal)} />
            <Stat label="Fee Reseller" value={formatRupiah(f.fee)} />
            <Stat label="Profit" value={formatRupiah(f.profit)} />
            <Stat label="Rata-rata / transaksi" value={formatRupiah(f.avgPerTxn)} />
            <Stat label="Rata-rata / ekor" value={formatRupiah(f.avgPerAnimal)} />
            <Stat label="Margin profit" value={`${(f.margin * 100).toFixed(1)}%`} />
            <Stat label="Tertagih" value={`${(f.collectionRate * 100).toFixed(0)}%`} />
            <Stat label={`Diterima (${f.countLunas}L/${f.countDp}DP)`} value={formatRupiah(f.diterima)} />
            <Stat label={`Piutang (${f.countBelum} belum)`} value={formatRupiah(f.piutang)} />
            <Stat label="Cashflow masuk" value={formatRupiah(f.cashflow.pemasukan)} />
            <Stat label="Cashflow keluar" value={formatRupiah(f.cashflow.pengeluaran)} />
          </View>

          <Text style={s.subHead}>Penjualan per hari</Text>
          <PerDayChart data={f.perDay} />

          <Text style={s.subHead}>Penjualan per sales</Text>
          {f.perSales.map((x) => <Bar key={x.name} label={x.name} value={x.penjualan} max={salesMax} color={C.blue} fmt={formatRupiah} />)}

          <Text style={s.subHead}>Penjualan per jenis hewan</Text>
          {f.byType.map((x) => <Bar key={x.label} label={`${x.label} (${x.qty})`} value={x.penjualan} max={typeRevMax} color={C.cyan} fmt={formatRupiah} />)}

          <Text style={s.subHead}>Profit per jenis hewan</Text>
          {(() => {
            const m = Math.max(...f.byType.map((x) => Math.max(x.profit, 0)), 1);
            return f.byType.map((x) => <Bar key={x.label} label={x.label} value={Math.max(x.profit, 0)} max={m} color={C.green} fmt={formatRupiah} />);
          })()}

          {f.paymentMix.length > 0 && (
            <>
              <Text style={s.subHead}>Status pembayaran</Text>
              <Table
                head={['Status', 'Transaksi', 'Penjualan']}
                widths={['flex', 70, 110]}
                rightFrom={1}
                rows={f.paymentMix.map((p) => [p.label, String(p.count), formatRupiah(p.value)])}
              />
            </>
          )}

          {f.perSales.length > 0 && (
            <>
              <Text style={s.subHead}>Rincian per sales</Text>
              <Table
                head={['Sales', 'Txn', 'Penjualan', 'Profit', 'Margin']}
                widths={['flex', 40, 90, 90, 50]}
                rightFrom={1}
                rows={f.perSales.map((x) => [x.name, String(x.count), formatRupiah(x.penjualan), formatRupiah(x.profit), `${(x.margin * 100).toFixed(0)}%`])}
              />
            </>
          )}

          {f.topBuyers.length > 0 && (
            <>
              <Text style={s.subHead}>Pembeli teratas</Text>
              <Table
                head={['Pembeli', 'Txn', 'Penjualan']}
                widths={['flex', 50, 100]}
                rightFrom={1}
                rows={f.topBuyers.map((b) => [b.name, String(b.count), formatRupiah(b.penjualan)])}
              />
            </>
          )}

          {f.cashflow.categories.length > 0 && (
            <>
              <Text style={s.subHead}>Cashflow per kategori</Text>
              <Table
                head={['Kategori', 'Tipe', 'Jumlah']}
                widths={['flex', 70, 100]}
                rightFrom={2}
                rows={f.cashflow.categories.map((c) => [c.name, c.type === 'PEMASUKAN' ? 'Masuk' : 'Keluar', formatRupiah(c.amount)])}
              />
            </>
          )}
        </View>

        {/* Pengiriman */}
        <View style={s.section} wrap={false}>
          <View style={s.sectionHead}>
            <Text style={s.sectionTitle}>Pengiriman</Text>
            <Text style={s.sectionSub}>{data.delivery.total} dijadwalkan · {(data.delivery.successRate * 100).toFixed(0)}% sukses</Text>
          </View>
          <View style={s.statGrid}>
            <Stat label="Terkirim" value={String(data.delivery.terkirim)} />
            <Stat label="Proses" value={String(data.delivery.proses)} />
            <Stat label="Gagal" value={String(data.delivery.gagal)} />
            <Stat label="Total" value={String(data.delivery.total)} />
          </View>
          <Text style={s.subHead}>Per driver</Text>
          {data.delivery.perDriver.map((d) => <Bar key={d.name} label={d.name} value={d.total} max={driverMax} color={C.violet} fmt={(v) => String(v)} />)}

          {data.delivery.byPengiriman.length > 0 && (
            <>
              <Text style={s.subHead}>Volume per tipe pengiriman</Text>
              {(() => {
                const m = Math.max(...data.delivery.byPengiriman.map((x) => x.value), 1);
                return data.delivery.byPengiriman.map((x) => <Bar key={x.label} label={x.label} value={x.value} max={m} color={C.cyan} fmt={(v) => String(v)} />);
              })()}
            </>
          )}
          {data.delivery.perDriver.length > 0 && (
            <>
              <Text style={s.subHead}>Rincian per driver</Text>
              <Table
                head={['Driver', 'Total', 'Terkirim', 'Gagal', 'Sukses']}
                widths={['flex', 50, 55, 45, 50]}
                rightFrom={1}
                rows={data.delivery.perDriver.map((d) => [d.name, String(d.total), String(d.terkirim), String(d.gagal), `${(d.successRate * 100).toFixed(0)}%`])}
              />
            </>
          )}
        </View>

        {/* Stok */}
        <View style={s.section} wrap={false}>
          <View style={s.sectionHead}>
            <Text style={s.sectionTitle}>Stok Hewan</Text>
            <Text style={s.sectionSub}>Snapshot saat ini</Text>
          </View>
          <View style={s.statGrid}>
            <Stat label="Total" value={String(data.stock.total)} />
            <Stat label="Tersedia" value={String(data.stock.available)} />
            <Stat label="Terjual (total)" value={String(data.stock.sold)} />
            <Stat label="Terjual (periode)" value={String(data.stock.soldInPeriod)} />
            <Stat label="Nilai modal stok" value={formatRupiah(data.stock.inventoryValueModal)} />
            <Stat label="Nilai jual stok" value={formatRupiah(data.stock.inventoryValueJual)} />
            <Stat label="Potensi profit" value={formatRupiah(data.stock.inventoryValueJual - data.stock.inventoryValueModal)} />
          </View>
          <Text style={s.subHead}>Tersedia per jenis</Text>
          {data.stock.byType.map((x) => <Bar key={x.label} label={x.label} value={x.value} max={typeMax} color={C.green} fmt={(v) => String(v)} />)}
          <Text style={s.subHead}>Tersedia per grade</Text>
          {data.stock.byGrade.map((x) => <Bar key={x.label} label={x.label} value={x.value} max={gradeMax} color={C.cyan} fmt={(v) => String(v)} />)}
          <Text style={s.subHead}>Per kondisi</Text>
          {data.stock.byCondition.map((x) => <Bar key={x.label} label={x.label} value={x.value} max={condMax} color={C.amber} fmt={(v) => String(v)} />)}
        </View>

        <Text style={s.footer}>Dibuat otomatis oleh Millenials Farm · Periode {data.range.label}</Text>
      </Page>
    </Document>
  );
}
