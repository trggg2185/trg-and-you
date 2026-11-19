"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import {
  ArrowUpRight,
  BookOpen,
  Calendar,
  CheckCircle2,
  Clock,
  Film,
  Flame,
  GraduationCap,
  Layers,
  MessageSquareText,
  Play,
  Search,
  Sparkles,
  X,
} from "lucide-react";
import {
  LESSON_LEVELS,
  LEVEL_BADGE_STYLES,
  parseTagsList,
} from "@/lib/lessonMeta";
import type { StudySummary } from "@/lib/stats";

const emptySubscribe = () => () => {};

export interface LessonProgressInfo {
  lastTime: number;
  duration: number;
  completed: boolean;
}

export interface LessonCardItem {
  id: string;
  title: string;
  description: string | null;
  videoUrl: string;
  thumbnailUrl?: string | null;
  level?: string | null;
  tags?: string | null;
  createdAt: string;
  subtitleCount: number;
  progress: LessonProgressInfo | null;
}

interface LessonLibraryProps {
  videos: LessonCardItem[];
  isAdmin: boolean;
  studySummary?: StudySummary | null;
  dueVocabCount?: number;
}

type StatusFilter = "all" | "unstarted" | "in_progress" | "completed";

function formatDuration(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds));
  const mins = Math.floor(safe / 60);
  const secs = safe % 60;
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

function formatStudyMinutes(seconds: number): string {
  if (seconds <= 0) return "0 phút";
  if (seconds < 60) return `${seconds} giây`;
  return `${Math.round(seconds / 60)} phút`;
}

function parseProgressString(raw: string | undefined): LessonProgressInfo | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<LessonProgressInfo>;
    if (typeof parsed.lastTime === "number") {
      return {
        lastTime: parsed.lastTime,
        duration: typeof parsed.duration === "number" ? parsed.duration : 0,
        completed: Boolean(parsed.completed),
      };
    }
  } catch {
    return null;
  }
  return null;
}

