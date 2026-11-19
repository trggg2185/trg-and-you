import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    {
      error:
        "Đăng ký bằng mật khẩu đã ngừng hoạt động. Vui lòng bấm Đăng nhập bằng Google để bắt đầu.",
    },
    { status: 410 }
  );
}
