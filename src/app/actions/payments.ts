'use server';

import crypto from 'node:crypto';
import { prisma } from '@/lib/prisma';
import { requireAuth, isAdminRole } from '@/lib/auth';
import { generateInvoiceNo } from '@/lib/format';
import { logAudit } from '@/lib/audit';
import { revalidatePath } from 'next/cache';
import { PaymentTxnStatus } from '@/generated/prisma/client';
import { getSnap, toRupiah, ENABLED_PAYMENTS, midtransConfigured, isMockPayment, mapMethod, recomputeEntryPaymentStatus } from '@/lib/payments/midtrans';
import { getAppConfig } from '@/lib/config/get-config';
import { parseLatLngFromMapsUrl } from '@/lib/delivery/geocode';

// Mock-mode redirect target: a local page that simulates the Snap outcome.
function mockRedirect(orderId: string, returnPath: string): string {
  return `/mock-pay?order=${encodeURIComponent(orderId)}&return=${encodeURIComponent(returnPath)}`;
}

const PENGIRIMAN_VALUES = ['HARI_H', 'H_1', 'H_2', 'H_3', 'H_PLUS_1', 'H_PLUS_2', 'H_PLUS_3', 'TITIP_POTONG'] as const;
type Pengiriman = (typeof PENGIRIMAN_VALUES)[number];

// Online payment requires the owner toggle (config) plus either Midtrans keys
// (live) or mock mode (demo).
async function paymentReady(): Promise<boolean> {
  if (!(await midtransConfigured()) && !(await isMockPayment())) return false;
  const cfg = await getAppConfig();
  return cfg.paymentEnabled;
}

// Midtrans order_id: unique per charge, <=50 chars, [A-Za-z0-9._-].
function newOrderId(invoiceNo: string): string {
  return `${invoiceNo}-${crypto.randomBytes(3).toString('hex')}`;
}

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? '';
const finishCallback = (path: string) => (APP_URL ? { callbacks: { finish: `${APP_URL}${path}` } } : {});

/**
 * Sales/admin: open a Midtrans charge against an existing entry. `amount` lets
 * the operator collect a DP or the full balance. Returns the Snap token for the
 * in-app popup. Amount is clamped to the entry's outstanding balance server-side.
 */
export async function createPayment(entryId: string, amount: number) {
  const profile = await requireAuth();
  if (!(await paymentReady())) return { error: 'Pembayaran online belum aktif.' };

  const entry = await prisma.entry.findUnique({
    where: { id: entryId },
    select: {
      id: true, invoiceNo: true, salesId: true, buyerName: true, buyerPhone: true,
      totalBayar: true,
      payments: { where: { status: PaymentTxnStatus.SETTLEMENT }, select: { grossAmount: true } },
    },
  });
  if (!entry) return { error: 'Entry tidak ditemukan' };
  if (!isAdminRole(profile.role) && entry.salesId !== profile.id) {
    return { error: 'Tidak diizinkan menagih entry ini' };
  }

  const total = entry.totalBayar ?? 0;
  if (total <= 0) return { error: 'Total bayar entry belum diisi' };
  const settled = entry.payments.reduce((s, p) => s + p.grossAmount, 0);
  const outstanding = total - settled;
  if (outstanding <= 0) return { error: 'Entry sudah lunas' };

  const gross = toRupiah(amount);
  if (!Number.isFinite(gross) || gross <= 0) return { error: 'Nominal tidak valid' };
  if (gross > toRupiah(outstanding)) return { error: `Nominal melebihi sisa tagihan (Rp ${toRupiah(outstanding).toLocaleString('id-ID')})` };

  const orderId = newOrderId(entry.invoiceNo);

  // MOCK: skip Midtrans, point at the local simulator page.
  if (await isMockPayment()) {
    await prisma.payment.create({ data: { entryId: entry.id, orderId, grossAmount: gross } });
    await logAudit({
      actor: { id: profile.id, name: profile.name },
      action: 'UPDATE', entity: 'Entry', entityId: entry.id,
      label: `Tagihan (mock) ${orderId} — Rp ${gross.toLocaleString('id-ID')}`,
    });
    return { success: true, token: null, redirectUrl: mockRedirect(orderId, '/sales'), orderId, mock: true };
  }

  try {
    const tx = await (await getSnap()).createTransaction({
      transaction_details: { order_id: orderId, gross_amount: gross },
      item_details: [{ id: entry.id, price: gross, quantity: 1, name: `Pembayaran ${entry.invoiceNo}`.slice(0, 50) }],
      customer_details: { first_name: entry.buyerName, phone: entry.buyerPhone ?? undefined },
      enabled_payments: ENABLED_PAYMENTS,
      ...finishCallback('/sales'),
    });

    await prisma.payment.create({ data: { entryId: entry.id, orderId, grossAmount: gross } });
    await logAudit({
      actor: { id: profile.id, name: profile.name },
      action: 'UPDATE', entity: 'Entry', entityId: entry.id,
      label: `Tagihan ${orderId} — Rp ${gross.toLocaleString('id-ID')}`,
    });

    return { success: true, token: tx.token, redirectUrl: tx.redirect_url, orderId };
  } catch (e) {
    console.error('[midtrans] createTransaction failed', e);
    return { error: 'Gagal membuat transaksi pembayaran' };
  }
}

