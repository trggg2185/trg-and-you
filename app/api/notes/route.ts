import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PUT(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const videoId = typeof body.videoId === "string" ? body.videoId : "";
    const content = typeof body.content === "string" ? body.content : "";

    if (!videoId) {
      return NextResponse.json(
        { error: "Thiếu thông tin bài học." },
        { status: 400 }
      );
    }

    if (content.length > 20000) {
      return NextResponse.json(
        { error: "Nội dung ghi chú quá dài (tối đa 20.000 ký tự)." },
        { status: 400 }
      );
    }

    const videoExists = await prisma.video.findUnique({
      where: { id: videoId },
      select: { id: true },
    });
    if (!videoExists) {
      return NextResponse.json(
        { error: "Không tìm thấy bài học." },
        { status: 404 }
      );
    }

    const note = await prisma.note.upsert({
      where: {
        userId_videoId: {
          userId: session.userId,
          videoId,
        },
      },
      update: { content },
      create: {
        userId: session.userId,
        videoId,
        content,
      },
    });

    return NextResponse.json({ note });
  } catch (error) {
    console.error("Save note error:", error);
    return NextResponse.json(
      { error: "Không thể lưu ghi chú." },
      { status: 500 }
    );
  }
}
