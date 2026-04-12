import { requireRole } from '@/lib/auth';
import { Sidebar } from '@/components/dashboard/sidebar';

export default async function ManageLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await requireRole('ADMIN', 'MANAGE');

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar role="MANAGE" userName={profile.name} />
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  );
}
