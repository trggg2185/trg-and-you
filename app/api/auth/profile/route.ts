import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import {
  getSession,
  SESSION_COOKIE_NAME,
  signSessionToken,
} from "@/lib/auth";

export async function PATCH(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { error: "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại." },
        { status: 401 }
      );
    }

    const body = await request.json();
    const newUsername =
      typeof body.username === "string" ? body.username.trim() : "";
    const currentPassword =
      typeof body.currentPassword === "string" ? body.currentPassword : "";
    const newPassword =
      typeof body.newPassword === "string" ? body.newPassword : "";

    const user = await prisma.user.findUnique({
      where: { id: session.userId },
    });

    if (!user) {
      return NextResponse.json(
        { error: "Không tìm thấy thông tin tài khoản." },
        { status: 404 }
      );
    }

    const updateData: { username?: string; passwordHash?: string } = {};

    if (newUsername && newUsername !== user.username) {
      if (newUsername.length < 3 || newUsername.length > 32) {
        return NextResponse.json(
          { error: "Tên đăng nhập phải từ 3 đến 32 ký tự." },
          { status: 400 }
        );
      }

      if (!/^[a-zA-Z0-9_.-]+$/.test(newUsername)) {
        return NextResponse.json(
          { error: "Tên đăng nhập chỉ được chứa chữ, số và ký tự _ . -" },
          { status: 400 }
        );
      }

      const duplicate = await prisma.user.findUnique({
        where: { username: newUsername },
      });
      if (duplicate && duplicate.id !== user.id) {
        return NextResponse.json(
          { error: "Tên đăng nhập này đã được sử dụng." },
          { status: 409 }
        );
      }

      updateData.username = newUsername;
    }

    if (newPassword) {
      if (!currentPassword) {
        return NextResponse.json(
          { error: "Vui lòng nhập mật khẩu hiện tại để đổi mật khẩu." },
          { status: 400 }
        );
      }

      const validCurrent = await bcrypt.compare(
        currentPassword,
        user.passwordHash
      );
      if (!validCurrent) {
        return NextResponse.json(
          { error: "Mật khẩu hiện tại chưa chính xác." },
          { status: 400 }
        );
      }

      if (newPassword.length < 6) {
        return NextResponse.json(
          { error: "Mật khẩu mới phải có ít nhất 6 ký tự." },
          { status: 400 }
        );
      }

      updateData.passwordHash = await bcrypt.hash(newPassword, 10);
    }

    if (!updateData.username && !updateData.passwordHash) {
      return NextResponse.json(
        { error: "Không có thay đổi nào cần cập nhật." },
        { status: 400 }
      );
    }

    const updated = await prisma.user.update({
      where: { id: user.id },
      data: updateData,
    });

    const role = updated.role === "ADMIN" ? "ADMIN" : "USER";
    const token = await signSessionToken({
      userId: updated.id,
      username: updated.username,
      role,
    });

    const response = NextResponse.json({
      user: {
        id: updated.id,
        username: updated.username,
        role,
      },
      message: "Cập nhật thông tin tài khoản thành công.",
    });

    response.cookies.set(SESSION_COOKIE_NAME, token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    });

    return response;
  } catch (error) {
    console.error("Update profile error:", error);
    return NextResponse.json(
      { error: "Không thể cập nhật tài khoản lúc này. Vui lòng thử lại sau." },
      { status: 500 }
    );
  }
}
