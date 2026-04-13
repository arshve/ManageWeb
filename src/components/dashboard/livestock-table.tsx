/**
 * LivestockTable — Shared server component for livestock management.
 *
 * Fetches data, computes stats, renders stat cards + the filterable client table.
 * Used by both /admin/livestock and /manage pages.
 */

import { prisma } from '@/lib/prisma';
import { DashboardShell } from '@/components/dashboard/dashboard-shell';
import { LivestockForm } from '@/components/dashboard/livestock-form';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus } from 'lucide-react';
import { LivestockTableClient } from '@/components/dashboard/livestock-table-client';

export async function LivestockTable() {
  const livestock = await prisma.livestock.findMany({
    orderBy: { createdAt: 'desc' },
    include: { entry: { select: { id: true, status: true } } },
  });

  // Stat calculations
  const types = ['KAMBING', 'DOMBA', 'SAPI'] as const;
  const stats = types.map((type) => {
    const all = livestock.filter((l) => l.type === type);
    const sold = all.filter((l) => l.isSold);
    return {
      type,
      total: all.length,
      sold: sold.length,
      available: all.length - sold.length,
    };
  });
  const totalSold = livestock.filter((l) => l.isSold).length;

  const typeLabels: Record<string, string> = {
    KAMBING: 'Kambing',
    DOMBA: 'Domba',
    SAPI: 'Sapi',
  };

  // Serialize for client component
  const serialized = livestock.map((item) => ({
    id: item.id,
    sku: item.sku,
    type: item.type,
    grade: item.grade,
    condition: item.condition,
    weightMin: item.weightMin,
    weightMax: item.weightMax,
    hargaJual: item.hargaJual,
    tag: item.tag,
    photoUrl: item.photoUrl,
    notes: item.notes,
    isSold: item.isSold,
  }));

  return (
    <DashboardShell
      title="Kelola Hewan"
      description={`${livestock.length} hewan terdaftar, ${totalSold} terjual`}
      actions={
        <LivestockForm
          trigger={
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Tambah Hewan
            </Button>
          }
        />
      }
    >
      {/* Stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-6 [&>*:last-child:nth-child(odd)]:col-span-2 [&>*:last-child:nth-child(odd)]:sm:col-span-1">
        {stats.map((s) => (
          <Card key={s.type}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {typeLabels[s.type]}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{s.total}</div>
              <div className="flex gap-3 mt-1 text-xs text-muted-foreground">
                <span className="text-primary font-medium">
                  {s.available} tersedia
                </span>
                <span>{s.sold} terjual</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filterable table */}
      <LivestockTableClient livestock={serialized} />
    </DashboardShell>
  );
}
