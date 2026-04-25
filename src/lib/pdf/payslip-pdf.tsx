import path from 'node:path';
import {
  Document,
  Page,
  View,
  Text,
  Image,
  StyleSheet,
} from '@react-pdf/renderer';
import { COMPANY } from './company';

const logoSrc = path.join(process.cwd(), 'public', 'logo.png');

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SummaryItem {
  sku: string;
  jumlah: number;
  totalHarga: number;
  resellerCut: number;
  others?: number;
}

export interface RecapItem {
  tag?: string;
  salesName: string;
  hewan: string;
  type: string;
  hargaJual: number;
  cut: number;
  pembeli: string;
  alamat?: string;
}

export interface PayslipData {
  salesName: string;
  date: string;
  summaryItems: SummaryItem[];
  animalCounts: Record<string, number>;
  recapItems: RecapItem[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const formatRp = (n: number) => 'Rp' + n.toLocaleString('en-US');
const sumCol = (items: SummaryItem[], k: keyof SummaryItem) =>
  items.reduce((a, i) => a + ((i[k] as number) ?? 0), 0);

// ─── Summary table column widths ──────────────────────────────────────────────

const SC = {
  c0: '25%', // Jenis Hewan Ternak
  c1: '9%',  // Jumlah
  c2: '21%', // Total Harga
  c3: '17%', // Reseller Cut
  c4: '13%', // Others
  c5: '15%', // Total
};

// ─── Recap table column widths ────────────────────────────────────────────────
// Type is now short (weight range "310-320" or grade "D"), so keep it narrow.

const RC = {
  c0: '8%',  // Tag
  c1: '12%', // Sales
  c2: '8%',  // Hewan
  c3: '10%', // Type  ("310-320" / "D")
  c4: '15%', // Harga Jual
  c5: '13%', // Cut
  c6: '14%', // Pembeli
  c7: '20%', // Alamat
};

// ─── Styles ───────────────────────────────────────────────────────────────────

const S = StyleSheet.create({
  page: {
    paddingTop: 28,
    paddingBottom: 36,
    paddingHorizontal: 40,
    fontFamily: 'Helvetica',
    fontSize: 9,
    color: '#111111',
    backgroundColor: '#fff',
  },

  // Invoice-style header
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    borderBottomWidth: 1.5,
    borderBottomColor: '#000000',
    paddingBottom: 10,
  },
  titleBlock: { flexDirection: 'row', alignItems: 'center' },
  logoImg: { width: 52, height: 52, marginRight: 10 },
  pageTitle: { fontSize: 22, fontFamily: 'Helvetica-Bold' },
  companyBlock: { flexDirection: 'column', alignItems: 'flex-end' },
  coName: { fontSize: 11, fontFamily: 'Helvetica-Bold' },
  coTag: { fontSize: 8, marginTop: 1 },
  coAddr: { fontSize: 7.5, color: '#444', marginTop: 1, maxWidth: 280, textAlign: 'right' },

  // Sales name section
  salesNameLabel: {
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
    marginTop: 18,
    marginBottom: 4,
  },
  salesNameValue: {
    fontSize: 20,
    fontFamily: 'Helvetica-Bold',
    marginLeft: 22,
    marginBottom: 20,
  },

  sectionLabel: {
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
    marginBottom: 2,
    marginLeft: 2,
  },

  table: { width: '100%', marginBottom: 10 },

  darkRow: {
    flexDirection: 'row',
    backgroundColor: '#3d3d3d',
    paddingVertical: 5,
    paddingHorizontal: 6,
  },
  darkTh: { fontSize: 9, fontFamily: 'Helvetica-Bold', color: '#ffffff' },

  // White subheader for DATA RECAP column labels
  subheadRow: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    paddingVertical: 4,
    paddingHorizontal: 6,
    borderBottomWidth: 0.5,
    borderBottomColor: '#cccccc',
  },
  subheadTh: { fontSize: 8, fontFamily: 'Helvetica-Bold', color: '#111111', flexShrink: 0, flexGrow: 0 },

  dataRow: {
    flexDirection: 'row',
    paddingVertical: 4,
    paddingHorizontal: 6,
    alignItems: 'flex-start',
  },
  // Summary table cells
  td: { fontSize: 9, color: '#111111' },
  tdBold: { fontSize: 9, fontFamily: 'Helvetica-Bold', color: '#111111' },
  // Recap table cells — smaller font, locked width so nothing bleeds
  tdR: { fontSize: 7.5, color: '#111111', flexShrink: 0, flexGrow: 0 },
  tdRBold: { fontSize: 7.5, fontFamily: 'Helvetica-Bold', color: '#111111', flexShrink: 0, flexGrow: 0 },

  // Cell wrapper with right-border separator
  rcell: {
    flexShrink: 0,
    flexGrow: 0,
    paddingRight: 4,
    borderRightWidth: 0.5,
    borderRightColor: '#dddddd',
    marginRight: 4,
  },
  rcellLast: {
    flexShrink: 0,
    flexGrow: 0,
  },

  totalRow: {
    flexDirection: 'row',
    backgroundColor: '#d0d0d0',
    paddingVertical: 5,
    paddingHorizontal: 6,
  },

  animalBlock: { alignItems: 'center', marginBottom: 16 },
  animalLine: { fontSize: 9, fontFamily: 'Helvetica-Bold', marginBottom: 2 },

  footer: { position: 'absolute', bottom: 16, left: 40, right: 40 },
  footerDate: { fontSize: 8, color: '#888' },
});

