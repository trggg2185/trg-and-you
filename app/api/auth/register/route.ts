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

    if (username.length < 3 || username.length > 32) {
      return NextResponse.json(
        { error: "Tên đăng nhập phải từ 3 đến 32 ký tự." },
        { status: 400 }
      );
    }

    if (!/^[a-zA-Z0-9_.-]+$/.test(username)) {
      return NextResponse.json(
        { error: "Tên đăng nhập chỉ được chứa chữ, số và ký tự _ . -" },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: "Mật khẩu phải có ít nhất 6 ký tự." },
        { status: 400 }
      );
    }

    const existing = await prisma.user.findUnique({ where: { username } });
    if (existing) {
      return NextResponse.json(
        { error: "Tên đăng nhập đã tồn tại." },
        { status: 409 }
      );
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: {
        username,
        passwordHash,
        role: "USER",
      },
    });

    const token = await signSessionToken({
      userId: user.id,
      username: user.username,
      role: "USER",
    });

    const response = NextResponse.json(
      {
        user: { id: user.id, username: user.username, role: "USER" },
      },
      { status: 201 }
    );

    response.cookies.set(SESSION_COOKIE_NAME, token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    });

    return response;
  } catch (error) {
    console.error("Register error:", error);
    return NextResponse.json(
      { error: "Đã xảy ra lỗi khi đăng ký." },
      { status: 500 }
    );
  }
}
