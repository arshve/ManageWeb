import { prisma } from '@/lib/prisma';
import { DashboardShell } from '@/components/dashboard/dashboard-shell';
import { LivestockForm } from '@/components/dashboard/livestock-form';
import { LivestockActions } from '@/components/dashboard/livestock-actions';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Plus } from 'lucide-react';

export default async function LivestockPage() {
  const livestock = await prisma.livestock.findMany({
    orderBy: { createdAt: 'desc' },
    include: { entry: { select: { id: true, status: true } } },
  });

  return (
    <DashboardShell
      title="Kelola Hewan"
      description={`${livestock.length} hewan terdaftar`}
      actions={
        <LivestockForm
          trigger={
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Tambah Hewan
            </Button>
          }
        />
      }
    >
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left p-3 font-medium">SKU</th>
                  <th className="text-left p-3 font-medium">Jenis</th>
                  <th className="text-left p-3 font-medium">Grade</th>
                  <th className="text-left p-3 font-medium">Berat</th>
                  <th className="text-left p-3 font-medium">Kondisi</th>
                  <th className="text-left p-3 font-medium">Status</th>
                  <th className="text-left p-3 font-medium">Tag</th>
                  <th className="text-center p-3 font-medium">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {livestock.map((item) => (
                  <tr key={item.id} className="border-b last:border-0">
                    <td className="p-3 font-mono text-xs">{item.sku}</td>
                    <td className="p-3">{item.type}</td>
                    <td className="p-3">
                      <Badge variant="outline">{item.grade}</Badge>
                    </td>
                    <td className="p-3">
                      {item.weight ? `${item.weight} kg` : '-'}
                    </td>
                    <td className="p-3">
                      <Badge
                        variant={
                          item.condition === 'SEHAT'
                            ? 'default'
                            : item.condition === 'SAKIT'
                              ? 'secondary'
                              : 'destructive'
                        }
                      >
                        {item.condition}
                      </Badge>
                    </td>
                    <td className="p-3">
                      {item.isSold ? (
                        <Badge variant="secondary">Terjual</Badge>
                      ) : (
                        <Badge className="bg-primary/10 text-primary hover:bg-primary/10">
                          Tersedia
                        </Badge>
                      )}
                    </td>
                    <td className="p-3 text-xs text-muted-foreground">
                      {[item.tagBsd, item.tagKandang, item.tagMf]
                        .filter(Boolean)
                        .join(' / ') || '-'}
                    </td>
                    <td className="p-3 text-right">
                      <LivestockActions livestock={item} />
                    </td>
                  </tr>
                ))}
                {livestock.length === 0 && (
                  <tr>
                    <td
                      colSpan={8}
                      className="p-8 text-center text-muted-foreground"
                    >
                      Belum ada hewan terdaftar.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </DashboardShell>
  );
}
