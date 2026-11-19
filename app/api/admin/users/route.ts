import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const session = await getSession();
    if (!session || session.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Bạn không có quyền truy cập." },
        { status: 403 }
      );
    }

    const users = await prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        username: true,
        role: true,
        isBanned: true,
        createdAt: true,
        _count: {
          select: { notes: true },
        },
      },
    });

    return NextResponse.json({ users });
  } catch (error) {
    console.error("List users error:", error);
    return NextResponse.json(
      { error: "Không thể tải danh sách người dùng." },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session || session.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Bạn không có quyền thực hiện thao tác này." },
        { status: 403 }
      );
    }

    const body = await request.json();
    const username =
      typeof body.username === "string" ? body.username.trim() : "";
    const password = typeof body.password === "string" ? body.password : "";
    const role = body.role === "ADMIN" ? "ADMIN" : "USER";

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
    const created = await prisma.user.create({
      data: {
        username,
        passwordHash,
        role,
        isBanned: false,
      },
      select: {
        id: true,
        username: true,
        role: true,
        isBanned: true,
        createdAt: true,
        _count: {
          select: { notes: true },
        },
      },
    });

    return NextResponse.json({ user: created }, { status: 201 });
  } catch (error) {
    console.error("Create user error:", error);
    return NextResponse.json(
      { error: "Không thể tạo tài khoản lúc này. Vui lòng thử lại." },
      { status: 500 }
    );
  }
}
