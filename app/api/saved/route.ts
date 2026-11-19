import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { error: "Vui lòng đăng nhập để xem câu đã lưu." },
        { status: 401 }
      );
    }

    const items = await prisma.savedSentence.findMany({
      where: { userId: session.userId },
      orderBy: { createdAt: "desc" },
      include: {
        subtitle: {
          include: {
            video: {
              select: {
                id: true,
                title: true,
                videoUrl: true,
              },
            },
          },
        },
      },
    });

    return NextResponse.json({ items });
  } catch (error) {
    console.error("Get saved sentences error:", error);
    return NextResponse.json(
      { error: "Không thể tải danh sách câu đã lưu." },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { error: "Vui lòng đăng nhập để lưu câu hay." },
        { status: 401 }
      );
    }

    const body = await request.json();
    const subtitleId =
      typeof body.subtitleId === "string" ? body.subtitleId.trim() : "";

    if (!subtitleId) {
      return NextResponse.json(
        { error: "Thiếu thông tin câu thoại." },
        { status: 400 }
      );
    }

    const subtitle = await prisma.subtitle.findUnique({
      where: { id: subtitleId },
      select: { id: true },
    });
    if (!subtitle) {
      return NextResponse.json(
        { error: "Không tìm thấy câu thoại." },
        { status: 404 }
      );
    }

    const saved = await prisma.savedSentence.upsert({
      where: {
        userId_subtitleId: {
          userId: session.userId,
          subtitleId,
        },
      },
      update: {},
      create: {
        userId: session.userId,
        subtitleId,
      },
    });

    return NextResponse.json({ saved }, { status: 201 });
  } catch (error) {
    console.error("Save sentence error:", error);
    return NextResponse.json(
      { error: "Không thể lưu câu thoại lúc này." },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { error: "Vui lòng đăng nhập." },
        { status: 401 }
      );
    }

    let subtitleId = request.nextUrl.searchParams.get("subtitleId") ?? "";
    if (!subtitleId) {
      const body = await request.json().catch(() => ({}));
      if (typeof body.subtitleId === "string") {
        subtitleId = body.subtitleId.trim();
      }
    }

    if (!subtitleId) {
      return NextResponse.json(
        { error: "Thiếu thông tin câu thoại." },
        { status: 400 }
      );
    }

    await prisma.savedSentence.deleteMany({
      where: {
        userId: session.userId,
        subtitleId,
      },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Delete saved sentence error:", error);
    return NextResponse.json(
      { error: "Không thể bỏ lưu câu thoại lúc này." },
      { status: 500 }
    );
  }
}
