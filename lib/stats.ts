import { prisma } from "@/lib/prisma";

export interface DailyStudyPoint {
  dateKey: string;
  secondsStudied: number;
  dictationCorrect: number;
}

export interface StudySummary {
  todayKey: string;
  streakDays: number;
  todaySeconds: number;
  todayDictationCorrect: number;
  totalSeconds: number;
  totalDictationCorrect: number;
  dailyGoalMinutes: number;
  dailyLogs: DailyStudyPoint[];
}

export interface GroupLeaderboardMember {
  userId: string;
  username: string;
  avatarUrl: string | null;
  role: string;
  dailyGoalMinutes: number;
  todaySeconds: number;
  weekSeconds: number;
  weekDictationCorrect: number;
  streakDays: number;
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

function getWeekdayMonZero(dateKey: string): number {
  const [y, m, d] = dateKey.split("-").map(Number);
  const jsDay = new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // 0 = Sun
  return (jsDay + 6) % 7; // 0 = Mon .. 6 = Sun
}

function computeStreakFromLogs(
  logs: Array<{ dateKey: string; secondsStudied: number; dictationCorrect: number }>,
  todayKey: string
): number {
  const activeDays = new Set<string>();
  for (const log of logs) {
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
  return streakDays;
}

export async function getStudySummary(userId: string): Promise<StudySummary> {
  const todayKey = getTodayDateKey();
  const [userRecord, logs] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { dailyGoalMinutes: true },
    }),
    prisma.studyLog.findMany({
      where: { userId },
      orderBy: { dateKey: "desc" },
      select: {
        dateKey: true,
        secondsStudied: true,
        dictationCorrect: true,
      },
    }),
  ]);

  let totalSeconds = 0;
  let totalDictationCorrect = 0;
  let todaySeconds = 0;
  let todayDictationCorrect = 0;
  const logMap = new Map<string, DailyStudyPoint>();

  for (const log of logs) {
    totalSeconds += log.secondsStudied;
    totalDictationCorrect += log.dictationCorrect;
    logMap.set(log.dateKey, {
      dateKey: log.dateKey,
      secondsStudied: log.secondsStudied,
      dictationCorrect: log.dictationCorrect,
    });
    if (log.dateKey === todayKey) {
      todaySeconds = log.secondsStudied;
      todayDictationCorrect = log.dictationCorrect;
    }
  }

  const streakDays = computeStreakFromLogs(logs, todayKey);

  // Build 14 full weeks (Monday..Sunday)
  const todayWeekday = getWeekdayMonZero(todayKey);
  const totalSlots = 13 * 7 + (todayWeekday + 1);
  const startKey = shiftDateKey(todayKey, -(totalSlots - 1));
  const dailyLogs: DailyStudyPoint[] = [];

  for (let i = 0; i < totalSlots; i++) {
    const k = shiftDateKey(startKey, i);
    const entry = logMap.get(k);
    dailyLogs.push(
      entry ?? {
        dateKey: k,
        secondsStudied: 0,
        dictationCorrect: 0,
      }
    );
  }

  return {
    todayKey,
    streakDays,
    todaySeconds,
    todayDictationCorrect,
    totalSeconds,
    totalDictationCorrect,
    dailyGoalMinutes: userRecord?.dailyGoalMinutes ?? 15,
    dailyLogs,
  };
}

export async function getGroupWeeklyLeaderboard(): Promise<
  GroupLeaderboardMember[]
> {
  const todayKey = getTodayDateKey();
  const weekKeys = new Set<string>();
  for (let i = 0; i < 7; i++) {
    weekKeys.add(shiftDateKey(todayKey, -i));
  }

  const users = await prisma.user.findMany({
    where: { isBanned: false },
    select: {
      id: true,
      username: true,
      avatarUrl: true,
      role: true,
      dailyGoalMinutes: true,
      studyLogs: {
        select: {
          dateKey: true,
          secondsStudied: true,
          dictationCorrect: true,
        },
      },
    },
  });

  const members: GroupLeaderboardMember[] = users.map((u) => {
    let todaySeconds = 0;
    let weekSeconds = 0;
    let weekDictationCorrect = 0;

    for (const log of u.studyLogs) {
      if (log.dateKey === todayKey) {
        todaySeconds += log.secondsStudied;
      }
      if (weekKeys.has(log.dateKey)) {
        weekSeconds += log.secondsStudied;
        weekDictationCorrect += log.dictationCorrect;
      }
    }

    return {
      userId: u.id,
      username: u.username,
      avatarUrl: u.avatarUrl,
      role: u.role,
      dailyGoalMinutes: u.dailyGoalMinutes,
      todaySeconds,
      weekSeconds,
      weekDictationCorrect,
      streakDays: computeStreakFromLogs(u.studyLogs, todayKey),
    };
  });

  members.sort(
    (a, b) =>
      b.weekSeconds - a.weekSeconds ||
      b.streakDays - a.streakDays ||
      a.username.localeCompare(b.username)
  );

  return members;
}
