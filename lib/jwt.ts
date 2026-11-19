import { SignJWT, jwtVerify } from "jose";

export const SESSION_COOKIE_NAME = "shadowing_session";

export interface SessionPayload {
  userId: string;
  username: string;
  role: "ADMIN" | "USER";
}

function getSecretKey(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET environment variable is not set");
  }
  return new TextEncoder().encode(secret);
}

export async function signSessionToken(payload: SessionPayload): Promise<string> {
  return new SignJWT({ ...payload })
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
      (payload.role === "ADMIN" || payload.role === "USER")
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
