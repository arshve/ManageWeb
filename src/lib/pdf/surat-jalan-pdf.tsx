import path from 'node:path'
import {
  Document,
  Page,
  View,
  Text,
  Image,
  StyleSheet,
} from '@react-pdf/renderer'
import { COMPANY, type CompanyInfo } from './company'

const logoSrc = path.join(process.cwd(), 'public', 'logo.png')

export interface SuratJalanData {
  noSuratJalan: string
  tanggal: Date
  driverName: string | null
  vehiclePlate: string | null
  buyerName: string
  buyerPhone: string | null
  buyerAddress: string | null
  items: {
    type: string
    grade: string | null
    tag: string | null
    sku: string
    weightMin: number | null
    weightMax: number | null
    condition: string
  }[]
  notes: string | null
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
  ]
  return `${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}`
}

const styles = StyleSheet.create({
  page: { padding: 36, fontSize: 9, fontFamily: 'Helvetica' },

  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 8,
  },
  logoBlock: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  logo: { width: 44, height: 44 },
  companyBlock: { flexDirection: 'column' },
  companyName: { fontSize: 10, fontWeight: 'bold' },
  companyTagline: { fontSize: 7.5, marginTop: 1, color: '#555' },
  companyAddress: { fontSize: 7, marginTop: 1, color: '#555', maxWidth: 200 },

  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#e65100',
    letterSpacing: 2,
  },

  rule1: { borderBottomWidth: 3, borderBottomColor: '#1a1a1a', marginTop: 6 },
  rule2: {
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a1a',
    marginTop: 2,
    marginBottom: 12,
  },

  infoGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  infoLeft: { flexDirection: 'column', flex: 1 },
  infoRight: { flexDirection: 'column', width: 220 },
  infoLabel: { fontSize: 9, fontWeight: 'bold', width: 70 },
  infoValue: { fontSize: 9, flex: 1 },
  infoRow: { flexDirection: 'row', marginBottom: 3, alignItems: 'flex-start' },
  colon: { fontSize: 9, marginRight: 4, width: 8 },
  kepada: { fontSize: 9, marginBottom: 6 },

  table: { borderWidth: 0.75, borderColor: '#333' },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#f2f2f2',
    borderBottomWidth: 0.75,
    borderBottomColor: '#333',
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 0.5,
    borderBottomColor: '#bbb',
    minHeight: 22,
  },
  tableRowLast: { borderBottomWidth: 0 },
  th: {
    padding: 5,
    fontSize: 8.5,
    fontWeight: 'bold',
    borderRightWidth: 0.75,
    borderRightColor: '#333',
    textAlign: 'center',
  },
  td: {
    padding: 5,
    fontSize: 8.5,
    borderRightWidth: 0.5,
    borderRightColor: '#bbb',
    textAlign: 'center',
  },
  colNo: { width: '7%' },
  colNama: { width: '40%' },
  colQty: { width: '10%' },
  colKet: { width: '43%', borderRightWidth: 0 },

  emptyRows: { height: 80 },

  footerGrid: {
    flexDirection: 'row',
    borderWidth: 0.75,
    borderColor: '#333',
    borderTopWidth: 0,
    minHeight: 50,
  },
  catatanBlock: {
    flex: 1,
    padding: 6,
    borderRightWidth: 0.75,
    borderRightColor: '#333',
  },
  perhatianBlock: { flex: 1.4, padding: 6 },
  footerLabel: { fontSize: 8, fontWeight: 'bold', marginBottom: 3 },
  footerText: { fontSize: 8, color: '#333' },
  perhatianItem: { fontSize: 7.5, color: '#333', marginBottom: 2 },

  sigRow: { flexDirection: 'row', marginTop: 28 },
  sigBlock: { flex: 1, alignItems: 'center' },
  sigLabel: {
    fontSize: 8.5,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 36,
  },
  sigLine: {
    borderTopWidth: 0.75,
    borderTopColor: '#333',
    width: '80%',
    marginTop: 4,
  },
  sigNameHint: {
    fontSize: 7.5,
    color: '#888',
    marginTop: 3,
    textAlign: 'center',
  },
})

