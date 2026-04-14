import { requireRole } from '@/lib/auth';
import { Sidebar } from '@/components/dashboard/sidebar';

export default async function DriverLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await requireRole('DRIVER');

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar role="DRIVER" userName={profile.name} />
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  );
}
