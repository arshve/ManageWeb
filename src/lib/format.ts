/**
 * Formatting Utilities
 *
 * Helper functions for displaying data in Indonesian locale format.
 * Used throughout the dashboard and public pages for consistent
 * number/date/ID formatting.
 */

/**
 * Formats a number as Indonesian Rupiah currency.
 * Example: 3500000 → "Rp3.500.000"
 *
 * @param amount - The number to format
 * @returns Formatted Rupiah string with no decimal places
 */
export function formatRupiah(amount: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * Formats a date as a readable Indonesian date string.
 * Example: "2026-04-07" → "7 April 2026"
 *
 * @param date - Date object or ISO date string
 * @returns Formatted date string in "day month year" format
 */
export function formatDate(date: Date | string): string {
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(date));
}

/**
 * Formats a date with time for table displays.
 * Example: "2026-04-07T14:30:00" → "7 Apr 2026, 14.30"
 *
 * @param date - Date object or ISO date string
 * @returns Formatted date+time string
 */
export function formatDateTime(date: Date | string): string {
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(date));
}

/**
 * Formats a weight (or weight range) into a display string.
 * - min == max (or max is null) → single value: "45 kg"
 * - min != max → range: "250-300 kg"
 * - both null → null (caller decides how to render)
 */
export function formatWeight(
  min: number | null,
  max: number | null,
): string | null {
  if (min == null && max == null) return null;
  const lo = min ?? max!;
  const hi = max ?? min!;
  if (lo === hi) return `${lo} kg`;
  return `${lo}-${hi} kg`;
}

/**
 * Parses a weight input string like "300" or "250-300" into min/max numbers.
 * Returns null values on empty input. Throws on malformed input.
 */
export function parseWeightInput(input: string): {
  min: number | null;
  max: number | null;
} {
  const trimmed = input.trim();
  if (!trimmed) return { min: null, max: null };

  const rangeMatch = trimmed.match(/^(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)$/);
  if (rangeMatch) {
    const min = Number(rangeMatch[1]);
    const max = Number(rangeMatch[2]);
    if (max < min) throw new Error('Berat maksimal harus lebih besar dari minimal');
    return { min, max };
  }

  const single = Number(trimmed);
  if (Number.isNaN(single)) {
    throw new Error('Format berat tidak valid (contoh: "300" atau "250-300")');
  }
  return { min: single, max: single };
}

/**
 * Generates a unique SKU (Stock Keeping Unit) for a livestock animal.
 * Pattern: MF-{sequence}{typeCode}-{grade}
 * Example: generateSku("KAMBING", "A", 2) → "MF-002K-A"
 *
 * @param type - Animal type (KAMBING, DOMBA, SAPI)
 * @param grade - Animal grade (SUPER, A, B, C, D)
 * @param sequence - Sequential number for ordering
 * @returns Formatted SKU string
 */
export function generateSku(
  type: string,
  grade: string,
  sequence: number
): string {
  const typeCode = type.substring(0, 1); // K for KAMBING, D for DOMBA, S for SAPI
  return `MF-${String(sequence).padStart(3, "0")}${typeCode}-${grade}`;
}

/**
 * Generates a unique invoice number for sale entries.
 * Pattern: INV-{YYMMDD}-{random4chars}
 * Example: "INV-260407-X3K9"
 *
 * The random suffix ensures uniqueness even for multiple entries on the same day.
 *
 * @returns Formatted invoice number string
 */
const PENGIRIMAN_LABELS: Record<string, string> = {
  HARI_H: 'Hari H',
  H_1: 'H-1',
  H_2: 'H-2',
  H_3: 'H-3',
  TITIP_POTONG: 'Titip Potong',
};

const PAYMENT_LABELS: Record<string, string> = {
  BELUM_BAYAR: 'Belum Bayar',
  DP: 'DP',
  LUNAS: 'Lunas',
};

export function formatPengiriman(value: string | null): string {
  if (!value) return '—';
  return PENGIRIMAN_LABELS[value] ?? value;
}

export function formatPaymentStatus(value: string): string {
  return PAYMENT_LABELS[value] ?? value;
}

export function generateInvoiceNo(): string {
  const now = new Date();
  const y = now.getFullYear().toString().slice(-2);
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `INV-${y}${m}${d}-${rand}`;
}
