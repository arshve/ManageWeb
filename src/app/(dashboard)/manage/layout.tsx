import { requireRole } from '@/lib/auth';
import { Sidebar } from '@/components/dashboard/sidebar';
import { Footer } from '@/components/footer';

export default async function ManageLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await requireRole('ADMIN', 'MANAGE', 'SUPER_ADMIN');

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar role="MANAGE" userName={profile.name} />
      <main className="flex-1 overflow-auto flex flex-col">
        <div className="flex-1">{children}</div>
        <Footer />
      </main>
    </div>
  );
}
