import { requireRole } from '@/lib/auth';
import { LivestockTable } from '@/components/dashboard/livestock-table';

export default async function SalesCataloguePage() {
  await requireRole('SALES');
  return <LivestockTable readOnly />;
}
