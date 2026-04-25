import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { formatRupiah, formatDateTime } from '@/lib/format';
import { DashboardShell } from '@/components/dashboard/dashboard-shell';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { buttonVariants } from '@/components/ui/button';
import { Plus, DollarSign, ClipboardList, Clock } from 'lucide-react';
import Link from 'next/link';
import { EntryTable } from '@/components/dashboard/entry-table';

export default async function SalesPage() {
  const profile = await requireAuth();

  const [entries] = await Promise.all([
    prisma.entry.findMany({
      where: { salesId: profile.id },
      orderBy: { createdAt: 'desc' },
      include: {
        items: { include: { livestock: true } },
        sales: { select: { id: true, name: true } },
        delivery: {
          select: { status: true, driver: { select: { name: true } } },
        },
      },
    }),
  ]);

  const approved = entries.filter((e) => e.status === 'APPROVED');
  const pending = entries.filter((e) => e.status === 'PENDING');
  const totalEarnings = approved.reduce(
    (sum, e) => sum + e.items.reduce((s, i) => s + (i.resellerCut ?? 0), 0),
    0,
  );
  const totalSalesAmount = approved.reduce(
    (sum, e) => sum + e.items.reduce((s, i) => s + i.hargaJual, 0),
    0,
  );

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
      sales: { id: entry.sales.id, name: entry.sales.name },
    };
  });

  return (
    <DashboardShell
      title={`Halo, ${profile.name}`}
      description="Ringkasan entry dan penghasilan kamu"
      actions={
        <Link href="/sales/new" className={buttonVariants()}>
          <Plus className="h-4 w-4 mr-2" />
          Tambah Entry
        </Link>
      }
    >
      <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 mb-6 [&>*:last-child:nth-child(odd)]:col-span-2 [&>*:last-child:nth-child(odd)]:sm:col-span-1">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Komisi</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">{formatRupiah(totalEarnings)}</div>
            <p className="text-xs text-muted-foreground mt-1">Dari {approved.length} penjualan disetujui</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Penjualan</CardTitle>
            <ClipboardList className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatRupiah(totalSalesAmount)}</div>
            <p className="text-xs text-muted-foreground mt-1">{entries.length} entry total</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Menunggu Approval</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{pending.length}</div>
            <p className="text-xs text-muted-foreground mt-1">Entry belum disetujui</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Entry Saya</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <EntryTable
            entries={serialized}
            isAdmin={false}
          />
        </CardContent>
      </Card>
    </DashboardShell>
  );
}
