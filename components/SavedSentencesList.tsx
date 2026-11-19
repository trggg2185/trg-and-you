"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  Bookmark,
  BookmarkX,
  Download,
  Eye,
  EyeOff,
  Film,
  Play,
  Search,
  X,
} from "lucide-react";
import { useToast } from "@/components/ToastProvider";
import { formatAnkiCsv, triggerTextDownload } from "@/lib/export";

export interface SavedSentenceItem {
  id: string;
  subtitleId: string;
  createdAt: string;
  subtitle: {
    id: string;
    startTime: number;
    endTime: number;
    speaker: string | null;
    text: string;
    ipa: string;
    video: {
      id: string;
      title: string;
    };
  };
}

function formatTime(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds));
  const mins = Math.floor(safe / 60);
  const secs = safe % 60;
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

export default function SavedSentencesList({
  initialItems,
}: {
  initialItems: SavedSentenceItem[];
}) {
  const toast = useToast();
  const [items, setItems] = useState<SavedSentenceItem[]>(initialItems);
  const [query, setQuery] = useState("");
  const [showIpa, setShowIpa] = useState(true);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (item) =>
        item.subtitle.text.toLowerCase().includes(q) ||
        item.subtitle.video.title.toLowerCase().includes(q) ||
        (item.subtitle.speaker &&
          item.subtitle.speaker.toLowerCase().includes(q))
    );
  }, [items, query]);

  async function handleRemove(item: SavedSentenceItem) {
    setRemovingId(item.subtitleId);
    try {
      const res = await fetch(
        `/api/saved?subtitleId=${encodeURIComponent(item.subtitleId)}`,
        { method: "DELETE" }
      );
      if (!res.ok) {
        toast.error("Không thể bỏ lưu câu thoại này.");
        return;
      }
      setItems((prev) => prev.filter((x) => x.subtitleId !== item.subtitleId));
      toast.info("Đã bỏ lưu khỏi kho ôn tập.");
    } catch {
      toast.error("Không thể kết nối máy chủ.");
    } finally {
      setRemovingId(null);
    }
  }

  return (
    <div className="animate-fade-up space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:w-80">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Tìm theo nội dung hoặc tên bài học..."
            className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-9 text-base sm:text-sm outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-600/15"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-lg p-1 text-slate-400 hover:bg-slate-100 cursor-pointer"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {items.length > 0 && (
            <button
              type="button"
              onClick={() => {
                const csv = formatAnkiCsv(
                  items.map((item) => ({
                    front: item.subtitle.text,
                    back: `${item.subtitle.ipa}<br><br>${item.subtitle.video.title} (${formatTime(item.subtitle.startTime)})`,
                    tags: `trg-and-you ${item.subtitle.video.title}`,
                  }))
                );
                triggerTextDownload(
                  "trg-and-you-sentences-anki.csv",
                  csv,
                  "text/csv;charset=utf-8"
                );
                toast.success("Đã xuất các câu đã lưu sang tệp Anki (.csv)!");
              }}
              className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 transition hover:border-teal-300 hover:bg-teal-50 hover:text-teal-800 cursor-pointer"
            >
              <Download className="h-3.5 w-3.5 text-teal-700" />
              <span>Xuất Anki (.csv)</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setShowIpa((prev) => !prev)}
            className={`inline-flex items-center justify-center gap-1.5 rounded-xl border px-3.5 py-2 text-xs font-semibold transition cursor-pointer ${
              showIpa
                ? "border-teal-200 bg-teal-50 text-teal-800"
                : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
            }`}
          >
            {showIpa ? (
              <>
                <Eye className="h-3.5 w-3.5" />
                <span>Ẩn IPA</span>
              </>
            ) : (
              <>
                <EyeOff className="h-3.5 w-3.5" />
                <span>Hiện IPA</span>
              </>
            )}
          </button>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-teal-50 text-teal-700">
            <Bookmark className="h-6 w-6" />
          </div>
          <h2 className="text-base font-semibold text-slate-900">
            Chưa có câu thoại nào được lưu
          </h2>
          <p className="mt-1 max-w-sm text-xs leading-relaxed text-slate-500">
            Khi đang học video, hãy bấm vào biểu tượng đánh dấu trên những câu
            giao tiếp hay hoặc cụm nối âm bạn muốn ôn tập lại.
          </p>
          <Link
            href="/"
            className="mt-5 inline-flex items-center gap-1.5 rounded-xl bg-teal-700 px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-teal-800"
          >
            Khám phá bài học
          </Link>
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white py-12 text-center text-sm text-slate-500">
          Không tìm thấy câu đã lưu nào khớp với &ldquo;{query}&rdquo;.
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {filtered.map((item) => (
            <div
              key={item.id}
              className="flex flex-col justify-between rounded-2xl border border-slate-200/90 bg-white p-5 shadow-xs transition hover:border-teal-300"
            >
              <div>
                <div className="mb-2.5 flex items-center justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-1.5 text-xs font-medium text-slate-500">
                    <Film className="h-3.5 w-3.5 shrink-0 text-teal-700" />
                    <span className="truncate">{item.subtitle.video.title}</span>
                  </div>
                  <span className="shrink-0 rounded-md bg-slate-100 px-2 py-0.5 font-mono text-[11px] font-semibold text-slate-600">
                    {formatTime(item.subtitle.startTime)}
                  </span>
                </div>

                {item.subtitle.speaker && (
                  <p className="mb-1 text-xs font-semibold text-teal-800">
                    {item.subtitle.speaker}
                  </p>
                )}

                <p className="text-sm font-semibold leading-relaxed text-slate-900">
                  {item.subtitle.text}
                </p>

                {showIpa && item.subtitle.ipa && (
                  <p className="mt-1.5 font-mono text-xs leading-relaxed text-teal-800">
                    {item.subtitle.ipa}
                  </p>
                )}
              </div>

              <div className="mt-4 flex items-center justify-between gap-2 border-t border-slate-100 pt-3">
                <Link
                  href={`/learn/${item.subtitle.video.id}?t=${item.subtitle.startTime}`}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-teal-50 px-3 py-1.5 text-xs font-semibold text-teal-800 transition hover:bg-teal-100"
                >
                  <Play className="h-3.5 w-3.5 fill-current" />
                  <span>Nghe đúng đoạn này</span>
                </Link>

                <button
                  type="button"
                  disabled={removingId === item.subtitleId}
                  onClick={() => void handleRemove(item)}
                  className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-500 transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700 disabled:opacity-50 cursor-pointer"
                >
                  <BookmarkX className="h-3.5 w-3.5" />
                  <span>Bỏ lưu</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
