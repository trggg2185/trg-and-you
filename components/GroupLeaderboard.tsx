"use client";

import { Flame, Trophy } from "lucide-react";
import UserAvatar from "@/components/UserAvatar";
import type { GroupLeaderboardMember } from "@/lib/stats";

interface GroupLeaderboardProps {
  members: GroupLeaderboardMember[];
  currentUserId: string;
}

function formatStudyLabel(seconds: number): string {
  if (seconds <= 0) return "0 phút";
  if (seconds < 60) return `${seconds} giây`;
  return `${Math.round(seconds / 60)} phút`;
}

export default function GroupLeaderboard({
  members,
  currentUserId,
}: GroupLeaderboardProps) {
  if (members.length === 0) return null;

  const maxWeekSeconds = Math.max(
    1,
    ...members.map((m) => m.weekSeconds)
  );

  return (
    <div className="rounded-2xl border border-slate-200/90 bg-white p-5 sm:p-6 shadow-2xs">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Trophy className="h-4 w-4 text-amber-500" />
          <h3 className="text-sm sm:text-base font-semibold text-slate-900">
            Hoạt động nhóm 7 ngày qua
          </h3>
        </div>
        <span className="text-xs text-slate-500">
          {members.length} thành viên đang hoạt động
        </span>
      </div>

      <div className="space-y-3">
        {members.map((m, idx) => {
          const isMe = m.userId === currentUserId;
          const barWidth =
            m.weekSeconds > 0
              ? Math.max(6, Math.round((m.weekSeconds / maxWeekSeconds) * 100))
              : 0;
          const todayGoalSec = Math.max(1, m.dailyGoalMinutes) * 60;
          const goalPct = Math.min(
            100,
            Math.round((m.todaySeconds / todayGoalSec) * 100)
          );

          return (
            <div
              key={m.userId}
              className={`rounded-xl border p-3.5 transition ${
                isMe
                  ? "border-teal-200 bg-teal-50/40"
                  : "border-slate-100 bg-slate-50/50"
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2.5">
                  <span
                    className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                      idx === 0 && m.weekSeconds > 0
                        ? "bg-amber-100 text-amber-800"
                        : "bg-slate-200/80 text-slate-600"
                    }`}
                  >
                    {idx + 1}
                  </span>

                  <UserAvatar
                    src={m.avatarUrl}
                    name={m.username}
                    sizeClass="h-8 w-8"
                    textClass="text-xs"
                  />

                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="truncate text-sm font-semibold text-slate-900">
                        {m.username}
                      </span>
                      {isMe && (
                        <span className="rounded bg-teal-700 px-1.5 py-0.5 text-[10px] font-bold text-white">
                          Bạn
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-500">
                      Hôm nay: {formatStudyLabel(m.todaySeconds)} /{" "}
                      {m.dailyGoalMinutes} phút ({goalPct}%)
                      {m.weekDictationCorrect > 0 && (
                        <> · {m.weekDictationCorrect} câu đúng tuần này</>
                      )}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 text-xs shrink-0">
                  <span className="inline-flex items-center gap-1 rounded-lg bg-amber-50 px-2 py-1 font-semibold text-amber-700 border border-amber-200/70">
                    <Flame className="h-3.5 w-3.5" />
                    <span>{m.streakDays}d</span>
                  </span>
                  <span className="min-w-[68px] text-right font-bold text-teal-800">
                    {formatStudyLabel(m.weekSeconds)}
                  </span>
                </div>
              </div>

              {barWidth > 0 && (
                <div className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-200/70">
                  <div
                    className="h-full rounded-full bg-teal-600 transition-all"
                    style={{ width: `${barWidth}%` }}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
