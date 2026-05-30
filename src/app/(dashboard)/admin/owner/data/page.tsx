import { requireRole } from '@/lib/auth';
import { DashboardShell } from '@/components/dashboard/dashboard-shell';
import { DataTransferView } from '@/components/admin/owner/data-transfer-view';

export default async function OwnerDataPage() {
  await requireRole('OWNER');

  return (
    <DashboardShell title="Data" description="Ekspor & impor seluruh data aplikasi (backup / migrasi tenant)">
      <DataTransferView />
    </DashboardShell>
  );
}
