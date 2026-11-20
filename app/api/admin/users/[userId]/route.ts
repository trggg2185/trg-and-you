import { NextRequest, NextResponse } from "next/server";
import { getSession, isAdminRole, isSuperAdminRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ userId: string }> }
) {
  try {
    const session = await getSession();
    if (!session || !isAdminRole(session.role)) {
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

    const actorIsSuper = isSuperAdminRole(session.role);

    // Protect SUPERADMIN accounts from peer/subordinate tampering
    if (target.role === "SUPERADMIN" && target.id !== session.userId) {
      return NextResponse.json(
        { error: "Không thể chỉnh sửa tài khoản SuperAdmin." },
        { status: 403 }
      );
    }

    // Restrict regular ADMIN from touching other ADMINs or SUPERADMINs
    if (!actorIsSuper && target.role !== "USER") {
      return NextResponse.json(
        {
          error:
            "Quản trị viên không thể chỉnh sửa hoặc khóa Quản trị viên / SuperAdmin khác.",
        },
        { status: 403 }
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

    if (body.role !== undefined && body.role !== target.role) {
      if (!actorIsSuper) {
        return NextResponse.json(
          {
            error:
              "Chỉ SuperAdmin mới có quyền thay đổi vai trò ADMIN/USER cho người dùng.",
          },
          { status: 403 }
        );
      }
      if (target.role === "SUPERADMIN" || target.id === session.userId) {
        return NextResponse.json(
          { error: "Không thể hạ quyền hoặc đổi vai trò của SuperAdmin." },
          { status: 400 }
        );
      }
      if (body.role !== "ADMIN" && body.role !== "USER") {
        return NextResponse.json(
          { error: "Vai trò chỉ hợp lệ là ADMIN hoặc USER." },
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
      if (target.role === "SUPERADMIN" && body.isBanned) {
        return NextResponse.json(
          { error: "Không thể khóa tài khoản SuperAdmin." },
          { status: 403 }
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

    return NextResponse.json({
      user: {
        id: updated.id,
        username: updated.username,
        email: updated.email,
        avatarUrl: updated.avatarUrl,
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

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ userId: string }> }
) {
  try {
    const session = await getSession();
    if (!session || !isSuperAdminRole(session.role)) {
      return NextResponse.json(
        {
          error:
            "Chỉ SuperAdmin mới có quyền xóa vĩnh viễn tài khoản (để tránh mất dữ liệu học tập & bình luận). Quản trị viên vui lòng dùng chức năng Ban.",
        },
        { status: 403 }
      );
    }

    const { userId } = await context.params;
    if (userId === session.userId) {
      return NextResponse.json(
        { error: "Bạn không thể tự xóa tài khoản của chính mình." },
        { status: 400 }
      );
    }

    const target = await prisma.user.findUnique({ where: { id: userId } });
    if (!target) {
      return NextResponse.json(
        { error: "Không tìm thấy người dùng." },
        { status: 404 }
      );
    }

    if (target.role === "SUPERADMIN") {
      return NextResponse.json(
        { error: "Không thể xóa tài khoản SuperAdmin." },
        { status: 403 }
      );
    }

    await prisma.user.delete({ where: { id: userId } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Delete user error:", error);
    return NextResponse.json(
      { error: "Không thể xóa người dùng lúc này. Vui lòng thử lại." },
      { status: 500 }
    );
  }
}
