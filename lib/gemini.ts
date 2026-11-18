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

const MAX_INLINE_AUDIO_BYTES = 10 * 1024 * 1024; // 10 MB

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
            description:
              "Exact verbatim English transcription of what is spoken.",
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

function getGeminiApiKeys(): string[] {
  const keys: string[] = [];

  if (process.env.GEMINI_API_KEYS) {
    for (const part of process.env.GEMINI_API_KEYS.split(",")) {
      const k = part.trim();
      if (k) keys.push(k);
    }
  }

  for (const envName of [
    "GEMINI_API_KEY",
    "GEMINI_API_KEY_2",
    "GEMINI_API_KEY_3",
  ]) {
    const val = process.env[envName]?.trim();
    if (val) keys.push(val);
  }

  return Array.from(new Set(keys));
}

function createGeminiClient(apiKey: string): GoogleGenAI {
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      timeout: 65000,
      // Disable SDK's hidden 5x retry storm; we handle key rotation & fast fallback explicitly
      retryOptions: {
        attempts: 1,
      },
    },
  });
}

function formatMmSs(totalSeconds: number): string {
  const safe = Math.max(0, totalSeconds);
  const mins = Math.floor(safe / 60);
  const secs = safe - mins * 60;
  return `${String(mins).padStart(2, "0")}:${secs.toFixed(1).padStart(4, "0")}`;
}

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

function isRateLimitError(err: unknown): boolean {
  const status = (err as { status?: number })?.status;
  if (status === 429) return true;
  const msg = err instanceof Error ? err.message : String(err);
  return /429|RESOURCE_EXHAUSTED|quota|rate limit/i.test(msg);
}

function isTransientServerError(err: unknown): boolean {
  const status = (err as { status?: number })?.status;
  if (status === 500 || status === 502 || status === 503 || status === 504) {
    return true;
  }
  const msg = err instanceof Error ? err.message : String(err);
  return /503|UNAVAILABLE|high demand|fetch failed|timeout/i.test(msg);
}

function normalizeWords(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .split(/\s+/)
    .filter(Boolean);
}

function isLikelyDuplicate(a: GeneratedSubtitle, b: GeneratedSubtitle): boolean {
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

async function generateForAudioPart(
  ai: GoogleGenAI,
  audioPart: ReturnType<typeof createPartFromUri> | { inlineData: { data: string; mimeType: string } },
  prompt: string
) {
  const models = ["gemini-3.8-flash", "gemini-3.7-flash"] as const;
  let lastError: unknown;

  for (let i = 0; i < models.length; i++) {
    const model = models[i];
    try {
      return await ai.models.generateContent({
        model,
        contents: [audioPart, prompt],
        config: {
          temperature: 0,
          responseMimeType: "application/json",
          responseSchema: subtitleResponseSchema,
        },
      });
    } catch (err) {
      lastError = err;
      if (isRateLimitError(err)) {
        // Bubble 429 immediately so caller can rotate to next API key or fail fast
        throw err;
      }
      if (!isTransientServerError(err) || i === models.length - 1) {
        throw err;
      }
      await new Promise((r) => setTimeout(r, 1200));
    }
  }

  throw lastError;
}

async function transcribeChunkWithKey(
  apiKey: string,
  chunk: AudioChunk,
  inlineBase64: string | null
): Promise<GeneratedSubtitle[]> {
  const ai = createGeminiClient(apiKey);
  let uploadedFileName: string | undefined;

  try {
    let audioPart:
      | ReturnType<typeof createPartFromUri>
      | { inlineData: { data: string; mimeType: string } };

    if (inlineBase64) {
      audioPart = {
        inlineData: {
          data: inlineBase64,
          mimeType: "audio/mpeg",
        },
      };
    } else {
      const uploadedFile = await ai.files.upload({
        file: chunk.filePath,
        config: { mimeType: "audio/mpeg" },
      });
      uploadedFileName = uploadedFile.name;

      let fileState = uploadedFile.state;
      let fileUri = uploadedFile.uri;

      let attempts = 0;
      while (fileState === "PROCESSING" && uploadedFileName && attempts < 15) {
        await new Promise((r) => setTimeout(r, 1500));
        const check = await ai.files.get({ name: uploadedFileName });
        fileState = check.state;
        fileUri = check.uri;
        attempts++;
      }

      if (!fileUri) {
        throw new Error("Gemini uploaded file URI is missing");
      }

      audioPart = createPartFromUri(
        fileUri,
        uploadedFile.mimeType ?? "audio/mpeg"
      );
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

    const response = await generateForAudioPart(ai, audioPart, prompt);
    const rawText = response.text;
    if (!rawText) return [];

    const parsed = JSON.parse(rawText) as { subtitles?: RawGeminiSubtitle[] };
    if (!Array.isArray(parsed.subtitles)) return [];

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
    if (uploadedFileName) {
      await ai.files.delete({ name: uploadedFileName }).catch(() => {});
    }
  }
}

export async function transcribeAudioWithGemini(
  mp3Path: string
): Promise<GeneratedSubtitle[]> {
  const apiKeys = getGeminiApiKeys();
  if (apiKeys.length === 0) {
    throw new Error("GEMINI_API_KEY environment variable is not set");
  }

  const tempDir = os.tmpdir();
  const prefix = `sub-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

  const { totalDurationSec, chunks } = await splitAudioIntoChunks(
    mp3Path,
    tempDir,
    prefix
  );

  try {
    const allSubtitles: GeneratedSubtitle[] = [];
    let activeKeyIdx = 0;

    for (const chunk of chunks) {
      const stat = await fs.stat(chunk.filePath);
      const inlineBase64 =
        stat.size <= MAX_INLINE_AUDIO_BYTES
          ? (await fs.readFile(chunk.filePath)).toString("base64")
          : null;

      let subs: GeneratedSubtitle[] | null = null;
      let lastError: unknown;

      // Try from activeKeyIdx onward; rotate if a key hits 429 rate limit
      for (let k = activeKeyIdx; k < apiKeys.length; k++) {
        try {
          subs = await transcribeChunkWithKey(apiKeys[k], chunk, inlineBase64);
          activeKeyIdx = k;
          break;
        } catch (err) {
          lastError = err;
          if (isRateLimitError(err) && k < apiKeys.length - 1) {
            console.warn(
              `Gemini key #${k + 1} reached rate limit, rotating to key #${k + 2}...`
            );
            continue;
          }
          throw err;
        }
      }

      if (!subs) {
        throw lastError ?? new Error("All Gemini API keys failed");
      }

      allSubtitles.push(...subs);
    }

    allSubtitles.sort((a, b) => a.startTime - b.startTime);

    const cleaned: GeneratedSubtitle[] = [];
    for (const sub of allSubtitles) {
      const prev = cleaned[cleaned.length - 1];
      if (prev && isLikelyDuplicate(prev, sub)) {
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
