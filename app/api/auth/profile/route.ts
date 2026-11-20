import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  getSession,
  normalizeUserRole,
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
    const hasUsername = Object.prototype.hasOwnProperty.call(body, "username");
    const hasGoal = Object.prototype.hasOwnProperty.call(
      body,
      "dailyGoalMinutes"
    );

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

    const updateData: { username?: string; dailyGoalMinutes?: number } = {};

    if (hasUsername && newUsername && newUsername !== user.username) {
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

      updateData.username = newUsername;
    }

    if (hasGoal) {
      const rawGoal = Number(body.dailyGoalMinutes);
      if (
        !Number.isFinite(rawGoal) ||
        rawGoal < 5 ||
        rawGoal > 180
      ) {
        return NextResponse.json(
          { error: "Mục tiêu mỗi ngày phải từ 5 đến 180 phút." },
          { status: 400 }
        );
      }
      const rounded = Math.round(rawGoal);
      if (rounded !== user.dailyGoalMinutes) {
        updateData.dailyGoalMinutes = rounded;
      }
    }

    if (
      updateData.username === undefined &&
      updateData.dailyGoalMinutes === undefined
    ) {
      return NextResponse.json(
        { error: "Không có thay đổi nào cần cập nhật." },
        { status: 400 }
      );
    }

    const updated = await prisma.user.update({
      where: { id: user.id },
      data: updateData,
    });

    const role = normalizeUserRole(updated.role);
    const token = await signSessionToken({
      userId: updated.id,
      username: updated.username,
      role,
    });

    const response = NextResponse.json({
      user: {
        id: updated.id,
        username: updated.username,
        dailyGoalMinutes: updated.dailyGoalMinutes,
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
