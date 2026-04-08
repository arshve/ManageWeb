/**
 * Next.js 16 Proxy (replaces the deprecated middleware.ts)
 *
 * This file intercepts every request before it reaches a page or API route.
 * It delegates to auth-middleware.ts which checks the JWT session cookie
 * and redirects unauthenticated users away from protected routes.
 *
 * The `config.matcher` excludes static files (images, CSS, JS) from
 * being processed — only actual page/API requests go through the proxy.
 */

import { updateSession } from "@/lib/auth-middleware";
import type { NextRequest } from "next/server";

export default async function proxy(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    // Match all paths except static files and images
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
