import path from 'node:path';
import {
  Document,
  Page,
  View,
  Text,
  Image,
  StyleSheet,
} from '@react-pdf/renderer';
import { COMPANY, type CompanyInfo } from './company';

const logoSrc = path.join(process.cwd(), 'public', 'logo.png');
const signatureSrc = path.join(process.cwd(), 'public', 'signature.png');

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
  salesRek?: string | null;
  date: string;
  summaryItems: SummaryItem[];
  animalCounts: Record<string, number>;
  recapItems: RecapItem[];
}

// ─── Palette ──────────────────────────────────────────────────────────────────
// Deep-green "ledger" aesthetic — cohesive with the MF brand, neutral enough
// for the white-label tenants that swap the logo/company block.

const C = {
  ink: '#17211B', // near-black green — text + dark bars
  body: '#2A2F2B',
  muted: '#6E7670',
  faint: '#9AA39C',
  line: '#E3E7E3',
  rowAlt: '#F6F8F6',
  accent: '#2E5D43', // deep green
  accentSoft: '#E9F1EC',
  onAccent: '#FFFFFF',
  onAccentSoft: '#C3D8CA',
  white: '#FFFFFF',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const formatRp = (n: number) => 'Rp' + n.toLocaleString('en-US');
const sumCol = (items: SummaryItem[], k: keyof SummaryItem) =>
  items.reduce((a, i) => a + ((i[k] as number) ?? 0), 0);

// ─── Summary table column widths ──────────────────────────────────────────────

const SC = {
  c0: '25%', // Jenis Hewan Ternak
  c1: '9%', // Jumlah
  c2: '21%', // Total Harga
  c3: '17%', // Reseller Cut
  c4: '13%', // Others
  c5: '15%', // Komisi (Total)
};

// ─── Recap table column widths ────────────────────────────────────────────────

const RC = {
  c0: '12%', // Tag
  c1: '11%', // Sales
  c2: '8%', // Hewan
  c3: '8%', // Type
  c4: '15%', // Harga Jual
  c5: '10%', // Cut
  c6: '14%', // Pembeli
  c7: '22%', // Alamat
};

// ─── Styles ───────────────────────────────────────────────────────────────────

const S = StyleSheet.create({
  page: {
    paddingTop: 30,
    paddingBottom: 40,
    paddingHorizontal: 40,
    fontFamily: 'Helvetica',
    fontSize: 9,
    color: C.body,
    backgroundColor: C.white,
  },

  // ── Header ──
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  titleBlock: { flexDirection: 'row', alignItems: 'center' },
  logoImg: { width: 50, height: 50, marginRight: 12 },
  pageTitle: { fontSize: 22, fontFamily: 'Helvetica-Bold', color: C.ink, lineHeight: 1 },
  titleSub: { fontSize: 7.5, color: C.muted, letterSpacing: 1.6, marginTop: 4 },
  companyBlock: { flexDirection: 'column', alignItems: 'flex-end' },
  coName: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: C.ink },
  coTag: { fontSize: 8, color: C.muted, marginTop: 1 },
  coAddr: { fontSize: 7.5, color: C.faint, marginTop: 2, maxWidth: 270, textAlign: 'right' },

  rule: { height: 2, backgroundColor: C.accent, marginTop: 10, borderRadius: 2 },

  // ── Payee + payout band ──
  band: { flexDirection: 'row', gap: 12, marginTop: 18 },
  payeeCard: {
    flexGrow: 1,
    flexBasis: 0,
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 8,
    padding: 14,
    backgroundColor: C.white,
  },
  miniLabel: { fontSize: 7.5, fontFamily: 'Helvetica-Bold', color: C.muted, letterSpacing: 1.2 },
  payeeName: { fontSize: 17, fontFamily: 'Helvetica-Bold', color: C.ink, marginTop: 5 },
  rekLabel: { fontSize: 7, color: C.muted, letterSpacing: 1, marginTop: 11 },
  rekValue: { fontSize: 13, fontFamily: 'Courier-Bold', color: C.ink, marginTop: 2 },

  payoutCard: {
    width: 200,
    backgroundColor: C.accent,
    borderRadius: 8,
    padding: 14,
    justifyContent: 'center',
  },
  payoutLabel: { fontSize: 7.5, fontFamily: 'Helvetica-Bold', color: C.onAccentSoft, letterSpacing: 1.2 },
  payoutAmount: { fontSize: 20, fontFamily: 'Helvetica-Bold', color: C.onAccent, marginTop: 7 },
  payoutSub: { fontSize: 8, color: C.onAccentSoft, marginTop: 7 },

  // ── Section heading ──
  sectionHead: { flexDirection: 'row', alignItems: 'center', marginTop: 20, marginBottom: 7 },
  sectionTick: { width: 3, height: 11, backgroundColor: C.accent, borderRadius: 2, marginRight: 7 },
  sectionText: { fontSize: 10, fontFamily: 'Helvetica-Bold', color: C.ink, letterSpacing: 0.4 },

  // ── Tables ──
  tableWrap: {
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 8,
    overflow: 'hidden',
  },
  darkRow: { flexDirection: 'row', backgroundColor: C.ink, paddingVertical: 6, paddingHorizontal: 9 },
  darkTh: { fontSize: 8.5, fontFamily: 'Helvetica-Bold', color: C.white },

  subheadRow: {
    flexDirection: 'row',
    backgroundColor: C.white,
    paddingVertical: 5,
    paddingHorizontal: 9,
    borderBottomWidth: 0.75,
    borderBottomColor: C.line,
  },
  subheadTh: { fontSize: 8, fontFamily: 'Helvetica-Bold', color: C.ink, flexShrink: 0, flexGrow: 0 },

  dataRow: { flexDirection: 'row', paddingVertical: 5, paddingHorizontal: 9, alignItems: 'flex-start' },
  td: { fontSize: 9, color: C.body },
  tdBold: { fontSize: 9, fontFamily: 'Helvetica-Bold', color: C.ink },
  tdR: { fontSize: 7.5, color: C.body },

  rcell: {
    flexShrink: 0,
    flexGrow: 0,
    paddingRight: 5,
    borderRightWidth: 0.5,
    borderRightColor: C.line,
    marginRight: 5,
  },
  rcellLast: { flexShrink: 0, flexGrow: 0 },

  totalRow: { flexDirection: 'row', backgroundColor: C.accentSoft, paddingVertical: 7, paddingHorizontal: 9 },
  totalLabel: { fontSize: 9, fontFamily: 'Helvetica-Bold', color: C.ink },
  totalAccent: { fontSize: 9, fontFamily: 'Helvetica-Bold', color: C.accent },

  // ── Animal chips ──
  chipsRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', marginTop: 9 },
  chipsLabel: { fontSize: 8, color: C.muted, marginRight: 8, letterSpacing: 0.4 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 11,
    paddingVertical: 2,
    paddingHorizontal: 9,
    marginRight: 7,
    marginBottom: 4,
    backgroundColor: C.white,
  },
  chipType: { fontSize: 8, fontFamily: 'Helvetica-Bold', color: C.ink },
  chipCount: { fontSize: 8, fontFamily: 'Helvetica-Bold', color: C.accent, marginLeft: 5 },

  recapTitleRow: {
    flexDirection: 'row',
    backgroundColor: C.ink,
    paddingVertical: 6,
    paddingHorizontal: 9,
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  recapTitle: { fontSize: 10, fontFamily: 'Helvetica-BoldOblique', color: C.white, letterSpacing: 1 },
  recapCount: { fontSize: 8, color: C.onAccentSoft },

  // ── Signature ──
  signRow: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 24 },
  signBlock: { alignItems: 'center', width: 200 },
  signCity: { fontSize: 8.5, color: C.body },
  signGreeting: { fontSize: 8.5, color: C.body, marginTop: 2 },
  signature: { width: 92, height: 56, marginTop: 4, marginBottom: -4 },
  signerName: { fontSize: 9.5, fontFamily: 'Helvetica-Bold', color: C.ink },
  signerRule: { width: 150, borderBottomWidth: 0.75, borderBottomColor: C.line, marginTop: 2, paddingTop: 2 },

  footer: {
    position: 'absolute',
    bottom: 18,
    left: 40,
    right: 40,
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 0.5,
    borderTopColor: C.line,
    paddingTop: 5,
  },
  footerText: { fontSize: 7.5, color: C.faint },
});

