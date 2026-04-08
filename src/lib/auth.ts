/**
 * Authentication Helpers (Server-side)
 *
 * These functions are used in Server Components and Server Actions to check
 * who is logged in and enforce access control. They work by reading the
 * JWT session cookie and looking up the user in the database.
 *
 * Usage pattern in pages/actions:
 *   const profile = await requireAuth();     // redirects to /login if not logged in
 *   const admin = await requireRole("ADMIN"); // redirects to /unauthorized if not admin
 */

import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { getSessionUserId } from "@/lib/session";
import type { Role } from "@/generated/prisma/client";

/**
 * Returns the current user's profile or null if not logged in.
 * Does NOT redirect — use this when you want to optionally show
 * different content for logged-in vs anonymous users.
 *
 * @returns The full Profile object from the database, or null
 */
export async function getProfile() {
  const userId = await getSessionUserId();
  if (!userId) return null;

  const profile = await prisma.profile.findUnique({
    where: { id: userId },
  });

  return profile;
}

/**
 * Requires the user to be logged in. If not, redirects to /login.
 * Use this in any page or action that needs an authenticated user.
 *
 * @returns The authenticated user's Profile object
 * @throws Redirects to /login if no valid session
 */
export async function requireAuth() {
  const profile = await getProfile();
  if (!profile) redirect("/login");
  return profile;
}

/**
 * Requires the user to have a specific role (ADMIN or SALES).
 * First checks authentication (redirects to /login if not logged in),
 * then checks the role (redirects to /unauthorized if wrong role).
 *
 * @param role - The required role ("ADMIN" or "SALES")
 * @returns The authenticated user's Profile object with matching role
 * @throws Redirects to /login or /unauthorized
 */
export async function requireRole(role: Role) {
  const profile = await requireAuth();
  if (profile.role !== role) redirect("/unauthorized");
  return profile;
}
