/**
 * LivestockTable — Shared server component for livestock management.
 *
 * Fetches data, computes stats, renders stat cards + the filterable client table.
 * Used by /admin/livestock, /manage, and /sales/catalogue (read-only) pages.
 */

import { prisma } from '@/lib/prisma';
import { requireAuth, isSuperAdmin } from '@/lib/auth';
import { DashboardShell } from '@/components/dashboard/dashboard-shell';
import { LivestockForm, type PricingMap } from '@/components/dashboard/livestock-form';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';

const SERIF = "var(--font-dm-serif), 'DM Serif Display', serif";
import { LivestockTableClient } from '@/components/dashboard/livestock-table-client';

export async function LivestockTable({
  readOnly = false,
}: {
  readOnly?: boolean;
} = {}) {
  const profile = await requireAuth();
  const superAdmin = isSuperAdmin(profile.role);
  const [livestock, pricingRows] = await Promise.all([
    prisma.livestock.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        entryItem: {
          select: {
            entry: {
              select: {
                id: true,
                status: true,
                buyerName: true,
                sales: { select: { name: true } },
                delivery: {
                  select: {
                    status: true,
                    driver: { select: { name: true } },
                  },
                },
              },
            },
          },
        },
      },
    }),
    prisma.pricing.findMany({
      select: { animalType: true, grade: true, hargaBeli: true, hargaJual: true },
    }),
  ]);
  const pricingTemplate: PricingMap = Object.fromEntries(
    pricingRows.map((p) => [`${p.animalType}-${p.grade}`, { hargaBeli: p.hargaBeli, hargaJual: p.hargaJual }]),
  );

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
    hargaModal: item.hargaModal,
    tag: item.tag,
    photoUrl: item.photoUrl,
    notes: item.notes,
    isSold: item.isSold,
    buyerName: item.entryItem?.entry?.buyerName ?? null,
    salesName: item.entryItem?.entry?.sales?.name ?? null,
    driverName: item.entryItem?.entry?.delivery?.driver?.name ?? null,
    deliveryStatus: item.entryItem?.entry?.delivery?.status ?? null,
  }));

  return (
    <DashboardShell
      title={readOnly ? 'Katalog Hewan' : 'Kelola Hewan'}
      description={`${livestock.length} hewan terdaftar, ${totalSold} terjual`}
      actions={
        readOnly ? undefined : (
          <LivestockForm
            pricingTemplate={pricingTemplate}
            trigger={
              <Button>
                <Plus className="size-4 mr-2" />
                Tambah Hewan
              </Button>
            }
          />
        )
      }
    >
      {/* Stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6 [&>*:last-child:nth-child(odd)]:col-span-2 [&>*:last-child:nth-child(odd)]:sm:col-span-1">
        {stats.map((s) => {
          const pct = s.total > 0 ? Math.round((s.available / s.total) * 100) : 0;
          return (
            <div key={s.type} className="rounded-xl border bg-card px-5 py-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
                  {typeLabels[s.type]}
                </span>
                {s.total > 0 && (
                  <span className="text-[10px] text-muted-foreground">{pct}% tersedia</span>
                )}
              </div>
              <p className="text-3xl font-bold mb-2.5" style={{ fontFamily: SERIF }}>
                {s.total}
              </p>
              <div className="h-1.5 rounded-full overflow-hidden bg-muted mb-2">
                <div
                  className="h-full rounded-full transition-all"
                  style={{ width: `${pct}%`, background: 'var(--success-ring)' }}
                />
              </div>
              <div className="flex gap-3 text-[11px]">
                <span style={{ color: 'var(--success-ring)', fontWeight: 500 }}>
                  {s.available} tersedia
                </span>
                <span className="text-muted-foreground">{s.sold} terjual</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Filterable table */}
      <LivestockTableClient livestock={serialized} pricingTemplate={pricingTemplate} readOnly={readOnly} canViewFinancials={superAdmin} />
    </DashboardShell>
  );
}
