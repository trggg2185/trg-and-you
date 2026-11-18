import { GoogleGenAI, Type, createPartFromUri } from "@google/genai";
import fs from "fs/promises";
import os from "os";
import path from "path";
import { splitAudioIntoChunks, type AudioChunk } from "@/lib/ffmpeg";

export interface GeneratedSubtitle {
  index: number;
  startTime: number;
  endTime: number;
  speaker?: string;
  text: string;
  ipa: string;
}

interface RawGeminiSubtitle {
  startTimestamp: string;
  endTimestamp: string;
  speaker?: string;
  text: string;
  ipa: string;
}

const subtitleResponseSchema = {
  type: Type.OBJECT,
  properties: {
    subtitles: {
      type: Type.ARRAY,
      description:
        "Complete, strictly chronological list of every spoken English sentence or utterance in this audio clip.",
      items: {
        type: Type.OBJECT,
        properties: {
          startTimestamp: {
            type: Type.STRING,
            description:
              "Exact start timestamp within this audio clip formatted as MM:SS.d (e.g., '00:04.2' or '01:02.8').",
          },
          endTimestamp: {
            type: Type.STRING,
            description:
              "Exact end timestamp within this audio clip formatted as MM:SS.d (e.g., '00:07.5' or '01:05.1').",
          },
          speaker: {
            type: Type.STRING,
            description:
              "Character or speaker name if identifiable, otherwise 'Speaker 1' or empty string.",
          },
          text: {
            type: Type.STRING,
            description: "Exact verbatim English transcription of what is spoken.",
          },
          ipa: {
            type: Type.STRING,
            description:
              "Full-sentence IPA transcription enclosed in slashes (e.g., /.../) reflecting natural connected speech.",
          },
        },
        required: ["startTimestamp", "endTimestamp", "text", "ipa"],
      },
    },
  },
  required: ["subtitles"],
};

function formatMmSs(totalSeconds: number): string {
  const safe = Math.max(0, totalSeconds);
  const mins = Math.floor(safe / 60);
  const secs = safe - mins * 60;
  return `${String(mins).padStart(2, "0")}:${secs.toFixed(1).padStart(4, "0")}`;
}

/**
 * Parses timestamps like "01:12.4", "00:05", "1:02:03.5", or raw numeric "12.4".
 */
function parseTimestampToSeconds(value: string): number | null {
  const cleaned = value
    .trim()
    .replace(/^\[|\]$/g, "")
    .replace(/s$/i, "")
    .replace(",", ".");
  if (!cleaned) return null;

  if (/^\d+(\.\d+)?$/.test(cleaned)) {
    return Number(cleaned);
  }

  const parts = cleaned.split(":");
  if (parts.length === 2) {
    const mins = Number(parts[0]);
    const secs = Number(parts[1]);
    if (Number.isFinite(mins) && Number.isFinite(secs)) {
      return mins * 60 + secs;
    }
  } else if (parts.length === 3) {
    const hrs = Number(parts[0]);
    const mins = Number(parts[1]);
    const secs = Number(parts[2]);
    if (Number.isFinite(hrs) && Number.isFinite(mins) && Number.isFinite(secs)) {
      return hrs * 3600 + mins * 60 + secs;
    }
  }

  return null;
}

const GEMINI_MODELS = [
  "gemini-3.8-flash",
  "gemini-3.7-flash",
  "gemini-3.6-flash",
] as const;

function isTransientGeminiError(err: unknown): boolean {
  const status = (err as { status?: number })?.status;
  if (status === 429 || status === 500 || status === 502 || status === 503 || status === 504) {
    return true;
  }
  const msg = err instanceof Error ? err.message : String(err);
  return /503|429|UNAVAILABLE|RESOURCE_EXHAUSTED|high demand|fetch failed/i.test(
    msg
  );
}

async function generateWithRetryAndFallback(
  ai: GoogleGenAI,
  fileUri: string,
  mimeType: string,
  prompt: string
) {
  let lastError: unknown;

  for (const model of GEMINI_MODELS) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        return await ai.models.generateContent({
          model,
          contents: [createPartFromUri(fileUri, mimeType), prompt],
          config: {
            temperature: 0,
            responseMimeType: "application/json",
            responseSchema: subtitleResponseSchema,
          },
        });
      } catch (err) {
        lastError = err;
        if (!isTransientGeminiError(err)) {
          throw err;
        }
        const delayMs = 1500 * (attempt + 1);
        await new Promise((r) => setTimeout(r, delayMs));
      }
    }
  }

  throw lastError;
}

function normalizeWords(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .split(/\s+/)
    .filter(Boolean);
}

function isLikelyDuplicate(a: GeneratedSubtitle, b: GeneratedSubtitle): boolean {
  // Only consider duplicates if they overlap or start within 1.5s of each other
  if (Math.abs(a.startTime - b.startTime) > 1.8 && b.startTime > a.endTime + 0.5) {
    return false;
  }
  const wordsA = normalizeWords(a.text);
  const wordsB = normalizeWords(b.text);
  if (wordsA.length === 0 || wordsB.length === 0) return false;

  const setA = new Set(wordsA);
  let overlap = 0;
  for (const w of wordsB) {
    if (setA.has(w)) overlap++;
  }
  const ratio = overlap / Math.max(wordsA.length, wordsB.length);
  return ratio >= 0.7;
}

