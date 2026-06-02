import { requireAuth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { DashboardShell } from '@/components/dashboard/dashboard-shell';
import { formatRupiah } from '@/lib/format';
import { getSalesBalance } from '@/app/actions/setoran';
import { PaySetoran } from '@/components/dashboard/pay-setoran';

export const dynamic = 'force-dynamic';

export default async function SalesSetoranPage() {
  const profile = await requireAuth();
  const [{ owed, paid, outstanding }, history] = await Promise.all([
    getSalesBalance(profile.id),
    prisma.setoran.findMany({ where: { salesId: profile.id }, orderBy: { createdAt: 'desc' }, take: 20 }),
  ]);

  return (
    <DashboardShell title="Setoran" description="Penjualan yang Anda terima langsung dari pembeli — wajib disetor ke perusahaan.">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
        <Stat label="Total diterima (dari pembeli)" value={owed} />
        <Stat label="Sudah disetor" value={paid} tone="muted" />
        <Stat label="Belum disetor" value={outstanding} tone={outstanding > 0 ? 'warn' : 'ok'} />
      </div>

      <div className="rounded-xl border bg-card p-5 mb-6">
        <h2 className="text-sm font-semibold mb-1">Bayar setoran</h2>
        <p className="text-xs text-muted-foreground mb-3">Bayar via QRIS / Virtual Account / e-wallet — langsung masuk ke rekening perusahaan.</p>
        <PaySetoran outstanding={outstanding} />
      </div>

      <div className="rounded-xl border bg-card overflow-hidden">
        <div className="px-4 py-3 border-b"><h2 className="text-sm font-semibold">Riwayat setoran</h2></div>
        {history.length === 0 ? (
          <p className="px-4 py-6 text-sm text-muted-foreground text-center">Belum ada setoran.</p>
        ) : (
          <ul className="divide-y">
            {history.map((s) => (
              <li key={s.id} className="flex items-center justify-between px-4 py-2.5 text-sm">
                <div>
                  <span className="font-semibold">{formatRupiah(s.amount)}</span>
                  <span className="ml-2 text-xs text-muted-foreground">
                    {s.method === 'GATEWAY' ? 'Gateway' : 'Manual'} · {new Date(s.createdAt).toLocaleDateString('id-ID')}
                    {s.orderId ? ` · ${s.orderId}` : ''}
                  </span>
                </div>
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${s.status === 'PAID' ? 'bg-success-bg text-success-fg' : 'bg-warning-bg text-warning-fg'}`}>
                  {s.status === 'PAID' ? 'Lunas' : 'Pending'}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </DashboardShell>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: 'warn' | 'ok' | 'muted' }) {
  const color = tone === 'warn' ? 'text-warning-fg' : tone === 'ok' ? 'text-success-fg' : 'text-foreground';
  return (
    <div className="rounded-xl border bg-card p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`text-2xl font-bold tracking-tight mt-1 ${color}`}>{formatRupiah(value)}</p>
    </div>
  );
}
