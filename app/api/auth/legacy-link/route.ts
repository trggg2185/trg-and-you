import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import {
  LINK_TICKET_COOKIE,
  sanitizeReturnTo,
  signLinkTicket,
} from "@/lib/googleAuth";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const username =
      typeof body.username === "string" ? body.username.trim() : "";
    const password = typeof body.password === "string" ? body.password : "";
    const returnTo = sanitizeReturnTo(
      typeof body.returnTo === "string" ? body.returnTo : "/account"
    );

    if (!username || !password) {
      return NextResponse.json(
        { error: "Vui lòng nhập tên đăng nhập và mật khẩu cũ." },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({ where: { username } });
    if (!user) {
      return NextResponse.json(
        { error: "Tên đăng nhập hoặc mật khẩu cũ không đúng." },
        { status: 401 }
      );
    }

    if (user.googleId) {
      return NextResponse.json(
        {
          error:
            "Tài khoản này đã được liên kết với Google và đã gỡ bỏ mật khẩu. Vui lòng bấm Đăng nhập bằng Google.",
        },
        { status: 409 }
      );
    }

    if (!user.passwordHash) {
      return NextResponse.json(
        {
          error:
            "Tài khoản này không sử dụng mật khẩu. Vui lòng đăng nhập bằng Google.",
        },
        { status: 400 }
      );
    }

    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) {
      return NextResponse.json(
        { error: "Tên đăng nhập hoặc mật khẩu cũ không đúng." },
        { status: 401 }
      );
    }

    if (user.isBanned) {
      return NextResponse.json(
        { error: "Tài khoản này đã bị khóa bởi quản trị viên." },
        { status: 403 }
      );
    }

    const ticket = await signLinkTicket(user.id);
    const redirectUrl = `/api/auth/google?mode=link&returnTo=${encodeURIComponent(
      returnTo
    )}`;

    const response = NextResponse.json({
      ok: true,
      redirectUrl,
    });

    response.cookies.set(LINK_TICKET_COOKIE, ticket, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 10,
    });

    return response;
  } catch (error) {
    console.error("Legacy link verify error:", error);
    return NextResponse.json(
      { error: "Không thể xác minh tài khoản cũ lúc này." },
      { status: 500 }
    );
  }
}
