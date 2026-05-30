/**
 * Authentication Helpers (Server-side)
 *
 * These functions are used in Server Components and Server Actions to check
 * who is logged in and enforce access control. They work by reading the
 * JWT session cookie and looking up the user in the database.
 *
 * Usage pattern in pages/actions:
 *   const profile = await requireAuth();              // redirects to /login if not logged in
 *   const admin = await requireRole("ADMIN", "SUPER_ADMIN");          // redirects to /unauthorized if not admin
 *   const u = await requireRole("ADMIN", "MANAGE");   // accepts either role
 */

import { cache } from 'react';
import { prisma } from '@/lib/prisma';
import { redirect } from 'next/navigation';
import { getSessionUserId } from '@/lib/session';
import type { Role } from '@/generated/prisma';

export const getProfile = cache(async function getProfile() {
  const userId = await getSessionUserId();
  if (!userId) return null;

  const profile = await prisma.profile.findUnique({
    where: { id: userId },
  });

  return profile;
});

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
 * await requireRole("ADMIN", "SUPER_ADMIN");               // admin only
 * await requireRole("ADMIN", "MANAGE");     // admin or manage
 */
export async function requireRole(...roles: Role[]) {
  const profile = await requireAuth();
  // OWNER is the top role — it inherits every ADMIN / SUPER_ADMIN gate so we
  // don't have to add 'OWNER' to ~30 call sites. (OWNER is intentionally NOT
  // granted SALES/MANAGE/DRIVER-only routes.)
  if (profile.role === 'OWNER' && (roles.includes('SUPER_ADMIN') || roles.includes('ADMIN'))) {
    return profile;
  }
  if (!roles.includes(profile.role)) redirect('/unauthorized');
  return profile;
}

export function dashboardUrlForRole(role: Role | string): string {
  switch (role) {
    case 'OWNER':
    case 'SUPER_ADMIN':
    case 'ADMIN':
      return '/admin';
    case 'MANAGE':
      return '/manage';
    case 'DRIVER':
      return '/driver';
    default:
      return '/sales';
  }
}

export function isAdminRole(role: Role | string): boolean {
  return role === 'ADMIN' || role === 'SUPER_ADMIN' || role === 'OWNER';
}

export function isSuperAdmin(role: Role | string): boolean {
  return role === 'SUPER_ADMIN' || role === 'OWNER';
}

export function isOwner(role: Role | string): boolean {
  return role === 'OWNER';
}
