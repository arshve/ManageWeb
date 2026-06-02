// Midtrans HTTP notification (webhook). Set this URL in the Midtrans dashboard:
//   {APP_URL}/api/payments/midtrans/notification
//
// Security: every payload is signature-verified; amount + status are trusted ONLY
// from the verified body, never the client. Unknown/forged payloads are ignored
// with 200 (Midtrans retries on non-2xx, so we never 4xx a valid retry loop).

import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { logAudit } from '@/lib/audit';
import { verifySignature, mapStatus, mapMethod, recomputeEntryPaymentStatus } from '@/lib/payments/midtrans';
import { getMidtransRuntime } from '@/lib/config/get-config';
import { PaymentTxnStatus } from '@/generated/prisma/client';

export const dynamic = 'force-dynamic';

interface Notification {
  order_id?: string;
  status_code?: string;
  gross_amount?: string;
  signature_key?: string;
  transaction_status?: string;
  transaction_id?: string;
  fraud_status?: string;
  payment_type?: string;
  settlement_time?: string;
  va_numbers?: Array<{ bank: string; va_number: string }>;
  permata_va_number?: string;
}

// Always 200 so Midtrans stops retrying a payload we've consciously handled/ignored.
const ok = (body: Record<string, unknown>) => NextResponse.json(body, { status: 200 });

export async function POST(request: NextRequest) {
  let p: Notification;
  try {
    p = (await request.json()) as Notification;
  } catch {
    return ok({ ignored: 'bad json' });
  }

  const { order_id, status_code, gross_amount, signature_key, transaction_status } = p;
  if (!order_id || !status_code || !gross_amount) return ok({ ignored: 'missing fields' });

  const { serverKey } = await getMidtransRuntime();
  if (!verifySignature({ order_id, status_code, gross_amount, signature_key }, serverKey)) {
    console.warn('[midtrans] signature mismatch for order', order_id);
    return ok({ ignored: 'bad signature' });
  }

  const newStatus = mapStatus(transaction_status ?? '', p.fraud_status);
  const settled = newStatus === PaymentTxnStatus.SETTLEMENT;
  const paidAtVal = settled ? (p.settlement_time ? new Date(p.settlement_time) : new Date()) : null;

  const payment = await prisma.payment.findUnique({ where: { orderId: order_id } });
  if (payment) {
    const vaNumber = p.va_numbers?.[0]?.va_number ?? p.permata_va_number ?? null;
    await prisma.payment.update({
      where: { orderId: order_id },
      data: {
        status: newStatus,
        method: mapMethod(p.payment_type),
        vaNumber: vaNumber ?? payment.vaNumber,
        transactionId: p.transaction_id ?? payment.transactionId,
        paidAt: paidAtVal ?? payment.paidAt,
        raw: p as object,
      },
    });
    const entryStatus = await recomputeEntryPaymentStatus(payment.entryId);
    await logAudit({
      actor: null, action: 'UPDATE', entity: 'Entry', entityId: payment.entryId,
      label: `Pembayaran ${order_id} → ${transaction_status} (entry: ${entryStatus})`,
      after: { orderId: order_id, status: newStatus, grossAmount: gross_amount, method: p.payment_type, transactionId: p.transaction_id },
    });
    revalidatePath('/sales');
    revalidatePath('/admin');
    return ok({ received: true, status: newStatus });
  }

  // Not an entry payment — maybe a sales setoran (same gateway).
  const setoran = await prisma.setoran.findUnique({ where: { orderId: order_id } });
  if (setoran) {
    await prisma.setoran.update({
      where: { orderId: order_id },
      data: {
        status: settled ? 'PAID' : 'PENDING',
        transactionId: p.transaction_id ?? setoran.transactionId,
        paidAt: paidAtVal ?? setoran.paidAt,
      },
    });
    await logAudit({
      actor: null, action: 'UPDATE', entity: 'Profile', entityId: setoran.salesId,
      label: `Setoran ${order_id} → ${transaction_status}`,
      after: { orderId: order_id, status: settled ? 'PAID' : 'PENDING', amount: setoran.amount },
    });
    revalidatePath('/sales');
    revalidatePath('/admin');
    return ok({ received: true, kind: 'setoran', status: newStatus });
  }

  return ok({ ignored: 'unknown order' });
}
