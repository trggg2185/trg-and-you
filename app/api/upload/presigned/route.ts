import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { createPresignedUploadUrl } from "@/lib/r2";

const ALLOWED_EXTENSIONS = new Set([".mp4", ".mkv", ".webm"]);

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session || session.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const filename =
      typeof body.filename === "string" ? body.filename.trim() : "";
    const contentType =
      typeof body.contentType === "string" && body.contentType.trim()
        ? body.contentType.trim()
        : "video/mp4";

    if (!filename) {
      return NextResponse.json(
        { error: "Thiếu tên tệp video." },
        { status: 400 }
      );
    }

    const dotIndex = filename.lastIndexOf(".");
    const ext = dotIndex >= 0 ? filename.slice(dotIndex).toLowerCase() : "";
    if (!ALLOWED_EXTENSIONS.has(ext)) {
      return NextResponse.json(
        { error: "Chỉ hỗ trợ định dạng .mp4, .mkv, .webm" },
        { status: 400 }
      );
    }

    const safeBase = filename
      .slice(0, dotIndex)
      .replace(/[^a-zA-Z0-9_-]/g, "-")
      .replace(/-+/g, "-")
      .slice(0, 50);

    const r2Key = `videos/${Date.now()}-${safeBase || "video"}${ext}`;
    const result = await createPresignedUploadUrl(r2Key, contentType);

    return NextResponse.json(result);
  } catch (error) {
    console.error("Presigned URL error:", error);
    return NextResponse.json(
      { error: "Không thể khởi tạo phiên tải lên lúc này. Vui lòng thử lại sau." },
      { status: 500 }
    );
  }
}
