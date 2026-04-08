/**
 * POST /api/auth/logout
 *
 * Logs the user out by deleting the session cookie.
 * The frontend calls this when the user clicks "Logout" in the sidebar,
 * then redirects to /login.
 */

import { deleteSession } from "@/lib/session";
import { NextResponse } from "next/server";

export async function POST() {
  await deleteSession();
  return NextResponse.json({ success: true });
}
