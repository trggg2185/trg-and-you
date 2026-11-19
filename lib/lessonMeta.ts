export const LESSON_LEVELS = ["A1", "A2", "B1", "B2", "C1"] as const;
export type LessonLevel = (typeof LESSON_LEVELS)[number];

export function normalizeLevel(input: unknown): LessonLevel | null {
  if (typeof input !== "string") return null;
  const upper = input.trim().toUpperCase();
  return (LESSON_LEVELS as readonly string[]).includes(upper)
    ? (upper as LessonLevel)
    : null;
}

export function normalizeTagsInput(input: unknown): string {
  if (typeof input !== "string") return "";
  const seen = new Set<string>();
  const cleaned: string[] = [];

  for (const part of input.split(",")) {
    const tag = part.trim().slice(0, 32);
    if (!tag) continue;
    const key = tag.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    cleaned.push(tag);
    if (cleaned.length >= 8) break;
  }

  return cleaned.join(", ");
}

export function parseTagsList(tags: string | null | undefined): string[] {
  if (!tags) return [];
  return tags
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
}

export const LEVEL_BADGE_STYLES: Record<string, string> = {
  A1: "bg-emerald-50 text-emerald-700 border-emerald-200",
  A2: "bg-teal-50 text-teal-700 border-teal-200",
  B1: "bg-sky-50 text-sky-700 border-sky-200",
  B2: "bg-indigo-50 text-indigo-700 border-indigo-200",
  C1: "bg-purple-50 text-purple-700 border-purple-200",
};
