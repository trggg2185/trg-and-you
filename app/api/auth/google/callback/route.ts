import { NextRequest, NextResponse } from "next/server";
import {
  getSession,
  normalizeUserRole,
  SESSION_COOKIE_NAME,
  signSessionToken,
} from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  exchangeGoogleCodeForProfile,
  generateUniqueUsername,
  getRequestOrigin,
  LINK_TICKET_COOKIE,
  OAUTH_STATE_COOKIE,
  verifyLinkTicket,
  verifyOAuthState,
} from "@/lib/googleAuth";

function buildRedirectUrl(
  origin: string,
  path: string,
  key: string,
  val: string
): string {
  const url = new URL(path, origin);
  url.searchParams.set(key, val);
  return url.toString();
}

export async function GET(request: NextRequest) {
  const origin = getRequestOrigin(request);
  const code = request.nextUrl.searchParams.get("code");
  const stateToken = request.nextUrl.searchParams.get("state");
  const oauthError = request.nextUrl.searchParams.get("error");

  const cookieNonce = request.cookies.get(OAUTH_STATE_COOKIE)?.value;
  const parsedState = stateToken ? await verifyOAuthState(stateToken) : null;
  const returnTo = parsedState?.returnTo ?? "/";

  const redirectWithError = (errCode: string, targetPath = returnTo) => {
    const res = NextResponse.redirect(
      buildRedirectUrl(origin, targetPath, "authError", errCode)
    );
    res.cookies.delete(OAUTH_STATE_COOKIE);
    res.cookies.delete(LINK_TICKET_COOKIE);
    return res;
  };

  if (oauthError) {
    return redirectWithError("google_cancelled", "/login");
  }

  if (!code || !parsedState || !cookieNonce || parsedState.nonce !== cookieNonce) {
    return redirectWithError("invalid_state", "/login");
  }

  try {
    const redirectUri = `${origin}/api/auth/google/callback`;
    const profile = await exchangeGoogleCodeForProfile(code, redirectUri);

    if (!profile.emailVerified) {
      return redirectWithError("email_unverified", "/login");
    }

    let finalUser: { id: string; username: string; role: string } | null = null;
    let authStatus = "google_ok";

    if (parsedState.mode === "link") {
      const ticket = request.cookies.get(LINK_TICKET_COOKIE)?.value;
      const ticketUserId = ticket ? await verifyLinkTicket(ticket) : null;
      const session = !ticketUserId ? await getSession() : null;
      const targetUserId = ticketUserId || session?.userId || null;

      if (!targetUserId) {
        return redirectWithError("link_expired", "/login");
      }

      const targetUser = await prisma.user.findUnique({
        where: { id: targetUserId },
      });

      if (!targetUser) {
        return redirectWithError("link_expired", "/login");
      }
      if (targetUser.isBanned) {
        return redirectWithError("banned", "/login");
      }

      const conflict = await prisma.user.findFirst({
        where: {
          OR: [{ googleId: profile.googleId }, { email: profile.email }],
          NOT: { id: targetUser.id },
        },
        select: { id: true },
      });

      if (conflict) {
        return redirectWithError("google_already_linked", returnTo);
      }

      const updated = await prisma.user.update({
        where: { id: targetUser.id },
        data: {
          googleId: profile.googleId,
          email: profile.email,
          avatarUrl: profile.avatarUrl,
          passwordHash: null, // Loại bỏ hoàn toàn mật khẩu cũ
        },
      });

      finalUser = {
        id: updated.id,
        username: updated.username,
        role: updated.role,
      };
      authStatus = "google_linked";
    } else {
      let user = await prisma.user.findFirst({
        where: {
          OR: [{ googleId: profile.googleId }, { email: profile.email }],
        },
      });

      if (user) {
        if (user.isBanned) {
          return redirectWithError("banned", "/login");
        }
        if (
          user.googleId !== profile.googleId ||
          user.email !== profile.email ||
          user.avatarUrl !== profile.avatarUrl
        ) {
          user = await prisma.user.update({
            where: { id: user.id },
            data: {
              googleId: profile.googleId,
              email: profile.email,
              avatarUrl: profile.avatarUrl,
            },
          });
        }
      } else {
        const username = await generateUniqueUsername(
          profile.name,
          profile.email
        );
        user = await prisma.user.create({
          data: {
            username,
            googleId: profile.googleId,
            email: profile.email,
            avatarUrl: profile.avatarUrl,
            passwordHash: null,
            role: "USER",
            isBanned: false,
          },
        });
      }

      finalUser = {
        id: user.id,
        username: user.username,
        role: user.role,
      };
    }

    const role = normalizeUserRole(finalUser.role);
    const sessionToken = await signSessionToken({
      userId: finalUser.id,
      username: finalUser.username,
      role,
    });

    const response = NextResponse.redirect(
      buildRedirectUrl(origin, returnTo, "auth", authStatus)
    );
    response.cookies.set(SESSION_COOKIE_NAME, sessionToken, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    });
    response.cookies.delete(OAUTH_STATE_COOKIE);
    response.cookies.delete(LINK_TICKET_COOKIE);
    return response;
  } catch (error) {
    console.error("Google OAuth callback error:", error);
    return redirectWithError("google_failed", "/login");
  }
}
