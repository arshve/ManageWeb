import { prisma } from '@/lib/prisma';
import { requireAuth, isSuperAdmin } from '@/lib/auth';
import { formatRupiah } from '@/lib/format';
import { DashboardShell } from '@/components/dashboard/dashboard-shell';
import { EntryTable } from '@/components/dashboard/entry-table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Beef, ClipboardList, DollarSign, Users, Plus } from 'lucide-react';
import Link from 'next/link';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export default async function AdminDashboardPage() {
  const profile = await requireAuth();
  const superAdmin = isSuperAdmin(profile.role);
  const totalLivestock = await prisma.livestock.count();
  const soldLivestock = await prisma.livestock.count({
    where: { isSold: true },
  });
  const totalEntries = await prisma.entry.count();
  const pendingEntries = await prisma.entry.count({
    where: { status: 'PENDING' },
  });
  const totalSales = await prisma.profile.count({
    where: { role: 'SALES', isActive: true },
  });

  const [approvedEntries, allEntries, availableLivestock, salesUsers] = await Promise.all([
    prisma.entry.findMany({
      where: { status: 'APPROVED' },
      select: { hargaJual: true, hargaModal: true, profit: true },
    }),
    prisma.entry.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        livestock: true,
        sales: { select: { id: true, name: true } },
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
        weightMin: true,
        weightMax: true,
        tag: true,
      },
    }),
    prisma.profile.findMany({
      where: { role: { in: ['SALES', 'ADMIN', 'SUPER_ADMIN'] }, isActive: true },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
  ]);

  const totalRevenue = approvedEntries.reduce((sum, e) => sum + e.hargaJual, 0);
  const totalModal = approvedEntries.reduce(
    (sum, e) => sum + (e.hargaModal ?? 0),
    0,
  );

  const serialized = allEntries.map((entry) => ({
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
    buktiTransfer: entry.buktiTransfer,
    notes: entry.notes,
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
      weightMin: entry.livestock.weightMin,
      weightMax: entry.livestock.weightMax,
      tag: entry.livestock.tag,
      photoUrl: entry.livestock.photoUrl,
      condition: entry.livestock.condition,
    },
    sales: {
      id: entry.sales.id,
      name: entry.sales.name,
    },
  }));

  const stats = [
    {
      title: 'Total Hewan',
      value: totalLivestock,
      sub: `${soldLivestock} terjual`,
      icon: Beef,
    },
    {
      title: 'Entry Penjualan',
      value: totalEntries,
      sub: `${pendingEntries} menunggu approval`,
      icon: ClipboardList,
    },
    ...(superAdmin
      ? [
          {
            title: 'Total Revenue',
            value: formatRupiah(totalRevenue),
            sub: `Modal: ${formatRupiah(totalModal)}`,
            icon: DollarSign,
          },
        ]
      : []),
    {
      title: 'Sales Aktif',
      value: totalSales,
      sub: superAdmin ? 'Keuangan di menu terpisah' : '',
      icon: Users,
    },
  ];

  return (
    <DashboardShell
      title="Dashboard"
      description="Ringkasan data Millenials Farm"
      actions={
        <Link
          href="/admin/new"
          className={cn(buttonVariants({ size: 'sm' }), 'gap-1')}
        >
          <Plus className="h-4 w-4" />
          Tambah Entry
        </Link>
      }
    >
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4 mb-6">
        {stats.map((stat) => (
          <Card key={stat.title}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {stat.title}
              </CardTitle>
              <stat.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
              <p className="text-xs text-muted-foreground mt-1">{stat.sub}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Entry Penjualan</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <EntryTable
            entries={serialized}
            isAdmin={true}
            canViewFinancials={superAdmin}
            availableLivestock={availableLivestock}
            salesUsers={salesUsers}
          />
        </CardContent>
      </Card>
    </DashboardShell>
  );
}
