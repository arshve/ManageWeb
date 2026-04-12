/**
 * Authentication Helpers (Server-side)
 *
 * These functions are used in Server Components and Server Actions to check
 * who is logged in and enforce access control. They work by reading the
 * JWT session cookie and looking up the user in the database.
 *
 * Usage pattern in pages/actions:
 *   const profile = await requireAuth();              // redirects to /login if not logged in
 *   const admin = await requireRole("ADMIN");          // redirects to /unauthorized if not admin
 *   const u = await requireRole("ADMIN", "MANAGE");   // accepts either role
 */

import { prisma } from '@/lib/prisma';
import { redirect } from 'next/navigation';
import { getSessionUserId } from '@/lib/session';
import type { Role } from '@/generated/prisma';

export async function getProfile() {
  const userId = await getSessionUserId();
  if (!userId) return null;

  const profile = await prisma.profile.findUnique({
    where: { id: userId },
  });

  return profile;
}

export async function requireAuth() {
  const profile = await getProfile();
  if (!profile) redirect('/login');
  return profile;
}

/**
 * Requires the user to have one of the specified roles.
 * Accepts one or more roles — redirects to /unauthorized if none match.
 *
 * @param roles - One or more required roles
 * @returns The authenticated user's Profile object
 *
 * @example
 * await requireRole("ADMIN");               // admin only
 * await requireRole("ADMIN", "MANAGE");     // admin or manage
 */
export async function requireRole(...roles: Role[]) {
  const profile = await requireAuth();
  if (!roles.includes(profile.role)) redirect('/unauthorized');
  return profile;
}
