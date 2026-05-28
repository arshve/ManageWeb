import { prisma } from '@/lib/prisma';
import { formatRupiah, formatPengiriman } from '@/lib/format';

/** Period-over-period change. pct is null when the previous value was 0. */
export type Delta = { value: number; pct: number | null };

/** All money is IDR. Aggregated server-side for one date range. */
export type ReportData = {
  range: { start: string; end: string; label: string; prevLabel: string; days: number };
  insights: string[];
  finance: {
    penjualan: number;
    modal: number;
    fee: number;
    profit: number;
    margin: number; // profit / penjualan, 0..1
    entryCount: number;
    itemCount: number;
    avgPerTxn: number;
    avgPerAnimal: number;
    diterima: number;
    piutang: number;
    collectionRate: number; // diterima / penjualan, 0..1
    countLunas: number;
    countDp: number;
    countBelum: number;
    bestDay: { date: string; penjualan: number } | null;
    perDay: { date: string; penjualan: number; profit: number }[];
    perSales: { name: string; count: number; penjualan: number; profit: number; margin: number }[];
    byType: { label: string; penjualan: number; profit: number; qty: number }[];
    topBuyers: { name: string; penjualan: number; count: number }[];
    paymentMix: { label: string; value: number; count: number; color: string }[];
    cashflow: {
      pemasukan: number;
      pengeluaran: number;
      net: number;
      categories: { name: string; amount: number; type: 'PEMASUKAN' | 'PENGELUARAN' }[];
    };
    deltas: { penjualan: Delta; profit: Delta; entryCount: Delta };
  };
  delivery: {
    total: number;
    terkirim: number;
    gagal: number;
    proses: number;
    successRate: number; // terkirim / total, 0..1
    perDriver: { name: string; total: number; terkirim: number; gagal: number; successRate: number }[];
    statusBreakdown: { label: string; value: number; color: string }[];
    byPengiriman: { label: string; value: number }[];
    deltas: { total: Delta; terkirim: Delta };
  };
  stock: {
    total: number;
    available: number;
    sold: number;
    soldInPeriod: number;
    inventoryValueModal: number;
    inventoryValueJual: number;
    byType: { label: string; value: number }[];
    byGrade: { label: string; value: number }[];
    byCondition: { label: string; value: number }[];
  };
};

const MONTHS_ID = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];
const DAY_MS = 24 * 60 * 60 * 1000;

const dayKey = (d: Date) => d.toISOString().slice(0, 10);
const titleCase = (s: string) => s.charAt(0) + s.slice(1).toLowerCase();

