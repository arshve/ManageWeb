import path from 'node:path';
import {
  Document, Page, View, Text, Image, StyleSheet,
} from '@react-pdf/renderer';
import { COMPANY } from './company';
import { InvoicePageContent, type InvoiceData, invoicePageStyle } from './invoice-pdf';

const logoSrc = path.join(process.cwd(), 'public', 'logo.png');

export type BatchInvoiceEntry = InvoiceData & {
  paymentStatus: 'BELUM_BAYAR' | 'DP';
  totalHargaJual: number;
  outstanding: number;
};

const sum = StyleSheet.create({
  page: { padding: 40, fontSize: 10, fontFamily: 'Helvetica' },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', borderBottomWidth: 1.5, borderBottomColor: '#2f7d32', paddingBottom: 8 },
  titleBlock: { flexDirection: 'row', alignItems: 'center' },
  logo: { width: 48, height: 48, marginRight: 10 },
  title: { fontSize: 22, fontWeight: 'bold', letterSpacing: 1 },
  companyBlock: { flexDirection: 'column', alignItems: 'flex-end' },
  companyName: { fontSize: 11, fontWeight: 'bold' },
  companyTagline: { fontSize: 8, marginTop: 1 },
  companyAddress: { fontSize: 8, marginTop: 1, maxWidth: 260, textAlign: 'right' },

  salesBlock: { marginTop: 18 },
  salesLabel: { fontSize: 9, fontWeight: 'bold' },
  salesName: { fontSize: 14, fontWeight: 'bold', marginTop: 2 },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4, fontSize: 9, color: '#555' },

  totalsRow: { flexDirection: 'row', gap: 8, marginTop: 14 },
  totalCell: { flex: 1, borderWidth: 1, borderColor: '#ddd', borderRadius: 4, padding: 8 },
  totalLabel: { fontSize: 8, color: '#666' },
  totalValue: { fontSize: 13, fontWeight: 'bold', marginTop: 3 },

  sectionLabel: { fontSize: 10, fontWeight: 'bold', marginTop: 18, marginBottom: 6 },
  tableHeader: { flexDirection: 'row', backgroundColor: '#f2f2f2', borderBottomWidth: 0.5, borderBottomColor: '#333', borderTopWidth: 0.5, borderTopColor: '#333' },
  tableRow: { flexDirection: 'row', borderBottomWidth: 0.5, borderBottomColor: '#cccccc' },
  th: { padding: 5, fontSize: 8.5, fontWeight: 'bold' },
  td: { padding: 5, fontSize: 8.5 },
  colNo: { width: '6%' },
  colInv: { width: '20%' },
  colBuyer: { width: '30%' },
  colStatus: { width: '12%' },
  colTotal: { width: '16%', textAlign: 'right' },
  colSisa: { width: '16%', textAlign: 'right', fontWeight: 'bold' },

  totalRow: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 10, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#333' },
  totalRowLabel: { fontSize: 10, fontWeight: 'bold', marginRight: 16 },
  totalRowValue: { fontSize: 12, fontWeight: 'bold' },

  footer: { marginTop: 26, fontSize: 8.5, color: '#555', lineHeight: 1.5 },
});

function formatRupiah(n: number): string {
  return 'Rp' + n.toLocaleString('id-ID');
}
function formatDateID(date: Date): string {
  const M = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
  return `${date.getDate()} ${M[date.getMonth()]} ${date.getFullYear()}`;
}

/**
 * Cover sheet — at-a-glance list of every outstanding invoice for one sales
 * person, with running totals so the admin can hand off the whole stack with
 * one summary on top.
 */
