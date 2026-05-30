import { requireRole } from '@/lib/auth';
import { DashboardShell } from '@/components/dashboard/dashboard-shell';
import { getAppConfig } from '@/lib/config/get-config';
import { BrandingForm } from '@/components/admin/owner/branding-form';

export default async function BrandingPage() {
  await requireRole('OWNER');
  const config = await getAppConfig();

  return (
    <DashboardShell title="Branding" description="Konfigurasi white-label: identitas, logo, warna, dan detail legal">
      <BrandingForm config={config} />
    </DashboardShell>
  );
}
