/**
 * Server Actions: Sale Entries
 *
 * These are server-side functions called directly from React components.
 * They handle CRUD operations for sale entries (data penjualan).
 *
 * Entry lifecycle:
 *   Sales creates entry (PENDING) → Admin approves (APPROVED) or rejects (REJECTED)
 *   When approved, the linked livestock is automatically marked as sold.
 *   When deleted, the livestock is automatically unmarked (available again).
 */

'use server';

import { prisma } from '@/lib/prisma';
import { requireAuth, requireRole } from '@/lib/auth';
import { revalidatePath } from 'next/cache';
import { generateInvoiceNo } from '@/lib/format';
import { supabaseAdmin } from '@/lib/supabase';
import { logAudit } from '@/lib/audit';
import type { AnimalType, AnimalGrade } from '@/generated/prisma/client';

/**
 * Deletes files from Supabase Storage given their public URLs.
 * Extracts the storage path from the URL and calls the admin client.
 * Only runs in production — dev uses local disk.
 */
async function deleteStorageFiles(urls: string[]) {
  if (process.env.NODE_ENV === 'development' || urls.length === 0) return;
  const paths = urls
    .map((url) => {
      const match = url.match(/\/object\/public\/uploads\/(.+)$/);
      return match ? match[1] : null;
    })
    .filter(Boolean) as string[];
  if (paths.length > 0) {
    const { error } = await supabaseAdmin.storage.from('uploads').remove(paths);
    if (error) console.error('Storage cleanup error:', error);
  }
}

/**
 * Creates a new sale entry. Called by sales persons from the "Tambah Entry" form.
 *
 * Flow:
 * 1. Verifies the user is logged in
 * 2. Checks the selected livestock exists and is not already sold
 * 3. Looks up pricing table to auto-fill hargaModal (buy price)
 * 4. Calculates HPP (cost of goods sold) = hargaModal + resellerCut
 * 5. Calculates profit = hargaJual - HPP
 * 6. Creates the entry with PENDING status (awaiting admin approval)
 *
 * @param formData - Form data with livestockId, buyerName, hargaJual, etc.
 * @returns { success, entryId } or { error }
 */
export async function createEntry(formData: FormData) {
  const profile = await requireAuth();

  const livestockId = formData.get('livestockId') as string;

  const livestock = await prisma.livestock.findUnique({
    where: { id: livestockId },
  });

  const existingEntry = await prisma.entry.findUnique({
    where: { livestockId },
  });

  if (existingEntry) {
    return {
      error: 'Hewan ini sudah memiliki entry penjualan (Pending/Approved)!',
    };
  }

  if (!livestock || livestock.isSold) {
    return { error: 'Hewan tidak tersedia atau sudah terjual' };
  }

  // Look up pricing for auto-fill of hargaModal (buy price from pricing table).
  // Sapi has no grade, so pricing lookup is skipped — admin enters hargaModal manually.
  const pricing =
    livestock.grade != null
      ? await prisma.pricing.findUnique({
          where: {
            animalType_grade: {
              animalType: livestock.type,
              grade: livestock.grade,
            },
          },
        })
      : null;

  // Calculate financials — prefer livestock.hargaJual (per-animal), fall back to pricing table
  const hargaJual =
    Number(formData.get('hargaJual')) ||
    livestock.hargaJual ||
    pricing?.hargaJual ||
    0;
  const hargaModal = pricing?.hargaBeli ?? null;
  const resellerCut = formData.get('resellerCut')
    ? Number(formData.get('resellerCut'))
    : null;
  const hpp = hargaModal ? hargaModal + (resellerCut ?? 0) : null;
  const profit = hpp !== null ? hargaJual - hpp : null;

  const entry = await prisma.entry.create({
    data: {
      invoiceNo: generateInvoiceNo(),
      livestockId,
      salesId: profile.id,
      hargaJual,
      hargaModal,
      resellerCut,
      hpp,
      profit,
      dp: formData.get('dp') ? Number(formData.get('dp')) : null,
      totalBayar: formData.get('totalBayar')
        ? Number(formData.get('totalBayar'))
        : null,
      paymentStatus:
        (formData.get('paymentStatus') as 'BELUM_BAYAR' | 'DP' | 'LUNAS') ||
        'BELUM_BAYAR',
      buyerName: formData.get('buyerName') as string,
      buyerPhone: (formData.get('buyerPhone') as string) || null,
      buyerWa: (formData.get('buyerWa') as string) || null,
      buyerAddress: (formData.get('buyerAddress') as string) || null,
      buyerMaps: (formData.get('buyerMaps') as string) || null,
      notes: (formData.get('notes') as string) || null,
      buktiTransfer: formData.getAll('buktiTransfer') as string[],
    },
  });

  await logAudit({
    actor: profile,
    action: 'CREATE',
    entity: 'Entry',
    entityId: entry.id,
    label: `${entry.invoiceNo} — ${entry.buyerName}`,
    after: entry,
  });

  revalidatePath('/sales');
  revalidatePath('/admin');
  return { success: true, entryId: entry.id };
}

