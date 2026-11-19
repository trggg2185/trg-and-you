import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function normalizeWordKey(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/^[^a-z']+|[^a-z']+$/g, "")
    .slice(0, 60);
}

export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { error: "Vui lòng đăng nhập để xem kho từ vựng." },
        { status: 401 }
      );
    }

    const items = await prisma.vocabItem.findMany({
      where: { userId: session.userId },
      orderBy: [{ nextReviewAt: "asc" }, { createdAt: "desc" }],
      include: {
        video: {
          select: { id: true, title: true },
        },
      },
    });

    const nowMs = Date.now();
    const dueCount = items.filter(
      (i) => i.nextReviewAt.getTime() <= nowMs
    ).length;

    return NextResponse.json({
      items,
      totalCount: items.length,
      dueCount,
    });
  } catch (error) {
    console.error("List vocab error:", error);
    return NextResponse.json(
      { error: "Không thể tải danh sách từ vựng." },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { error: "Vui lòng đăng nhập để lưu từ vựng." },
        { status: 401 }
      );
    }

    const body = await request.json();
    const word = normalizeWordKey(typeof body.word === "string" ? body.word : "");
    if (!word) {
      return NextResponse.json(
        { error: "Từ vựng không hợp lệ." },
        { status: 400 }
      );
    }

    const phonetic =
      typeof body.phonetic === "string" ? body.phonetic.trim().slice(0, 120) : "";
    const partOfSpeech =
      typeof body.partOfSpeech === "string"
        ? body.partOfSpeech.trim().slice(0, 60)
        : "";
    const meaningVi =
      typeof body.meaningVi === "string"
        ? body.meaningVi.trim().slice(0, 300)
        : "";
    const exampleText =
      typeof body.exampleText === "string"
        ? body.exampleText.trim().slice(0, 400)
        : "";
    const videoId =
      typeof body.videoId === "string" && body.videoId.trim()
        ? body.videoId.trim()
        : null;
    const startTime =
      typeof body.startTime === "number" && Number.isFinite(body.startTime)
        ? Math.max(0, body.startTime)
        : null;

    const item = await prisma.vocabItem.upsert({
      where: {
        userId_word: {
          userId: session.userId,
          word,
        },
      },
      create: {
        userId: session.userId,
        word,
        phonetic,
        partOfSpeech,
        meaningVi,
        exampleText,
        videoId,
        startTime,
        srsLevel: 0,
        nextReviewAt: new Date(),
      },
      update: {
        ...(phonetic ? { phonetic } : {}),
        ...(partOfSpeech ? { partOfSpeech } : {}),
        ...(meaningVi ? { meaningVi } : {}),
        ...(exampleText ? { exampleText } : {}),
        ...(videoId ? { videoId } : {}),
        ...(startTime !== null ? { startTime } : {}),
      },
      include: {
        video: {
          select: { id: true, title: true },
        },
      },
    });

    return NextResponse.json({ item }, { status: 201 });
  } catch (error) {
    console.error("Save vocab error:", error);
    return NextResponse.json(
      { error: "Không thể lưu từ vựng lúc này." },
      { status: 500 }
    );
  }
}
