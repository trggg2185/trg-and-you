"use client";

import { FormEvent, useMemo, useState } from "react";
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Eye,
  EyeOff,
  Keyboard,
  RotateCcw,
  Volume2,
  XCircle,
} from "lucide-react";
import type { SubtitleItem } from "@/components/ShadowingStudio";

interface DictationPanelProps {
  subtitles: SubtitleItem[];
  currentIndex: number;
  onPlaySegment: (sub: SubtitleItem) => void;
  onSelectIndex: (index: number) => void;
  onCorrectAnswer?: () => void;
}

interface WordToken {
  raw: string;
  leading: string;
  core: string;
  trailing: string;
  isBlank: boolean;
}

function normalizeWord(word: string): string {
  return word
    .toLowerCase()
    .replace(/[’']/g, "'")
    .replace(/[^a-z0-9']/g, "");
}

function deterministicHash(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function tokenizeForBlanks(subId: string, text: string): WordToken[] {
  const parts = text.trim().split(/\s+/).filter(Boolean);
  const rawTokens = parts.map((raw) => {
    const match = raw.match(/^([^a-zA-Z0-9']*)([a-zA-Z0-9']+)([^a-zA-Z0-9']*)$/);
    if (!match) {
      return { raw, leading: "", core: raw, trailing: "", isBlank: false };
    }
    return {
      raw,
      leading: match[1],
      core: match[2],
      trailing: match[3],
      isBlank: false,
    };
  });

  const eligibleIndices: number[] = [];
  rawTokens.forEach((t, idx) => {
    if (normalizeWord(t.core).length >= 3) {
      eligibleIndices.push(idx);
    }
  });

  const pool =
    eligibleIndices.length > 0
      ? eligibleIndices
      : rawTokens.map((_, idx) => idx);

  const blankCount = Math.max(1, Math.min(5, Math.round(pool.length * 0.32)));
  const ranked = [...pool].sort(
    (a, b) =>
      deterministicHash(`${subId}:${a}`) - deterministicHash(`${subId}:${b}`)
  );
  const chosen = new Set(ranked.slice(0, blankCount));

  return rawTokens.map((t, idx) => ({
    ...t,
    isBlank: chosen.has(idx),
  }));
}

export default function DictationPanel({
  subtitles,
  currentIndex,
  onPlaySegment,
  onSelectIndex,
  onCorrectAnswer,
}: DictationPanelProps) {
  const [dictMode, setDictMode] = useState<"blanks" | "full">("blanks");
  const [solvedIds, setSolvedIds] = useState<string[]>([]);

  if (subtitles.length === 0) {
    return (
      <div className="py-12 text-center text-sm text-slate-500">
        Video này chưa có phụ đề để luyện chép chính tả.
      </div>
    );
  }

  const safeIndex =
    currentIndex >= 0 && currentIndex < subtitles.length ? currentIndex : 0;
  const currentSub = subtitles[safeIndex];

  function handleMarkSolved(subId: string) {
    if (!solvedIds.includes(subId)) {
      setSolvedIds((prev) => [...prev, subId]);
      onCorrectAnswer?.();
    }
  }

  return (
    <div className="flex flex-1 flex-col p-3.5 sm:p-4">
      {/* Top Mode & Progress Bar */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="inline-flex rounded-xl bg-slate-100 p-0.5">
          <button
            type="button"
            onClick={() => setDictMode("blanks")}
            className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold transition cursor-pointer ${
              dictMode === "blanks"
                ? "bg-white text-teal-800 shadow-2xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Điền từ khuyết
          </button>
          <button
            type="button"
            onClick={() => setDictMode("full")}
            className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold transition cursor-pointer ${
              dictMode === "full"
                ? "bg-white text-teal-800 shadow-2xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Gõ cả câu
          </button>
        </div>

        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 border border-emerald-200/70">
          <CheckCircle2 className="h-3.5 w-3.5" />
          Đúng {solvedIds.length}/{subtitles.length}
        </span>
      </div>

      {/* Keyed inner card resets inputs cleanly whenever sentence or mode changes */}
      <DictationCard
        key={`${currentSub.id}-${dictMode}`}
        sub={currentSub}
        index={safeIndex}
        total={subtitles.length}
        mode={dictMode}
        onPlay={() => onPlaySegment(currentSub)}
        onPrev={() => onSelectIndex(Math.max(0, safeIndex - 1))}
        onNext={() => onSelectIndex(Math.min(subtitles.length - 1, safeIndex + 1))}
        onSolved={() => handleMarkSolved(currentSub.id)}
      />
    </div>
  );
}

function DictationCard({
  sub,
  index,
  total,
  mode,
  onPlay,
  onPrev,
  onNext,
  onSolved,
}: {
  sub: SubtitleItem;
  index: number;
  total: number;
  mode: "blanks" | "full";
  onPlay: () => void;
  onPrev: () => void;
  onNext: () => void;
  onSolved: () => void;
}) {
  const tokens = useMemo(
    () => tokenizeForBlanks(sub.id, sub.text),
    [sub.id, sub.text]
  );

  const [blankInputs, setBlankInputs] = useState<Record<number, string>>({});
  const [fullInput, setFullInput] = useState("");
  const [checked, setChecked] = useState(false);
  const [showAnswer, setShowAnswer] = useState(false);

  const fullWordComparison = useMemo(() => {
    if (!checked || mode !== "full") return [];
    const expected = sub.text.trim().split(/\s+/).filter(Boolean);
    const typed = fullInput.trim().split(/\s+/).filter(Boolean);
    return expected.map((word, idx) => {
      const userWord = typed[idx] ?? "";
      const isCorrect = normalizeWord(word) === normalizeWord(userWord);
      return { expected: word, typed: userWord, isCorrect };
    });
  }, [checked, mode, sub.text, fullInput]);

  const isAllCorrect = useMemo(() => {
    if (!checked) return false;
    if (mode === "blanks") {
      return tokens
        .map((t, idx) =>
          t.isBlank
            ? normalizeWord(blankInputs[idx] ?? "") === normalizeWord(t.core)
            : true
        )
        .every(Boolean);
    }
    return (
      fullWordComparison.length > 0 &&
      fullWordComparison.every((w) => w.isCorrect)
    );
  }, [checked, mode, tokens, blankInputs, fullWordComparison]);

  function handleCheck(e: FormEvent) {
    e.preventDefault();
    setChecked(true);

    let ok = false;
    if (mode === "blanks") {
      ok = tokens
        .map((t, idx) =>
          t.isBlank
            ? normalizeWord(blankInputs[idx] ?? "") === normalizeWord(t.core)
            : true
        )
        .every(Boolean);
    } else {
      const expected = sub.text.trim().split(/\s+/).filter(Boolean);
      const typed = fullInput.trim().split(/\s+/).filter(Boolean);
      ok =
        expected.length > 0 &&
        expected.every(
          (w, idx) => normalizeWord(w) === normalizeWord(typed[idx] ?? "")
        );
    }

    if (ok) {
      onSolved();
    }
  }

  function handleReset() {
    setBlankInputs({});
    setFullInput("");
    setChecked(false);
    setShowAnswer(false);
  }

  return (
    <form onSubmit={handleCheck} className="flex flex-1 flex-col gap-4">
      <div className="flex items-center justify-between gap-2 rounded-xl border border-slate-100 bg-slate-50/70 px-3 py-2.5">
        <div className="flex items-center gap-2">
          <span className="rounded-lg bg-teal-700 px-2 py-0.5 font-mono text-xs font-bold text-white">
            Câu #{index + 1}/{total}
          </span>
          {sub.speaker && (
            <span className="text-xs font-semibold text-teal-800">
              {sub.speaker}
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={onPlay}
          className="inline-flex items-center gap-1.5 rounded-xl bg-teal-700 px-3 py-1.5 text-xs font-semibold text-white shadow-2xs transition hover:bg-teal-800 cursor-pointer"
        >
          <Volume2 className="h-3.5 w-3.5" />
          <span>Nghe câu này</span>
        </button>
      </div>

      {/* Input Area */}
      {mode === "blanks" ? (
        <div className="rounded-2xl border border-slate-200/90 bg-white p-4 leading-loose text-sm text-slate-800">
          <div className="flex flex-wrap items-center gap-y-2 gap-x-1.5">
            {tokens.map((t, idx) => {
              if (!t.isBlank) {
                return (
                  <span key={idx} className="font-medium">
                    {t.raw}
                  </span>
                );
              }
              const val = blankInputs[idx] ?? "";
              const wordCorrect =
                checked && normalizeWord(val) === normalizeWord(t.core);
              const wordWrong = checked && !wordCorrect;

              return (
                <span key={idx} className="inline-flex items-center">
                  {t.leading && <span>{t.leading}</span>}
                  <input
                    type="text"
                    value={val}
                    onChange={(e) => {
                      setChecked(false);
                      setBlankInputs((prev) => ({
                        ...prev,
                        [idx]: e.target.value,
                      }));
                    }}
                    style={{ width: `${Math.max(5, t.core.length + 2)}ch` }}
                    placeholder={"_".repeat(Math.min(6, t.core.length))}
                    autoComplete="off"
                    spellCheck={false}
                    className={`rounded-lg border px-2 py-0.5 text-center font-mono text-base sm:text-sm outline-none transition ${
                      wordCorrect
                        ? "border-emerald-500 bg-emerald-50 text-emerald-800"
                        : wordWrong
                        ? "border-rose-400 bg-rose-50 text-rose-800"
                        : "border-teal-300 bg-teal-50/40 text-slate-900 focus:border-teal-600 focus:bg-white"
                    }`}
                  />
                  {t.trailing && <span>{t.trailing}</span>}
                </span>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <label className="flex items-center gap-1.5 text-xs font-medium text-slate-600">
            <Keyboard className="h-3.5 w-3.5 text-teal-700" />
            <span>Nghe và gõ lại toàn bộ câu bạn nghe được:</span>
          </label>
          <textarea
            rows={3}
            value={fullInput}
            onChange={(e) => {
              setChecked(false);
              setFullInput(e.target.value);
            }}
            placeholder="Nhập câu tiếng Anh..."
            autoComplete="off"
            spellCheck={false}
            className="w-full rounded-xl border border-slate-200 bg-slate-50/60 p-3 text-base sm:text-sm text-slate-900 outline-none transition focus:border-teal-600 focus:bg-white focus:ring-2 focus:ring-teal-600/15"
          />
        </div>
      )}

      {/* Check Feedback */}
      {checked && (
        <div
          className={`rounded-xl border p-3 text-xs ${
            isAllCorrect
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border-rose-200 bg-rose-50/70 text-rose-800"
          }`}
        >
          <div className="flex items-center gap-2 font-semibold">
            {isAllCorrect ? (
              <>
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                <span>Chính xác hoàn toàn! Tuyệt vời!</span>
              </>
            ) : (
              <>
                <XCircle className="h-4 w-4 text-rose-600" />
                <span>Một vài từ chưa khớp — hãy nghe lại hoặc xem gợi ý.</span>
              </>
            )}
          </div>

          {mode === "full" && fullWordComparison.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {fullWordComparison.map((w, idx) => (
                <span
                  key={idx}
                  className={`rounded-md px-1.5 py-0.5 font-medium ${
                    w.isCorrect
                      ? "bg-emerald-100 text-emerald-800"
                      : "bg-rose-100 text-rose-800"
                  }`}
                >
                  {w.isCorrect ? w.expected : `${w.typed || "___"} → ${w.expected}`}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Reveal Answer Box */}
      {showAnswer && (
        <div className="rounded-xl border border-teal-200 bg-teal-50/60 p-3.5 text-xs">
          <p className="font-semibold text-slate-900">{sub.text}</p>
          {sub.ipa && (
            <p className="mt-1 font-mono text-teal-800">{sub.ipa}</p>
          )}
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="submit"
          className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-teal-700 px-4 py-2.5 text-xs font-semibold text-white shadow-xs transition hover:bg-teal-800 cursor-pointer"
        >
          <CheckCircle2 className="h-4 w-4" />
          <span>Kiểm tra</span>
        </button>

        <button
          type="button"
          onClick={() => setShowAnswer((prev) => !prev)}
          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50 cursor-pointer"
        >
          {showAnswer ? (
            <>
              <EyeOff className="h-3.5 w-3.5" />
              <span>Ẩn đáp án</span>
            </>
          ) : (
            <>
              <Eye className="h-3.5 w-3.5" />
              <span>Đáp án</span>
            </>
          )}
        </button>

        <button
          type="button"
          onClick={handleReset}
          title="Làm lại câu này"
          className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white p-2.5 text-slate-500 transition hover:bg-slate-50 hover:text-slate-800 cursor-pointer"
        >
          <RotateCcw className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Sentence Navigation */}
      <div className="mt-auto flex items-center justify-between border-t border-slate-100 pt-3">
        <button
          type="button"
          disabled={index <= 0}
          onClick={onPrev}
          className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-40 cursor-pointer"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          <span>Câu trước</span>
        </button>

        <button
          type="button"
          disabled={index >= total - 1}
          onClick={onNext}
          className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-40 cursor-pointer"
        >
          <span>Câu tiếp theo</span>
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </form>
  );
}
