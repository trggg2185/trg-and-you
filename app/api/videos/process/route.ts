import { NextRequest, NextResponse } from "next/server";
import os from "os";
import path from "path";
import fs from "fs/promises";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { downloadR2ObjectToFile, getPublicVideoUrl } from "@/lib/r2";
import { extractAudioToMp3 } from "@/lib/ffmpeg";
import { transcribeAudioWithGemini } from "@/lib/gemini";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(request: NextRequest) {
  let videoId: string | null = null;
  let tempVideoPath: string | null = null;
  let tempMp3Path: string | null = null;

  try {
    const session = await getSession();
    if (!session || session.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const title = typeof body.title === "string" ? body.title.trim() : "";
    const description =
      typeof body.description === "string" ? body.description.trim() : null;
    const r2Key = typeof body.r2Key === "string" ? body.r2Key.trim() : "";

    if (!title || !r2Key) {
      return NextResponse.json(
        { error: "Thiếu tiêu đề hoặc r2Key." },
        { status: 400 }
      );
    }

    const videoUrl = getPublicVideoUrl(r2Key);
    const video = await prisma.video.create({
      data: {
        title,
        description: description || null,
        videoUrl,
        r2Key,
        status: "PROCESSING",
      },
    });
    videoId = video.id;

    const ext = path.extname(r2Key) || ".mp4";
    const tmpDir = os.tmpdir();
    tempVideoPath = path.join(tmpDir, `video-${video.id}${ext}`);
    tempMp3Path = path.join(tmpDir, `audio-${video.id}.mp3`);

    // 1. Download video from R2 to /tmp
    await downloadR2ObjectToFile(r2Key, tempVideoPath);

    // 2. Extract lightweight mono .mp3 using ffmpeg-static
    await extractAudioToMp3(tempVideoPath, tempMp3Path);

    // 3. Transcribe + generate IPA with Gemini 2.5 Flash
    const subtitles = await transcribeAudioWithGemini(tempMp3Path);

    // 4. Persist subtitles and mark video READY
    await prisma.$transaction(async (tx) => {
      if (subtitles.length > 0) {
        await tx.subtitle.createMany({
          data: subtitles.map((sub, idx) => ({
            videoId: video.id,
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
        where: { id: video.id },
        data: { status: "READY" },
      });
    });

    const updated = await prisma.video.findUnique({
      where: { id: video.id },
      include: { _count: { select: { subtitles: true } } },
    });

    return NextResponse.json({ video: updated }, { status: 201 });
  } catch (error) {
    console.error("Video processing error:", error);
    if (videoId) {
      await prisma.video
        .update({
          where: { id: videoId },
          data: { status: "FAILED" },
        })
        .catch(() => {});
    }
    return NextResponse.json(
      {
        error:
          "Không thể xử lý video lúc này. Vui lòng kiểm tra lại tệp hoặc thử lại sau.",
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
