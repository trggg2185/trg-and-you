"use client";

import { FormEvent, useEffect, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { Check, Loader2, Pencil, Target, X } from "lucide-react";
import { useToast } from "@/components/ToastProvider";

const emptySubscribe = () => () => {};

interface DailyGoalControlProps {
  currentMinutes: number;
  todaySeconds?: number;
  onUpdated?: (nextMinutes: number) => void;
}

const GOAL_PRESETS = [5, 10, 15, 20, 30, 45, 60];

function formatStudyPreview(seconds: number): string {
  if (seconds <= 0) return "0 phút";
  if (seconds < 60) return `${seconds} giây`;
  return `${Math.round(seconds / 60)} phút`;
}

export default function DailyGoalControl({
  currentMinutes,
  todaySeconds,
  onUpdated,
}: DailyGoalControlProps) {
  const [open, setOpen] = useState(false);
  const mounted = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-lg border border-teal-200 bg-teal-50/80 px-2 py-0.5 text-[11px] font-semibold text-teal-800 transition hover:border-teal-300 hover:bg-teal-100 cursor-pointer"
      >
        <Pencil className="h-2.5 w-2.5 shrink-0" />
        <span>Đặt mục tiêu</span>
      </button>

      {open && mounted && (
        <DailyGoalDialog
          currentMinutes={currentMinutes}
          todaySeconds={todaySeconds}
          onUpdated={onUpdated}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

function DailyGoalDialog({
  currentMinutes,
  todaySeconds,
  onUpdated,
  onClose,
}: {
  currentMinutes: number;
  todaySeconds?: number;
  onUpdated?: (nextMinutes: number) => void;
  onClose: () => void;
}) {
  const router = useRouter();
  const toast = useToast();
  const [customValue, setCustomValue] = useState(String(currentMinutes));
  const [savingTarget, setSavingTarget] = useState<number | "custom" | null>(
    null
  );
  const saving = savingTarget !== null;

  useEffect(() => {
    function handleEsc(e: KeyboardEvent) {
      if (e.key === "Escape" && !saving) {
        onClose();
      }
    }
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [saving, onClose]);

  async function saveMinutes(mins: number, source: number | "custom") {
    const safe = Math.min(180, Math.max(5, Math.round(mins)));
    if (safe === currentMinutes) {
      onClose();
      return;
    }

    setSavingTarget(source);
    try {
      const res = await fetch("/api/auth/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dailyGoalMinutes: safe }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 400 && safe === currentMinutes) {
          onClose();
          return;
        }
        toast.error(data.error || "Không thể lưu mục tiêu học tập.");
        return;
      }

      onUpdated?.(safe);
      toast.success(`Đã đặt mục tiêu học hôm nay: ${safe} phút/ngày.`);
      onClose();
      router.refresh();
    } catch {
      toast.error("Không thể kết nối máy chủ.");
    } finally {
      setSavingTarget(null);
    }
  }

  function handleCustomSubmit(e: FormEvent) {
    e.preventDefault();
    const parsed = Number(customValue);
    if (
      customValue.trim() === "" ||
      !Number.isFinite(parsed) ||
      parsed < 5 ||
      parsed > 180
    ) {
      toast.error("Vui lòng nhập mục tiêu từ 5 đến 180 phút.");
      return;
    }
    void saveMinutes(parsed, "custom");
  }

  const parsedPreview = Number(customValue);
  const previewGoal =
    customValue.trim() !== "" && Number.isFinite(parsedPreview)
      ? Math.min(180, Math.max(5, Math.round(parsedPreview)))
      : currentMinutes;
  const previewPct =
    typeof todaySeconds === "number"
      ? Math.min(
          100,
          Math.round((todaySeconds / Math.max(1, previewGoal * 60)) * 100)
        )
      : null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="daily-goal-dialog-title"
    >
      <div
        onClick={() => {
          if (!saving) onClose();
        }}
        className="animate-modal-backdrop fixed inset-0 bg-slate-900/50"
      />

      <div className="animate-modal-panel relative z-10 w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl shadow-slate-900/20">
        <button
          type="button"
          disabled={saving}
          onClick={onClose}
          aria-label="Đóng chỉnh mục tiêu"
          className="absolute right-3.5 top-3.5 rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 disabled:opacity-40 cursor-pointer"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="mb-4 flex items-center gap-3 pr-7">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-teal-50 text-teal-700">
            <Target className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h3
              id="daily-goal-dialog-title"
              className="text-sm font-bold text-slate-900"
            >
              Mục tiêu học mỗi ngày
            </h3>
            <p className="text-xs text-slate-500">
              Hiện tại:{" "}
              <span className="font-semibold text-teal-700">
                {currentMinutes} phút/ngày
              </span>
            </p>
          </div>
        </div>

        {previewPct !== null && typeof todaySeconds === "number" && (
          <div className="mb-4 rounded-xl border border-slate-100 bg-slate-50/80 px-3 py-2.5">
            <div className="mb-1.5 flex items-center justify-between text-[11px]">
              <span className="text-slate-600">
                Hôm nay:{" "}
                <strong className="font-semibold text-slate-900">
                  {formatStudyPreview(todaySeconds)}
                </strong>{" "}
                / {previewGoal}p
              </span>
              <span className="font-bold text-teal-700">{previewPct}%</span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200/80">
              <div
                className={`h-full transition-all ${
                  previewPct >= 100 ? "bg-emerald-500" : "bg-teal-600"
                }`}
                style={{ width: `${previewPct}%` }}
              />
            </div>
          </div>
        )}

        <div>
          <p className="mb-2 text-xs font-medium text-slate-600">
            Chọn nhanh mục tiêu:
          </p>
          <div className="flex flex-wrap gap-2">
            {GOAL_PRESETS.map((mins) => {
              const isCurrent = currentMinutes === mins;
              const isBusy = savingTarget === mins;
              return (
                <button
                  key={mins}
                  type="button"
                  disabled={saving}
                  onClick={() => void saveMinutes(mins, mins)}
                  className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold transition cursor-pointer disabled:opacity-60 ${
                    isCurrent
                      ? "border-teal-600 bg-teal-700 text-white shadow-xs"
                      : "border-slate-200 bg-white text-slate-700 hover:border-teal-300 hover:bg-teal-50/50"
                  }`}
                >
                  {isBusy && <Loader2 className="h-3 w-3 animate-spin" />}
                  <span>{mins} phút</span>
                </button>
              );
            })}
          </div>
        </div>

        <form
          onSubmit={handleCustomSubmit}
          className="mt-4 border-t border-slate-100 pt-4"
        >
          <label
            htmlFor="daily-goal-custom-input"
            className="mb-1.5 block text-xs font-medium text-slate-600"
          >
            Hoặc nhập tùy chỉnh (5 – 180 phút)
          </label>
          <div className="flex items-center gap-2">
            <input
              id="daily-goal-custom-input"
              type="number"
              min={5}
              max={180}
              value={customValue}
              disabled={saving}
              onChange={(e) => setCustomValue(e.target.value)}
              className="w-20 rounded-xl border border-slate-200 bg-slate-50/60 px-2.5 py-2 text-center text-sm font-semibold text-slate-900 outline-none transition focus:border-teal-600 focus:bg-white focus:ring-2 focus:ring-teal-600/15"
            />
            <span className="text-xs text-slate-500">phút/ngày</span>
            <button
              type="submit"
              disabled={saving}
              className="ml-auto inline-flex items-center gap-1.5 rounded-xl bg-teal-700 px-3.5 py-2 text-xs font-semibold text-white shadow-xs transition hover:bg-teal-800 disabled:opacity-60 cursor-pointer"
            >
              {savingTarget === "custom" ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Check className="h-3.5 w-3.5" />
              )}
              <span>Lưu</span>
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