/**
 * Approves a pending entry. Admin-only.
 * Uses a database transaction to atomically:
 * 1. Update the entry status to APPROVED with timestamp and approver ID
 * 2. Mark the linked livestock as sold (isSold=true)
 *
 * This ensures both operations succeed or both fail — you can't have
 * an approved entry with unsold livestock or vice versa.
 *
 * @param id - The entry ID to approve
 * @returns { success } or { error }
 */
export async function approveEntry(id: string) {
  const admin = await requireRole('ADMIN');

  const entry = await prisma.entry.findUnique({ where: { id } });
  if (!entry) return { error: 'Entry tidak ditemukan' };

  const [updated] = await prisma.$transaction([
    prisma.entry.update({
      where: { id },
      data: {
        status: 'APPROVED',
        approvedAt: new Date(),
        approvedBy: admin.id,
      },
    }),
    prisma.livestock.update({
      where: { id: entry.livestockId },
      data: { isSold: true },
    }),
  ]);

  await logAudit({
    actor: admin,
    action: 'UPDATE',
    entity: 'Entry',
    entityId: id,
    label: `${entry.invoiceNo} — approve`,
    before: { status: entry.status },
    after: { status: updated.status, approvedBy: admin.id },
  });

  revalidatePath('/admin');
  revalidatePath('/sales');
  revalidatePath('/catalogue');
  return { success: true };
}

/**
 * Rejects a pending entry. Admin-only.
 * Simply sets the status to REJECTED. The livestock remains available
 * for sale since it was never marked as sold.
 *
 * @param id - The entry ID to reject
 * @returns { success } or { error }
 */
export async function rejectEntry(id: string) {
  const admin = await requireRole('ADMIN');

  const entry = await prisma.entry.findUnique({ where: { id } });
  if (!entry) return { error: 'Entry tidak ditemukan' };

  await prisma.entry.update({
    where: { id },
    data: { status: 'REJECTED' },
  });

  await logAudit({
    actor: admin,
    action: 'UPDATE',
    entity: 'Entry',
    entityId: id,
    label: `${entry.invoiceNo} — reject`,
    before: { status: entry.status },
    after: { status: 'REJECTED' },
  });

  revalidatePath('/admin');
  revalidatePath('/sales');
  return { success: true };
}

/**
 * Updates an existing entry's details. Admin-only.
 * Admin can edit buyer info, pricing, payment status, delivery status, etc.
 * Recalculates HPP and profit based on updated values.
 *
 * @param id - The entry ID to update
 * @param formData - Updated form data
 * @returns { success } or { error }
 */
