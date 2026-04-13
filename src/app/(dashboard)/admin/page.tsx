import { prisma } from '@/lib/prisma';
import { formatRupiah } from '@/lib/format';
import { DashboardShell } from '@/components/dashboard/dashboard-shell';
import { EntryTable } from '@/components/dashboard/entry-table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Beef, ClipboardList, DollarSign, Users, Plus } from 'lucide-react';
import Link from 'next/link';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export default async function AdminDashboardPage() {
  const [
    totalLivestock,
    soldLivestock,
    totalEntries,
    pendingEntries,
    totalSales,
    approvedEntries,
    allEntries,
    availableLivestock,
  ] = await Promise.all([
    prisma.livestock.count(),
    prisma.livestock.count({ where: { isSold: true } }),
    prisma.entry.count(),
    prisma.entry.count({ where: { status: 'PENDING' } }),
    prisma.profile.count({ where: { role: 'SALES', isActive: true } }),
    prisma.entry.findMany({
      where: { status: 'APPROVED' },
      select: { hargaJual: true, hargaModal: true, profit: true },
    }),
    prisma.entry.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        livestock: true,
        sales: { select: { name: true } },
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

  const totalRevenue = approvedEntries.reduce((sum, e) => sum + e.hargaJual, 0);
  const totalProfit = approvedEntries.reduce(
    (sum, e) => sum + (e.profit ?? 0),
    0,
  );
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
    buyerWa: entry.buyerWa,
    buyerAddress: entry.buyerAddress,
    buyerMaps: entry.buyerMaps,
    buktiTransfer: entry.buktiTransfer,
    notes: entry.notes,
    isSent: entry.isSent,
    createdAt: entry.createdAt.toISOString(),
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
    {
      title: 'Total Revenue',
      value: formatRupiah(totalRevenue),
      sub: `Modal: ${formatRupiah(totalModal)}`,
      icon: DollarSign,
    },
    {
      title: 'Total Profit',
      value: formatRupiah(totalProfit),
      sub: `${totalSales} sales aktif`,
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
            availableLivestock={availableLivestock}
          />
        </CardContent>
      </Card>
    </DashboardShell>
  );
}
