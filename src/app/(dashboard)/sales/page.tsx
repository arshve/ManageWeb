import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { formatRupiah, formatDateTime } from "@/lib/format";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Plus, DollarSign, ClipboardList, Clock } from "lucide-react";
import Link from "next/link";

export default async function SalesPage() {
  const profile = await requireAuth();

  const entries = await prisma.entry.findMany({
    where: { salesId: profile.id },
    orderBy: { createdAt: "desc" },
    include: { livestock: true },
  });

  const approved = entries.filter((e) => e.status === "APPROVED");
  const pending = entries.filter((e) => e.status === "PENDING");
  const totalEarnings = approved.reduce(
    (sum, e) => sum + (e.resellerCut ?? 0),
    0
  );
  const totalSales = approved.reduce((sum, e) => sum + e.hargaJual, 0);

  return (
    <DashboardShell
      title={`Halo, ${profile.name}`}
      description="Ringkasan entry dan penghasilan kamu"
      actions={
        <Link href="/sales/new" className={buttonVariants()}>
          <Plus className="h-4 w-4 mr-2" />
          Tambah Entry
        </Link>
      }
    >
      {/* Earnings Summary */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-3 mb-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Komisi
            </CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">
              {formatRupiah(totalEarnings)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Dari {approved.length} penjualan disetujui
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Penjualan
            </CardTitle>
            <ClipboardList className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatRupiah(totalSales)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {entries.length} entry total
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Menunggu Approval
            </CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">
              {pending.length}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Entry belum disetujui
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Entries List */}
      <Card>
        <CardHeader>
          <CardTitle>Entry Saya</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left p-3 font-medium">Invoice</th>
                  <th className="text-left p-3 font-medium">Hewan</th>
                  <th className="text-left p-3 font-medium">Pembeli</th>
                  <th className="text-right p-3 font-medium">Harga Jual</th>
                  <th className="text-left p-3 font-medium">Bayar</th>
                  <th className="text-left p-3 font-medium">Status</th>
                  <th className="text-left p-3 font-medium">Tanggal</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry) => (
                  <tr key={entry.id} className="border-b last:border-0">
                    <td className="p-3 font-mono text-xs">
                      {entry.invoiceNo}
                    </td>
                    <td className="p-3">
                      {entry.livestock.type} {entry.livestock.grade}
                    </td>
                    <td className="p-3">{entry.buyerName}</td>
                    <td className="p-3 text-right">
                      {formatRupiah(entry.hargaJual)}
                    </td>
                    <td className="p-3">
                      <Badge
                        variant={
                          entry.paymentStatus === "LUNAS"
                            ? "default"
                            : entry.paymentStatus === "DP"
                              ? "secondary"
                              : "outline"
                        }
                      >
                        {entry.paymentStatus === "BELUM_BAYAR"
                          ? "Belum"
                          : entry.paymentStatus}
                      </Badge>
                    </td>
                    <td className="p-3">
                      <Badge
                        variant={
                          entry.status === "APPROVED"
                            ? "default"
                            : entry.status === "PENDING"
                              ? "secondary"
                              : "destructive"
                        }
                      >
                        {entry.status}
                      </Badge>
                    </td>
                    <td className="p-3 text-xs text-muted-foreground whitespace-nowrap">
                      {formatDateTime(entry.createdAt)}
                    </td>
                  </tr>
                ))}
                {entries.length === 0 && (
                  <tr>
                    <td
                      colSpan={7}
                      className="p-8 text-center text-muted-foreground"
                    >
                      Belum ada entry. Klik &quot;Tambah Entry&quot; untuk
                      memulai.
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
