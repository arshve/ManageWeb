import { requireAuth } from "@/lib/auth";
import { Sidebar } from "@/components/dashboard/sidebar";
import { Footer } from "@/components/footer";
import { redirect } from "next/navigation";

export default async function SalesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await requireAuth();

  if (profile.role === "ADMIN") redirect("/admin");

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar role="SALES" userName={profile.name} />
      <main className="flex-1 overflow-auto flex flex-col">
        <div className="flex-1">{children}</div>
        <Footer />
      </main>
    </div>
  );
}
