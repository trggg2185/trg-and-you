import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { lookupWordWithGemini } from "@/lib/gemini";

interface FreeDictResponse {
  phonetic?: string;
  phonetics?: Array<{ text?: string }>;
  meanings?: Array<{
    partOfSpeech?: string;
    definitions?: Array<{ definition?: string }>;
  }>;
}

async function fetchFreeDictionary(word: string): Promise<{
  phonetic: string;
  partOfSpeech: string;
  definitionEn: string;
} | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 3500);
  try {
    const res = await fetch(
      `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(
        word
      )}`,
      { signal: controller.signal }
    );
    if (!res.ok) return null;
    const json = (await res.json()) as FreeDictResponse[];
    const first = json?.[0];
    if (!first) return null;

    const phonetic =
      first.phonetic?.trim() ||
      first.phonetics?.find((p) => p.text?.trim())?.text?.trim() ||
      "";
    const firstMeaning = first.meanings?.[0];
    const partOfSpeech = firstMeaning?.partOfSpeech?.trim() || "";
    const definitionEn =
      firstMeaning?.definitions?.[0]?.definition?.trim() || "";

    return { phonetic, partOfSpeech, definitionEn };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function normalizeLookupWord(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/^[^a-z']+|[^a-z']+$/g, "")
    .slice(0, 60);
}

export async function GET(request: NextRequest) {
  try {
    const rawWord = request.nextUrl.searchParams.get("word") ?? "";
    const context =
      request.nextUrl.searchParams.get("context")?.trim().slice(0, 240) || "";
    const word = normalizeLookupWord(rawWord);

    if (!word) {
      return NextResponse.json(
        { error: "Vui lòng chọn một từ tiếng Anh hợp lệ." },
        { status: 400 }
      );
    }

    // 1. Check shared DB cache first
    const cached = await prisma.wordEntry.findUnique({ where: { word } });
    if (cached && cached.meaningVi) {
      return NextResponse.json({
        word: cached.word,
        phonetic: cached.phonetic,
        partOfSpeech: cached.partOfSpeech,
        meaningVi: cached.meaningVi,
        cached: true,
      });
    }

    // 2. Fetch free dictionary (IPA/POS fallback) + Gemini concise Vietnamese meaning in parallel
    const [dictRes, geminiRes] = await Promise.all([
      fetchFreeDictionary(word),
      lookupWordWithGemini(word, context || undefined),
    ]);

    const phonetic = geminiRes?.phonetic || dictRes?.phonetic || "";
    const partOfSpeech =
      geminiRes?.partOfSpeech || dictRes?.partOfSpeech || "";
    const meaningVi =
      geminiRes?.meaningVi || dictRes?.definitionEn || "";

    if (!meaningVi) {
      return NextResponse.json(
        {
          word,
          phonetic,
          partOfSpeech,
          meaningVi: "Chưa tìm thấy nghĩa cho từ này. Bạn có thể thử lại sau.",
          found: false,
        },
        { status: 200 }
      );
    }

    // 3. Cache only when we have a real meaning
    await prisma.wordEntry
      .upsert({
        where: { word },
        create: { word, phonetic, partOfSpeech, meaningVi },
        update: { phonetic, partOfSpeech, meaningVi },
      })
      .catch(() => {});

    return NextResponse.json({
      word,
      phonetic,
      partOfSpeech,
      meaningVi,
      cached: false,
    });
  } catch (error) {
    console.error("Word lookup error:", error);
    return NextResponse.json(
      { error: "Không thể tra từ lúc này." },
      { status: 500 }
    );
  }
}
