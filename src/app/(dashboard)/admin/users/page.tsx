import { prisma } from "@/lib/prisma";
import { requireAuth, isSuperAdmin, isOwner } from "@/lib/auth";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { UserForm } from "@/components/dashboard/user-form";
import { UsersAdminView } from "@/components/dashboard/users-admin-view";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import type { Role } from "@/generated/prisma";

export default async function UsersPage() {
  const profile = await requireAuth();
  const superAdmin = isSuperAdmin(profile.role);
  const owner = isOwner(profile.role);
  // Owner sees everyone; super-admin sees all except OWNER; others hide both
  // OWNER and SUPER_ADMIN rows.
  const hiddenRoles: Role[] = owner ? [] : superAdmin ? ['OWNER'] : ['OWNER', 'SUPER_ADMIN'];
  const users = await prisma.profile.findMany({
    where: hiddenRoles.length ? { role: { notIn: hiddenRoles } } : undefined,
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
          isOwner={owner}
          trigger={
            <Button>
              <Plus className="size-4 mr-2" />
              Tambah User
            </Button>
          }
        />
      }
    >
      <UsersAdminView users={users} isSuperAdmin={superAdmin} isOwner={owner} />
    </DashboardShell>
  );
}
