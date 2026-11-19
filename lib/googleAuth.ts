import { NextRequest } from "next/server";
import { SignJWT, jwtVerify } from "jose";
import { prisma } from "@/lib/prisma";

export const OAUTH_STATE_COOKIE = "trg_google_oauth_state";
export const LINK_TICKET_COOKIE = "trg_google_link_ticket";

export interface OAuthStatePayload {
  nonce: string;
  mode: "login" | "link";
  returnTo: string;
}

export interface GoogleUserProfile {
  googleId: string;
  email: string;
  emailVerified: boolean;
  name: string;
  avatarUrl: string | null;
}

function getSecretKey(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET environment variable is not set");
  }
  return new TextEncoder().encode(secret);
}

export function getGoogleOAuthConfig(): {
  clientId: string;
  clientSecret: string;
} {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim() || "";
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim() || "";
  if (!clientId || !clientSecret) {
    throw new Error("Missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET");
  }
  return { clientId, clientSecret };
}

export function getRequestOrigin(request: NextRequest): string {
  const configured = process.env.APP_URL?.trim().replace(/\/+$/, "");
  if (configured) return configured;

  const forwardedHost = request.headers.get("x-forwarded-host");
  if (forwardedHost) {
    const host = forwardedHost.split(",")[0].trim();
    const protoHeader = request.headers.get("x-forwarded-proto");
    const proto = protoHeader
      ? protoHeader.split(",")[0].trim()
      : host.startsWith("localhost") || host.startsWith("127.0.0.1")
      ? "http"
      : "https";
    return `${proto}://${host}`;
  }

  return request.nextUrl.origin;
}

export function sanitizeReturnTo(raw: string | null | undefined): string {
  if (!raw || typeof raw !== "string") return "/";
  const trimmed = raw.trim();
  if (!trimmed.startsWith("/") || trimmed.startsWith("//")) {
    return "/";
  }
  return trimmed;
}

export async function signOAuthState(
  payload: OAuthStatePayload
): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("10m")
    .sign(getSecretKey());
}

export async function verifyOAuthState(
  token: string
): Promise<OAuthStatePayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecretKey());
    if (
      typeof payload.nonce === "string" &&
      (payload.mode === "login" || payload.mode === "link") &&
      typeof payload.returnTo === "string"
    ) {
      return {
        nonce: payload.nonce,
        mode: payload.mode,
        returnTo: sanitizeReturnTo(payload.returnTo),
      };
    }
    return null;
  } catch {
    return null;
  }
}

export async function signLinkTicket(userId: string): Promise<string> {
  return new SignJWT({ linkUserId: userId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("10m")
    .sign(getSecretKey());
}

export async function verifyLinkTicket(token: string): Promise<string | null> {
  try {
    const { payload } = await jwtVerify(token, getSecretKey());
    return typeof payload.linkUserId === "string" ? payload.linkUserId : null;
  } catch {
    return null;
  }
}

export async function exchangeGoogleCodeForProfile(
  code: string,
  redirectUri: string
): Promise<GoogleUserProfile> {
  const { clientId, clientSecret } = getGoogleOAuthConfig();

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });

  if (!tokenRes.ok) {
    const text = await tokenRes.text();
    throw new Error(`Google token exchange failed: ${tokenRes.status} ${text}`);
  }

  const tokenJson = (await tokenRes.json()) as { access_token?: string };
  if (!tokenJson.access_token) {
    throw new Error("Missing access_token from Google");
  }

  const userRes = await fetch(
    "https://openidconnect.googleapis.com/v1/userinfo",
    {
      headers: { Authorization: `Bearer ${tokenJson.access_token}` },
    }
  );

  if (!userRes.ok) {
    throw new Error(`Google userinfo failed: ${userRes.status}`);
  }

  const info = (await userRes.json()) as {
    sub?: string;
    email?: string;
    email_verified?: boolean;
    name?: string;
    picture?: string;
  };

  if (!info.sub || !info.email) {
    throw new Error("Google userinfo missing sub or email");
  }

  return {
    googleId: info.sub,
    email: info.email.toLowerCase(),
    emailVerified: Boolean(info.email_verified),
    name: info.name?.trim() || info.email.split("@")[0] || "learner",
    avatarUrl: info.picture?.trim() || null,
  };
}

export async function generateUniqueUsername(
  name: string,
  email: string
): Promise<string> {
  const emailLocal = email.split("@")[0] || "";
  const source = emailLocal || name || "learner";
  let base = source
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9_.-]+/g, "_")
    .replace(/^[._-]+|[._-]+$/g, "")
    .slice(0, 22);

  if (base.length < 3) {
    base = `user_${base || "gg"}`;
  }

  const existingBase = await prisma.user.findUnique({
    where: { username: base },
    select: { id: true },
  });
  if (!existingBase) return base;

  for (let i = 0; i < 10; i++) {
    const suffix = Math.floor(100 + Math.random() * 900);
    const candidate = `${base.slice(0, 24)}_${suffix}`;
    const taken = await prisma.user.findUnique({
      where: { username: candidate },
      select: { id: true },
    });
    if (!taken) return candidate;
  }

  return `user_${Date.now().toString(36)}`;
}
