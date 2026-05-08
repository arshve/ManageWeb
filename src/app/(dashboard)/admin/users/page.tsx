import { prisma } from "@/lib/prisma";
import { requireAuth, isSuperAdmin } from "@/lib/auth";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { UserForm } from "@/components/dashboard/user-form";
import { UsersAdminView } from "@/components/dashboard/users-admin-view";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

export default async function UsersPage() {
  const profile = await requireAuth();
  const superAdmin = isSuperAdmin(profile.role);
  const users = await prisma.profile.findMany({
    where: superAdmin ? undefined : { role: { not: 'SUPER_ADMIN' } },
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
          isSuperAdmin={superAdmin}
          trigger={
            <Button>
              <Plus className="size-4 mr-2" />
              Tambah User
            </Button>
          }
        />
      }
    >
      <UsersAdminView users={users} isSuperAdmin={superAdmin} />
    </DashboardShell>
  );
}