export function SuratJalanDocument({ data, company = COMPANY }: { data: SuratJalanData; company?: CompanyInfo }) {
  return (
    <Document>
      <Page size='A4' style={styles.page}>
        {/* ── Header ── */}
        <View style={styles.headerRow}>
          <View style={styles.logoBlock}>
            <Image src={company.logoUrl || logoSrc} style={styles.logo} />
            <View style={styles.companyBlock}>
              <Text style={styles.companyName}>{company.name}</Text>
              <Text style={styles.companyTagline}>{company.tagline}</Text>
              <Text style={styles.companyAddress}>{company.address}</Text>
            </View>
          </View>
          <Text style={styles.title}>SURAT JALAN</Text>
        </View>
        <View style={styles.rule1} />
        <View style={styles.rule2} />

        {/* ── Info Grid ── */}
        <View style={styles.infoGrid}>
          <View style={styles.infoLeft}>
            <Text style={styles.kepada}>Kepada Yth.</Text>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Nama</Text>
              <Text style={styles.colon}>:</Text>
              <Text style={styles.infoValue}>{data.buyerName}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>No. Telp</Text>
              <Text style={styles.colon}>:</Text>
              <Text style={styles.infoValue}>{data.buyerPhone ?? '-'}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Alamat</Text>
              <Text style={styles.colon}>:</Text>
              <Text style={styles.infoValue}>{data.buyerAddress ?? '-'}</Text>
            </View>
          </View>

          <View style={styles.infoRight}>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>No. Surat Jalan</Text>
              <Text style={styles.colon}>:</Text>
              <Text style={styles.infoValue}>{data.noSuratJalan}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Tanggal</Text>
              <Text style={styles.colon}>:</Text>
              <Text style={styles.infoValue}>{formatDateID(data.tanggal)}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Nama Supir</Text>
              <Text style={styles.colon}>:</Text>
              <Text style={styles.infoValue}>{data.driverName ?? '-'}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>No. Polisi</Text>
              <Text style={styles.colon}>:</Text>
              <Text style={styles.infoValue}>{data.vehiclePlate ?? '-'}</Text>
            </View>
          </View>
        </View>

        {/* ── Items Table ── */}
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={[styles.th, styles.colNo]}>No.</Text>
            <Text style={[styles.th, styles.colNama]}>Hewan</Text>
            <Text style={[styles.th, styles.colQty]}>Qty</Text>
            <Text style={[styles.th, styles.colKet]}>Keterangan</Text>
          </View>
          {data.items.map((item, idx) => {
            const namaBarang = [item.type, item.grade].filter(Boolean).join(' ')
            const keterangan = [
              item.tag ?? item.sku,
              item.weightMin != null && item.weightMax != null
                ? `${item.weightMin}–${item.weightMax} kg`
                : null,
            ]
              .filter(Boolean)
              .join(' · ')
            const isLast = idx === data.items.length - 1
            return (
              <View
                key={idx}
                style={[styles.tableRow, isLast ? styles.tableRowLast : {}]}
              >
                <Text style={[styles.td, styles.colNo]}>{idx + 1}</Text>
                <Text style={[styles.td, styles.colNama]}>{namaBarang}</Text>
                <Text style={[styles.td, styles.colQty]}>1</Text>
                <Text style={[styles.td, styles.colKet]}>
                  {keterangan || '-'}
                </Text>
              </View>
            )
          })}
          {data.items.length === 0 && (
            <View
              style={[styles.tableRow, styles.emptyRows, styles.tableRowLast]}
            >
              <Text style={[styles.td, { flex: 1, borderRightWidth: 0 }]} />
            </View>
          )}
        </View>

        {/* ── Footer Grid ── */}
        <View style={styles.footerGrid}>
          <View style={styles.catatanBlock}>
            <Text style={styles.footerLabel}>Catatan:</Text>
            {data.notes ? (
              <Text style={styles.footerText}>{data.notes}</Text>
            ) : null}
          </View>
          <View style={styles.perhatianBlock}>
            <Text style={styles.footerLabel}>PERHATIAN:</Text>
            <Text style={styles.perhatianItem}>
              1. Surat jalan ini merupakan bukti resmi penerimaan barang
            </Text>
            <Text style={styles.perhatianItem}>
              2. Surat jalan ini bukan bukti penjualan
            </Text>
          </View>
        </View>

        {/* ── Signature Row ── */}
        <Text
          style={{
            fontSize: 7.5,
            color: '#555',
            marginTop: 6,
            marginBottom: 2,
          }}
        >
          BARANG SUDAH DITERIMA DALAM KEADAAN BAIK DAN CUKUP OLEH:
        </Text>
        <Text style={{ fontSize: 7, color: '#888', marginBottom: 4 }}>
          (tanda tangan dan cap / stempel perusahaan)
        </Text>
        <View style={styles.sigRow}>
          {(
            [
              'Admin Kandang',
              'Bagian Pengiriman',
              'Pembeli / Penerima',
            ] as const
          ).map((label) => (
            <View key={label} style={styles.sigBlock}>
              <Text style={styles.sigLabel}>{label}</Text>
              <View style={styles.sigLine} />
              <Text style={styles.sigNameHint}>(nama & tanda tangan)</Text>
            </View>
          ))}
        </View>
      </Page>
    </Document>
  )
}
