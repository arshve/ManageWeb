/**
 * Company identity used across PDF documents.
 *
 * `COMPANY` is the built-in DEFAULT (Millenials Farm). At runtime the white-
 * label config (AppConfig row) is merged over this — see
 * `src/lib/config/get-config.ts` `getCompanyInfo()`. PDF documents accept a
 * `company: CompanyInfo` prop (defaulting to `COMPANY`) so a configured tenant
 * renders its own name / bank / signer / logo.
 */

export interface CompanyInfo {
  name: string;
  tagline: string;
  address: string;
  city: string;
  bank: {
    name: string;
    accountName: string;
    accountNo: string;
  };
  signer: string;
  /** Remote logo URL (Supabase). null/undefined → fall back to /public/logo.png. */
  logoUrl?: string | null;
  /** Remote CEO signature image URL. null/undefined → /public/signature.png. */
  signatureUrl?: string | null;
}

export const COMPANY: CompanyInfo = {
  name: 'PT. MILLENIALS FARM ABADI',
  tagline: 'SUPLIER HEWAN TERNAK',
  address:
    'Jalan Mahoni 2 no 12A, Rt. 001 Rw.003, Pamulang, Kota Tangerang Selatan, Banten, Indonesia',
  city: 'Kota Tangerang Selatan',
  bank: {
    name: 'Mandiri',
    accountName: 'PT. Millenials Farm Abadi',
    accountNo: '1640006603353',
  },
  signer: 'ARI ARDHITO RAMADHAN',
};