function CoverSheet({ salesName, entries }: { salesName: string; entries: BatchInvoiceEntry[] }) {
  const totalBill = entries.reduce((s, e) => s + e.totalHargaJual, 0);
  const totalPaid = entries.reduce((s, e) => s + (e.dp ?? 0), 0);
  const totalOutstanding = entries.reduce((s, e) => s + e.outstanding, 0);
  const countBelum = entries.filter((e) => e.paymentStatus === 'BELUM_BAYAR').length;
  const countDp = entries.filter((e) => e.paymentStatus === 'DP').length;

  return (
    <Page size="A4" style={sum.page}>
      <View style={sum.headerRow}>
        <View style={sum.titleBlock}>
          {/* eslint-disable-next-line jsx-a11y/alt-text */}
          <Image src={logoSrc} style={sum.logo} />
          <Text style={sum.title}>BATCH INVOICE</Text>
        </View>
        <View style={sum.companyBlock}>
          <Text style={sum.companyName}>{COMPANY.name}</Text>
          <Text style={sum.companyTagline}>{COMPANY.tagline}</Text>
          <Text style={sum.companyAddress}>{COMPANY.address}</Text>
        </View>
      </View>

      <View style={sum.salesBlock}>
        <Text style={sum.salesLabel}>Sales</Text>
        <Text style={sum.salesName}>{salesName}</Text>
        <View style={sum.metaRow}>
          <Text>Tagihan terbuka: {entries.length} transaksi ({countBelum} belum bayar, {countDp} DP)</Text>
          <Text>{formatDateID(new Date())}</Text>
        </View>
      </View>

      <View style={sum.totalsRow}>
        <View style={sum.totalCell}>
          <Text style={sum.totalLabel}>Total Tagihan</Text>
          <Text style={sum.totalValue}>{formatRupiah(totalBill)}</Text>
        </View>
        <View style={sum.totalCell}>
          <Text style={sum.totalLabel}>Sudah Dibayar (DP)</Text>
          <Text style={sum.totalValue}>{formatRupiah(totalPaid)}</Text>
        </View>
        <View style={sum.totalCell}>
          <Text style={[sum.totalLabel, { color: '#a33' }]}>Sisa Tagihan</Text>
          <Text style={[sum.totalValue, { color: '#a33' }]}>{formatRupiah(totalOutstanding)}</Text>
        </View>
      </View>

      <Text style={sum.sectionLabel}>Daftar Invoice</Text>
      <View style={sum.tableHeader}>
        <Text style={[sum.th, sum.colNo]}>No.</Text>
        <Text style={[sum.th, sum.colInv]}>Invoice</Text>
        <Text style={[sum.th, sum.colBuyer]}>Pembeli</Text>
        <Text style={[sum.th, sum.colStatus]}>Status</Text>
        <Text style={[sum.th, sum.colTotal]}>Total</Text>
        <Text style={[sum.th, sum.colSisa]}>Sisa</Text>
      </View>
      {entries.map((e, i) => (
        <View key={e.invoiceNo} style={sum.tableRow}>
          <Text style={[sum.td, sum.colNo]}>{i + 1}</Text>
          <Text style={[sum.td, sum.colInv]}>{e.invoiceNo}</Text>
          <Text style={[sum.td, sum.colBuyer]}>{e.buyerName}</Text>
          <Text style={[sum.td, sum.colStatus]}>{e.paymentStatus === 'DP' ? 'DP' : 'Belum Bayar'}</Text>
          <Text style={[sum.td, sum.colTotal]}>{formatRupiah(e.totalHargaJual)}</Text>
          <Text style={[sum.td, sum.colSisa]}>{formatRupiah(e.outstanding)}</Text>
        </View>
      ))}

      <View style={sum.totalRow}>
        <Text style={sum.totalRowLabel}>Total Sisa Tagihan</Text>
        <Text style={sum.totalRowValue}>{formatRupiah(totalOutstanding)}</Text>
      </View>

      <Text style={sum.footer}>
        Halaman berikut berisi satu lembar invoice per transaksi di atas.{'\n'}
        Pembayaran dapat dilakukan ke {COMPANY.bank.name} a.n. {COMPANY.bank.accountName} — {COMPANY.bank.accountNo}.
      </Text>
    </Page>
  );
}

/**
 * BatchInvoiceDocument — one cover sheet (running totals + invoice list) +
 * one A4 page per outstanding invoice (BELUM_BAYAR or DP). Designed to be
 * printed and handed to a sales person to chase their open piutang in bulk.
 */
export function BatchInvoiceDocument({ salesName, entries }: { salesName: string; entries: BatchInvoiceEntry[] }) {
  return (
    <Document>
      <CoverSheet salesName={salesName} entries={entries} />
      {entries.map((e) => (
        <Page key={e.invoiceNo} size="A4" style={invoicePageStyle}>
          <InvoicePageContent data={e} />
        </Page>
      ))}
    </Document>
  );
}
