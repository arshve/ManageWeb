'use server';

// Sales → company remittance (setoran). Running balance per sales:
//   owed       = Σ totalBayar of APPROVED entries collected by the sales (collectedBy=SALES)
//   paid       = Σ amount of PAID setoran
//   outstanding= owed − paid
// Sales settle via the same Midtrans gateway (money to the company account) or
// the admin marks a manual hand-over as paid.

import crypto from 'node:crypto';
import { prisma } from '@/lib/prisma';
import { requireAuth, requireRole, isAdminRole } from '@/lib/auth';
import { logAudit } from '@/lib/audit';
import { revalidatePath } from 'next/cache';
import { getSnap, toRupiah, ENABLED_PAYMENTS, midtransConfigured, isMockPayment } from '@/lib/payments/midtrans';

export interface SalesBalance {
  salesId: string;
  name: string;
  owed: number;
  paid: number;
  outstanding: number;
}

function newSetoranOrderId(): string {
  return `STR-${crypto.randomBytes(5).toString('hex')}`;
}

// What the sales has actually collected from the buyer on a sales-collected entry:
// LUNAS → full totalBayar, DP → the down payment, BELUM_BAYAR → nothing yet.
// Approval status is irrelevant — the sales holds the cash once the buyer pays.
// (Rejected entries are auto-deleted, so they drop out on their own.)
function collectedAmount(e: { paymentStatus: string; totalBayar: number | null; dp: number | null }): number {
  if (e.paymentStatus === 'LUNAS') return e.totalBayar ?? 0;
  if (e.paymentStatus === 'DP') return e.dp ?? 0;
  return 0;
}

async function computeOwed(salesId: string): Promise<number> {
  const entries = await prisma.entry.findMany({
    where: { salesId, collectedBy: 'SALES' },
    select: { totalBayar: true, dp: true, paymentStatus: true },
  });
  return entries.reduce((s, e) => s + collectedAmount(e), 0);
}

async function computePaid(salesId: string): Promise<number> {
  const agg = await prisma.setoran.aggregate({
    _sum: { amount: true },
    where: { salesId, status: 'PAID' },
  });
  return agg._sum.amount ?? 0;
}

/** Balance for one sales (used on the sales page + before charging). */
export async function getSalesBalance(salesId: string): Promise<{ owed: number; paid: number; outstanding: number }> {
  const [owed, paid] = await Promise.all([computeOwed(salesId), computePaid(salesId)]);
  return { owed, paid, outstanding: Math.max(0, owed - paid) };
}

/** All sales with a balance (admin overview). */
export async function getAllSalesBalances(): Promise<SalesBalance[]> {
  const [entries, paidRows] = await Promise.all([
    prisma.entry.findMany({ where: { collectedBy: 'SALES' }, select: { salesId: true, totalBayar: true, dp: true, paymentStatus: true } }),
    prisma.setoran.groupBy({ by: ['salesId'], _sum: { amount: true }, where: { status: 'PAID' } }),
  ]);
  const owed = new Map<string, number>();
  for (const e of entries) owed.set(e.salesId, (owed.get(e.salesId) ?? 0) + collectedAmount(e));
  const paid = new Map(paidRows.map((r) => [r.salesId, r._sum.amount ?? 0]));
  const ids = [...new Set([...owed.keys(), ...paid.keys()])];
  if (ids.length === 0) return [];
  const names = await prisma.profile.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } });
  const nameMap = new Map(names.map((n) => [n.id, n.name]));
  return ids
    .map((id) => {
      const o = owed.get(id) ?? 0;
      const p = paid.get(id) ?? 0;
      return { salesId: id, name: nameMap.get(id) ?? id, owed: o, paid: p, outstanding: o - p };
    })
    .sort((a, b) => b.outstanding - a.outstanding);
}

/**
 * Sales pays (part of) their setoran via the Midtrans gateway. Money lands in the
 * company account; the webhook (or mock) marks the Setoran PAID.
 */
export async function createSetoranPayment(amount: number) {
  const profile = await requireAuth();
  if (!(await midtransConfigured()) && !(await isMockPayment())) return { error: 'Pembayaran online belum aktif.' };

  const { outstanding } = await getSalesBalance(profile.id);
  const gross = toRupiah(amount);
  if (!Number.isFinite(gross) || gross <= 0) return { error: 'Nominal tidak valid' };
  if (outstanding <= 0) return { error: 'Tidak ada setoran tertunggak.' };
  if (gross > toRupiah(outstanding)) return { error: `Nominal melebihi sisa setoran (Rp ${toRupiah(outstanding).toLocaleString('id-ID')})` };

  const orderId = newSetoranOrderId();
  await prisma.setoran.create({
    data: { salesId: profile.id, amount: gross, method: 'GATEWAY', status: 'PENDING', orderId },
  });
  await logAudit({
    actor: { id: profile.id, name: profile.name }, action: 'CREATE', entity: 'Profile', entityId: profile.id,
    label: `Setoran ${orderId} — Rp ${gross.toLocaleString('id-ID')}`,
  });

  if (await isMockPayment()) {
    return { success: true, mock: true, redirectUrl: `/mock-pay?order=${encodeURIComponent(orderId)}&return=${encodeURIComponent('/sales/setoran')}` };
  }
  try {
    const tx = await (await getSnap()).createTransaction({
      transaction_details: { order_id: orderId, gross_amount: gross },
      item_details: [{ id: 'setoran', price: gross, quantity: 1, name: 'Setoran ke perusahaan' }],
      customer_details: { first_name: profile.name },
      enabled_payments: ENABLED_PAYMENTS,
    });
    return { success: true, token: tx.token, redirectUrl: tx.redirect_url };
  } catch (e) {
    console.error('[setoran] createTransaction failed', e);
    await prisma.setoran.delete({ where: { orderId } }).catch(() => {});
    return { error: 'Gagal membuat transaksi setoran' };
  }
}

/** Admin records a manual hand-over (cash/transfer) as paid. */
export async function markSetoranPaid(salesId: string, amount: number, note?: string) {
  const admin = await requireRole('ADMIN', 'SUPER_ADMIN', 'OWNER');
  const gross = toRupiah(amount);
  if (!Number.isFinite(gross) || gross <= 0) return { error: 'Nominal tidak valid' };

  await prisma.setoran.create({
    data: { salesId, amount: gross, method: 'MANUAL', status: 'PAID', paidAt: new Date(), recordedById: admin.id, note: note || null },
  });
  await logAudit({
    actor: admin, action: 'CREATE', entity: 'Profile', entityId: salesId,
    label: `Setoran manual — Rp ${gross.toLocaleString('id-ID')}${note ? ` (${note})` : ''}`,
  });
  revalidatePath('/admin/setoran');
  revalidatePath('/sales/setoran');
  return { success: true };
}
