import { prisma } from "@/lib/prisma";
import { formatRupiah } from "@/lib/format";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { PricingForm } from "@/components/dashboard/pricing-form";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Pencil } from "lucide-react";

export default async function PricingPage() {
  const pricing = await prisma.pricing.findMany({
    orderBy: [{ animalType: "asc" }, { grade: "asc" }],
  });

  const grouped = pricing.reduce(
    (acc, p) => {
      if (!acc[p.animalType]) acc[p.animalType] = [];
      acc[p.animalType].push(p);
      return acc;
    },
    {} as Record<string, typeof pricing>
  );

  const typeLabels: Record<string, string> = {
    KAMBING: "Kambing",
    DOMBA: "Domba",
    SAPI: "Sapi",
  };

  return (
    <DashboardShell
      title="Kelola Harga"
      description="Atur harga beli dan jual per jenis & grade hewan"
      actions={
        <PricingForm
          trigger={
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Tambah Harga
            </Button>
          }
        />
      }
    >
      <div className="grid gap-4">
        {Object.entries(grouped).map(([type, items]) => (
          <Card key={type}>
            <CardHeader>
              <CardTitle>{typeLabels[type] || type}</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="text-left p-3 font-medium">Grade</th>
                      <th className="text-right p-3 font-medium">
                        Harga Beli
                      </th>
                      <th className="text-right p-3 font-medium">
                        Harga Jual
                      </th>
                      <th className="text-right p-3 font-medium">Margin</th>
                      <th className="text-right p-3 font-medium">Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((p) => (
                      <tr key={p.id} className="border-b last:border-0">
                        <td className="p-3 font-medium">{p.grade}</td>
                        <td className="p-3 text-right">
                          {formatRupiah(p.hargaBeli)}
                        </td>
                        <td className="p-3 text-right">
                          {formatRupiah(p.hargaJual)}
                        </td>
                        <td className="p-3 text-right text-primary">
                          {formatRupiah(p.hargaJual - p.hargaBeli)}
                        </td>
                        <td className="p-3 text-right">
                          <PricingForm
                            pricing={p}
                            trigger={
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                            }
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        ))}

        {pricing.length === 0 && (
          <Card>
            <CardContent className="p-8 text-center text-muted-foreground">
              Belum ada data harga. Klik &quot;Tambah Harga&quot; untuk memulai.
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardShell>
  );
}
