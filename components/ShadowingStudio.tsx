"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
    Bookmark,
    Captions,
    CaptionsOff,
    Check,
    Clock,
    Download,
    Eraser,
    Eye,
    EyeOff,
    Gauge,
    Headphones,
    Keyboard,
    Languages,
    Loader2,
    LogIn,
    Mic,
    NotebookPen,
    Pause,
    PauseCircle,
    Play,
    Repeat,
    RotateCcw,
    Save,
    SkipBack,
    SkipForward,
    Square,
    Trash2,
    Users,
    Volume2,
    X,
} from "lucide-react";
import { useToast } from "@/components/ToastProvider";
import ConfirmModal from "@/components/ConfirmModal";
import AuthModal from "@/components/AuthModal";
import DictationPanel from "@/components/DictationPanel";
import WordPopover from "@/components/WordPopover";
import PronunciationChecker from "@/components/PronunciationChecker";
import SharedNotesPanel from "@/components/SharedNotesPanel";
import {
    formatSrtContent,
    formatTxtTranscript,
    sanitizeFilename,
    triggerTextDownload,
} from "@/lib/export";
import { LEVEL_BADGE_STYLES, parseTagsList } from "@/lib/lessonMeta";
import type { UserRole } from "@/lib/jwt";

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
    level?: string | null;
    tags?: string | null;
    videoUrl: string;
    subtitles: SubtitleItem[];
    initialNote: string;
    initialSavedIds: string[];
    initialProgressTime: number;
    startAtTime: number | null;
    isLoggedIn: boolean;
    currentUserId?: string | null;
    isAdmin?: boolean;
    currentUserRole?: UserRole | null;
}

