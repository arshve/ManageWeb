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
import { terbilang } from './terbilang';
import { formatPengiriman } from '@/lib/format';

const logoSrc = path.join(process.cwd(), 'public', 'logo.png');
const signatureSrc = path.join(process.cwd(), 'public', 'signature.png');

export interface InvoiceData {
  invoiceNo: string;
  createdAt: Date;
  buyerName: string;
  livestock: {
    type: string;
    grade: string | null;
    weightMin: number | null;
    weightMax: number | null;
  };
  hargaJual: number;
  dp: number | null;
  pengiriman: string | null;
  deliveryDate: Date | null;
}

function formatRupiah(n: number): string {
  return 'Rp' + n.toLocaleString('id-ID');
}

function formatDateID(date: Date): string {
  const months = [
    'Januari',
    'Februari',
    'Maret',
    'April',
    'Mei',
    'Juni',
    'Juli',
    'Agustus',
    'September',
    'Oktober',
    'November',
    'Desember',
  ];
  return `${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}`;
}

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 10, fontFamily: 'Helvetica' },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    borderBottomWidth: 1.5,
    borderBottomColor: '#2f7d32',
    paddingBottom: 8,
  },
  titleBlock: { flexDirection: 'row', alignItems: 'center' },
  logo: { width: 48, height: 48, marginRight: 10 },
  title: { fontSize: 22, fontWeight: 'bold', letterSpacing: 1 },
  companyBlock: { flexDirection: 'column', alignItems: 'flex-end' },
  companyName: { fontSize: 11, fontWeight: 'bold' },
  companyTagline: { fontSize: 8, marginTop: 1 },
  companyAddress: { fontSize: 8, marginTop: 1, maxWidth: 260, textAlign: 'right' },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 18,
  },
  infoBlock: { flexDirection: 'column' },
  infoLabel: { fontSize: 9, fontWeight: 'bold' },
  infoValue: { fontSize: 10, marginTop: 2 },
  sectionLabel: { fontSize: 9, fontWeight: 'bold', marginTop: 20 },
  table: {
    marginTop: 4,
    borderWidth: 0.5,
    borderColor: '#333',
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#f2f2f2',
    borderBottomWidth: 0.5,
    borderBottomColor: '#333',
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 0.5,
    borderBottomColor: '#cccccc',
  },
  th: {
    padding: 4,
    fontSize: 9,
    fontWeight: 'bold',
    borderRightWidth: 0.5,
    borderRightColor: '#333',
    textAlign: 'center',
  },
  td: {
    padding: 4,
    fontSize: 9,
    borderRightWidth: 0.5,
    borderRightColor: '#cccccc',
    textAlign: 'center',
  },
  colInv: { width: '22%' },
  colJenis: { width: '18%' },
  colTipe: { width: '20%' },
  colBayar: { width: '20%' },
  colHarga: { width: '20%', borderRightWidth: 0 },
  totalsBlock: { marginTop: 6, flexDirection: 'column', alignItems: 'flex-end' },
  totalsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '50%',
    paddingVertical: 2,
  },
  totalsLabel: { fontSize: 10, fontWeight: 'bold' },
  totalsValue: { fontSize: 10 },
  totalsValueBold: { fontSize: 11, fontWeight: 'bold' },
  paidLabel: { fontSize: 9, fontWeight: 'bold', marginTop: 14 },
  terbilangLabel: { fontSize: 9, fontWeight: 'bold', marginTop: 8 },
  terbilangValue: { fontSize: 10, fontStyle: 'italic', marginLeft: 12, marginTop: 4 },
  shipRow: { fontSize: 9, marginTop: 22 },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 60,
  },
  bankBlock: { flexDirection: 'column' },
  bankTitle: { fontSize: 9 },
  bankName: { fontSize: 10, fontWeight: 'bold', marginTop: 2 },
  bankLine: { fontSize: 9, marginTop: 1 },
  signBlock: { flexDirection: 'column', alignItems: 'flex-end' },
  signCity: { fontSize: 9 },
  signGreeting: { fontSize: 9, marginTop: 2 },
  signature: { width: 90, height: 55, marginTop: 4, marginBottom: -6 },
  signerName: { fontSize: 10, fontWeight: 'bold' },
});

