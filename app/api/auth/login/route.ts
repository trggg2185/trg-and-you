import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    {
      error:
        "Hệ thống đã chuyển sang đăng nhập bằng Google. Nếu bạn có tài khoản cũ dùng mật khẩu, hãy chọn mục Liên kết tài khoản cũ với Google.",
    },
    { status: 410 }
  );
}
