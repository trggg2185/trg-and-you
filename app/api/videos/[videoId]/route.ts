import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { deleteR2Object } from "@/lib/r2";

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ videoId: string }> }
) {
  try {
    const session = await getSession();

    const { videoId } = await context.params;
    const video = await prisma.video.findUnique({
      where: { id: videoId },
      include: {
        subtitles: {
          orderBy: { index: "asc" },
        },
      },
    });

    if (!video || (video.status !== "READY" && session?.role !== "ADMIN")) {
      return NextResponse.json(
        { error: "Không tìm thấy video." },
        { status: 404 }
      );
    }

    const note = session
      ? await prisma.note.findUnique({
          where: {
            userId_videoId: {
              userId: session.userId,
              videoId,
            },
          },
        })
      : null;

    return NextResponse.json({
      video,
      noteContent: note?.content ?? "",
    });
  } catch (error) {
    console.error("Get video detail error:", error);
    return NextResponse.json(
      { error: "Không thể tải thông tin bài học." },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ videoId: string }> }
) {
  try {
    const session = await getSession();
    if (!session || session.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Bạn không có quyền thực hiện thao tác này." },
        { status: 403 }
      );
    }

    const { videoId } = await context.params;
    const body = await request.json();
    const title = typeof body.title === "string" ? body.title.trim() : "";
    const description =
      typeof body.description === "string" ? body.description.trim() : null;

    if (!title) {
      return NextResponse.json(
        { error: "Tiêu đề bài học không được để trống." },
        { status: 400 }
      );
    }

    const existing = await prisma.video.findUnique({ where: { id: videoId } });
    if (!existing) {
      return NextResponse.json(
        { error: "Không tìm thấy bài học." },
        { status: 404 }
      );
    }

    const updated = await prisma.video.update({
      where: { id: videoId },
      data: {
        title,
        description: description || null,
      },
      include: {
        _count: {
          select: { subtitles: true },
        },
      },
    });

    return NextResponse.json({ video: updated });
  } catch (error) {
    console.error("Update video error:", error);
    return NextResponse.json(
      { error: "Không thể cập nhật thông tin video. Vui lòng thử lại." },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ videoId: string }> }
) {
  try {
    const session = await getSession();
    if (!session || session.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { videoId } = await context.params;
    const video = await prisma.video.findUnique({
      where: { id: videoId },
    });

    if (!video) {
      return NextResponse.json(
        { error: "Không tìm thấy video." },
        { status: 404 }
      );
    }

    // Delete from R2 first (ignore if already missing on R2)
    try {
      await deleteR2Object(video.r2Key);
    } catch (r2Error) {
      console.warn("Failed to delete R2 object (continuing DB delete):", r2Error);
    }

    await prisma.video.delete({
      where: { id: videoId },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Delete video error:", error);
    return NextResponse.json(
      { error: "Không thể xóa video." },
      { status: 500 }
    );
  }
}
