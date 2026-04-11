import { prisma } from '@/lib/prisma';
import { formatRupiah } from '@/lib/format';
import { DashboardShell } from '@/components/dashboard/dashboard-shell';
import { LivestockForm } from '@/components/dashboard/livestock-form';
import { LivestockActions } from '@/components/dashboard/livestock-actions';
import { LivestockPhoto } from '@/components/dashboard/livestock-photo';
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
                  <th className="p-3 font-medium w-16"></th>
                  {/* Foto */}
                  <th className="p-3 font-medium text-center">SKU</th>
                  <th className="p-3 font-medium text-center">Jenis</th>
                  <th className="p-3 font-medium text-center">Grade</th>
                  <th className="p-3 font-medium text-center">Berat</th>
                  <th className="p-3 font-medium text-center">Harga</th>
                  <th className="p-3 font-medium text-center">Kondisi</th>
                  <th className="p-3 font-medium text-center">Status</th>
                  <th className="p-3 font-medium text-center">Tag</th>
                  <th className="p-3 font-medium text-left">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {livestock.map((item) => (
                  <tr
                    key={item.id}
                    className="border-b last:border-0 hover:bg-muted/30 transition-colors"
                  >
                    <td className="p-3">
                      <LivestockPhoto
                        photoUrl={item.photoUrl}
                        alt={`${item.type} ${item.grade} - ${item.sku}`}
                      />
                    </td>
                    <td className="p-3 text-center font-mono text-xs">
                      {item.sku}
                    </td>
                    <td className="p-3 text-center">
                      {item.type.charAt(0) + item.type.slice(1).toLowerCase()}
                    </td>
                    <td className="p-3 text-center">
                      <Badge variant="outline">{item.grade}</Badge>
                    </td>
                    <td className="p-3 text-center tabular-nums">
                      {item.weight ? `${item.weight} kg` : '—'}
                    </td>
                    <td className="p-3 text-center tabular-nums">
                      {item.hargaJual ? formatRupiah(item.hargaJual) : '—'}
                    </td>
                    <td className="p-3 text-center">
                      <Badge
                        variant={
                          item.condition === 'SEHAT'
                            ? 'default'
                            : item.condition === 'SAKIT'
                              ? 'secondary'
                              : 'destructive'
                        }
                      >
                        {item.condition.charAt(0) +
                          item.condition.slice(1).toLowerCase()}
                      </Badge>
                    </td>
                    <td className="p-3 text-center">
                      {item.isSold ? (
                        <Badge variant="secondary">Terjual</Badge>
                      ) : (
                        <Badge className="bg-primary/10 text-primary hover:bg-primary/10">
                          Tersedia
                        </Badge>
                      )}
                    </td>
                    <td className="p-3 text-center text-muted-foreground">
                      {item.tag || '—'}
                    </td>
                    <td className="p-3 text-center">
                      <LivestockActions livestock={item} />
                    </td>
                  </tr>
                ))}
                {livestock.length === 0 && (
                  <tr>
                    <td
                      colSpan={10}
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
