/**
 * White-label app configuration.
 *
 * Reads the single `AppConfig` row and merges it over the built-in defaults
 * (current Millenials Farm branding + metadata). Everything is cached:
 * - React `cache()` dedupes within one request.
 * - `unstable_cache` (tag `app-config`) persists across requests; the Owner
 *   branding action calls `revalidateTag('app-config')` on save.
 *
 * Server components / routes call `getAppConfig()` directly. Client components
 * receive it via `ConfigProvider` (seeded by the server layouts).
 */

import { cache } from 'react';
import { prisma } from '@/lib/prisma';
import { COMPANY, type CompanyInfo } from '@/lib/pdf/company';
import { brandScaleToCss, brandCoverColor, type BrandScale } from '@/lib/theme/palette';

export interface AppConfig {
  // Company / legal
  companyName: string;
  tagline: string;
  address: string;
  city: string;
  bankName: string;
  bankAccountName: string;
  bankAccountNo: string;
  signer: string;
  instagram: string | null;
  // App metadata
  appTitle: string;
  appDescription: string;
  // Brand display name (short, for chrome) — derived from companyName if unset
  brandName: string;
  // Assets
  logoUrl: string | null;
  logoLightUrl: string | null;
  signatureUrl: string | null;
  // Theme
  brandHex: string | null;
  brandScale: BrandScale | null;
  coverColor: string | null;
  // Landing carousel — null means use the built-in default slides.
  carouselSlides: CarouselSlide[] | null;
  // Master on/off for online payment (Midtrans cart + sales charge).
  paymentEnabled: boolean;
  // Master on/off for the setoran (sales→company remittance) feature.
  setoranEnabled: boolean;
  // Profile.id that owns public catalogue orders (chosen from the sales list).
  publicSalesId: string | null;
  // Midtrans — client-safe fields only. The server key is NEVER exposed here
  // (clients receive this object); `hasMidtransServerKey` just signals if one is set.
  midtransClientKey: string | null;
  midtransIsProduction: boolean;
  paymentMock: boolean;
  hasMidtransServerKey: boolean;
}

// A slide carries up to three responsive variants. `desktop` is required;
// `tab`/`mobile` fall back to it when absent.
export type CarouselSlide = { desktop: string; tab?: string; mobile?: string; alt?: string };

// Defaults mirror the pre-white-label hardcoded values.
const DEFAULTS: AppConfig = {
  companyName: COMPANY.name,
  tagline: COMPANY.tagline,
  address: COMPANY.address,
  city: COMPANY.city,
  bankName: COMPANY.bank.name,
  bankAccountName: COMPANY.bank.accountName,
  bankAccountNo: COMPANY.bank.accountNo,
  signer: COMPANY.signer,
  instagram: '@millenialsfarm_',
  appTitle: 'Millenials Farm - Qurban Terpercaya',
  appDescription:
    'Millenials Farm menyediakan hewan qurban berkualitas. Kambing, Domba, dan Sapi pilihan terbaik untuk ibadah qurban Anda.',
  brandName: 'Millenials Farm',
  logoUrl: null,
  logoLightUrl: null,
  signatureUrl: null,
  brandHex: null,
  brandScale: null,
  coverColor: null,
  carouselSlides: null,
  paymentEnabled: false,
  setoranEnabled: false,
  publicSalesId: null,
  midtransClientKey: null,
  midtransIsProduction: false,
  paymentMock: false,
  hasMidtransServerKey: false,
};

// Env fallbacks for payment config (used until the Owner sets values in the UI).
const ENV_SERVER_KEY = process.env.MIDTRANS_SERVER_KEY ?? '';
const ENV_CLIENT_KEY = process.env.NEXT_PUBLIC_MIDTRANS_CLIENT_KEY ?? '';
const ENV_IS_PROD = process.env.MIDTRANS_IS_PRODUCTION === 'true';
const ENV_MOCK = process.env.NEXT_PUBLIC_MIDTRANS_MOCK === 'true';

// Resolve the client-safe payment fields from a row (or null), with env fallback.
type AppConfigRow = NonNullable<Awaited<ReturnType<typeof prisma.appConfig.findUnique>>>;
function paymentPublicFields(row: AppConfigRow | null) {
  return {
    paymentEnabled: row?.paymentEnabled ?? DEFAULTS.paymentEnabled,
    publicSalesId: row?.publicSalesId ?? DEFAULTS.publicSalesId,
    midtransClientKey: row?.midtransClientKey || ENV_CLIENT_KEY || null,
    midtransIsProduction: row?.midtransIsProduction ?? ENV_IS_PROD,
    paymentMock: row?.paymentMock ?? ENV_MOCK,
    hasMidtransServerKey: !!(row?.midtransServerKey || ENV_SERVER_KEY),
  };
}

