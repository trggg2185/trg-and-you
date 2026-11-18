import { GoogleGenAI, Type, createPartFromUri } from "@google/genai";

export interface GeneratedSubtitle {
  index: number;
  startTime: number;
  endTime: number;
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
        "Chronological list of spoken English sentences from the audio.",
      items: {
        type: Type.OBJECT,
        properties: {
          index: {
            type: Type.INTEGER,
            description: "1-based sequential index of the sentence.",
          },
          startTime: {
            type: Type.NUMBER,
            description:
              "Start time of the sentence in seconds, accurate to 0.1s (e.g., 12.4).",
          },
          endTime: {
            type: Type.NUMBER,
            description:
              "End time of the sentence in seconds, accurate to 0.1s (e.g., 15.8).",
          },
          speaker: {
            type: Type.STRING,
            description:
              "Character or speaker name if identifiable, otherwise 'Speaker 1' or empty.",
          },
          text: {
            type: Type.STRING,
            description: "Accurate English transcription of the spoken sentence.",
          },
          ipa: {
            type: Type.STRING,
            description:
              "Full-sentence IPA transcription reflecting natural connected speech and intonation.",
          },
        },
        required: ["index", "startTime", "endTime", "text", "ipa"],
      },
    },
  },
  required: ["subtitles"],
};

export async function transcribeAudioWithGemini(
  mp3Path: string
): Promise<GeneratedSubtitle[]> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY environment variable is not set");
  }

  const ai = new GoogleGenAI({ apiKey });

  const uploadedFile = await ai.files.upload({
    file: mp3Path,
    config: { mimeType: "audio/mpeg" },
  });

  try {
    let fileState = uploadedFile.state;
    let fileUri = uploadedFile.uri;
    const fileName = uploadedFile.name;

    // Wait briefly if Gemini is still processing the uploaded audio file
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

    const prompt = `You are an expert English phonetics and ESL shadowing coach.
Listen carefully to the entire audio track from this animated video.
Your task:
1. Segment all spoken English dialogue into natural, complete sentences or short conversational utterances suitable for English shadowing practice.
2. Provide accurate real-time timestamps ("startTime" and "endTime" in seconds, rounded to 0.1s, e.g. 4.2, 7.8). Ensure startTime < endTime and timestamps do not overlap.
3. Identify the character or speaker name ("speaker") if recognizable from context, or label consistently (e.g. "Narrator", "Character A").
4. Transcribe the exact English dialogue ("text") with proper punctuation and capitalization.
5. Provide full-sentence International Phonetic Alphabet ("ipa") transcription enclosed in slashes (e.g. /.../), reflecting natural American/British connected speech, weak forms, linking, and natural rhythm.
6. Do NOT include any Vietnamese translation.`;

    const response = await ai.models.generateContent({
      model: "gemini-3.8-flash",
      contents: [
        createPartFromUri(fileUri, uploadedFile.mimeType ?? "audio/mpeg"),
        prompt,
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: subtitleResponseSchema,
      },
    });

    const rawText = response.text;
    if (!rawText) {
      throw new Error("Gemini returned an empty response");
    }

    const parsed = JSON.parse(rawText) as { subtitles?: GeneratedSubtitle[] };
    if (!Array.isArray(parsed.subtitles)) {
      throw new Error("Gemini response JSON did not contain subtitles array");
    }

    return parsed.subtitles.map((sub, i) => ({
      index: typeof sub.index === "number" ? sub.index : i + 1,
      startTime: Number(Number(sub.startTime).toFixed(1)),
      endTime: Number(Number(sub.endTime).toFixed(1)),
      speaker: sub.speaker?.trim() || undefined,
      text: sub.text.trim(),
      ipa: sub.ipa.trim(),
    }));
  } finally {
    if (uploadedFile.name) {
      await ai.files.delete({ name: uploadedFile.name }).catch(() => {});
    }
  }
}
