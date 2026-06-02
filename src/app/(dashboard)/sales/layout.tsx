import { requireAuth } from "@/lib/auth";
import { Sidebar } from "@/components/dashboard/sidebar";
import { Footer } from "@/components/footer";
import { getAppConfig } from "@/lib/config/get-config";
import { redirect } from "next/navigation";

export default async function SalesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await requireAuth();

  if (profile.role === "ADMIN") redirect("/admin");
  const cfg = await getAppConfig();

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar role="SALES" userName={profile.name} brandName={cfg.brandName} logoUrl={cfg.logoUrl} setoranEnabled={cfg.setoranEnabled} rekBank={profile.rekBank} />
      <main className="flex-1 overflow-auto flex flex-col">
        <div className="flex-1">{children}</div>
        <Footer />
      </main>
    </div>
  );
}
