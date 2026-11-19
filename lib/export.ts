export interface ExportSubtitleRow {
  index: number;
  startTime: number;
  endTime: number;
  speaker?: string | null;
  text: string;
  ipa: string;
}

export interface AnkiCsvRow {
  front: string;
  back: string;
  tags?: string;
}

function formatSrtTimestamp(seconds: number): string {
  const safe = Math.max(0, seconds);
  const totalMs = Math.round(safe * 1000);
  const hrs = Math.floor(totalMs / 3_600_000);
  const mins = Math.floor((totalMs % 3_600_000) / 60_000);
  const secs = Math.floor((totalMs % 60_000) / 1000);
  const ms = totalMs % 1000;
  return `${String(hrs).padStart(2, "0")}:${String(mins).padStart(
    2,
    "0"
  )}:${String(secs).padStart(2, "0")},${String(ms).padStart(3, "0")}`;
}

function formatReadableTime(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds));
  const mins = Math.floor(safe / 60);
  const secs = safe % 60;
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

export function sanitizeFilename(name: string): string {
  const cleaned = name
    .trim()
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, "")
    .replace(/\s+/g, "-")
    .slice(0, 64);
  return cleaned || "lesson";
}

/** Builds standard SubRip (.srt) subtitle text. */
export function formatSrtContent(subtitles: ExportSubtitleRow[]): string {
  return subtitles
    .map((sub, i) => {
      const num = i + 1;
      const start = formatSrtTimestamp(sub.startTime);
      const end = formatSrtTimestamp(Math.max(sub.startTime + 0.3, sub.endTime));
      const speakerPrefix = sub.speaker ? `${sub.speaker}: ` : "";
      return `${num}\n${start} --> ${end}\n${speakerPrefix}${sub.text}`;
    })
    .join("\n\n");
}

/** Builds readable transcript (.txt) including timestamps, speaker, text, and IPA. */
export function formatTxtTranscript(
  title: string,
  subtitles: ExportSubtitleRow[]
): string {
  const header = `${title}\n${"=".repeat(Math.min(60, Math.max(12, title.length)))}\n`;
  const lines = subtitles.map((sub, i) => {
    const time = formatReadableTime(sub.startTime);
    const speaker = sub.speaker ? ` [${sub.speaker}]` : "";
    return `${i + 1}. [${time}]${speaker} ${sub.text}\n   ${sub.ipa}`;
  });
  return `${header}\n${lines.join("\n\n")}\n`;
}

function escapeCsvCell(value: string): string {
  const normalized = value.replace(/\r?\n/g, "<br>");
  if (/[",]/.test(normalized)) {
    return `"${normalized.replace(/"/g, '""')}"`;
  }
  return normalized;
}

/** Builds UTF-8 BOM CSV compatible with Anki & Excel imports (Front,Back,Tags). */
export function formatAnkiCsv(rows: AnkiCsvRow[]): string {
  const header = "Front,Back,Tags";
  const body = rows.map(
    (r) =>
      `${escapeCsvCell(r.front)},${escapeCsvCell(r.back)},${escapeCsvCell(
        r.tags ?? ""
      )}`
  );
  return `\uFEFF${[header, ...body].join("\n")}\n`;
}

export function triggerTextDownload(
  filename: string,
  content: string,
  mimeType = "text/plain;charset=utf-8"
): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
