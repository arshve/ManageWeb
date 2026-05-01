import { requireAuth, isSuperAdmin } from '@/lib/auth';
import { AdminNewEntryForm } from './form';

export default async function AdminNewEntryPage() {
  const profile = await requireAuth();
  const canViewFinancials = isSuperAdmin(profile.role);
  return <AdminNewEntryForm canViewFinancials={canViewFinancials} />;
}
