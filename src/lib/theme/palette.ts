/**
 * Brand palette generator (pure, no deps).
 *
 * Converts a single brand hex into the 11-stop OKLCH scale the app already
 * uses for `--brand-50 … --brand-950` (globals.css "STEP 1" carbon-black ramp).
 * We keep the EXACT lightness ramp of the existing ramp — so every contrast
 * relationship (sidebar, primary, foreground) that was tuned against carbon
 * black still holds — and only swap the hue + scale the chroma to match the
 * brand's saturation. This makes it very hard to produce an unreadable theme.
 */

export type BrandStop = '50' | '100' | '200' | '300' | '400' | '500' | '600' | '700' | '800' | '900' | '950';
export type BrandScale = Record<BrandStop, string>;

const STOPS: BrandStop[] = ['50', '100', '200', '300', '400', '500', '600', '700', '800', '900', '950'];

// Lightness + chroma ramp lifted from the existing --cb-* scale. Hue is taken
// from the brand hex; chroma is scaled relative to CB_BASE_C[500].
const CB_L = [0.965, 0.927, 0.853, 0.778, 0.700, 0.622, 0.529, 0.433, 0.332, 0.221, 0.187];
const CB_C = [0.003, 0.006, 0.014, 0.020, 0.026, 0.035, 0.028, 0.023, 0.017, 0.008, 0.007];
const CB_REF_C = 0.035; // chroma at the 500 stop

/* ── sRGB hex → OKLCH ─────────────────────────────────────────────────── */

function srgbToLinear(c: number): number {
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

export function hexToOklch(hex: string): { L: number; C: number; h: number } {
  const m = hex.replace('#', '').trim();
  const full = m.length === 3 ? m.split('').map((c) => c + c).join('') : m;
  const r = srgbToLinear(parseInt(full.slice(0, 2), 16) / 255);
  const g = srgbToLinear(parseInt(full.slice(2, 4), 16) / 255);
  const b = srgbToLinear(parseInt(full.slice(4, 6), 16) / 255);

  const l = 0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b;
  const mm = 0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b;
  const s = 0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b;
  const l_ = Math.cbrt(l), m_ = Math.cbrt(mm), s_ = Math.cbrt(s);

  const L = 0.2104542553 * l_ + 0.7936177850 * m_ - 0.0040720468 * s_;
  const A = 1.9779984951 * l_ - 2.4285922050 * m_ + 0.4505937099 * s_;
  const B = 0.0259040371 * l_ + 0.7827717662 * m_ - 0.8086757660 * s_;

  const C = Math.sqrt(A * A + B * B);
  let h = (Math.atan2(B, A) * 180) / Math.PI;
  if (h < 0) h += 360;
  return { L, C, h };
}

const r3 = (n: number) => Math.round(n * 1000) / 1000;

/**
 * Generate the 11-stop brand scale from a brand hex. Returns OKLCH strings
 * ready to drop into `--brand-<stop>` custom properties.
 */
export function hexToBrandScale(hex: string): BrandScale {
  const { C, h } = hexToOklch(hex);
  // How saturated is the brand vs the reference ramp? Clamp so neon brands
  // don't blow out and near-greys still show a hint of hue.
  const chromaScale = Math.min(6, Math.max(0.4, C / CB_REF_C));
  const out = {} as BrandScale;
  STOPS.forEach((stop, i) => {
    const c = r3(CB_C[i] * chromaScale);
    out[stop] = `oklch(${r3(CB_L[i])} ${c} ${r3(h)})`;
  });
  return out;
}

/**
 * Report-cover ink derived from the brand hue (very dark, low chroma). Mirrors
 * the original `#14201d` feel but tinted to the brand. Used for --report-cover.
 */
export function brandCoverColor(hex: string): string {
  const { h } = hexToOklch(hex);
  return `oklch(0.2 0.02 ${r3(h)})`;
}

/** Serialize a scale into the CSS body of a `:root { … }` block. */
export function brandScaleToCss(scale: BrandScale, cover?: string): string {
  const lines = STOPS.map((s) => `--brand-${s}:${scale[s]};`);
  if (cover) lines.push(`--report-cover:${cover};`);
  return `:root{${lines.join('')}}`;
}
