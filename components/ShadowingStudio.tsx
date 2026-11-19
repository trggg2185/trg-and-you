"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Captions,
  CaptionsOff,
  Check,
  Clock,
  Eraser,
  Eye,
  EyeOff,
  Gauge,
  Headphones,
  Languages,
  Loader2,
  LogIn,
  NotebookPen,
  Pause,
  Play,
  Repeat,
  Save,
  SkipBack,
  SkipForward,
  Volume2,
} from "lucide-react";
import { useToast } from "@/components/ToastProvider";
import ConfirmModal from "@/components/ConfirmModal";
import AuthModal from "@/components/AuthModal";

export interface SubtitleItem {
  id: string;
  index: number;
  startTime: number;
  endTime: number;
  speaker: string | null;
  text: string;
  ipa: string;
}

interface ShadowingStudioProps {
  videoId: string;
  title: string;
  description: string | null;
  videoUrl: string;
  subtitles: SubtitleItem[];
  initialNote: string;
  isLoggedIn: boolean;
}

function formatTime(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds));
  const mins = Math.floor(safe / 60);
  const secs = safe % 60;
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

export default function ShadowingStudio({
  videoId,
  title,
  description,
  videoUrl,
  subtitles,
  initialNote,
  isLoggedIn,
}: ShadowingStudioProps) {
  const toast = useToast();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const noteRef = useRef<HTMLTextAreaElement | null>(null);
  const subtitleListRef = useRef<HTMLDivElement | null>(null);
  const subtitleRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const hasAutoPlayedRef = useRef(false);

  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [autoplayBlocked, setAutoplayBlocked] = useState(false);
  const [playbackRate, setPlaybackRate] = useState<number>(1.0);
  const [loopSentence, setLoopSentence] = useState(false);
  const [showSubtitles, setShowSubtitles] = useState(true);
  const [showIpa, setShowIpa] = useState(true);
  const [mobileTab, setMobileTab] = useState<"subtitles" | "notes">("subtitles");
  const [lockedLoopSubId, setLockedLoopSubId] = useState<string | null>(null);
  const [authModalOpen, setAuthModalOpen] = useState(false);

  // Notes state
  const [noteContent, setNoteContent] = useState(initialNote);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">(
    "idle"
  );
  const [clearNoteModalOpen, setClearNoteModalOpen] = useState(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedRef = useRef(initialNote);

  const activeSubtitleIndex = useMemo(() => {
    return subtitles.findIndex(
      (sub) => currentTime >= sub.startTime && currentTime <= sub.endTime
    );
  }, [subtitles, currentTime]);

  const activeSubtitle =
    activeSubtitleIndex >= 0 ? subtitles[activeSubtitleIndex] : null;

  const loopTargetSub = useMemo(() => {
    if (!loopSentence) return null;
    if (lockedLoopSubId) {
      const found = subtitles.find((s) => s.id === lockedLoopSubId);
      if (found) return found;
    }
    return activeSubtitle;
  }, [loopSentence, lockedLoopSubId, subtitles, activeSubtitle]);

  useEffect(() => {
    setNoteContent(initialNote);
    lastSavedRef.current = initialNote;
  }, [initialNote]);

  useEffect(() => {
    if (!activeSubtitle || !showSubtitles) return;
    const container = subtitleListRef.current;
    const el = subtitleRefs.current.get(activeSubtitle.id);
    if (container && el) {
      const targetTop =
        el.offsetTop - container.clientHeight / 2 + el.clientHeight / 2;
      container.scrollTo({
        top: Math.max(0, targetTop),
        behavior: "smooth",
      });
    }
  }, [activeSubtitle?.id, showSubtitles]);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.playbackRate = playbackRate;
    }
  }, [playbackRate]);

  const jumpToSubtitle = useCallback((sub: SubtitleItem) => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = sub.startTime;
    setCurrentTime(sub.startTime);
    setLockedLoopSubId(sub.id);
    void video.play().catch(() => {});
  }, []);

  const goToRelativeSubtitle = useCallback(
    (delta: number) => {
      if (subtitles.length === 0) return;
      let targetIdx: number;
      if (activeSubtitleIndex >= 0) {
        targetIdx = activeSubtitleIndex + delta;
      } else {
        const nextIdx = subtitles.findIndex((s) => s.startTime > currentTime);
        if (delta > 0) {
          targetIdx = nextIdx >= 0 ? nextIdx : subtitles.length - 1;
        } else {
          targetIdx = nextIdx > 0 ? nextIdx - 1 : 0;
        }
      }
      const clamped = Math.max(0, Math.min(subtitles.length - 1, targetIdx));
      jumpToSubtitle(subtitles[clamped]);
    },
    [subtitles, activeSubtitleIndex, currentTime, jumpToSubtitle]
  );

  const togglePlayPause = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      void video.play().catch(() => {});
    } else {
      video.pause();
    }
  }, []);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "TEXTAREA" ||
          target.tagName === "INPUT" ||
          target.isContentEditable)
      ) {
        return;
      }

      if (e.code === "Space") {
        e.preventDefault();
        togglePlayPause();
      } else if (e.code === "ArrowLeft") {
        e.preventDefault();
        goToRelativeSubtitle(-1);
      } else if (e.code === "ArrowRight") {
        e.preventDefault();
        goToRelativeSubtitle(1);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [togglePlayPause, goToRelativeSubtitle]);

  function handleTimeUpdate() {
    const video = videoRef.current;
    if (!video) return;
    const t = video.currentTime;

    if (loopSentence && loopTargetSub) {
      if (t >= loopTargetSub.endTime - 0.05) {
        video.currentTime = loopTargetSub.startTime;
        setCurrentTime(loopTargetSub.startTime);
        if (video.paused) {
          void video.play().catch(() => {});
        }
        return;
      }
    }

    setCurrentTime(t);
  }

  function handleToggleLoop() {
    const next = !loopSentence;
    setLoopSentence(next);
    if (next && activeSubtitle) {
      setLockedLoopSubId(activeSubtitle.id);
    } else if (!next) {
      setLockedLoopSubId(null);
    }
    toast.info(
      next ? "Đã bật chế độ lặp lại câu hiện tại." : "Đã tắt chế độ lặp câu."
    );
  }

  const saveNote = useCallback(
    async (contentToSave: string, showToastOnSuccess = false) => {
      setSaveState("saving");
      try {
        const res = await fetch("/api/notes", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ videoId, content: contentToSave }),
        });
        if (res.ok) {
          lastSavedRef.current = contentToSave;
          setSaveState("saved");
          if (showToastOnSuccess) {
            toast.success("Đã lưu ghi chú bài học.");
          }
        } else {
          setSaveState("idle");
          toast.error("Không thể lưu ghi chú lúc này. Vui lòng thử lại.");
        }
      } catch {
        setSaveState("idle");
        toast.error("Không thể kết nối máy chủ khi lưu ghi chú.");
      }
    },
    [videoId, toast]
  );

  function handleNoteChange(value: string) {
    setNoteContent(value);
    setSaveState("idle");

    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
    }
    saveTimerRef.current = setTimeout(() => {
      if (value !== lastSavedRef.current) {
        void saveNote(value, false);
      }
    }, 800);
  }

  function handleInsertTimestamp() {
    const stamp = `[${formatTime(currentTime)}] `;
    const textarea = noteRef.current;
    if (!textarea) {
      handleNoteChange(noteContent + (noteContent ? "\n" : "") + stamp);
      return;
    }

    const start = textarea.selectionStart ?? noteContent.length;
    const end = textarea.selectionEnd ?? noteContent.length;
    const nextValue =
      noteContent.slice(0, start) + stamp + noteContent.slice(end);
    handleNoteChange(nextValue);

    requestAnimationFrame(() => {
      textarea.focus();
      const cursor = start + stamp.length;
      textarea.setSelectionRange(cursor, cursor);
    });
  }

  async function confirmClearNote() {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
    }
    setNoteContent("");
    setClearNoteModalOpen(false);
    await saveNote("", true);
  }

  return (
    <div className="animate-fade-up grid gap-4 lg:gap-6 lg:grid-cols-12">
      {/* Left Column: Video Player + Controls + Personal Notes */}
      <div className="flex flex-col gap-3 sm:gap-4 lg:col-span-7">
        <div className="sticky top-14 z-20 -mx-4 bg-[#f6f7f5] px-4 pb-1 sm:static sm:mx-0 sm:bg-transparent sm:px-0 sm:pb-0">
          <div className="relative overflow-hidden rounded-2xl border border-slate-200/90 bg-slate-950 shadow-sm">
            <video
              ref={videoRef}
              src={videoUrl}
              autoPlay
              preload="auto"
              controls
              playsInline
              onCanPlay={() => {
                if (hasAutoPlayedRef.current) return;
                hasAutoPlayedRef.current = true;
                const v = videoRef.current;
                if (v && v.paused) {
                  void v.play().catch(() => {
                    setAutoplayBlocked(true);
                  });
                }
              }}
              onTimeUpdate={handleTimeUpdate}
              onPlay={() => {
                setIsPlaying(true);
                setAutoplayBlocked(false);
              }}
              onPause={() => setIsPlaying(false)}
              className="aspect-video w-full bg-slate-950"
            />

            {autoplayBlocked && !isPlaying && (
              <button
                type="button"
                onClick={() => {
                  setAutoplayBlocked(false);
                  void videoRef.current?.play().catch(() => {});
                }}
                className="absolute inset-0 flex items-center justify-center bg-slate-950/45 transition hover:bg-slate-950/35 cursor-pointer"
              >
                <span className="inline-flex items-center gap-2 rounded-full bg-teal-700 px-5 py-2.5 text-sm font-semibold text-white shadow-lg transition hover:bg-teal-800">
                  <Play className="h-4 w-4 fill-current" />
                  <span>Nhấn để bắt đầu phát</span>
                </span>
              </button>
            )}
          </div>
        </div>

        {/* Learning Controls Bar */}
        <div className="flex flex-col gap-2.5 rounded-2xl border border-slate-200/90 bg-white p-3 sm:p-3.5 shadow-xs sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
          <div className="grid grid-cols-3 gap-2 sm:flex sm:flex-wrap sm:items-center">
            <button
              type="button"
              onClick={togglePlayPause}
              className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-teal-700 px-3 py-2.5 sm:py-2 text-xs font-semibold text-white transition hover:bg-teal-800 active:scale-[0.98] cursor-pointer"
            >
              {isPlaying ? (
                <>
                  <Pause className="h-3.5 w-3.5" />
                  <span>Tạm dừng</span>
                </>
              ) : (
                <>
                  <Play className="h-3.5 w-3.5 fill-current" />
                  <span>Phát</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => goToRelativeSubtitle(-1)}
              title="Câu trước (Phím ←)"
              className="inline-flex items-center justify-center gap-1 rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-2.5 sm:py-2 text-xs font-medium text-slate-700 transition hover:bg-slate-100 cursor-pointer"
            >
              <SkipBack className="h-3.5 w-3.5 shrink-0" />
              <span>Câu trước</span>
            </button>

            <button
              type="button"
              onClick={() => goToRelativeSubtitle(1)}
              title="Câu tiếp theo (Phím →)"
              className="inline-flex items-center justify-center gap-1 rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-2.5 sm:py-2 text-xs font-medium text-slate-700 transition hover:bg-slate-100 cursor-pointer"
            >
              <span>Câu sau</span>
              <SkipForward className="h-3.5 w-3.5 shrink-0" />
            </button>
          </div>

          <div className="flex items-center justify-between gap-2 sm:justify-end">
            {/* Speed selector */}
            <div className="inline-flex items-center gap-0.5 sm:gap-1 rounded-xl border border-slate-200 bg-slate-50 p-0.5">
              <Gauge className="ml-2 h-3.5 w-3.5 text-slate-400" />
              {[0.75, 1.0, 1.25].map((rate) => (
                <button
                  key={rate}
                  type="button"
                  onClick={() => setPlaybackRate(rate)}
                  className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold transition cursor-pointer ${
                    playbackRate === rate
                      ? "bg-white text-teal-800 shadow-2xs"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  {rate === 1 ? "1.0x" : `${rate}x`}
                </button>
              ))}
            </div>

            {/* Loop sentence toggle */}
            <button
              type="button"
              onClick={handleToggleLoop}
              className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold transition cursor-pointer ${
                loopSentence
                  ? "border-teal-600 bg-teal-50 text-teal-800"
                  : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
              }`}
            >
              <Repeat className="h-3.5 w-3.5" />
              <span>Lặp lại câu</span>
            </button>
          </div>
        </div>

        {/* Title & Keyboard shortcuts */}
        <div className="flex flex-wrap items-center justify-between gap-2 px-1">
          <div>
            <h1 className="text-sm sm:text-base font-bold text-slate-900">
              {title}
            </h1>
            {description && (
              <p className="mt-0.5 text-xs text-slate-500">{description}</p>
            )}
          </div>
          <div className="hidden sm:flex items-center gap-2 text-[11px] text-slate-400">
            <kbd className="rounded-md border border-slate-200 bg-white px-1.5 py-0.5 font-mono text-slate-600">
              Space
            </kbd>
            <span>Phát / Dừng</span>
            <span>•</span>
            <kbd className="rounded-md border border-slate-200 bg-white px-1.5 py-0.5 font-mono text-slate-600">
              ← / →
            </kbd>
            <span>Chuyển câu</span>
          </div>
        </div>

        {/* Mobile Panel Switcher (only shown on < lg) */}
        <div className="grid grid-cols-2 rounded-2xl border border-slate-200 bg-white p-1 shadow-2xs lg:hidden">
          <button
            type="button"
            onClick={() => setMobileTab("subtitles")}
            className={`inline-flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-xs font-semibold transition cursor-pointer ${
              mobileTab === "subtitles"
                ? "bg-teal-700 text-white shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <Languages className="h-3.5 w-3.5" />
            <span>Phụ đề ({subtitles.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setMobileTab("notes")}
            className={`inline-flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-xs font-semibold transition cursor-pointer ${
              mobileTab === "notes"
                ? "bg-teal-700 text-white shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <NotebookPen className="h-3.5 w-3.5" />
            <span>Ghi chú cá nhân</span>
          </button>
        </div>

        {/* Personal Notes */}
        <div
          className={`${
            mobileTab === "notes" ? "block" : "hidden lg:block"
          } rounded-2xl border border-slate-200/90 bg-white p-4 shadow-xs`}
        >
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <NotebookPen className="h-4 w-4 text-teal-700" />
              <h2 className="text-sm font-semibold text-slate-900">
                Ghi chú cá nhân
              </h2>
            </div>

            {isLoggedIn && (
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleInsertTimestamp}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-teal-200 bg-teal-50 px-2.5 py-1.5 text-xs font-medium text-teal-800 transition hover:bg-teal-100 cursor-pointer"
                >
                  <Clock className="h-3.5 w-3.5" />
                  <span>Chèn mốc ({formatTime(currentTime)})</span>
                </button>

                {noteContent.trim().length > 0 && (
                  <button
                    type="button"
                    onClick={() => setClearNoteModalOpen(true)}
                    title="Xóa toàn bộ ghi chú"
                    className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-500 transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700 cursor-pointer"
                  >
                    <Eraser className="h-3.5 w-3.5" />
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => void saveNote(noteContent, true)}
                  disabled={saveState === "saving"}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50 cursor-pointer"
                >
                  {saveState === "saving" ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-teal-700" />
                      <span>Đang lưu...</span>
                    </>
                  ) : saveState === "saved" ? (
                    <>
                      <Check className="h-3.5 w-3.5 text-emerald-600" />
                      <span className="text-emerald-700">Đã lưu</span>
                    </>
                  ) : (
                    <>
                      <Save className="h-3.5 w-3.5" />
                      <span>Lưu</span>
                    </>
                  )}
                </button>
              </div>
            )}
          </div>

          {isLoggedIn ? (
            <textarea
              ref={noteRef}
              rows={4}
              value={noteContent}
              onChange={(e) => handleNoteChange(e.target.value)}
              placeholder="Ghi lại từ vựng mới, cấu trúc câu hay hoặc cụm nối âm cần luyện lại..."
              className="w-full rounded-xl border border-slate-200 bg-slate-50/70 p-3 text-base sm:text-sm text-slate-800 outline-none transition focus:border-teal-600 focus:bg-white focus:ring-2 focus:ring-teal-600/15"
            />
          ) : (
            <div className="flex flex-col items-start justify-between gap-3 rounded-xl border border-dashed border-slate-200 bg-slate-50/70 p-4 sm:flex-row sm:items-center">
              <p className="text-xs leading-relaxed text-slate-600">
                Bạn đang học ở chế độ khách. Hãy đăng nhập để viết và lưu ghi
                chú cá nhân cho bài học này.
              </p>
              <button
                type="button"
                onClick={() => setAuthModalOpen(true)}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-teal-700 px-3.5 py-2 text-xs font-semibold text-white shadow-xs transition hover:bg-teal-800 cursor-pointer"
              >
                <LogIn className="h-3.5 w-3.5" />
                <span>Đăng nhập để lưu ghi chú</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Right Column: Synchronized Subtitles & IPA */}
      <div
        className={`${
          mobileTab === "subtitles" ? "flex" : "hidden lg:flex"
        } flex-col rounded-2xl border border-slate-200/90 bg-white shadow-xs lg:col-span-5 lg:h-[calc(100vh-7.5rem)] lg:sticky lg:top-20`}
      >
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-3.5">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-teal-50 text-teal-700">
              <Languages className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-slate-900">
                Phụ đề & Phiên âm IPA
              </h2>
              <p className="text-xs text-slate-500">
                {subtitles.length} câu thoại • Bấm vào câu để nghe lại
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setShowSubtitles((prev) => !prev)}
              className={`inline-flex items-center gap-1.5 rounded-xl border px-2.5 py-1.5 text-xs font-semibold transition cursor-pointer ${
                showSubtitles
                  ? "border-teal-200 bg-teal-50 text-teal-800"
                  : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
              }`}
            >
              {showSubtitles ? (
                <>
                  <Captions className="h-3.5 w-3.5" />
                  <span>Ẩn phụ đề</span>
                </>
              ) : (
                <>
                  <CaptionsOff className="h-3.5 w-3.5" />
                  <span>Hiện phụ đề</span>
                </>
              )}
            </button>

            {showSubtitles && (
              <button
                type="button"
                onClick={() => setShowIpa((prev) => !prev)}
                className={`inline-flex items-center gap-1.5 rounded-xl border px-2.5 py-1.5 text-xs font-semibold transition cursor-pointer ${
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
            )}
          </div>
        </div>

        <div
          ref={subtitleListRef}
          className="relative max-h-[48vh] lg:max-h-none lg:flex-1 space-y-2 overflow-y-auto p-3"
        >
          {subtitles.length === 0 ? (
            <div className="py-12 text-center text-sm text-slate-500">
              Video này chưa có phụ đề.
            </div>
          ) : !showSubtitles ? (
            <div className="flex h-full min-h-[240px] flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50/60 px-6 py-12 text-center">
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-teal-50 text-teal-700">
                <Headphones className="h-6 w-6" />
              </div>
              <h3 className="text-sm font-semibold text-slate-800">
                Chế độ luyện nghe thuần
              </h3>
              <p className="mt-1 max-w-xs text-xs leading-relaxed text-slate-500">
                Toàn bộ phụ đề và phiên âm IPA đang được ẩn. Bạn vẫn có thể
                dùng nút Lặp lại câu hoặc phím ← / → để tua từng câu.
              </p>
              <button
                type="button"
                onClick={() => setShowSubtitles(true)}
                className="mt-4 inline-flex items-center gap-1.5 rounded-xl border border-teal-200 bg-white px-3.5 py-2 text-xs font-semibold text-teal-800 shadow-2xs transition hover:bg-teal-50 cursor-pointer"
              >
                <Captions className="h-3.5 w-3.5" />
                <span>Hiện phụ đề để kiểm tra</span>
              </button>
            </div>
          ) : (
            subtitles.map((sub) => {
              const isActive = activeSubtitle?.id === sub.id;
              return (
                <div
                  key={sub.id}
                  ref={(el) => {
                    if (el) {
                      subtitleRefs.current.set(sub.id, el);
                    } else {
                      subtitleRefs.current.delete(sub.id);
                    }
                  }}
                  onClick={() => jumpToSubtitle(sub)}
                  className={`group cursor-pointer rounded-xl border p-3.5 transition-all duration-200 ${
                    isActive
                      ? "border-teal-600 bg-teal-50/75 shadow-xs"
                      : "border-slate-100 bg-white hover:border-teal-200 hover:bg-slate-50/80"
                  }`}
                >
                  <div className="mb-1.5 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span
                        className={`rounded-md px-1.5 py-0.5 font-mono text-[11px] font-medium transition ${
                          isActive
                            ? "bg-teal-700 text-white"
                            : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {formatTime(sub.startTime)}
                      </span>
                      {sub.speaker && (
                        <span className="text-xs font-semibold text-teal-800">
                          {sub.speaker}
                        </span>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        jumpToSubtitle(sub);
                      }}
                      title="Phát lại câu này"
                      className={`rounded-lg p-1.5 transition cursor-pointer ${
                        isActive
                          ? "bg-teal-100 text-teal-800 hover:bg-teal-200"
                          : "text-slate-400 hover:bg-slate-200/70 hover:text-slate-700"
                      }`}
                    >
                      <Volume2 className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  <p
                    className={`text-sm leading-relaxed font-medium ${
                      isActive ? "text-slate-950" : "text-slate-800"
                    }`}
                  >
                    {sub.text}
                  </p>

                  {showIpa && sub.ipa && (
                    <p
                      className={`mt-1.5 font-mono text-xs leading-relaxed ${
                        isActive ? "text-teal-800" : "text-slate-500"
                      }`}
                    >
                      {sub.ipa}
                    </p>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      <ConfirmModal
        open={clearNoteModalOpen}
        variant="danger"
        title="Xóa toàn bộ ghi chú?"
        description="Nội dung ghi chú của bạn cho bài học này sẽ bị xóa trắng."
        confirmText="Xóa ghi chú"
        onConfirm={() => void confirmClearNote()}
        onCancel={() => setClearNoteModalOpen(false)}
      />

      <AuthModal
        open={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
      />
    </div>
  );
}
