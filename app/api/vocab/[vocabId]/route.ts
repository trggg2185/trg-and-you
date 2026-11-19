import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const SRS_INTERVAL_DAYS = [1, 3, 7, 14, 30] as const;

type ReviewGrade = "again" | "hard" | "good" | "easy";

function computeNextReview(currentLevel: number, grade: ReviewGrade): {
  srsLevel: number;
  nextReviewAt: Date;
} {
  const now = Date.now();
  if (grade === "again") {
    // Re-queue after 10 minutes
    return {
      srsLevel: 0,
      nextReviewAt: new Date(now + 10 * 60 * 1000),
    };
  }

  let nextLevel = currentLevel;
  if (grade === "hard") {
    nextLevel = Math.max(0, currentLevel);
  } else if (grade === "good") {
    nextLevel = Math.min(SRS_INTERVAL_DAYS.length - 1, currentLevel + 1);
  } else if (grade === "easy") {
    nextLevel = Math.min(SRS_INTERVAL_DAYS.length - 1, currentLevel + 2);
  }

  const days =
    grade === "hard"
      ? 1
      : SRS_INTERVAL_DAYS[Math.max(0, nextLevel)] ?? 14;

  return {
    srsLevel: nextLevel,
    nextReviewAt: new Date(now + days * 24 * 60 * 60 * 1000),
  };
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ vocabId: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { error: "Vui lòng đăng nhập." },
        { status: 401 }
      );
    }

    const { vocabId } = await context.params;
    const existing = await prisma.vocabItem.findUnique({
      where: { id: vocabId },
    });
    if (!existing || existing.userId !== session.userId) {
      return NextResponse.json(
        { error: "Không tìm thấy từ vựng." },
        { status: 404 }
      );
    }

    const body = await request.json();
    const grade = body.grade as ReviewGrade;
    if (!["again", "hard", "good", "easy"].includes(grade)) {
      return NextResponse.json(
        { error: "Mức đánh giá không hợp lệ." },
        { status: 400 }
      );
    }

    const { srsLevel, nextReviewAt } = computeNextReview(
      existing.srsLevel,
      grade
    );

    const updated = await prisma.vocabItem.update({
      where: { id: vocabId },
      data: { srsLevel, nextReviewAt },
      include: {
        video: {
          select: { id: true, title: true },
        },
      },
    });

    return NextResponse.json({ item: updated });
  } catch (error) {
    console.error("Update vocab SRS error:", error);
    return NextResponse.json(
      { error: "Không thể cập nhật tiến độ ôn tập." },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ vocabId: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { error: "Vui lòng đăng nhập." },
        { status: 401 }
      );
    }

    const { vocabId } = await context.params;
    const existing = await prisma.vocabItem.findUnique({
      where: { id: vocabId },
    });
    if (!existing || existing.userId !== session.userId) {
      return NextResponse.json(
        { error: "Không tìm thấy từ vựng." },
        { status: 404 }
      );
    }

    await prisma.vocabItem.delete({ where: { id: vocabId } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Delete vocab error:", error);
    return NextResponse.json(
      { error: "Không thể xóa từ vựng." },
      { status: 500 }
    );
  }
}
