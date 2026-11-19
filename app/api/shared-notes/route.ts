import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const videoId = request.nextUrl.searchParams.get("videoId")?.trim() || "";
    if (!videoId) {
      return NextResponse.json(
        { error: "Thiếu videoId." },
        { status: 400 }
      );
    }

    const notes = await prisma.sharedNote.findMany({
      where: { videoId },
      orderBy: { createdAt: "desc" },
      take: 100,
      include: {
        user: {
          select: { id: true, username: true },
        },
      },
    });

    return NextResponse.json({
      notes: notes.map((n) => ({
        id: n.id,
        userId: n.user.id,
        username: n.user.username,
        timestampSec: n.timestampSec,
        content: n.content,
        createdAt: n.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    console.error("List shared notes error:", error);
    return NextResponse.json(
      { error: "Không thể tải ghi chú nhóm." },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { error: "Vui lòng đăng nhập để đăng ghi chú nhóm." },
        { status: 401 }
      );
    }

    const body = await request.json();
    const videoId =
      typeof body.videoId === "string" ? body.videoId.trim() : "";
    const content =
      typeof body.content === "string" ? body.content.trim().slice(0, 600) : "";
    const timestampSec =
      typeof body.timestampSec === "number" && Number.isFinite(body.timestampSec)
        ? Math.max(0, body.timestampSec)
        : null;

    if (!videoId || !content) {
      return NextResponse.json(
        { error: "Nội dung ghi chú không được để trống." },
        { status: 400 }
      );
    }

    const created = await prisma.sharedNote.create({
      data: {
        userId: session.userId,
        videoId,
        timestampSec,
        content,
      },
      include: {
        user: {
          select: { id: true, username: true },
        },
      },
    });

    return NextResponse.json(
      {
        note: {
          id: created.id,
          userId: created.user.id,
          username: created.user.username,
          timestampSec: created.timestampSec,
          content: created.content,
          createdAt: created.createdAt.toISOString(),
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Create shared note error:", error);
    return NextResponse.json(
      { error: "Không thể đăng ghi chú nhóm." },
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

    const id = request.nextUrl.searchParams.get("id")?.trim() || "";
    if (!id) {
      return NextResponse.json({ error: "Thiếu id." }, { status: 400 });
    }

    const existing = await prisma.sharedNote.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { error: "Không tìm thấy ghi chú." },
        { status: 404 }
      );
    }

    if (existing.userId !== session.userId && session.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Bạn không có quyền xóa ghi chú này." },
        { status: 403 }
      );
    }

    await prisma.sharedNote.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Delete shared note error:", error);
    return NextResponse.json(
      { error: "Không thể xóa ghi chú nhóm." },
      { status: 500 }
    );
  }
}
