import { NextRequest, NextResponse } from "next/server";
import os from "os";
import path from "path";
import fs from "fs/promises";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { downloadR2ObjectToFile } from "@/lib/r2";
import { extractAudioToMp3 } from "@/lib/ffmpeg";
import { transcribeAudioWithGemini } from "@/lib/gemini";
import { generateAndUploadThumbnail } from "@/lib/thumbnail";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(
  _request: NextRequest,
  context: { params: Promise<{ videoId: string }> }
) {
  let tempVideoPath: string | null = null;
  let tempMp3Path: string | null = null;

  try {
    const session = await getSession();
    if (!session || session.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Bạn không có quyền thực hiện thao tác này." },
        { status: 403 }
      );
    }

    const { videoId } = await context.params;
    const video = await prisma.video.findUnique({ where: { id: videoId } });
    if (!video) {
      return NextResponse.json(
        { error: "Không tìm thấy bài học." },
        { status: 404 }
      );
    }

    const ext = path.extname(video.r2Key) || ".mp4";
    const tmpDir = os.tmpdir();
    tempVideoPath = path.join(tmpDir, `reproc-${video.id}-${Date.now()}${ext}`);
    tempMp3Path = path.join(tmpDir, `reproc-${video.id}-${Date.now()}.mp3`);

    await downloadR2ObjectToFile(video.r2Key, tempVideoPath);
    const [, thumbResult] = await Promise.all([
      extractAudioToMp3(tempVideoPath, tempMp3Path),
      !video.thumbnailUrl
        ? generateAndUploadThumbnail(video.id, tempVideoPath)
        : Promise.resolve(null),
    ]);
    const generated = await transcribeAudioWithGemini(tempMp3Path);

    if (generated.length === 0) {
      return NextResponse.json(
        {
          error:
            "Không nhận diện được lời thoại nào trong video. Phụ đề cũ vẫn được giữ nguyên.",
        },
        { status: 422 }
      );
    }

    await prisma.$transaction(async (tx) => {
      await tx.subtitle.deleteMany({ where: { videoId } });
      if (generated.length > 0) {
        await tx.subtitle.createMany({
          data: generated.map((sub, idx) => ({
            videoId,
            index: idx + 1,
            startTime: sub.startTime,
            endTime: sub.endTime,
            speaker: sub.speaker ?? null,
            text: sub.text,
            ipa: sub.ipa,
          })),
        });
      }
      await tx.video.update({
        where: { id: videoId },
        data: {
          status: "READY",
          ...(thumbResult
            ? {
                thumbnailUrl: thumbResult.thumbnailUrl,
                thumbnailKey: thumbResult.thumbnailKey,
              }
            : {}),
        },
      });
    });

    const subtitles = await prisma.subtitle.findMany({
      where: { videoId },
      orderBy: { index: "asc" },
    });

    return NextResponse.json({ subtitles });
  } catch (error) {
    console.error("Reprocess video error:", error);
    return NextResponse.json(
      {
        error:
          "Không thể phân tích lại phụ đề lúc này. Vui lòng thử lại sau.",
      },
      { status: 500 }
    );
  } finally {
    if (tempVideoPath) {
      await fs.unlink(tempVideoPath).catch(() => {});
    }
    if (tempMp3Path) {
      await fs.unlink(tempMp3Path).catch(() => {});
    }
  }
}
