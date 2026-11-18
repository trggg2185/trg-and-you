import ffmpeg from "fluent-ffmpeg";
import ffmpegPath from "ffmpeg-static";
import { execFile } from "child_process";
import { promisify } from "util";
import path from "path";

const execFileAsync = promisify(execFile);

if (ffmpegPath) {
  ffmpeg.setFfmpegPath(ffmpegPath);
}

export interface AudioChunk {
  filePath: string;
  startSec: number;
  durationSec: number;
  isTemporaryChunk: boolean;
}

/**
 * Extracts a clean mono MP3 optimized for speech recognition
 * (24kHz, 64kbps, highpass + gentle dynamic normalization for quiet voices).
 */
export function extractAudioToMp3(
  inputVideoPath: string,
  outputMp3Path: string
): Promise<void> {
  return new Promise((resolve, reject) => {
    ffmpeg(inputVideoPath)
      .noVideo()
      .audioChannels(1)
      .audioFrequency(24000)
      .audioBitrate("64k")
      .audioFilters(["highpass=f=75", "dynaudnorm=f=150:g=15"])
      .format("mp3")
      .on("end", () => resolve())
      .on("error", (err: Error) => reject(err))
      .save(outputMp3Path);
  });
}

function parseDurationToSeconds(hh: string, mm: string, ss: string): number {
  return Number(hh) * 3600 + Number(mm) * 60 + Number(ss);
}

/**
 * Probes total duration and detects natural silence midpoints using ffmpeg's
 * silencedetect filter (no ffprobe binary required).
 */
export async function analyzeAudioForChunking(mp3Path: string): Promise<{
  totalDurationSec: number;
  silenceMidpoints: number[];
}> {
  if (!ffmpegPath) {
    throw new Error("ffmpeg binary path is not available");
  }

  let stderrOutput = "";
  try {
    const result = await execFileAsync(
      ffmpegPath,
      [
        "-hide_banner",
        "-i",
        mp3Path,
        "-af",
        "silencedetect=noise=-30dB:d=0.3",
        "-f",
        "null",
        "-",
      ],
      { maxBuffer: 10 * 1024 * 1024 }
    );
    stderrOutput = result.stderr || "";
  } catch (err: unknown) {
    // ffmpeg may exit non-zero on some streams while still emitting stderr
    const e = err as { stderr?: string };
    if (e.stderr) {
      stderrOutput = e.stderr;
    } else {
      throw err;
    }
  }

  let totalDurationSec = 0;
  const durationMatch = stderrOutput.match(
    /Duration:\s*(\d{2}):(\d{2}):(\d{2}(?:\.\d+)?)/
  );
  if (durationMatch) {
    totalDurationSec = parseDurationToSeconds(
      durationMatch[1],
      durationMatch[2],
      durationMatch[3]
    );
  }

  const silenceMidpoints: number[] = [];
  const lines = stderrOutput.split(/\r?\n/);
  let currentStart: number | null = null;

  for (const line of lines) {
    const startMatch = line.match(/silence_start:\s*([\d.]+)/);
    if (startMatch) {
      currentStart = Number(startMatch[1]);
      continue;
    }

    const endMatch = line.match(/silence_end:\s*([\d.]+)/);
    if (endMatch && currentStart !== null) {
      const end = Number(endMatch[1]);
      const mid = (currentStart + end) / 2;
      if (Number.isFinite(mid) && mid > 0) {
        silenceMidpoints.push(Number(mid.toFixed(2)));
      }
      currentStart = null;
    }
  }

  return { totalDurationSec, silenceMidpoints };
}

function cutSingleChunk(
  mp3Path: string,
  outPath: string,
  startSec: number,
  durationSec: number
): Promise<void> {
  return new Promise((resolve, reject) => {
    ffmpeg(mp3Path)
      .setStartTime(startSec)
      .setDuration(durationSec)
      .audioChannels(1)
      .audioFrequency(24000)
      .audioBitrate("64k")
      .format("mp3")
      .on("end", () => resolve())
      .on("error", (err: Error) => reject(err))
      .save(outPath);
  });
}

/**
 * Splits long audio (> 75s) into ~60-75s chunks anchored on natural silences
 * when available so Gemini keeps accurate timing without drift or skipped lines.
 */
export async function splitAudioIntoChunks(
  mp3Path: string,
  tempDir: string,
  prefix: string
): Promise<{ totalDurationSec: number; chunks: AudioChunk[] }> {
  const { totalDurationSec, silenceMidpoints } =
    await analyzeAudioForChunking(mp3Path);

  if (totalDurationSec <= 75) {
    return {
      totalDurationSec,
      chunks: [
        {
          filePath: mp3Path,
          startSec: 0,
          durationSec: totalDurationSec || 75,
          isTemporaryChunk: false,
        },
      ],
    };
  }

  const ranges: Array<{ startSec: number; endSec: number }> = [];
  let cursor = 0;

  while (cursor < totalDurationSec) {
    const remaining = totalDurationSec - cursor;
    if (remaining <= 80) {
      ranges.push({ startSec: cursor, endSec: totalDurationSec });
      break;
    }

    const idealEnd = cursor + 65;
    const windowMin = cursor + 45;
    const windowMax = Math.min(totalDurationSec - 10, cursor + 82);

    // Find silence midpoint closest to idealEnd inside [windowMin, windowMax]
    let bestSilence: number | null = null;
    let bestDist = Infinity;
    for (const mid of silenceMidpoints) {
      if (mid >= windowMin && mid <= windowMax) {
        const dist = Math.abs(mid - idealEnd);
        if (dist < bestDist) {
          bestDist = dist;
          bestSilence = mid;
        }
      }
    }

    if (bestSilence !== null) {
      ranges.push({ startSec: cursor, endSec: bestSilence });
      cursor = bestSilence;
    } else {
      // No silence gap found; use a 1.5s overlap so boundary words aren't cut off
      const cutEnd = idealEnd;
      ranges.push({ startSec: cursor, endSec: cutEnd });
      cursor = Math.max(0, cutEnd - 1.5);
    }
  }

  const chunks: AudioChunk[] = [];
  for (let i = 0; i < ranges.length; i++) {
    const r = ranges[i];
    const durationSec = Number((r.endSec - r.startSec).toFixed(2));
    if (durationSec <= 0.2) continue;

    const chunkPath = path.join(tempDir, `${prefix}-chunk-${i}.mp3`);
    await cutSingleChunk(mp3Path, chunkPath, r.startSec, durationSec);
    chunks.push({
      filePath: chunkPath,
      startSec: Number(r.startSec.toFixed(2)),
      durationSec,
      isTemporaryChunk: true,
    });
  }

  return { totalDurationSec, chunks };
}
