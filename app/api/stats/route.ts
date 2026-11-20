import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getStudySummary, getTodayDateKey } from "@/lib/stats";

export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { error: "Vui lòng đăng nhập." },
        { status: 401 }
      );
    }

    const summary = await getStudySummary(session.userId);
    return NextResponse.json({ summary });
  } catch (error) {
    console.error("Get study stats error:", error);
    return NextResponse.json(
      { error: "Không thể tải thống kê học tập." },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { error: "Vui lòng đăng nhập." },
        { status: 401 }
      );
    }

    const body = await request.json();
    const addSeconds =
      typeof body.seconds === "number" && Number.isFinite(body.seconds)
        ? Math.min(120, Math.max(0, Math.round(body.seconds)))
        : 0;
    const addDictation =
      typeof body.dictationCorrect === "number" &&
      Number.isFinite(body.dictationCorrect)
        ? Math.min(10, Math.max(0, Math.round(body.dictationCorrect)))
        : 0;

    if (addSeconds === 0 && addDictation === 0) {
      const summary = await getStudySummary(session.userId);
      return NextResponse.json({ summary });
    }

    const dateKey = getTodayDateKey();

    const log = await prisma.studyLog.upsert({
      where: {
        userId_dateKey: {
          userId: session.userId,
          dateKey,
        },
      },
      create: {
        userId: session.userId,
        dateKey,
        secondsStudied: addSeconds,
        dictationCorrect: addDictation,
      },
      update: {
        ...(addSeconds > 0
          ? { secondsStudied: { increment: addSeconds } }
          : {}),
        ...(addDictation > 0
          ? { dictationCorrect: { increment: addDictation } }
          : {}),
      },
      select: {
        dateKey: true,
        secondsStudied: true,
        dictationCorrect: true,
      },
    });

    return NextResponse.json({ ok: true, log });
  } catch (error) {
    console.error("Update study stats error:", error);
    return NextResponse.json(
      { error: "Không thể cập nhật thời gian học." },
      { status: 500 }
    );
  }
}
