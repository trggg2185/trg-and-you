import { NextRequest, NextResponse } from "next/server";
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

    const user = await prisma.user.findUnique({
      where: { id: session.userId },
    });

    if (!user) {
      return NextResponse.json(
        { error: "Không tìm thấy thông tin tài khoản." },
        { status: 404 }
      );
    }

    if (!newUsername || newUsername === user.username) {
      return NextResponse.json(
        { error: "Không có thay đổi nào cần cập nhật." },
        { status: 400 }
      );
    }

    if (newUsername.length < 3 || newUsername.length > 32) {
      return NextResponse.json(
        { error: "Tên hiển thị phải từ 3 đến 32 ký tự." },
        { status: 400 }
      );
    }

    if (!/^[a-zA-Z0-9_.-]+$/.test(newUsername)) {
      return NextResponse.json(
        { error: "Tên hiển thị chỉ được chứa chữ, số và ký tự _ . -" },
        { status: 400 }
      );
    }

    const duplicate = await prisma.user.findUnique({
      where: { username: newUsername },
    });
    if (duplicate && duplicate.id !== user.id) {
      return NextResponse.json(
        { error: "Tên hiển thị này đã được sử dụng." },
        { status: 409 }
      );
    }

    const updated = await prisma.user.update({
      where: { id: user.id },
      data: { username: newUsername },
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
      message: "Cập nhật tên hiển thị thành công.",
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
