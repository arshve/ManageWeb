import { formatRupiah, formatDateTime, formatPengiriman, formatPaymentStatus } from './format';

const RUPIAH_FIELDS = new Set([
  'hargaJual', 'hargaModal', 'resellerCut', 'hpp', 'profit', 'dp', 'totalBayar',
]);
const DATE_FIELDS = new Set(['deliveryDate', 'deliveredAt']);
const ENUM_FORMATTERS: Record<string, (v: unknown) => string> = {
  pengiriman: (v) => formatPengiriman(v as string | null),
  paymentStatus: (v) => formatPaymentStatus(v as string),
};

export function formatAuditValue(key: string, v: unknown): string {
  if (v === undefined || v === null) return '—';
  if (typeof v === 'boolean') return String(v);
  if (ENUM_FORMATTERS[key]) return ENUM_FORMATTERS[key](v);
  if (RUPIAH_FIELDS.has(key) && typeof v === 'number') return formatRupiah(v);
  if (DATE_FIELDS.has(key) && typeof v === 'string') return formatDateTime(v);
  if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(v)) return formatDateTime(v);
  if (typeof v === 'number' || typeof v === 'string') return String(v);
  if (Array.isArray(v) && v.every((x) => typeof x !== 'object' || x === null)) {
    return v.map((x) => formatAuditValue(key, x)).join(', ');
  }
  return JSON.stringify(v, null, 2);
}
