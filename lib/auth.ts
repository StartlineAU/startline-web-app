import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET ?? "change-this-secret-in-production"
);

export type TokenPayload = {
  sub:    string;   // organiser or admin ID
  role:   "organiser" | "admin";
  email:  string;
  status: string;   // OrganiserStatus | "admin"
};

// ── Password ─────────────────────────────────────────────────────────────────
export const hashPassword   = (pw: string)         => bcrypt.hash(pw, 12);
export const verifyPassword = (pw: string, hash: string) => bcrypt.compare(pw, hash);

// ── JWT ───────────────────────────────────────────────────────────────────────
export async function signToken(payload: TokenPayload, expiresIn = "7d") {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(JWT_SECRET);
}

export async function verifyToken(token: string): Promise<TokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return payload as unknown as TokenPayload;
  } catch {
    return null;
  }
}

// ── Cookie helpers ────────────────────────────────────────────────────────────
const ORGANISER_COOKIE = "sl-token";
const ADMIN_COOKIE     = "sl-admin-token";

export async function setOrganiserCookie(token: string) {
  const jar = await cookies();
  jar.set(ORGANISER_COOKIE, token, {
    httpOnly: true,
    secure:   process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge:   60 * 60 * 24 * 7, // 7 days
    path:     "/",
  });
}

export async function setAdminCookie(token: string) {
  const jar = await cookies();
  jar.set(ADMIN_COOKIE, token, {
    httpOnly: true,
    secure:   process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge:   60 * 60 * 8, // 8 hours
    path:     "/",
  });
}

export async function clearOrganiserCookie() {
  const jar = await cookies();
  jar.delete(ORGANISER_COOKIE);
}

export async function clearAdminCookie() {
  const jar = await cookies();
  jar.delete(ADMIN_COOKIE);
}

export async function getOrganiserSession(): Promise<TokenPayload | null> {
  if (process.env.NODE_ENV === "development" && process.env.DEV_BYPASS === "true") {
    return { sub: "dev-organiser-id", role: "organiser", email: "dev@example.com", status: "APPROVED" };
  }
  const jar   = await cookies();
  const token = jar.get(ORGANISER_COOKIE)?.value;
  if (!token) return null;
  return verifyToken(token);
}

export async function getAdminSession(): Promise<TokenPayload | null> {
  const jar   = await cookies();
  const token = jar.get(ADMIN_COOKIE)?.value;
  if (!token) return null;
  return verifyToken(token);
}
