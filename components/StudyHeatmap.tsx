"use client";

import { useState } from "react";
import { CalendarDays } from "lucide-react";
import type { DailyStudyPoint } from "@/lib/stats";

interface StudyHeatmapProps {
  dailyLogs: DailyStudyPoint[];
  todayKey: string;
  compact?: boolean;
}

function getIntensityClass(seconds: number, dictationCorrect: number): string {
  const scoreSeconds = seconds + dictationCorrect * 20;
  if (scoreSeconds <= 0) {
    return "bg-slate-100 border-slate-200/70";
  }
  if (scoreSeconds < 300) {
    return "bg-teal-100 border-teal-200/80";
  }
  if (scoreSeconds < 900) {
    return "bg-teal-300 border-teal-400/70";
  }
  if (scoreSeconds < 1800) {
    return "bg-teal-500 border-teal-600/80";
  }
  return "bg-teal-700 border-teal-800/80";
}

function formatViDate(dateKey: string): string {
  const [y, m, d] = dateKey.split("-");
  return `${d}/${m}/${y}`;
}

function formatMinutesLabel(seconds: number): string {
  if (seconds <= 0) return "0 phút";
  if (seconds < 60) return `${seconds} giây`;
  return `${Math.round(seconds / 60)} phút`;
}

const WEEKDAY_LABELS = ["T2", "", "T4", "", "T6", "", "CN"];

export default function StudyHeatmap({
  dailyLogs,
  todayKey,
  compact = false,
}: StudyHeatmapProps) {
  const [selected, setSelected] = useState<DailyStudyPoint | null>(() => {
    return dailyLogs.find((d) => d.dateKey === todayKey) ?? null;
  });

  if (dailyLogs.length === 0) return null;

  // Group into columns of 7 (Monday .. Sunday)
  const weeks: Array<Array<DailyStudyPoint | null>> = [];
  for (let i = 0; i < dailyLogs.length; i += 7) {
    const slice: Array<DailyStudyPoint | null> = dailyLogs.slice(i, i + 7);
    while (slice.length < 7) slice.push(null);
    weeks.push(slice);
  }

  return (
    <div
      className={`rounded-2xl border border-slate-200/90 bg-white shadow-2xs ${
        compact ? "p-3.5 sm:p-4" : "p-5 sm:p-6"
      }`}
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <CalendarDays className="h-4 w-4 text-teal-700" />
          <h3 className="text-xs sm:text-sm font-semibold text-slate-900">
            Biểu đồ chuyên cần ({weeks.length} tuần gần nhất)
          </h3>
        </div>

        <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
          <span>Ít</span>
          <span className="h-2.5 w-2.5 rounded-[2px] border border-slate-200/70 bg-slate-100" />
          <span className="h-2.5 w-2.5 rounded-[2px] border border-teal-200/80 bg-teal-100" />
          <span className="h-2.5 w-2.5 rounded-[2px] border border-teal-400/70 bg-teal-300" />
          <span className="h-2.5 w-2.5 rounded-[2px] border border-teal-600/80 bg-teal-500" />
          <span className="h-2.5 w-2.5 rounded-[2px] border border-teal-800/80 bg-teal-700" />
          <span>Nhiều</span>
        </div>
      </div>

      <div className="overflow-x-auto pb-1">
        <div className="inline-flex items-start gap-2">
          <div className="grid grid-rows-7 gap-1 pt-0.5 text-[10px] font-medium leading-none text-slate-400">
            {WEEKDAY_LABELS.map((lbl, idx) => (
              <span
                key={idx}
                className="flex h-3 sm:h-3.5 items-center justify-end pr-0.5"
              >
                {lbl}
              </span>
            ))}
          </div>

          <div className="flex gap-1">
            {weeks.map((week, wIdx) => (
              <div key={wIdx} className="grid grid-rows-7 gap-1">
                {week.map((day, dIdx) => {
                  if (!day) {
                    return (
                      <span
                        key={`empty-${wIdx}-${dIdx}`}
                        className="h-3 w-3 sm:h-3.5 sm:w-3.5"
                      />
                    );
                  }
                  const isToday = day.dateKey === todayKey;
                  const isSelected = selected?.dateKey === day.dateKey;
                  const label = `${formatViDate(day.dateKey)}: ${formatMinutesLabel(
                    day.secondsStudied
                  )}${
                    day.dictationCorrect > 0
                      ? ` • ${day.dictationCorrect} câu đúng`
                      : ""
                  }`;
                  return (
                    <button
                      key={day.dateKey}
                      type="button"
                      title={label}
                      aria-label={label}
                      onMouseEnter={() => setSelected(day)}
                      onClick={() => setSelected(day)}
                      className={`h-3 w-3 sm:h-3.5 sm:w-3.5 rounded-[3px] border transition cursor-pointer ${getIntensityClass(
                        day.secondsStudied,
                        day.dictationCorrect
                      )} ${
                        isSelected
                          ? "ring-2 ring-teal-700 ring-offset-1"
                          : isToday
                          ? "ring-1 ring-slate-400"
                          : ""
                      }`}
                    />
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

      <p className="mt-2.5 text-xs text-slate-500">
        {selected ? (
          <>
            <strong className="font-semibold text-slate-700">
              {formatViDate(selected.dateKey)}
              {selected.dateKey === todayKey ? " (Hôm nay)" : ""}:
            </strong>{" "}
            Học{" "}
            <span className="font-semibold text-teal-800">
              {formatMinutesLabel(selected.secondsStudied)}
            </span>
            {selected.dictationCorrect > 0 && (
              <> · {selected.dictationCorrect} câu chép chính tả đúng</>
            )}
          </>
        ) : (
          "Di chuột hoặc bấm vào từng ô vuông để xem thời gian học theo ngày."
        )}
      </p>
    </div>
  );
}
