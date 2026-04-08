/**
 * Auth Middleware (Route Protection)
 *
 * This runs on EVERY request via Next.js proxy (src/proxy.ts).
 * It checks the JWT cookie and decides whether to allow or redirect:
 *
 * - /admin/* and /sales/* routes → require valid session, redirect to /login if not
 * - /login → if already logged in, redirect to /admin (avoid showing login page)
 * - All other routes → pass through (public pages like /, /catalogue)
 *
 * This is separate from auth.ts because middleware runs in the Edge Runtime
 * (before the page renders), while auth.ts runs in the Node.js runtime
 * (during page rendering). Middleware can't access Prisma, so it only
 * verifies the JWT is valid — it doesn't check the database.
 */

import { NextResponse, type NextRequest } from "next/server";
import { jwtVerify } from "jose";

const SECRET = new TextEncoder().encode(
  process.env.SESSION_SECRET || "millenials-farm-dev-secret-change-in-prod"
);

const COOKIE_NAME = "mf-session";

/**
 * Verifies the session cookie and handles route protection.
 * Called by proxy.ts on every incoming request.
 *
 * @param request - The incoming HTTP request from Next.js
 * @returns NextResponse — either a redirect or a pass-through
 */
export async function updateSession(request: NextRequest) {
  // Try to extract userId from the JWT cookie
  const token = request.cookies.get(COOKIE_NAME)?.value;
  let userId: string | null = null;

  if (token) {
    try {
      const { payload } = await jwtVerify(token, SECRET);
      userId = (payload.userId as string) || null;
    } catch {
      // Invalid or expired token — treat as logged out
    }
  }

  // Protected routes: /admin/* and /sales/* require authentication
  const isProtectedRoute =
    request.nextUrl.pathname.startsWith("/admin") ||
    request.nextUrl.pathname.startsWith("/sales");

  if (isProtectedRoute && !userId) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // If user is already logged in and visits /login, redirect to dashboard
  if (request.nextUrl.pathname === "/login" && userId) {
    const url = request.nextUrl.clone();
    url.pathname = "/admin";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}