// ─── Summary Table ────────────────────────────────────────────────────────────

function SummaryTable({ items }: { items: SummaryItem[] }) {
  const tot = {
    jumlah: sumCol(items, 'jumlah'),
    totalHarga: sumCol(items, 'totalHarga'),
    resellerCut: sumCol(items, 'resellerCut'),
    others: sumCol(items, 'others'),
  };

  return (
    <View style={S.table}>
      <View style={S.darkRow}>
        <Text style={[S.darkTh, { width: SC.c0 }]}>Jenis Hewan Ternak</Text>
        <Text style={[S.darkTh, { width: SC.c1, textAlign: 'center' }]}>Jumlah</Text>
        <Text style={[S.darkTh, { width: SC.c2, textAlign: 'right' }]}>Total Harga</Text>
        <Text style={[S.darkTh, { width: SC.c3, textAlign: 'right' }]}>Reseller Cut</Text>
        <Text style={[S.darkTh, { width: SC.c4, textAlign: 'center' }]}>Others</Text>
        <Text style={[S.darkTh, { width: SC.c5, textAlign: 'right' }]}>Total</Text>
      </View>

      {items.map((item, idx) => (
        <View
          key={idx}
          style={[S.dataRow, { backgroundColor: idx % 2 === 0 ? '#ffffff' : '#f2f2f2' }]}
        >
          <Text style={[S.td, { width: SC.c0, textAlign: 'center' }]}>{item.sku}</Text>
          <Text style={[S.tdBold, { width: SC.c1, textAlign: 'center' }]}>{item.jumlah}</Text>
          <Text style={[S.td, { width: SC.c2, textAlign: 'right' }]}>{formatRp(item.totalHarga)}</Text>
          <Text style={[S.td, { width: SC.c3, textAlign: 'right' }]}>{formatRp(item.resellerCut)}</Text>
          <Text style={[S.td, { width: SC.c4, textAlign: 'center' }]}>
            {item.others ? formatRp(item.others) : ''}
          </Text>
          <Text style={[S.tdBold, { width: SC.c5, textAlign: 'right' }]}>
            {formatRp(item.resellerCut + (item.others ?? 0))}
          </Text>
        </View>
      ))}

      <View style={S.totalRow}>
        <Text style={[S.tdBold, { width: SC.c0 }]}>Total Amount :</Text>
        <Text style={[S.tdBold, { width: SC.c1, textAlign: 'center' }]}>{tot.jumlah}</Text>
        <Text style={[S.tdBold, { width: SC.c2, textAlign: 'right' }]}>{formatRp(tot.totalHarga)}</Text>
        <Text style={[S.tdBold, { width: SC.c3, textAlign: 'right' }]}>{formatRp(tot.resellerCut)}</Text>
        <Text style={[S.tdBold, { width: SC.c4, textAlign: 'center' }]}>{formatRp(tot.others)}</Text>
        <Text style={[S.tdBold, { width: SC.c5, textAlign: 'right' }]}>
          {formatRp(tot.resellerCut + tot.others)}
        </Text>
      </View>
    </View>
  );
}

// ─── Recap Table ──────────────────────────────────────────────────────────────

