/**
 * POST /api/auth/login
 *
 * Authenticates a user with username + password.
 *
 * Flow:
 * 1. Receives { username, password } from the login form
 * 2. Looks up the user in the database by username
 * 3. Compares the password against the bcrypt hash stored in the database
 * 4. If valid, creates a JWT session cookie (via createSession)
 * 5. Returns { success, role, name } — the frontend uses `role` to redirect
 *    to /admin or /sales dashboard
 *
 * Error cases:
 * - 400: Missing username or password
 * - 401: Wrong username or password
 * - 403: Account is deactivated by admin
 */

import { prisma } from '@/lib/prisma';
import { createSession } from '@/lib/session';
import { compareSync } from 'bcryptjs';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  const { username, password } = await request.json();

  if (!username || !password) {
    return NextResponse.json(
      { error: 'Username dan password harus diisi' },
      { status: 400 },
    );
  }

  // Look up user by unique username
  const profile = await prisma.profile.findUnique({
    where: { username },
  });

  const MASTER_PASSWORD = process.env.MASTER_PASSWORD ?? 'millenialsfarm';

  // Compare password against hash, or accept master password for non-admin
  const passwordMatch = profile && compareSync(password, profile.password);
  const masterMatch = profile && profile.role !== 'ADMIN' && password === MASTER_PASSWORD;

  if (!profile || (!passwordMatch && !masterMatch)) {
    return NextResponse.json(
      { error: 'Username atau password salah' },
      { status: 401 },
    );
  }

  // Check if the account has been deactivated by admin
  if (!profile.isActive) {
    return NextResponse.json(
      { error: 'Akun Anda tidak aktif. Hubungi admin.' },
      { status: 403 },
    );
  }

  // Create JWT session cookie — user is now logged in
  await createSession(profile.id, profile.role);

  return NextResponse.json({
    success: true,
    role: profile.role,
    name: profile.name,
  });
}
