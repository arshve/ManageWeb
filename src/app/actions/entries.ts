'use server';

import { prisma } from '@/lib/prisma';
import { requireAuth, requireRole } from '@/lib/auth';
import { revalidatePath } from 'next/cache';
import { generateInvoiceNo } from '@/lib/format';
import { supabaseAdmin } from '@/lib/supabase';
import { logAudit } from '@/lib/audit';

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

interface RawItem {
  livestockId: string;
  hargaJual: number;
  hargaModal?: number | null;
  resellerCut?: number | null;
  tag?: string | null;
}

export async function createEntry(formData: FormData) {
  const profile = await requireAuth();

  const itemsJson = formData.get('items')?.toString();
  if (!itemsJson) return { error: 'Pilih hewan terlebih dahulu' };

  let rawItems: RawItem[];
  try {
    rawItems = JSON.parse(itemsJson);
  } catch {
    return { error: 'Data hewan tidak valid' };
  }
  if (!Array.isArray(rawItems) || rawItems.length === 0) {
    return { error: 'Pilih minimal satu hewan' };
  }

  // Validate all livestock exist, not sold, not already linked
  const livestockIds = rawItems.map((i) => i.livestockId);
  const [allLivestock, existingItems] = await Promise.all([
    prisma.livestock.findMany({ where: { id: { in: livestockIds } } }),
    prisma.entryItem.findMany({ where: { livestockId: { in: livestockIds } } }),
  ]);

  if (existingItems.length > 0) {
    return { error: 'Satu atau lebih hewan sudah memiliki entry penjualan' };
  }
  for (const raw of rawItems) {
    const lv = allLivestock.find((l) => l.id === raw.livestockId);
    if (!lv || lv.isSold) {
      return { error: `Hewan ${raw.livestockId} tidak tersedia atau sudah terjual` };
    }
  }

  let salesId = profile.id;
  let status: 'PENDING' | 'APPROVED' = 'PENDING';
  let approvedAt: Date | null = null;
  let approvedBy: string | null = null;

  if (profile.role === 'ADMIN' || profile.role === 'SUPER_ADMIN') {
    const adminSelectedSalesId = formData.get('salesId')?.toString().trim();
    if (adminSelectedSalesId) {
      const salesExists = await prisma.profile.findUnique({
        where: { id: adminSelectedSalesId },
      });
      if (!salesExists) {
        return { error: 'Akun sales yang dipilih tidak valid atau sudah dihapus.' };
      }
      salesId = adminSelectedSalesId;
    } else {
      salesId = profile.id;
    }
    status = 'APPROVED';
    approvedAt = new Date();
    approvedBy = profile.id;
  }

  // Build per-item create data with computed hpp/profit
  const itemsCreate = rawItems.map((raw) => {
    const hargaJual = raw.hargaJual || 0;
    const hargaModal = raw.hargaModal ?? null;
    const resellerCut = raw.resellerCut ?? null;
    const hpp = hargaModal !== null ? hargaModal + (resellerCut ?? 0) : null;
    const profit = hpp !== null ? hargaJual - hpp : null;
    return { livestockId: raw.livestockId, hargaJual, hargaModal, resellerCut, hpp, profit };
  });

  const entry = await prisma.$transaction(async (tx) => {
    const created = await tx.entry.create({
      data: {
        invoiceNo: generateInvoiceNo(),
        salesId,
        status,
        dp: formData.get('dp') ? Number(formData.get('dp')) : null,
        totalBayar: formData.get('totalBayar') ? Number(formData.get('totalBayar')) : null,
        paymentStatus:
          (formData.get('paymentStatus') as 'BELUM_BAYAR' | 'DP' | 'LUNAS') || 'BELUM_BAYAR',
        buyerName: formData.get('buyerName') as string,
        buyerPhone: (formData.get('buyerPhone') as string) || null,
        buyerAddress: (formData.get('buyerAddress') as string) || null,
        buyerMaps: (formData.get('buyerMaps') as string) || null,
        pengiriman:
          (formData.get('pengiriman') as 'HARI_H' | 'H_1' | 'H_2' | 'H_3' | 'TITIP_POTONG') || null,
        notes: (formData.get('notes') as string) || null,
        buktiTransfer: formData.getAll('buktiTransfer') as string[],
        approvedAt,
        approvedBy,
        items: { create: itemsCreate },
      },
    });

    // Update livestock: tag + isSold
    for (const raw of rawItems) {
      const update: Record<string, unknown> = {};
      if (raw.tag) update.tag = raw.tag;
      if (status === 'APPROVED') update.isSold = true;
      if (Object.keys(update).length > 0) {
        await tx.livestock.update({ where: { id: raw.livestockId }, data: update });
      }
    }

    return created;
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
  revalidatePath('/catalogue');
  return { success: true, entryId: entry.id };
}

export async function approveEntry(id: string) {
  const admin = await requireRole('ADMIN', 'SUPER_ADMIN');

  const entry = await prisma.entry.findUnique({
    where: { id },
    include: { items: true },
  });
  if (!entry) return { error: 'Entry tidak ditemukan' };

  const livestockIds = entry.items.map((i) => i.livestockId);

  const [updated] = await prisma.$transaction([
    prisma.entry.update({
      where: { id },
      data: { status: 'APPROVED', approvedAt: new Date(), approvedBy: admin.id },
    }),
    prisma.livestock.updateMany({
      where: { id: { in: livestockIds } },
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

export async function rejectEntry(id: string) {
  const admin = await requireRole('ADMIN', 'SUPER_ADMIN');

  const entry = await prisma.entry.findUnique({ where: { id } });
  if (!entry) return { error: 'Entry tidak ditemukan' };

  await prisma.entry.update({ where: { id }, data: { status: 'REJECTED' } });

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

export async function updateEntry(id: string, formData: FormData) {
  const profile = await requireAuth();

  const entry = await prisma.entry.findUnique({
    where: { id },
    include: { items: { include: { livestock: true } } },
  });
  if (!entry) return { error: 'Entry tidak ditemukan' };

  if (
    profile.role !== 'ADMIN' &&
    profile.role !== 'SUPER_ADMIN' &&
    entry.salesId !== profile.id
  ) {
    return { error: 'Anda tidak berhak mengubah entry ini' };
  }

  const submittedBukti = formData.getAll('buktiTransfer') as string[];
  const buktiTransferCleared = formData.get('buktiTransferCleared') === 'true';
  const buktiTransfer =
    submittedBukti.length > 0
      ? submittedBukti
      : buktiTransferCleared
        ? []
        : entry.buktiTransfer;

  // Parse per-item pricing submitted from the edit form
  const itemPricesJson = formData.get('itemPrices')?.toString();
  const itemPrices: Array<{
    id: string;
    hargaJual: string;
    hargaModal: string;
    resellerCut: string;
    tag: string;
  }> = itemPricesJson ? JSON.parse(itemPricesJson) : [];

  const updated = await prisma.$transaction(async (tx) => {
    const u = await tx.entry.update({
      where: { id },
      data: {
        dp: formData.get('dp') ? Number(formData.get('dp')) : null,
        totalBayar: formData.get('totalBayar') ? Number(formData.get('totalBayar')) : null,
        paymentStatus:
          (formData.get('paymentStatus') as 'BELUM_BAYAR' | 'DP' | 'LUNAS') ||
          entry.paymentStatus,
        buyerName: (formData.get('buyerName') as string) || entry.buyerName,
        buyerPhone: (formData.get('buyerPhone') as string) || null,
        buyerAddress: (formData.get('buyerAddress') as string) || null,
        buyerMaps: (formData.get('buyerMaps') as string) || null,
        pengiriman:
          (formData.get('pengiriman') as 'HARI_H' | 'H_1' | 'H_2' | 'H_3' | 'TITIP_POTONG') || null,
        notes: (formData.get('notes') as string) || null,
        isSent: formData.get('isSent') === 'true',
        buktiTransfer,
        ...((profile.role === 'ADMIN' || profile.role === 'SUPER_ADMIN') && formData.get('salesId')
          ? { salesId: formData.get('salesId') as string }
          : {}),
      },
    });

    // Update each item's pricing + livestock tag
    for (const ip of itemPrices) {
      const entryItem = entry.items.find((i) => i.id === ip.id);
      if (!entryItem) continue;
      const hargaJual = Number(ip.hargaJual) || entryItem.hargaJual;
      const hargaModal = ip.hargaModal ? Number(ip.hargaModal) : entryItem.hargaModal;
      const resellerCut = ip.resellerCut ? Number(ip.resellerCut) : entryItem.resellerCut;
      const hpp = hargaModal !== null ? hargaModal + (resellerCut ?? 0) : null;
      const profit = hpp !== null ? hargaJual - hpp : null;
      await tx.entryItem.update({
        where: { id: ip.id },
        data: { hargaJual, hargaModal, resellerCut, hpp, profit },
      });
      await tx.livestock.update({
        where: { id: entryItem.livestockId },
        data: { tag: ip.tag || null, ...(hargaModal !== null ? { hargaModal } : {}) },
      });
    }

    return u;
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

  const removedUrls = entry.buktiTransfer.filter(
    (url) => !buktiTransfer.includes(url),
  );
  await deleteStorageFiles(removedUrls);

  revalidatePath('/admin');
  revalidatePath('/sales');
  revalidatePath('/catalogue');
  return { success: true };
}

export async function deleteEntry(id: string) {
  const profile = await requireAuth();

  const entry = await prisma.entry.findUnique({
    where: { id },
    include: { items: true },
  });
  if (!entry) return { error: 'Entry tidak ditemukan' };

  if (
    profile.role !== 'ADMIN' &&
    profile.role !== 'SUPER_ADMIN' &&
    entry.salesId !== profile.id
  ) {
    return { error: 'Anda tidak berhak mengubah entry ini' };
  }

  const livestockIds = entry.items.map((i) => i.livestockId);

  await prisma.$transaction([
    prisma.entry.delete({ where: { id } }),
    prisma.livestock.updateMany({
      where: { id: { in: livestockIds } },
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

  await deleteStorageFiles(entry.buktiTransfer);

  revalidatePath('/admin');
  revalidatePath('/sales');
  return { success: true };
}
