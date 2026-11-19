import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();

    const includeAll =
      request.nextUrl.searchParams.get("all") === "1" &&
      session?.role === "ADMIN";

    const videos = await prisma.video.findMany({
      where: includeAll ? undefined : { status: "READY" },
      orderBy: { createdAt: "desc" },
      include: {
        _count: {
          select: { subtitles: true },
        },
      },
    });

    return NextResponse.json({ videos });
  } catch (error) {
    console.error("List videos error:", error);
    return NextResponse.json(
      { error: "Không thể tải danh sách video." },
      { status: 500 }
    );
  }
}
