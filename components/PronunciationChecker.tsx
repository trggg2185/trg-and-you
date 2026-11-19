"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { Mic, MicOff, RotateCcw, Sparkles } from "lucide-react";

interface SpeechRecognitionAlternativeLike {
  transcript: string;
}

interface SpeechRecognitionResultLike {
  0: SpeechRecognitionAlternativeLike;
}

interface SpeechRecognitionEventLike {
  results: ArrayLike<SpeechRecognitionResultLike>;
}

interface SpeechRecognitionInstanceLike {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  continuous: boolean;
  onresult: ((e: SpeechRecognitionEventLike) => void) | null;
  onerror: ((e: { error?: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}

type SpeechRecognitionCtor = new () => SpeechRecognitionInstanceLike;

interface PronunciationCheckerProps {
  targetText: string;
  onBeforeStart?: () => void;
}

const emptySubscribe = () => () => {};

function getSpeechCtor(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const win = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return win.SpeechRecognition || win.webkitSpeechRecognition || null;
}

function normalizeToken(token: string): string {
  return token.toLowerCase().replace(/[^a-z0-9']/g, "");
}

function evaluateWords(target: string, spoken: string) {
  const targetTokens = target.trim().split(/\s+/).filter(Boolean);
  const spokenTokens = spoken
    .trim()
    .split(/\s+/)
    .map(normalizeToken)
    .filter(Boolean);

  const spokenSet = new Set(spokenTokens);
  let matchedCount = 0;

  const evaluated = targetTokens.map((raw) => {
    const clean = normalizeToken(raw);
    const matched = Boolean(clean && spokenSet.has(clean));
    if (matched) matchedCount += 1;
    return { raw, matched };
  });

  const score =
    targetTokens.length > 0
      ? Math.round((matchedCount / targetTokens.length) * 100)
      : 0;

  return { evaluated, score };
}

export default function PronunciationChecker({
  targetText,
  onBeforeStart,
}: PronunciationCheckerProps) {
  const recognitionRef = useRef<SpeechRecognitionInstanceLike | null>(null);
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const isSupported = useSyncExternalStore(
    emptySubscribe,
    () => getSpeechCtor() !== null,
    () => true
  );

  useEffect(() => {
    return () => {
      try {
        recognitionRef.current?.stop();
      } catch {
        // ignore stop errors on cleanup
      }
    };
  }, []);

  const result = useMemo(() => {
    if (!transcript.trim()) return null;
    return evaluateWords(targetText, transcript);
  }, [targetText, transcript]);

  function startListening() {
    const Ctor = getSpeechCtor();
    if (!Ctor) {
      setErrorMsg(
        "Trình duyệt này chưa hỗ trợ Web Speech API. Vui lòng dùng Chrome hoặc Edge."
      );
      return;
    }

    onBeforeStart?.();
    setErrorMsg(null);
    try {
      recognitionRef.current?.stop();
    } catch {
      // ignore
    }

    const rec = new Ctor();
    rec.lang = "en-US";
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    rec.continuous = false;

    rec.onresult = (event) => {
      const spoken = event.results?.[0]?.[0]?.transcript ?? "";
      setTranscript(spoken);
    };

    rec.onerror = (ev) => {
      setListening(false);
      if (ev.error === "not-allowed") {
        setErrorMsg("Bạn đã chặn quyền micro. Hãy bật quyền micro để kiểm tra phát âm.");
      } else if (ev.error === "no-speech") {
        setErrorMsg("Chưa nghe rõ giọng nói. Hãy thử nói to và rõ hơn.");
      } else {
        setErrorMsg("Không nhận diện được giọng nói. Vui lòng thử lại.");
      }
    };

    rec.onend = () => {
      setListening(false);
    };

    recognitionRef.current = rec;
    setListening(true);
    try {
      rec.start();
    } catch {
      setListening(false);
      setErrorMsg("Không thể khởi động nhận diện giọng nói lúc này.");
    }
  }

  function stopListening() {
    try {
      recognitionRef.current?.stop();
    } catch {
      // ignore
    }
    setListening(false);
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700">
          <Sparkles className="h-3.5 w-3.5 text-teal-700" />
          <span>Kiểm tra phát âm (Web Speech API)</span>
        </div>

        <div className="flex items-center gap-1.5">
          {transcript && (
            <button
              type="button"
              onClick={() => {
                setTranscript("");
                onBeforeStart?.();
    setErrorMsg(null);
              }}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-600 hover:bg-slate-50 cursor-pointer"
            >
              <RotateCcw className="h-3 w-3" />
              <span>Thử lại</span>
            </button>
          )}

          {isSupported ? (
            <button
              type="button"
              onClick={listening ? stopListening : startListening}
              className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition cursor-pointer ${
                listening
                  ? "bg-rose-600 text-white animate-pulse"
                  : "bg-teal-700 text-white hover:bg-teal-800"
              }`}
            >
              {listening ? (
                <>
                  <MicOff className="h-3.5 w-3.5" />
                  <span>Đang nghe... bấm để dừng</span>
                </>
              ) : (
                <>
                  <Mic className="h-3.5 w-3.5" />
                  <span>Đọc kiểm tra câu này</span>
                </>
              )}
            </button>
          ) : (
            <span className="text-[11px] text-amber-700">
              Cần trình duyệt Chrome/Edge
            </span>
          )}
        </div>
      </div>

      {errorMsg && (
        <p className="mt-2 text-xs font-medium text-rose-600">{errorMsg}</p>
      )}

      {result && (
        <div className="mt-2.5 space-y-2 border-t border-slate-200/80 pt-2.5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-500">
              Bạn đọc: <span className="font-medium text-slate-700">&ldquo;{transcript}&rdquo;</span>
            </span>
            <span
              className={`rounded-full px-2 py-0.5 font-bold ${
                result.score >= 80
                  ? "bg-emerald-100 text-emerald-800"
                  : result.score >= 50
                  ? "bg-amber-100 text-amber-800"
                  : "bg-rose-100 text-rose-800"
              }`}
            >
              Khớp {result.score}%
            </span>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {result.evaluated.map((tok, i) => (
              <span
                key={`${tok.raw}-${i}`}
                className={`rounded-md px-1.5 py-0.5 text-xs font-medium ${
                  tok.matched
                    ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                    : "bg-rose-50 text-rose-700 border border-rose-200"
                }`}
              >
                {tok.raw}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
