import { prisma } from "@/lib/prisma";
import { formatRupiah } from "@/lib/format";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Beef, ClipboardList, DollarSign, Users } from "lucide-react";

export default async function AdminDashboardPage() {
  const [
    totalLivestock,
    soldLivestock,
    totalEntries,
    pendingEntries,
    totalSales,
    entries,
  ] = await Promise.all([
    prisma.livestock.count(),
    prisma.livestock.count({ where: { isSold: true } }),
    prisma.entry.count(),
    prisma.entry.count({ where: { status: "PENDING" } }),
    prisma.profile.count({ where: { role: "SALES", isActive: true } }),
    prisma.entry.findMany({
      where: { status: "APPROVED" },
      select: { hargaJual: true, hargaModal: true, profit: true },
    }),
  ]);

  const totalRevenue = entries.reduce((sum, e) => sum + e.hargaJual, 0);
  const totalProfit = entries.reduce((sum, e) => sum + (e.profit ?? 0), 0);
  const totalModal = entries.reduce((sum, e) => sum + (e.hargaModal ?? 0), 0);

  const recentEntries = await prisma.entry.findMany({
    take: 10,
    orderBy: { createdAt: "desc" },
    include: { livestock: true, sales: true },
  });

  const stats = [
    {
      title: "Total Hewan",
      value: totalLivestock,
      sub: `${soldLivestock} terjual`,
      icon: Beef,
    },
    {
      title: "Entry Penjualan",
      value: totalEntries,
      sub: `${pendingEntries} menunggu approval`,
      icon: ClipboardList,
    },
    {
      title: "Total Revenue",
      value: formatRupiah(totalRevenue),
      sub: `Modal: ${formatRupiah(totalModal)}`,
      icon: DollarSign,
    },
    {
      title: "Total Profit",
      value: formatRupiah(totalProfit),
      sub: `${totalSales} sales aktif`,
      icon: Users,
    },
  ];

  return (
    <DashboardShell
      title="Dashboard"
      description="Ringkasan data Millenials Farm"
    >
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 mb-6">
        {stats.map((stat) => (
          <Card key={stat.title}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {stat.title}
              </CardTitle>
              <stat.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
              <p className="text-xs text-muted-foreground mt-1">{stat.sub}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Entry Terbaru</CardTitle>
        </CardHeader>
        <CardContent>
          {recentEntries.length === 0 ? (
            <p className="text-muted-foreground text-sm">Belum ada entry.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="pb-2 font-medium">Invoice</th>
                    <th className="pb-2 font-medium">Hewan</th>
                    <th className="pb-2 font-medium">Pembeli</th>
                    <th className="pb-2 font-medium">Sales</th>
                    <th className="pb-2 font-medium">Harga Jual</th>
                    <th className="pb-2 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {recentEntries.map((entry) => (
                    <tr key={entry.id} className="border-b last:border-0">
                      <td className="py-2 font-mono text-xs">
                        {entry.invoiceNo}
                      </td>
                      <td className="py-2">
                        {entry.livestock.type} - {entry.livestock.grade}
                      </td>
                      <td className="py-2">{entry.buyerName}</td>
                      <td className="py-2">{entry.sales.name}</td>
                      <td className="py-2">
                        {formatRupiah(entry.hargaJual)}
                      </td>
                      <td className="py-2">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                            entry.status === "APPROVED"
                              ? "bg-primary/10 text-primary"
                              : entry.status === "PENDING"
                                ? "bg-yellow-100 text-yellow-800"
                                : "bg-destructive/10 text-destructive"
                          }`}
                        >
                          {entry.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </DashboardShell>
  );
}
