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

// Simple in-memory rate limiter — Map<ip, { count, resetAt }>
const loginAttempts = new Map<string, { count: number; resetAt: number }>();
const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000; // 15 minutes

function getClientIp(request: NextRequest): string {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || request.headers.get('x-real-ip')
    || '127.0.0.1';
}

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = loginAttempts.get(ip);
  if (!entry || now > entry.resetAt) {
    loginAttempts.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return true;
  }
  if (entry.count >= MAX_ATTEMPTS) return false;
  entry.count++;
  return true;
}

export async function POST(request: NextRequest) {
  try {
    const ip = getClientIp(request);
    if (!checkRateLimit(ip)) {
      return NextResponse.json(
        { error: 'Terlalu banyak percobaan login. Coba lagi dalam 15 menit.' },
        { status: 429 },
      );
    }

    const { username, password } = await request.json();

    if (!username || !password) {
      return NextResponse.json(
        { error: 'Username dan password harus diisi' },
        { status: 400 },
      );
    }

    const profile = await prisma.profile.findUnique({ where: { username } });

    if (!profile || !compareSync(password, profile.password)) {
      return NextResponse.json(
        { error: 'Username atau password salah' },
        { status: 401 },
      );
    }

    if (!profile.isActive) {
      return NextResponse.json(
        { error: 'Akun Anda tidak aktif. Hubungi admin.' },
        { status: 403 },
      );
    }

    await createSession(profile.id, profile.role);

    return NextResponse.json({ success: true, role: profile.role, name: profile.name });
  } catch (err) {
    console.error('[login]', err);
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 });
  }
}
