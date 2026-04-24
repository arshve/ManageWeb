import { requireRole } from '@/lib/auth';
import { LivestockTable } from '@/components/dashboard/livestock-table';

export default async function AdminLivestockPage() {
  await requireRole('ADMIN', 'MANAGE', 'SUPER_ADMIN');
  return <LivestockTable />;
}