function formatTime(seconds: number): string {
    const safe = Math.max(0, Math.floor(seconds));
    const mins = Math.floor(safe / 60);
    const secs = safe % 60;
    return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

function extractNoteTimestamps(text: string): Array<{ label: string; seconds: number }> {
    const regex = /\[(\d{1,2}):(\d{2})\]/g;
    const seen = new Set<number>();
    const list: Array<{ label: string; seconds: number }> = [];
    let match: RegExpExecArray | null;
    while ((match = regex.exec(text)) !== null) {
        const mins = Number(match[1]);
        const secs = Number(match[2]);
        if (secs >= 60) continue;
        const total = mins * 60 + secs;
        if (!seen.has(total)) {
            seen.add(total);
            list.push({
                label: `${match[1].padStart(2, "0")}:${match[2]}`,
                seconds: total,
            });
        }
    }
    return list;
}

export default function ShadowingStudio({
    videoId,
    title,
    description,
    level = null,
    tags = "",
    videoUrl,
    subtitles,
    initialNote,
    initialSavedIds,
    initialProgressTime,
    startAtTime,
    isLoggedIn,
    currentUserId = null,
    isAdmin = false,
    currentUserRole = null,
}: ShadowingStudioProps) {
    const toast = useToast();
    const videoRef = useRef<HTMLVideoElement | null>(null);
    const noteRef = useRef<HTMLTextAreaElement | null>(null);
    const subtitleListRef = useRef<HTMLDivElement | null>(null);
    const subtitleRefs = useRef<Map<string, HTMLDivElement>>(new Map());
    const hasInitializedPlaybackRef = useRef(false);
    const pendingSeekRef = useRef<number | null>(null);
    const lastProgressSyncRef = useRef(0);
    const lastAutoPausedSubIdRef = useRef<string | null>(null);
    const segmentStopTimeRef = useRef<number | null>(null);

    // Voice recording refs
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const mediaStreamRef = useRef<MediaStream | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);
    const playbackAudioRef = useRef<HTMLAudioElement | null>(null);
    const recordedUrlsRef = useRef<Record<string, string>>({});

    const [currentTime, setCurrentTime] = useState(0);
    const [isPlaying, setIsPlaying] = useState(false);
    const [autoplayBlocked, setAutoplayBlocked] = useState(false);
    const [resumedFromTime, setResumedFromTime] = useState<number | null>(null);
    const [playbackRate, setPlaybackRate] = useState<number>(1.0);
    const [loopSentence, setLoopSentence] = useState(false);
    const [autoPause, setAutoPause] = useState(false);
    const [pausedForShadowing, setPausedForShadowing] = useState(false);
    const [rightMode, setRightMode] = useState<"subtitles" | "dictation">("subtitles");
    const [dictationIndex, setDictationIndex] = useState(0);
    const [showSubtitles, setShowSubtitles] = useState(true);
    const [showIpa, setShowIpa] = useState(true);
    const [mobileTab, setMobileTab] = useState<"subtitles" | "notes">("subtitles");
    const [lockedLoopSubId, setLockedLoopSubId] = useState<string | null>(null);
    const [authModalOpen, setAuthModalOpen] = useState(false);

    // A-B Custom Loop state
    const [loopA, setLoopA] = useState<number | null>(null);
    const [loopB, setLoopB] = useState<number | null>(null);
    const [abLoopActive, setAbLoopActive] = useState(false);

    // Word tap dictionary popover state
    const [selectedWord, setSelectedWord] = useState<{
        word: string;
        sentence: string;
        startTime: number;
    } | null>(null);

    // Notes section tab ("personal" | "shared")
    const [noteTab, setNoteTab] = useState<"personal" | "shared">("personal");

    // Voice recorder state
    const [recordingSubId, setRecordingSubId] = useState<string | null>(null);
    const [recordedUrls, setRecordedUrls] = useState<Record<string, string>>({});
    const [playingRecSubId, setPlayingRecSubId] = useState<string | null>(null);

    // Saved sentences state (prop-synced cleanly without effect)
    const initialSavedKey = initialSavedIds.join(",");
    const [prevSavedKey, setPrevSavedKey] = useState(initialSavedKey);
    const [savedIds, setSavedIds] = useState<string[]>(initialSavedIds);
    if (initialSavedKey !== prevSavedKey) {
        setPrevSavedKey(initialSavedKey);
        setSavedIds(initialSavedIds);
    }

    // Notes state (prop-synced cleanly without effect)
    const [prevInitialNote, setPrevInitialNote] = useState(initialNote);
    const [noteContent, setNoteContent] = useState(initialNote);
    const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("idle");
    const [clearNoteModalOpen, setClearNoteModalOpen] = useState(false);
    const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const lastSavedRef = useRef(initialNote);

    if (initialNote !== prevInitialNote) {
        setPrevInitialNote(initialNote);
        setNoteContent(initialNote);
    }

    const noteTimestamps = useMemo(
        () => extractNoteTimestamps(noteContent),
        [noteContent],
    );

    const activeSubtitleIndex = useMemo(() => {
        return subtitles.findIndex(
            (sub) => currentTime >= sub.startTime && currentTime <= sub.endTime,
        );
    }, [subtitles, currentTime]);

    const activeSubtitle =
        activeSubtitleIndex >= 0 ? subtitles[activeSubtitleIndex] : null;
    const activeSubtitleId = activeSubtitle?.id ?? null;

    const loopTargetSub = useMemo(() => {
        if (!loopSentence) return null;
        if (lockedLoopSubId) {
            const found = subtitles.find((s) => s.id === lockedLoopSubId);
            if (found) return found;
        }
        return activeSubtitle;
    }, [loopSentence, lockedLoopSubId, subtitles, activeSubtitle]);

    useEffect(() => {
        lastSavedRef.current = initialNote;
    }, [initialNote]);

    // Cleanup timers, mic stream, and blob URLs on unmount
    useEffect(() => {
        return () => {
            if (saveTimerRef.current) {
                clearTimeout(saveTimerRef.current);
            }
            if (mediaRecorderRef.current?.state === "recording") {
                mediaRecorderRef.current.stop();
            }
            mediaStreamRef.current?.getTracks().forEach((t) => t.stop());
            playbackAudioRef.current?.pause();
            Object.values(recordedUrlsRef.current).forEach((url) =>
                URL.revokeObjectURL(url),
            );
        };
    }, []);

    useEffect(() => {
        if (!activeSubtitleId || !showSubtitles || rightMode !== "subtitles") {
            return;
        }
        const container = subtitleListRef.current;
        const el = subtitleRefs.current.get(activeSubtitleId);
        if (container && el) {
            const targetTop =
                el.offsetTop - container.clientHeight / 2 + el.clientHeight / 2;
            container.scrollTo({
                top: Math.max(0, targetTop),
                behavior: "smooth",
            });
        }
    }, [activeSubtitleId, showSubtitles, rightMode]);

    useEffect(() => {
        if (videoRef.current) {
            videoRef.current.playbackRate = playbackRate;
        }
    }, [playbackRate]);

    // Track active study time while video plays (for logged-in users)
    useEffect(() => {
        if (!isLoggedIn || !isPlaying) return;
        const timer = setInterval(() => {
            void fetch("/api/stats", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ seconds: 15 }),
            }).catch(() => {});
        }, 15000);
        return () => clearInterval(timer);
    }, [isLoggedIn, isPlaying]);

    const seekRelative = useCallback((deltaSec: number) => {
        const video = videoRef.current;
        if (!video) return;
        const dur =
            Number.isFinite(video.duration) && video.duration > 0
                ? video.duration
                : Infinity;
        const nextTime = Math.min(dur, Math.max(0, video.currentTime + deltaSec));
        video.currentTime = nextTime;
        setCurrentTime(nextTime);
    }, []);

    // Save learning progress (localStorage + DB if logged in)
    const persistProgress = useCallback(
        (timeSec: number, durationSec: number, forceCompleted = false) => {
            const safeTime = Number(Math.max(0, timeSec).toFixed(1));
            const safeDur =
                Number.isFinite(durationSec) && durationSec > 0
                    ? Number(durationSec.toFixed(1))
                    : 0;
            const completed =
                forceCompleted || (safeDur > 0 && safeTime / safeDur >= 0.9);

            try {
                const key = `trg_progress_${videoId}`;
                const prevRaw = window.localStorage.getItem(key);
                const prev = prevRaw
                    ? (JSON.parse(prevRaw) as { completed?: boolean })
                    : null;
                window.localStorage.setItem(
                    key,
                    JSON.stringify({
                        lastTime: safeTime,
                        duration: safeDur,
                        completed: Boolean(prev?.completed || completed),
                    }),
                );
            } catch {
                // Ignore storage quota errors
            }

            if (isLoggedIn) {
                void fetch("/api/progress", {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        videoId,
                        lastTime: safeTime,
                        duration: safeDur,
                        completed,
                    }),
                }).catch(() => {});
            }
        },
        [videoId, isLoggedIn],
    );

    const seekAndPlay = useCallback((seconds: number) => {
        const video = videoRef.current;
        if (!video) return;
        hasInitializedPlaybackRef.current = true;
        segmentStopTimeRef.current = null;
        lastAutoPausedSubIdRef.current = null;
        setPausedForShadowing(false);
        const target = Math.max(0, seconds);
        if (video.readyState >= 1) {
            video.currentTime = target;
            pendingSeekRef.current = null;
        } else {
            pendingSeekRef.current = target;
        }
        setCurrentTime(target);
        void video.play().catch(() => {});
    }, []);

    const jumpToSubtitle = useCallback(
        (sub: SubtitleItem) => {
            const video = videoRef.current;
            if (!video) return;
            hasInitializedPlaybackRef.current = true;
            segmentStopTimeRef.current = null;
            lastAutoPausedSubIdRef.current = null;
            setPausedForShadowing(false);
            if (video.readyState >= 1) {
                video.currentTime = sub.startTime;
                pendingSeekRef.current = null;
            } else {
                pendingSeekRef.current = sub.startTime;
            }
            setCurrentTime(sub.startTime);
            setLockedLoopSubId(sub.id);
            const idx = subtitles.findIndex((s) => s.id === sub.id);
            if (idx >= 0) setDictationIndex(idx);
            void video.play().catch(() => {});
        },
        [subtitles],
    );

    const playSingleSegment = useCallback((sub: SubtitleItem) => {
        const video = videoRef.current;
        if (!video) return;
        hasInitializedPlaybackRef.current = true;
        lastAutoPausedSubIdRef.current = null;
        setPausedForShadowing(false);
        segmentStopTimeRef.current = sub.endTime;
        if (video.readyState >= 1) {
            video.currentTime = sub.startTime;
            pendingSeekRef.current = null;
        } else {
            pendingSeekRef.current = sub.startTime;
        }
        setCurrentTime(sub.startTime);
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
        [subtitles, activeSubtitleIndex, currentTime, jumpToSubtitle],
    );

    const togglePlayPause = useCallback(() => {
        const video = videoRef.current;
        if (!video) return;
        hasInitializedPlaybackRef.current = true;
        if (video.paused) {
            setPausedForShadowing(false);
            void video.play().catch(() => {});
        } else {
            video.pause();
        }
    }, []);

    // Keyboard shortcuts (ignored while typing inside input/textarea)
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

    function handleVideoReady() {
        const v = videoRef.current;
        if (!v) return;

        if (pendingSeekRef.current !== null) {
            v.currentTime = pendingSeekRef.current;
            setCurrentTime(pendingSeekRef.current);
            pendingSeekRef.current = null;
        }

        if (hasInitializedPlaybackRef.current) return;
        hasInitializedPlaybackRef.current = true;

        const dur = Number.isFinite(v.duration) ? v.duration : 0;
        let targetStart = 0;

        if (startAtTime !== null && startAtTime > 0) {
            targetStart =
                dur > 0 ? Math.min(startAtTime, Math.max(0, dur - 0.5)) : startAtTime;
        } else {
            let savedTime = initialProgressTime;
            if (savedTime <= 0) {
                try {
                    const raw = window.localStorage.getItem(`trg_progress_${videoId}`);
                    if (raw) {
                        const parsed = JSON.parse(raw) as { lastTime?: number };
                        if (typeof parsed.lastTime === "number") {
                            savedTime = parsed.lastTime;
                        }
                    }
                } catch {
                    // Ignore
                }
            }

            if (savedTime > 3 && (dur === 0 || savedTime < dur - 3)) {
                targetStart = savedTime;
                setResumedFromTime(savedTime);
            }
        }

        if (targetStart > 0) {
            v.currentTime = targetStart;
            setCurrentTime(targetStart);
        }

        if (v.paused) {
            void v.play().catch(() => {
                setAutoplayBlocked(true);
            });
        }
    }

    function handleTimeUpdate() {
        const video = videoRef.current;
        if (!video) return;
        const t = video.currentTime;

        // 1. Single-segment stop (Dictation playback)
        if (segmentStopTimeRef.current !== null && t >= segmentStopTimeRef.current) {
            video.pause();
            segmentStopTimeRef.current = null;
            setCurrentTime(t);
            return;
        }

        // 1b. Custom A-B Loop
        if (
            abLoopActive &&
            loopA !== null &&
            loopB !== null &&
            loopB > loopA + 0.3 &&
            t >= loopB - 0.05
        ) {
            video.currentTime = loopA;
            setCurrentTime(loopA);
            if (video.paused) {
                void video.play().catch(() => {});
            }
            return;
        }

        // 2. Loop current sentence
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

        // 3. Auto-pause after each sentence for Shadowing
        if (autoPause && activeSubtitle) {
            if (
                t >= activeSubtitle.endTime - 0.08 &&
                lastAutoPausedSubIdRef.current !== activeSubtitle.id
            ) {
                lastAutoPausedSubIdRef.current = activeSubtitle.id;
                video.pause();
                setPausedForShadowing(true);
                setCurrentTime(t);
                return;
            }
        }

        setCurrentTime(t);

        // 4. Periodic progress sync (every 5s)
        const now = Date.now();
        if (now - lastProgressSyncRef.current >= 5000 && t > 1) {
            lastProgressSyncRef.current = now;
            persistProgress(t, video.duration);
        }
    }

    function handleToggleLoop() {
        const next = !loopSentence;
        setLoopSentence(next);
        if (next) {
            setAutoPause(false);
            setAbLoopActive(false);
            setPausedForShadowing(false);
            if (activeSubtitle) {
                setLockedLoopSubId(activeSubtitle.id);
            }
        } else {
            setLockedLoopSubId(null);
        }
        toast.info(
            next ? "Đã bật chế độ lặp lại câu hiện tại." : "Đã tắt chế độ lặp câu.",
        );
    }

    function handleToggleAutoPause() {
        const next = !autoPause;
        setAutoPause(next);
        setPausedForShadowing(false);
        lastAutoPausedSubIdRef.current = null;
        if (next) {
            setLoopSentence(false);
            setAbLoopActive(false);
            setLockedLoopSubId(null);
        }
        toast.info(
            next
                ? "Đã bật tự dừng sau mỗi câu để bạn có thời gian nhại lại."
                : "Đã tắt chế độ tự dừng sau mỗi câu.",
        );
    }

    function handleSetLoopA() {
        const t = Number((videoRef.current?.currentTime ?? currentTime).toFixed(1));
        setLoopA(t);
        if (loopB !== null && loopB <= t + 0.3) {
            setLoopB(null);
            setAbLoopActive(false);
        }
        toast.info(`Đã đặt điểm A tại ${formatTime(t)}.`);
    }

    function handleSetLoopB() {
        const t = Number((videoRef.current?.currentTime ?? currentTime).toFixed(1));
        if (loopA === null) {
            toast.info("Hãy đặt điểm A trước điểm B.");
            return;
        }
        if (t <= loopA + 0.3) {
            toast.error("Điểm B phải sau điểm A ít nhất 0.3 giây.");
            return;
        }
        setLoopB(t);
        setLoopSentence(false);
        setAutoPause(false);
        setLockedLoopSubId(null);
        setAbLoopActive(true);
        seekAndPlay(loopA);
        toast.success(`Đang lặp đoạn A-B (${formatTime(loopA)} → ${formatTime(t)}).`);
    }

    function handleClearAbLoop() {
        setLoopA(null);
        setLoopB(null);
        setAbLoopActive(false);
    }

    // Voice recording per sentence (browser-only MediaRecorder)
    async function handleToggleRecord(subId: string) {
        if (recordingSubId === subId) {
            mediaRecorderRef.current?.stop();
            setRecordingSubId(null);
            return;
        }

        if (recordingSubId) {
            mediaRecorderRef.current?.stop();
        }

        if (
            typeof navigator === "undefined" ||
            !navigator.mediaDevices?.getUserMedia ||
            typeof MediaRecorder === "undefined"
        ) {
            toast.error("Trình duyệt của bạn không hỗ trợ ghi âm trực tiếp.");
            return;
        }

        try {
            videoRef.current?.pause();
            playbackAudioRef.current?.pause();
            setPlayingRecSubId(null);

            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaStreamRef.current = stream;
            audioChunksRef.current = [];

            const recorder = new MediaRecorder(stream);
            mediaRecorderRef.current = recorder;

            recorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    audioChunksRef.current.push(event.data);
                }
            };

            recorder.onstop = () => {
                const blob = new Blob(audioChunksRef.current, {
                    type: recorder.mimeType || "audio/webm",
                });
                const newUrl = URL.createObjectURL(blob);

                const prevUrl = recordedUrlsRef.current[subId];
                if (prevUrl) URL.revokeObjectURL(prevUrl);

                recordedUrlsRef.current = {
                    ...recordedUrlsRef.current,
                    [subId]: newUrl,
                };
                setRecordedUrls({ ...recordedUrlsRef.current });
                stream.getTracks().forEach((t) => t.stop());
                mediaStreamRef.current = null;
                setRecordingSubId((curr) => (curr === subId ? null : curr));
                toast.success("Đã ghi âm xong! Nhấn 'Nghe giọng bạn' để so sánh.");
            };

            recorder.start();
            setRecordingSubId(subId);
        } catch {
            toast.error(
                "Không thể truy cập micro. Hãy cấp quyền micro cho trình duyệt rồi thử lại.",
            );
        }
    }

    function handlePlayRecording(subId: string) {
        const url = recordedUrls[subId];
        if (!url) return;

        if (playingRecSubId === subId && playbackAudioRef.current) {
            playbackAudioRef.current.pause();
            setPlayingRecSubId(null);
            return;
        }

        videoRef.current?.pause();
        playbackAudioRef.current?.pause();

        const audio = new Audio(url);
        playbackAudioRef.current = audio;
        setPlayingRecSubId(subId);
        audio.onended = () => setPlayingRecSubId(null);
        audio.onerror = () => setPlayingRecSubId(null);
        void audio.play().catch(() => setPlayingRecSubId(null));
    }

    function handleDeleteRecording(subId: string) {
        if (playingRecSubId === subId) {
            playbackAudioRef.current?.pause();
            setPlayingRecSubId(null);
        }
        const url = recordedUrlsRef.current[subId];
        if (url) URL.revokeObjectURL(url);
        const next = { ...recordedUrlsRef.current };
        delete next[subId];
        recordedUrlsRef.current = next;
        setRecordedUrls(next);
    }

    // Bookmark / Save sentence toggle
    async function handleToggleSaveSentence(subId: string) {
        if (!isLoggedIn) {
            toast.info("Đăng nhập để lưu câu hay vào kho ôn tập cá nhân.");
            setAuthModalOpen(true);
            return;
        }

        const alreadySaved = savedIds.includes(subId);
        setSavedIds((prev) =>
            alreadySaved ? prev.filter((id) => id !== subId) : [...prev, subId],
        );

        try {
            const res = alreadySaved
                ? await fetch(`/api/saved?subtitleId=${encodeURIComponent(subId)}`, {
                      method: "DELETE",
                  })
                : await fetch("/api/saved", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ subtitleId: subId }),
                  });

            if (!res.ok) {
                // Revert optimistic update
                setSavedIds((prev) =>
                    alreadySaved ? [...prev, subId] : prev.filter((id) => id !== subId),
                );
                toast.error("Không thể cập nhật danh sách câu đã lưu.");
                return;
            }

            toast.success(
                alreadySaved
                    ? "Đã bỏ lưu câu thoại."
                    : "Đã lưu vào Kho câu hay để ôn tập!",
            );
        } catch {
            setSavedIds((prev) =>
                alreadySaved ? [...prev, subId] : prev.filter((id) => id !== subId),
            );
            toast.error("Không thể kết nối máy chủ.");
        }
    }

    // Note saving
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
        [videoId, toast],
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
        const nextValue = noteContent.slice(0, start) + stamp + noteContent.slice(end);
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
        <div className="animate-fade-up space-y-4">
            {/* Top Studio Header Bar: Title, Level/Tags & Shortcuts */}
            <div className="flex flex-col gap-2 rounded-2xl border border-slate-200/90 bg-white px-4 py-3 shadow-2xs sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                        <h1 className="text-base sm:text-lg font-bold tracking-tight text-slate-900">
                            {title}
                        </h1>
                        {level && (
                            <span
                                className={`rounded-md border px-2 py-0.5 text-[11px] font-bold ${
                                    LEVEL_BADGE_STYLES[level] ??
                                    "bg-slate-100 text-slate-700 border-slate-200"
                                }`}
                            >
                                {level}
                            </span>
                        )}
                        {parseTagsList(tags).map((tag) => (
                            <span
                                key={tag}
                                className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600"
                            >
                                #{tag}
                            </span>
                        ))}
                    </div>
                    {description && (
                        <p className="mt-0.5 line-clamp-1 text-xs text-slate-500">
                            {description}
                        </p>
                    )}
                </div>

                <div className="hidden sm:flex shrink-0 items-center gap-2 text-[11px] text-slate-400">
                    <kbd className="rounded-md border border-slate-200 bg-slate-50 px-1.5 py-0.5 font-mono text-slate-600">
                        Space
                    </kbd>
                    <span>Phát / Dừng</span>
                    <span>•</span>
                    <kbd className="rounded-md border border-slate-200 bg-slate-50 px-1.5 py-0.5 font-mono text-slate-600">
                        ← / →
                    </kbd>
                    <span>Chuyển câu</span>
                </div>
            </div>

            <div className="grid gap-4 lg:gap-6 lg:grid-cols-12">
                {/* Left Column: Video Player + Controls + Pronunciation + Notes */}
                <div className="flex flex-col gap-3 sm:gap-4 lg:col-span-7">
                    <div className="relative overflow-hidden rounded-2xl border border-slate-200/90 bg-slate-950 shadow-sm">
                        <video
                            ref={videoRef}
                            src={videoUrl}
                            autoPlay
                            preload="auto"
                            controls
                            playsInline
                            onLoadedMetadata={handleVideoReady}
                            onCanPlay={handleVideoReady}
                            onTimeUpdate={handleTimeUpdate}
                            onPlay={() => {
                                setIsPlaying(true);
                                setAutoplayBlocked(false);
                                setPausedForShadowing(false);
                            }}
                            onPause={() => {
                                setIsPlaying(false);
                                const v = videoRef.current;
                                if (v && v.currentTime > 1) {
                                    persistProgress(v.currentTime, v.duration);
                                }
                            }}
                            onEnded={() => {
                                setIsPlaying(false);
                                const v = videoRef.current;
                                if (v) {
                                    persistProgress(
                                        v.duration || v.currentTime,
                                        v.duration,
                                        true,
                                    );
                                }
                            }}
                            className="aspect-video w-full bg-slate-950"
                        />

                        {autoplayBlocked && !isPlaying && (
                            <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-slate-950/35">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setAutoplayBlocked(false);
                                        hasInitializedPlaybackRef.current = true;
                                        void videoRef.current?.play().catch(() => {});
                                    }}
                                    className="pointer-events-auto inline-flex items-center gap-2 rounded-full bg-teal-700 px-5 py-2.5 text-sm font-semibold text-white shadow-lg transition hover:bg-teal-800 cursor-pointer"
                                >
                                    <Play className="h-4 w-4 fill-current" />
                                    <span>Nhấn để bắt đầu phát</span>
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Resume from last progress banner */}
                    {resumedFromTime !== null && (
                        <div className="flex items-center justify-between gap-2 rounded-xl border border-teal-200/80 bg-teal-50/70 px-3.5 py-2 text-xs text-teal-900">
                            <span>
                                Đã tiếp tục từ mốc học gần nhất{" "}
                                <strong className="font-mono">
                                    {formatTime(resumedFromTime)}
                                </strong>
                            </span>
                            <button
                                type="button"
                                onClick={() => {
                                    setResumedFromTime(null);
                                    seekAndPlay(0);
                                }}
                                className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-white px-2.5 py-1 text-[11px] font-semibold text-teal-800 shadow-2xs transition hover:bg-teal-100 cursor-pointer"
                            >
                                <RotateCcw className="h-3 w-3" />
                                <span>Xem từ đầu</span>
                            </button>
                        </div>
                    )}

                    {/* Learning Controls Bar */}
                    <div className="space-y-2.5 rounded-2xl border border-slate-200/90 bg-white p-3 sm:p-3.5 shadow-xs">
                        <div className="flex flex-col gap-2.5 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
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

                            <div className="flex flex-wrap items-center justify-between gap-2 sm:justify-end">
                                {/* Speed selector */}
                                <div className="inline-flex items-center gap-0.5 rounded-xl border border-slate-200 bg-slate-50 p-0.5">
                                    <Gauge className="ml-1.5 h-3.5 w-3.5 text-slate-400" />
                                    {[0.75, 1.0, 1.25].map((rate) => (
                                        <button
                                            key={rate}
                                            type="button"
                                            onClick={() => setPlaybackRate(rate)}
                                            className={`rounded-lg px-2 py-1.5 text-xs font-semibold transition cursor-pointer ${
                                                playbackRate === rate
                                                    ? "bg-white text-teal-800 shadow-2xs"
                                                    : "text-slate-600 hover:text-slate-900"
                                            }`}
                                        >
                                            {rate === 1 ? "1.0x" : `${rate}x`}
                                        </button>
                                    ))}
                                </div>

                                <div className="flex items-center gap-1.5">
                                    {/* Loop sentence toggle */}
                                    <button
                                        type="button"
                                        onClick={handleToggleLoop}
                                        className={`inline-flex items-center gap-1.5 rounded-xl border px-2.5 py-2 text-xs font-semibold transition cursor-pointer ${
                                            loopSentence
                                                ? "border-teal-600 bg-teal-50 text-teal-800"
                                                : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                                        }`}
                                    >
                                        <Repeat className="h-3.5 w-3.5" />
                                        <span>Lặp câu</span>
                                    </button>

                                    {/* Auto-pause after sentence toggle */}
                                    <button
                                        type="button"
                                        onClick={handleToggleAutoPause}
                                        title="Tự dừng sau khi kết thúc mỗi câu để luyện nhại theo"
                                        className={`inline-flex items-center gap-1.5 rounded-xl border px-2.5 py-2 text-xs font-semibold transition cursor-pointer ${
                                            autoPause
                                                ? "border-teal-600 bg-teal-50 text-teal-800"
                                                : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                                        }`}
                                    >
                                        <PauseCircle className="h-3.5 w-3.5" />
                                        <span>Tự dừng</span>
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Secondary Strip: ±3s quick seek & A-B Custom Loop */}
                        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-2.5 text-xs">
                            <div className="flex items-center gap-1.5">
                                <button
                                    type="button"
                                    onClick={() => seekRelative(-3)}
                                    className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 font-mono text-[11px] font-semibold text-slate-700 hover:bg-slate-100 cursor-pointer"
                                >
                                    -3s
                                </button>
                                <button
                                    type="button"
                                    onClick={() => seekRelative(3)}
                                    className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 font-mono text-[11px] font-semibold text-slate-700 hover:bg-slate-100 cursor-pointer"
                                >
                                    +3s
                                </button>
                            </div>

                            <div className="flex flex-wrap items-center gap-1.5">
                                <span className="text-[11px] font-medium text-slate-400 mr-0.5">
                                    Đoạn A–B:
                                </span>
                                <button
                                    type="button"
                                    onClick={handleSetLoopA}
                                    className={`rounded-lg border px-2.5 py-1 text-[11px] font-semibold transition cursor-pointer ${
                                        loopA !== null
                                            ? "border-teal-300 bg-teal-50 text-teal-800"
                                            : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                                    }`}
                                >
                                    {loopA !== null ? `A: ${formatTime(loopA)}` : "Đặt A"}
                                </button>
                                <button
                                    type="button"
                                    onClick={handleSetLoopB}
                                    className={`rounded-lg border px-2.5 py-1 text-[11px] font-semibold transition cursor-pointer ${
                                        abLoopActive && loopB !== null
                                            ? "border-teal-600 bg-teal-700 text-white"
                                            : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                                    }`}
                                >
                                    {loopB !== null ? `B: ${formatTime(loopB)}` : "Đặt B"}
                                </button>
                                {(loopA !== null || loopB !== null) && (
                                    <button
                                        type="button"
                                        onClick={handleClearAbLoop}
                                        title="Xóa đoạn lặp A-B"
                                        className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-500 hover:bg-rose-50 hover:text-rose-600 cursor-pointer"
                                    >
                                        <X className="h-3 w-3" />
                                        <span>Xóa A-B</span>
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>

                    {pausedForShadowing && (
                        <div className="flex items-center justify-between gap-2 rounded-xl border border-amber-200 bg-amber-50/90 px-3.5 py-2 text-xs font-medium text-amber-900">
                            <span>
                                Đã tạm dừng cuối câu — Hãy đọc nhại lại rồi nhấn{" "}
                                <kbd className="rounded border border-amber-300 bg-white px-1.5 py-0.5 font-mono text-[10px]">
                                    Space
                                </kbd>{" "}
                                hoặc nút Phát để nghe câu tiếp theo.
                            </span>
                            <button
                                type="button"
                                onClick={togglePlayPause}
                                className="shrink-0 rounded-lg bg-amber-600 px-2.5 py-1 text-[11px] font-semibold text-white transition hover:bg-amber-700 cursor-pointer"
                            >
                                Tiếp tục
                            </button>
                        </div>
                    )}

                    {/* Free Web Speech API Pronunciation Check for current sentence */}
                    {(activeSubtitle ?? subtitles[dictationIndex] ?? subtitles[0]) && (
                        <PronunciationChecker
                            targetText={
                                (
                                    activeSubtitle ??
                                    subtitles[dictationIndex] ??
                                    subtitles[0]
                                ).text
                            }
                            onBeforeStart={() => {
                                videoRef.current?.pause();
                            }}
                        />
                    )}

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
                            <span>Học thoại ({subtitles.length})</span>
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
                            <span>Ghi chú</span>
                        </button>
                    </div>

                    {/* Notes Section (Personal + Group Shared Notes) */}
                    <div
                        className={`${
                            mobileTab === "notes" ? "block" : "hidden lg:block"
                        } rounded-2xl border border-slate-200/90 bg-white p-4 shadow-xs`}
                    >
                        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                            <div className="inline-flex rounded-xl bg-slate-100 p-0.5">
                                <button
                                    type="button"
                                    onClick={() => setNoteTab("personal")}
                                    className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition cursor-pointer ${
                                        noteTab === "personal"
                                            ? "bg-white text-teal-800 shadow-2xs"
                                            : "text-slate-600 hover:text-slate-900"
                                    }`}
                                >
                                    <NotebookPen className="h-3.5 w-3.5" />
                                    <span>Ghi chú cá nhân</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setNoteTab("shared")}
                                    className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition cursor-pointer ${
                                        noteTab === "shared"
                                            ? "bg-white text-teal-800 shadow-2xs"
                                            : "text-slate-600 hover:text-slate-900"
                                    }`}
                                >
                                    <Users className="h-3.5 w-3.5" />
                                    <span>Ghi chú &amp; Bình luận</span>
                                </button>
                            </div>

                            {noteTab === "personal" && isLoggedIn && (
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
                                                <span className="text-emerald-700">
                                                    Đã lưu
                                                </span>
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

                        {noteTab === "shared" ? (
                            <SharedNotesPanel
                                videoId={videoId}
                                getCurrentTime={() =>
                                    videoRef.current?.currentTime ?? currentTime
                                }
                                isAuthenticated={isLoggedIn}
                                currentUserId={currentUserId}
                                currentUserRole={currentUserRole}
                                isAdmin={isAdmin}
                                onJumpToTime={seekAndPlay}
                                onRequireAuth={() => setAuthModalOpen(true)}
                            />
                        ) : isLoggedIn ? (
                            <>
                                <textarea
                                    ref={noteRef}
                                    rows={4}
                                    value={noteContent}
                                    onChange={(e) => handleNoteChange(e.target.value)}
                                    placeholder="Ghi lại từ vựng mới, cấu trúc câu hay hoặc cụm nối âm cần luyện lại..."
                                    className="w-full rounded-xl border border-slate-200 bg-slate-50/70 p-3 text-base sm:text-sm text-slate-800 outline-none transition focus:border-teal-600 focus:bg-white focus:ring-2 focus:ring-teal-600/15"
                                />

                                {/* Clickable timestamp chips extracted from notes */}
                                {noteTimestamps.length > 0 && (
                                    <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                                        <span className="text-[11px] font-medium text-slate-400">
                                            Tua nhanh theo mốc ghi chú:
                                        </span>
                                        {noteTimestamps.map((ts) => (
                                            <button
                                                key={ts.seconds}
                                                type="button"
                                                onClick={() => seekAndPlay(ts.seconds)}
                                                className="inline-flex items-center gap-1 rounded-lg border border-teal-200 bg-teal-50/80 px-2 py-0.5 font-mono text-[11px] font-semibold text-teal-800 transition hover:bg-teal-100 cursor-pointer"
                                            >
                                                <Play className="h-2.5 w-2.5 fill-current" />
                                                {ts.label}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </>
                        ) : (
                            <div className="flex flex-col items-start justify-between gap-3 rounded-xl border border-dashed border-slate-200 bg-slate-50/70 p-4 sm:flex-row sm:items-center">
                                <p className="text-xs leading-relaxed text-slate-600">
                                    Bạn đang học ở chế độ khách. Hãy đăng nhập để viết và
                                    lưu ghi chú cá nhân cho bài học này.
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

                {/* Right Column: Subtitles / Dictation Switcher */}
                <div
                    className={`${
                        mobileTab === "subtitles" ? "flex" : "hidden lg:flex"
                    } flex-col overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-xs lg:col-span-5 lg:h-[calc(100vh-11rem)] lg:sticky lg:top-20`}
                >
                    <div className="border-b border-slate-100">
                        {/* Row 1: Primary Mode Switcher + Subtitle/IPA Visibility Toggles */}
                        <div className="flex items-center justify-between gap-2 px-3.5 py-2.5">
                            <div className="inline-flex rounded-xl bg-slate-100 p-0.5">
                                <button
                                    type="button"
                                    onClick={() => setRightMode("subtitles")}
                                    className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition cursor-pointer ${
                                        rightMode === "subtitles"
                                            ? "bg-white text-teal-800 shadow-2xs"
                                            : "text-slate-600 hover:text-slate-900"
                                    }`}
                                >
                                    <Languages className="h-3.5 w-3.5" />
                                    <span>Phụ đề ({subtitles.length})</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        if (activeSubtitleIndex >= 0) {
                                            setDictationIndex(activeSubtitleIndex);
                                        }
                                        setRightMode("dictation");
                                    }}
                                    className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition cursor-pointer ${
                                        rightMode === "dictation"
                                            ? "bg-white text-teal-800 shadow-2xs"
                                            : "text-slate-600 hover:text-slate-900"
                                    }`}
                                >
                                    <Keyboard className="h-3.5 w-3.5" />
                                    <span>Chép chính tả</span>
                                </button>
                            </div>

                            {rightMode === "subtitles" && (
                                <div className="flex items-center gap-1.5 shrink-0">
                                    <button
                                        type="button"
                                        onClick={() => setShowSubtitles((prev) => !prev)}
                                        title={
                                            showSubtitles
                                                ? "Ẩn toàn bộ phụ đề"
                                                : "Hiện phụ đề"
                                        }
                                        className={`inline-flex items-center gap-1 rounded-xl border px-2.5 py-1.5 text-xs font-semibold transition cursor-pointer ${
                                            showSubtitles
                                                ? "border-teal-200 bg-teal-50 text-teal-800"
                                                : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                                        }`}
                                    >
                                        {showSubtitles ? (
                                            <>
                                                <Captions className="h-3.5 w-3.5" />
                                                <span className="hidden sm:inline">
                                                    Ẩn sub
                                                </span>
                                            </>
                                        ) : (
                                            <>
                                                <CaptionsOff className="h-3.5 w-3.5" />
                                                <span className="hidden sm:inline">
                                                    Hiện sub
                                                </span>
                                            </>
                                        )}
                                    </button>

                                    {showSubtitles && (
                                        <button
                                            type="button"
                                            onClick={() => setShowIpa((prev) => !prev)}
                                            title={
                                                showIpa
                                                    ? "Ẩn phiên âm IPA"
                                                    : "Hiện phiên âm IPA"
                                            }
                                            aria-label={
                                                showIpa
                                                    ? "Ẩn phiên âm IPA"
                                                    : "Hiện phiên âm IPA"
                                            }
                                            className={`inline-flex items-center gap-1 rounded-xl border px-2.5 py-1.5 text-xs font-semibold transition cursor-pointer ${
                                                showIpa
                                                    ? "border-teal-200 bg-teal-50 text-teal-800"
                                                    : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                                            }`}
                                        >
                                            {showIpa ? (
                                                <>
                                                    <Eye className="h-3.5 w-3.5" />
                                                    <span className="hidden sm:inline">
                                                        Ẩn IPA
                                                    </span>
                                                </>
                                            ) : (
                                                <>
                                                    <EyeOff className="h-3.5 w-3.5" />
                                                    <span className="hidden sm:inline">
                                                        Hiện IPA
                                                    </span>
                                                </>
                                            )}
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Row 2: Calm Utility Sub-bar (Word-tap tip + Export Downloads) */}
                        {rightMode === "subtitles" && subtitles.length > 0 && (
                            <div className="flex items-center justify-between gap-2 border-t border-slate-100 bg-slate-50/70 px-3.5 py-1.5 text-[11px] text-slate-500">
                                <span className="truncate">
                                    Bấm vào bất kỳ từ nào để tra nghĩa &amp; lưu
                                </span>
                                <div className="flex shrink-0 items-center gap-1.5">
                                    <span className="hidden sm:inline text-slate-400">
                                        Xuất:
                                    </span>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            triggerTextDownload(
                                                `${sanitizeFilename(title)}.srt`,
                                                formatSrtContent(subtitles),
                                            );
                                            toast.success("Đã tải phụ đề (.srt)!");
                                        }}
                                        title="Tải phụ đề định dạng .srt"
                                        className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-0.5 text-[11px] font-semibold text-slate-600 transition hover:border-teal-300 hover:bg-teal-50 hover:text-teal-800 cursor-pointer"
                                    >
                                        <Download className="h-3 w-3" />
                                        <span>.SRT</span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            triggerTextDownload(
                                                `${sanitizeFilename(title)}-ipa.txt`,
                                                formatTxtTranscript(title, subtitles),
                                            );
                                            toast.success(
                                                "Đã tải bản ghi hội thoại + IPA (.txt)!",
                                            );
                                        }}
                                        title="Tải toàn bộ câu thoại & IPA (.txt)"
                                        className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-0.5 text-[11px] font-semibold text-slate-600 transition hover:border-teal-300 hover:bg-teal-50 hover:text-teal-800 cursor-pointer"
                                    >
                                        <Download className="h-3 w-3" />
                                        <span>.TXT</span>
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>

                    {rightMode === "dictation" ? (
                        <div className="flex-1 overflow-y-auto">
                            <DictationPanel
                                subtitles={subtitles}
                                currentIndex={dictationIndex}
                                onPlaySegment={playSingleSegment}
                                onSelectIndex={(idx) => {
                                    setDictationIndex(idx);
                                    if (subtitles[idx]) {
                                        playSingleSegment(subtitles[idx]);
                                    }
                                }}
                                onCorrectAnswer={() => {
                                    if (!isLoggedIn) return;
                                    void fetch("/api/stats", {
                                        method: "POST",
                                        headers: { "Content-Type": "application/json" },
                                        body: JSON.stringify({ dictationCorrect: 1 }),
                                    }).catch(() => {});
                                }}
                            />
                        </div>
                    ) : (
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
                                        Toàn bộ phụ đề và phiên âm IPA đang được ẩn. Bạn
                                        vẫn có thể dùng nút Lặp câu, Tự dừng hoặc phím ← /
                                        → để luyện tập.
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
                                    const isSaved = savedIds.includes(sub.id);
                                    const isRecordingThis = recordingSubId === sub.id;
                                    const hasRecording = Boolean(recordedUrls[sub.id]);
                                    const isPlayingRec = playingRecSubId === sub.id;

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

                                                <div
                                                    className="flex items-center gap-1"
                                                    onClick={(e) => e.stopPropagation()}
                                                >
                                                    <button
                                                        type="button"
                                                        onClick={() =>
                                                            void handleToggleRecord(
                                                                sub.id,
                                                            )
                                                        }
                                                        title={
                                                            isRecordingThis
                                                                ? "Dừng ghi âm"
                                                                : "Thu âm giọng đọc nhại câu này"
                                                        }
                                                        className={`rounded-lg p-1.5 transition cursor-pointer ${
                                                            isRecordingThis
                                                                ? "animate-pulse bg-rose-600 text-white"
                                                                : "text-slate-400 hover:bg-slate-200/70 hover:text-teal-800"
                                                        }`}
                                                    >
                                                        {isRecordingThis ? (
                                                            <Square className="h-3.5 w-3.5 fill-current" />
                                                        ) : (
                                                            <Mic className="h-3.5 w-3.5" />
                                                        )}
                                                    </button>

                                                    <button
                                                        type="button"
                                                        onClick={() =>
                                                            void handleToggleSaveSentence(
                                                                sub.id,
                                                            )
                                                        }
                                                        title={
                                                            isSaved
                                                                ? "Bỏ lưu câu này"
                                                                : "Lưu câu hay vào kho ôn tập"
                                                        }
                                                        className={`rounded-lg p-1.5 transition cursor-pointer ${
                                                            isSaved
                                                                ? "bg-teal-100 text-teal-800 hover:bg-teal-200"
                                                                : "text-slate-400 hover:bg-slate-200/70 hover:text-slate-700"
                                                        }`}
                                                    >
                                                        <Bookmark
                                                            className={`h-3.5 w-3.5 ${
                                                                isSaved
                                                                    ? "fill-current"
                                                                    : ""
                                                            }`}
                                                        />
                                                    </button>

                                                    <button
                                                        type="button"
                                                        onClick={() =>
                                                            jumpToSubtitle(sub)
                                                        }
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
                                            </div>

                                            <p
                                                className={`text-sm leading-relaxed font-medium ${
                                                    isActive
                                                        ? "text-slate-950"
                                                        : "text-slate-800"
                                                }`}
                                            >
                                                {sub.text
                                                    .split(/([A-Za-z']+)/)
                                                    .map((part, tokIdx) =>
                                                        /^[A-Za-z']+$/.test(part) ? (
                                                            <span
                                                                key={tokIdx}
                                                                role="button"
                                                                tabIndex={0}
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    setSelectedWord({
                                                                        word: part,
                                                                        sentence:
                                                                            sub.text,
                                                                        startTime:
                                                                            sub.startTime,
                                                                    });
                                                                }}
                                                                onKeyDown={(e) => {
                                                                    if (
                                                                        e.key ===
                                                                            "Enter" ||
                                                                        e.key === " "
                                                                    ) {
                                                                        e.preventDefault();
                                                                        e.stopPropagation();
                                                                        setSelectedWord({
                                                                            word: part,
                                                                            sentence:
                                                                                sub.text,
                                                                            startTime:
                                                                                sub.startTime,
                                                                        });
                                                                    }
                                                                }}
                                                                title="Bấm để tra nghĩa & lưu từ vựng"
                                                                className="rounded px-0.5 transition hover:bg-teal-100/90 hover:text-teal-900"
                                                            >
                                                                {part}
                                                            </span>
                                                        ) : (
                                                            <span key={tokIdx}>
                                                                {part}
                                                            </span>
                                                        ),
                                                    )}
                                            </p>

                                            {showIpa && sub.ipa && (
                                                <p
                                                    className={`mt-1.5 font-mono text-xs leading-relaxed ${
                                                        isActive
                                                            ? "text-teal-800"
                                                            : "text-slate-500"
                                                    }`}
                                                >
                                                    {sub.ipa}
                                                </p>
                                            )}

                                            {/* Recorded Shadowing Playback Bar */}
                                            {hasRecording && (
                                                <div
                                                    onClick={(e) => e.stopPropagation()}
                                                    className="mt-2.5 flex items-center justify-between gap-2 rounded-lg border border-teal-200/80 bg-white px-2.5 py-1.5"
                                                >
                                                    <button
                                                        type="button"
                                                        onClick={() =>
                                                            handlePlayRecording(sub.id)
                                                        }
                                                        className="inline-flex items-center gap-1.5 text-xs font-semibold text-teal-800 hover:text-teal-900 cursor-pointer"
                                                    >
                                                        {isPlayingRec ? (
                                                            <>
                                                                <Square className="h-3 w-3 fill-current text-rose-600" />
                                                                <span className="text-rose-700">
                                                                    Đang phát giọng bạn...
                                                                </span>
                                                            </>
                                                        ) : (
                                                            <>
                                                                <Play className="h-3 w-3 fill-current" />
                                                                <span>
                                                                    Nghe lại giọng bạn
                                                                </span>
                                                            </>
                                                        )}
                                                    </button>

                                                    <button
                                                        type="button"
                                                        onClick={() =>
                                                            handleDeleteRecording(sub.id)
                                                        }
                                                        title="Xóa bản thu"
                                                        className="rounded p-1 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600 cursor-pointer"
                                                    >
                                                        <Trash2 className="h-3 w-3" />
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })
                            )}
                        </div>
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

            <AuthModal open={authModalOpen} onClose={() => setAuthModalOpen(false)} />

            {selectedWord && (
                <WordPopover
                    key={selectedWord.word}
                    word={selectedWord.word}
                    contextSentence={selectedWord.sentence}
                    videoId={videoId}
                    startTime={selectedWord.startTime}
                    isAuthenticated={isLoggedIn}
                    onRequireAuth={() => setAuthModalOpen(true)}
                    onClose={() => setSelectedWord(null)}
                />
            )}
        </div>
    );
}