function LessonCard({
  video,
  index,
  effectiveProgress,
}: {
  video: LessonCardItem;
  index: number;
  effectiveProgress: LessonProgressInfo | null;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [previewReady, setPreviewReady] = useState(Boolean(video.thumbnailUrl));
  const [thumbFailed, setThumbFailed] = useState(false);
  const [previewError, setPreviewError] = useState(false);
  const [duration, setDuration] = useState<number | null>(null);

  const showImgThumb = Boolean(video.thumbnailUrl) && !thumbFailed;

  useEffect(() => {
    if (showImgThumb) return;
    const id = requestAnimationFrame(() => {
      const v = videoRef.current;
      if (v && v.readyState >= 2) {
        setPreviewReady(true);
        if (Number.isFinite(v.duration) && v.duration > 0) {
          setDuration(v.duration);
        }
      }
    });
    return () => cancelAnimationFrame(id);
  }, [showImgThumb]);

  const totalDur = duration ?? effectiveProgress?.duration ?? 0;
  const percent =
    effectiveProgress && totalDur > 0
      ? Math.min(100, Math.round((effectiveProgress.lastTime / totalDur) * 100))
      : effectiveProgress?.completed
      ? 100
      : 0;

  const tagsList = useMemo(() => parseTagsList(video.tags), [video.tags]);
  const levelClass = video.level
    ? LEVEL_BADGE_STYLES[video.level] ?? "bg-slate-100 text-slate-700 border-slate-200"
    : "";

  return (
    <Link
      href={`/learn/${video.id}`}
      style={{ animationDelay: `${Math.min(index * 50, 300)}ms` }}
      className="animate-fade-up group flex flex-col overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-xs transition-all duration-300 hover:-translate-y-1 hover:border-teal-300 hover:shadow-lg hover:shadow-slate-200/60"
    >
      {/* Thumbnail Preview (JPG if available, otherwise real <video> frame) */}
      <div className="relative aspect-video w-full overflow-hidden bg-slate-800">
        {(!previewReady || previewError) && (
          <div className="pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center bg-gradient-to-br from-slate-700 via-slate-800 to-teal-950 text-slate-300">
            <Film className="h-9 w-9 opacity-60" />
          </div>
        )}

        {showImgThumb ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={video.thumbnailUrl ?? ""}
            alt={video.title}
            loading="lazy"
            onLoad={() => setPreviewReady(true)}
            onError={() => {
              setThumbFailed(true);
              setPreviewReady(false);
            }}
            className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
          />
        ) : (
          <video
            ref={videoRef}
            src={`${video.videoUrl}#t=2`}
            preload="auto"
            muted
            playsInline
            onLoadedMetadata={(e) => {
              const v = e.currentTarget;
              if (Number.isFinite(v.duration) && v.duration > 0) {
                setDuration(v.duration);
                if (v.currentTime < 0.5) {
                  v.currentTime = Math.min(2, Math.max(0.5, v.duration * 0.1));
                }
              }
            }}
            onLoadedData={() => setPreviewReady(true)}
            onSeeked={() => setPreviewReady(true)}
            onCanPlay={() => setPreviewReady(true)}
            onError={() => setPreviewError(true)}
            className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
          />
        )}

        {/* Subtle gradient overlay for readable badges */}
        <div className="pointer-events-none absolute inset-0 z-10 bg-gradient-to-t from-slate-950/65 via-transparent to-slate-950/20" />

        {/* Top Progress & Level Badges */}
        <div className="absolute inset-x-3 top-2.5 z-20 flex items-center justify-between gap-2">
          <div>
            {effectiveProgress?.completed ? (
              <span className="inline-flex items-center gap-1 rounded-lg bg-emerald-600/90 px-2 py-0.5 text-[11px] font-semibold text-white shadow-xs">
                <CheckCircle2 className="h-3 w-3" />
                Đã học xong
              </span>
            ) : effectiveProgress && effectiveProgress.lastTime > 3 ? (
              <span className="inline-flex items-center gap-1 rounded-lg bg-teal-700/90 px-2 py-0.5 text-[11px] font-semibold text-white shadow-xs">
                Tiếp tục · {formatDuration(effectiveProgress.lastTime)}
              </span>
            ) : null}
          </div>

          {video.level && (
            <span
              className={`rounded-lg border px-2 py-0.5 text-[11px] font-bold shadow-xs backdrop-blur-xs ${levelClass}`}
            >
              {video.level}
            </span>
          )}
        </div>

        {/* Center Play Indicator */}
        <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white/90 text-teal-800 shadow-md backdrop-blur-xs transition duration-300 group-hover:scale-110 group-hover:bg-teal-700 group-hover:text-white">
            <Play className="ml-0.5 h-5 w-5 fill-current" />
          </span>
        </div>

        {/* Bottom Badges */}
        <div className="absolute inset-x-3 bottom-2.5 z-20 flex items-center justify-between gap-2">
          <span className="inline-flex items-center gap-1 rounded-lg bg-slate-950/65 px-2.5 py-1 text-[11px] font-medium text-white backdrop-blur-xs">
            <MessageSquareText className="h-3 w-3 text-teal-300" />
            {video.subtitleCount} câu thoại
          </span>

          {(duration !== null || (effectiveProgress?.duration ?? 0) > 0) && (
            <span className="inline-flex items-center gap-1 rounded-lg bg-slate-950/65 px-2 py-1 font-mono text-[11px] font-medium text-white backdrop-blur-xs">
              <Clock className="h-3 w-3 text-slate-300" />
              {formatDuration(duration ?? effectiveProgress?.duration ?? 0)}
            </span>
          )}
        </div>

        {/* Bottom Thin Progress Bar */}
        {percent > 0 && (
          <div className="absolute inset-x-0 bottom-0 z-20 h-1 bg-slate-950/40">
            <div
              className={`h-full transition-all ${
                effectiveProgress?.completed ? "bg-emerald-400" : "bg-teal-400"
              }`}
              style={{ width: `${percent}%` }}
            />
          </div>
        )}
      </div>

      {/* Card Body */}
      <div className="flex flex-1 flex-col justify-between p-5">
        <div>
          <h2 className="line-clamp-2 text-base font-semibold leading-snug text-slate-900 transition group-hover:text-teal-800">
            {video.title}
          </h2>
          {video.description ? (
            <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-slate-500">
              {video.description}
            </p>
          ) : (
            <p className="mt-1.5 text-xs text-slate-400">
              Luyện nghe hiểu, ngắt câu và phát âm IPA tự nhiên
            </p>
          )}

          {tagsList.length > 0 && (
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {tagsList.slice(0, 3).map((tag) => (
                <span
                  key={tag}
                  className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600"
                >
                  #{tag}
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 text-xs text-slate-500">
          <span className="inline-flex items-center gap-1.5">
            <Calendar className="h-3.5 w-3.5 text-slate-400" />
            {new Date(video.createdAt).toLocaleDateString("vi-VN")}
          </span>
          <span className="inline-flex items-center gap-1 font-semibold text-teal-700 transition group-hover:translate-x-0.5">
            <span>Vào học</span>
            <ArrowUpRight className="h-3.5 w-3.5" />
          </span>
        </div>
      </div>
    </Link>
  );
}

export default function LessonLibrary({
  videos,
  isAdmin,
  studySummary = null,
  dueVocabCount = 0,
}: LessonLibraryProps) {
  const [query, setQuery] = useState("");
  const [levelFilter, setLevelFilter] = useState<string>("ALL");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  const localMapJson = useSyncExternalStore(
    emptySubscribe,
    () => {
      try {
        const out: Record<string, string> = {};
        for (const v of videos) {
          const val = window.localStorage.getItem(`trg_progress_${v.id}`);
          if (val) out[v.id] = val;
        }
        return JSON.stringify(out);
      } catch {
        return "{}";
      }
    },
    () => "{}"
  );

  const localProgressMap = useMemo(() => {
    try {
      return JSON.parse(localMapJson) as Record<string, string>;
    } catch {
      return {};
    }
  }, [localMapJson]);

  const progressByVideo = useMemo(() => {
    const map = new Map<string, LessonProgressInfo | null>();
    for (const v of videos) {
      map.set(
        v.id,
        v.progress ?? parseProgressString(localProgressMap[v.id])
      );
    }
    return map;
  }, [videos, localProgressMap]);

  const availableLevels = useMemo(() => {
    const present = new Set(
      videos.map((v) => v.level).filter((lv): lv is string => Boolean(lv))
    );
    return LESSON_LEVELS.filter((lv) => present.has(lv));
  }, [videos]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return videos.filter((v) => {
      if (levelFilter !== "ALL" && v.level !== levelFilter) {
        return false;
      }

      if (statusFilter !== "all") {
        const prog = progressByVideo.get(v.id);
        const isCompleted = Boolean(prog?.completed);
        const isInProgress = Boolean(prog && !prog.completed && prog.lastTime > 3);
        if (statusFilter === "completed" && !isCompleted) return false;
        if (statusFilter === "in_progress" && !isInProgress) return false;
        if (statusFilter === "unstarted" && (isCompleted || isInProgress)) {
          return false;
        }
      }

      if (!q) return true;
      return (
        v.title.toLowerCase().includes(q) ||
        (v.description && v.description.toLowerCase().includes(q)) ||
        (v.tags && v.tags.toLowerCase().includes(q)) ||
        (v.level && v.level.toLowerCase().includes(q))
      );
    });
  }, [videos, query, levelFilter, statusFilter, progressByVideo]);

  const hasActiveFilters =
    query.trim().length > 0 || levelFilter !== "ALL" || statusFilter !== "all";

  return (
    <div>
      {/* Daily Streak & Study Summary Banner (authenticated users) */}
      {studySummary && (
        <div className="mb-6 grid gap-3 sm:grid-cols-3">
          <div className="flex items-center gap-3 rounded-2xl border border-amber-200/80 bg-white px-4 py-3 shadow-2xs">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
              <Flame className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[11px] font-medium text-slate-500">
                Chuỗi ngày học liên tiếp
              </p>
              <p className="text-base font-bold text-slate-900">
                {studySummary.streakDays} ngày
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 rounded-2xl border border-teal-200/80 bg-white px-4 py-3 shadow-2xs">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-teal-50 text-teal-700">
              <Clock className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[11px] font-medium text-slate-500">
                Hôm nay · Tổng tích lũy
              </p>
              <p className="text-base font-bold text-slate-900">
                {formatStudyMinutes(studySummary.todaySeconds)} ·{" "}
                <span className="font-semibold text-teal-700">
                  {formatStudyMinutes(studySummary.totalSeconds)}
                </span>
              </p>
            </div>
          </div>

          <Link
            href="/vocab"
            className="group flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-2xs transition hover:border-teal-300 hover:bg-teal-50/40"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-700">
                <GraduationCap className="h-5 w-5" />
              </div>
              <div>
                <p className="text-[11px] font-medium text-slate-500">
                  Ôn tập từ vựng (SRS)
                </p>
                <p className="text-base font-bold text-slate-900">
                  {dueVocabCount > 0 ? (
                    <span className="text-indigo-700">
                      {dueVocabCount} từ cần ôn
                    </span>
                  ) : (
                    "Đã ôn hết hôm nay"
                  )}
                </p>
              </div>
            </div>
            <ArrowUpRight className="h-4 w-4 text-slate-400 transition group-hover:text-teal-700" />
          </Link>
        </div>
      )}

      {/* Header + Search */}
      <div className="mb-5 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="mb-2 inline-flex items-center gap-1.5 rounded-full border border-teal-200 bg-teal-50 px-3 py-1 text-xs font-semibold text-teal-800">
            <BookOpen className="h-3.5 w-3.5" />
            <span>{videos.length} bài học sẵn sàng</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            Thư viện bài học Shadowing
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Chọn một video hoạt hình để luyện nghe, lặp lại theo câu và xem phiên âm IPA.
          </p>
        </div>

        {videos.length > 0 && (
          <div className="relative w-full md:w-72">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Tìm bài học, #chủ-đề..."
              className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-9 text-base sm:text-sm text-slate-800 shadow-2xs outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-600/15"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                aria-label="Xóa tìm kiếm"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 cursor-pointer"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Filter Pills (Status + Level) */}
      {videos.length > 0 && (
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1.5">
            {(
              [
                { key: "all", label: "Tất cả" },
                { key: "unstarted", label: "Chưa học" },
                { key: "in_progress", label: "Đang học" },
                { key: "completed", label: "Đã xong" },
              ] as const
            ).map((opt) => (
              <button
                key={opt.key}
                type="button"
                onClick={() => setStatusFilter(opt.key)}
                className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition cursor-pointer ${
                  statusFilter === opt.key
                    ? "bg-teal-700 text-white shadow-xs"
                    : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {availableLevels.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 mr-1">
                <Layers className="h-3.5 w-3.5" />
                Trình độ:
              </span>
              <button
                type="button"
                onClick={() => setLevelFilter("ALL")}
                className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition cursor-pointer ${
                  levelFilter === "ALL"
                    ? "bg-slate-800 text-white"
                    : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                }`}
              >
                Tất cả
              </button>
              {availableLevels.map((lv) => (
                <button
                  key={lv}
                  type="button"
                  onClick={() => setLevelFilter(lv)}
                  className={`rounded-lg px-2.5 py-1 text-xs font-bold transition cursor-pointer ${
                    levelFilter === lv
                      ? "bg-teal-700 text-white"
                      : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  {lv}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {videos.length === 0 ? (
        <div className="animate-fade-up flex flex-col items-center justify-center rounded-3xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-teal-50 text-teal-700">
            <Film className="h-7 w-7" />
          </div>
          <h2 className="text-lg font-semibold text-slate-900">
            Chưa có bài học nào
          </h2>
          <p className="mt-1 max-w-md text-sm text-slate-500">
            {isAdmin
              ? "Hãy vào trang Quản trị để tải lên video hoạt hình đầu tiên và tạo phụ đề IPA tự động."
              : "Quản trị viên chưa tải lên bài học nào. Vui lòng quay lại sau."}
          </p>
          {isAdmin && (
            <Link
              href="/admin"
              className="mt-5 inline-flex items-center gap-2 rounded-xl bg-teal-700 px-5 py-2.5 text-sm font-semibold text-white shadow-xs transition hover:bg-teal-800"
            >
              Đi tới trang Quản trị
            </Link>
          )}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white py-14 text-center">
          <Sparkles className="mx-auto mb-2 h-6 w-6 text-slate-300" />
          <p className="text-sm font-medium text-slate-700">
            Không có bài học nào khớp với bộ lọc hiện tại
          </p>
          {hasActiveFilters && (
            <button
              type="button"
              onClick={() => {
                setQuery("");
                setLevelFilter("ALL");
                setStatusFilter("all");
              }}
              className="mt-3 text-xs font-semibold text-teal-700 hover:underline cursor-pointer"
            >
              Xóa bộ lọc & hiển thị tất cả bài học
            </button>
          )}
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((video, idx) => (
            <LessonCard
              key={video.id}
              video={video}
              index={idx}
              effectiveProgress={progressByVideo.get(video.id) ?? null}
            />
          ))}
        </div>
      )}
    </div>
  );
}
