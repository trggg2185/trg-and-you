"use client";

import { useEffect, useState } from "react";
import {
  BookmarkPlus,
  Check,
  Loader2,
  Volume2,
  X,
} from "lucide-react";
import { useToast } from "@/components/ToastProvider";

interface WordLookupData {
  word: string;
  phonetic: string;
  partOfSpeech: string;
  meaningVi: string;
}

interface WordPopoverProps {
  word: string;
  contextSentence: string;
  videoId: string;
  startTime: number;
  isAuthenticated: boolean;
  onRequireAuth: () => void;
  onClose: () => void;
}

export default function WordPopover({
  word,
  contextSentence,
  videoId,
  startTime,
  isAuthenticated,
  onRequireAuth,
  onClose,
}: WordPopoverProps) {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<WordLookupData | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;

    const url = `/api/words/lookup?word=${encodeURIComponent(
      word
    )}&context=${encodeURIComponent(contextSentence.slice(0, 200))}`;

    fetch(url, { signal: controller.signal })
      .then(async (res) => {
        const json = await res.json();
        if (!active) return;
        if (res.ok && json.word) {
          setData({
            word: json.word,
            phonetic: json.phonetic || "",
            partOfSpeech: json.partOfSpeech || "",
            meaningVi: json.meaningVi || "Chưa tìm thấy nghĩa phù hợp.",
          });
        } else {
          setData({
            word,
            phonetic: "",
            partOfSpeech: "",
            meaningVi: json.error || "Không thể tra từ lúc này.",
          });
        }
      })
      .catch(() => {
        if (!active) return;
        setData({
          word,
          phonetic: "",
          partOfSpeech: "",
          meaningVi: "Không thể kết nối từ điển lúc này.",
        });
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [word, contextSentence]);

  function speakWord(rate: number) {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      toast.error("Trình duyệt không hỗ trợ đọc phát âm tự động.");
      return;
    }
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(word);
    utter.lang = "en-US";
    utter.rate = rate;
    window.speechSynthesis.speak(utter);
  }

  async function handleSaveVocab() {
    if (!isAuthenticated) {
      onRequireAuth();
      return;
    }
    if (saving || saved) return;

    setSaving(true);
    try {
      const res = await fetch("/api/vocab", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          word: data?.word || word,
          phonetic: data?.phonetic || "",
          partOfSpeech: data?.partOfSpeech || "",
          meaningVi: data?.meaningVi || "",
          exampleText: contextSentence,
          videoId,
          startTime,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error || "Không thể lưu từ vựng.");
        return;
      }
      setSaved(true);
      toast.success(`Đã lưu "${word}" vào kho từ vựng ôn tập.`);
    } catch {
      toast.error("Lỗi kết nối khi lưu từ vựng.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-x-3 bottom-4 z-40 sm:inset-auto sm:bottom-6 sm:left-6 sm:w-96 rounded-2xl border border-teal-200 bg-white p-4 shadow-2xl shadow-slate-900/15"
      role="dialog"
      aria-label={`Tra từ ${word}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="text-lg font-bold text-slate-900">{word}</h4>
            {data?.partOfSpeech && (
              <span className="rounded-md bg-teal-50 px-2 py-0.5 text-[11px] font-semibold text-teal-800">
                {data.partOfSpeech}
              </span>
            )}
          </div>
          {data?.phonetic && (
            <p className="mt-0.5 font-mono text-xs text-slate-500">
              {data.phonetic}
            </p>
          )}
        </div>

        <button
          type="button"
          onClick={onClose}
          aria-label="Đóng tra từ"
          className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 cursor-pointer"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-2.5 min-h-[42px]">
        {loading ? (
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <Loader2 className="h-3.5 w-3.5 animate-spin text-teal-700" />
            <span>Đang tra nghĩa & phiên âm...</span>
          </div>
        ) : (
          <p className="text-sm font-medium leading-relaxed text-slate-700">
            {data?.meaningVi}
          </p>
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
        <button
          type="button"
          onClick={() => speakWord(1.0)}
          className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 cursor-pointer"
        >
          <Volume2 className="h-3.5 w-3.5 text-teal-700" />
          <span>Phát âm</span>
        </button>

        <button
          type="button"
          onClick={() => speakWord(0.68)}
          className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 cursor-pointer"
        >
          <Volume2 className="h-3.5 w-3.5 text-amber-600" />
          <span>Đọc chậm</span>
        </button>

        <button
          type="button"
          disabled={saving || loading}
          onClick={() => void handleSaveVocab()}
          className={`ml-auto inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition cursor-pointer ${
            saved
              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
              : "bg-teal-700 text-white hover:bg-teal-800 disabled:opacity-60"
          }`}
        >
          {saving ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : saved ? (
            <Check className="h-3.5 w-3.5" />
          ) : (
            <BookmarkPlus className="h-3.5 w-3.5" />
          )}
          <span>{saved ? "Đã lưu từ" : "Lưu từ vựng"}</span>
        </button>
      </div>
    </div>
  );
}
