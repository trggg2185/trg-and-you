import { NextRequest, NextResponse } from "next/server";
import { getSession, isAdminRole, isSuperAdminRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { deleteR2Objects, listR2Objects } from "@/lib/r2";

const RECENT_PROTECTION_MS = 15 * 60 * 1000;

function extractKeyFromUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    return u.pathname.replace(/^\/+/, "") || null;
  } catch {
    return null;
  }
}

async function getReferencedR2Keys(): Promise<Set<string>> {
  const videos = await prisma.video.findMany({
    select: {
      r2Key: true,
      thumbnailKey: true,
      videoUrl: true,
      thumbnailUrl: true,
    },
  });

  const referenced = new Set<string>();
  for (const v of videos) {
    if (v.r2Key) referenced.add(v.r2Key);
    if (v.thumbnailKey) referenced.add(v.thumbnailKey);
    const fromVideoUrl = extractKeyFromUrl(v.videoUrl);
    if (fromVideoUrl) referenced.add(fromVideoUrl);
    const fromThumbUrl = extractKeyFromUrl(v.thumbnailUrl);
    if (fromThumbUrl) referenced.add(fromThumbUrl);
  }
  return referenced;
}

export async function GET() {
  try {
    const session = await getSession();
    if (!session || !isAdminRole(session.role)) {
      return NextResponse.json(
        { error: "Bạn không có quyền truy cập." },
        { status: 403 }
      );
    }

    const [objects, referencedKeys] = await Promise.all([
      listR2Objects(),
      getReferencedR2Keys(),
    ]);

    const nowMs = Date.now();
    const orphans = objects
      .filter((obj) => !referencedKeys.has(obj.key))
      .map((obj) => {
        const modifiedMs = new Date(obj.lastModified).getTime();
        const isRecent =
          Number.isFinite(modifiedMs) &&
          nowMs - modifiedMs < RECENT_PROTECTION_MS;
        return {
          ...obj,
          isRecent,
        };
      })
      .sort((a, b) => b.size - a.size);

    const totalOrphanBytes = orphans.reduce((acc, o) => acc + o.size, 0);

    return NextResponse.json({
      totalBucketObjects: objects.length,
      referencedCount: referencedKeys.size,
      totalOrphanBytes,
      orphans,
    });
  } catch (error) {
    console.error("Scan R2 orphans error:", error);
    return NextResponse.json(
      {
        error:
          "Không thể quét danh sách file trên Cloudflare R2. Vui lòng kiểm tra cấu hình R2.",
      },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session || !isSuperAdminRole(session.role)) {
      return NextResponse.json(
        {
          error:
            "Chỉ SuperAdmin mới có quyền xóa trực tiếp tệp trên Cloudflare R2.",
        },
        { status: 403 }
      );
    }

    const body = await request.json();
    const requestedKeys: string[] = Array.isArray(body.keys)
      ? body.keys.filter((k: unknown): k is string => typeof k === "string" && k.trim().length > 0)
      : [];

    if (requestedKeys.length === 0) {
      return NextResponse.json(
        { error: "Vui lòng chọn ít nhất một tệp để xóa." },
        { status: 400 }
      );
    }

    // Re-check live DB right before deleting so referenced lesson files are NEVER removed
    const referencedKeys = await getReferencedR2Keys();
    const safeKeys = requestedKeys.filter((k) => !referencedKeys.has(k));

    if (safeKeys.length === 0) {
      return NextResponse.json(
        {
          error:
            "Các tệp được chọn hiện đang gắn với bài học trong hệ thống nên không thể xóa.",
        },
        { status: 409 }
      );
    }

    const deletedCount = await deleteR2Objects(safeKeys);
    return NextResponse.json({
      ok: true,
      deletedCount,
      deletedKeys: safeKeys,
    });
  } catch (error) {
    console.error("Delete R2 orphans error:", error);
    return NextResponse.json(
      { error: "Không thể xóa tệp trên R2 lúc này. Vui lòng thử lại sau." },
      { status: 500 }
    );
  }
}
