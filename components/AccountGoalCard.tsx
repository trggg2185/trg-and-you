"use client";

import { useState } from "react";
import { Target } from "lucide-react";
import DailyGoalControl from "@/components/DailyGoalControl";

interface AccountGoalCardProps {
  todaySeconds: number;
  initialDailyGoalMinutes: number;
}

function formatMins(seconds: number): string {
  if (seconds <= 0) return "0 phút";
  if (seconds < 60) return `${seconds} giây`;
  return `${Math.round(seconds / 60)} phút`;
}

export default function AccountGoalCard({
  todaySeconds,
  initialDailyGoalMinutes,
}: AccountGoalCardProps) {
  const [prevPropGoal, setPrevPropGoal] = useState(initialDailyGoalMinutes);
  const [goalMinutes, setGoalMinutes] = useState(initialDailyGoalMinutes);
  if (initialDailyGoalMinutes !== prevPropGoal) {
    setPrevPropGoal(initialDailyGoalMinutes);
    setGoalMinutes(initialDailyGoalMinutes);
  }

  const goalPct = Math.min(
    100,
    Math.round((todaySeconds / Math.max(1, goalMinutes * 60)) * 100)
  );

  return (
    <div className="flex flex-col justify-center gap-2 rounded-2xl border border-teal-200/80 bg-white px-4 py-3.5 shadow-2xs">
      <div className="flex items-center gap-2.5 min-w-0">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-teal-50 text-teal-700">
          <Target className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs text-slate-500">Mục tiêu hôm nay</p>
          <p className="truncate text-base font-bold text-slate-900">
            {formatMins(todaySeconds)} / {goalMinutes}p{" "}
            <span className="text-xs font-semibold text-teal-700">
              ({goalPct}%)
            </span>
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <div className="h-1.5 min-w-8 flex-1 overflow-hidden rounded-full bg-slate-100">
          <div
            className={`h-full transition-all ${
              goalPct >= 100 ? "bg-emerald-500" : "bg-teal-600"
            }`}
            style={{ width: `${goalPct}%` }}
          />
        </div>
        <DailyGoalControl
          currentMinutes={goalMinutes}
          todaySeconds={todaySeconds}
          onUpdated={setGoalMinutes}
        />
      </div>
    </div>
  );
}