// Per-request memoized (React cache). Config changes rarely; the Owner save
// action calls revalidatePath('/', 'layout') so the next render reads fresh.
export const getAppConfig = cache(async function getAppConfig(): Promise<AppConfig> {
  let row: Awaited<ReturnType<typeof prisma.appConfig.findUnique>> = null;
  try {
    row = await prisma.appConfig.findUnique({ where: { id: 'singleton' } });
  } catch {
    // Table missing (pre-migration) or DB down — fall back to defaults.
    return { ...DEFAULTS, ...paymentPublicFields(null) };
  }
  if (!row) return { ...DEFAULTS, ...paymentPublicFields(null) };

  const companyName = row.companyName ?? DEFAULTS.companyName;
  return {
    companyName,
    tagline: row.tagline ?? DEFAULTS.tagline,
    address: row.address ?? DEFAULTS.address,
    city: row.city ?? DEFAULTS.city,
    bankName: row.bankName ?? DEFAULTS.bankName,
    bankAccountName: row.bankAccountName ?? DEFAULTS.bankAccountName,
    bankAccountNo: row.bankAccountNo ?? DEFAULTS.bankAccountNo,
    signer: row.signer ?? DEFAULTS.signer,
    instagram: row.instagram ?? DEFAULTS.instagram,
    appTitle: row.appTitle ?? DEFAULTS.appTitle,
    appDescription: row.appDescription ?? DEFAULTS.appDescription,
    brandName: row.brandName ?? row.companyName ?? DEFAULTS.brandName,
    logoUrl: row.logoUrl ?? null,
    logoLightUrl: row.logoLightUrl ?? null,
    signatureUrl: row.signatureUrl ?? null,
    brandHex: row.brandHex ?? null,
    brandScale: (row.brandScale as BrandScale | null) ?? null,
    coverColor: row.coverColor ?? null,
    carouselSlides: normalizeSlides(row.carouselSlides),
    setoranEnabled: row.setoranEnabled ?? DEFAULTS.setoranEnabled,
    ...paymentPublicFields(row),
  };
});

/**
 * SERVER-ONLY Midtrans runtime: includes the secret server key. Never pass the
 * result to a client component. Reads the config row (env fallback per field).
 */
export const getMidtransRuntime = cache(async function getMidtransRuntime() {
  let row: AppConfigRow | null = null;
  try {
    row = await prisma.appConfig.findUnique({ where: { id: 'singleton' } });
  } catch {
    row = null;
  }
  const serverKey = row?.midtransServerKey || ENV_SERVER_KEY;
  const clientKey = row?.midtransClientKey || ENV_CLIENT_KEY;
  return {
    serverKey,
    clientKey,
    isProduction: row?.midtransIsProduction ?? ENV_IS_PROD,
    mock: row?.paymentMock ?? ENV_MOCK,
    configured: serverKey.length > 0,
  };
});

// Coerce the stored JSON into a clean CarouselSlide[]; null if empty/invalid.
// Accepts the new {desktop,tab,mobile} shape and the legacy {url} shape
// (url → desktop) for forward compatibility.
function normalizeSlides(raw: unknown): CarouselSlide[] | null {
  if (!Array.isArray(raw)) return null;
  const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v : undefined);
  const slides = raw
    .map((s) => {
      const o = (s ?? {}) as Record<string, unknown>;
      const desktop = str(o.desktop) ?? str(o.url); // legacy fallback
      if (!desktop) return null;
      return {
        desktop,
        tab: str(o.tab),
        mobile: str(o.mobile),
        alt: str(o.alt),
      } as CarouselSlide;
    })
    .filter((s): s is CarouselSlide => s !== null);
  return slides.length ? slides : null;
}

/** Map an AppConfig to the CompanyInfo shape the PDF documents expect. */
export function toCompanyInfo(cfg: AppConfig): CompanyInfo {
  return {
    name: cfg.companyName,
    tagline: cfg.tagline,
    address: cfg.address,
    city: cfg.city,
    bank: {
      name: cfg.bankName,
      accountName: cfg.bankAccountName,
      accountNo: cfg.bankAccountNo,
    },
    signer: cfg.signer,
    logoUrl: cfg.logoUrl,
    signatureUrl: cfg.signatureUrl,
  };
}

/** Convenience for PDF routes: fetch config + return CompanyInfo in one call. */
export async function getCompanyInfo(): Promise<CompanyInfo> {
  return toCompanyInfo(await getAppConfig());
}

/** CSS `:root{…}` overriding --brand-* (+ --report-cover) — '' when unthemed.
 * Cover = explicit hex if set, else derived (OKLCH) from the brand hex. Either
 * is a valid CSS color; the derivation happens here so only a hex (or null) is
 * ever persisted. */
export function brandThemeCss(cfg: AppConfig): string {
  const cover = cfg.coverColor ?? (cfg.brandHex ? brandCoverColor(cfg.brandHex) : undefined);
  if (cfg.brandScale) return brandScaleToCss(cfg.brandScale, cover);
  if (cover) return `:root{--report-cover:${cover};}`;
  return '';
}
