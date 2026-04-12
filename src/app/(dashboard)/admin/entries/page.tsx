import { prisma } from '@/lib/prisma';
import { DashboardShell } from '@/components/dashboard/dashboard-shell';
import { EntryTable } from '@/components/dashboard/entry-table';
import { Card, CardContent } from '@/components/ui/card';

export default async function AdminEntriesPage() {
  const entries = await prisma.entry.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      livestock: true,
      sales: { select: { name: true } },
    },
  });

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
    buyerWa: entry.buyerWa,
    buyerAddress: entry.buyerAddress,
    buyerMaps: entry.buyerMaps,
    notes: entry.notes,
    buktiTransfer: entry.buktiTransfer,
    isSent: entry.isSent,
    createdAt: entry.createdAt.toISOString(),
    livestock: {
      sku: entry.livestock.sku,
      type: entry.livestock.type,
      grade: entry.livestock.grade,
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
          <EntryTable entries={serialized} isAdmin={true} />
        </CardContent>
      </Card>
    </DashboardShell>
  );
}