/**
 * Public (no login): a direct customer orders one animal from /catalogue and
 * pays online. Creates a PENDING entry under the house-sales account, then a
 * full-amount Midtrans charge, and returns the hosted Snap redirect URL.
 *
 * SECURITY: reachable via direct POST. The amount is computed from the DB price,
 * never the client. Availability is guarded by the EntryItem.livestockId @unique
 * lock (second concurrent order fails at create — no double-sell).
 */
export async function createPublicOrder(formData: FormData) {
  if (!(await paymentReady())) return { error: 'Pembayaran online belum tersedia.' };

  // Cart: a JSON array of livestock IDs.
  let livestockIds: string[];
  try {
    const parsed = JSON.parse((formData.get('items') as string) ?? '[]');
    livestockIds = Array.isArray(parsed) ? [...new Set(parsed.map(String))] : [];
  } catch {
    return { error: 'Keranjang tidak valid' };
  }
  const buyerName = (formData.get('buyerName') as string)?.trim();
  const buyerPhone = (formData.get('buyerPhone') as string)?.trim() || null;
  const buyerAddress = (formData.get('buyerAddress') as string)?.trim() || null;
  const buyerMaps = (formData.get('buyerMaps') as string)?.trim() || null;
  const pengirimanRaw = (formData.get('pengiriman') as string)?.trim() || '';
  const pengiriman: Pengiriman | null = PENGIRIMAN_VALUES.includes(pengirimanRaw as Pengiriman)
    ? (pengirimanRaw as Pengiriman) : null;

  // Delivery-critical fields are mandatory for a public order.
  if (livestockIds.length === 0) return { error: 'Keranjang kosong' };
  if (!buyerName) return { error: 'Nama pemesan wajib diisi' };
  if (!buyerPhone) return { error: 'No. WhatsApp wajib diisi' };
  if (!buyerAddress) return { error: 'Alamat pengiriman wajib diisi' };
  if (!buyerMaps) return { error: 'Titik lokasi (Google Maps) wajib diisi' };

  // Coordinates for the delivery flow: trust submitted GPS coords (from "use my
  // location"); otherwise parse them out of the pasted Maps URL (cheap, no
  // network). If neither yields coords, the delivery flow geocodes later from
  // buyerMaps/buyerAddress.
  const latRaw = Number(formData.get('buyerLat'));
  const lngRaw = Number(formData.get('buyerLng'));
  let buyerLat: number | null = Number.isFinite(latRaw) && latRaw !== 0 ? latRaw : null;
  let buyerLng: number | null = Number.isFinite(lngRaw) && lngRaw !== 0 ? lngRaw : null;
  if (buyerLat === null || buyerLng === null) {
    const parsed = parseLatLngFromMapsUrl(buyerMaps);
    if (parsed) { buyerLat = parsed.lat; buyerLng = parsed.lng; }
  }

  // Configurable in Branding & Config (AppConfig.publicSalesId); env is the fallback.
  const cfg = await getAppConfig();
  const salesId = cfg.publicSalesId || process.env.PUBLIC_SALES_ID;
  if (!salesId) return { error: 'Akun penjualan publik belum dikonfigurasi.' };
  const houseSales = await prisma.profile.findUnique({ where: { id: salesId }, select: { id: true } });
  if (!houseSales) return { error: 'Akun penjualan publik tidak valid.' };

  // Availability guard (mirrors createEntry). The @unique on EntryItem.livestockId
  // is the real lock; this just gives a friendly error in the common case.
  const [animals, existingItems] = await Promise.all([
    prisma.livestock.findMany({ where: { id: { in: livestockIds } } }),
    prisma.entryItem.findMany({ where: { livestockId: { in: livestockIds } }, select: { livestockId: true } }),
  ]);
  const claimed = new Set(existingItems.map((i) => i.livestockId));
  const unavailable: string[] = [];
  for (const id of livestockIds) {
    const lv = animals.find((a) => a.id === id);
    if (!lv || lv.isSold || lv.condition !== 'SEHAT' || claimed.has(id) || !lv.hargaJual || lv.hargaJual <= 0) {
      unavailable.push(lv?.sku ?? id);
    }
  }
  if (unavailable.length > 0) {
    return { error: `Hewan tidak tersedia lagi: ${unavailable.join(', ')}`, unavailableIds: livestockIds.filter((id) => unavailable.includes(animals.find((a) => a.id === id)?.sku ?? id)) };
  }

  const itemsCreate = livestockIds.map((id) => {
    const lv = animals.find((a) => a.id === id)!;
    return { livestockId: id, hargaJual: lv.hargaJual!, price: toRupiah(lv.hargaJual!), sku: lv.sku };
  });
  // gross must equal the sum of the rounded per-item prices (Midtrans validates this).
  const gross = itemsCreate.reduce((s, i) => s + i.price, 0);
  const invoiceNo = generateInvoiceNo();
  const orderId = newOrderId(invoiceNo);

  // Create the PENDING entry + payment first; if Snap fails we roll back.
  let entryId: string;
  try {
    const entry = await prisma.$transaction(async (tx) => {
      const created = await tx.entry.create({
        data: {
          invoiceNo, salesId, status: 'PENDING', paymentStatus: 'BELUM_BAYAR',
          totalBayar: gross, buyerName, buyerPhone, buyerAddress,
          buyerMaps, buyerLat, buyerLng, pengiriman,
          notes: 'Pesanan online (katalog publik)',
          items: { create: itemsCreate.map((i) => ({ livestockId: i.livestockId, hargaJual: i.hargaJual })) },
        },
        select: { id: true },
      });
      await tx.payment.create({ data: { entryId: created.id, orderId, grossAmount: gross } });
      return created;
    });
    entryId = entry.id;
  } catch {
    // Most likely a livestock got ordered between the guard and here (@unique).
    return { error: 'Sebagian hewan sudah dipesan orang lain, muat ulang katalog.' };
  }

  // MOCK: skip Midtrans, send the buyer to the local simulator page.
  if (await isMockPayment()) {
    await logAudit({
      actor: null, action: 'CREATE', entity: 'Entry', entityId: entryId,
      label: `Pesanan online (mock) ${invoiceNo} — ${buyerName} (${itemsCreate.length} hewan)`,
    });
    revalidatePath('/admin');
    revalidatePath('/catalogue');
    return { success: true, redirectUrl: mockRedirect(orderId, '/catalogue?order=done'), mock: true };
  }

  try {
    const txn = await (await getSnap()).createTransaction({
      transaction_details: { order_id: orderId, gross_amount: gross },
      item_details: itemsCreate.map((i) => ({ id: i.livestockId, price: i.price, quantity: 1, name: `Hewan ${i.sku}`.slice(0, 50) })),
      customer_details: { first_name: buyerName, phone: buyerPhone ?? undefined },
      enabled_payments: ENABLED_PAYMENTS,
      ...finishCallback('/catalogue?order=done'),
    });

    await logAudit({
      actor: null, action: 'CREATE', entity: 'Entry', entityId: entryId,
      label: `Pesanan online ${invoiceNo} — ${buyerName} (${itemsCreate.length} hewan)`,
    });
    revalidatePath('/admin');
    revalidatePath('/catalogue');

    return { success: true, redirectUrl: txn.redirect_url, token: txn.token };
  } catch (e) {
    // Roll back the orphan entry so the animals free up again.
    console.error('[midtrans] public order createTransaction failed', e);
    await prisma.entry.delete({ where: { id: entryId } }).catch(() => {});
    return { error: 'Gagal membuat transaksi pembayaran' };
  }
}

