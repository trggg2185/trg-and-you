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
        { error: "Thiếu videoId." },
        { status: 400 }
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
