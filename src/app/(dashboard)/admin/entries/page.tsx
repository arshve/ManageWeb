import { prisma } from '@/lib/prisma';
import { DashboardShell } from '@/components/dashboard/dashboard-shell';
import { EntryTable } from '@/components/dashboard/entry-table';
import { Card, CardContent } from '@/components/ui/card';

export default async function AdminEntriesPage() {
  const [entries, availableLivestock] = await Promise.all([
    prisma.entry.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        livestock: true,
        sales: { select: { name: true } },
        delivery: {
          select: {
            status: true,
            driver: { select: { name: true } },
          },
        },
      },
    }),
    prisma.livestock.findMany({
      where: {
        isSold: false,
        entry: null,
        condition: { not: 'MATI' },
      },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        sku: true,
        type: true,
        grade: true,
        tag: true,
      },
    }),
  ]);

  const pending = entries.filter((e) => e.status === 'PENDING').length;

  const serialized = entries.map((entry) => ({
    id: entry.id,
    invoiceNo: entry.invoiceNo,
    status: entry.status,
    hargaJual: entry.hargaJual,
    hargaModal: entry.hargaModal,
    resellerCut: entry.resellerCut,
    hpp: entry.hpp,
    profit: entry.profit,
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
      ? {
          status: entry.delivery.status,
          driverName: entry.delivery.driver?.name ?? null,
        }
      : null,
    livestock: {
      id: entry.livestock.id,
      sku: entry.livestock.sku,
      type: entry.livestock.type,
      grade: entry.livestock.grade,
      tag: entry.livestock.tag,
      photoUrl: entry.livestock.photoUrl,
      condition: entry.livestock.condition,
    },
    sales: {
      name: entry.sales.name,
    },
  }));

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
            availableLivestock={availableLivestock}
          />
        </CardContent>
      </Card>
    </DashboardShell>
  );
}