/**
 * MOCK ONLY: stand-in for the Midtrans webhook. Drives a Payment to the chosen
 * outcome and recomputes the entry status — lets you demo the full flow without
 * real keys. Hard-guarded to mock mode so it can never settle a live payment.
 */
export async function mockSettlePayment(orderId: string, outcome: 'settlement' | 'pending' | 'failure') {
  if (!(await isMockPayment())) return { error: 'Mode simulasi tidak aktif.' };

  const status =
    outcome === 'settlement' ? PaymentTxnStatus.SETTLEMENT
    : outcome === 'failure' ? PaymentTxnStatus.FAILED
    : PaymentTxnStatus.PENDING;
  const settled = status === PaymentTxnStatus.SETTLEMENT;
  const mockTxnId = `MOCK-${orderId}`;

  // Entry payment?
  const payment = await prisma.payment.findUnique({ where: { orderId } });
  if (payment) {
    await prisma.payment.update({
      where: { orderId },
      data: {
        status, method: mapMethod('qris'),
        transactionId: mockTxnId,
        paidAt: settled ? new Date() : null,
        raw: { mock: true, outcome },
      },
    });
    const entryStatus = await recomputeEntryPaymentStatus(payment.entryId);
    await logAudit({
      actor: null, action: 'UPDATE', entity: 'Entry', entityId: payment.entryId,
      label: `Pembayaran (mock) ${orderId} → ${outcome} (entry: ${entryStatus})`,
    });
    revalidatePath('/sales');
    revalidatePath('/admin');
    return { success: true, entryStatus };
  }

  // Sales setoran?
  const setoran = await prisma.setoran.findUnique({ where: { orderId } });
  if (setoran) {
    await prisma.setoran.update({
      where: { orderId },
      data: { status: settled ? 'PAID' : 'PENDING', transactionId: mockTxnId, paidAt: settled ? new Date() : null },
    });
    await logAudit({
      actor: null, action: 'UPDATE', entity: 'Profile', entityId: setoran.salesId,
      label: `Setoran (mock) ${orderId} → ${outcome}`,
    });
    revalidatePath('/sales/setoran');
    revalidatePath('/admin/setoran');
    return { success: true };
  }

  return { error: 'Pembayaran tidak ditemukan.' };
}
