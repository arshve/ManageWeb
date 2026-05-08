import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { PricingForm } from "@/components/dashboard/pricing-form";
import { PricingAdminView } from "@/components/dashboard/pricing-admin-view";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

export default async function PricingPage() {
  await requireRole('SUPER_ADMIN');
  const pricing = await prisma.pricing.findMany({
    where: { animalType: { not: 'SAPI' } },
    orderBy: [{ animalType: "asc" }, { grade: "asc" }],
  });

  return (
    <DashboardShell
      title="Kelola Harga"
      description="Atur harga beli dan jual per jenis & grade hewan"
      actions={
        <PricingForm
          trigger={
            <Button>
              <Plus className="size-4 mr-2" />
              Tambah Harga
            </Button>
          }
        />
      }
    >
      <PricingAdminView pricing={pricing} />
    </DashboardShell>
  );
}
