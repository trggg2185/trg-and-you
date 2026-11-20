import { NextRequest, NextResponse } from "next/server";
import { getSession, isAdminRole, isSuperAdminRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function serializeNote(n: {
  id: string;
  kind: string;
  parentId: string | null;
  timestampSec: number | null;
  content: string;
  createdAt: Date;
  user: { id: string; username: string; avatarUrl: string | null; role: string };
}) {
  return {
    id: n.id,
    userId: n.user.id,
    username: n.user.username,
    avatarUrl: n.user.avatarUrl,
    authorRole: n.user.role,
    kind: n.kind === "COMMENT" ? "COMMENT" : "NOTE",
    parentId: n.parentId,
    timestampSec: n.timestampSec,
    content: n.content,
    createdAt: n.createdAt.toISOString(),
  };
}

export async function GET(request: NextRequest) {
  try {
    const videoId = request.nextUrl.searchParams.get("videoId")?.trim() || "";
    if (!videoId) {
      return NextResponse.json({ error: "Thiếu videoId." }, { status: 400 });
    }

    const topNotes = await prisma.sharedNote.findMany({
      where: { videoId, parentId: null },
      orderBy: { createdAt: "desc" },
      take: 100,
      include: {
        user: {
          select: { id: true, username: true, avatarUrl: true, role: true },
        },
        replies: {
          orderBy: { createdAt: "asc" },
          include: {
            user: {
              select: { id: true, username: true, avatarUrl: true, role: true },
            },
          },
        },
      },
    });

    return NextResponse.json({
      notes: topNotes.map((n) => ({
        ...serializeNote(n),
        replies: n.replies.map(serializeNote),
      })),
    });
  } catch (error) {
    console.error("List shared notes error:", error);
    return NextResponse.json(
      { error: "Không thể tải ghi chú & bình luận." },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { error: "Vui lòng đăng nhập để đăng ghi chú hoặc bình luận." },
        { status: 401 }
      );
    }

    const body = await request.json();
    const videoId =
      typeof body.videoId === "string" ? body.videoId.trim() : "";
    const content =
      typeof body.content === "string" ? body.content.trim().slice(0, 600) : "";
    const kind = body.kind === "COMMENT" ? "COMMENT" : "NOTE";
    const parentId =
      typeof body.parentId === "string" && body.parentId.trim()
        ? body.parentId.trim()
        : null;
    const timestampSec =
      typeof body.timestampSec === "number" && Number.isFinite(body.timestampSec)
        ? Math.max(0, body.timestampSec)
        : null;

    if (!videoId || !content) {
      return NextResponse.json(
        { error: "Nội dung không được để trống." },
        { status: 400 }
      );
    }

    if (parentId) {
      const parent = await prisma.sharedNote.findUnique({
        where: { id: parentId },
        select: { id: true, videoId: true, parentId: true },
      });
      if (!parent || parent.videoId !== videoId) {
        return NextResponse.json(
          { error: "Không tìm thấy bài viết gốc để trả lời." },
          { status: 404 }
        );
      }
      if (parent.parentId) {
        return NextResponse.json(
          { error: "Chỉ hỗ trợ trả lời trực tiếp 1 cấp." },
          { status: 400 }
        );
      }
    }

    const created = await prisma.sharedNote.create({
      data: {
        userId: session.userId,
        videoId,
        kind: parentId ? "COMMENT" : kind,
        parentId,
        timestampSec: parentId ? null : timestampSec,
        content,
      },
      include: {
        user: {
          select: { id: true, username: true, avatarUrl: true, role: true },
        },
      },
    });

    return NextResponse.json(
      {
        note: {
          ...serializeNote(created),
          replies: [],
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Create shared note error:", error);
    return NextResponse.json(
      { error: "Không thể đăng nội dung lúc này." },
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

    const existing = await prisma.sharedNote.findUnique({
      where: { id },
      include: { user: { select: { role: true } } },
    });
    if (!existing) {
      return NextResponse.json(
        { error: "Không tìm thấy nội dung." },
        { status: 404 }
      );
    }

    const isOwner = existing.userId === session.userId;
    const isSuper = isSuperAdminRole(session.role);
    const isAdminModeratingUser =
      isAdminRole(session.role) && existing.user.role === "USER";

    if (!isOwner && !isSuper && !isAdminModeratingUser) {
      return NextResponse.json(
        { error: "Bạn không có quyền xóa nội dung của quản trị viên này." },
        { status: 403 }
      );
    }

    await prisma.sharedNote.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Delete shared note error:", error);
    return NextResponse.json(
      { error: "Không thể xóa nội dung." },
      { status: 500 }
    );
  }
}
