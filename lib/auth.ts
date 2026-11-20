import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import {
  SESSION_COOKIE_NAME,
  type SessionPayload,
  type UserRole,
  isAdminRole,
  isSuperAdminRole,
  normalizeUserRole,
  signSessionToken,
  verifySessionToken,
} from "@/lib/jwt";

export {
  SESSION_COOKIE_NAME,
  type SessionPayload,
  type UserRole,
  isAdminRole,
  isSuperAdminRole,
  normalizeUserRole,
  signSessionToken,
  verifySessionToken,
};

export async function getSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;

  const verified = await verifySessionToken(token);
  if (!verified) return null;

  // Enforce ban status and pick up live username/role/avatar updates from DB
  const user = await prisma.user.findUnique({
    where: { id: verified.userId },
    select: {
      id: true,
      username: true,
      role: true,
      avatarUrl: true,
      isBanned: true,
    },
  });

  if (!user || user.isBanned) {
    return null;
  }

  return {
    userId: user.id,
    username: user.username,
    role: normalizeUserRole(user.role),
    avatarUrl: user.avatarUrl ?? null,
  };
}
