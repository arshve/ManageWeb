import { requireRole } from "@/lib/auth";
import { Sidebar } from "@/components/dashboard/sidebar";
import { Footer } from "@/components/footer";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await requireRole("ADMIN", "SUPER_ADMIN");

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar role={profile.role as 'ADMIN' | 'SUPER_ADMIN'} userName={profile.name} />
      <main className="flex-1 overflow-auto flex flex-col">
        <div className="flex-1">{children}</div>
        <Footer />
      </main>
    </div>
  );
}
