"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Clock,
  Crosshair,
  ExternalLink,
  Languages,
  Loader2,
  Play,
  Plus,
  RefreshCw,
  Save,
  Trash2,
} from "lucide-react";
import { useToast } from "@/components/ToastProvider";
import ConfirmModal from "@/components/ConfirmModal";

export interface EditableSubtitle {
  localId: string;
  startTime: number;
  endTime: number;
  speaker: string;
  text: string;
  ipa: string;
}

interface SubtitleEditorProps {
  videoId: string;
  title: string;
  videoUrl: string;
  initialSubtitles: Array<{
    id: string;
    index: number;
    startTime: number;
    endTime: number;
    speaker: string | null;
    text: string;
    ipa: string;
  }>;
}

function formatTimePrecise(seconds: number): string {
  const safe = Math.max(0, seconds);
  const mins = Math.floor(safe / 60);
  const secs = safe - mins * 60;
  return `${String(mins).padStart(2, "0")}:${secs.toFixed(1).padStart(4, "0")}`;
}

export default function SubtitleEditor({
  videoId,
  title,
  videoUrl,
  initialSubtitles,
}: SubtitleEditorProps) {
  const toast = useToast();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const previewEndRef = useRef<number | null>(null);

  const [subtitles, setSubtitles] = useState<EditableSubtitle[]>(() =>
    initialSubtitles.map((s) => ({
      localId: s.id,
      startTime: s.startTime,
      endTime: s.endTime,
      speaker: s.speaker ?? "",
      text: s.text,
      ipa: s.ipa,
    }))
  );
  const [currentTime, setCurrentTime] = useState(0);
  const [shiftSeconds, setShiftSeconds] = useState("0.0");
  const [dirty, setDirty] = useState(false);

  const [saving, setSaving] = useState(false);
  const [reprocessing, setReprocessing] = useState(false);
  const [reprocessModalOpen, setReprocessModalOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<EditableSubtitle | null>(
    null
  );

  // Stop preview playback when previewEndRef is reached
  function handleTimeUpdate() {
    const v = videoRef.current;
    if (!v) return;
    const t = v.currentTime;
    setCurrentTime(t);

    if (previewEndRef.current !== null && t >= previewEndRef.current) {
      v.pause();
      previewEndRef.current = null;
    }
  }

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (dirty) {
        e.preventDefault();
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [dirty]);

  function updateField<K extends keyof EditableSubtitle>(
    localId: string,
    field: K,
    value: EditableSubtitle[K]
  ) {
    setDirty(true);
    setSubtitles((prev) =>
      prev.map((item) =>
        item.localId === localId ? { ...item, [field]: value } : item
      )
    );
  }

  function snapToCurrentTime(
    localId: string,
    field: "startTime" | "endTime"
  ) {
    const snapped = Number((videoRef.current?.currentTime ?? 0).toFixed(1));
    setDirty(true);
    setSubtitles((prev) =>
      prev.map((item) => {
        if (item.localId !== localId) return item;
        if (field === "startTime") {
          const nextEnd =
            item.endTime <= snapped
              ? Number((snapped + 1.5).toFixed(1))
              : item.endTime;
          return { ...item, startTime: snapped, endTime: nextEnd };
        }
        return { ...item, endTime: snapped };
      })
    );
  }

  function previewSegment(sub: EditableSubtitle) {
    const v = videoRef.current;
    if (!v) return;
    previewEndRef.current = sub.endTime;
    v.currentTime = sub.startTime;
    void v.play().catch(() => {});
  }

  function handleAddSentence() {
    const t = Number((videoRef.current?.currentTime ?? 0).toFixed(1));
    const newItem: EditableSubtitle = {
      localId: `new-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      startTime: t,
      endTime: Number((t + 2.5).toFixed(1)),
      speaker: "",
      text: "",
      ipa: "",
    };

    setDirty(true);
    setSubtitles((prev) =>
      [...prev, newItem].sort((a, b) => a.startTime - b.startTime)
    );
    toast.info(`Đã thêm câu mới tại mốc ${formatTimePrecise(t)}.`);
  }

  function handleShiftAll() {
    const delta = Number(shiftSeconds);
    if (!Number.isFinite(delta) || delta === 0) {
      toast.info("Hãy nhập số giây cần dịch chuyển (vd: 0.5 hoặc -0.5).");
      return;
    }

    setDirty(true);
    setSubtitles((prev) =>
      prev.map((s) => {
        const nextStart = Math.max(0, Number((s.startTime + delta).toFixed(1)));
        const nextEnd = Math.max(
          Number((nextStart + 0.3).toFixed(1)),
          Number((s.endTime + delta).toFixed(1))
        );
        return { ...s, startTime: nextStart, endTime: nextEnd };
      })
    );
    toast.success(
      `Đã dịch chuyển toàn bộ ${subtitles.length} câu thêm ${delta > 0 ? `+${delta}` : delta} giây.`
    );
  }

  function confirmDeleteRow() {
    if (!deleteTarget) return;
    setDirty(true);
    setSubtitles((prev) =>
      prev.filter((s) => s.localId !== deleteTarget.localId)
    );
    setDeleteTarget(null);
    toast.info("Đã xóa câu thoại. Nhấn Lưu thay đổi để cập nhật.");
  }

  async function handleSaveAll() {
    setSaving(true);
    try {
      const res = await fetch(`/api/videos/${videoId}/subtitles`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subtitles: subtitles.map((s) => ({
            startTime: Number(s.startTime),
            endTime: Number(s.endTime),
            speaker: s.speaker,
            text: s.text,
            ipa: s.ipa,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Không thể lưu phụ đề lúc này.");
        return;
      }

      setSubtitles(
        data.subtitles.map(
          (s: {
            id: string;
            startTime: number;
            endTime: number;
            speaker: string | null;
            text: string;
            ipa: string;
          }) => ({
            localId: s.id,
            startTime: s.startTime,
            endTime: s.endTime,
            speaker: s.speaker ?? "",
            text: s.text,
            ipa: s.ipa,
          })
        )
      );
      setDirty(false);
      toast.success("Đã lưu toàn bộ phụ đề và phiên âm IPA thành công!");
    } catch {
      toast.error("Không thể kết nối máy chủ khi lưu phụ đề.");
    } finally {
      setSaving(false);
    }
  }

  async function executeReprocess() {
    setReprocessModalOpen(false);
    setReprocessing(true);
    try {
      const res = await fetch(`/api/videos/${videoId}/reprocess`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Không thể tạo lại phụ đề lúc này.");
        return;
      }

      setSubtitles(
        data.subtitles.map(
          (s: {
            id: string;
            startTime: number;
            endTime: number;
            speaker: string | null;
            text: string;
            ipa: string;
          }) => ({
            localId: s.id,
            startTime: s.startTime,
            endTime: s.endTime,
            speaker: s.speaker ?? "",
            text: s.text,
            ipa: s.ipa,
          })
        )
      );
      setDirty(false);
      toast.success("Đã phân tích lại phụ đề bằng AI thành công!");
    } catch {
      toast.error("Không thể kết nối máy chủ khi phân tích lại.");
    } finally {
      setReprocessing(false);
    }
  }

  return (
    <div className="animate-fade-up space-y-5">
      {/* Top Action Header */}
      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200/90 bg-white p-4 shadow-xs sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Link
            href="/admin"
            className="mb-1 inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 transition hover:text-teal-700"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Quay lại trang Quản trị</span>
          </Link>
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-lg font-bold text-slate-900">
              Chỉnh sửa Sub & IPA: {title}
            </h1>
            {dirty && (
              <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-[11px] font-semibold text-amber-700 border border-amber-200">
                Chưa lưu thay đổi
              </span>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={`/learn/${videoId}`}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 transition hover:bg-slate-50"
          >
            <ExternalLink className="h-3.5 w-3.5 text-teal-700" />
            <span>Xem trang học</span>
          </Link>

          <button
            type="button"
            disabled={saving || reprocessing}
            onClick={() => setReprocessModalOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-teal-200 bg-teal-50 px-3 py-2 text-xs font-semibold text-teal-800 transition hover:bg-teal-100 disabled:opacity-50 cursor-pointer"
          >
            {reprocessing ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5" />
            )}
            <span>
              {reprocessing ? "Đang chạy AI tách sub..." : "Chạy lại AI tách sub"}
            </span>
          </button>

          <button
            type="button"
            disabled={saving || reprocessing}
            onClick={() => void handleSaveAll()}
            className="inline-flex items-center gap-1.5 rounded-xl bg-teal-700 px-4 py-2 text-xs font-semibold text-white shadow-xs transition hover:bg-teal-800 disabled:opacity-60 cursor-pointer"
          >
            {saving ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Save className="h-3.5 w-3.5" />
            )}
            <span>Lưu tất cả ({subtitles.length} câu)</span>
          </button>
        </div>
      </div>

      {reprocessing && (
        <div className="flex items-center gap-3 rounded-2xl border border-teal-200 bg-teal-50/70 px-4 py-3 text-xs font-medium text-teal-900">
          <Loader2 className="h-4 w-4 shrink-0 animate-spin text-teal-700" />
          <span>
            Đang chạy lại AI tách phụ đề theo từng đoạn ngắn. Quá trình này có
            thể mất 15–60 giây tùy độ dài video, vui lòng giữ nguyên trang...
          </span>
        </div>
      )}

      {/* Split Workspace */}
      <div className="grid gap-6 lg:grid-cols-12">
        {/* Left: Sticky Video Player + Timing Tools */}
        <div className="lg:col-span-5">
          <div className="space-y-4 lg:sticky lg:top-20">
            <div className="overflow-hidden rounded-2xl border border-slate-200/90 bg-slate-950 shadow-sm">
              <video
                ref={videoRef}
                src={videoUrl}
                controls
                preload="auto"
                playsInline
                onPlay={() => {
                  // Clear segment stop if user manually presses native play
                }}
                onTimeUpdate={handleTimeUpdate}
                className="aspect-video w-full bg-slate-950"
              />
            </div>

            <div className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2 text-xs font-medium text-slate-600">
                  <Clock className="h-4 w-4 text-teal-700" />
                  <span>Mốc video hiện tại:</span>
                </div>
                <span className="rounded-lg bg-slate-100 px-2.5 py-1 font-mono text-xs font-bold text-slate-900">
                  {formatTimePrecise(currentTime)} ({currentTime.toFixed(1)}s)
                </span>
              </div>

              <button
                type="button"
                onClick={handleAddSentence}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-teal-200 bg-teal-50 py-2.5 text-xs font-semibold text-teal-800 transition hover:bg-teal-100 cursor-pointer"
              >
                <Plus className="h-4 w-4" />
                <span>
                  Thêm câu mới tại mốc {formatTimePrecise(currentTime)}
                </span>
              </button>

              <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3">
                <p className="mb-2 text-xs font-semibold text-slate-700">
                  Dịch chuyển toàn bộ mốc thời gian (giây)
                </p>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    step="0.1"
                    value={shiftSeconds}
                    onChange={(e) => setShiftSeconds(e.target.value)}
                    placeholder="vd: -0.5 hoặc 0.5"
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 font-mono text-xs outline-none focus:border-teal-600"
                  />
                  <button
                    type="button"
                    onClick={handleShiftAll}
                    className="shrink-0 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 cursor-pointer"
                  >
                    Áp dụng
                  </button>
                </div>
                <p className="mt-1.5 text-[11px] text-slate-400">
                  Dùng số âm (vd: -0.5) nếu phụ đề hiện chậm hơn tiếng, số dương
                  nếu hiện sớm hơn.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Editable Subtitles List */}
        <div className="lg:col-span-7 space-y-3">
          {subtitles.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white py-16 text-center">
              <Languages className="mx-auto mb-3 h-8 w-8 text-slate-300" />
              <p className="text-sm font-medium text-slate-600">
                Chưa có câu phụ đề nào.
              </p>
              <p className="mt-1 text-xs text-slate-400">
                Bấm &ldquo;Thêm câu mới&rdquo; hoặc &ldquo;Chạy lại AI tách
                sub&rdquo; để bắt đầu.
              </p>
            </div>
          ) : (
            subtitles.map((sub, idx) => {
              const isActive =
                currentTime >= sub.startTime && currentTime <= sub.endTime;

              return (
                <div
                  key={sub.localId}
                  className={`rounded-2xl border p-4 shadow-2xs transition ${
                    isActive
                      ? "border-teal-500 bg-teal-50/40"
                      : "border-slate-200/90 bg-white"
                  }`}
                >
                  {/* Card Top Bar */}
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span
                        className={`rounded-lg px-2 py-0.5 font-mono text-xs font-bold ${
                          isActive
                            ? "bg-teal-700 text-white"
                            : "bg-slate-100 text-slate-700"
                        }`}
                      >
                        #{idx + 1}
                      </span>
                      <button
                        type="button"
                        onClick={() => previewSegment(sub)}
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 transition hover:bg-slate-50 cursor-pointer"
                      >
                        <Play className="h-3 w-3 fill-current text-teal-700" />
                        <span>Nghe đoạn này</span>
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => setDeleteTarget(sub)}
                      title="Xóa câu này"
                      className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-rose-50/60 px-2.5 py-1 text-xs font-medium text-rose-700 transition hover:bg-rose-100 cursor-pointer"
                    >
                      <Trash2 className="h-3 w-3" />
                      <span>Xóa</span>
                    </button>
                  </div>

                  {/* Timing + Speaker Row */}
                  <div className="mb-3 grid gap-2.5 sm:grid-cols-3">
                    <div>
                      <label className="mb-1 block text-[11px] font-medium text-slate-500">
                        Bắt đầu (giây)
                      </label>
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          step="0.1"
                          min="0"
                          value={sub.startTime}
                          onChange={(e) =>
                            updateField(
                              sub.localId,
                              "startTime",
                              Number(e.target.value)
                            )
                          }
                          className="w-full rounded-lg border border-slate-200 bg-slate-50/50 px-2.5 py-1.5 font-mono text-xs outline-none focus:border-teal-600 focus:bg-white"
                        />
                        <button
                          type="button"
                          onClick={() =>
                            snapToCurrentTime(sub.localId, "startTime")
                          }
                          title="Gán bằng mốc video đang phát"
                          className="shrink-0 rounded-lg border border-slate-200 bg-white p-1.5 text-teal-700 transition hover:bg-teal-50 cursor-pointer"
                        >
                          <Crosshair className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="mb-1 block text-[11px] font-medium text-slate-500">
                        Kết thúc (giây)
                      </label>
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          step="0.1"
                          min="0"
                          value={sub.endTime}
                          onChange={(e) =>
                            updateField(
                              sub.localId,
                              "endTime",
                              Number(e.target.value)
                            )
                          }
                          className="w-full rounded-lg border border-slate-200 bg-slate-50/50 px-2.5 py-1.5 font-mono text-xs outline-none focus:border-teal-600 focus:bg-white"
                        />
                        <button
                          type="button"
                          onClick={() =>
                            snapToCurrentTime(sub.localId, "endTime")
                          }
                          title="Gán bằng mốc video đang phát"
                          className="shrink-0 rounded-lg border border-slate-200 bg-white p-1.5 text-teal-700 transition hover:bg-teal-50 cursor-pointer"
                        >
                          <Crosshair className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="mb-1 block text-[11px] font-medium text-slate-500">
                        Nhân vật (tùy chọn)
                      </label>
                      <input
                        type="text"
                        value={sub.speaker}
                        onChange={(e) =>
                          updateField(sub.localId, "speaker", e.target.value)
                        }
                        placeholder="vd: Narrator"
                        className="w-full rounded-lg border border-slate-200 bg-slate-50/50 px-2.5 py-1.5 text-xs outline-none focus:border-teal-600 focus:bg-white"
                      />
                    </div>
                  </div>

                  {/* English Text & IPA */}
                  <div className="space-y-2.5">
                    <div>
                      <label className="mb-1 block text-[11px] font-medium text-slate-500">
                        Lời thoại tiếng Anh
                      </label>
                      <textarea
                        rows={2}
                        value={sub.text}
                        onChange={(e) =>
                          updateField(sub.localId, "text", e.target.value)
                        }
                        placeholder="Nhập câu tiếng Anh..."
                        className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 text-sm font-medium text-slate-900 outline-none focus:border-teal-600 focus:bg-white"
                      />
                    </div>

                    <div>
                      <label className="mb-1 block text-[11px] font-medium text-slate-500">
                        Phiên âm IPA
                      </label>
                      <input
                        type="text"
                        value={sub.ipa}
                        onChange={(e) =>
                          updateField(sub.localId, "ipa", e.target.value)
                        }
                        placeholder="/.../"
                        className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 font-mono text-xs text-teal-800 outline-none focus:border-teal-600 focus:bg-white"
                      />
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Confirm Reprocess Modal */}
      <ConfirmModal
        open={reprocessModalOpen}
        title="Chạy lại AI tách phụ đề?"
        description="Hệ thống sẽ tách lại âm thanh theo từng đoạn ngắn để nâng cao độ chính xác và thay thế toàn bộ phụ đề hiện tại của video này."
        confirmText="Bắt đầu tách lại"
        onConfirm={() => void executeReprocess()}
        onCancel={() => setReprocessModalOpen(false)}
      />

      {/* Confirm Delete Subtitle Modal */}
      <ConfirmModal
        open={Boolean(deleteTarget)}
        variant="danger"
        title="Xóa câu thoại này?"
        description={
          deleteTarget
            ? `Câu "${deleteTarget.text || "(trống)"}" sẽ bị xóa khỏi danh sách. Bạn cần nhấn Lưu tất cả để áp dụng thay đổi.`
            : ""
        }
        confirmText="Xóa câu"
        onConfirm={confirmDeleteRow}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
