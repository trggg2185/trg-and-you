import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import {
  getGoogleOAuthConfig,
  getRequestOrigin,
  OAUTH_STATE_COOKIE,
  sanitizeReturnTo,
  signOAuthState,
} from "@/lib/googleAuth";

export async function GET(request: NextRequest) {
  const origin = getRequestOrigin(request);
  const modeParam = request.nextUrl.searchParams.get("mode");
  const mode: "login" | "link" = modeParam === "link" ? "link" : "login";
  const returnTo = sanitizeReturnTo(
    request.nextUrl.searchParams.get("returnTo")
  );

  try {
    const { clientId } = getGoogleOAuthConfig();
    const nonce = crypto.randomUUID();
    const state = await signOAuthState({ nonce, mode, returnTo });
    const redirectUri = `${origin}/api/auth/google/callback`;

    const googleUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    googleUrl.searchParams.set("client_id", clientId);
    googleUrl.searchParams.set("redirect_uri", redirectUri);
    googleUrl.searchParams.set("response_type", "code");
    googleUrl.searchParams.set("scope", "openid email profile");
    googleUrl.searchParams.set("state", state);
    googleUrl.searchParams.set("prompt", "select_account");

    const response = NextResponse.redirect(googleUrl.toString());
    response.cookies.set(OAUTH_STATE_COOKIE, nonce, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 10,
    });
    return response;
  } catch (error) {
    console.error("Google OAuth init error:", error);
    const fallbackUrl = new URL("/login", origin);
    fallbackUrl.searchParams.set("authError", "oauth_config");
    return NextResponse.redirect(fallbackUrl.toString());
  }
}
