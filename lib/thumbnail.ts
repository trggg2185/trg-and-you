import fs from "fs/promises";
import os from "os";
import path from "path";
import { captureVideoThumbnail } from "@/lib/ffmpeg";
import { uploadFileToR2 } from "@/lib/r2";

/**
 * Generates a JPEG thumbnail from a downloaded local video file and uploads it to R2.
 * Returns null instead of throwing so video processing is never blocked by thumbnail errors.
 */
export async function generateAndUploadThumbnail(
  videoId: string,
  localVideoPath: string
): Promise<{ thumbnailUrl: string; thumbnailKey: string } | null> {
  const thumbPath = path.join(
    os.tmpdir(),
    `thumb-${videoId}-${Date.now()}.jpg`
  );
  const thumbnailKey = `thumbnails/${videoId}.jpg`;

  try {
    await captureVideoThumbnail(localVideoPath, thumbPath, 1.5);
    const stat = await fs.stat(thumbPath);
    if (stat.size === 0) {
      return null;
    }
    const thumbnailUrl = await uploadFileToR2(
      thumbnailKey,
      thumbPath,
      "image/jpeg"
    );
    return { thumbnailUrl, thumbnailKey };
  } catch (err) {
    console.warn("Thumbnail generation skipped:", err);
    return null;
  } finally {
    await fs.unlink(thumbPath).catch(() => {});
  }
}
