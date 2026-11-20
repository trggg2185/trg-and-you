import { NextRequest, NextResponse } from "next/server";
import { getSession, isAdminRole, isSuperAdminRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const session = await getSession();
    if (!session || !isAdminRole(session.role)) {
      return NextResponse.json(
        { error: "Bạn không có quyền truy cập." },
        { status: 403 }
      );
    }

    const rows = await prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        username: true,
        email: true,
        avatarUrl: true,
        googleId: true,
        passwordHash: true,
        role: true,
        isBanned: true,
        createdAt: true,
        _count: {
          select: {
            notes: true,
            sharedNotes: true,
            progresses: true,
            vocabItems: true,
            savedSentences: true,
          },
        },
      },
    });

    const users = rows.map((u) => ({
      id: u.id,
      username: u.username,
      email: u.email,
      avatarUrl: u.avatarUrl,
      hasGoogle: Boolean(u.googleId),
      hasPassword: Boolean(u.passwordHash),
      role: u.role,
      isBanned: u.isBanned,
      createdAt: u.createdAt,
      _count: u._count,
    }));

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
    if (!session || !isAdminRole(session.role)) {
      return NextResponse.json(
        { error: "Bạn không có quyền thực hiện thao tác này." },
        { status: 403 }
      );
    }

    const body = await request.json();
    const email =
      typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const rawUsername =
      typeof body.username === "string" ? body.username.trim() : "";
    const requestedRole = body.role === "ADMIN" ? "ADMIN" : "USER";

    if (requestedRole === "ADMIN" && !isSuperAdminRole(session.role)) {
      return NextResponse.json(
        {
          error:
            "Chỉ SuperAdmin mới có quyền thêm tài khoản Quản trị viên (ADMIN).",
        },
        { status: 403 }
      );
    }

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json(
        { error: "Vui lòng nhập địa chỉ Gmail / Email Google hợp lệ." },
        { status: 400 }
      );
    }

    const username =
      rawUsername ||
      email
        .split("@")[0]
        .replace(/[^a-zA-Z0-9_.-]+/g, "_")
        .slice(0, 28);

    if (username.length < 3 || username.length > 32) {
      return NextResponse.json(
        { error: "Tên hiển thị phải từ 3 đến 32 ký tự." },
        { status: 400 }
      );
    }

    if (!/^[a-zA-Z0-9_.-]+$/.test(username)) {
      return NextResponse.json(
        { error: "Tên hiển thị chỉ được chứa chữ, số và ký tự _ . -" },
        { status: 400 }
      );
    }

    const conflict = await prisma.user.findFirst({
      where: {
        OR: [{ username }, { email }],
      },
    });
    if (conflict) {
      return NextResponse.json(
        {
          error:
            conflict.email === email
              ? "Email này đã có trong hệ thống."
              : "Tên hiển thị này đã tồn tại.",
        },
        { status: 409 }
      );
    }

    const created = await prisma.user.create({
      data: {
        username,
        email,
        passwordHash: null,
        role: requestedRole,
        isBanned: false,
      },
      select: {
        id: true,
        username: true,
        email: true,
        avatarUrl: true,
        googleId: true,
        passwordHash: true,
        role: true,
        isBanned: true,
        createdAt: true,
        _count: {
          select: {
            notes: true,
            sharedNotes: true,
            progresses: true,
            vocabItems: true,
            savedSentences: true,
          },
        },
      },
    });

    return NextResponse.json(
      {
        user: {
          id: created.id,
          username: created.username,
          email: created.email,
          avatarUrl: created.avatarUrl,
          hasGoogle: Boolean(created.googleId),
          hasPassword: Boolean(created.passwordHash),
          role: created.role,
          isBanned: created.isBanned,
          createdAt: created.createdAt,
          _count: created._count,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Create invited Google user error:", error);
    return NextResponse.json(
      { error: "Không thể thêm người dùng lúc này." },
      { status: 500 }
    );
  }
}
