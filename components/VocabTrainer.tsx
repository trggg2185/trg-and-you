"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  ArrowRight,
  BookMarked,
  CheckCircle2,
  Download,
  ExternalLink,
  Layers,
  Loader2,
  RotateCw,
  Search,
  Sparkles,
  Trash2,
  Volume2,
  X,
} from "lucide-react";
import { useToast } from "@/components/ToastProvider";
import { formatAnkiCsv, triggerTextDownload } from "@/lib/export";

export interface VocabItemDTO {
  id: string;
  word: string;
  phonetic: string;
  partOfSpeech: string;
  meaningVi: string;
  exampleText: string;
  videoId: string | null;
  startTime: number | null;
  srsLevel: number;
  nextReviewAt: string;
  createdAt: string;
  video: {
    id: string;
    title: string;
  } | null;
}

interface VocabTrainerProps {
  initialItems: VocabItemDTO[];
  initialNowMs: number;
}

const SRS_LABELS = ["Mới", "1 ngày", "3 ngày", "7 ngày", "14+ ngày"];

function speakWord(word: string, rate = 1.0) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(word);
  u.lang = "en-US";
  u.rate = rate;
  window.speechSynthesis.speak(u);
}

export default function VocabTrainer({
  initialItems,
  initialNowMs,
}: VocabTrainerProps) {
  const toast = useToast();
  const [items, setItems] = useState<VocabItemDTO[]>(initialItems);
  const [nowMs, setNowMs] = useState(initialNowMs);
  const [mode, setMode] = useState<"flashcard" | "list">("flashcard");
  const [reviewAll, setReviewAll] = useState(false);
  const [flipped, setFlipped] = useState(false);
  const [grading, setGrading] = useState(false);
  const [query, setQuery] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const dueItems = useMemo(
    () =>
      items.filter((i) => new Date(i.nextReviewAt).getTime() <= nowMs),
    [items, nowMs]
  );

  const reviewQueue = reviewAll ? items : dueItems;
  const activeCard = reviewQueue[0] ?? null;

  const filteredList = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (i) =>
        i.word.toLowerCase().includes(q) ||
        i.meaningVi.toLowerCase().includes(q) ||
        i.exampleText.toLowerCase().includes(q)
    );
  }, [items, query]);

  async function handleGrade(
    vocabId: string,
    grade: "again" | "hard" | "good" | "easy"
  ) {
    setGrading(true);
    try {
      const res = await fetch(`/api/vocab/${vocabId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ grade }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Không thể cập nhật tiến độ.");
        return;
      }
      const updated = data.item as VocabItemDTO;
      setItems((prev) => {
        const rest = prev.filter((x) => x.id !== vocabId);
        // Move card to end if practicing all, otherwise sorted order naturally hides future due dates
        return [...rest, updated];
      });
      setNowMs(Date.now());
      setFlipped(false);
    } catch {
      toast.error("Lỗi kết nối khi lưu đánh giá.");
    } finally {
      setGrading(false);
    }
  }

  async function handleDelete(vocabId: string) {
    setDeletingId(vocabId);
    try {
      const res = await fetch(`/api/vocab/${vocabId}`, { method: "DELETE" });
      if (!res.ok) {
        toast.error("Không thể xóa từ vựng.");
        return;
      }
      setItems((prev) => prev.filter((i) => i.id !== vocabId));
      setFlipped(false);
      toast.success("Đã xóa từ vựng.");
    } catch {
      toast.error("Lỗi kết nối khi xóa từ vựng.");
    } finally {
      setDeletingId(null);
    }
  }

  function handleExportAnki() {
    if (items.length === 0) {
      toast.error("Chưa có từ vựng nào để xuất.");
      return;
    }
    const csv = formatAnkiCsv(
      items.map((i) => ({
        front: `${i.word}${i.phonetic ? ` (${i.phonetic})` : ""}`,
        back: `${i.partOfSpeech ? `[${i.partOfSpeech}] ` : ""}${i.meaningVi}${
          i.exampleText ? `<br><br>Ví dụ: ${i.exampleText}` : ""
        }`,
        tags: i.video?.title ? `trg-and-you ${i.video.title}` : "trg-and-you",
      }))
    );
    triggerTextDownload("trg-and-you-vocab-anki.csv", csv, "text/csv;charset=utf-8");
    toast.success("Đã tải xuống tệp từ vựng Anki (.csv)!");
  }

  if (items.length === 0) {
    return (
      <div className="rounded-3xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-teal-50 text-teal-700">
          <BookMarked className="h-7 w-7" />
        </div>
        <h2 className="text-lg font-semibold text-slate-900">
          Kho từ vựng của bạn đang trống
        </h2>
        <p className="mx-auto mt-1 max-w-md text-sm text-slate-500">
          Khi đang học video, hãy bấm trực tiếp vào bất kỳ từ tiếng Anh nào trong phụ đề để tra nghĩa, nghe phát âm và lưu vào đây ôn tập.
        </p>
        <Link
          href="/"
          className="mt-5 inline-flex items-center gap-2 rounded-xl bg-teal-700 px-5 py-2.5 text-sm font-semibold text-white shadow-xs hover:bg-teal-800"
        >
          <span>Khám phá bài học</span>
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-2xl border border-slate-200 bg-white p-1 shadow-2xs">
          <button
            type="button"
            onClick={() => setMode("flashcard")}
            className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs sm:text-sm font-semibold transition cursor-pointer ${
              mode === "flashcard"
                ? "bg-teal-700 text-white shadow-xs"
                : "text-slate-600 hover:bg-slate-50"
            }`}
          >
            <Layers className="h-4 w-4" />
            <span>Ôn tập SRS ({dueItems.length} đến hạn)</span>
          </button>
          <button
            type="button"
            onClick={() => setMode("list")}
            className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs sm:text-sm font-semibold transition cursor-pointer ${
              mode === "list"
                ? "bg-teal-700 text-white shadow-xs"
                : "text-slate-600 hover:bg-slate-50"
            }`}
          >
            <BookMarked className="h-4 w-4" />
            <span>Tất cả ({items.length})</span>
          </button>
        </div>

        <button
          type="button"
          onClick={handleExportAnki}
          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs sm:text-sm font-semibold text-slate-700 shadow-2xs transition hover:border-teal-300 hover:bg-teal-50 hover:text-teal-800 cursor-pointer"
        >
          <Download className="h-4 w-4 text-teal-700" />
          <span>Xuất Anki (.csv)</span>
        </button>
      </div>

      {mode === "flashcard" ? (
        activeCard ? (
          <div className="mx-auto max-w-xl">
            <div className="mb-3 flex items-center justify-between text-xs text-slate-500">
              <span>
                {reviewAll
                  ? `Đang ôn tự do • Còn ${reviewQueue.length} từ`
                  : `Đến hạn hôm nay: ${dueItems.length} từ`}
              </span>
              <span className="rounded-full bg-slate-100 px-2.5 py-0.5 font-semibold text-slate-700">
                Cấp SRS: {SRS_LABELS[activeCard.srsLevel] ?? "30 ngày"}
              </span>
            </div>

            <div className="rounded-3xl border border-slate-200/90 bg-white p-6 sm:p-8 shadow-sm">
              <div className="flex flex-col items-center text-center">
                <span className="rounded-full bg-teal-50 px-3 py-0.5 text-xs font-semibold text-teal-800">
                  {activeCard.partOfSpeech || "từ vựng"}
                </span>

                <h2 className="mt-4 text-3xl sm:text-4xl font-bold tracking-tight text-slate-900">
                  {activeCard.word}
                </h2>

                {activeCard.phonetic && (
                  <p className="mt-1.5 font-mono text-sm text-slate-500">
                    {activeCard.phonetic}
                  </p>
                )}

                <div className="mt-4 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => speakWord(activeCard.word, 1.0)}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 cursor-pointer"
                  >
                    <Volume2 className="h-3.5 w-3.5 text-teal-700" />
                    <span>Nghe</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => speakWord(activeCard.word, 0.68)}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 cursor-pointer"
                  >
                    <Volume2 className="h-3.5 w-3.5 text-amber-600" />
                    <span>Chậm</span>
                  </button>
                </div>

                {activeCard.exampleText && (
                  <p className="mt-5 rounded-2xl bg-slate-50 px-4 py-3 text-sm italic text-slate-600">
                    &ldquo;{activeCard.exampleText}&rdquo;
                  </p>
                )}

                {activeCard.video && (
                  <Link
                    href={`/learn/${activeCard.video.id}${
                      activeCard.startTime !== null
                        ? `?t=${Math.floor(activeCard.startTime)}`
                        : ""
                    }`}
                    className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-teal-700 hover:underline"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    <span>Mở bài: {activeCard.video.title}</span>
                  </Link>
                )}
              </div>

              {!flipped ? (
                <div className="mt-7 border-t border-slate-100 pt-6 text-center">
                  <button
                    type="button"
                    onClick={() => setFlipped(true)}
                    className="inline-flex items-center gap-2 rounded-2xl bg-teal-700 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-teal-800 cursor-pointer"
                  >
                    <RotateCw className="h-4 w-4" />
                    <span>Hiện nghĩa tiếng Việt</span>
                  </button>
                </div>
              ) : (
                <div className="mt-6 space-y-5 border-t border-slate-100 pt-5 text-center">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                      Nghĩa tiếng Việt
                    </p>
                    <p className="mt-1 text-xl font-bold text-teal-800">
                      {activeCard.meaningVi || "Chưa có nghĩa"}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    <button
                      type="button"
                      disabled={grading}
                      onClick={() => void handleGrade(activeCard.id, "again")}
                      className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-xs font-semibold text-rose-700 hover:bg-rose-100 disabled:opacity-50 cursor-pointer"
                    >
                      Quên (10p)
                    </button>
                    <button
                      type="button"
                      disabled={grading}
                      onClick={() => void handleGrade(activeCard.id, "hard")}
                      className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs font-semibold text-amber-800 hover:bg-amber-100 disabled:opacity-50 cursor-pointer"
                    >
                      Khó (1 ngày)
                    </button>
                    <button
                      type="button"
                      disabled={grading}
                      onClick={() => void handleGrade(activeCard.id, "good")}
                      className="rounded-xl border border-teal-200 bg-teal-50 px-3 py-2.5 text-xs font-semibold text-teal-800 hover:bg-teal-100 disabled:opacity-50 cursor-pointer"
                    >
                      Nhớ (3-14 ngày)
                    </button>
                    <button
                      type="button"
                      disabled={grading}
                      onClick={() => void handleGrade(activeCard.id, "easy")}
                      className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-xs font-semibold text-emerald-800 hover:bg-emerald-100 disabled:opacity-50 cursor-pointer"
                    >
                      Rất dễ
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="mx-auto max-w-xl rounded-3xl border border-emerald-200 bg-white p-8 text-center shadow-xs">
            <CheckCircle2 className="mx-auto mb-3 h-10 w-10 text-emerald-600" />
            <h3 className="text-lg font-bold text-slate-900">
              Bạn đã hoàn thành tất cả từ cần ôn hôm nay!
            </h3>
            <p className="mt-1 text-sm text-slate-500">
              Hệ thống SRS sẽ tự động nhắc lại từng từ đúng lúc trước khi bạn quên.
            </p>
            <div className="mt-5 flex flex-wrap justify-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setReviewAll(true);
                  setFlipped(false);
                }}
                className="inline-flex items-center gap-1.5 rounded-xl bg-teal-700 px-4 py-2 text-xs font-semibold text-white hover:bg-teal-800 cursor-pointer"
              >
                <Sparkles className="h-3.5 w-3.5" />
                <span>Ôn lại tất cả ({items.length} từ)</span>
              </button>
              <button
                type="button"
                onClick={() => setMode("list")}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                Xem danh sách từ
              </button>
            </div>
          </div>
        )
      ) : (
        <div className="space-y-4">
          <div className="relative max-w-sm">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Tìm từ vựng, nghĩa hoặc câu ví dụ..."
              className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-9 text-sm outline-none focus:border-teal-600"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {filteredList.map((item) => (
              <div
                key={item.id}
                className="flex flex-col justify-between rounded-2xl border border-slate-200/90 bg-white p-4 shadow-2xs"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-base font-bold text-slate-900">
                          {item.word}
                        </h3>
                        {item.partOfSpeech && (
                          <span className="rounded bg-teal-50 px-1.5 py-0.5 text-[10px] font-semibold text-teal-800">
                            {item.partOfSpeech}
                          </span>
                        )}
                      </div>
                      {item.phonetic && (
                        <p className="font-mono text-xs text-slate-400">
                          {item.phonetic}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => speakWord(item.word, 1.0)}
                        aria-label={`Nghe ${item.word}`}
                        className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-teal-700 cursor-pointer"
                      >
                        <Volume2 className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        disabled={deletingId === item.id}
                        onClick={() => void handleDelete(item.id)}
                        aria-label={`Xóa ${item.word}`}
                        className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 cursor-pointer"
                      >
                        {deletingId === item.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </div>

                  <p className="mt-2 text-sm font-semibold text-teal-800">
                    {item.meaningVi || "Chưa có nghĩa"}
                  </p>

                  {item.exampleText && (
                    <p className="mt-1.5 line-clamp-2 text-xs italic text-slate-500">
                      &ldquo;{item.exampleText}&rdquo;
                    </p>
                  )}
                </div>

                <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-2.5 text-[11px] text-slate-500">
                  <span>
                    Ôn lại:{" "}
                    {new Date(item.nextReviewAt).toLocaleDateString("vi-VN")}
                  </span>
                  {item.video && (
                    <Link
                      href={`/learn/${item.video.id}${
                        item.startTime !== null
                          ? `?t=${Math.floor(item.startTime)}`
                          : ""
                      }`}
                      className="inline-flex items-center gap-1 font-semibold text-teal-700 hover:underline"
                    >
                      <span>Nghe lại</span>
                      <ExternalLink className="h-3 w-3" />
                    </Link>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
