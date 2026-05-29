// Shared formatters + bucket utils for both the Sampul and Briefing report
// views. Pure functions — no React, safe for server / client / pdf imports.

import { formatRupiah } from '@/lib/format';

const MONTHS_SHORT_ID = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agt', 'Sep', 'Okt', 'Nov', 'Des'];

// compact rupiah for big hero figures: Rp 12,3 jt / Rp 1,2 M
export function rpShort(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1e9) return `Rp ${(n / 1e9).toFixed(1).replace('.', ',')} M`;
  if (abs >= 1e6) return `Rp ${(n / 1e6).toFixed(1).replace('.', ',')} jt`;
  if (abs >= 1e3) return `Rp ${Math.round(n / 1e3)} rb`;
  return formatRupiah(n);
}

// "2025-04-08" → "8 Apr"
export function shortDayLabel(iso: string): string {
  const [, m, d] = iso.split('-');
  return `${Number(d)} ${MONTHS_SHORT_ID[Number(m) - 1] ?? ''}`;
}

// Bucket daily entries into ~8–10 weekly buckets so weekly bars stay scannable
// across any range. First bucket starts at the period start; each bucket spans
// 7 days, last bucket holds the tail.
export function toWeekly(
  perDay: { date: string; penjualan: number; profit: number }[],
): { label: string; value: number }[] {
  if (!perDay.length) return [];
  const weeks: { label: string; value: number }[] = [];
  for (let i = 0; i < perDay.length; i += 7) {
    const slice = perDay.slice(i, i + 7);
    weeks.push({
      label: shortDayLabel(slice[0].date),
      value: slice.reduce((s, d) => s + d.penjualan, 0),
    });
  }
  return weeks;
}

export const SERIF = "var(--font-dm-serif), 'DM Serif Display', serif";
