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
    const videoId = typeof body.videoId === "string" ? body.videoId.trim() : "";
    const lastTime = Number(body.lastTime);
    const duration = Number(body.duration ?? 0);

    if (!videoId || !Number.isFinite(lastTime) || lastTime < 0) {
      return NextResponse.json(
        { error: "Dữ liệu tiến độ không hợp lệ." },
        { status: 400 }
      );
    }

    const safeDuration =
      Number.isFinite(duration) && duration > 0 ? Number(duration.toFixed(1)) : 0;
    const safeLastTime = Number(lastTime.toFixed(1));
    const reachedEnd =
      Boolean(body.completed) ||
      (safeDuration > 0 && safeLastTime / safeDuration >= 0.9);

    const existing = await prisma.learningProgress.findUnique({
      where: {
        userId_videoId: {
          userId: session.userId,
          videoId,
        },
      },
      select: { completed: true },
    });

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

    const progress = await prisma.learningProgress.upsert({
      where: {
        userId_videoId: {
          userId: session.userId,
          videoId,
        },
      },
      update: {
        lastTime: safeLastTime,
        ...(safeDuration > 0 ? { duration: safeDuration } : {}),
        completed: Boolean(existing?.completed || reachedEnd),
      },
      create: {
        userId: session.userId,
        videoId,
        lastTime: safeLastTime,
        duration: safeDuration,
        completed: reachedEnd,
      },
    });

    return NextResponse.json({ progress });
  } catch (error) {
    console.error("Save learning progress error:", error);
    return NextResponse.json(
      { error: "Không thể lưu tiến độ học." },
      { status: 500 }
    );
  }
}