async function transcribeChunk(
  ai: GoogleGenAI,
  chunk: AudioChunk
): Promise<GeneratedSubtitle[]> {
  const uploadedFile = await ai.files.upload({
    file: chunk.filePath,
    config: { mimeType: "audio/mpeg" },
  });

  try {
    let fileState = uploadedFile.state;
    let fileUri = uploadedFile.uri;
    const fileName = uploadedFile.name;

    let attempts = 0;
    while (fileState === "PROCESSING" && fileName && attempts < 20) {
      await new Promise((r) => setTimeout(r, 1500));
      const check = await ai.files.get({ name: fileName });
      fileState = check.state;
      fileUri = check.uri;
      attempts++;
    }

    if (!fileUri) {
      throw new Error("Gemini uploaded file URI is missing");
    }

    const clipEndStr = formatMmSs(chunk.durationSec);
    const prompt = `You are a precision English audio transcriber and ESL phonetics coach.
This audio clip is EXACTLY ${chunk.durationSec.toFixed(1)} seconds long (from 00:00.0 to ${clipEndStr}).

Carefully listen to the ENTIRE clip from 00:00.0 until ${clipEndStr} and transcribe EVERY spoken English utterance.
Strict rules:
1. DO NOT skip any spoken lines, including quiet voices, short exclamations ("Oh!", "Wait!", "Yeah!"), fast replies, or dialogue over background music.
2. Timestamps ("startTimestamp" and "endTimestamp") MUST be formatted as MM:SS.d relative to THIS clip (between 00:00.0 and ${clipEndStr}).
   - startTimestamp must mark the exact moment the first syllable begins.
   - endTimestamp must mark the exact moment the last syllable finishes (do not pad with silence).
   - Never output timestamps beyond ${clipEndStr}.
3. Segment long speech into natural, concise shadowing sentences (ideally 3-15 words each).
4. Identify character/speaker name ("speaker") when recognizable, otherwise label consistently or leave empty.
5. Transcribe exact verbatim English ("text") with proper punctuation.
6. Provide full-sentence IPA ("ipa") enclosed in slashes (/.../) reflecting natural connected speech, weak forms, and linking.
7. Do NOT include any Vietnamese translation.`;

    const response = await generateWithRetryAndFallback(
      ai,
      fileUri,
      uploadedFile.mimeType ?? "audio/mpeg",
      prompt
    );

    const rawText = response.text;
    if (!rawText) {
      return [];
    }

    const parsed = JSON.parse(rawText) as { subtitles?: RawGeminiSubtitle[] };
    if (!Array.isArray(parsed.subtitles)) {
      return [];
    }

    const results: GeneratedSubtitle[] = [];
    for (const item of parsed.subtitles) {
      const text = typeof item.text === "string" ? item.text.trim() : "";
      if (!text) continue;

      const relStart = parseTimestampToSeconds(String(item.startTimestamp ?? ""));
      const relEnd = parseTimestampToSeconds(String(item.endTimestamp ?? ""));
      if (relStart === null || relEnd === null) continue;

      const clampedStart = Math.max(0, Math.min(chunk.durationSec - 0.1, relStart));
      const clampedEnd = Math.max(
        clampedStart + 0.2,
        Math.min(chunk.durationSec, relEnd)
      );

      results.push({
        index: results.length + 1,
        startTime: Number((chunk.startSec + clampedStart).toFixed(1)),
        endTime: Number((chunk.startSec + clampedEnd).toFixed(1)),
        speaker: item.speaker?.trim() || undefined,
        text,
        ipa: typeof item.ipa === "string" ? item.ipa.trim() : "",
      });
    }

    return results;
  } finally {
    if (uploadedFile.name) {
      await ai.files.delete({ name: uploadedFile.name }).catch(() => {});
    }
  }
}

export async function transcribeAudioWithGemini(
  mp3Path: string
): Promise<GeneratedSubtitle[]> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY environment variable is not set");
  }

  const ai = new GoogleGenAI({ apiKey });
  const tempDir = os.tmpdir();
  const prefix = `sub-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

  const { totalDurationSec, chunks } = await splitAudioIntoChunks(
    mp3Path,
    tempDir,
    prefix
  );

  try {
    const allSubtitles: GeneratedSubtitle[] = [];

    // Process chunks sequentially to avoid spiking concurrent demand / rate limits
    for (const chunk of chunks) {
      const subs = await transcribeChunk(ai, chunk);
      allSubtitles.push(...subs);
    }

    // Sort chronologically and clean boundary overlaps/duplicates
    allSubtitles.sort((a, b) => a.startTime - b.startTime);

    const cleaned: GeneratedSubtitle[] = [];
    for (const sub of allSubtitles) {
      const prev = cleaned[cleaned.length - 1];
      if (prev && isLikelyDuplicate(prev, sub)) {
        // Keep the more complete line
        if (sub.text.length > prev.text.length) {
          cleaned[cleaned.length - 1] = {
            ...sub,
            startTime: Math.min(prev.startTime, sub.startTime),
          };
        }
        continue;
      }

      let startTime = sub.startTime;
      let endTime = sub.endTime;

      if (prev && startTime < prev.endTime) {
        startTime = Number(prev.endTime.toFixed(1));
      }
      if (totalDurationSec > 0 && endTime > totalDurationSec) {
        endTime = Number(totalDurationSec.toFixed(1));
      }
      if (endTime <= startTime) {
        endTime = Number((startTime + 0.3).toFixed(1));
      }

      cleaned.push({
        ...sub,
        index: cleaned.length + 1,
        startTime,
        endTime,
      });
    }

    return cleaned;
  } finally {
    await Promise.all(
      chunks
        .filter((c) => c.isTemporaryChunk)
        .map((c) => fs.unlink(c.filePath).catch(() => {}))
    );
  }
}
