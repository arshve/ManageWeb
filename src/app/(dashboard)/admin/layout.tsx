import { requireRole } from "@/lib/auth";
import { Sidebar } from "@/components/dashboard/sidebar";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await requireRole("ADMIN");

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar role="ADMIN" userName={profile.name} />
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  );
}
