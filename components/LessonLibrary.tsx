"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  ArrowUpRight,
  BookOpen,
  Calendar,
  Clock,
  Film,
  MessageSquareText,
  Play,
  Search,
  X,
} from "lucide-react";

export interface LessonCardItem {
  id: string;
  title: string;
  description: string | null;
  videoUrl: string;
  createdAt: string;
  subtitleCount: number;
}

interface LessonLibraryProps {
  videos: LessonCardItem[];
  isAdmin: boolean;
}

function formatDuration(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds));
  const mins = Math.floor(safe / 60);
  const secs = safe % 60;
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

function LessonCard({
  video,
  index,
}: {
  video: LessonCardItem;
  index: number;
}) {
  const [previewReady, setPreviewReady] = useState(false);
  const [duration, setDuration] = useState<number | null>(null);

  return (
    <Link
      href={`/learn/${video.id}`}
      style={{ animationDelay: `${Math.min(index * 50, 300)}ms` }}
      className="animate-fade-up group flex flex-col overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-xs transition-all duration-300 hover:-translate-y-1 hover:border-teal-300 hover:shadow-lg hover:shadow-slate-200/60"
    >
      {/* Real Video Thumbnail Preview */}
      <div className="relative aspect-video w-full overflow-hidden bg-slate-800">
        {!previewReady && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-slate-700 via-slate-800 to-teal-950 text-slate-300">
            <Film className="h-9 w-9 opacity-60" />
          </div>
        )}

        <video
          src={`${video.videoUrl}#t=2`}
          preload="metadata"
          muted
          playsInline
          onLoadedMetadata={(e) => {
            const d = e.currentTarget.duration;
            if (Number.isFinite(d) && d > 0) {
              setDuration(d);
            }
          }}
          onLoadedData={() => setPreviewReady(true)}
          className={`h-full w-full object-cover transition duration-500 group-hover:scale-105 ${
            previewReady ? "opacity-100" : "opacity-0"
          }`}
        />

        {/* Subtle gradient overlay for readable badges */}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-slate-950/65 via-transparent to-slate-950/15" />

        {/* Center Play Indicator */}
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white/90 text-teal-800 shadow-md backdrop-blur-xs transition duration-300 group-hover:scale-110 group-hover:bg-teal-700 group-hover:text-white">
            <Play className="ml-0.5 h-5 w-5 fill-current" />
          </span>
        </div>

        {/* Bottom Badges */}
        <div className="absolute inset-x-3 bottom-2.5 flex items-center justify-between gap-2">
          <span className="inline-flex items-center gap-1 rounded-lg bg-slate-950/65 px-2.5 py-1 text-[11px] font-medium text-white backdrop-blur-xs">
            <MessageSquareText className="h-3 w-3 text-teal-300" />
            {video.subtitleCount} câu thoại
          </span>

          {duration !== null && (
            <span className="inline-flex items-center gap-1 rounded-lg bg-slate-950/65 px-2 py-1 font-mono text-[11px] font-medium text-white backdrop-blur-xs">
              <Clock className="h-3 w-3 text-slate-300" />
              {formatDuration(duration)}
            </span>
          )}
        </div>
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
}: LessonLibraryProps) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return videos;
    return videos.filter(
      (v) =>
        v.title.toLowerCase().includes(q) ||
        (v.description && v.description.toLowerCase().includes(q))
    );
  }, [videos, query]);

  return (
    <div>
      {/* Header + Search */}
      <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
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
              placeholder="Tìm bài học..."
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
          <p className="text-sm font-medium text-slate-700">
            Không tìm thấy bài học phù hợp với &ldquo;{query}&rdquo;
          </p>
          <button
            type="button"
            onClick={() => setQuery("")}
            className="mt-3 text-xs font-semibold text-teal-700 hover:underline cursor-pointer"
          >
            Hiển thị tất cả bài học
          </button>
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((video, idx) => (
            <LessonCard key={video.id} video={video} index={idx} />
          ))}
        </div>
      )}
    </div>
  );
}
