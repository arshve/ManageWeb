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

interface RawRequest {
  type: 'KAMBING' | 'DOMBA' | 'SAPI';
  grade?: 'SUPER' | 'A' | 'B' | 'C' | 'D' | null;
  weightMin?: number | null;
  weightMax?: number | null;
  hargaJual: number;
  hargaModal?: number | null;
  resellerCut?: number | null;
  notes?: string | null;
}

function buildEntryBaseData(formData: FormData, salesId: string, status: 'PENDING' | 'APPROVED', approvedAt: Date | null, approvedBy: string | null) {
  return {
    invoiceNo: generateInvoiceNo(),
    salesId,
    status,
    dp: formData.get('dp') ? Number(formData.get('dp')) : null,
    totalBayar: formData.get('totalBayar') ? Number(formData.get('totalBayar')) : null,
    paymentStatus: (formData.get('paymentStatus') as 'BELUM_BAYAR' | 'DP' | 'LUNAS') || 'BELUM_BAYAR',
    buyerName: formData.get('buyerName') as string,
    buyerPhone: (formData.get('buyerPhone') as string) || null,
    buyerAddress: (formData.get('buyerAddress') as string) || null,
    buyerMaps: (formData.get('buyerMaps') as string) || null,
    pengiriman: (formData.get('pengiriman') as 'HARI_H' | 'H_1' | 'H_2' | 'H_3' | 'TITIP_POTONG') || null,
    notes: (formData.get('notes') as string) || null,
    buktiTransfer: formData.getAll('buktiTransfer') as string[],
    approvedAt,
    approvedBy,
  };
}

async function resolveRoleFields(profile: { id: string; role: string }, formData: FormData) {
  let salesId = profile.id;
  let status: 'PENDING' | 'APPROVED' = 'PENDING';
  let approvedAt: Date | null = null;
  let approvedBy: string | null = null;

  if (profile.role === 'ADMIN' || profile.role === 'SUPER_ADMIN') {
    const adminSelectedSalesId = formData.get('salesId')?.toString().trim();
    if (adminSelectedSalesId) {
      const salesExists = await prisma.profile.findUnique({ where: { id: adminSelectedSalesId } });
      if (!salesExists) return { error: 'Akun sales yang dipilih tidak valid atau sudah dihapus.' };
      salesId = adminSelectedSalesId;
    } else {
      salesId = profile.id;
    }
    status = 'APPROVED';
    approvedAt = new Date();
    approvedBy = profile.id;
  }

  return { salesId, status, approvedAt, approvedBy };
}

export async function createEntry(formData: FormData) {
  const profile = await requireAuth();
  const mode = formData.get('mode')?.toString() ?? 'LANGSUNG';

  if (mode === 'ANTRIAN') {
    const requestsJson = formData.get('requests')?.toString();
    if (!requestsJson) return { error: 'Tambahkan minimal satu permintaan' };

    let rawRequests: RawRequest[];
    try {
      rawRequests = JSON.parse(requestsJson);
    } catch {
      return { error: 'Data permintaan tidak valid' };
    }
    if (!Array.isArray(rawRequests) || rawRequests.length === 0) {
      return { error: 'Tambahkan minimal satu permintaan' };
    }
    for (const r of rawRequests) {
      if (!r.type || !r.hargaJual || r.hargaJual <= 0) {
        return { error: 'Setiap permintaan harus memiliki jenis hewan dan harga jual' };
      }
    }

    const resolved = await resolveRoleFields(profile, formData);
    if ('error' in resolved) return resolved;
    const { salesId, status, approvedAt, approvedBy } = resolved;

    const entry = await prisma.$transaction(async (tx) => {
      return tx.entry.create({
        data: {
          ...buildEntryBaseData(formData, salesId, status, approvedAt, approvedBy),
          pengiriman: null,
          requests: {
            create: rawRequests.map((r) => ({
              type: r.type,
              grade: r.grade ?? null,
              weightMin: r.weightMin ?? null,
              weightMax: r.weightMax ?? null,
              hargaJual: r.hargaJual,
              hargaModal: r.hargaModal ?? null,
              resellerCut: r.resellerCut ?? null,
              notes: r.notes ?? null,
            })),
          },
        },
      });
    });

    await logAudit({
      actor: profile,
      action: 'CREATE',
      entity: 'Entry',
      entityId: entry.id,
      label: `${entry.invoiceNo} — ${entry.buyerName} (Antrian)`,
      after: entry,
    });

    revalidatePath('/sales');
    revalidatePath('/admin');
    revalidatePath('/admin/antrian');
    return { success: true, entryId: entry.id };
  }

  // LANGSUNG mode (default)
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

  const livestockIds = rawItems.map((i) => i.livestockId);
  const [allLivestock, existingItems] = await Promise.all([
    prisma.livestock.findMany({ where: { id: { in: livestockIds } } }),
    prisma.entryItem.findMany({ where: { livestockId: { in: livestockIds } } }),
  ]);

  if (existingItems.length > 0) return { error: 'Satu atau lebih hewan sudah memiliki entry penjualan' };
  for (const raw of rawItems) {
    const lv = allLivestock.find((l) => l.id === raw.livestockId);
    if (!lv || lv.isSold) return { error: `Hewan ${raw.livestockId} tidak tersedia atau sudah terjual` };
  }

  const resolved = await resolveRoleFields(profile, formData);
  if ('error' in resolved) return resolved;
  const { salesId, status, approvedAt, approvedBy } = resolved;

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
        ...buildEntryBaseData(formData, salesId, status, approvedAt, approvedBy),
        items: { create: itemsCreate },
      },
    });

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

