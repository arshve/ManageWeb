import { prisma } from '@/lib/prisma';
import { DashboardShell } from '@/components/dashboard/dashboard-shell';
import { EntryTable } from '@/components/dashboard/entry-table';
import { Card, CardContent } from '@/components/ui/card';

export default async function AdminEntriesPage() {
  const [entries, salesUsers] = await Promise.all([
    prisma.entry.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        items: { include: { livestock: true } },
        sales: { select: { id: true, name: true } },
        delivery: {
          select: {
            status: true,
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
      buktiTransfer: entry.buktiTransfer,
      isSent: entry.isSent,
      createdAt: entry.createdAt.toISOString(),
      delivery: entry.delivery
        ? { status: entry.delivery.status, driverName: entry.delivery.driver?.name ?? null }
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
          />
        </CardContent>
      </Card>
    </DashboardShell>
  );
}
