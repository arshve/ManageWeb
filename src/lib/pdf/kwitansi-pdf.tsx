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

const logoSrc = path.join(process.cwd(), 'public', 'logo.png');
const signatureSrc = path.join(process.cwd(), 'public', 'signature.png');

export interface KwitansiData {
  invoiceNo: string;
  createdAt: Date;
  buyerName: string;
  hargaJual: number;
  dp: number | null;
  totalBayar: number | null;
  variant: 'dp' | 'full';
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
  companyAddress: {
    fontSize: 8,
    marginTop: 1,
    maxWidth: 260,
    textAlign: 'right',
  },
  variantLabel: {
    marginTop: 16,
    textAlign: 'center',
    fontSize: 12,
    fontWeight: 'bold',
    letterSpacing: 0.8,
  },
  body: {
    marginTop: 18,
    borderWidth: 0.5,
    borderColor: '#333',
    padding: 18,
  },
  fieldRow: { flexDirection: 'row', marginBottom: 8 },
  fieldLabel: { fontSize: 10, fontWeight: 'bold', width: 120 },
  fieldValue: { fontSize: 10, flex: 1 },
  amountBlock: {
    marginTop: 12,
    marginBottom: 4,
    padding: 10,
    backgroundColor: '#f6f6f6',
    borderWidth: 0.5,
    borderColor: '#bbb',
  },
  amountLabel: { fontSize: 9, fontWeight: 'bold' },
  amountValue: { fontSize: 16, fontWeight: 'bold', marginTop: 2 },
  terbilangLabel: { fontSize: 9, fontWeight: 'bold', marginTop: 10 },
  terbilangValue: {
    fontSize: 10,
    fontStyle: 'italic',
    marginLeft: 12,
    marginTop: 3,
  },
  purposeLabel: { fontSize: 9, fontWeight: 'bold', marginTop: 10 },
  purposeValue: { fontSize: 10, marginLeft: 12, marginTop: 3 },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 48,
  },
  signBlock: { flexDirection: 'column', alignItems: 'flex-end' },
  signCity: { fontSize: 9 },
  signGreeting: { fontSize: 9, marginTop: 2 },
  signature: { width: 90, height: 55, marginTop: 4, marginBottom: -6 },
  signerName: { fontSize: 10, fontWeight: 'bold' },
});

export function KwitansiDocument({ data }: { data: KwitansiData }) {
  const paidAmount =
    data.variant === 'full'
      ? data.totalBayar ?? data.hargaJual
      : data.dp ?? data.totalBayar ?? 0;

  const variantText =
    data.variant === 'full'
      ? 'PELUNASAN'
      : 'DOWN PAYMENT (DP)';

  const purpose =
    data.variant === 'full'
      ? `Pelunasan pembayaran invoice ${data.invoiceNo}`
      : `Pembayaran uang muka (DP) invoice ${data.invoiceNo}`;

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.headerRow}>
          <View style={styles.titleBlock}>
            <Image src={logoSrc} style={styles.logo} />
            <Text style={styles.title}>KWITANSI</Text>
          </View>
          <View style={styles.companyBlock}>
            <Text style={styles.companyName}>{COMPANY.name}</Text>
            <Text style={styles.companyTagline}>{COMPANY.tagline}</Text>
            <Text style={styles.companyAddress}>{COMPANY.address}</Text>
          </View>
        </View>

        <Text style={styles.variantLabel}>{variantText}</Text>

        <View style={styles.body}>
          <View style={styles.fieldRow}>
            <Text style={styles.fieldLabel}>No. Invoice</Text>
            <Text style={styles.fieldValue}>: {data.invoiceNo}</Text>
          </View>
          <View style={styles.fieldRow}>
            <Text style={styles.fieldLabel}>Nama Buyer</Text>
            <Text style={styles.fieldValue}>: {data.buyerName}</Text>
          </View>
          <View style={styles.fieldRow}>
            <Text style={styles.fieldLabel}>Tanggal</Text>
            <Text style={styles.fieldValue}>
              : {formatDateID(new Date())}
            </Text>
          </View>

          <View style={styles.amountBlock}>
            <Text style={styles.amountLabel}>Jumlah Diterima</Text>
            <Text style={styles.amountValue}>{formatRupiah(paidAmount)}</Text>
          </View>

          <Text style={styles.terbilangLabel}>Terbilang :</Text>
          <Text style={styles.terbilangValue}>{terbilang(paidAmount)}</Text>

          <Text style={styles.purposeLabel}>Untuk Pembayaran :</Text>
          <Text style={styles.purposeValue}>{purpose}</Text>
        </View>

        <View style={styles.footerRow}>
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
