import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { SESSION_COOKIE_NAME, signSessionToken } from "@/lib/auth";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const username =
      typeof body.username === "string" ? body.username.trim() : "";
    const password = typeof body.password === "string" ? body.password : "";

    if (!username || !password) {
      return NextResponse.json(
        { error: "Vui lòng nhập tên đăng nhập và mật khẩu." },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({ where: { username } });
    if (!user) {
      return NextResponse.json(
        { error: "Tên đăng nhập hoặc mật khẩu không đúng." },
        { status: 401 }
      );
    }

    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) {
      return NextResponse.json(
        { error: "Tên đăng nhập hoặc mật khẩu không đúng." },
        { status: 401 }
      );
    }

    const role = user.role === "ADMIN" ? "ADMIN" : "USER";
    const token = await signSessionToken({
      userId: user.id,
      username: user.username,
      role,
    });

    const response = NextResponse.json({
      user: { id: user.id, username: user.username, role },
    });

    response.cookies.set(SESSION_COOKIE_NAME, token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 7, // 7 days
    });

    return response;
  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json(
      { error: "Đã xảy ra lỗi khi đăng nhập." },
      { status: 500 }
    );
  }
}
