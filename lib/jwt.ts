import { SignJWT, jwtVerify } from "jose";

export const SESSION_COOKIE_NAME = "shadowing_session";

export type UserRole = "SUPERADMIN" | "ADMIN" | "USER";

export interface SessionPayload {
  userId: string;
  username: string;
  role: UserRole;
  avatarUrl?: string | null;
}

export function normalizeUserRole(role: string | null | undefined): UserRole {
  if (role === "SUPERADMIN") return "SUPERADMIN";
  if (role === "ADMIN") return "ADMIN";
  return "USER";
}

export function isAdminRole(role: string | null | undefined): boolean {
  return role === "SUPERADMIN" || role === "ADMIN";
}

export function isSuperAdminRole(role: string | null | undefined): boolean {
  return role === "SUPERADMIN";
}

function getSecretKey(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET environment variable is not set");
  }
  return new TextEncoder().encode(secret);
}

export async function signSessionToken(payload: SessionPayload): Promise<string> {
  return new SignJWT({
    userId: payload.userId,
    username: payload.username,
    role: payload.role,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(getSecretKey());
}

export async function verifySessionToken(
  token: string
): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecretKey());
    if (
      typeof payload.userId === "string" &&
      typeof payload.username === "string" &&
      (payload.role === "SUPERADMIN" ||
        payload.role === "ADMIN" ||
        payload.role === "USER")
    ) {
      return {
        userId: payload.userId,
        username: payload.username,
        role: payload.role,
      };
    }
    return null;
  } catch {
    return null;
  }
}
