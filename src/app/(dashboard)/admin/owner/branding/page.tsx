import { requireRole } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { DashboardShell } from '@/components/dashboard/dashboard-shell';
import { getAppConfig } from '@/lib/config/get-config';
import { BrandingForm } from '@/components/admin/owner/branding-form';

export default async function BrandingPage() {
  await requireRole('OWNER');
  const [config, salesUsers] = await Promise.all([
    getAppConfig(),
    // Candidates for the public-catalogue sales account: sales + the house account.
    prisma.profile.findMany({
      where: { role: 'SALES' },
      select: { id: true, name: true, username: true, isActive: true },
      orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
    }),
  ]);

  return (
    <DashboardShell title="Branding & Config" description="White-label: identitas, logo, warna, detail legal, dan konfigurasi pembayaran/penjualan publik">
      <BrandingForm config={config} salesUsers={salesUsers} />
    </DashboardShell>
  );
}
