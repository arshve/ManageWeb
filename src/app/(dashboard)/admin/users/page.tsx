import { prisma } from "@/lib/prisma";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { UserForm } from "@/components/dashboard/user-form";
import { UserToggle } from "@/components/dashboard/user-toggle";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Plus, Pencil } from "lucide-react";
import { formatDate } from "@/lib/format";

export default async function UsersPage() {
  const users = await prisma.profile.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { entries: true } },
    },
  });

  return (
    <DashboardShell
      title="Kelola User"
      description={`${users.length} user terdaftar`}
      actions={
        <UserForm
          trigger={
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Tambah User
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
                  <th className="text-left p-3 font-medium">Nama</th>
                  <th className="text-left p-3 font-medium">Username</th>
                  <th className="text-left p-3 font-medium">Telepon</th>
                  <th className="text-left p-3 font-medium">Role</th>
                  <th className="text-center p-3 font-medium">Entry</th>
                  <th className="text-left p-3 font-medium">Terdaftar</th>
                  <th className="text-center p-3 font-medium">Aktif</th>
                  <th className="text-right p-3 font-medium">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id} className="border-b last:border-0">
                    <td className="p-3 font-medium">{user.name}</td>
                    <td className="p-3 text-muted-foreground">{user.username}</td>
                    <td className="p-3">{user.phone || "-"}</td>
                    <td className="p-3">
                      <Badge
                        variant={
                          user.role === "ADMIN" ? "default" : "secondary"
                        }
                      >
                        {user.role}
                      </Badge>
                    </td>
                    <td className="p-3 text-center">{user._count.entries}</td>
                    <td className="p-3 text-xs text-muted-foreground">
                      {formatDate(user.createdAt)}
                    </td>
                    <td className="p-3 text-center">
                      <UserToggle userId={user.id} isActive={user.isActive} />
                    </td>
                    <td className="p-3 text-right">
                      <UserForm
                        user={user}
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
                {users.length === 0 && (
                  <tr>
                    <td
                      colSpan={8}
                      className="p-8 text-center text-muted-foreground"
                    >
                      Belum ada user terdaftar.
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