export async function updateEntry(id: string, formData: FormData) {
  const profile = await requireAuth();

  const entry = await prisma.entry.findUnique({ where: { id } });
  if (!entry) return { error: 'Entry tidak ditemukan' };

  if (profile.role !== 'ADMIN' && entry.salesId !== profile.id) {
    return { error: 'Anda tidak berhak mengubah entry ini' };
  }

  // Recalculate financials with updated values
  const hargaJual = Number(formData.get('hargaJual')) || entry.hargaJual;
  const hargaModal = formData.get('hargaModal')
    ? Number(formData.get('hargaModal'))
    : entry.hargaModal;
  const resellerCut = formData.get('resellerCut')
    ? Number(formData.get('resellerCut'))
    : entry.resellerCut;
  const hpp = hargaModal !== null ? hargaModal + (resellerCut ?? 0) : null;
  const profit = hpp !== null ? hargaJual - hpp : null;

  // buktiTransfer: use submitted URLs, or [] if explicitly cleared, or keep existing
  const submittedBukti = formData.getAll('buktiTransfer') as string[];
  const buktiTransferCleared = formData.get('buktiTransferCleared') === 'true';
  const buktiTransfer =
    submittedBukti.length > 0
      ? submittedBukti
      : buktiTransferCleared
        ? []
        : entry.buktiTransfer;

  const updated = await prisma.entry.update({
    where: { id },
    data: {
      hargaJual,
      hargaModal,
      resellerCut,
      hpp,
      profit,
      dp: formData.get('dp') ? Number(formData.get('dp')) : null,
      totalBayar: formData.get('totalBayar')
        ? Number(formData.get('totalBayar'))
        : null,
      paymentStatus:
        (formData.get('paymentStatus') as 'BELUM_BAYAR' | 'DP' | 'LUNAS') ||
        entry.paymentStatus,
      buyerName: (formData.get('buyerName') as string) || entry.buyerName,
      buyerPhone: (formData.get('buyerPhone') as string) || null,
      buyerWa: (formData.get('buyerWa') as string) || null,
      buyerAddress: (formData.get('buyerAddress') as string) || null,
      buyerMaps: (formData.get('buyerMaps') as string) || null,
      notes: (formData.get('notes') as string) || null,
      isSent: formData.get('isSent') === 'true',
      buktiTransfer,
    },
  });

  await logAudit({
    actor: profile,
    action: 'UPDATE',
    entity: 'Entry',
    entityId: id,
    label: `${entry.invoiceNo} — ${entry.buyerName}`,
    before: entry,
    after: updated,
  });

  // Delete removed photos from storage (diff between old and new URL list)
  const removedUrls = entry.buktiTransfer.filter((url) => !buktiTransfer.includes(url));
  await deleteStorageFiles(removedUrls);

  revalidatePath('/admin');
  revalidatePath('/sales');
  return { success: true };
}

/**
 * Deletes an entry and marks the linked livestock as available again.
 * Admin-only. Uses a transaction to ensure consistency.
 *
 * @param id - The entry ID to delete
 * @returns { success } or { error }
 */
export async function deleteEntry(id: string) {
  const profile = await requireAuth();

  const entry = await prisma.entry.findUnique({ where: { id } });
  if (!entry) return { error: 'Entry tidak ditemukan' };

  if (profile.role !== 'ADMIN' && entry.salesId !== profile.id) {
    return { error: 'Anda tidak berhak mengubah entry ini' };
  }

  // Transaction: delete entry + mark livestock as available again
  await prisma.$transaction([
    prisma.entry.delete({ where: { id } }),
    prisma.livestock.update({
      where: { id: entry.livestockId },
      data: { isSold: false },
    }),
  ]);

  await logAudit({
    actor: profile,
    action: 'DELETE',
    entity: 'Entry',
    entityId: id,
    label: `${entry.invoiceNo} — ${entry.buyerName}`,
    before: entry,
  });

  // Delete all bukti transfer photos from storage
  await deleteStorageFiles(entry.buktiTransfer);

  revalidatePath('/admin');
  revalidatePath('/sales');
  return { success: true };
}
