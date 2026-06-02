import { notFound } from 'next/navigation';
import { requireRole } from '@/lib/auth';
import { DashboardShell } from '@/components/dashboard/dashboard-shell';
import { formatRupiah } from '@/lib/format';
import { getAllSalesBalances } from '@/app/actions/setoran';
import { getAppConfig } from '@/lib/config/get-config';
import { MarkSetoran } from '@/components/admin/mark-setoran';

export const dynamic = 'force-dynamic';

export default async function AdminSetoranPage() {
  await requireRole('ADMIN', 'SUPER_ADMIN', 'OWNER');
  if (!(await getAppConfig()).setoranEnabled) notFound();
  const balances = await getAllSalesBalances();

  const totalOutstanding = balances.reduce((s, b) => s + b.outstanding, 0);

  return (
    <DashboardShell title="Setoran" description="Uang yang diterima sales langsung dari pembeli (collectedBy = Sales) dan belum disetor ke perusahaan.">
      <div className="rounded-xl border bg-card p-4 mb-6 inline-block">
        <p className="text-xs text-muted-foreground">Total belum disetor</p>
        <p className="text-2xl font-bold tracking-tight text-warning-fg mt-1">{formatRupiah(totalOutstanding)}</p>
      </div>

      <div className="rounded-xl border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40 text-left text-xs text-muted-foreground">
                <th className="px-4 py-2.5 font-medium">Sales</th>
                <th className="px-4 py-2.5 font-medium text-right">Diterima</th>
                <th className="px-4 py-2.5 font-medium text-right">Disetor</th>
                <th className="px-4 py-2.5 font-medium text-right">Sisa</th>
                <th className="px-4 py-2.5 font-medium text-right">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {balances.length === 0 ? (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">Belum ada entry yang ditandai dibayar ke sales.</td></tr>
              ) : (
                balances.map((b) => (
                  <tr key={b.salesId} className="border-b last:border-0">
                    <td className="px-4 py-2.5 font-medium">{b.name}</td>
                    <td className="px-4 py-2.5 text-right">{formatRupiah(b.owed)}</td>
                    <td className="px-4 py-2.5 text-right text-muted-foreground">{formatRupiah(b.paid)}</td>
                    <td className={`px-4 py-2.5 text-right font-semibold ${b.outstanding > 0 ? 'text-warning-fg' : 'text-success-fg'}`}>
                      {formatRupiah(b.outstanding)}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      {b.outstanding > 0 && <MarkSetoran salesId={b.salesId} salesName={b.name} outstanding={b.outstanding} />}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </DashboardShell>
  );
}
