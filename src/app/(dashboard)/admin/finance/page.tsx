import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/auth';
import { DashboardShell } from '@/components/dashboard/dashboard-shell';
import { FinanceView } from '@/components/admin/finance-view';
import { Button } from '@/components/ui/button';
import { CalendarDays } from 'lucide-react';

export default async function FinancePage() {
  await requireRole('SUPER_ADMIN');
  const [entries, salesUsers, cashflows] = await Promise.all([
    prisma.entry.findMany({
      where: { status: 'APPROVED' },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        hargaJual: true,
        hargaModal: true,
        resellerCut: true,
        profit: true,
        paymentStatus: true,
        buyerName: true,
        buyerAddress: true,
        salesId: true,
        livestock: {
          select: {
            sku: true,
            tag: true,
            photoUrl: true,
          },
        },
      },
    }),
    prisma.profile.findMany({
      where: { role: { in: ['SALES', 'ADMIN', 'SUPER_ADMIN'] }, isActive: true },
      select: {
        id: true,
        name: true,
        phone: true,
        rekBank: true,
      },
      orderBy: { name: 'asc' },
    }),
    prisma.cashflow.findMany({
      orderBy: { createdAt: 'desc' },
    }),
  ]);

  const serialized = entries.map((e) => ({
    id: e.id,
    hargaJual: e.hargaJual,
    hargaModal: e.hargaModal ?? 0,
    resellerCut: e.resellerCut ?? 0,
    profit: e.profit ?? 0,
    paymentStatus: e.paymentStatus,
    buyerName: e.buyerName,
    buyerAddress: e.buyerAddress,
    salesId: e.salesId,
    livestock: {
      sku: e.livestock.sku,
      tag: e.livestock.tag,
      photoUrl: e.livestock.photoUrl,
    },
  }));

  const monthLabel = new Date().toLocaleDateString('id-ID', {
    month: 'long',
    year: 'numeric',
  });

  return (
    <DashboardShell
      title="Keuangan"
      description="Ringkasan keuangan per sales"
      actions={
        <Button variant="outline" size="sm" className="gap-1.5">
          <CalendarDays className="h-3.5 w-3.5" />
          {monthLabel}
        </Button>
      }
    >
      <FinanceView
        entries={serialized}
        salesUsers={salesUsers}
        cashflows={cashflows.map((c) => ({
          id: c.id,
          type: c.type,
          name: c.name,
          amount: c.amount,
          category: c.category,
          date: c.createdAt.toLocaleDateString('id-ID', {
            day: 'numeric',
            month: 'short',
          }),
        }))}
      />
    </DashboardShell>
  );
}