export function InvoiceDocument({ data }: { data: InvoiceData }) {
  const paidAmount = data.dp ?? 0;
  const sisa = Math.max(0, data.hargaJual - paidAmount);

  const tipeBerat = [
    data.livestock.grade,
    data.livestock.weightMin && data.livestock.weightMax
      ? `${data.livestock.weightMin}-${data.livestock.weightMax}`
      : null,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.headerRow}>
          <View style={styles.titleBlock}>
            <Image src={logoSrc} style={styles.logo} />
            <Text style={styles.title}>INVOICE</Text>
          </View>
          <View style={styles.companyBlock}>
            <Text style={styles.companyName}>{COMPANY.name}</Text>
            <Text style={styles.companyTagline}>{COMPANY.tagline}</Text>
            <Text style={styles.companyAddress}>{COMPANY.address}</Text>
          </View>
        </View>

        <View style={styles.infoRow}>
          <View style={styles.infoBlock}>
            <Text style={styles.infoLabel}>Customer</Text>
            <Text style={styles.infoValue}>{data.buyerName}</Text>
          </View>
          <View style={styles.infoBlock}>
            <Text style={styles.infoLabel}>Tanggal Pemesanan</Text>
            <Text style={styles.infoValue}>{formatDateID(data.createdAt)}</Text>
          </View>
        </View>

        <View style={{ marginTop: 14 }}>
          <Text style={styles.infoLabel}>INV No.</Text>
          <Text style={styles.infoValue}>{data.invoiceNo}</Text>
        </View>

        <Text style={styles.sectionLabel}>Perincian Pesanan :</Text>
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={[styles.th, styles.colInv]}>INV No.</Text>
            <Text style={[styles.th, styles.colJenis]}>Jenis</Text>
            <Text style={[styles.th, styles.colTipe]}>Tipe/Berat</Text>
            <Text style={[styles.th, styles.colBayar]}>Bayar</Text>
            <Text style={[styles.th, styles.colHarga]}>Harga</Text>
          </View>
          <View style={styles.tableRow}>
            <Text style={[styles.td, styles.colInv]}>{data.invoiceNo}</Text>
            <Text style={[styles.td, styles.colJenis]}>
              {data.livestock.type}
            </Text>
            <Text style={[styles.td, styles.colTipe]}>{tipeBerat || '-'}</Text>
            <Text style={[styles.td, styles.colBayar]}>
              {paidAmount ? formatRupiah(paidAmount) : '-'}
            </Text>
            <Text style={[styles.td, styles.colHarga]}>
              {formatRupiah(data.hargaJual)}
            </Text>
          </View>
        </View>

        <View style={styles.totalsBlock}>
          <View style={styles.totalsRow}>
            <Text style={styles.totalsLabel}>Total Harga :</Text>
            <Text style={styles.totalsValue}>
              {formatRupiah(data.hargaJual)}
            </Text>
          </View>
          <View style={styles.totalsRow}>
            <Text style={styles.totalsLabel}>Total Bayar :</Text>
            <Text style={styles.totalsValue}>
              {formatRupiah(paidAmount)}
            </Text>
          </View>
          <View style={styles.totalsRow}>
            <Text style={styles.totalsLabel}>Sisa Bayar :</Text>
            <Text style={styles.totalsValueBold}>{formatRupiah(sisa)}</Text>
          </View>
        </View>

        <Text style={styles.paidLabel}>Invoice Dibayar Customer</Text>
        <Text style={styles.terbilangLabel}>Terbilang :</Text>
        <Text style={styles.terbilangValue}>{terbilang(paidAmount)}</Text>

        <Text style={styles.shipRow}>
          Pengiriman : {formatPengiriman(data.pengiriman)}
          {data.deliveryDate ? ` — ${formatDateID(data.deliveryDate)}` : ''}
        </Text>

        <View style={styles.footerRow}>
          <View style={styles.bankBlock}>
            <Text style={styles.bankTitle}>
              Pembayaran dapat dilakukan ke Rekening Penampungan berikut :
            </Text>
            <Text style={styles.bankName}>{COMPANY.bank.name}</Text>
            <Text style={styles.bankLine}>
              A.n. {COMPANY.bank.accountName}
            </Text>
            <Text style={styles.bankLine}>{COMPANY.bank.accountNo}</Text>
          </View>
          <View style={styles.signBlock}>
            <Text style={styles.signCity}>
              {COMPANY.city}, {formatDateID(new Date())}
            </Text>
            <Text style={styles.signGreeting}>Hormat Kami,</Text>
            <Image src={signatureSrc} style={styles.signature} />
            <Text style={styles.signerName}>{COMPANY.signer}</Text>
          </View>
        </View>
      </Page>
    </Document>
  );
}
