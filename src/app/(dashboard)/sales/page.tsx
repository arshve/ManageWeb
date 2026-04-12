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

  const entries = await prisma.entry.findMany({
    where: { salesId: profile.id },
    orderBy: { createdAt: 'desc' },
    include: {
      livestock: true,
      sales: { select: { name: true } }, // Included sales name for EntryTable
    },
  });

  const approved = entries.filter((e) => e.status === 'APPROVED');
  const pending = entries.filter((e) => e.status === 'PENDING');
  const totalEarnings = approved.reduce(
    (sum, e) => sum + (e.resellerCut ?? 0),
    0,
  );
  const totalSales = approved.reduce((sum, e) => sum + e.hargaJual, 0);

  // Serialize the data exactly how the Admin page does it
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
      title={`Halo, ${profile.name}`}
      description="Ringkasan entry dan penghasilan kamu"
      actions={
        <Link href="/sales/new" className={buttonVariants()}>
          <Plus className="h-4 w-4 mr-2" />
          Tambah Entry
        </Link>
      }
    >
      {/* Earnings Summary */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-3 mb-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Komisi
            </CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">
              {formatRupiah(totalEarnings)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Dari {approved.length} penjualan disetujui
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Penjualan
            </CardTitle>
            <ClipboardList className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatRupiah(totalSales)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {entries.length} entry total
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Menunggu Approval
            </CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">
              {pending.length}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Entry belum disetujui
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Entries List Replaced with EntryTable */}
      <Card>
        <CardHeader>
          <CardTitle>Entry Saya</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <EntryTable entries={serialized} isAdmin={false} />
        </CardContent>
      </Card>
    </DashboardShell>
  );
}
