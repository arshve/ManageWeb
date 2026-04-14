/**
 * Server Actions: User Management
 *
 * CRUD operations for managing user accounts (profiles).
 * All operations are admin-only. Passwords are hashed with bcryptjs
 * before storing in the database (never stored as plain text).
 *
 * Roles:
 * - ADMIN: Full access to dashboard, can manage users, livestock, entries, pricing
 * - SALES: Can only create entries and view their own entries
 */

"use server";

import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { hashSync } from "bcryptjs";
import { logAudit } from "@/lib/audit";

/**
 * Creates a new user account. Admin-only.
 * Checks for duplicate username before creating.
 * Password is hashed with bcryptjs (10 salt rounds) before storage.
 *
 * @param formData - Form data with username, password, name, phone, role
 * @returns { success } or { error: "Username sudah terdaftar" }
 */
export async function createUser(formData: FormData) {
  const actor = await requireRole("ADMIN");

  const username = formData.get("username") as string;
  const password = formData.get("password") as string;
  const name = formData.get("name") as string;
  const phone = (formData.get("phone") as string) || null;
  const role = (formData.get("role") as "ADMIN" | "SALES" | "MANAGE" | "DRIVER") || "SALES";

  // Check for duplicate username
  const existing = await prisma.profile.findUnique({ where: { username } });
  if (existing) {
    return { error: "Username sudah terdaftar" };
  }

  const created = await prisma.profile.create({
    data: {
      username,
      password: hashSync(password, 10), // Hash password before storing
      name,
      phone,
      role,
    },
  });

  await logAudit({
    actor,
    action: "CREATE",
    entity: "Profile",
    entityId: created.id,
    label: `${created.username} — ${created.name}`,
    after: created,
  });

  revalidatePath("/admin/users");
  return { success: true };
}

/**
 * Updates an existing user's profile. Admin-only.
 * Password change is optional — only re-hashes if a new password is provided
 * and is at least 4 characters long.
 *
 * @param id - The user profile ID to update
 * @param formData - Updated form data (name, phone, role, isActive, newPassword)
 * @returns { success }
 */
export async function updateUser(id: string, formData: FormData) {
  const actor = await requireRole("ADMIN");

  const before = await prisma.profile.findUnique({ where: { id } });
  if (!before) return { error: "User tidak ditemukan" };

  const name = formData.get("name") as string;
  const phone = (formData.get("phone") as string) || null;
  const role = formData.get("role") as "ADMIN" | "SALES";
  const isActive = formData.get("isActive") === "true";
  const newPassword = formData.get("newPassword") as string;

  const data: Record<string, unknown> = { name, phone, role, isActive };

  // Only update password if a new one was provided
  if (newPassword && newPassword.length >= 4) {
    data.password = hashSync(newPassword, 10);
  }

  const updated = await prisma.profile.update({
    where: { id },
    data,
  });

  await logAudit({
    actor,
    action: "UPDATE",
    entity: "Profile",
    entityId: id,
    label: `${updated.username} — ${updated.name}`,
    before,
    after: { ...updated, passwordChanged: Boolean(data.password) },
  });

  revalidatePath("/admin/users");
  return { success: true };
}

/**
 * Toggles a user's active status. Admin-only.
 * Deactivated users cannot log in (blocked at the login API).
 * This is a soft-delete alternative — the account and data are preserved.
 *
 * @param id - The user profile ID
 * @param isActive - true to activate, false to deactivate
 * @returns { success }
 */
export async function toggleUserActive(id: string, isActive: boolean) {
  const actor = await requireRole("ADMIN");

  const before = await prisma.profile.findUnique({ where: { id } });
  if (!before) return { error: "User tidak ditemukan" };

  await prisma.profile.update({
    where: { id },
    data: { isActive },
  });

  await logAudit({
    actor,
    action: "UPDATE",
    entity: "Profile",
    entityId: id,
    label: `${before.username} — ${isActive ? 'aktif' : 'nonaktif'}`,
    before: { isActive: before.isActive },
    after: { isActive },
  });

  revalidatePath("/admin/users");
  return { success: true };
}
