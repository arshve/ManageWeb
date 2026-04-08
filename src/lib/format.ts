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
export function generateInvoiceNo(): string {
  const now = new Date();
  const y = now.getFullYear().toString().slice(-2);
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `INV-${y}${m}${d}-${rand}`;
}