function fmtDay(d: Date): string {
  return `${d.getUTCDate()} ${MONTHS_ID[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}
function rangeLabel(start: Date, end: Date): string {
  const sd = fmtDay(start), ed = fmtDay(end);
  return sd === ed ? sd : `${sd} – ${ed}`;
}
function delta(cur: number, prev: number): Delta {
  return { value: cur - prev, pct: prev === 0 ? null : ((cur - prev) / prev) * 100 };
}
function pctStr(d: Delta): string {
  if (d.pct === null) return d.value > 0 ? 'baru' : '0%';
  const arrow = d.pct > 0 ? '▲' : d.pct < 0 ? '▼' : '•';
  return `${arrow} ${Math.abs(d.pct).toFixed(0)}%`;
}

/**
 * Build the all-in-one report for [start, end] (inclusive) with comparisons to
 * the immediately-preceding window of the same length. Finance + cashflow filter
 * by createdAt; deliveries by Entry.deliveryDate; stock is a live snapshot.
 */
export async function getReportData(start: Date, end: Date): Promise<ReportData> {
  const endInclusive = new Date(end);
  endInclusive.setUTCHours(23, 59, 59, 999);
  const days = Math.round((end.getTime() - start.getTime()) / DAY_MS) + 1;

  // previous window of equal length, ending the day before `start`
  const prevEnd = new Date(start.getTime() - DAY_MS);
  const prevStart = new Date(prevEnd.getTime() - (days - 1) * DAY_MS);
  const prevEndInclusive = new Date(prevEnd);
  prevEndInclusive.setUTCHours(23, 59, 59, 999);

  const [entries, cashflows, deliveries, livestock, prevEntries, prevDeliveries] = await Promise.all([
    prisma.entry.findMany({
      where: { status: 'APPROVED', createdAt: { gte: start, lte: endInclusive } },
      select: {
        createdAt: true,
        paymentStatus: true,
        dp: true,
        buyerName: true,
        sales: { select: { name: true } },
        items: {
          select: {
            hargaJual: true, hargaModal: true, resellerCut: true, profit: true,
            livestock: { select: { type: true } },
          },
        },
      },
    }),
    prisma.cashflow.findMany({
      where: { createdAt: { gte: start, lte: endInclusive } },
      select: { type: true, amount: true, name: true, category: true },
    }),
    prisma.delivery.findMany({
      where: { entry: { deliveryDate: { gte: start, lte: end } } },
      select: { status: true, driver: { select: { name: true } }, entry: { select: { pengiriman: true } } },
    }),
    prisma.livestock.findMany({
      select: { type: true, grade: true, condition: true, isSold: true, hargaModal: true, hargaJual: true },
    }),
    prisma.entry.findMany({
      where: { status: 'APPROVED', createdAt: { gte: prevStart, lte: prevEndInclusive } },
      select: { items: { select: { hargaJual: true, profit: true } } },
    }),
    prisma.delivery.findMany({
      where: { entry: { deliveryDate: { gte: prevStart, lte: prevEnd } } },
      select: { status: true },
    }),
  ]);

  // ── Finance ──
  let penjualan = 0, modal = 0, fee = 0, profit = 0, itemCount = 0;
  let diterima = 0, piutang = 0, countLunas = 0, countDp = 0, countBelum = 0;
  let amtLunas = 0, amtDp = 0, amtBelum = 0;
  const perDayMap = new Map<string, { penjualan: number; profit: number }>();
  const perSalesMap = new Map<string, { name: string; count: number; penjualan: number; profit: number }>();
  const byTypeMap = new Map<string, { penjualan: number; profit: number; qty: number }>();
  const buyerMap = new Map<string, { name: string; penjualan: number; count: number }>();

  for (const e of entries) {
    const jual = e.items.reduce((s, i) => s + i.hargaJual, 0);
    const mdl = e.items.reduce((s, i) => s + (i.hargaModal ?? 0), 0);
    const cut = e.items.reduce((s, i) => s + (i.resellerCut ?? 0), 0);
    const prf = e.items.reduce((s, i) => s + (i.profit ?? 0), 0);
    penjualan += jual; modal += mdl; fee += cut; profit += prf;
    itemCount += e.items.length;

    if (e.paymentStatus === 'LUNAS') { countLunas++; diterima += jual; amtLunas += jual; }
    else if (e.paymentStatus === 'DP') { countDp++; diterima += e.dp ?? 0; piutang += jual - (e.dp ?? 0); amtDp += jual; }
    else { countBelum++; piutang += jual; amtBelum += jual; }

    const k = dayKey(e.createdAt);
    const day = perDayMap.get(k) ?? { penjualan: 0, profit: 0 };
    day.penjualan += jual; day.profit += prf;
    perDayMap.set(k, day);

    const sName = e.sales?.name ?? '—';
    const sr = perSalesMap.get(sName) ?? { name: sName, count: 0, penjualan: 0, profit: 0 };
    sr.count++; sr.penjualan += jual; sr.profit += prf;
    perSalesMap.set(sName, sr);

    const bName = e.buyerName || '—';
    const br = buyerMap.get(bName) ?? { name: bName, penjualan: 0, count: 0 };
    br.penjualan += jual; br.count++;
    buyerMap.set(bName, br);

    for (const i of e.items) {
      const t = i.livestock?.type ? titleCase(i.livestock.type) : 'Lainnya';
      const tr = byTypeMap.get(t) ?? { penjualan: 0, profit: 0, qty: 0 };
      tr.penjualan += i.hargaJual;
      tr.profit += i.profit ?? 0;
      tr.qty++;
      byTypeMap.set(t, tr);
    }
  }

  const perDay = Array.from(perDayMap.entries())
    .map(([date, v]) => ({ date, penjualan: v.penjualan, profit: v.profit }))
    .sort((a, b) => a.date.localeCompare(b.date));
  const perSales = Array.from(perSalesMap.values())
    .map((s) => ({ ...s, margin: s.penjualan > 0 ? s.profit / s.penjualan : 0 }))
    .sort((a, b) => b.penjualan - a.penjualan);
  const byType = Array.from(byTypeMap.entries())
    .map(([label, v]) => ({ label, penjualan: v.penjualan, profit: v.profit, qty: v.qty }))
    .sort((a, b) => b.penjualan - a.penjualan);
  const paymentMix = [
    { label: 'Lunas', value: amtLunas, count: countLunas, color: '#16a34a' },
    { label: 'DP', value: amtDp, count: countDp, color: '#2563eb' },
    { label: 'Belum Bayar', value: amtBelum, count: countBelum, color: '#dc2626' },
  ].filter((x) => x.count > 0);
  const topBuyers = Array.from(buyerMap.values()).sort((a, b) => b.penjualan - a.penjualan).slice(0, 5);
  const bestDay = perDay.length ? perDay.reduce((m, d) => (d.penjualan > m.penjualan ? d : m)) : null;

  // cashflow
  let pemasukan = 0, pengeluaran = 0;
  const cfCatMap = new Map<string, { name: string; amount: number; type: 'PEMASUKAN' | 'PENGELUARAN' }>();
  for (const c of cashflows) {
    if (c.type === 'PEMASUKAN') pemasukan += c.amount; else pengeluaran += c.amount;
    const key = `${c.type}|${c.category || c.name || 'Lainnya'}`;
    const rec = cfCatMap.get(key) ?? { name: c.category || c.name || 'Lainnya', amount: 0, type: c.type };
    rec.amount += c.amount;
    cfCatMap.set(key, rec);
  }
  const cfCategories = Array.from(cfCatMap.values()).sort((a, b) => b.amount - a.amount).slice(0, 6);

  // ── Delivery ──
  let terkirim = 0, gagal = 0, proses = 0;
  const perDriverMap = new Map<string, { name: string; total: number; terkirim: number; gagal: number }>();
  const pengirimanMap = new Map<string, number>();
  for (const d of deliveries) {
    if (d.status === 'DELIVERED') terkirim++;
    else if (d.status === 'FAILED') gagal++;
    else proses++;
    const name = d.driver?.name ?? 'Belum di-assign';
    const rec = perDriverMap.get(name) ?? { name, total: 0, terkirim: 0, gagal: 0 };
    rec.total++;
    if (d.status === 'DELIVERED') rec.terkirim++;
    else if (d.status === 'FAILED') rec.gagal++;
    perDriverMap.set(name, rec);
    const pLabel = formatPengiriman(d.entry?.pengiriman ?? null) || 'Lainnya';
    pengirimanMap.set(pLabel, (pengirimanMap.get(pLabel) ?? 0) + 1);
  }
  const byPengiriman = Array.from(pengirimanMap.entries())
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value);
  const perDriver = Array.from(perDriverMap.values())
    .map((d) => ({ ...d, successRate: d.total > 0 ? d.terkirim / d.total : 0 }))
    .sort((a, b) => b.total - a.total);
  const statusBreakdown = [
    { label: 'Terkirim', value: terkirim, color: '#16a34a' },
    { label: 'Proses', value: proses, color: '#2563eb' },
    { label: 'Gagal', value: gagal, color: '#dc2626' },
  ].filter((x) => x.value > 0);
  const successRate = deliveries.length ? terkirim / deliveries.length : 0;

  // ── Stock snapshot ──
  const availableLs = livestock.filter((l) => !l.isSold);
  const byTypeS = new Map<string, number>(), byGradeS = new Map<string, number>(), byCondS = new Map<string, number>();
  let invModal = 0, invJual = 0;
  for (const l of livestock) {
    byCondS.set(l.condition, (byCondS.get(l.condition) ?? 0) + 1);
    if (!l.isSold) {
      byTypeS.set(l.type, (byTypeS.get(l.type) ?? 0) + 1);
      byGradeS.set(l.grade ?? '—', (byGradeS.get(l.grade ?? '—') ?? 0) + 1);
      invModal += l.hargaModal ?? 0;
      invJual += l.hargaJual ?? 0;
    }
  }
  const toArr = (m: Map<string, number>, tc = true) =>
    Array.from(m.entries()).map(([label, value]) => ({ label: tc ? titleCase(label) : label, value })).sort((a, b) => b.value - a.value);

  // ── Comparisons ──
  const prevPenjualan = prevEntries.reduce((s, e) => s + e.items.reduce((a, i) => a + i.hargaJual, 0), 0);
  const prevProfit = prevEntries.reduce((s, e) => s + e.items.reduce((a, i) => a + (i.profit ?? 0), 0), 0);
  const prevTerkirim = prevDeliveries.filter((d) => d.status === 'DELIVERED').length;
  const dPenjualan = delta(penjualan, prevPenjualan);
  const dProfit = delta(profit, prevProfit);
  const dEntry = delta(entries.length, prevEntries.length);
  const dDelivTotal = delta(deliveries.length, prevDeliveries.length);
  const dTerkirim = delta(terkirim, prevTerkirim);

  const margin = penjualan > 0 ? profit / penjualan : 0;
  const collectionRate = penjualan > 0 ? diterima / penjualan : 0;

  // ── Auto insights (narrative) ──
  const insights: string[] = [];
  insights.push(`Penjualan ${formatRupiah(penjualan)} (${pctStr(dPenjualan)} vs periode sebelumnya).`);
  insights.push(`Profit ${formatRupiah(profit)} — margin ${(margin * 100).toFixed(1)}% (${pctStr(dProfit)}).`);
  if (perSales[0]) insights.push(`Sales terbaik: ${perSales[0].name} (${formatRupiah(perSales[0].penjualan)} dari ${perSales[0].count} transaksi).`);
  if (byType[0]) insights.push(`Jenis terlaris: ${byType[0].label} — ${byType[0].qty} ekor, ${formatRupiah(byType[0].penjualan)}.`);
  if (bestDay) insights.push(`Hari tertinggi: ${fmtDay(new Date(bestDay.date + 'T00:00:00Z'))} (${formatRupiah(bestDay.penjualan)}).`);
  if (piutang > 0) insights.push(`Piutang ${formatRupiah(piutang)} dari ${countBelum + countDp} transaksi belum lunas (tertagih ${(collectionRate * 100).toFixed(0)}%).`);
  if (deliveries.length) insights.push(`Pengiriman: ${terkirim}/${deliveries.length} terkirim (${(successRate * 100).toFixed(0)}%${gagal ? `, ${gagal} gagal` : ''}).`);
  insights.push(`Stok tersedia ${availableLs.length} ekor — nilai modal ${formatRupiah(invModal)}.`);

  return {
    range: { start: dayKey(start), end: dayKey(end), label: rangeLabel(start, end), prevLabel: rangeLabel(prevStart, prevEnd), days },
    insights,
    finance: {
      penjualan, modal, fee, profit, margin,
      entryCount: entries.length, itemCount,
      avgPerTxn: entries.length ? Math.round(penjualan / entries.length) : 0,
      avgPerAnimal: itemCount ? Math.round(penjualan / itemCount) : 0,
      diterima, piutang, collectionRate, countLunas, countDp, countBelum,
      bestDay, perDay, perSales, byType, topBuyers, paymentMix,
      cashflow: { pemasukan, pengeluaran, net: pemasukan - pengeluaran, categories: cfCategories },
      deltas: { penjualan: dPenjualan, profit: dProfit, entryCount: dEntry },
    },
    delivery: {
      total: deliveries.length, terkirim, gagal, proses, successRate,
      perDriver, statusBreakdown, byPengiriman,
      deltas: { total: dDelivTotal, terkirim: dTerkirim },
    },
    stock: {
      total: livestock.length, available: availableLs.length, sold: livestock.filter((l) => l.isSold).length,
      soldInPeriod: itemCount, inventoryValueModal: invModal, inventoryValueJual: invJual,
      byType: toArr(byTypeS), byGrade: toArr(byGradeS, false), byCondition: toArr(byCondS),
    },
  };
}
