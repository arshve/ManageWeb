import { prisma } from '@/lib/prisma';
import { requireRole, isSuperAdmin } from '@/lib/auth';
import { DashboardShell } from '@/components/dashboard/dashboard-shell';
import { QueueView } from '@/components/admin/queue-view';


export default async function AntrianPage() {
  const profile = await requireRole('ADMIN', 'SUPER_ADMIN');
  const canViewFinancials = isSuperAdmin(profile.role);

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
            sales: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: [{ entry: { createdAt: 'asc' } }, { isFulfilled: 'asc' }, { createdAt: 'asc' }],
    }),
    prisma.livestock.findMany({
      // Match requests only against sehat livestock — sakit/mati are liability, not sellable.
      where: { isSold: false, condition: 'SEHAT' },
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
      salesId: r.entry.sales?.id ?? null,
    },
  }));

  return (
    <DashboardShell
      title="Antrian Hewan"
      description="Permintaan pembeli yang menunggu stok tersedia"
    >
      <QueueView
        requests={serializedRequests}
        availableLivestock={availableLivestock}
        canViewFinancials={canViewFinancials}
        currentUserId={profile.id}
        isAdmin={true}
      />
    </DashboardShell>
  );
}
