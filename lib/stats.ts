import { prisma } from "@/lib/prisma";

export interface StudySummary {
  todayKey: string;
  streakDays: number;
  todaySeconds: number;
  todayDictationCorrect: number;
  totalSeconds: number;
  totalDictationCorrect: number;
}

const vnFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Ho_Chi_Minh",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export function getTodayDateKey(date = new Date()): string {
  return vnFormatter.format(date);
}

function shiftDateKey(dateKey: string, deltaDays: number): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  const utc = Date.UTC(y, m - 1, d + deltaDays);
  const dt = new Date(utc);
  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(dt.getUTCDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

export async function getStudySummary(userId: string): Promise<StudySummary> {
  const todayKey = getTodayDateKey();
  const logs = await prisma.studyLog.findMany({
    where: { userId },
    orderBy: { dateKey: "desc" },
    select: {
      dateKey: true,
      secondsStudied: true,
      dictationCorrect: true,
    },
  });

  let totalSeconds = 0;
  let totalDictationCorrect = 0;
  let todaySeconds = 0;
  let todayDictationCorrect = 0;
  const activeDays = new Set<string>();

  for (const log of logs) {
    totalSeconds += log.secondsStudied;
    totalDictationCorrect += log.dictationCorrect;
    if (log.dateKey === todayKey) {
      todaySeconds = log.secondsStudied;
      todayDictationCorrect = log.dictationCorrect;
    }
    if (log.secondsStudied >= 30 || log.dictationCorrect > 0) {
      activeDays.add(log.dateKey);
    }
  }

  let streakDays = 0;
  let cursor = activeDays.has(todayKey)
    ? todayKey
    : shiftDateKey(todayKey, -1);

  while (activeDays.has(cursor)) {
    streakDays += 1;
    cursor = shiftDateKey(cursor, -1);
  }

  return {
    todayKey,
    streakDays,
    todaySeconds,
    todayDictationCorrect,
    totalSeconds,
    totalDictationCorrect,
  };
}
