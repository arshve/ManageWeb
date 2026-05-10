import { prisma } from '@/lib/prisma';
import { requireAuth, isSuperAdmin } from '@/lib/auth';
import { formatRupiah } from '@/lib/format';
import { DashboardShell } from '@/components/dashboard/dashboard-shell';
import { EntryTable } from '@/components/dashboard/entry-table';
import { Plus } from 'lucide-react';
import Link from 'next/link';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { StatCard } from '@/components/ui/stat-card';

const SERIF = "var(--font-dm-serif), 'DM Serif Display', serif";

export default async function AdminDashboardPage() {
  const profile = await requireAuth();
  const superAdmin = isSuperAdmin(profile.role);

  const [
    totalLivestock,
    soldLivestock,
    totalEntries,
    pendingEntries,
    totalSales,
    revenueAgg,
    allEntries,
    salesUsers,
  ] = await Promise.all([
    prisma.livestock.count(),
    prisma.livestock.count({ where: { isSold: true } }),
    prisma.entry.count(),
    prisma.entry.count({ where: { status: 'PENDING' } }),
    prisma.profile.count({ where: { role: 'SALES', isActive: true } }),
    prisma.entryItem.aggregate({
      _sum: { hargaJual: true, hargaModal: true },
      where: { entry: { status: 'APPROVED' } },
    }),
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
        delivery: {
          select: { status: true, driver: { select: { name: true } } },
        },
      },
    }),
    prisma.profile.findMany({
      where: { role: { in: ['SALES', 'ADMIN', 'SUPER_ADMIN'] }, isActive: true },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
  ]);

  const pendingEditLivestockIds = allEntries
    .flatMap((e) => e.editRequests)
    .flatMap((req) => (req.itemChanges as Array<{ entryItemId: string; livestockId: string; hargaJual: number }>).map((ic) => ic.livestockId));
  const pendingLivestocks = pendingEditLivestockIds.length > 0
    ? await prisma.livestock.findMany({
        where: { id: { in: pendingEditLivestockIds } },
        select: { id: true, sku: true, type: true, grade: true, tag: true },
      })
    : [];
  const pendingLivestockMap = Object.fromEntries(pendingLivestocks.map((l) => [l.id, l]));

  const totalRevenue = revenueAgg._sum.hargaJual ?? 0;
  const totalModal = revenueAgg._sum.hargaModal ?? 0;

  const serialized = allEntries.map((entry) => {
    const first = entry.items[0]?.livestock;
    return {
      id: entry.id,
      invoiceNo: entry.invoiceNo,
      status: entry.status,
      hargaJual: entry.items.length > 0
        ? entry.items.reduce((s, i) => s + i.hargaJual, 0)
        : entry.requests.reduce((s, r) => s + r.hargaJual, 0),
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
      buktiTransfer: entry.buktiTransfer,
      notes: entry.notes,
      isSent: entry.isSent,
      createdAt: entry.createdAt.toISOString(),
      updatedAt: entry.updatedAt.toISOString(),
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
      livestock: first
        ? {
            id: first.id,
            sku: first.sku,
            type: first.type,
            grade: first.grade,
            weightMin: first.weightMin,
            weightMax: first.weightMax,
            tag: first.tag,
            photoUrl: first.photoUrl,
            condition: first.condition,
          }
        : null,
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
      title="Dashboard"
      description="Ringkasan data Millenials Farm"
      actions={
        <Link href="/admin/new" className={cn(buttonVariants({ size: 'sm' }), 'gap-1')}>
          <Plus className="size-4" />
          Tambah Entry
        </Link>
      }
    >
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4 mb-6">
        <StatCard accent="warning" label="Total Hewan"      value={totalLivestock}           sub={`${soldLivestock} terjual`} />
        <StatCard accent="info"    label="Entry Penjualan"  value={totalEntries}              sub={`${pendingEntries} menunggu approval`} />
        {superAdmin && <StatCard accent="success" label="Total Revenue" value={formatRupiah(totalRevenue)} sub={`Modal: ${formatRupiah(totalModal)}`} />}
        <StatCard accent="primary" label="Sales Aktif"      value={totalSales}                sub={superAdmin ? 'Keuangan di menu terpisah' : ''} />
      </div>

      <div className="rounded-xl border bg-card overflow-hidden">
        <div className="px-6 py-4 border-b">
          <h2 className="text-base font-semibold" style={{ fontFamily: SERIF }}>
            Entry Penjualan
          </h2>
        </div>
        <EntryTable
          entries={serialized}
          isAdmin={true}
          canViewFinancials={superAdmin}
          salesUsers={salesUsers}
        />
      </div>
    </DashboardShell>
  );
}