function RecapTable({ items }: { items: RecapItem[] }) {
  return (
    <View style={S.table}>
      <View style={[S.darkRow, { justifyContent: 'center' }]}>
        <Text style={[S.darkTh, { fontSize: 11, fontFamily: 'Helvetica-BoldOblique' }]}>
          DATA RECAP
        </Text>
      </View>

      <View style={S.subheadRow}>
        <View style={[S.rcell, { width: RC.c0 }]}><Text style={S.subheadTh}>Tag</Text></View>
        <View style={[S.rcell, { width: RC.c1 }]}><Text style={S.subheadTh}>Sales</Text></View>
        <View style={[S.rcell, { width: RC.c2 }]}><Text style={S.subheadTh}>Hewan</Text></View>
        <View style={[S.rcell, { width: RC.c3 }]}><Text style={S.subheadTh}>Type</Text></View>
        <View style={[S.rcell, { width: RC.c4 }]}><Text style={[S.subheadTh, { textAlign: 'right' }]}>Harga Jual</Text></View>
        <View style={[S.rcell, { width: RC.c5 }]}><Text style={[S.subheadTh, { textAlign: 'right' }]}>Cut</Text></View>
        <View style={[S.rcell, { width: RC.c6 }]}><Text style={S.subheadTh}>Pembeli</Text></View>
        <View style={[S.rcellLast, { width: RC.c7 }]}><Text style={S.subheadTh}>Alamat</Text></View>
      </View>

      {items.map((item, idx) => (
        <View
          key={idx}
          style={[S.dataRow, { backgroundColor: idx % 2 === 0 ? '#ffffff' : '#f2f2f2' }]}
        >
          <View style={[S.rcell, { width: RC.c0 }]}><Text style={S.tdR}>{item.tag ?? ''}</Text></View>
          <View style={[S.rcell, { width: RC.c1 }]}><Text style={S.tdR}>{item.salesName}</Text></View>
          <View style={[S.rcell, { width: RC.c2 }]}><Text style={S.tdR}>{item.hewan}</Text></View>
          <View style={[S.rcell, { width: RC.c3 }]}><Text style={S.tdR}>{item.type}</Text></View>
          <View style={[S.rcell, { width: RC.c4 }]}><Text style={[S.tdR, { textAlign: 'right' }]}>{formatRp(item.hargaJual)}</Text></View>
          <View style={[S.rcell, { width: RC.c5 }]}><Text style={[S.tdR, { textAlign: 'right' }]}>{formatRp(item.cut)}</Text></View>
          <View style={[S.rcell, { width: RC.c6 }]}><Text style={S.tdR}>{item.pembeli}</Text></View>
          <View style={[S.rcellLast, { width: RC.c7 }]}><Text style={S.tdR}>{item.alamat ?? ''}</Text></View>
        </View>
      ))}
    </View>
  );
}

// ─── Main Document ────────────────────────────────────────────────────────────

export function PayslipDocument({ data }: { data: PayslipData }) {
  return (
    <Document>
      <Page size="A4" style={S.page}>
        {/* INVOICE-STYLE HEADER */}
        <View style={S.headerRow}>
          <View style={S.titleBlock}>
            <Image src={logoSrc} style={S.logoImg} />
            <Text style={S.pageTitle}>Pay Slip</Text>
          </View>
          <View style={S.companyBlock}>
            <Text style={S.coName}>{COMPANY.name}</Text>
            <Text style={S.coTag}>{COMPANY.tagline}</Text>
            <Text style={S.coAddr}>{COMPANY.address}</Text>
          </View>
        </View>

        {/* SALES NAME */}
        <Text style={S.salesNameLabel}>SALES NAME :</Text>
        <Text style={S.salesNameValue}>{data.salesName}</Text>

        {/* ITEMS */}
        <Text style={S.sectionLabel}>Items:</Text>
        <SummaryTable items={data.summaryItems} />

        {/* ANIMAL COUNTS */}
        <View style={S.animalBlock}>
          {Object.entries(data.animalCounts).map(([type, count]) => (
            <Text key={type} style={S.animalLine}>
              {type} : {count}
            </Text>
          ))}
        </View>

        {/* DATA RECAP */}
        <RecapTable items={data.recapItems} />

        {/* FOOTER DATE */}
        <View style={S.footer} fixed>
          <Text style={S.footerDate}>{data.date}</Text>
        </View>
      </Page>
    </Document>
  );
}

// ─── Sample data ──────────────────────────────────────────────────────────────

export const sampleData: PayslipData = {
  salesName: 'Kunyuk',
  date: '4/24/2026',
  summaryItems: [
    { sku: '310', jumlah: 1, totalHarga: 19_500_000, resellerCut: 500_000 },
    { sku: '375', jumlah: 1, totalHarga: 24_000_000, resellerCut: 500_000 },
    { sku: 'D',   jumlah: 1, totalHarga: 2_350_000,  resellerCut: 100_000 },
  ],
  animalCounts: { KAMBING: 1, SAPI: 2 },
  recapItems: [
    {
      salesName: 'Kunyuk',
      hewan: 'SAPI',
      type: '310',
      hargaJual: 19_500_000,
      cut: 500_000,
      pembeli: 'Yeni Yuningsih',
      alamat: 'Jl.Binuang RT.02 RW.11 Desa/Kec. Kersamanah Kab. Garut',
    },
    {
      salesName: 'Kunyuk',
      hewan: 'SAPI',
      type: '375',
      hargaJual: 24_000_000,
      cut: 500_000,
      pembeli: 'Yeni Yuningsih',
      alamat: 'Jl.Binuang RT.02 RW.11 Desa/Kec. Kersamanah Kab. Garut',
    },
    {
      tag: '165',
      salesName: 'Kunyuk',
      hewan: 'KAMBING',
      type: 'D',
      hargaJual: 2_350_000,
      cut: 100_000,
      pembeli: 'Latifah',
      alamat: 'Jln. Nangka III Kp. Baru Selatan RT.002/RW.002 no. 28, Pakulonan, Serpong Utara, Tangerang Selatan',
    },
  ],
};
