/**
 * Session Management (JWT-based)
 *
 * Handles user authentication sessions using JSON Web Tokens (JWT).
 * Sessions are stored as httpOnly cookies for security — JavaScript on the
 * client side cannot read or tamper with them.
 *
 * Flow:
 * 1. User logs in → createSession() signs a JWT with their userId and sets it as a cookie
 * 2. On each request → getSessionUserId() reads the cookie and verifies the JWT
 * 3. User logs out → deleteSession() removes the cookie
 *
 * Uses the `jose` library for JWT signing/verification with HS256 algorithm.
 */

import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';

function getSessionSecret(): Uint8Array {
  const raw = process.env.SESSION_SECRET;
  if (!raw) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('SESSION_SECRET is required in production — set it in your environment variables');
    }
    console.warn('[session] Using fallback SESSION_SECRET in dev; set SESSION_SECRET env var for production');
  }
  return new TextEncoder().encode(raw || 'millenials-farm-dev-secret-change-in-prod');
}

const SECRET = getSessionSecret();

// Name of the cookie that stores the JWT token
const COOKIE_NAME = 'mf-session-v2';

/**
 * Creates a new session for a user after successful login.
 * Signs a JWT containing the userId, sets it as an httpOnly cookie
 * that expires in 7 days. The cookie is secure in production (HTTPS only).
 *
 * @param userId - The database ID of the authenticated user
 * @returns The signed JWT token string
 */
export async function createSession(userId: string, role: string) {
  const token = await new SignJWT({ userId, role })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('7d')
    .sign(SECRET);

  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 7, // 7 days in seconds
  });

  return token;
}

/**
 * Reads the session cookie and extracts the userId from the JWT.
 * Returns null if no cookie exists or if the token is invalid/expired.
 * This is used by auth.ts to look up the full user profile.
 *
 * @returns The userId string if valid session exists, null otherwise
 */
export async function getSessionUserId(): Promise<string | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, SECRET);
    return (payload.userId as string) || null;
  } catch {
    return null;
  }
}

/**
 * Destroys the current session by deleting the cookie.
 * Called when the user clicks "Logout".
 */
export async function deleteSession() {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}
