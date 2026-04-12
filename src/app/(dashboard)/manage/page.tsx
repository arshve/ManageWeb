import { requireRole } from '@/lib/auth';
import { LivestockTable } from '@/components/dashboard/livestock-table';

export default async function ManagePage() {
  await requireRole('ADMIN', 'MANAGE');
  return <LivestockTable />;
}
