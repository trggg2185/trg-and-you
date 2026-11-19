import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ userId: string }> }
) {
  try {
    const session = await getSession();
    if (!session || session.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Bạn không có quyền thực hiện thao tác này." },
        { status: 403 }
      );
    }

    const { userId } = await context.params;
    const target = await prisma.user.findUnique({ where: { id: userId } });
    if (!target) {
      return NextResponse.json(
        { error: "Không tìm thấy người dùng." },
        { status: 404 }
      );
    }

    const body = await request.json();
    const updateData: {
      username?: string;
      role?: string;
      isBanned?: boolean;
    } = {};

    if (typeof body.username === "string") {
      const nextUsername = body.username.trim();
      if (nextUsername !== target.username) {
        if (nextUsername.length < 3 || nextUsername.length > 32) {
          return NextResponse.json(
            { error: "Tên hiển thị phải từ 3 đến 32 ký tự." },
            { status: 400 }
          );
        }
        if (!/^[a-zA-Z0-9_.-]+$/.test(nextUsername)) {
          return NextResponse.json(
            { error: "Tên hiển thị chỉ được chứa chữ, số và ký tự _ . -" },
            { status: 400 }
          );
        }
        const duplicate = await prisma.user.findUnique({
          where: { username: nextUsername },
        });
        if (duplicate && duplicate.id !== target.id) {
          return NextResponse.json(
            { error: "Tên hiển thị này đã được sử dụng." },
            { status: 409 }
          );
        }
        updateData.username = nextUsername;
      }
    }

    if (body.role === "ADMIN" || body.role === "USER") {
      if (target.id === session.userId && body.role !== "ADMIN") {
        return NextResponse.json(
          { error: "Bạn không thể tự hạ quyền Quản trị viên của chính mình." },
          { status: 400 }
        );
      }
      updateData.role = body.role;
    }

    if (typeof body.isBanned === "boolean") {
      if (target.id === session.userId && body.isBanned) {
        return NextResponse.json(
          { error: "Bạn không thể tự khóa tài khoản của chính mình." },
          { status: 400 }
        );
      }
      updateData.isBanned = body.isBanned;
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data: updateData,
      select: {
        id: true,
        username: true,
        email: true,
        googleId: true,
        passwordHash: true,
        role: true,
        isBanned: true,
        createdAt: true,
        _count: {
          select: { notes: true },
        },
      },
    });

    return NextResponse.json({
      user: {
        id: updated.id,
        username: updated.username,
        email: updated.email,
        hasGoogle: Boolean(updated.googleId),
        hasPassword: Boolean(updated.passwordHash),
        role: updated.role,
        isBanned: updated.isBanned,
        createdAt: updated.createdAt,
        _count: updated._count,
      },
    });
  } catch (error) {
    console.error("Update user error:", error);
    return NextResponse.json(
      { error: "Không thể cập nhật người dùng lúc này. Vui lòng thử lại." },
      { status: 500 }
    );
  }
}
