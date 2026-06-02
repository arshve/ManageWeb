export const dynamic = 'force-dynamic';

import { prisma } from '@/lib/prisma';
import { DashboardShell } from '@/components/dashboard/dashboard-shell';
import { EntryTable } from '@/components/dashboard/entry-table';
import { Card, CardContent } from '@/components/ui/card';
import { getDeliveryProgressMap } from '@/lib/delivery/progress';
import { getAppConfig } from '@/lib/config/get-config';

export default async function AdminEntriesPage() {
  const cfg = await getAppConfig();
  const canCharge = cfg.paymentEnabled && (cfg.hasMidtransServerKey || cfg.paymentMock);
  const [entries, salesUsers] = await Promise.all([
    prisma.entry.findMany({
      where: { requests: { none: { isFulfilled: false } } },
      orderBy: { sortAt: 'desc' },
      include: {
        items: { include: { livestock: true } },
        requests: { where: { isFulfilled: false }, select: { id: true, type: true, grade: true, weightMin: true, weightMax: true, hargaJual: true } },
        editRequests: {
          where: { status: 'PENDING' },
          take: 1,
          orderBy: { createdAt: 'desc' },
          include: { proposedBy: { select: { name: true } } },
        },
        sales: { select: { id: true, name: true } },
        payments: { where: { status: 'SETTLEMENT' }, select: { orderId: true, transactionId: true }, orderBy: { paidAt: 'desc' }, take: 1 },
        delivery: {
          select: {
            id: true,
            status: true,
            driverId: true,
            sequence: true,
            proofPhotoUrl: true,
            driver: { select: { name: true } },
          },
        },
      },
    }),
    prisma.profile.findMany({
      where: { role: { in: ['SALES', 'ADMIN', 'SUPER_ADMIN'] }, isActive: true },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
  ]);

  const pending = entries.filter((e) => e.status === 'PENDING').length;

  const pendingEditLivestockIds = entries
    .flatMap((e) => e.editRequests)
    .flatMap((req) => (req.itemChanges as Array<{ entryItemId: string; livestockId: string; hargaJual: number }>).map((ic) => ic.livestockId));
  const pendingLivestocks = pendingEditLivestockIds.length > 0
    ? await prisma.livestock.findMany({
        where: { id: { in: pendingEditLivestockIds } },
        select: { id: true, sku: true, type: true, grade: true, tag: true },
      })
    : [];
  const pendingLivestockMap = Object.fromEntries(pendingLivestocks.map((l) => [l.id, l]));

  // Queue progression per delivery (1 round-trip total for all routes touched).
  const progressMap = await getDeliveryProgressMap(entries);

  const serialized = entries.map((entry) => {
    const first = entry.items[0]?.livestock;
    return {
      id: entry.id,
      invoiceNo: entry.invoiceNo,
      status: entry.status,
      hargaJual: entry.items.reduce((s, i) => s + i.hargaJual, 0),
      hargaModal: entry.items.reduce((s, i) => s + (i.hargaModal ?? 0), 0),
      resellerCut: entry.items.reduce((s, i) => s + (i.resellerCut ?? 0), 0),
      hpp: entry.items.reduce((s, i) => s + (i.hpp ?? 0), 0),
      profit: entry.items.reduce((s, i) => s + (i.profit ?? 0), 0),
      dp: entry.dp,
      totalBayar: entry.totalBayar,
      paymentStatus: entry.paymentStatus,
      buyerName: entry.buyerName,
      buyerPhone: entry.buyerPhone,
      buyerAddress: entry.buyerAddress,
      buyerMaps: entry.buyerMaps,
      pengiriman: entry.pengiriman,
      notes: entry.notes,
      collectedBy: entry.collectedBy,
      gatewayRef: entry.payments[0]?.orderId ?? null,
      gatewayTxnId: entry.payments[0]?.transactionId ?? null,
      buktiTransfer: entry.buktiTransfer,
      isSent: entry.isSent,
      createdAt: entry.createdAt.toISOString(),
      updatedAt: entry.updatedAt.toISOString(),
      deleteRequestedAt: entry.deleteRequestedAt?.toISOString() ?? null,
      deleteRequestedById: entry.deleteRequestedById ?? null,
      delivery: entry.delivery
        ? {
            status: entry.delivery.status,
            driverName: entry.delivery.driver?.name ?? null,
            proofPhotoUrl: entry.delivery.proofPhotoUrl ?? null,
            progress: progressMap.get(entry.delivery.id) ?? null,
          }
        : null,
      items: entry.items.map((i) => ({
        id: i.id,
        hargaJual: i.hargaJual,
        hargaModal: i.hargaModal,
        resellerCut: i.resellerCut,
        hpp: i.hpp,
        profit: i.profit,
        livestock: {
          id: i.livestock.id,
          sku: i.livestock.sku,
          type: i.livestock.type,
          grade: i.livestock.grade,
          weightMin: i.livestock.weightMin,
          weightMax: i.livestock.weightMax,
          tag: i.livestock.tag,
          photoUrl: i.livestock.photoUrl,
          condition: i.livestock.condition,
        },
      })),
      // compat: first item's livestock for single-item display in table
      livestock: first ? {
        id: first.id,
        sku: first.sku,
        type: first.type,
        grade: first.grade,
        weightMin: first.weightMin,
        weightMax: first.weightMax,
        tag: first.tag,
        photoUrl: first.photoUrl,
        condition: first.condition,
      } : null,
      requests: entry.requests.map((r) => ({
        id: r.id,
        type: r.type,
        grade: r.grade,
        weightMin: r.weightMin,
        weightMax: r.weightMax,
        hargaJual: r.hargaJual,
      })),
      editRequests: entry.editRequests.map((req) => ({
        id: req.id,
        proposedByName: req.proposedBy.name,
        createdAt: req.createdAt.toISOString(),
        itemChanges: (req.itemChanges as Array<{ entryItemId: string; livestockId: string; hargaJual: number }>).map((ic) => ({
          entryItemId: ic.entryItemId,
          newLivestockId: ic.livestockId,
          newLivestockSku: pendingLivestockMap[ic.livestockId]?.sku ?? ic.livestockId,
          newLivestockType: pendingLivestockMap[ic.livestockId]?.type ?? '',
          newLivestockGrade: pendingLivestockMap[ic.livestockId]?.grade ?? null,
          newHargaJual: ic.hargaJual,
        })),
      })),
      sales: { id: entry.sales.id, name: entry.sales.name },
    };
  });

  return (
    <DashboardShell
      title="Entry Penjualan"
      description={`${entries.length} entry total, ${pending} menunggu approval`}
    >
      <Card>
        <CardContent className="p-0">
          <EntryTable
            entries={serialized}
            isAdmin={true}
            salesUsers={salesUsers}
            canCharge={canCharge}
          />
        </CardContent>
      </Card>
    </DashboardShell>
  );
}
