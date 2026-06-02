// Midtrans payment rail — Snap (hosted redirect) + CoreApi (status check).
//
// Credentials are resolved at call time from getMidtransRuntime() (AppConfig,
// with env fallback) — SERVER-ONLY, the secret key never reaches the client. The
// webhook trusts only values from the signature-verified payload (verifySignature).

import crypto from 'node:crypto';
import Midtrans from 'midtrans-client';
import { prisma } from '@/lib/prisma';
import { getMidtransRuntime } from '@/lib/config/get-config';
import { PaymentMethod, PaymentStatus, PaymentTxnStatus } from '@/generated/prisma/client';

export async function midtransConfigured(): Promise<boolean> {
  return (await getMidtransRuntime()).configured;
}

// Demo/mock mode — simulate the Snap flow with a local page instead of calling Midtrans.
export async function isMockPayment(): Promise<boolean> {
  return (await getMidtransRuntime()).mock;
}

// Built fresh per call (keys can change at runtime via the config UI).
export async function getSnap(): Promise<Midtrans.Snap> {
  const rt = await getMidtransRuntime();
  if (!rt.serverKey) throw new Error('Midtrans server key is not set');
  return new Midtrans.Snap({ isProduction: rt.isProduction, serverKey: rt.serverKey, clientKey: rt.clientKey });
}

export async function getCoreApi(): Promise<Midtrans.CoreApi> {
  const rt = await getMidtransRuntime();
  if (!rt.serverKey) throw new Error('Midtrans server key is not set');
  return new Midtrans.CoreApi({ isProduction: rt.isProduction, serverKey: rt.serverKey, clientKey: rt.clientKey });
}

// Methods surfaced in the Snap UI. QRIS + VA banks + major e-wallets (per plan).
export const ENABLED_PAYMENTS = [
  'qris',
  'bca_va',
  'bni_va',
  'bri_va',
  'mandiri_va', // echannel
  'permata_va',
  'gopay',
  'shopeepay',
  'other_va',
];

// Midtrans requires integer IDR. Round defensively.
export function toRupiah(amount: number): number {
  return Math.round(amount);
}

/**
 * Verify the webhook signature: sha512(order_id + status_code + gross_amount + ServerKey).
 * Midtrans sends gross_amount as a string with two decimals (e.g. "25000.00") — use it verbatim.
 */
export function verifySignature(p: {
  order_id: string;
  status_code: string;
  gross_amount: string;
  signature_key?: string;
}, serverKey: string): boolean {
  if (!p.signature_key || !serverKey) return false;
  const expected = crypto
    .createHash('sha512')
    .update(p.order_id + p.status_code + p.gross_amount + serverKey)
    .digest('hex');
  // constant-time compare
  const a = Buffer.from(expected);
  const b = Buffer.from(p.signature_key);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// Map Midtrans transaction_status (+ fraud_status) → our PaymentTxnStatus.
export function mapStatus(transactionStatus: string, fraudStatus?: string): PaymentTxnStatus {
  switch (transactionStatus) {
    case 'capture':
      // card flow: only accept when fraud check has cleared
      return fraudStatus === 'accept' ? PaymentTxnStatus.SETTLEMENT : PaymentTxnStatus.PENDING;
    case 'settlement':
      return PaymentTxnStatus.SETTLEMENT;
    case 'pending':
      return PaymentTxnStatus.PENDING;
    case 'expire':
      return PaymentTxnStatus.EXPIRED;
    case 'cancel':
      return PaymentTxnStatus.CANCELLED;
    case 'deny':
    case 'failure':
      return PaymentTxnStatus.FAILED;
    default:
      return PaymentTxnStatus.PENDING;
  }
}

// Map Midtrans payment_type → our coarse PaymentMethod bucket.
export function mapMethod(paymentType?: string): PaymentMethod | null {
  if (!paymentType) return null;
  if (paymentType === 'qris') return PaymentMethod.QRIS;
  if (paymentType === 'credit_card') return PaymentMethod.CARD;
  if (paymentType.endsWith('_va') || paymentType === 'bank_transfer' || paymentType === 'echannel') {
    return PaymentMethod.VIRTUAL_ACCOUNT;
  }
  if (['gopay', 'shopeepay', 'qris', 'dana', 'ovo'].includes(paymentType)) return PaymentMethod.EWALLET;
  return PaymentMethod.EWALLET;
}

/**
 * Recompute Entry.paymentStatus from the sum of SETTLEMENT payments against
 * totalBayar. LUNAS if settled >= total, DP if any settled, else BELUM_BAYAR.
 * Does not touch the manual buktiTransfer path.
 */
export async function recomputeEntryPaymentStatus(entryId: string): Promise<PaymentStatus> {
  const entry = await prisma.entry.findUnique({
    where: { id: entryId },
    select: { totalBayar: true, payments: { where: { status: PaymentTxnStatus.SETTLEMENT }, select: { grossAmount: true } } },
  });
  if (!entry) return PaymentStatus.BELUM_BAYAR;

  const settled = entry.payments.reduce((sum, p) => sum + p.grossAmount, 0);
  const total = entry.totalBayar ?? 0;
  let status: PaymentStatus = PaymentStatus.BELUM_BAYAR;
  if (settled > 0 && total > 0 && settled >= total) status = PaymentStatus.LUNAS;
  else if (settled > 0) status = PaymentStatus.DP;

  await prisma.entry.update({ where: { id: entryId }, data: { paymentStatus: status } });
  return status;
}
