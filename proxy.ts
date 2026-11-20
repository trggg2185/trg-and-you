import { NextRequest, NextResponse } from "next/server";
import {
  isAdminRole,
  SESSION_COOKIE_NAME,
  verifySessionToken,
} from "@/lib/jwt";

const PUBLIC_EXACT_PATHS = new Set([
  "/",
  "/login",
  "/api/auth/login",
  "/api/auth/register",
  "/api/auth/logout",
  "/api/auth/me",
  "/api/auth/google",
  "/api/auth/google/callback",
  "/api/auth/legacy-link",
]);

function isPublicPath(pathname: string, method: string): boolean {
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon.ico") ||
    pathname.match(/\.(svg|png|jpg|jpeg|gif|webp|ico)$/)
  ) {
    return true;
  }
  if (PUBLIC_EXACT_PATHS.has(pathname)) {
    return true;
  }
  if (pathname.startsWith("/learn/")) {
    return true;
  }
  if (
    method === "GET" &&
    (pathname === "/api/videos" ||
      /^\/api\/videos\/[^/]+$/.test(pathname) ||
      pathname === "/api/words/lookup" ||
      pathname === "/api/shared-notes")
  ) {
    return true;
  }
  return false;
}

function isAdminOnlyPath(pathname: string, method: string): boolean {
  if (pathname.startsWith("/admin")) return true;
  if (pathname.startsWith("/api/admin")) return true;
  if (pathname.startsWith("/api/upload")) return true;
  if (pathname.startsWith("/api/videos/process")) return true;
  if (pathname.startsWith("/api/videos/") && pathname.endsWith("/reprocess")) {
    return true;
  }
  if (pathname.startsWith("/api/videos/") && pathname.endsWith("/subtitles")) {
    return true;
  }
  if (
    pathname.startsWith("/api/videos/") &&
    (method === "DELETE" || method === "PATCH" || method === "PUT")
  ) {
    return true;
  }
  return false;
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (isPublicPath(pathname, request.method)) {
    return NextResponse.next();
  }

  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const session = token ? await verifySessionToken(token) : null;

  if (!session) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.redirect(new URL("/", request.url));
  }

  if (isAdminOnlyPath(pathname, request.method) && !isAdminRole(session.role)) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return NextResponse.redirect(new URL("/", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