export async function fulfillEntryRequest(requestId: string, livestockId: string, formData: FormData) {
  const admin = await requireRole('ADMIN', 'SUPER_ADMIN');

  const [request, livestock] = await Promise.all([
    prisma.entryRequest.findUnique({ where: { id: requestId }, include: { entry: true } }),
    prisma.livestock.findUnique({ where: { id: livestockId } }),
  ]);

  if (!request) return { error: 'Permintaan tidak ditemukan' };
  if (!livestock) return { error: 'Hewan tidak ditemukan' };
  if (livestock.isSold) return { error: 'Hewan sudah terjual' };
  if (livestock.type !== request.type) return { error: `Jenis hewan tidak sesuai (diminta: ${request.type})` };

  const hargaModal = formData.get('hargaModal') ? Number(formData.get('hargaModal')) : (livestock.hargaModal ?? 0);
  const resellerCut = formData.get('resellerCut') ? Number(formData.get('resellerCut')) : (request.resellerCut ?? 0);
  const hpp = hargaModal + resellerCut;
  const profit = request.hargaJual - hpp;

  await prisma.$transaction([
    prisma.entryItem.create({
      data: {
        entryId: request.entryId,
        livestockId,
        hargaJual: request.hargaJual,
        hargaModal,
        resellerCut,
        hpp,
        profit,
      },
    }),
    prisma.livestock.update({
      where: { id: livestockId },
      data: { isSold: true },
    }),
    prisma.entryRequest.update({ where: { id: requestId }, data: { isFulfilled: true } }),
  ]);

  const gradeLabel = request.grade ? `/${request.grade}` : '';
  await logAudit({
    actor: admin,
    action: 'UPDATE',
    entity: 'Entry',
    entityId: request.entryId,
    label: `${request.entry.invoiceNo} — fulfill ${request.type}${gradeLabel}`,
    after: { livestockId, hargaJual: request.hargaJual, hargaModal, resellerCut },
  });

  revalidatePath('/admin/antrian');
  revalidatePath('/admin');
  revalidatePath('/sales');
  revalidatePath('/catalogue');
  return { success: true };
}

export async function updateEntryRequests(entryId: string, requestsJson: string) {
  const profile = await requireAuth();

  const entry = await prisma.entry.findUnique({ where: { id: entryId } });
  if (!entry) return { error: 'Entry tidak ditemukan' };
  if (profile.role !== 'ADMIN' && profile.role !== 'SUPER_ADMIN' && entry.salesId !== profile.id) {
    return { error: 'Anda tidak berhak mengubah entry ini' };
  }

  let rawRequests: RawRequest[];
  try {
    rawRequests = JSON.parse(requestsJson);
  } catch {
    return { error: 'Data permintaan tidak valid' };
  }
  if (!Array.isArray(rawRequests) || rawRequests.length === 0) {
    return { error: 'Minimal satu permintaan harus ada' };
  }

  await prisma.$transaction([
    prisma.entryRequest.deleteMany({ where: { entryId } }),
    prisma.entryRequest.createMany({
      data: rawRequests.map((r) => ({
        entryId,
        type: r.type,
        grade: r.grade ?? null,
        weightMin: r.weightMin ?? null,
        weightMax: r.weightMax ?? null,
        hargaJual: r.hargaJual,
        hargaModal: r.hargaModal ?? null,
        resellerCut: r.resellerCut ?? null,
        notes: r.notes ?? null,
      })),
    }),
  ]);

  await logAudit({
    actor: profile,
    action: 'UPDATE',
    entity: 'Entry',
    entityId: entryId,
    label: `${entry.invoiceNo} — ${entry.buyerName} (Antrian)`,
    after: { requests: rawRequests },
  });

  revalidatePath('/admin');
  revalidatePath('/sales');
  revalidatePath('/admin/antrian');
  return { success: true };
}
