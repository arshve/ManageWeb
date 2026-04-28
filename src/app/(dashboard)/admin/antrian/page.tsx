import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/auth';
import { DashboardShell } from '@/components/dashboard/dashboard-shell';
import { QueueView } from '@/components/admin/queue-view';

export default async function AntrianPage() {
  await requireRole('ADMIN', 'SUPER_ADMIN');

  const [requests, availableLivestock] = await Promise.all([
    // Fetch ALL requests (fulfilled + unfulfilled) for entries that still have
    // at least one unfulfilled request. This lets the queue show the full
    // invoice picture until every row is done.
    prisma.entryRequest.findMany({
      where: {
        entry: { requests: { some: { isFulfilled: false } } },
      },
      include: {
        entry: {
          select: {
            id: true,
            invoiceNo: true,
            buyerName: true,
            buyerPhone: true,
            status: true,
            createdAt: true,
            sales: { select: { name: true } },
          },
        },
      },
      orderBy: [{ isFulfilled: 'asc' }, { type: 'asc' }, { grade: 'asc' }, { createdAt: 'asc' }],
    }),
    prisma.livestock.findMany({
      where: { isSold: false, condition: { not: 'MATI' } },
      select: {
        id: true,
        sku: true,
        type: true,
        grade: true,
        tag: true,
        hargaJual: true,
        hargaModal: true,
        weightMin: true,
        weightMax: true,
        condition: true,
        photoUrl: true,
      },
      orderBy: { createdAt: 'desc' },
    }),
  ]);

  const serializedRequests = requests.map((r) => ({
    id: r.id,
    entryId: r.entryId,
    type: r.type,
    grade: r.grade,
    weightMin: r.weightMin,
    weightMax: r.weightMax,
    hargaJual: r.hargaJual,
    hargaModal: r.hargaModal,
    resellerCut: r.resellerCut,
    notes: r.notes,
    isFulfilled: r.isFulfilled,
    createdAt: r.createdAt.toISOString(),
    entry: {
      id: r.entry.id,
      invoiceNo: r.entry.invoiceNo,
      buyerName: r.entry.buyerName,
      buyerPhone: r.entry.buyerPhone,
      status: r.entry.status,
      salesName: r.entry.sales?.name ?? null,
    },
  }));

  return (
    <DashboardShell
      title="Antrian Hewan"
      description="Permintaan pembeli yang menunggu stok tersedia"
    >
      <QueueView requests={serializedRequests} availableLivestock={availableLivestock} />
    </DashboardShell>
  );
}
