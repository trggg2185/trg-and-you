import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

interface IncomingSubtitle {
  startTime: number;
  endTime: number;
  speaker?: string | null;
  text: string;
  ipa: string;
}

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ videoId: string }> }
) {
  try {
    const session = await getSession();
    if (!session || session.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Bạn không có quyền chỉnh sửa phụ đề." },
        { status: 403 }
      );
    }

    const { videoId } = await context.params;
    const video = await prisma.video.findUnique({ where: { id: videoId } });
    if (!video) {
      return NextResponse.json(
        { error: "Không tìm thấy bài học." },
        { status: 404 }
      );
    }

    const body = await request.json();
    if (!Array.isArray(body.subtitles)) {
      return NextResponse.json(
        { error: "Dữ liệu phụ đề không hợp lệ." },
        { status: 400 }
      );
    }

    const normalized: IncomingSubtitle[] = [];
    for (let i = 0; i < body.subtitles.length; i++) {
      const item = body.subtitles[i];
      const text = typeof item.text === "string" ? item.text.trim() : "";
      const ipa = typeof item.ipa === "string" ? item.ipa.trim() : "";
      const speaker =
        typeof item.speaker === "string" && item.speaker.trim()
          ? item.speaker.trim()
          : null;
      const startTime = Number(item.startTime);
      const endTime = Number(item.endTime);

      if (!text) {
        return NextResponse.json(
          { error: `Câu thoại thứ ${i + 1} đang bị trống nội dung tiếng Anh.` },
          { status: 400 }
        );
      }

      if (
        !Number.isFinite(startTime) ||
        !Number.isFinite(endTime) ||
        startTime < 0 ||
        endTime <= startTime
      ) {
        return NextResponse.json(
          {
            error: `Mốc thời gian của câu "${text.slice(0, 30)}..." chưa hợp lệ (Thời gian kết thúc phải lớn hơn bắt đầu).`,
          },
          { status: 400 }
        );
      }

      normalized.push({
        startTime: Number(startTime.toFixed(1)),
        endTime: Number(endTime.toFixed(1)),
        speaker,
        text,
        ipa,
      });
    }

    normalized.sort((a, b) => a.startTime - b.startTime);

    await prisma.$transaction(async (tx) => {
      await tx.subtitle.deleteMany({ where: { videoId } });
      if (normalized.length > 0) {
        await tx.subtitle.createMany({
          data: normalized.map((sub, idx) => ({
            videoId,
            index: idx + 1,
            startTime: sub.startTime,
            endTime: sub.endTime,
            speaker: sub.speaker ?? null,
            text: sub.text,
            ipa: sub.ipa,
          })),
        });
      }
      if (video.status !== "READY") {
        await tx.video.update({
          where: { id: videoId },
          data: { status: "READY" },
        });
      }
    });

    const subtitles = await prisma.subtitle.findMany({
      where: { videoId },
      orderBy: { index: "asc" },
    });

    return NextResponse.json({ subtitles });
  } catch (error) {
    console.error("Update subtitles error:", error);
    return NextResponse.json(
      { error: "Không thể lưu phụ đề lúc này. Vui lòng thử lại sau." },
      { status: 500 }
    );
  }
}