// ─── Section heading ──────────────────────────────────────────────────────────

function SectionHead({ children }: { children: string }) {
  return (
    <View style={S.sectionHead}>
      <View style={S.sectionTick} />
      <Text style={S.sectionText}>{children}</Text>
    </View>
  );
}

// ─── Summary Table ────────────────────────────────────────────────────────────

function SummaryTable({ items }: { items: SummaryItem[] }) {
  const tot = {
    jumlah: sumCol(items, 'jumlah'),
    totalHarga: sumCol(items, 'totalHarga'),
    resellerCut: sumCol(items, 'resellerCut'),
    others: sumCol(items, 'others'),
  };

  return (
    <View style={S.tableWrap}>
      <View style={S.darkRow}>
        <Text style={[S.darkTh, { width: SC.c0 }]}>Jenis Hewan Ternak</Text>
        <Text style={[S.darkTh, { width: SC.c1, textAlign: 'center' }]}>Jumlah</Text>
        <Text style={[S.darkTh, { width: SC.c2, textAlign: 'right' }]}>Total Harga</Text>
        <Text style={[S.darkTh, { width: SC.c3, textAlign: 'right' }]}>Reseller Cut</Text>
        <Text style={[S.darkTh, { width: SC.c4, textAlign: 'center' }]}>Others</Text>
        <Text style={[S.darkTh, { width: SC.c5, textAlign: 'right' }]}>Komisi</Text>
      </View>

      {items.map((item, idx) => (
        <View
          key={idx}
          style={[
            S.dataRow,
            { backgroundColor: idx % 2 === 0 ? C.white : C.rowAlt, borderBottomWidth: 0.5, borderBottomColor: C.line },
          ]}
        >
          <Text style={[S.td, { width: SC.c0, textAlign: 'center' }]}>{item.sku}</Text>
          <Text style={[S.tdBold, { width: SC.c1, textAlign: 'center' }]}>{item.jumlah}</Text>
          <Text style={[S.td, { width: SC.c2, textAlign: 'right' }]}>{formatRp(item.totalHarga)}</Text>
          <Text style={[S.td, { width: SC.c3, textAlign: 'right' }]}>{formatRp(item.resellerCut)}</Text>
          <Text style={[S.td, { width: SC.c4, textAlign: 'center' }]}>{item.others ? formatRp(item.others) : '—'}</Text>
          <Text style={[S.tdBold, { width: SC.c5, textAlign: 'right' }]}>
            {formatRp(item.resellerCut + (item.others ?? 0))}
          </Text>
        </View>
      ))}

      <View style={S.totalRow}>
        <Text style={[S.totalLabel, { width: SC.c0 }]}>Total</Text>
        <Text style={[S.totalLabel, { width: SC.c1, textAlign: 'center' }]}>{tot.jumlah}</Text>
        <Text style={[S.totalLabel, { width: SC.c2, textAlign: 'right' }]}>{formatRp(tot.totalHarga)}</Text>
        <Text style={[S.totalLabel, { width: SC.c3, textAlign: 'right' }]}>{formatRp(tot.resellerCut)}</Text>
        <Text style={[S.totalLabel, { width: SC.c4, textAlign: 'center' }]}>{formatRp(tot.others)}</Text>
        <Text style={[S.totalAccent, { width: SC.c5, textAlign: 'right' }]}>
          {formatRp(tot.resellerCut + tot.others)}
        </Text>
      </View>
    </View>
  );
}

// ─── Recap Table ──────────────────────────────────────────────────────────────

function RecapTable({ items }: { items: RecapItem[] }) {
  return (
    <View style={S.tableWrap}>
      <View style={S.recapTitleRow}>
        <Text style={S.recapTitle}>DATA RECAP</Text>
        <Text style={S.recapCount}>{items.length} transaksi</Text>
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
          style={[S.dataRow, { backgroundColor: idx % 2 === 0 ? C.white : C.rowAlt }]}
        >
          <View style={[S.rcell, { width: RC.c0 }]}><Text style={S.tdR}>{(item.tag ?? '').replace(/-/g, '-​')}</Text></View>
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

export function PayslipDocument({ data, company = COMPANY }: { data: PayslipData; company?: CompanyInfo }) {
  const grandKomisi = data.summaryItems.reduce((a, i) => a + i.resellerCut + (i.others ?? 0), 0);
  const totalEkor = data.summaryItems.reduce((a, i) => a + i.jumlah, 0);

  return (
    <Document>
      <Page size="A4" style={S.page}>
        {/* HEADER */}
        <View style={S.headerRow}>
          <View style={S.titleBlock}>
            <Image src={company.logoUrl || logoSrc} style={S.logoImg} />
            <View>
              <Text style={S.pageTitle}>Pay Slip</Text>
              <Text style={S.titleSub}>SLIP KOMISI SALES</Text>
            </View>
          </View>
          <View style={S.companyBlock}>
            <Text style={S.coName}>{company.name}</Text>
            <Text style={S.coTag}>{company.tagline}</Text>
            <Text style={S.coAddr}>{company.address}</Text>
          </View>
        </View>
        <View style={S.rule} />

        {/* PAYEE + PAYOUT BAND */}
        <View style={S.band}>
          <View style={S.payeeCard}>
            <Text style={S.miniLabel}>DIBAYARKAN KEPADA</Text>
            <Text style={S.payeeName}>{data.salesName}</Text>
            <Text style={S.rekLabel}>NO. REKENING</Text>
            <Text style={S.rekValue}>{data.salesRek || '—'}</Text>
          </View>
          <View style={S.payoutCard}>
            <Text style={S.payoutLabel}>TOTAL KOMISI DIBAYARKAN</Text>
            <Text style={S.payoutAmount}>{formatRp(grandKomisi)}</Text>
            <Text style={S.payoutSub}>
              {totalEkor} ekor · {data.summaryItems.length} jenis
            </Text>
          </View>
        </View>

        {/* RINCIAN */}
        <SectionHead>RINCIAN PENJUALAN</SectionHead>
        <SummaryTable items={data.summaryItems} />

        <View style={S.chipsRow}>
          <Text style={S.chipsLabel}>TOTAL HEWAN</Text>
          {Object.entries(data.animalCounts).map(([type, count]) => (
            <View key={type} style={S.chip}>
              <Text style={S.chipType}>{type}</Text>
              <Text style={S.chipCount}>{count}</Text>
            </View>
          ))}
        </View>

        {/* DATA RECAP */}
        <SectionHead>DATA RECAP</SectionHead>
        <RecapTable items={data.recapItems} />

        {/* SIGNATURE */}
        <View style={S.signRow}>
          <View style={S.signBlock}>
            <Text style={S.signCity}>
              {company.city}, {data.date}
            </Text>
            <Text style={S.signGreeting}>Hormat Kami,</Text>
            <Image src={company.signatureUrl || signatureSrc} style={S.signature} />
            <View style={S.signerRule} />
            <Text style={S.signerName}>{company.signer}</Text>
          </View>
        </View>

        {/* FOOTER */}
        <View style={S.footer} fixed>
          <Text style={S.footerText}>{company.name}</Text>
          <Text style={S.footerText}>Dicetak {data.date}</Text>
        </View>
      </Page>
    </Document>
  );
}

// ─── Sample data ──────────────────────────────────────────────────────────────

export const sampleData: PayslipData = {
  salesName: 'Kunyuk',
  salesRek: 'BCA 4731568043',
  date: '4/24/2026',
  summaryItems: [
    { sku: '310', jumlah: 1, totalHarga: 19_500_000, resellerCut: 500_000 },
    { sku: '375', jumlah: 1, totalHarga: 24_000_000, resellerCut: 500_000 },
    { sku: 'D', jumlah: 1, totalHarga: 2_350_000, resellerCut: 100_000 },
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
